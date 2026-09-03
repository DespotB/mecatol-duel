import { MECATOL_ID, systemDef } from '../data/map'
import { NON_FIGHTER_SHIPS, isShip, unitStats, type StatsOwner } from '../data/units'
import { otherSeat } from './actionPhase'
import { neighbours } from './adjacency'
import { destroyUnits, dieRolls, hasTech, rollHits, shipsOf, statsOwner, trimCargo } from './board'
import { deriveSeed, mulberry32 } from './rng'
import type { DieRoll, GameState, Owner, Result, Seat, Unit, UnitType } from './types'

const DESTROY_ORDER: readonly UnitType[] = ['fighter', 'destroyer', 'cruiser', 'carrier', 'dreadnought', 'flagship', 'warsun']
const NON_FIGHTER_ORDER: readonly UnitType[] = DESTROY_ORDER.filter(t => t !== 'fighter')

export type HitMode = 'any' | 'noFighters' | 'preferNonFighters'
export interface HitGroup { count: number; mode: HitMode }
const MODE_RANK: Record<HitMode, number> = { noFighters: 0, preferNonFighters: 1, any: 2 }

/**
 * All dice draws in a combat use mulberry32(deriveSeed(seed, salt)) with disjoint salts, so a single seed
 * replays deterministically and every die can be reconstructed from the log: anti-fighter barrage uses
 * AFB_SALT_BASE and AFB_SALT_BASE + 1 (one per side); space cannon offense starts at SPACE_CANNON_SALT_BASE
 * and takes one salt per shooting owner (at most three in this duel engine, so it cannot reach the AFB
 * salts); round r >= 1 combat rolls use 4r + 10 (attacker) and 4r + 11 (defender), which start at 14 and so
 * never collide with either pre-combat step.
 */
const AFB_SALT_BASE = 3
const SPACE_CANNON_SALT_BASE = 5

interface Ctx { systemId: string; attacker: Seat; defender: Owner; round: number }

/** R4.1 step 3: the defender rolls at +1 in a nebula, which is one lower on the threshold. */
export function defenderModifier(systemId: string): number {
  return systemDef(systemId).anomaly === 'nebula' ? 1 : 0
}

/** R4.1 steps 4 and 6: sustain first, then the destruction order; restricted hits with no target are lost. */
export function assignHits(units: Unit[], groups: HitGroup[], owner: StatsOwner, nes: boolean): { units: Unit[]; destroyed: Unit[]; sustainedIds: number[]; lost: number } {
  let list = units.map(u => ({ ...u }))
  const destroyed: Unit[] = []
  const sustainedIds: number[] = []
  const queue = groups.filter(g => g.count > 0).map(g => ({ ...g })).sort((a, b) => MODE_RANK[a.mode] - MODE_RANK[b.mode])
  let lost = 0
  for (const u of list) {
    if (!queue.some(g => g.count > 0)) break
    if (u.damaged || !unitStats(u.type, owner).sustain) continue
    u.damaged = true
    sustainedIds.push(u.id)
    let cancel = nes ? 2 : 1
    for (const g of queue) {
      const take = Math.min(cancel, g.count)
      g.count -= take
      cancel -= take
      if (cancel <= 0) break
    }
  }
  for (const g of queue) {
    while (g.count > 0) {
      const first = (types: readonly UnitType[]) => types.flatMap(t => list.filter(u => u.type === t))[0]
      const target = g.mode === 'noFighters' ? first(NON_FIGHTER_ORDER)
        : g.mode === 'preferNonFighters' ? (first(NON_FIGHTER_ORDER) ?? first(DESTROY_ORDER))
          : first(DESTROY_ORDER)
      if (!target) {
        if (g.mode === 'noFighters' && list.length) lost += g.count
        break
      }
      list = list.filter(u => u.id !== target.id)
      destroyed.push(target)
      g.count--
    }
  }
  return { units: list, destroyed, sustainedIds, lost }
}

