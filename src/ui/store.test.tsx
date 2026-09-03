// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import * as engine from '../engine'
import { applyMove, createGame, deriveSeed } from '../engine'
import { cardsUsed, toActionPhase, toStatusPhase, withPlanetOwner, withPlayer } from '../engine/testUtils'
import { playerId, readClaim, writeClaim } from './persist'
import { GameProvider, useGame } from './store'
import type { PostId } from '../data/posts'
import type { GameConfig, Session } from './store'
import type { Seat, StrategyCardId } from '../engine/types'

const CONFIG: GameConfig = {
  players: [
    { faction: 'l1z1x', color: 'blue', name: 'North' },
    { faction: 'letnev', color: 'red', name: 'South' },
  ],
  speaker: 0,
}

function wrapper(ticking: boolean) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <GameProvider ticking={ticking}>{children}</GameProvider>
  }
}

function session(state: Session['state'], clockMs: [number, number], handoff: Seat | null = null): Session {
  return { code: 'TESTAA', seed: 7, minutes: 15, state, history: [], clockMs, handoff }
}

describe('the hot-seat store', () => {
  it('starts a game and enumerates the legal picks', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    expect(result.current.session?.state.phase).toBe('strategy')
    expect(result.current.legal).toHaveLength(6)
    expect(result.current.legal.every(m => m.type === 'pickStrategyCard')).toBe(true)
    expect(result.current.session?.clockMs).toEqual([900000, 900000])
  })

  it('applies moves with a seed derived from the game seed and the move index', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    act(() => { result.current.apply({ type: 'pickStrategyCard', card: 'leadership' }) })
    const expected = applyMove(createGame(CONFIG, 7), { type: 'pickStrategyCard', card: 'leadership' }, deriveSeed(7, 0))
    expect(expected.ok).toBe(true)
    if (!expected.ok) return
    expect(result.current.session?.state).toEqual(expected.value)
  })

  it('reports the engine error and keeps the state on an illegal move', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    const before = result.current.session?.state
    act(() => { result.current.apply({ type: 'pass' }) })
    expect(result.current.session?.state).toBe(before)
    expect(result.current.error).toContain('not in the action phase')
  })

  it('undoes a move inside the same turn and clears the stack when the turn passes', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    for (const card of ['leadership', 'trade', 'technology', 'warfare'] as StrategyCardId[]) {
      act(() => { result.current.apply({ type: 'pickStrategyCard', card }) })
      // the snake draft has seat 1 pick twice in a row (trade, right after leadership); same seat, still
      // the strategy phase, so that pick alone is still undoable
      if (card === 'trade') expect(result.current.canUndo).toBe(true)
    }
    expect(result.current.session?.state.phase).toBe('action')
    expect(result.current.session?.state.active).toBe(0)      // leadership is initiative 1
    expect(result.current.canUndo).toBe(false)                // warfare closed the strategy phase: undo never crosses a phase boundary
    act(() => { result.current.apply({ type: 'startTactical', systemId: 'bereg' }) })
    expect(result.current.session?.state.players[0].tokens.tactic).toBe(2)
    expect(result.current.canUndo).toBe(true)
    act(() => { result.current.undo() })
    expect(result.current.session?.state.players[0].tokens.tactic).toBe(3)
    expect(result.current.session?.state.tactical).toBeNull()
    expect(result.current.canUndo).toBe(false)
  })

  it('flags the handoff when the seat to act changes', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    act(() => { result.current.apply({ type: 'pickStrategyCard', card: 'leadership' }) })
    expect(result.current.session?.handoff).toBe(1)
    act(() => { result.current.dismissHandoff() })
    expect(result.current.session?.handoff).toBeNull()
  })

  it('R6: the clock runs for the active seat and passes automatically at zero', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(true) })
    act(() => { result.current.resume(session(cardsUsed(toActionPhase()), [1000, 60000])) })
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.session?.clockMs[0]).toBe(500)
    expect(result.current.session?.clockMs[1]).toBe(60000)
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.session?.clockMs[0]).toBe(0)
    expect(result.current.session?.state.players[0].passed).toBe(true)
    expect(result.current.session?.state.active).toBe(1)
    vi.useRealTimers()
  })

  it('R6: the clock runs in the strategy phase as well, so nobody can stall the draft', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(true) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    expect(result.current.session?.state.phase).toBe('strategy')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.session?.clockMs[0]).toBe(899000)
    expect(result.current.session?.clockMs[1]).toBe(900000)
    vi.useRealTimers()
  })

  it('R6: the clock runs in the status phase for the seat that has to submit', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(true) })
    act(() => { result.current.resume(session(toStatusPhase(toActionPhase()), [60000, 60000])) })
    expect(result.current.session?.state.phase).toBe('status')
    const seat = result.current.session?.state.active ?? 0
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.session?.clockMs[seat]).toBe(59000)
    expect(result.current.session?.clockMs[seat === 0 ? 1 : 0]).toBe(60000)
    vi.useRealTimers()
  })

  it('R7: the store takes a fifth of the seat\'s clock for the objective that is paid in time', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    const state = { ...toStatusPhase(toActionPhase()), publicObjectives: ['pay_time_20'] }
    act(() => { result.current.resume(session(state, [865000, 900000])) })
    expect(result.current.session?.state.active).toBe(0)
    act(() => {
      result.current.apply({ type: 'status', params: { tokens: { tactic: 5, fleet: 3, strategy: 2 }, score: [{ objectiveId: 'pay_time_20' }] } })
    })
    expect(result.current.session?.state.players[0].vp).toBe(1)
    // 14:25 left, a fifth of it is 2:53, rounded down to the second; the other clock is untouched
    expect(result.current.session?.clockMs).toEqual([692000, 900000])
  })

  it('R7: an objective paid in resources costs resources, never a second off the clock', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    const base = withPlayer(toStatusPhase(toActionPhase()), 0, { tradeGoods: 1 })
    act(() => { result.current.resume(session({ ...base, publicObjectives: ['pay_6_resources'] }, [865000, 900000])) })
    act(() => {
      result.current.apply({
        type: 'status',
        params: { tokens: { tactic: 5, fleet: 3, strategy: 2 }, score: [{ objectiveId: 'pay_6_resources', planets: ['000'], tradeGoods: 1 }] },
      })
    })
    expect(result.current.session?.state.players[0].vp).toBe(1)
    expect(result.current.session?.state.players[0].tradeGoods).toBe(0)
    expect(result.current.session?.clockMs).toEqual([865000, 900000])
  })

  it('R6: the clock stops while the handoff overlay is up and once the game is over', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(true) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    act(() => { result.current.apply({ type: 'pickStrategyCard', card: 'leadership' }) })
    expect(result.current.session?.handoff).toBe(1)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.session?.clockMs[1]).toBe(900000)
    act(() => { result.current.dismissHandoff() })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.session?.clockMs[1]).toBe(899000)
    vi.useRealTimers()
  })

  it('R6: a clock at zero holds while passing is illegal', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(true) })
    // two unused strategy cards, so `pass` is not among the legal moves
    act(() => { result.current.resume(session(toActionPhase(), [0, 60000])) })
    expect(result.current.legal.some(m => m.type === 'pass')).toBe(false)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.session?.clockMs[0]).toBe(0)
    expect(result.current.session?.state.players[0].passed).toBe(false)
    expect(result.current.session?.state.active).toBe(0)
    vi.useRealTimers()
  })

  it('R6: a player at zero gets three more minutes at the start of the next round', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(toStatusPhase(toActionPhase()), [0, 60000])) })
    expect(result.current.session?.state.round).toBe(1)
    for (let seat = 0; seat < 2; seat += 1) {
      const move = result.current.legal.find(m => m.type === 'status')
      expect(move).toBeTruthy()
      if (move) act(() => { result.current.apply(move) })
    }
    expect(result.current.session?.state.round).toBe(2)
    expect(result.current.session?.clockMs[0]).toBe(180000)   // the flagged player is topped up
    expect(result.current.session?.clockMs[1]).toBe(60000)    // the other clock is untouched
  })

  it('R6: a clock tick neither re-enumerates the moves nor rewrites the saved game', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(true) })
    act(() => { result.current.resume(session(cardsUsed(toActionPhase()), [60000, 60000])) })
    const enumerate = vi.spyOn(engine, 'legalMoves')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.session?.clockMs[0]).toBe(59000)      // the clock still runs
    expect(enumerate).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    // a real move still enumerates and still saves
    act(() => { result.current.apply({ type: 'pass' }) })
    expect(enumerate).toHaveBeenCalled()
    expect(write).toHaveBeenCalled()
    enumerate.mockRestore()
    write.mockRestore()
    vi.useRealTimers()
  })

  /** R8: seat 0 on turn, holding Sakulag, with the named post in play on the west side. */
  function atWestPost(post: PostId) {
    const base = withPlanetOwner(toActionPhase(1, 0), 'sakulag', 'sakulag', 0)
    return { ...base, posts: { west: post, east: 'tessik' as PostId }, postAbilityUsed: { west: false, east: false } }
  }

  it('R8: a layover adds three minutes to the acting seat and leaves the other clock alone', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(atWestPost('vandel'), [600000, 500000])) })
    act(() => { result.current.apply({ type: 'postAbility', post: 'west', params: { pool: 'fleet' } }) })
    expect(result.current.session?.clockMs[0]).toBe(780000)
    expect(result.current.session?.clockMs[1]).toBe(500000)
  })

  it('R8: a time trade takes half the acting seat\'s clock, and the victory point comes from the engine', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(atWestPost('sarnex'), [601500, 500000])) })
    act(() => { result.current.apply({ type: 'postAbility', post: 'west', params: {} }) })
    // half of ten minutes and a second and a half, rounded down to the second
    expect(result.current.session?.clockMs[0]).toBe(301500)
    expect(result.current.session?.state.players[0].vp).toBe(1)
  })

  it('R8: every other post ability leaves both clocks where they were', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(atWestPost('kesh'), [600000, 500000])) })
    act(() => { result.current.apply({ type: 'postAbility', post: 'west', params: { pool: 'fleet' } }) })
    expect(result.current.session?.state.players[0].tradeGoods).toBe(4)
    expect(result.current.session?.clockMs).toEqual([600000, 500000])
  })

  it('R8: a post ability is final, so the clock cannot be farmed by undoing it', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(atWestPost('vandel'), [600000, 500000])) })
    act(() => { result.current.apply({ type: 'postAbility', post: 'west', params: { pool: 'fleet' } }) })
    expect(result.current.canUndo).toBe(false)
  })
})

