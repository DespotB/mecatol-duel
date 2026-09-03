import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { objectiveCost } from '../data/objectives'
import { applyMove, createGame, deriveSeed, legalMoves, postDef } from '../engine'
import type { GameConfig, GameState, Move, Seat } from '../engine/types'
import { timeCost } from './format'
import { moveCount, undoable } from './history'
import { deleteGame, hasGame, newGameCode, saveClock, saveGame } from './persist'
import { gamePath, navigate } from './route'

export type { GameConfig } from '../engine/types'

/**
 * R7 and R8: the engine is time-free, so every price paid in clock time is settled here, by the side that
 * owns the clock. The move was accepted, which is what makes the debt real, and the cost is read off the
 * clock as it stood before the move. Three things charge time: an objective scored for a fraction of what is
 * left, the Vandel Bulk Tanker's layover, which pays three minutes out, and the Sarnex Time Machine Wheel's
 * time trade, which takes half. Every other move leaves the clocks alone.
 */
const ROUND_BONUS_MS = 180000
// R8: the Vandel Bulk Tanker's layover, the same three minutes, bought with a command token
const LAYOVER_BONUS_MS = 180000
const TIME_TRADE_FRACTION = 0.5

function clockAfter(before: GameState, move: Move, seat: Seat, clockMs: [number, number]): [number, number] {
  const out: [number, number] = [clockMs[0], clockMs[1]]
  if (move.type === 'status') {
    for (const request of move.params.score ?? []) {
      const cost = objectiveCost(request.objectiveId)
      if (cost?.kind === 'time') out[seat] = Math.max(0, out[seat] - timeCost(out[seat], cost.fraction))
    }
    return out
  }
  if (move.type === 'postAbility') {
    const ability = postDef(before, move.post).ability
    if (ability === 'layover') out[seat] = out[seat] + LAYOVER_BONUS_MS
    if (ability === 'timeTrade') out[seat] = Math.max(0, out[seat] - timeCost(out[seat], TIME_TRADE_FRACTION))
  }
  return out
}

/** The turn is spent and nothing free is left: only ending it remains, so the UI does not ask. */
function onlyEndTurn(state: GameState): boolean {
  const moves = legalMoves(state)
  return moves.length === 1 && moves[0].type === 'endTurn'
}

const TICK_MS = 100
/** How often the running clock is written on its own; a reload can then cost at most this much. */
const CLOCK_SAVE_MS = 2000

export interface Session {
  /** The six-character code this game is stored and addressed under; it never changes. */
  code: string
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
  /** Whether the active seat's clock is ticking right now; the top bar labels the clocks from it. */
  clockRunning: boolean
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

  // keyed on the game state alone: the clock ticks ten times a second and must not re-enumerate the moves
  const state = session?.state ?? null
  const legal = useMemo(() => state ? legalMoves(state) : [], [state])

  const start = useCallback((config: GameConfig, seed: number, minutes: number) => {
    const ms = minutes * 60000
    const code = newGameCode(hasGame)
    roundRef.current = 1
    setError(null)
    setSession({ code, seed, minutes, state: createGame(config, seed), history: [], clockMs: [ms, ms], handoff: null })
    // the URL names the game from the first move on, so the code and the address cannot drift apart
    navigate(gamePath(code))
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
    let next = result.value
    // R3.2: an action ends the action, not the turn, so the player can still take a free move such as a
    // trade post sale. When nothing free is open, ending the turn is the only thing left and asking for a
    // click (in hot-seat: a device handoff) buys nothing, so the engine's own verdict decides it here.
    // A free move is the player's own detour, so it never ends the turn behind their back: after a trade
    // or a post's special ability they press End turn themselves.
    const free = move.type === 'tradePost' || move.type === 'postAbility'
    while (!free && next.winner === null && onlyEndTurn(next)) {
      const ended = applyMove(next, { type: 'endTurn' }, deriveSeed(session.seed, moveCount(next)))
      if (!ended.ok) break
      next = ended.value
    }
    const keep = undoable(session.state, next)
    setError(null)
    setSession({
      ...session,
      state: next,
      clockMs: clockAfter(session.state, move, session.state.active, session.clockMs),
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

  // R7: abandoning drops this one game, never the other games the browser holds
  const abandon = useCallback(() => {
    if (session) deleteGame(session.code)
    roundRef.current = null
    setError(null)
    setSession(null)
  }, [session])

  // Keyed on the game itself, not on the session object: a clock tick makes a new session every 100ms and
  // must not serialise the whole state into localStorage ten times a second. The callback that runs is the
  // one from the render whose state or history changed, so the clock it writes is current.
  const history = session?.history ?? null
  useEffect(() => {
    if (session) saveGame(session)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, history])

  // R6: the clock runs for whichever seat has something to decide, in every phase. Picking a strategy card
  // or distributing status tokens is a turn like any other, so a player cannot hold the other one hostage
  // by sitting on a draft pick. `legal` is memoised on the state, so this costs no enumeration per tick.
  const running = session !== null && session.state.winner === null && session.handoff === null && legal.length > 0
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

  // R6: the clock on its own, written every few seconds while it runs. The whole game is only written when
  // a move changes it, so without this a reload would refund the thinking time since the last move.
  const code = session?.code ?? null
  const clockMs = session?.clockMs ?? null
  const clockRef = useRef<[number, number] | null>(null)
  clockRef.current = clockMs
  useEffect(() => {
    if (!ticking || !running || code === null) return
    const id = setInterval(() => {
      if (clockRef.current) saveClock(code, clockRef.current)
    }, CLOCK_SAVE_MS)
    return () => {
      clearInterval(id)
      if (clockRef.current) saveClock(code, clockRef.current)
    }
  }, [ticking, running, code])

  // R6: at zero the player passes automatically; while passing is illegal (another phase, an unused strategy
  // card, an open secondary window, a running tactical action) the clock stays at zero until it becomes legal
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
    session, legal, error, canUndo: session !== null && session.history.length > 0, clockRunning: running,
    start, resume, apply, undo, dismissHandoff, abandon,
  }), [session, legal, error, running, start, resume, apply, undo, dismissHandoff, abandon])

  return <GameContext.Provider value={store}>{children}</GameContext.Provider>
}