/** Applies a round or step's hits; keeps `sys.space` in its original relative order (only the owner's ships change). */
export function applyCombatHits(state: GameState, systemId: string, owner: Owner, groups: HitGroup[]): GameState {
  if (!groups.some(g => g.count > 0)) return state
  const sys = state.systems[systemId]
  const result = assignHits(shipsOf(sys, owner), groups, statsOwner(state, owner), hasTech(state, owner, 'non_euclidean_shielding'))
  const keptById = new Map(result.units.map(u => [u.id, u]))
  const space = sys.space.flatMap(u => {
    if (!(u.owner === owner && isShip(u.type))) return [u]
    const kept = keptById.get(u.id)
    return kept ? [kept] : []
  })
  const next: GameState = { ...state, systems: { ...state.systems, [systemId]: { ...sys, space } } }
  return destroyUnits(next, systemId, result.destroyed)
}

/**
 * R4.1 step 4: Duranium Armor repairs one damaged unit that did not sustain a hit this round. Only relevant
 * for round >= 1 combat rounds; the round 0 pre-combat steps never repair.
 */
export function repairAfterRound(state: GameState, systemId: string, owner: Owner, sustainedIds: number[]): GameState {
  if (!hasTech(state, owner, 'duranium_armor')) return state
  const sys = state.systems[systemId]
  const repair = shipsOf(sys, owner).find(u => u.damaged && !sustainedIds.includes(u.id))
  if (!repair) return state
  return { ...state, systems: { ...state.systems, [systemId]: { ...sys, space: sys.space.map(u => u.id === repair.id ? { ...u, damaged: false } : u) } } }
}

export function canMunitions(state: GameState, owner: Owner): boolean {
  return owner !== 'guardian' && state.players[owner].faction === 'letnev' && state.players[owner].tradeGoods >= 2
}

function payMunitions(state: GameState, owner: Owner): GameState {
  if (owner === 'guardian') return state
  const players = [...state.players] as GameState['players']
  players[owner] = { ...players[owner], tradeGoods: players[owner].tradeGoods - 2 }
  return { ...state, players }
}

/**
 * Rolls one side's combat dice. `rolls` is every die exactly as originally rolled (including misses), so the
 * log always shows what was actually thrown; when `reroll` is set (Munitions Reserves), the new dice for the
 * original misses come back separately in `rerollRolls`, logged under their own ' reroll' context.
 */
function combatRolls(state: GameState, ctx: Ctx, owner: Owner, bonus: number, reroll: boolean, seed: number, salt: number): { rolls: DieRoll[]; rerollRolls: DieRoll[]; hits: number; restricted: number } {
  const sOwner = statsOwner(state, owner)
  const rng = mulberry32(deriveSeed(seed, salt))
  const l1z1x = owner !== 'guardian' && state.players[owner].faction === 'l1z1x'
  const rolls: DieRoll[] = []
  const rerollRolls: DieRoll[] = []
  let hits = 0
  let restricted = 0
  for (const u of shipsOf(state.systems[ctx.systemId], owner)) {
    const stats = unitStats(u.type, sOwner)
    if (stats.combat === null) continue
    const value = stats.combat - bonus
    const roll = rollHits(rng, stats.combatDice, value, false)
    rolls.push(...dieRolls(owner, u.type, roll.rolls, value))
    let unitHits = roll.hits
    if (reroll) {
      const misses = roll.rolls.filter(v => v < value).length
      if (misses) {
        const again = rollHits(rng, misses, value, false)
        rerollRolls.push(...dieRolls(owner, u.type, again.rolls, value))
        unitHits += again.hits
      }
    }
    hits += unitHits
    if (l1z1x && (u.type === 'dreadnought' || u.type === 'flagship')) restricted += unitHits
  }
  return { rolls, rerollRolls, hits, restricted }
}

/**
 * R4.1 step 1: the PDS of every owner in the system except `attacker` fire at the attacker's ships. Fires
 * even when the attacker meets no enemy ships at all (movement.ts's `endMovement` calls this directly in
 * that case, skipping the rest of space combat).
 */