describe('the store and the seat claim', () => {
  /** Claims the given seats for this browser on the harness game, the way the mode question would. */
  function claim(seats: Seat[]): void {
    writeClaim('TESTAA', { seats, playerId: playerId() })
  }

  it('claims both seats for the game it starts, so the host is never asked the question', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    const code = result.current.session?.code ?? ''
    expect(readClaim(code, playerId())).toEqual({ seats: [0, 1], playerId: playerId() })
    expect(result.current.seats).toEqual([0, 1])
    expect(result.current.canAct).toBe(true)
  })

  it('claims the one seat the host picked when the lobby starts an online game', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    act(() => { result.current.start(CONFIG, 7, 15, [1]) })
    const code = result.current.session?.code ?? ''
    expect(readClaim(code, playerId())).toEqual({ seats: [1], playerId: playerId() })
    expect(result.current.seats).toEqual([1])
  })

  it('reads the claim of the game it resumes and holds only that seat', () => {
    claim([1])
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(cardsUsed(toActionPhase()), [60000, 60000])) })
    expect(result.current.seats).toEqual([1])
    expect(result.current.canAct).toBe(false)          // seat 0 is the one to act
  })

  it('refuses a move for a seat the claim does not hold, without bothering the engine', () => {
    claim([1])
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(cardsUsed(toActionPhase()), [60000, 60000])) })
    const before = result.current.session?.state
    act(() => { result.current.apply({ type: 'pass' }) })
    expect(result.current.session?.state).toBe(before)
    expect(result.current.error).toBeNull()
  })

  it('lets the claimed seat act, and asks for no interstitial once the turn is the other one\'s', () => {
    claim([1])
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(cardsUsed(toActionPhase(1, 1)), [60000, 60000])) })
    expect(result.current.canAct).toBe(true)
    act(() => { result.current.apply({ type: 'pass' }) })
    expect(result.current.session?.state.players[1].passed).toBe(true)
    expect(result.current.session?.state.active).toBe(0)
    expect(result.current.handoffSeat).toBeNull()      // never for the seat that just moved
  })

  it('shows the interstitial for the seat the claim holds and for no other', () => {
    claim([1])
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(toActionPhase(), [60000, 60000], 1)) })
    expect(result.current.handoffSeat).toBe(1)
    act(() => { result.current.resume(session(toActionPhase(), [60000, 60000], 0)) })
    expect(result.current.handoffSeat).toBeNull()
  })

  it('leaves a watcher with no seat, no move and no interstitial', () => {
    claim([])
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(cardsUsed(toActionPhase()), [60000, 60000], 0)) })
    expect(result.current.seats).toEqual([])
    expect(result.current.canAct).toBe(false)
    expect(result.current.handoffSeat).toBeNull()
    const before = result.current.session?.state
    act(() => { result.current.apply({ type: 'pass' }) })
    expect(result.current.session?.state).toBe(before)
  })

  it('keeps undo a hot-seat courtesy: online, a move that is out is out', () => {
    claim([0])
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(toActionPhase(), [60000, 60000])) })
    act(() => { result.current.apply({ type: 'startTactical', systemId: 'bereg' }) })
    expect(result.current.canUndo).toBe(false)
    act(() => { result.current.undo() })
    expect(result.current.session?.state.tactical).not.toBeNull()
  })

  it('a board with no claim at all is the hot-seat it has always been', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.resume(session(cardsUsed(toActionPhase()), [60000, 60000], 1)) })
    expect(result.current.seats).toEqual([0, 1])
    expect(result.current.canAct).toBe(true)
    expect(result.current.handoffSeat).toBe(1)
  })

  it('R6: the clock runs on while the seat that just moved waits for the other browser', () => {
    vi.useFakeTimers()
    claim([1])
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(true) })
    act(() => { result.current.resume(session(cardsUsed(toActionPhase(1, 1)), [60000, 60000])) })
    act(() => { result.current.apply({ type: 'pass' }) })
    expect(result.current.session?.state.active).toBe(0)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.session?.clockMs[0]).toBe(59000)
    vi.useRealTimers()
  })
})
