// src/engine/objectives.test.ts
import { describe, expect, it } from 'vitest'
import { FIRST_STRIKE, FOOTHOLD, PUBLIC_OBJECTIVES } from '../data/objectives'
import { readyResources } from './economy'
import { OBJECTIVES_PER_GAME, createGame } from './setup'
import { addVp, controlsMecatol, freeScoreable, fulfils, paidScoreable, scoreObjective, scoreable } from './objectives'
import { DUEL_CONFIG, deepFreeze, toActionPhase, withExhausted, withPlanetOwner, withPlayer, withTechs, withUnits } from './testUtils'
import type { GameState } from './types'

/** Gives seat 0 the four neutral ring planets used by the control objectives. */
function withRing(state: GameState): GameState {
  let s = withPlanetOwner(state, 'bereg', 'bereg', 0)
  s = withPlanetOwner(s, 'bereg', 'lirta-iv', 0)
  s = withPlanetOwner(s, 'quann', 'quann', 0)
  return withPlanetOwner(s, 'sakulag', 'sakulag', 0)
}

describe('R7 objectives', () => {
  it('R7: win a space combat against your opponent, a guardian fleet does not count', () => {
    const s = toActionPhase()
    expect(fulfils(s, 0, 'win_space_combat')).toBe(false)
    expect(fulfils(withPlayer(s, 0, { spaceCombatWins: 1 }), 0, 'win_space_combat')).toBe(true)
  })
  it('R7: control 4 planets outside your home system', () => {
    const s = toActionPhase()
    expect(fulfils(withPlanetOwner(withRing(s), 'sakulag', 'sakulag', null), 0, 'control_4_outside_home')).toBe(false)
    expect(fulfils(withRing(s), 0, 'control_4_outside_home')).toBe(true)
    expect(fulfils(withRing(s), 1, 'control_4_outside_home')).toBe(false)
  })
  it('R7: pay 6 resources, scoreable only while the seat can actually raise them', () => {
    const s = toActionPhase()
    expect(readyResources(s, 0)).toBe(5)                                            // the home planet alone
    expect(fulfils(s, 0, 'pay_6_resources')).toBe(false)                            // 5 resources, no trade goods
    expect(fulfils(withPlayer(s, 0, { tradeGoods: 1 }), 0, 'pay_6_resources')).toBe(true)
    expect(fulfils(withPlanetOwner(s, 'sakulag', 'sakulag', 0), 0, 'pay_6_resources')).toBe(true)
    // exhausted planets do not count, trade goods alone can still cover it
    const spent = withExhausted(s, ['000'])
    expect(fulfils(withPlayer(spent, 0, { tradeGoods: 5 }), 0, 'pay_6_resources')).toBe(false)
    expect(fulfils(withPlayer(spent, 0, { tradeGoods: 6 }), 0, 'pay_6_resources')).toBe(true)
  })
  it('R7: own 5 technologies, unit upgrades and faction technologies included', () => {
    const s = toActionPhase()
    expect(s.players[0].techs).toHaveLength(2)                                      // the two starting technologies
    expect(fulfils(withTechs(s, 0, ['sarween_tools', 'antimass_deflectors']), 0, 'own_5_techs')).toBe(false)
    expect(fulfils(withTechs(s, 0, ['sarween_tools', 'antimass_deflectors', 'fighter_ii']), 0, 'own_5_techs')).toBe(true)
  })
  it('R7: a fifth of the time left is always payable, so the objective is always scoreable', () => {
    const s = toActionPhase()
    expect(fulfils(s, 0, 'pay_time_20')).toBe(true)
    expect(fulfils(s, 1, 'pay_time_20')).toBe(true)
    // revealed and unscored is the whole gate: the clock itself lives outside the engine
    const revealed = deepFreeze({ ...s, publicObjectives: ['pay_time_20'] })
    expect(scoreable(revealed, 0)).toContain('pay_time_20')
    expect(scoreable(withPlayer(revealed, 0, { scoredObjectives: ['pay_time_20'] }), 0)).not.toContain('pay_time_20')
  })
  it('R7: the paid objectives are kept apart from the ones that score themselves', () => {
    const s = deepFreeze({
      ...withPlayer(toActionPhase(), 0, { trades: 3, tradeGoods: 1 }),
      publicObjectives: ['trade_three_times', 'pay_6_resources', 'pay_time_20'],
    })
    expect(freeScoreable(s, 0)).toEqual(['trade_three_times'])
    expect(paidScoreable(s, 0)).toEqual(['pay_6_resources', 'pay_time_20'])
    expect(scoreable(s, 0)).toEqual(['trade_three_times', 'pay_6_resources', 'pay_time_20'])
  })
  it('R7: trade three times, at the posts or with the opponent', () => {
    const s = toActionPhase()
    expect(fulfils(withPlayer(s, 0, { trades: 2 }), 0, 'trade_three_times')).toBe(false)
    expect(fulfils(withPlayer(s, 0, { trades: 3 }), 0, 'trade_three_times')).toBe(true)
  })
  it('R7: have more ships on the board than your opponent, every ship type counts', () => {
    const s = toActionPhase()
    expect(fulfils(s, 0, 'more_ships')).toBe(true)                                   // 5 against 4 at setup
    expect(fulfils(s, 1, 'more_ships')).toBe(false)
    expect(fulfils(withUnits(s, 'bereg', 1, ['fighter', 'fighter']), 1, 'more_ships')).toBe(true)
    // a tie is not "more"
    expect(fulfils(withUnits(s, 'bereg', 1, ['fighter']), 0, 'more_ships')).toBe(false)
  })
  it('R7 First Strike: the first space combat won in Mecatol Rex takes the point, and only that one', () => {
    const s = toActionPhase()
    expect(fulfils(s, 0, FIRST_STRIKE.id)).toBe(false)
    const claimed = deepFreeze({ ...s, mecatolCombatWinner: 0 as const })
    expect(fulfils(claimed, 0, FIRST_STRIKE.id)).toBe(true)
    expect(fulfils(claimed, 1, FIRST_STRIKE.id)).toBe(false)
  })
  it('R7 Foothold: a planet taken in the opponent home system, one for each player', () => {
    const s = toActionPhase()
    expect(fulfils(s, 0, FOOTHOLD.id)).toBe(false)
    expect(fulfils(withPlanetOwner(s, 'home-s', 'wren-terra', 0), 0, FOOTHOLD.id)).toBe(true)
    expect(fulfils(withPlanetOwner(s, 'home-n', '000', 1), 1, FOOTHOLD.id)).toBe(true)
    expect(fulfils(s, 0, 'no_such_objective')).toBe(false)
  })
  it('R7: six objectives are drawn from the pool per game and one is revealed at setup', () => {
    const ids = PUBLIC_OBJECTIVES.map(o => o.id)
    const orders = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => createGame(DUEL_CONFIG, seed).objectiveOrder)
    for (const order of orders) {
      expect(order).toHaveLength(OBJECTIVES_PER_GAME)
      for (const id of order) expect(ids).toContain(id)
    }
    // the ones left out change with the seed, so the draw is a draw and not a fixed prefix
    expect(new Set(orders.map(o => ids.filter(id => !o.includes(id)).join(','))).size).toBeGreaterThan(1)
    expect(new Set(orders.map(o => o.join(','))).size).toBeGreaterThan(1)
    const game = createGame(DUEL_CONFIG, 7)
    expect(game.publicObjectives).toEqual([game.objectiveOrder[0]])
  })
  it('R7: scoreable lists revealed, fulfilled and unscored objectives plus both mandates', () => {
    const base = toActionPhase()
    const revealed = base.publicObjectives[0]
    const s = deepFreeze({
      ...withPlayer(base, 0, { spaceCombatWins: 1, trades: 3, resourcesSpentThisRound: 6 }),
      mecatolCombatWinner: 0 as const,
      publicObjectives: ['win_space_combat', 'trade_three_times'],
    })
    expect(revealed).toBeTruthy()
    expect(scoreable(s, 0)).toEqual(['win_space_combat', 'trade_three_times', FIRST_STRIKE.id])
    expect(scoreable(withPlayer(s, 0, {
      scoredObjectives: ['win_space_combat', 'trade_three_times'], scoredMandates: [FIRST_STRIKE.id],
    }), 0)).toEqual([])
    expect(scoreable(s, 1)).toEqual([])
  })
  it('R7: scoring records the objective and adds one victory point', () => {
    const s = deepFreeze({ ...toActionPhase(), publicObjectives: ['win_space_combat'] })
    const scored = scoreObjective(s, 0, 'win_space_combat')
    expect(scored.players[0].vp).toBe(1)
    expect(scored.players[0].scoredObjectives).toEqual(['win_space_combat'])
    const mandate = scoreObjective(scored, 0, FOOTHOLD.id)
    expect(mandate.players[0].vp).toBe(2)
    expect(mandate.players[0].scoredMandates).toEqual([FOOTHOLD.id])
    expect(mandate.players[0].scoredObjectives).toEqual(['win_space_combat'])
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
