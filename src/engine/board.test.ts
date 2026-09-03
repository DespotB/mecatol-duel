// src/engine/board.test.ts
import { describe, expect, it } from 'vitest'
import { enforceFleetPool, fleetPoolLoss, freeFighterSlots } from './board'
import { toActionPhase, withPlayer, withUnits } from './testUtils'
import type { GameState } from './types'

/** The seat's fleet pool after it gave `3 - fleet` of its tokens back; nothing else on the sheet moves. */
function pool(state: GameState, fleet: number): GameState {
  return withPlayer(state, 0, { tokens: { ...state.players[0].tokens, fleet } })
}

const shipsIn = (state: GameState, systemId: string, type: string): number =>
  state.systems[systemId].space.filter(u => u.owner === 0 && u.type === type).length

const losses = (state: GameState): string[] =>
  state.log.flatMap(e => e.t === 'info' && e.text.includes('beyond the fleet pool') ? [e.text] : [])

describe('freeFighterSlots', () => {
  it('R4.4: a space dock (I or II) grants 3 free fighter slots regardless of technology', () => {
    const base = toActionPhase()
    expect(base.players[0].techs.includes('space_dock_ii')).toBe(false)   // starting techs only, no upgrade
    const withDock = withUnits(base, 'bereg', 0, ['spacedock'], 'bereg')
    expect(freeFighterSlots(withDock, 0, 'bereg')).toBe(3)
  })
  it('R4.4: no dock of the seat\'s own in the system grants no free slots', () => {
    const base = toActionPhase()
    expect(freeFighterSlots(base, 0, 'bereg')).toBe(0)
  })
  it('R4.4: a dock owned by the other seat grants no free slots', () => {
    const base = toActionPhase()
    const withOtherDock = withUnits(base, 'bereg', 1, ['spacedock'], 'bereg')
    expect(freeFighterSlots(withOtherDock, 0, 'bereg')).toBe(0)
  })
})

describe('R4.4 enforceFleetPool: a fleet pool that shrinks costs ships', () => {
  it('destroys one ship in the system that no longer fits and returns it to the reinforcements', () => {
    const base = withUnits(toActionPhase(), 'bereg', 0, ['cruiser', 'cruiser', 'cruiser'])
    const before = base.players[0].reinforcements.cruiser
    const after = enforceFleetPool(pool(base, 2), 0)
    expect(shipsIn(after, 'bereg', 'cruiser')).toBe(2)
    expect(after.players[0].reinforcements.cruiser).toBe(before + 1)
    expect(losses(after)).toEqual(['seat 0 loses 1 ship beyond the fleet pool in bereg'])
  })

  it('loses one ship in every system that is over the pool', () => {
    const one = withUnits(toActionPhase(), 'bereg', 0, ['cruiser', 'cruiser', 'cruiser'])
    const both = withUnits(one, 'quann', 0, ['cruiser', 'cruiser', 'cruiser'])
    const after = enforceFleetPool(pool(both, 2), 0)
    expect(shipsIn(after, 'bereg', 'cruiser')).toBe(2)
    expect(shipsIn(after, 'quann', 'cruiser')).toBe(2)
    expect(losses(after)).toHaveLength(2)
  })

  it('a system exactly at the new limit loses nothing, and neither does the opponent', () => {
    const base = withUnits(withUnits(toActionPhase(), 'bereg', 0, ['cruiser', 'cruiser']), 'quann', 1, ['cruiser', 'cruiser', 'cruiser'])
    const shrunk = pool(base, 2)
    const after = enforceFleetPool(shrunk, 0)
    expect(after).toEqual(shrunk)
  })

  it('the cheapest ships go first, in NON_FIGHTER_ORDER', () => {
    const base = withUnits(toActionPhase(), 'bereg', 0, ['dreadnought', 'cruiser', 'destroyer'])
    const after = enforceFleetPool(pool(base, 2), 0)
    expect(shipsIn(after, 'bereg', 'destroyer')).toBe(0)
    expect(shipsIn(after, 'bereg', 'cruiser')).toBe(1)
    expect(shipsIn(after, 'bereg', 'dreadnought')).toBe(1)
  })

  it('a destroyed carrier takes its capacity with it, so the cargo it carried is trimmed', () => {
    // carrier (capacity 4) and two L1Z1X dreadnoughts (capacity 2 each) carry five fighters and one
    // infantry; the carrier is the cheapest of the three, so two fighters go over the capacity that is left
    const ships = withUnits(toActionPhase(), 'bereg', 0, ['carrier', 'dreadnought', 'dreadnought'])
    const base = withUnits(ships, 'bereg', 0, ['fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'infantry'])
    const after = enforceFleetPool(pool(base, 2), 0)
    expect(shipsIn(after, 'bereg', 'carrier')).toBe(0)
    expect(shipsIn(after, 'bereg', 'fighter')).toBe(3)
    expect(shipsIn(after, 'bereg', 'infantry')).toBe(1)
    expect(after.players[0].reinforcements.fighter).toBe(base.players[0].reinforcements.fighter + 2)
  })

  it('fleetPoolLoss reports what a sheet would cost without touching the state', () => {
    const base = withUnits(withUnits(toActionPhase(), 'bereg', 0, ['cruiser', 'cruiser', 'cruiser']), 'quann', 0, ['destroyer', 'destroyer'])
    const tokens = base.players[0].tokens
    expect(fleetPoolLoss(base, 0, tokens)).toEqual([])
    expect(fleetPoolLoss(base, 0, { ...tokens, fleet: 2 })).toEqual([{ systemId: 'bereg', units: [base.systems.bereg.space[0]] }])
    // one lower and the printed home fleet is over the pool too, in map order and cheapest ship first
    const loss = fleetPoolLoss(base, 0, { ...tokens, fleet: 1 })
    expect(loss.map(l => l.systemId)).toEqual(['home-n', 'bereg', 'quann'])
    expect(loss.flatMap(l => l.units.map(u => u.type))).toEqual(['carrier', 'cruiser', 'cruiser', 'destroyer'])
    // the query is read-only: the board it was asked about is untouched
    expect(base.systems.bereg.space.filter(u => u.owner === 0)).toHaveLength(3)
  })

  it('Armada counts: the Letnev pool is two ships wider than the tokens on the sheet', () => {
    const base = withUnits(toActionPhase(), 'quann', 1, ['cruiser', 'cruiser', 'cruiser'])
    expect(fleetPoolLoss(base, 1, { ...base.players[1].tokens, fleet: 1 })).toEqual([])   // 1 + 2 holds all three
    expect(fleetPoolLoss(base, 1, { ...base.players[1].tokens, fleet: 0 }).map(l => l.systemId)).toEqual(['quann', 'home-s'])
  })
})
