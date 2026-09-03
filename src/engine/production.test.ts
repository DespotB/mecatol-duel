// src/engine/production.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { deepFreeze, toActionPhase, withPlayer, withTactical, withTechs, withUnits } from './testUtils'
import type { GameState, UnitType } from './types'

/** Seat 0 in the production step of its own home system: dock on a 5 resource planet, fleet pool 3, capacity 6. */
const producing = (seed = 1) => withTactical(toActionPhase(seed), { systemId: 'home-n', step: 'production' })

const produce = (state: GameState, units: Partial<Record<UnitType, number>>, planets: string[], tradeGoods = 0) =>
  applyMove(deepFreeze(state), { type: 'produce', units, planets, tradeGoods }, 0)

const fighters = (state: GameState) => state.systems['home-n'].space.filter(u => u.owner === 0 && u.type === 'fighter').length

describe('R4.4 production', () => {
  it('produces ships into the space and infantry onto the dock planet, then finishes the step', () => {
    const s = producing()
    const r = produce(s, { cruiser: 1, infantry: 2 }, ['000'])
    if (!r.ok) throw new Error(r.error)
    expect(r.value.systems['home-n'].space.filter(u => u.owner === 0 && u.type === 'cruiser')).toHaveLength(1)
    expect(r.value.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(7)
    expect(r.value.systems['home-n'].planets[0].exhausted).toBe(true)
    expect(r.value.players[0].reinforcements.cruiser).toBe(s.players[0].reinforcements.cruiser - 1)
    expect(r.value.players[0].reinforcements.infantry).toBe(s.players[0].reinforcements.infantry - 2)
    expect(r.value.tactical?.step).toBe('done')
    const ids = r.value.systems['home-n'].space.map(u => u.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('R4.4: the production limit is the planet resources plus the dock bonus', () => {
    const s = producing()
    expect(produce(s, { infantry: 8 }, ['000']).ok).toBe(false)     // limit 7
    expect(produce(s, { infantry: 6, fighter: 1 }, ['000']).ok).toBe(true)
  })
  it('R4.4: fighters and infantry come in pairs and Sarween Tools takes one off the total', () => {
    const s = producing()
    expect(produce(s, { fighter: 2, infantry: 2 }, []).ok).toBe(false)     // cost 2, nothing paid
    expect(produce(s, { fighter: 2, infantry: 2 }, ['000']).ok).toBe(true)
    expect(produce(withTechs(s, 0, ['sarween_tools']), { infantry: 2 }, []).ok).toBe(true)   // cost 1 minus 1
  })
  it('R4.4: a War Sun needs the technology and only one flagship may exist', () => {
    const rich = withPlayer(producing(), 0, { tradeGoods: 20 })
    expect(produce(rich, { warsun: 1 }, [], 12).ok).toBe(false)
    expect(produce(withTechs(rich, 0, ['war_sun']), { warsun: 1 }, [], 12).ok).toBe(true)    // 3 non-fighter ships is exactly the fleet pool
    expect(produce(rich, { flagship: 2 }, [], 16).ok).toBe(false)
    expect(produce(withUnits(rich, 'home-n', 0, ['flagship']), { flagship: 1 }, [], 8).ok).toBe(false)
  })
  it('R4.4: reinforcements and the fleet pool limit the production', () => {
    const s = producing()
    const empty = withPlayer(s, 0, { reinforcements: { ...s.players[0].reinforcements, cruiser: 0 }, tradeGoods: 20 })
    expect(produce(empty, { cruiser: 1 }, [], 2).ok).toBe(false)
    const rich = withTechs(withPlayer(s, 0, { tradeGoods: 20 }), 0, ['war_sun'])
    expect(produce(rich, { warsun: 1, cruiser: 1 }, [], 14).ok).toBe(false)   // 2 present plus 2 produced is over the fleet pool of 3
    expect(produce(rich, { cruiser: 1 }, [], 2).ok).toBe(true)
  })
  it('R4.4: fighters above the capacity are trimmed and the production still succeeds', () => {
    const rich = withPlayer(producing(), 0, { tradeGoods: 10 })
    expect(fighters(rich)).toBe(3)                                  // carrier 4 plus super-dreadnought 2 is capacity 6
    const r = produce(rich, { fighter: 6 }, [], 3)
    if (!r.ok) throw new Error(r.error)
    expect(fighters(r.value)).toBe(6)                               // only three fit
    expect(r.value.log.some(e => e.t === 'info' && e.text.includes('not produced'))).toBe(true)
    const dock2 = produce(withTechs(rich, 0, ['space_dock_ii']), { fighter: 6 }, [], 3)
    if (!dock2.ok) throw new Error(dock2.error)
    expect(fighters(dock2.value)).toBe(9)                           // three free Space Dock II slots
    const none = produce(withPlayer(rich, 0, { tradeGoods: 10 }), { fighter: 0 }, [])
    expect(none.ok).toBe(false)
  })
  it('R4.4: PDS and space docks cannot be produced in the duel', () => {
    const s = producing()
    expect(produce(s, { pds: 1 }, ['000']).ok).toBe(false)
    expect(produce(s, { spacedock: 1 }, ['000']).ok).toBe(false)
  })
  it('R7 objective 4: the highest spend of the round is recorded', () => {
    const first = produce(producing(), { infantry: 2 }, ['000'])
    if (!first.ok) throw new Error(first.error)
    expect(first.value.players[0].spentInOneProductionThisRound).toBe(1)
    const again = withPlayer(withTactical(first.value, { systemId: 'home-n', step: 'production' }), 0, { tradeGoods: 6 })
    const second = produce(again, { dreadnought: 1, infantry: 4 }, [], 6)   // 4 + 2 resources, 5 units, one more non-fighter ship
    if (!second.ok) throw new Error(second.error)
    expect(second.value.players[0].spentInOneProductionThisRound).toBe(6)
    expect(second.value.players[0].tradeGoods).toBe(0)
    expect(second.value.systems['home-n'].space.filter(u => u.owner === 0 && u.type === 'dreadnought')).toHaveLength(2)
    expect(second.value.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(11)
  })
  it('production needs a space dock of your own in the active system and the production step', () => {
    const s = producing()
    expect(produce(withTactical(s, { systemId: 'bereg', step: 'production' }), { infantry: 2 }, ['000']).ok).toBe(false)
    expect(produce(withTactical(s, { systemId: 'home-n', step: 'movement' }), { infantry: 2 }, ['000']).ok).toBe(false)
  })
})
