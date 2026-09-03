import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { deepFreeze, toActionPhase, withCards, withExhausted, withPlanetOwner, withPlayer } from './testUtils'
import type { GameState, Result, StrategicParams, StrategyCardId } from './types'

const play = (state: GameState, card: StrategyCardId, params?: StrategicParams) =>
  applyMove(deepFreeze(state), { type: 'strategic', card, params }, 0)
const answer = (state: GameState, card: StrategyCardId, accept: boolean, params?: StrategicParams) =>
  applyMove(deepFreeze(state), { type: 'secondary', card, accept, params }, 0)
const value = (r: Result<GameState>): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.value
}

/** Seat 0 holds the card and is active, seat 1 answers; both keep the printed 3/3/2 command sheet. */
function holder(card: StrategyCardId): GameState {
  return withCards(withCards(toActionPhase(), 1, []), 0, [card])
}

describe('R3.2 strategic actions', () => {
  it('R3.2: the primary marks the card used, opens the secondary window and hands over the turn', () => {
    const s = holder('trade')
    const played = value(play(s, 'trade'))
    expect(played.players[0].strategyCards).toEqual([{ id: 'trade', used: true }])
    expect(played.pendingSecondary).toBe('trade')
    expect(played.active).toBe(1)
    expect(s.players[0].strategyCards[0].used).toBe(false)        // input not mutated
  })
  it('R3.2: nothing else happens while a secondary window is open', () => {
    const played = value(play(holder('trade'), 'trade'))
    expect(applyMove(played, { type: 'startTactical', systemId: 'bereg' }, 0).ok).toBe(false)
    expect(applyMove(played, { type: 'pass' }, 0).ok).toBe(false)
    expect(applyMove(played, { type: 'strategic', card: 'warfare' }, 0).ok).toBe(false)
    const done = value(answer(played, 'trade', false))
    expect(done.pendingSecondary).toBeNull()
    expect(done.active).toBe(1)                                   // the answering seat now takes its own turn
  })
  it('R3.2: a passed opponent still answers, and the turn goes back to the card holder', () => {
    const s = withPlayer(holder('trade'), 1, { passed: true, strategyCards: [] })
    const done = value(answer(value(play(s, 'trade')), 'trade', false))
    expect(done.active).toBe(0)
  })
  it('R3.2: only the holder plays a card, only once, and only the opponent answers', () => {
    const s = holder('trade')
    expect(play(s, 'warfare').ok).toBe(false)                     // seat 0 does not hold it
    const played = value(play(s, 'trade'))
    expect(answer({ ...played, active: 0 }, 'trade', true).ok).toBe(false)
    const done = value(answer(played, 'trade', false))
    expect(play({ ...done, active: 0 }, 'trade').ok).toBe(false)  // already used
    expect(answer(done, 'trade', false).ok).toBe(false)           // window closed
  })
  it('R6 Leadership primary: 3 command tokens plus 1 for every 3 influence spent', () => {
    let s = holder('leadership')
    s = withPlanetOwner(s, 'bereg', 'lirta-iv', 0)                // influence 3
    s = withPlanetOwner(s, 'starpoint', 'centauri', 0)            // influence 3
    const played = value(play(s, 'leadership', { planets: ['lirta-iv', 'centauri'], tokens: { tactic: 6, fleet: 4, strategy: 3 } }))
    expect(played.players[0].tokens).toEqual({ tactic: 6, fleet: 4, strategy: 3 })   // 8 + 3 + 2
    expect(played.systems.bereg.planets.find(p => p.id === 'lirta-iv')?.exhausted).toBe(true)
    expect(value(play(s, 'leadership')).players[0].tokens).toEqual({ tactic: 6, fleet: 3, strategy: 2 })
  })
  it('R6 Leadership: the distribution takes exactly the new tokens and never moves old ones', () => {
    const s = holder('leadership')
    expect(play(s, 'leadership', { tokens: { tactic: 4, fleet: 4, strategy: 2 } }).ok).toBe(false)   // 10, not 11
    expect(play(s, 'leadership', { tokens: { tactic: 2, fleet: 4, strategy: 5 } }).ok).toBe(false)   // tactic below 3
    expect(play(s, 'leadership', { tokens: { tactic: 3, fleet: 3, strategy: 5 } }).ok).toBe(true)
    expect(play(s, 'leadership', { planets: ['arc-prime'] }).ok).toBe(false)                          // not controlled
  })
  it('R6 Leadership secondary: 1 token per 3 influence and no strategy token cost', () => {
    let s = holder('leadership')
    s = withPlanetOwner(s, 'bereg', 'lirta-iv', 1)
    const answered = value(answer(value(play(s, 'leadership')), 'leadership', true, { planets: ['lirta-iv'] }))
    expect(answered.players[1].tokens).toEqual({ tactic: 4, fleet: 3, strategy: 2 })
    expect(answered.systems.bereg.planets.find(p => p.id === 'lirta-iv')?.exhausted).toBe(true)
  })
  it('R6 Diplomacy errata primary: the opponent gets a command token there, up to 2 planets are readied', () => {
    const s = withExhausted(holder('diplomacy'), ['000'])
    const played = value(play(s, 'diplomacy', { systemId: 'home-n', planets: ['000'] }))
    expect(played.systems['home-n'].activatedBy).toEqual([1])
    expect(played.systems['home-n'].planets[0].exhausted).toBe(false)
    const done = value(answer(played, 'diplomacy', false))
    expect(applyMove(done, { type: 'startTactical', systemId: 'home-n' }, 0).ok).toBe(false)   // seat 1 is blocked there
    expect(applyMove(done, { type: 'startTactical', systemId: 'quann' }, 0).ok).toBe(true)
  })
  it('R6 Diplomacy: not Mecatol Rex, only a system with a planet you control, at most 2 planets', () => {
    const s = withExhausted(holder('diplomacy'), ['000'])
    expect(play(s, 'diplomacy', { systemId: 'mecatol' }).ok).toBe(false)
    expect(play(s, 'diplomacy', { systemId: 'quann' }).ok).toBe(false)
    expect(play(s, 'diplomacy', {}).ok).toBe(false)
    expect(play(s, 'diplomacy', { systemId: 'home-n', planets: ['000', '000', '000'] }).ok).toBe(false)
    expect(play(withExhausted(s, ['000'], false), 'diplomacy', { systemId: 'home-n', planets: ['000'] }).ok).toBe(false)
  })
  it('R3.2/R6 Diplomacy: with no eligible system the primary is still playable', () => {
    let s = withExhausted(holder('diplomacy'), ['000'])
    s = withPlanetOwner(s, 'home-n', '000', null)                 // seat 0 controls nothing but Mecatol Rex
    s = withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0)
    const played = value(play(s, 'diplomacy', {}))
    expect(played.pendingSecondary).toBe('diplomacy')
    expect(played.systems.mecatol.activatedBy).toEqual([])        // Mecatol Rex is never chosen
    expect(play(s, 'diplomacy', { systemId: 'mecatol' }).ok).toBe(false)
  })
  it('R6 Diplomacy secondary: a strategy token readies up to 2 exhausted planets you control', () => {
    const s = withExhausted(holder('diplomacy'), ['000', 'arc-prime', 'wren-terra'])
    const played = value(play(s, 'diplomacy', { systemId: 'home-n' }))
    const answered = value(answer(played, 'diplomacy', true, { planets: ['arc-prime', 'wren-terra'] }))
    expect(answered.players[1].tokens.strategy).toBe(1)
    expect(answered.systems['home-s'].planets.map(p => p.exhausted)).toEqual([false, false])   // both named planets
    expect(answer(withPlayer(played, 1, { tokens: { tactic: 3, fleet: 3, strategy: 0 } }), 'diplomacy', true, { planets: ['arc-prime'] }).ok).toBe(false)
  })
  it('R6 Trade primary: 3 trade goods, commodities replenished, the opponent may replenish too', () => {
    const s = withPlayer(withPlayer(holder('trade'), 0, { commodities: 0 }), 1, { commodities: 0 })
    const alone = value(play(s, 'trade'))
    expect(alone.players[0]).toMatchObject({ tradeGoods: 3, commodities: 2 })
    expect(alone.players[1].commodities).toBe(0)
    const shared = value(play(s, 'trade', { shareWithOpponent: true }))
    expect(shared.players[1].commodities).toBe(2)
  })
  it('R6 Trade secondary: a strategy token replenishes commodities', () => {
    const s = withPlayer(holder('trade'), 1, { commodities: 0 })
    const answered = value(answer(value(play(s, 'trade')), 'trade', true))
    expect(answered.players[1]).toMatchObject({ commodities: 2, tokens: { tactic: 3, fleet: 3, strategy: 1 } })
  })
})
