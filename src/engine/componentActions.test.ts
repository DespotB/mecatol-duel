import { describe, expect, it } from 'vitest'
import { canShipyard, tradePostOptions } from './componentActions'
import { applyMove, legalMoves } from './index'
import { deepFreeze, toActionPhase, withCards, withExhausted, withPlanetOwner, withPlayer, withTechs } from './testUtils'
import type { GameState, Result } from './types'

const value = (r: Result<GameState>): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const inherit = (state: GameState, techId: string) => applyMove(deepFreeze(state), { type: 'research', techId, via: 'inheritance' }, 0)
const build = (state: GameState, planetId: string, planets: string[], tradeGoods = 0) =>
  applyMove(deepFreeze(state), { type: 'shipyard', planetId, planets, tradeGoods }, 0)
const sell = (state: GameState, post: 'west' | 'east', commodities: number) =>
  applyMove(deepFreeze(state), { type: 'tradePost', post, commodities }, 0)

/** Takes every space dock of the seat off the board, the precondition of the emergency shipyard. */
function withoutDocks(state: GameState, seat: 0 | 1): GameState {
  const systems = Object.fromEntries(Object.entries(state.systems).map(([id, sys]) => [id, {
    ...sys, planets: sys.planets.map(p => ({ ...p, structures: p.structures.filter(u => !(u.type === 'spacedock' && u.owner === seat)) })),
  }]))
  return deepFreeze({ ...state, systems })
}

