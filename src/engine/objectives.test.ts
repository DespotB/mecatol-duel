// src/engine/objectives.test.ts
import { describe, expect, it } from 'vitest'
import { MANDATE } from '../data/objectives'
import { addVp, controlsMecatol, fulfils, scoreObjective, scoreable } from './objectives'
import { deepFreeze, toActionPhase, withPlanetOwner, withPlayer, withTechs, withUnits } from './testUtils'
import type { GameState } from './types'

/** Gives seat 0 the four neutral ring planets used by the control objectives. */
function withRing(state: GameState): GameState {
  let s = withPlanetOwner(state, 'bereg', 'bereg', 0)
  s = withPlanetOwner(s, 'bereg', 'lirta-iv', 0)
  s = withPlanetOwner(s, 'quann', 'quann', 0)
  return withPlanetOwner(s, 'sakulag', 'sakulag', 0)
}

describe('R7 objectives', () => {
  it('R7 objective 1: own 3 technologies, the two starting technologies count', () => {
    const s = toActionPhase()
    expect(s.players[0].techs).toHaveLength(2)
    expect(fulfils(s, 0, 'own_3_techs')).toBe(false)
    expect(fulfils(withTechs(s, 0, ['sarween_tools']), 0, 'own_3_techs')).toBe(true)
  })
  it('R7 objective 2: control 4 planets outside your home system', () => {
    const s = toActionPhase()
    expect(fulfils(withPlanetOwner(withRing(s), 'sakulag', 'sakulag', null), 0, 'control_4_outside_home')).toBe(false)
    expect(fulfils(withRing(s), 0, 'control_4_outside_home')).toBe(true)
    expect(fulfils(withRing(s), 1, 'control_4_outside_home')).toBe(false)
  })
  it('R7 objective 3: 3 or more non-fighter ships in the Mecatol Rex system', () => {
    const s = toActionPhase()
    expect(fulfils(withUnits(s, 'mecatol', 0, ['cruiser', 'destroyer', 'fighter', 'fighter']), 0, 'three_ships_mecatol')).toBe(false)
    expect(fulfils(withUnits(s, 'mecatol', 0, ['cruiser', 'destroyer', 'carrier']), 0, 'three_ships_mecatol')).toBe(true)
  })
  it('R7 objective 4: 6 resources spent in a single production this round', () => {
    const s = toActionPhase()
    expect(fulfils(withPlayer(s, 0, { spentInOneProductionThisRound: 5 }), 0, 'spend_6_production')).toBe(false)
    expect(fulfils(withPlayer(s, 0, { spentInOneProductionThisRound: 6 }), 0, 'spend_6_production')).toBe(true)
  })
  it('R7 objective 5: control 5 planets, home planets included', () => {
    const s = withRing(toActionPhase())
    expect(fulfils(s, 0, 'control_5_planets')).toBe(true)          // [0.0.0] plus the four ring planets
    expect(fulfils(withPlanetOwner(s, 'quann', 'quann', null), 0, 'control_5_planets')).toBe(false)
  })
  it('R7 objective 6: two technologies of the same colour, unit upgrades have no colour', () => {
    const s = toActionPhase()
    expect(fulfils(s, 0, 'two_techs_same_colour')).toBe(false)      // one green, one red
    expect(fulfils(withTechs(s, 0, ['fighter_ii', 'carrier_ii']), 0, 'two_techs_same_colour')).toBe(false)
    expect(fulfils(withTechs(s, 0, ['dacxive_animators']), 0, 'two_techs_same_colour')).toBe(true)
  })
  it('R7 Mandate: earned by a won space combat this round, unknown ids are false', () => {
    const s = toActionPhase()
    expect(fulfils(s, 0, MANDATE.id)).toBe(false)
    expect(fulfils(withPlayer(s, 0, { mandateEarnedThisRound: true }), 0, MANDATE.id)).toBe(true)
    expect(fulfils(s, 0, 'no_such_objective')).toBe(false)
  })
  it('R7: scoreable lists revealed, fulfilled and unscored objectives plus the Mandate', () => {
    const s = withPlayer(withTechs(toActionPhase(), 0, ['sarween_tools']), 0, { mandateEarnedThisRound: true })
    expect(s.publicObjectives).toEqual(['own_3_techs'])
    expect(scoreable(s, 0)).toEqual(['own_3_techs', MANDATE.id])
    expect(scoreable(withPlayer(s, 0, { scoredObjectives: ['own_3_techs'], mandateScored: true }), 0)).toEqual([])
    expect(scoreable(s, 1)).toEqual([])
  })
  it('R7: scoring records the objective and adds one victory point', () => {
    const s = deepFreeze(toActionPhase())
    const scored = scoreObjective(s, 0, 'own_3_techs')
    expect(scored.players[0].vp).toBe(1)
    expect(scored.players[0].scoredObjectives).toEqual(['own_3_techs'])
    const mandate = scoreObjective(scored, 0, MANDATE.id)
    expect(mandate.players[0].vp).toBe(2)
    expect(mandate.players[0].mandateScored).toBe(true)
    expect(mandate.players[0].scoredObjectives).toEqual(['own_3_techs'])
    expect(addVp(mandate, 0, 1, 'Mecatol Rex').players[0].vp).toBe(3)
    expect(s.players[0].vp).toBe(0)                                // input not mutated
  })
  it('R7: Mecatol Rex control is read from the centre system', () => {
    const s = toActionPhase()
    expect(controlsMecatol(s, 0)).toBe(false)
    expect(controlsMecatol(withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0), 0)).toBe(true)
    expect(controlsMecatol(withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0), 1)).toBe(false)
  })
})
