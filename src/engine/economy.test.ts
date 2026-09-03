import { describe, expect, it } from 'vitest'
import { capacity, fleetPoolLimit, nonFighterShips, payCost, productionCost, productionLimit, readyResources } from './economy'
import { createGame } from './setup'
import type { GameConfig } from './types'

const config: GameConfig = { players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }], speaker: 0 }

describe('R4.4 economy helpers', () => {
  const g = createGame(config, 1)
  it('ready resources sum controlled ready planets', () => {
    expect(readyResources(g, 0)).toBe(5)
    expect(readyResources(g, 1)).toBe(6)
  })
  it('payCost exhausts planets and spends trade goods, overpay is lost', () => {
    const s = { ...g, players: [g.players[0], { ...g.players[1], tradeGoods: 3 }] as typeof g.players }
    const r = payCost(s, 1, 5, ['arc-prime'], 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.systems['home-s'].planets[0].exhausted).toBe(true)
    expect(r.value.players[1].tradeGoods).toBe(1)
    expect(g.systems['home-s'].planets[0].exhausted).toBe(false)
  })
  it('payCost fails when the payment is short or a planet is not ready', () => {
    expect(payCost(g, 1, 5, ['arc-prime'], 0).ok).toBe(false)
    const exhausted = payCost(g, 1, 4, ['arc-prime'], 0)
    if (!exhausted.ok) throw new Error(exhausted.error)
    expect(payCost(exhausted.value, 1, 1, ['arc-prime'], 0).ok).toBe(false)
    expect(payCost(g, 0, 1, ['arc-prime'], 0).ok).toBe(false)   // not controlled by seat 0
  })
  it('productionCost pairs fighters and infantry and applies Sarween Tools', () => {
    const owner = { faction: 'letnev' as const, techs: [] as string[] }
    expect(productionCost({ fighter: 2, infantry: 2, dreadnought: 1 }, owner, false)).toBe(6)
    expect(productionCost({ fighter: 3 }, owner, false)).toBe(2)
    expect(productionCost({ fighter: 1, cruiser: 1 }, owner, true)).toBe(2)
    expect(productionCost({}, owner, true)).toBe(0)
  })
  it('productionLimit is planet resources plus the dock bonus', () => {
    expect(productionLimit(g, 0, 'home-n')).toBe(7)
    expect(productionLimit(g, 1, 'home-s')).toBe(6)
    expect(productionLimit(g, 0, 'home-s')).toBe(0)
    const dock2 = { ...g, players: [{ ...g.players[0], techs: [...g.players[0].techs, 'space_dock_ii'] }, g.players[1]] as typeof g.players }
    expect(productionLimit(dock2, 0, 'home-n')).toBe(9)
  })
  it('fleet pool, non-fighter count and capacity', () => {
    expect(fleetPoolLimit(g.players[0])).toBe(3)
    expect(fleetPoolLimit(g.players[1])).toBe(5)
    expect(nonFighterShips(g.systems['home-n'].space)).toBe(2)
    expect(capacity(g.systems['home-n'].space, { faction: 'l1z1x', techs: [] })).toBe(6)   // super-dreadnought 2 + carrier 4
    expect(capacity(g.systems['home-s'].space, { faction: 'letnev', techs: [] })).toBe(5)   // dreadnought 1 + carrier 4
  })
})