describe('R6/R8 component actions', () => {
  it('R6: Inheritance Systems exhausts, pays 2 resources, ignores prerequisites and ends the turn', () => {
    const s = withTechs(toActionPhase(), 0, ['inheritance_systems'])
    const done = value(inherit(s, 'war_sun'))                       // red 3 and yellow 1 are missing
    expect(done.players[0].techs).toContain('war_sun')
    expect(done.players[0].inheritanceExhausted).toBe(true)
    expect(done.systems['home-n'].planets[0].exhausted).toBe(true)  // [0.0.0] is the only ready planet
    expect(done.active).toBe(1)
    expect(inherit({ ...done, active: 0 }, 'sarween_tools').ok).toBe(false)   // the card stays exhausted this round
  })
  it('R6: without the technology, without resources or with a known technology the action is illegal', () => {
    expect(inherit(toActionPhase(), 'war_sun').ok).toBe(false)      // seat 0 does not own the card
    const rich = withTechs(toActionPhase(), 0, ['inheritance_systems'])
    expect(inherit(rich, 'plasma_scoring').ok).toBe(false)          // already owned
    expect(inherit(rich, 'dreadnought_ii').ok).toBe(false)          // never available to L1Z1X
    const broke = withExhausted(rich, ['000'])                      // [0.0.0] is the only planet seat 0 controls
    expect(inherit(broke, 'sarween_tools').ok).toBe(false)          // no ready planet pays the 2 resources
  })
  it('R6: the emergency shipyard needs no space dock, a strategy token and 4 resources, once per game', () => {
    const s = withoutDocks(toActionPhase(), 0)
    expect(canShipyard(toActionPhase(), 0)).toBe(false)             // a dock still stands on [0.0.0]
    expect(canShipyard(s, 0)).toBe(true)
    const done = value(build(s, '000', ['000']))
    expect(done.systems['home-n'].planets[0].structures.some(u => u.type === 'spacedock' && u.owner === 0)).toBe(true)
    expect(done.players[0]).toMatchObject({ shipyardUsed: true, tokens: { tactic: 3, fleet: 3, strategy: 1 } })
    expect(done.systems['home-n'].planets[0].exhausted).toBe(true)
    expect(done.active).toBe(1)
    expect(canShipyard(done, 0)).toBe(false)
    expect(build(withPlayer(s, 0, { tokens: { tactic: 3, fleet: 3, strategy: 0 } }), '000', ['000']).ok).toBe(false)
    expect(build(s, 'arc-prime', ['000']).ok).toBe(false)           // not controlled
    expect(build(s, '000', []).ok).toBe(false)                      // 0 of 4 resources
  })
  it('R8: a trade post sells up to 2 commodities 1:1 and does not end the turn', () => {
    const base = toActionPhase()
    expect(tradePostOptions(base, 0)).toEqual([])                   // no planet next to a post
    const s = withPlanetOwner(base, 'bereg', 'bereg', 0)
    expect(tradePostOptions(s, 0)).toEqual(['east'])
    const done = value(sell(s, 'east', 2))
    expect(done.players[0]).toMatchObject({ commodities: 0, tradeGoods: 2, tradedThisRound: { west: false, east: true } })
    expect(done.active).toBe(0)                                     // R8: trading is free
    expect(sell(done, 'east', 1).ok).toBe(false)                    // once per round per post
    expect(sell(s, 'west', 1).ok).toBe(false)                       // no planet next to the west post
    expect(sell(s, 'east', 3).ok).toBe(false)
    expect(sell(s, 'east', 0).ok).toBe(false)
  })
  it('R3.2: component actions need your own turn with nothing else running', () => {
    const s = withTechs(withPlanetOwner(toActionPhase(), 'bereg', 'bereg', 0), 0, ['inheritance_systems'])
    const running: GameState = deepFreeze({ ...s, tactical: { systemId: 'bereg', step: 'movement' } })
    expect(inherit(running, 'war_sun').ok).toBe(false)
    expect(sell(running, 'east', 1).ok).toBe(false)
    expect(build(running, '000', ['000']).ok).toBe(false)
    const window = value(applyMove(withCards(s, 0, ['trade']), { type: 'strategic', card: 'trade' }, 0))
    expect(inherit(window, 'war_sun').ok).toBe(false)
    expect(sell(window, 'east', 1).ok).toBe(false)
    expect(build(window, '000', ['000']).ok).toBe(false)
    expect(sell(withPlayer(s, 0, { passed: true }), 'east', 1).ok).toBe(false)
  })
  it('R8: the trade post is still open after the action is spent, but never during one', () => {
    // seat 0 takes Sakulag, so the west post is linked; the tactical action then ends without passing the turn
    const s = withPlanetOwner(toActionPhase(), 'sakulag', 'sakulag', 0)
    const running: GameState = deepFreeze({ ...s, tactical: { systemId: 'bereg', step: 'done' } })
    expect(sell(running, 'west', 2).ok).toBe(false)                 // R8: not while a tactical action runs
    const spent = value(applyMove(running, { type: 'endTactical' }, 0))
    expect(spent.turnDone).toBe(true)
    const sold = value(sell(spent, 'west', 2))
    expect(sold.players[0]).toMatchObject({ commodities: 0, tradeGoods: 2 })
    expect(sold.active).toBe(0)                                     // R8: trading is free, the turn goes on
    expect(sold.turnDone).toBe(true)                                // and the action stays spent
    expect(legalMoves(spent).some(m => m.type === 'tradePost' && m.post === 'west')).toBe(true)
    expect(legalMoves(sold)).toEqual([{ type: 'endTurn' }])         // the post is used up, only the handover is left
  })
  it('R3.2: a spent turn takes no second component action', () => {
    const base = withTechs(withoutDocks(toActionPhase(), 0), 0, ['inheritance_systems'])
    const spent = value(applyMove(deepFreeze({ ...base, tactical: { systemId: 'bereg', step: 'done' } }), { type: 'endTactical' }, 0))
    const research = inherit(spent, 'war_sun')
    expect(research.ok).toBe(false)
    if (!research.ok) expect(research.error).toMatch(/already spent/)
    const build = applyMove(spent, { type: 'shipyard', planetId: '000', planets: ['000'], tradeGoods: 0 }, 0)
    expect(build.ok).toBe(false)
    if (!build.ok) expect(build.error).toMatch(/already spent/)
  })
  it('R3.2: research is rejected while a secondary window is open', () => {
    const s = withTechs(toActionPhase(), 0, ['inheritance_systems'])
    const window = value(applyMove(withCards(s, 0, ['trade']), { type: 'strategic', card: 'trade' }, 0))
    const r = inherit(window, 'war_sun')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/secondary/i)
  })
  it('R3.2: shipyard is rejected while a secondary window is open', () => {
    const s = withoutDocks(toActionPhase(), 0)
    const window = value(applyMove(withCards(s, 0, ['trade']), { type: 'strategic', card: 'trade' }, 0))
    const r = build(window, '000', ['000'])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/secondary/i)
  })
  it('R3.2: tradePost is rejected while a secondary window is open', () => {
    const s = withPlanetOwner(toActionPhase(), 'bereg', 'bereg', 0)
    const window = value(applyMove(withCards(s, 0, ['trade']), { type: 'strategic', card: 'trade' }, 0))
    const r = sell(window, 'east', 1)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/secondary/i)
  })
})