export function spaceCannonOffense(state: GameState, systemId: string, attacker: Owner, seed: number): GameState {
  const shooters: Owner[] = []
  for (const p of state.systems[systemId].planets) for (const u of p.structures) {
    if (u.owner !== attacker && !shooters.includes(u.owner)) shooters.push(u.owner)
  }
  let next = state
  let salt = SPACE_CANNON_SALT_BASE
  for (const owner of shooters) {
    const sOwner = statsOwner(next, owner)
    const pds = next.systems[systemId].planets.flatMap(p => p.structures.filter(u => u.owner === owner && unitStats(u.type, sOwner).spaceCannon))
    if (!pds.length) continue
    const rng = mulberry32(deriveSeed(seed, salt++))
    const rolls: DieRoll[] = []
    let extraDie = hasTech(next, owner, 'plasma_scoring')
    let hits = 0
    for (const u of pds) {
      const sc = unitStats(u.type, sOwner).spaceCannon
      if (!sc) continue
      const roll = rollHits(rng, sc.dice, sc.value, extraDie)
      extraDie = false
      rolls.push(...dieRolls(owner, u.type, roll.rolls, sc.value))
      hits += roll.hits
    }
    next = { ...next, log: [...next.log, { t: 'roll', owner, rolls, context: 'space cannon offense' }] }
    const mode: HitMode = hasTech(next, owner, 'graviton_laser_system') ? 'noFighters' : 'any'
    next = applyCombatHits(next, systemId, attacker, [{ count: hits, mode }])
  }
  return next
}

/** R4.1 step 6: with 3 or more non-fighter ships the opponent loses one non-fighter ship. */
function assaultCannon(state: GameState, ctx: Ctx): GameState {
  let next = state
  for (const [side, foe] of [[ctx.attacker, ctx.defender], [ctx.defender, ctx.attacker]] as [Owner, Owner][]) {
    if (!hasTech(next, side, 'assault_cannon')) continue
    const sys = next.systems[ctx.systemId]
    if (shipsOf(sys, side).filter(u => NON_FIGHTER_SHIPS.includes(u.type)).length < 3) continue
    const victim = NON_FIGHTER_ORDER.flatMap(t => shipsOf(sys, foe).filter(u => u.type === t))[0]
    if (!victim) continue
    next = destroyUnits(next, ctx.systemId, [victim])
    next = { ...next, log: [...next.log, { t: 'info', text: `Assault Cannon destroys a ${victim.type}` }] }
  }
  return next
}

/** R4.1 step 2: destroyer barrage, hits destroy enemy fighters only. */
function antiFighterBarrage(state: GameState, ctx: Ctx, seed: number): GameState {
  let next = state
  let salt = AFB_SALT_BASE
  for (const [side, foe] of [[ctx.attacker, ctx.defender], [ctx.defender, ctx.attacker]] as [Owner, Owner][]) {
    const sOwner = statsOwner(next, side)
    const rng = mulberry32(deriveSeed(seed, salt++))
    const rolls: DieRoll[] = []
    let hits = 0
    for (const u of shipsOf(next.systems[ctx.systemId], side)) {
      const afb = unitStats(u.type, sOwner).afb
      if (!afb) continue
      const roll = rollHits(rng, afb.dice, afb.value, false)
      rolls.push(...dieRolls(side, u.type, roll.rolls, afb.value))
      hits += roll.hits
    }
    if (!rolls.length) continue
    next = { ...next, log: [...next.log, { t: 'roll', owner: side, rolls, context: 'anti-fighter barrage' }] }
    next = destroyUnits(next, ctx.systemId, shipsOf(next.systems[ctx.systemId], foe).filter(u => u.type === 'fighter').slice(0, hits))
  }
  return next
}

/**
 * R7 Mandate First Strike: whoever wins a space combat in Mecatol Rex or in the other seat's home system earns
 * the mandate for the round, attacker or defender alike. Guardians never earn it.
 */
function markMandate(state: GameState, ctx: Ctx, winner: Seat): GameState {
  if (ctx.systemId !== MECATOL_ID && systemDef(ctx.systemId).home !== otherSeat(winner)) return state
  const players = [...state.players] as GameState['players']
  players[winner] = { ...players[winner], mandateEarnedThisRound: true }
  return { ...state, players, log: [...state.log, { t: 'info', text: `Mandate First Strike earned by seat ${winner}` }] }
}

/** The winner's log line plus the mandate; a guardian victory earns and logs neither. */
function wonBy(state: GameState, ctx: Ctx, winner: Owner): GameState {
  if (winner === 'guardian') return state
  const marked = markMandate(state, ctx, winner)
  return { ...marked, log: [...marked.log, { t: 'info', text: `space combat in ${ctx.systemId} won by seat ${winner}` }] }
}

