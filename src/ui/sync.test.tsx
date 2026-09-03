// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGame } from './store'
import { playerId, writeClaim } from './persist'
import type { ReactNode } from 'react'
import type { GameConfig, Move } from '../engine/types'
import type { OnlineMove, Transport } from '../net/online'

/** The store reaches for the transport as a module singleton, so the double is installed the same way. */
const wire = vi.hoisted(() => {
  const calls: { create: unknown[]; append: unknown[][] } = { create: [], append: [] }
  let listener: ((move: OnlineMove) => void) | null = null
  let accept = true
  const transport: Transport = {
    create: (...args) => { calls.create.push(args); return Promise.resolve() },
    claim: () => Promise.resolve(true),
    append: (...args) => { calls.append.push(args); return Promise.resolve(accept) },
    load: () => Promise.resolve(null),
    watch: (_code, onMove) => { listener = onMove; return () => { listener = null } },
  }
  return {
    transport, calls,
    deliver: (move: OnlineMove) => { listener?.(move) },
    watching: () => listener !== null,
    refuse: () => { accept = false },
    reset: () => { calls.create = []; calls.append = []; listener = null; accept = true },
  }
})
vi.mock('../net/online', () => ({ transport: wire.transport, onlineAvailable: () => true }))

const CONFIG: GameConfig = {
  players: [
    { faction: 'l1z1x', color: 'blue', name: 'Ada' },
    { faction: 'letnev', color: 'red', name: 'Bo' },
  ],
  speaker: 0,
}
const SEED = 4242
const FIRST: Move = { type: 'pickStrategyCard', card: 'warfare' }
const SECOND: Move = { type: 'pickStrategyCard', card: 'leadership' }

function wrapper({ children }: { children: ReactNode }) {
  return <GameProvider ticking={false}>{children}</GameProvider>
}

beforeEach(() => { window.localStorage.clear(); wire.reset() })
afterEach(() => { vi.restoreAllMocks() })

describe('a game played across two browsers', () => {
  it('writes the game to the server when the host takes one seat', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    act(() => { result.current.start(CONFIG, SEED, 15, [0]) })
    expect(wire.calls.create).toHaveLength(1)
    const [game, player, seat] = wire.calls.create[0] as [{ code: string; seed: number }, string, number]
    expect(game.seed).toBe(SEED)
    expect(player).toBe(playerId())
    expect(seat).toBe(0)
  })

  it('keeps a hot-seat game off the wire entirely', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    act(() => { result.current.start(CONFIG, SEED, 15) })
    expect(wire.calls.create).toHaveLength(0)
    expect(wire.watching()).toBe(false)
  })

  it('sends each move it makes as the next number in the log', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    act(() => { result.current.start(CONFIG, SEED, 15, [0]) })
    act(() => { result.current.apply(FIRST) })
    expect(wire.calls.append).toHaveLength(1)
    const [code, player, seat, n, move] = wire.calls.append[0] as [string, string, number, number, Move]
    expect(code).toBe(result.current.session?.code)
    expect(player).toBe(playerId())
    expect(seat).toBe(0)
    expect(n).toBe(0)
    expect(move).toEqual(FIRST)
  })

  it('applies the opponent move that arrives over the wire', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    act(() => { result.current.start(CONFIG, SEED, 15, [0]) })
    act(() => { result.current.apply(FIRST) })
    const before = result.current.session?.state
    act(() => { wire.deliver({ n: 1, seat: 1, move: SECOND }) })
    expect(result.current.session?.state).not.toBe(before)
    expect(result.current.error).toBeNull()
  })

  /** The subscription hears this browser's own moves too; applying them twice would fork the board. */
  it('drops a move it has already accounted for', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    act(() => { result.current.start(CONFIG, SEED, 15, [0]) })
    act(() => { result.current.apply(FIRST) })
    const after = result.current.session?.state
    act(() => { wire.deliver({ n: 0, seat: 0, move: FIRST }) })
    expect(result.current.session?.state).toBe(after)
  })

  it('says so rather than guessing when a move arrives out of order', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    act(() => { result.current.start(CONFIG, SEED, 15, [0]) })
    act(() => { wire.deliver({ n: 4, seat: 1, move: SECOND }) })
    expect(result.current.error).toContain('moved on without you')
  })

  it('reports a refused move instead of leaving the boards apart in silence', async () => {
    wire.refuse()
    const { result } = renderHook(() => useGame(), { wrapper })
    act(() => { result.current.start(CONFIG, SEED, 15, [0]) })
    await act(async () => {
      result.current.apply(FIRST)
      await Promise.resolve()
    })
    expect(result.current.error).toContain('did not reach the game')
  })

  it('locks the seat this browser does not hold, wire or no wire', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    act(() => { result.current.start(CONFIG, SEED, 15, [1]) })
    // seat 0 opens the strategy phase, and this browser holds seat 1
    expect(result.current.canAct).toBe(false)
    act(() => { result.current.apply(FIRST) })
    expect(wire.calls.append).toHaveLength(0)
  })
})

/** Guards the one thing the mode question decides: both seats means nothing goes out on the wire. */
describe('the claim decides whether a game is online at all', () => {
  it('treats a resumed one-seat claim as an online game', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    writeClaim('ABCDEF', { seats: [1], playerId: playerId() })
    act(() => { result.current.start(CONFIG, SEED, 15, [1]) })
    expect(wire.watching()).toBe(true)
  })
})
