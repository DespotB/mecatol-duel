import { isShip, unitStats } from '../data/units'
import { destroyUnits, dieRolls, hasTech, removeUnits, rollHits, statsOwner } from './board'
import { deriveSeed, mulberry32 } from './rng'
import type { DieRoll, GameState, Owner, Planet, Result, Seat, Unit } from './types'

function planetOf(state: GameState, systemId: string, planetId: string): Planet | undefined {
  return state.systems[systemId].planets.find(p => p.id === planetId)
}

/** R4.3 step 1: an enemy planetary shield blocks bombardment unless Arc Secundus is in the system. */
function shieldBlocks(state: GameState, systemId: string, planetId: string, seat: Seat): boolean {
  const planet = planetOf(state, systemId, planetId)
  if (!planet) return true
  const shielded = planet.structures.some(u => u.owner !== seat && unitStats(u.type, statsOwner(state, u.owner)).planetaryShield)
  if (!shielded) return false
  const arcSecundus = state.players[seat].faction === 'letnev'
    && state.systems[systemId].space.some(u => u.owner === seat && u.type === 'flagship')
  return !arcSecundus
}

function bombardment(state: GameState, systemId: string, planetId: string, seat: Seat, seed: number, salt: number, context: string): GameState {
  const sOwner = statsOwner(state, seat)
  const ships = state.systems[systemId].space.filter(u => u.owner === seat && isShip(u.type) && unitStats(u.type, sOwner).bombardment)
  if (!ships.length) return state
  const rng = mulberry32(deriveSeed(seed, salt))
  const rolls: DieRoll[] = []
  let extraDie = state.players[seat].techs.includes('plasma_scoring')
  let hits = 0
  for (const u of ships) {
    const b = unitStats(u.type, sOwner).bombardment
    if (!b) continue
    const roll = rollHits(rng, b.dice, b.value, extraDie)
    extraDie = false
    rolls.push(...dieRolls(seat, u.type, roll.rolls, b.value))
    hits += roll.hits
  }
  const logged: GameState = { ...state, log: [...state.log, { t: 'roll', owner: seat, rolls, context }] }
  const planet = planetOf(logged, systemId, planetId)
  if (!planet) return logged
  return destroyUnits(logged, systemId, planet.ground.filter(u => u.owner !== seat).slice(0, hits))
}

export function bombardablePlanets(state: GameState): string[] {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion) return []
  const seat = state.active
  const sOwner = statsOwner(state, seat)
  const canBombard = state.systems[tac.systemId].space.some(u => u.owner === seat && isShip(u.type) && unitStats(u.type, sOwner).bombardment)
  if (!canBombard) return []
  return state.systems[tac.systemId].planets
    .filter(p => !tac.invasion?.bombarded.includes(p.id)
      && p.ground.some(u => u.owner !== seat)
      && !shieldBlocks(state, tac.systemId, p.id, seat))
    .map(p => p.id)
}

export function groundCombatPending(state: GameState): boolean {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion || !tac.invasion.planetId) return false
  const planet = planetOf(state, tac.systemId, tac.invasion.planetId)
  if (!planet) return false
  const seat = state.active
  return planet.ground.some(u => u.owner === seat) && planet.ground.some(u => u.owner !== seat)
}

export function landablePlanets(state: GameState): { planetId: string; infantryIds: number[] }[] {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion) return []
  const seat = state.active
  const infantryIds = state.systems[tac.systemId].space.filter(u => u.owner === seat && u.type === 'infantry').map(u => u.id)
  if (!infantryIds.length) return []
  const busy = groundCombatPending(state) ? tac.invasion.planetId : null
  return state.systems[tac.systemId].planets
    .filter(p => !busy || p.id === busy)
    .map(p => ({ planetId: p.id, infantryIds }))
}

