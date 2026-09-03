// src/engine/combat.test.ts
import { describe, expect, it } from 'vitest'
import { unitStats } from '../data/units'
import { rollHits } from './board'
import { applyCombatHits, assignHits, defenderModifier, type HitGroup } from './combat'
import { applyMove } from './index'
import { mulberry32 } from './rng'
import { deepFreeze, hitsIn, toActionPhase, withPlanetOwner, withPlayer, withTechs, withUnits } from './testUtils'
import type { GameState, Owner, Unit, UnitType } from './types'

const letnev = { faction: 'letnev' as const, techs: [] as string[] }

/** Clears the system, puts both fleets in and opens the space combat at the given round. */
function combat(systemId: string, attacker: UnitType[], defenderUnits: UnitType[], round: number, defender: Owner = 1, seed = 1): GameState {
  const base = toActionPhase(seed)
  const cleared: GameState = { ...base, systems: { ...base.systems, [systemId]: { ...base.systems[systemId], space: [] } } }
  const s = withUnits(withUnits(cleared, systemId, 0, attacker), systemId, defender, defenderUnits)
  return deepFreeze({
    ...s,
    tactical: { systemId, step: 'spaceCombat', combat: { round, attacker: 0, defender, retreating: null, retreatTo: null, lastRolls: [] } },
  })
}

