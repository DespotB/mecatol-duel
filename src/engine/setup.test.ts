import { describe, expect, it } from 'vitest'
import { unitStats } from '../data/units'
import { ALL_STRATEGY_CARDS, GUARDIAN_FLEETS, createGame, rollGuardianFleet, unitsOf } from './setup'
import type { GameConfig, UnitType } from './types'

const config: GameConfig = {
  players: [{ faction: 'l1z1x', color: 'blue', name: 'Despot' }, { faction: 'letnev', color: 'red', name: 'Kael' }],
  speaker: 0,
}

const count = (units: { type: UnitType }[], type: UnitType) => units.filter(u => u.type === type).length

describe('R2 setup', () => {
  const g = createGame(config, 1)
  it('starts in round 1 strategy phase with the speaker to pick and all six cards in the pool', () => {
    expect(g.round).toBe(1); expect(g.phase).toBe('strategy'); expect(g.active).toBe(0)
    expect(g.draft).toEqual([0, 1, 1, 0])
    expect(g.strategyPool.map(c => c.id)).toEqual(ALL_STRATEGY_CARDS)
    expect(g.publicObjectives).toEqual(['own_3_techs'])
  })
  it('places the printed starting units', () => {
    const north = g.systems['home-n'], south = g.systems['home-s']
    expect(count(north.space, 'dreadnought')).toBe(1); expect(count(north.space, 'carrier')).toBe(1); expect(count(north.space, 'fighter')).toBe(3)
    expect(count(north.planets[0].ground, 'infantry')).toBe(5)
    expect(north.planets[0].structures.map(u => u.type).sort()).toEqual(['pds', 'spacedock'])
    expect(count(south.space, 'dreadnought')).toBe(1); expect(count(south.space, 'carrier')).toBe(1); expect(count(south.space, 'destroyer')).toBe(1); expect(count(south.space, 'fighter')).toBe(1)
    expect(count(south.planets[0].ground, 'infantry')).toBe(2); expect(count(south.planets[1].ground, 'infantry')).toBe(1)
    expect(south.planets[0].structures.map(u => u.type)).toEqual(['spacedock'])
    expect(north.planets[0].owner).toBe(0); expect(south.planets[1].owner).toBe(1)
  })
  it('gives starting techs, tokens, commodities and reinforcements', () => {
    expect(g.players[0].techs).toEqual(['neural_motivator', 'plasma_scoring'])
    expect(g.players[1].techs).toEqual(['antimass_deflectors', 'plasma_scoring'])
    expect(g.players[0].tokens).toEqual({ tactic: 3, fleet: 3, strategy: 2 })
    expect(g.players[0].commodities).toBe(2); expect(g.players[0].tradeGoods).toBe(0)
    expect(g.players[0].reinforcements.infantry).toBe(7); expect(g.players[0].reinforcements.pds).toBe(5); expect(g.players[1].reinforcements.pds).toBe(6)
  })
  it('unit ids are unique across the map', () => {
    const ids = [...unitsOf(g, 0), ...unitsOf(g, 1), ...unitsOf(g, 'guardian')].map(u => u.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(g.nextUnitId).toBe(Math.max(...ids) + 1)
  })
})

describe('R4.2 guardian fleet', () => {
  it('every table entry costs exactly 8', () => {
    for (const fleet of GUARDIAN_FLEETS) {
      const cost = (Object.entries(fleet) as [UnitType, number][]).reduce((sum, [type, n]) => {
        const s = unitStats(type, 'guardian'); return sum + (n / s.producedPerCost) * s.cost
      }, 0)
      expect(cost).toBe(8)
    }
    expect(GUARDIAN_FLEETS).toHaveLength(6)
  })
  it('createGame places a guardian fleet and 2 guardian infantry on Mecatol Rex', () => {
    const g = createGame(config, 5)
    const space = g.systems.mecatol.space
    expect(space.length).toBeGreaterThan(0)
    expect(space.every(u => u.owner === 'guardian')).toBe(true)
    expect(count(g.systems.mecatol.planets[0].ground, 'infantry')).toBe(2)
    expect(g.systems.mecatol.planets[0].owner).toBeNull()
    expect(g.guardianRolls).toBe(1)
  })
  it('rolling is seeded and replaces the previous fleet', () => {
    const a = createGame(config, 11), b = createGame(config, 11), c = createGame(config, 12)
    const sig = (s: typeof a) => s.systems.mecatol.space.map(u => u.type).sort().join(',')
    expect(sig(a)).toBe(sig(b))
    const rerolled = rollGuardianFleet(a, 99)
    expect(rerolled.guardianRolls).toBe(2)
    expect(rerolled.systems.mecatol.space.every(u => u.owner === 'guardian')).toBe(true)
    expect(count(rerolled.systems.mecatol.planets[0].ground, 'infantry')).toBe(2)
    expect(a.guardianRolls).toBe(1)   // input not mutated
    void c
  })
})