/** R4.3 step 5: the attacker takes the planet when no defender is left. */
function resolveControl(state: GameState, systemId: string, planetId: string, seat: Seat): GameState {
  const planet = planetOf(state, systemId, planetId)
  if (!planet || planet.owner === seat) return state
  if (!planet.ground.some(u => u.owner === seat) || planet.ground.some(u => u.owner !== seat)) return state
  const assimilate = state.players[seat].faction === 'l1z1x'
  const players = [...state.players] as GameState['players']
  const replacements: Unit[] = []
  let nextId = state.nextUnitId
  for (const s of planet.structures) {
    if (s.owner !== 'guardian') {
      const loser = players[s.owner]
      players[s.owner] = { ...loser, reinforcements: { ...loser.reinforcements, [s.type]: loser.reinforcements[s.type] + 1 } }
    }
    if (!assimilate) continue
    const me = players[seat]
    if (me.reinforcements[s.type] < 1) continue
    players[seat] = { ...me, reinforcements: { ...me.reinforcements, [s.type]: me.reinforcements[s.type] - 1 } }
    replacements.push({ id: nextId++, type: s.type, owner: seat, damaged: false })
  }
  const sys = state.systems[systemId]
  return {
    ...state, players, nextUnitId: nextId,
    systems: {
      ...state.systems,
      [systemId]: { ...sys, planets: sys.planets.map(p => p.id === planetId ? { ...p, owner: seat, exhausted: true, structures: replacements } : p) },
    },
    log: [...state.log, { t: 'info', text: `seat ${seat} takes control of ${planetId}` }],
  }
}

export function bombard(state: GameState, planetId: string, seed: number): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion) return { ok: false, error: 'not in the invasion step' }
  const seat = state.active
  const planet = planetOf(state, tac.systemId, planetId)
  if (!planet) return { ok: false, error: `planet ${planetId} is not in the active system` }
  if (tac.invasion.bombarded.includes(planetId)) return { ok: false, error: `${planetId} was already bombarded` }
  if (!planet.ground.some(u => u.owner !== seat)) return { ok: false, error: 'no ground forces to bombard' }
  if (shieldBlocks(state, tac.systemId, planetId, seat)) return { ok: false, error: 'R4.3: the planetary shield blocks the bombardment' }
  const sOwner = statsOwner(state, seat)
  if (!state.systems[tac.systemId].space.some(u => u.owner === seat && isShip(u.type) && unitStats(u.type, sOwner).bombardment)) {
    return { ok: false, error: 'no unit with BOMBARDMENT in the system' }
  }
  const next = bombardment(state, tac.systemId, planetId, seat, seed, 1, `bombardment of ${planetId}`)
  return { ok: true, value: { ...next, tactical: { ...tac, invasion: { ...tac.invasion, bombarded: [...tac.invasion.bombarded, planetId] } } } }
}

export function land(state: GameState, planetId: string, infantryIds: number[], seed: number): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion) return { ok: false, error: 'not in the invasion step' }
  const seat = state.active
  const sys = state.systems[tac.systemId]
  const planet = planetOf(state, tac.systemId, planetId)
  if (!planet) return { ok: false, error: `planet ${planetId} is not in the active system` }
  if (!infantryIds.length) return { ok: false, error: 'no infantry to land' }
  if (groundCombatPending(state) && tac.invasion.planetId !== planetId) return { ok: false, error: 'finish the running ground combat first' }
  const landing: Unit[] = []
  for (const id of infantryIds) {
    const u = sys.space.find(x => x.id === id && x.owner === seat && x.type === 'infantry')
    if (!u || landing.some(l => l.id === id)) return { ok: false, error: `no carried infantry ${id} in the active system` }
    landing.push(u)
  }
  let next = state
  let survivors = landing
  const pds = planet.structures.filter(u => u.owner !== seat && unitStats(u.type, statsOwner(state, u.owner)).spaceCannon)
  if (pds.length && !hasTech(state, seat, 'l4_disruptors')) {
    const defender: Owner = pds[0].owner
    const sOwner = statsOwner(state, defender)
    const rng = mulberry32(deriveSeed(seed, 2))
    const rolls: DieRoll[] = []
    let extraDie = hasTech(state, defender, 'plasma_scoring')
    let hits = 0
    for (const u of pds) {
      const sc = unitStats(u.type, sOwner).spaceCannon
      if (!sc) continue
      const roll = rollHits(rng, sc.dice, sc.value, extraDie)
      extraDie = false
      rolls.push(...dieRolls(defender, u.type, roll.rolls, sc.value))
      hits += roll.hits
    }
    next = { ...next, log: [...next.log, { t: 'roll', owner: defender, rolls, context: `space cannon defense on ${planetId}` }] }
    next = destroyUnits(next, tac.systemId, survivors.slice(0, hits))
    survivors = survivors.slice(hits)
  }
  next = removeUnits(next, tac.systemId, survivors.map(u => u.id))
  const target = next.systems[tac.systemId]
  next = {
    ...next,
    systems: {
      ...next.systems,
      [tac.systemId]: { ...target, planets: target.planets.map(p => p.id === planetId ? { ...p, ground: [...p.ground, ...survivors] } : p) },
    },
    tactical: { ...tac, invasion: { planetId, landed: [...tac.invasion.landed, ...survivors.map(u => u.id)], bombarded: tac.invasion.bombarded } },
  }
  return { ok: true, value: resolveControl(next, tac.systemId, planetId, seat) }
}