/** Cargo above the remaining capacity is destroyed when the combat is over. */
function endCombat(state: GameState, ctx: Ctx): GameState {
  return trimCargo(trimCargo(state, ctx.systemId, ctx.attacker), ctx.systemId, ctx.defender)
}

/** R4.1 step 5: the announced retreat happens after the round has been fought. */
function withdraw(state: GameState, ctx: Ctx, to: string): GameState {
  const tac = state.tactical
  if (!tac || !tac.combat) return state
  const sys = state.systems[ctx.systemId]
  const dest = state.systems[to]
  const leaving = sys.space.filter(u => u.owner === ctx.attacker)
  const next: GameState = {
    ...state,
    systems: {
      ...state.systems,
      [ctx.systemId]: { ...sys, space: sys.space.filter(u => u.owner !== ctx.attacker) },
      [to]: { ...dest, space: [...dest.space, ...leaving] },
    },
    tactical: { ...tac, step: 'done' },
    log: [...state.log, { t: 'info', text: `seat ${ctx.attacker} retreats from ${ctx.systemId} to ${to}` }],
  }
  return trimCargo(trimCargo(next, to, ctx.attacker), ctx.systemId, ctx.defender)
}

function finish(state: GameState, ctx: Ctx, rolls: DieRoll[]): GameState {
  const tac = state.tactical
  if (!tac || !tac.combat) return state
  const sys = state.systems[ctx.systemId]
  const attackerShips = shipsOf(sys, ctx.attacker).length
  const defenderShips = shipsOf(sys, ctx.defender).length
  const combat = { ...tac.combat, round: ctx.round + 1, lastRolls: rolls }
  if (!attackerShips) {
    // the defender holding the field wins the combat and earns the same mandate the attacker would have
    const done = defenderShips ? wonBy(state, ctx, ctx.defender) : state
    return endCombat({ ...done, tactical: { ...tac, step: 'done', combat } }, ctx)
  }
  if (!defenderShips) {
    const won = wonBy(state, ctx, ctx.attacker)
    return endCombat({ ...won, tactical: { ...tac, step: 'invasion', combat, invasion: { planetId: null, landed: [], bombarded: [], round: 0 } } }, ctx)
  }
  if (combat.retreating === ctx.attacker && combat.retreatTo) return withdraw({ ...state, tactical: { ...tac, combat } }, ctx, combat.retreatTo)
  return { ...state, tactical: { ...tac, combat } }
}

export interface MunitionsRequest { attacker?: boolean; defender?: boolean }

function bothAlive(state: GameState, ctx: Ctx): boolean {
  const sys = state.systems[ctx.systemId]
  return shipsOf(sys, ctx.attacker).length > 0 && shipsOf(sys, ctx.defender).length > 0
}

