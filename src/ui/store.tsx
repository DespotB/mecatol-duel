import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { applyMove, createGame, deriveSeed, legalMoves } from '../engine'
import type { GameConfig, GameState, Move, Seat } from '../engine/types'
import { moveCount, undoable } from './history'

export type { GameConfig } from '../engine/types'

const TICK_MS = 100
// R6: a player whose clock ran out gets three more minutes at the start of every later round
const ROUND_BONUS_MS = 180000

export interface Session {
  seed: number
  minutes: number
  state: GameState
  history: GameState[]
  clockMs: [number, number]
  handoff: Seat | null
}

export interface GameStore {
  session: Session | null
  legal: Move[]
  error: string | null
  canUndo: boolean
  start(config: GameConfig, seed: number, minutes: number): void
  resume(session: Session): void
  apply(move: Move): boolean
  undo(): void
  dismissHandoff(): void
  abandon(): void
}

const GameContext = createContext<GameStore | null>(null)

export function useGame(): GameStore {
  const store = useContext(GameContext)
  if (!store) throw new Error('useGame must be used inside a GameProvider')
  return store
}

export function GameProvider({ children, ticking = true }: { children: ReactNode; ticking?: boolean }) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const roundRef = useRef<number | null>(null)

  const legal = useMemo(() => session ? legalMoves(session.state) : [], [session])

  const start = useCallback((config: GameConfig, seed: number, minutes: number) => {
    const ms = minutes * 60000
    roundRef.current = 1
    setError(null)
    setSession({ seed, minutes, state: createGame(config, seed), history: [], clockMs: [ms, ms], handoff: null })
  }, [])

  const resume = useCallback((next: Session) => {
    roundRef.current = next.state.round
    setError(null)
    setSession(next)
  }, [])

  const apply = useCallback((move: Move): boolean => {
    if (!session) return false
    const result = applyMove(session.state, move, deriveSeed(session.seed, moveCount(session.state)))
    if (!result.ok) {
      setError(result.error)
      return false
    }
    const next = result.value
    const keep = undoable(session.state, next)
    setError(null)
    setSession({
      ...session,
      state: next,
      history: keep ? [...session.history, session.state] : [],
      handoff: next.active !== session.state.active && next.winner === null ? next.active : null,
    })
    return true
  }, [session])

  const undo = useCallback(() => {
    if (!session || session.history.length === 0) return
    const previous = session.history[session.history.length - 1]
    setError(null)
    setSession({ ...session, state: previous, history: session.history.slice(0, -1), handoff: null })
  }, [session])

  const dismissHandoff = useCallback(() => {
    setSession(prev => prev ? { ...prev, handoff: null } : prev)
  }, [])

  const abandon = useCallback(() => {
    roundRef.current = null
    setError(null)
    setSession(null)
  }, [])

  // R6: the clock runs only for the seat to act, and only during the action phase
  const running = session !== null && session.state.phase === 'action' && session.state.winner === null && session.handoff === null
  const seat = session ? session.state.active : 0
  useEffect(() => {
    if (!ticking || !running) return
    const id = setInterval(() => {
      setSession(prev => {
        if (!prev) return prev
        const clockMs: [number, number] = [prev.clockMs[0], prev.clockMs[1]]
        clockMs[seat] = Math.max(0, clockMs[seat] - TICK_MS)
        return { ...prev, clockMs }
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [ticking, running, seat])

  // R6: at zero the player passes automatically; while passing is illegal (an unused strategy card, an open
  // secondary window, a running tactical action) the clock simply stays at zero until it becomes legal
  useEffect(() => {
    if (!session || !running) return
    if (session.clockMs[session.state.active] > 0) return
    if (legal.some(m => m.type === 'pass')) apply({ type: 'pass' })
  }, [session, running, legal, apply])

  // R6: three extra minutes for a flagged player at the start of every later round
  useEffect(() => {
    if (!session) return
    if (roundRef.current === session.state.round) return
    roundRef.current = session.state.round
    setSession(prev => prev ? {
      ...prev,
      clockMs: [prev.clockMs[0] || ROUND_BONUS_MS, prev.clockMs[1] || ROUND_BONUS_MS],
    } : prev)
  }, [session])

  const store: GameStore = useMemo(() => ({
    session, legal, error, canUndo: session !== null && session.history.length > 0,
    start, resume, apply, undo, dismissHandoff, abandon,
  }), [session, legal, error, start, resume, apply, undo, dismissHandoff, abandon])

  return <GameContext.Provider value={store}>{children}</GameContext.Provider>
}