function groundRolls(state: GameState, units: Unit[], owner: Owner, seed: number, salt: number): { rolls: DieRoll[]; hits: number } {
  const sOwner = statsOwner(state, owner)
  const rng = mulberry32(deriveSeed(seed, salt))
  const rolls: DieRoll[] = []
  let hits = 0
  for (const u of units) {
    const stats = unitStats(u.type, sOwner)
    if (stats.combat === null) continue
    const roll = rollHits(rng, stats.combatDice, stats.combat, false)
    rolls.push(...dieRolls(owner, u.type, roll.rolls, stats.combat))
    hits += roll.hits
  }
  return { rolls, hits }
}

export function groundCombatRound(state: GameState, seed: number): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion || !tac.invasion.planetId) return { ok: false, error: 'no ground combat is running' }
  const seat = state.active
  const planetId = tac.invasion.planetId
  const planet = planetOf(state, tac.systemId, planetId)
  if (!planet) return { ok: false, error: `planet ${planetId} is not in the active system` }
  const mine = planet.ground.filter(u => u.owner === seat)
  const foes = planet.ground.filter(u => u.owner !== seat)
  if (!mine.length || !foes.length) return { ok: false, error: 'the ground combat is already decided' }
  const defender = foes[0].owner
  const a = groundRolls(state, mine, seat, seed, 3)
  const d = groundRolls(state, foes, defender, seed, 4)
  let next: GameState = { ...state, log: [...state.log,
    { t: 'roll', owner: seat, rolls: a.rolls, context: `ground combat on ${planetId}` },
    { t: 'roll', owner: defender, rolls: d.rolls, context: `ground combat on ${planetId}` }] }
  next = destroyUnits(next, tac.systemId, foes.slice(0, a.hits))
  next = destroyUnits(next, tac.systemId, mine.slice(0, d.hits))
  const after = planetOf(next, tac.systemId, planetId)
  // HARROW: L1Z1X may bombard after every ground combat round; v1 does it automatically
  if (state.players[seat].faction === 'l1z1x' && after && after.ground.some(u => u.owner !== seat) && !shieldBlocks(next, tac.systemId, planetId, seat)) {
    next = bombardment(next, tac.systemId, planetId, seat, seed, 5, `Harrow bombardment of ${planetId}`)
  }
  return { ok: true, value: resolveControl(next, tac.systemId, planetId, seat) }
}

export function endInvasion(state: GameState): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion') return { ok: false, error: 'not in the invasion step' }
  if (groundCombatPending(state)) return { ok: false, error: 'the ground combat is unresolved' }
  const seat = state.active
  const dock = state.systems[tac.systemId].planets.some(p => p.structures.some(u => u.type === 'spacedock' && u.owner === seat))
  return { ok: true, value: { ...state, tactical: { ...tac, step: dock ? 'production' : 'done' } } }
}
