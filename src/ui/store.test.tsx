// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { applyMove, createGame, deriveSeed } from '../engine'
import { cardsUsed, toActionPhase } from '../engine/testUtils'
import { GameProvider, useGame } from './store'
import type { GameConfig, Session } from './store'
import type { StrategyCardId } from '../engine/types'

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

function session(state: Session['state'], clockMs: [number, number]): Session {
  return { seed: 7, minutes: 15, state, history: [], clockMs, handoff: null }
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
})
