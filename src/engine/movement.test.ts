// src/engine/movement.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { deepFreeze, groundIds, hitsIn, shipId, toActionPhase, withPlanetOwner, withTechs, withUnits } from './testUtils'
import type { GameState, Seat } from './types'

function activate(state: GameState, seat: Seat, systemId: string): GameState {
  const r = applyMove(deepFreeze({ ...state, active: seat }), { type: 'startTactical', systemId }, 0)
  if (!r.ok) throw new Error(r.error)
  return deepFreeze(r.value)
}

const move = (state: GameState, unitId: number, from: string, carrying: number[] = []) =>
  applyMove(deepFreeze(state), { type: 'moveShips', moves: [{ unitId, from, carrying }] }, 0)

describe('R3.2 movement', () => {
  it('R3.2 step 2: a carrier moves one system and carries infantry within its capacity', () => {
    const s = activate(toActionPhase(), 0, 'bereg')
    const carrier = shipId(s, 'home-n', 'carrier')
    const troops = groundIds(s, 'home-n', '000').slice(0, 4)
    const r = move(s, carrier, 'home-n', troops)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.systems.bereg.space.filter(u => u.owner === 0).map(u => u.type).sort())
      .toEqual(['carrier', 'infantry', 'infantry', 'infantry', 'infantry'])
    expect(r.value.systems['home-n'].planets[0].ground).toHaveLength(1)
    expect(r.value.systems['home-n'].space.some(u => u.id === carrier)).toBe(false)
  })
  it('R3.2 step 2: carrying more than the capacity is rejected', () => {
    const s = activate(toActionPhase(), 0, 'bereg')
    expect(move(s, shipId(s, 'home-n', 'carrier'), 'home-n', groundIds(s, 'home-n', '000')).ok).toBe(false)
  })
  it('R3.2 step 2: a fighter only moves on its own with Fighter II', () => {
    const plain = activate(toActionPhase(), 0, 'bereg')
    expect(move(plain, shipId(plain, 'home-n', 'fighter'), 'home-n').ok).toBe(false)
    const upgraded = activate(withTechs(toActionPhase(), 0, ['fighter_ii']), 0, 'bereg')
    const r = move(upgraded, shipId(upgraded, 'home-n', 'fighter'), 'home-n')
    if (!r.ok) throw new Error(r.error)
    expect(r.value.systems.bereg.space.filter(u => u.owner === 0 && u.type === 'fighter')).toHaveLength(1)
  })
  it('R3.2 step 2: Fighter II fighters above the capacity count against the fleet pool', () => {
    const base = withTechs(toActionPhase(), 0, ['fighter_ii'])
    const crowded = withUnits(base, 'bereg', 0, ['cruiser', 'cruiser', 'fighter'])   // 2 non-fighters plus one loose fighter
    const s = activate(crowded, 0, 'bereg')
    // the loose fighter and the arriving one have no capacity, so both count as non-fighter ships: 2 + 2 > fleet pool 3
    expect(move(s, shipId(s, 'home-n', 'fighter'), 'home-n').ok).toBe(false)
    const smaller = activate(withUnits(base, 'bereg', 0, ['cruiser', 'fighter']), 0, 'bereg')
    expect(move(smaller, shipId(smaller, 'home-n', 'fighter'), 'home-n').ok).toBe(true)   // 1 + 2 = 3
  })
  it('R1 anomaly: the asteroid field can only be entered with Antimass Deflectors', () => {
    const north = activate(withUnits(toActionPhase(), 'home-n', 0, ['destroyer']), 0, 'sakulag')
    expect(move(north, shipId(north, 'home-n', 'destroyer'), 'home-n').ok).toBe(false)
    const armed = activate(withUnits(withTechs(toActionPhase(), 0, ['antimass_deflectors']), 'home-n', 0, ['destroyer']), 0, 'sakulag')
    expect(move(armed, shipId(armed, 'home-n', 'destroyer'), 'home-n').ok).toBe(true)
    const letnev = activate(toActionPhase(), 1, 'sakulag')   // Letnev starts with Antimass Deflectors
    expect(move(letnev, shipId(letnev, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(true)
  })
  it('R1 anomaly: a ship must end its movement in the nebula and has move 1 when it starts there', () => {
    const intoNebula = activate(toActionPhase(), 1, 'quann')
    expect(move(intoNebula, shipId(intoNebula, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(true)
    const blocked = activate(withUnits(toActionPhase(), 'starpoint', 0, ['destroyer']), 1, 'bereg')
    expect(move(blocked, shipId(blocked, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(false)   // the only route left crosses the nebula
    const inNebula = withUnits(toActionPhase(), 'quann', 1, ['cruiser'])
    const far = activate(inNebula, 1, 'starpoint')
    expect(move(far, shipId(far, 'quann', 'cruiser', 1), 'quann').ok).toBe(false)   // two steps with move 1
    const near = activate(inNebula, 1, 'home-s')
    expect(move(near, shipId(near, 'quann', 'cruiser', 1), 'quann').ok).toBe(true)
  })
  it('R1 wormholes: the alpha wormhole makes bereg and starpoint one step apart', () => {
    const s = activate(withUnits(toActionPhase(), 'bereg', 0, ['carrier']), 0, 'starpoint')
    expect(move(s, shipId(s, 'bereg', 'carrier'), 'bereg').ok).toBe(true)
  })
  it('R3.2 step 2: ships may not move through a system that contains enemy or guardian ships', () => {
    const open = activate(withUnits(toActionPhase(), 'home-n', 0, ['destroyer']), 0, 'quann')
    expect(move(open, shipId(open, 'home-n', 'destroyer'), 'home-n').ok).toBe(true)   // via bereg
    const blocked = activate(withUnits(withUnits(toActionPhase(), 'home-n', 0, ['destroyer']), 'bereg', 1, ['destroyer']), 0, 'quann')
    expect(move(blocked, shipId(blocked, 'home-n', 'destroyer'), 'home-n').ok).toBe(false)
  })
  it('R3.2 step 2: ships in a system that contains your own command token cannot move', () => {
    const placed = withUnits(toActionPhase(), 'bereg', 0, ['carrier'])
    const tokened: GameState = { ...placed, systems: { ...placed.systems, bereg: { ...placed.systems.bereg, activatedBy: [0 as Seat] } } }
    const s = activate(tokened, 0, 'starpoint')
    expect(move(s, shipId(s, 'bereg', 'carrier'), 'bereg').ok).toBe(false)
  })
  it('R3.2 step 2: Gravity Drive gives +1 move to exactly one ship per activation', () => {
    const plain = activate(withUnits(toActionPhase(), 'home-n', 0, ['carrier']), 0, 'starpoint')
    expect(move(plain, shipId(plain, 'home-n', 'carrier'), 'home-n').ok).toBe(false)   // two steps with move 1
    const gd = activate(withUnits(withTechs(toActionPhase(), 0, ['gravity_drive']), 'home-n', 0, ['carrier', 'carrier']), 0, 'starpoint')
    const ids = gd.systems['home-n'].space.filter(u => u.type === 'carrier' && u.owner === 0).map(u => u.id)
    expect(move(gd, ids[0], 'home-n').ok).toBe(true)
    const both = applyMove(gd, { type: 'moveShips', moves: ids.map(id => ({ unitId: id, from: 'home-n', carrying: [] })) }, 0)
    expect(both.ok).toBe(false)
  })
  it('R4.4 fleet pool limits the arrivals, Armada gives Letnev two more', () => {
    const crowded = activate(withUnits(toActionPhase(), 'bereg', 0, ['cruiser', 'cruiser', 'cruiser']), 0, 'bereg')
    const from = withUnits(crowded, 'home-n', 0, ['destroyer'])
    expect(move(from, shipId(from, 'home-n', 'destroyer'), 'home-n').ok).toBe(false)   // fleet pool 3
    const letnev = activate(withUnits(toActionPhase(), 'starpoint', 1, ['cruiser', 'cruiser', 'cruiser', 'cruiser']), 1, 'starpoint')
    expect(move(letnev, shipId(letnev, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(true)   // 5 with Armada
    const full = activate(withUnits(toActionPhase(), 'starpoint', 1, ['cruiser', 'cruiser', 'cruiser', 'cruiser', 'cruiser']), 1, 'starpoint')
    expect(move(full, shipId(full, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(false)
  })
  it('endMovement goes to the space combat when enemy ships are present, otherwise to the invasion', () => {
    const empty = activate(toActionPhase(), 0, 'bereg')
    const r = applyMove(empty, { type: 'endMovement' }, 0)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.tactical?.step).toBe('invasion')
    expect(r.value.tactical?.invasion).toEqual({ planetId: null, landed: [], bombarded: [] })
    const mecatol = activate(withUnits(toActionPhase(), 'home-n', 0, ['destroyer']), 0, 'mecatol')
    const moved = move(mecatol, shipId(mecatol, 'home-n', 'destroyer'), 'home-n')
    if (!moved.ok) throw new Error(moved.error)
    const combat = applyMove(moved.value, { type: 'endMovement' }, 0)
    if (!combat.ok) throw new Error(combat.error)
    expect(combat.value.tactical?.step).toBe('spaceCombat')
    expect(combat.value.tactical?.combat).toEqual({ round: 0, attacker: 0, defender: 'guardian', retreating: null, retreatTo: null, lastRolls: [] })
  })
  it('R4.1 step 1: endMovement resolves space cannon offense when only a PDS defends an otherwise empty system, then continues to the invasion', () => {
    const withPds = withUnits(withPlanetOwner(toActionPhase(), 'bereg', 'bereg', 1), 'bereg', 1, ['pds'], 'bereg')
    const s = activate(withUnits(withPds, 'home-n', 0, ['destroyer', 'destroyer']), 0, 'bereg')
    const ids = s.systems['home-n'].space.filter(u => u.owner === 0 && u.type === 'destroyer').map(u => u.id)
    const moved = applyMove(s, { type: 'moveShips', moves: ids.map(id => ({ unitId: id, from: 'home-n', carrying: [] })) }, 0)
    if (!moved.ok) throw new Error(moved.error)
    const after = applyMove(moved.value, { type: 'endMovement' }, 5)
    if (!after.ok) throw new Error(after.error)
    expect(after.value.tactical?.step).toBe('invasion')
    const entries = after.value.log.filter(e => e.t === 'roll' && e.context === 'space cannon offense')
    expect(entries).toHaveLength(1)
    expect(after.value.systems.bereg.space.filter(u => u.owner === 0)).toHaveLength(2 - hitsIn(after.value, 'space cannon offense'))
  })
})