export function combatRound(state: GameState, munitions: MunitionsRequest | undefined, seed: number): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'spaceCombat' || !tac.combat) return { ok: false, error: 'not in a space combat' }
  const ctx: Ctx = { systemId: tac.systemId, attacker: tac.combat.attacker, defender: tac.combat.defender, round: tac.combat.round }
  const sys = state.systems[ctx.systemId]
  if (!shipsOf(sys, ctx.attacker).length || !shipsOf(sys, ctx.defender).length) return { ok: false, error: 'the space combat is already decided' }
  const wantAttacker = munitions?.attacker ?? false
  const wantDefender = munitions?.defender ?? false
  if (ctx.round === 0) {
    // R4.1 step 6: Munitions Reserves rerolls a combat round's dice, so it cannot be requested before round 1.
    if (wantAttacker || wantDefender) return { ok: false, error: 'Munitions Reserves cannot be used before combat rounds begin' }
    let next = spaceCannonOffense(state, ctx.systemId, ctx.attacker, seed)
    if (bothAlive(next, ctx)) next = assaultCannon(next, ctx)
    if (bothAlive(next, ctx)) next = antiFighterBarrage(next, ctx, seed)
    return { ok: true, value: finish(next, ctx, []) }
  }
  if (wantAttacker && !canMunitions(state, ctx.attacker)) return { ok: false, error: 'Munitions Reserves is not available to the attacker' }
  if (wantDefender && !canMunitions(state, ctx.defender)) return { ok: false, error: 'Munitions Reserves is not available to the defender' }
  const salt = ctx.round * 4
  const a = combatRolls(state, ctx, ctx.attacker, 0, wantAttacker, seed, salt + 10)
  const d = combatRolls(state, ctx, ctx.defender, defenderModifier(ctx.systemId), wantDefender, seed, salt + 11)
  let next = state
  if (wantAttacker) next = payMunitions(next, ctx.attacker)
  if (wantDefender) next = payMunitions(next, ctx.defender)
  next = {
    ...next,
    log: [
      ...next.log,
      { t: 'roll', owner: ctx.attacker, rolls: a.rolls, context: `space combat round ${ctx.round}` },
      ...(a.rerollRolls.length ? [{ t: 'roll' as const, owner: ctx.attacker, rolls: a.rerollRolls, context: `space combat round ${ctx.round} reroll` }] : []),
      { t: 'roll', owner: ctx.defender, rolls: d.rolls, context: `space combat round ${ctx.round}` },
      ...(d.rerollRolls.length ? [{ t: 'roll' as const, owner: ctx.defender, rolls: d.rerollRolls, context: `space combat round ${ctx.round} reroll` }] : []),
    ],
  }
  const attackerDamagedBefore = new Set(shipsOf(next.systems[ctx.systemId], ctx.attacker).filter(u => u.damaged).map(u => u.id))
  const defenderDamagedBefore = new Set(shipsOf(next.systems[ctx.systemId], ctx.defender).filter(u => u.damaged).map(u => u.id))
  next = applyCombatHits(next, ctx.systemId, ctx.defender, [{ count: a.hits - a.restricted, mode: 'any' }, { count: a.restricted, mode: 'preferNonFighters' }])
  const defenderSustainedIds = shipsOf(next.systems[ctx.systemId], ctx.defender).filter(u => u.damaged && !defenderDamagedBefore.has(u.id)).map(u => u.id)
  next = applyCombatHits(next, ctx.systemId, ctx.attacker, [{ count: d.hits - d.restricted, mode: 'any' }, { count: d.restricted, mode: 'preferNonFighters' }])
  const attackerSustainedIds = shipsOf(next.systems[ctx.systemId], ctx.attacker).filter(u => u.damaged && !attackerDamagedBefore.has(u.id)).map(u => u.id)
  // R4.1 step 4: Duranium Armor repairs once per side after the round, excluding units that just sustained a hit.
  next = repairAfterRound(next, ctx.systemId, ctx.defender, defenderSustainedIds)
  next = repairAfterRound(next, ctx.systemId, ctx.attacker, attackerSustainedIds)
  return { ok: true, value: finish(next, ctx, [...a.rolls, ...a.rerollRolls, ...d.rolls, ...d.rerollRolls]) }
}

/** R4.1 step 5: adjacent systems that hold the retreating player's units or command token and no enemy ships. */
export function retreatTargets(state: GameState, seat: Seat): string[] {
  const tac = state.tactical
  if (!tac) return []
  return neighbours(tac.systemId).filter(id => {
    const sys = state.systems[id]
    if (sys.space.some(u => u.owner !== seat && isShip(u.type))) return false
    return sys.activatedBy.includes(seat)
      || sys.space.some(u => u.owner === seat)
      || sys.planets.some(p => p.ground.some(u => u.owner === seat) || p.structures.some(u => u.owner === seat))
  })
}

/** R4.1 step 5: announcement only; the next `combatRound` fights the round and then carries it out. */
export function retreat(state: GameState, to: string): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'spaceCombat' || !tac.combat) return { ok: false, error: 'not in a space combat' }
  const seat = state.active
  if (seat !== tac.combat.attacker) return { ok: false, error: 'R4.1: only the attacker may retreat' }
  if (tac.combat.round < 2) return { ok: false, error: 'R4.1: a retreat can only be announced before a round after the first' }
  if (tac.combat.retreating !== null) return { ok: false, error: 'a retreat is already announced' }
  if (!retreatTargets(state, seat).includes(to)) return { ok: false, error: `cannot retreat to ${to}` }
  return {
    ok: true,
    value: {
      ...state,
      tactical: { ...tac, combat: { ...tac.combat, retreating: seat, retreatTo: to } },
      log: [...state.log, { t: 'info', text: `seat ${seat} announces a retreat to ${to}` }],
    },
  }
}
