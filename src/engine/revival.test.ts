import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { carriedIds, cardsUsed, deepFreeze, hitsIn, toActionPhase, withPlanetOwner, withPlayer, withTechs, withUnits } from './testUtils'
import type { GameState, Result, UnitType } from './types'

const ok = (r: Result<GameState>): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const revivalRolls = (state: GameState): number => state.log.filter(e => e.t === 'roll' && e.context === 'Infantry II revival').length

/** Seat 0 lands two infantry on Quann against `defenders` infantry of seat 1. */
function invading(defenders: number, seed = 3): GameState {
  let s = withTechs(toActionPhase(), 0, ['infantry_ii'])
  s = withPlanetOwner(s, 'quann', 'quann', 1)
  s = withUnits(s, 'quann', 1, Array<UnitType>(defenders).fill('infantry'), 'quann')
  s = withUnits(s, 'quann', 0, ['carrier', 'infantry', 'infantry'])
  const started = ok(applyMove(deepFreeze(s), { type: 'startTactical', systemId: 'quann' }, seed))
  const moved = ok(applyMove(started, { type: 'endMovement' }, seed))
  return ok(applyMove(moved, { type: 'land', planetId: 'quann', infantryIds: carriedIds(moved, 'quann', 0) }, seed))
}

describe('R4.3 step 4 Infantry II revival', () => {
  it('R4.3 step 4: infantry lost in ground combat roll to return, but only with Infantry II', () => {
    let s = invading(6)
    for (let i = 0; i < 20 && s.systems.quann.planets[0].ground.some(u => u.owner === 0); i++) {
      s = ok(applyMove(s, { type: 'groundCombatRound' }, 30 + i))
    }
    expect(revivalRolls(s)).toBeGreaterThan(0)                       // six defenders at 8+ wipe two attackers
    expect(s.players[0].pendingInfantry).toBe(hitsIn(s, 'Infantry II revival'))
    expect(s.players[1].pendingInfantry).toBe(0)                     // seat 1 has no Infantry II
  })
  it('R4.3 step 4: bombardment and space cannon defense roll for the same return', () => {
    let s = withTechs(toActionPhase(), 1, ['infantry_ii'])
    s = withPlanetOwner(s, 'quann', 'quann', 1)
    s = withUnits(s, 'quann', 1, ['infantry', 'infantry', 'infantry'], 'quann')
    s = withUnits(s, 'quann', 0, ['dreadnought'])
    const started = ok(applyMove(deepFreeze(s), { type: 'startTactical', systemId: 'quann' }, 4))
    const moved = ok(applyMove(started, { type: 'endMovement' }, 4))
    const bombed = ok(applyMove(moved, { type: 'bombard', planetId: 'quann' }, 4))
    const killed = 3 - bombed.systems.quann.planets[0].ground.filter(u => u.owner === 1).length
    expect(revivalRolls(bombed)).toBe(killed > 0 ? 1 : 0)            // one entry per group that lost infantry
    expect(bombed.players[1].pendingInfantry).toBe(hitsIn(bombed, 'Infantry II revival'))
    expect(bombed.players[0].pendingInfantry).toBe(0)

    let t = withTechs(toActionPhase(), 0, ['infantry_ii'])
    t = withPlanetOwner(t, 'quann', 'quann', 1)
    t = withUnits(t, 'quann', 1, ['pds'], 'quann')
    t = withUnits(t, 'quann', 0, ['carrier', 'infantry', 'infantry'])
    const s2 = ok(applyMove(deepFreeze(t), { type: 'startTactical', systemId: 'quann' }, 6))
    const m2 = ok(applyMove(s2, { type: 'endMovement' }, 6))
    const landed = ok(applyMove(m2, { type: 'land', planetId: 'quann', infantryIds: carriedIds(m2, 'quann', 0) }, 6))
    const lost = 2 - landed.systems.quann.planets[0].ground.filter(u => u.owner === 0).length
    expect(revivalRolls(landed)).toBe(lost > 0 ? 1 : 0)
    expect(landed.players[0].pendingInfantry).toBe(hitsIn(landed, 'Infantry II revival'))
  })
  it('R4.3 step 4: the infantry come back on a home planet at the start of your next turn', () => {
    const s = withPlayer(cardsUsed(toActionPhase(1, 1)), 0, { pendingInfantry: 2 })
    const before = s.players[0].reinforcements.infantry
    const done = ok(applyMove(s, { type: 'pass' }, 0))                // seat 1 passes, seat 0 is on turn
    expect(done.active).toBe(0)
    expect(done.players[0].pendingInfantry).toBe(0)
    expect(done.players[0].reinforcements.infantry).toBe(before - 2)
    expect(done.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(7)
  })
  it('R4.3 step 4: without a home planet or reinforcements the infantry are lost', () => {
    const base = withPlayer(cardsUsed(toActionPhase(1, 1)), 0, { pendingInfantry: 2 })
    const homeless = withPlanetOwner(base, 'home-n', '000', null)
    const lost = ok(applyMove(homeless, { type: 'pass' }, 0))
    expect(lost.players[0].pendingInfantry).toBe(0)
    expect(lost.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(5)
    const empty = withPlayer(base, 0, { pendingInfantry: 2, reinforcements: { ...base.players[0].reinforcements, infantry: 1 } })
    const partial = ok(applyMove(empty, { type: 'pass' }, 0))
    expect(partial.players[0]).toMatchObject({ pendingInfantry: 0, reinforcements: expect.objectContaining({ infantry: 0 }) })
    expect(partial.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(6)
  })
})

// Task 7b (after Plan 3 Tasks 2-6): round-boundary revival via pickStrategyCard and the secondary window