const fight = (state: GameState, seed = 7, munitions?: boolean) => {
  const r = applyMove(deepFreeze(state), { type: 'combatRound', ...(munitions === undefined ? {} : { munitions }) }, seed)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

const fightToEnd = (state: GameState, seed: number) => {
  let s = state
  for (let i = 0; i < 40 && s.tactical?.step === 'spaceCombat'; i++) s = fight(s, seed + i)
  return s
}

const owned = (state: GameState, systemId: string, owner: Owner) => state.systems[systemId].space.filter(u => u.owner === owner)
const units = (spec: [UnitType, boolean][]): Unit[] => spec.map(([type, damaged], i) => ({ id: i + 1, type, owner: 0, damaged }))

describe('R4.1 dice', () => {
  it('R4.1 step 3: the nebula defender bonus lowers the threshold by one on the same dice', () => {
    expect(defenderModifier('quann')).toBe(1)
    expect(defenderModifier('bereg')).toBe(0)
    const plain = rollHits(mulberry32(5), 6, 7, false)
    const inNebula = rollHits(mulberry32(5), 6, 6, false)
    expect(inNebula.rolls).toEqual(plain.rolls)
    expect(inNebula.hits).toBe(plain.rolls.filter(v => v >= 6).length)
    expect(rollHits(mulberry32(5), 6, 7, true).rolls).toHaveLength(7)   // Plasma Scoring adds one die
  })
})

describe('R4.1 step 4 hit assignment', () => {
  it('sustain damage cancels first, then the destruction order applies', () => {
    const one = assignHits(units([['dreadnought', false], ['fighter', false], ['cruiser', false]]), [{ count: 1, mode: 'any' }], letnev, false)
    expect(one.destroyed).toHaveLength(0)
    expect(one.units.find(u => u.type === 'dreadnought')?.damaged).toBe(true)
    const three = assignHits(units([['dreadnought', true], ['fighter', false], ['cruiser', false], ['carrier', false]]), [{ count: 3, mode: 'any' }], letnev, false)
    expect(three.destroyed.map(u => u.type)).toEqual(['fighter', 'cruiser', 'carrier'])
  })
  it('Non-Euclidean Shielding cancels 2 hits with one sustain', () => {
    const plain = assignHits(units([['dreadnought', false], ['fighter', false]]), [{ count: 2, mode: 'any' }], letnev, false)
    expect(plain.destroyed.map(u => u.type)).toEqual(['fighter'])
    const nes = assignHits(units([['dreadnought', false], ['fighter', false]]), [{ count: 2, mode: 'any' }], letnev, true)
    expect(nes.destroyed).toHaveLength(0)
    expect(nes.units.find(u => u.type === 'dreadnought')?.damaged).toBe(true)
  })
  it('preferNonFighters hits ([0.0.1] and L1Z1X dreadnoughts) skip fighters while non-fighters remain', () => {
    const mixed = assignHits(units([['fighter', false], ['cruiser', false]]), [{ count: 1, mode: 'preferNonFighters' }], letnev, false)
    expect(mixed.destroyed.map(u => u.type)).toEqual(['cruiser'])
    const only = assignHits(units([['fighter', false], ['fighter', false]]), [{ count: 1, mode: 'preferNonFighters' }], letnev, false)
    expect(only.destroyed.map(u => u.type)).toEqual(['fighter'])
    expect(only.lost).toBe(0)
  })
  it('R4.1 step 6: noFighters hits (Graviton Laser System) that cannot be assigned are lost', () => {
    const mixed = assignHits(units([['fighter', false], ['cruiser', false]]), [{ count: 2, mode: 'noFighters' }], letnev, false)
    expect(mixed.destroyed.map(u => u.type)).toEqual(['cruiser'])
    expect(mixed.lost).toBe(1)
    const fighters = assignHits(units([['fighter', false], ['fighter', false]]), [{ count: 2, mode: 'noFighters' }], letnev, false)
    expect(fighters.destroyed).toHaveLength(0)
    expect(fighters.units).toHaveLength(2)
    expect(fighters.lost).toBe(2)
  })
  it('Duranium Armor repairs one unit that did not sustain this round', () => {
    const base = combat('bereg', ['cruiser'], ['dreadnought', 'dreadnought'], 1)
    const ids = owned(base, 'bereg', 1).map(u => u.id)
    const damaged: GameState = {
      ...base,
      systems: { ...base.systems, bereg: { ...base.systems.bereg, space: base.systems.bereg.space.map(u => u.id === ids[1] ? { ...u, damaged: true } : u) } },
    }
    const hit: HitGroup[] = [{ count: 1, mode: 'any' }]
    const without = applyCombatHits(deepFreeze(damaged), 'bereg', 1, hit)
    expect(without.systems.bereg.space.filter(u => u.owner === 1 && u.damaged)).toHaveLength(2)
    const repaired = applyCombatHits(withTechs(damaged, 1, ['duranium_armor']), 'bereg', 1, hit)
    expect(repaired.systems.bereg.space.filter(u => u.owner === 1 && u.damaged)).toHaveLength(1)
    expect(repaired.systems.bereg.space.filter(u => u.owner === 1)).toHaveLength(2)
  })
  it('destroyed units go back to the reinforcements', () => {
    const s = combat('bereg', ['cruiser'], ['cruiser'], 1)
    const after = applyCombatHits(s, 'bereg', 1, [{ count: 1, mode: 'any' }])
    expect(owned(after, 'bereg', 1)).toHaveLength(0)
    expect(after.players[1].reinforcements.cruiser).toBe(s.players[1].reinforcements.cruiser + 1)
  })
})

describe('R4.1 space combat', () => {
  it('R4.1 step 1: every PDS that is not the active player fires, guardian defender included', () => {
    const base = combat('mecatol', ['fighter', 'fighter', 'fighter'], ['cruiser'], 0, 'guardian')
    const s = withUnits(withPlanetOwner(base, 'mecatol', 'mecatol-rex', 1), 'mecatol', 1, ['pds'], 'mecatol-rex')
    const after = fight(s)
    const entries = after.log.filter(e => e.t === 'roll' && e.context === 'space cannon offense')
    expect(entries).toHaveLength(1)
    expect(entries[0].t === 'roll' && entries[0].owner).toBe(1)
    expect(owned(after, 'mecatol', 0)).toHaveLength(3 - hitsIn(after, 'space cannon offense'))
    expect(after.tactical?.combat?.round).toBe(1)
  })
  it('R4.1 step 1: Graviton Laser System hits are lost against a fighter-only fleet', () => {
    const base = combat('bereg', ['fighter', 'fighter'], ['cruiser'], 0)
    const s = withTechs(withUnits(base, 'bereg', 1, ['pds'], 'bereg'), 1, ['graviton_laser_system'])
    const after = fight(s)
    expect(after.log.some(e => e.t === 'roll' && e.context === 'space cannon offense')).toBe(true)
    expect(owned(after, 'bereg', 0).filter(u => u.type === 'fighter')).toHaveLength(2)
  })
  it('R4.1 step 2: anti-fighter barrage only destroys fighters', () => {
    const s = combat('bereg', ['fighter', 'fighter', 'cruiser'], ['destroyer'], 0)
    const after = fight(s)
    const hits = hitsIn(after, 'anti-fighter barrage')
    expect(owned(after, 'bereg', 0).filter(u => u.type === 'fighter')).toHaveLength(Math.max(0, 2 - hits))
    expect(owned(after, 'bereg', 0).some(u => u.type === 'cruiser')).toBe(true)
  })
  it('R4.1 step 6: the pre-combat steps run as space cannon offense, Assault Cannon, anti-fighter barrage', () => {
    const base = combat('bereg', ['cruiser', 'cruiser', 'cruiser', 'cruiser', 'cruiser'], ['destroyer', 'destroyer'], 0)
    const s = withTechs(withUnits(base, 'bereg', 1, ['pds'], 'bereg'), 0, ['assault_cannon'])
    const after = fight(s)
    const order = after.log.flatMap(e =>
      e.t === 'roll' && e.context === 'space cannon offense' ? ['cannon']
        : e.t === 'info' && e.text.startsWith('Assault Cannon') ? ['assault']
          : e.t === 'roll' && e.context === 'anti-fighter barrage' ? ['barrage'] : [])
    expect(order).toEqual(['cannon', 'assault', 'barrage'])
    expect(owned(after, 'bereg', 1).filter(u => u.type === 'destroyer')).toHaveLength(1)
  })
  it('R4.1 step 6: Assault Cannon destroys one non-fighter ship of the opponent', () => {
    const s = withTechs(combat('bereg', ['cruiser', 'cruiser', 'cruiser'], ['dreadnought', 'fighter'], 0), 0, ['assault_cannon'])
    const after = fight(s)
    expect(owned(after, 'bereg', 1).map(u => u.type)).toEqual(['fighter'])
    expect(after.players[1].reinforcements.dreadnought).toBe(s.players[1].reinforcements.dreadnought + 1)
  })
  it('R4.1 step 3: a combat round rolls every ship, logs both sides and is deterministic for a seed', () => {
    const s = combat('bereg', ['cruiser', 'cruiser'], ['carrier'], 1)
    const after = fight(s)
    expect(after.log.filter(e => e.t === 'roll' && e.context === 'space combat round 1')).toHaveLength(2)
    expect(after.tactical?.combat?.round).toBe(2)
    expect(after.tactical?.combat?.lastRolls.length).toBe(3)
    expect(JSON.stringify(fight(s).systems.bereg.space)).toBe(JSON.stringify(after.systems.bereg.space))
  })
  it('R4.1 step 3: in a nebula the defender hits one lower', () => {
    const inNebula = fight(combat('quann', ['cruiser'], ['cruiser'], 1))
    const defence = inNebula.log.flatMap(e => e.t === 'roll' && e.owner === 1 ? e.rolls : [])
    expect(defence).toHaveLength(1)
    for (const r of defence) expect(r.hit).toBe(r.value >= 6)   // cruiser combat 7, nebula +1
    const plain = fight(combat('bereg', ['cruiser'], ['cruiser'], 1))
    for (const r of plain.log.flatMap(e => e.t === 'roll' && e.owner === 1 ? e.rolls : [])) expect(r.hit).toBe(r.value >= 7)
  })
  it('R4.1 step 3: Munitions Reserves costs Letnev 2 trade goods', () => {
    const base = combat('bereg', ['cruiser'], ['cruiser'], 1)
    const after = fight(withPlayer(base, 1, { tradeGoods: 3 }), 7, true)
    expect(after.players[1].tradeGoods).toBe(1)
    expect(applyMove(base, { type: 'combatRound', munitions: true }, 7).ok).toBe(false)
  })
  it('R4.1 step 6: the combat ends when one side has no ships and the winner goes on', () => {
    const after = fightToEnd(combat('bereg', ['dreadnought', 'dreadnought', 'cruiser'], ['fighter'], 1), 100)
    const attackerLeft = owned(after, 'bereg', 0).length > 0
    expect(after.tactical?.step).toBe(attackerLeft ? 'invasion' : 'done')
    expect(owned(after, 'bereg', 1)).toHaveLength(attackerLeft ? 0 : 1)
  })
  it('R7 Mandate: winning a space combat in Mecatol Rex marks the mandate for the round', () => {
    const after = fightToEnd(combat('mecatol', ['dreadnought', 'dreadnought', 'cruiser'], ['fighter'], 1, 'guardian'), 200)
    expect(after.players[0].mandateEarnedThisRound).toBe(owned(after, 'mecatol', 0).length > 0)
  })
  it('R4.1 step 5: the retreat is announced before a round and carried out after it', () => {
    expect(applyMove(combat('bereg', ['dreadnought'], ['dreadnought'], 1), { type: 'retreat', to: 'home-n' }, 0).ok).toBe(false)
    const later = combat('bereg', ['dreadnought'], ['dreadnought'], 2)
    expect(applyMove(later, { type: 'retreat', to: 'quann' }, 0).ok).toBe(false)                             // no units and no token there
    expect(applyMove(withPlanetOwner(later, 'quann', 'quann', 0), { type: 'retreat', to: 'quann' }, 0).ok).toBe(false)   // a controlled planet is not enough
    const announced = applyMove(later, { type: 'retreat', to: 'home-n' }, 0)
    if (!announced.ok) throw new Error(announced.error)
    expect(announced.value.tactical?.combat).toMatchObject({ retreating: 0, retreatTo: 'home-n' })
    expect(announced.value.tactical?.step).toBe('spaceCombat')
    expect(owned(announced.value, 'bereg', 0)).toHaveLength(1)                                              // nothing has moved yet
    expect(applyMove(announced.value, { type: 'retreat', to: 'home-n' }, 0).ok).toBe(false)                  // one announcement per combat
    // one dreadnought per side rolls at most one hit, which the other side sustains, so both survive the round
    const after = fight(announced.value, 3)
    expect(owned(after, 'bereg', 0)).toHaveLength(0)
    expect(owned(after, 'home-n', 0).filter(u => u.type === 'dreadnought')).toHaveLength(2)
    expect(after.tactical?.step).toBe('done')
    expect(after.log.some(e => e.t === 'info' && e.text.includes('retreats'))).toBe(true)
  })
  it('R4.1 step 5: an announced retreat is dropped when the combat ends in that round', () => {
    const announced = applyMove(combat('bereg', ['dreadnought', 'dreadnought', 'cruiser'], ['fighter'], 2), { type: 'retreat', to: 'home-n' }, 0)
    if (!announced.ok) throw new Error(announced.error)
    const after = fightToEnd(announced.value, 400)
    const attackerLeft = owned(after, 'bereg', 0).length > 0
    const defenderLeft = owned(after, 'bereg', 1).length > 0
    expect(after.tactical?.step).toBe(attackerLeft && !defenderLeft ? 'invasion' : 'done')
  })
  it('R4.1 step 6: carried infantry are trimmed when the combat ends, not after a single round', () => {
    const base = withUnits(combat('bereg', ['carrier'], ['cruiser', 'cruiser', 'cruiser'], 1), 'bereg', 0, ['infantry', 'infantry'])
    expect(unitStats('carrier', letnev).capacity).toBe(4)
    const after = fightToEnd(base, 300)
    const mine = owned(after, 'bereg', 0)
    expect(mine.filter(u => u.type === 'infantry')).toHaveLength(mine.some(u => u.type === 'carrier') ? 2 : 0)
  })
})
