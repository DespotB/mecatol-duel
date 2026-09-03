import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { objectiveCost } from '../data/objectives'
import { createGame, legalMoves, postDef } from '../engine'
import type { GameConfig, GameState, Move, Seat } from '../engine/types'
import { advance } from './advance'
import { transport } from '../net/online'
import { timeCost } from './format'
import { undoable } from './history'
import {
  actingSeats, deleteGame, hasGame, newGameCode, playerId, readClaim, saveClock, saveGame, writeClaim,
} from './persist'
import type { Claim } from './persist'
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
  /** The seats this browser may act for: both in hot-seat, one online, none as a watcher. */
  seats: Seat[]
  /**
   * Whether this browser holds the seat the game is waiting on. Every control that would submit a move
   * reads this one flag rather than repeating the question, and `apply` refuses what it forbids.
   */
  canAct: boolean
  /** The seat the handoff interstitial is for, or null when this browser must not be shown one. */
  handoffSeat: Seat | null
  /**
   * Starts a game and claims `seats` for this browser: both of them for hot-seat, the one the host picked
   * for an online game. The default is hot-seat because that is the game a browser can finish on its own.
   */
  start(config: GameConfig, seed: number, minutes: number, seats?: Seat[]): void
  /** `followed` is how many of the server's moves this session already accounts for; 0 for a local game. */
  resume(session: Session, followed?: number): void
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
  // what this browser may do in the open game; null until it has answered the mode question
  const [claim, setClaim] = useState<Claim | null>(null)
  const roundRef = useRef<number | null>(null)
  const seats = useMemo(() => actingSeats(claim), [claim])
  /*
   * How many moves of this game's server log this browser has accounted for, and the one number the whole
   * sync turns on. It is not `moveCount`: the log on the server holds submitted moves, while the state's
   * own log also holds the end-turns that followed from them on their own. A move arriving from the wire is
   * this browser's to apply when its number is the next one; a move whose number is already spent is this
   * browser's own coming back, and it is dropped.
   */
  const submittedRef = useRef(0)
  // a game with one claimed seat is being played across two browsers; both seats means this device holds it all
  const online = claim !== null && claim.seats.length === 1

  // keyed on the game state alone: the clock ticks ten times a second and must not re-enumerate the moves
  const state = session?.state ?? null
  const legal = useMemo(() => state ? legalMoves(state) : [], [state])

  const start = useCallback((config: GameConfig, seed: number, minutes: number, held: Seat[] = [0, 1]) => {
    const ms = minutes * 60000
    const code = newGameCode(hasGame)
    roundRef.current = 1
    setError(null)
    // the mode question is answered in the lobby now, so the host arrives here with the seats already picked
    const mine: Claim = { seats: held, playerId: playerId() }
    writeClaim(code, mine)
    setClaim(mine)
    setSession({ code, seed, minutes, state: createGame(config, seed), history: [], clockMs: [ms, ms], handoff: null })
    submittedRef.current = 0
    // An online game has to exist on the server before the link means anything, and the host takes their
    // seat in the same call. A server that cannot be reached is reported and the game stays local, which
    // is a hot-seat game with a wrong label rather than a lost one.
    if (held.length === 1 && transport !== null) {
      void transport
        .create({ code, seed, minutes, config, players: [null, null] }, playerId(), held[0])
        .catch((e: unknown) => { setError(e instanceof Error ? e.message : 'the game could not be put online') })
    }
    // the URL names the game from the first move on, so the code and the address cannot drift apart
    navigate(gamePath(code))
  }, [])

  const resume = useCallback((next: Session, followed = 0) => {
    roundRef.current = next.state.round
    setError(null)
    setClaim(readClaim(next.code, playerId()))
    setSession(next)
    // a game rebuilt from the wire arrives with its log already followed to the end
    submittedRef.current = followed
  }, [])

  const apply = useCallback((move: Move): boolean => {
    if (!session) return false
    // The claim, not the engine, decides who may push a button here: a move for a seat this browser does
    // not hold is dropped before the rules ever see it, and it is no engine error, so nothing is reported.
    if (!actingSeats(claim).includes(session.state.active)) return false
    // what the move means, including whatever follows from it on its own, lives in `advance`: the browser
    // that receives this move over the wire runs the same function and must arrive at the same board
    const result = advance(session.state, move, session.seed)
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
      clockMs: clockAfter(session.state, move, session.state.active, session.clockMs),
      history: keep ? [...session.history, session.state] : [],
      handoff: next.active !== session.state.active && next.winner === null ? next.active : null,
    })
    /*
     * Online, the move is now this browser's truth and has to become the game's. The server takes it only
     * if this player holds the seat and the number is the next one, so a refusal means the other browser
     * got there first, and the honest answer to that is to say so: the two boards have diverged and the
     * page has to be reloaded to line up again. It cannot be papered over here, because the move is
     * already applied locally.
     */
    if (online && transport !== null) {
      const n = submittedRef.current
      submittedRef.current = n + 1
      const seat = session.state.active
      void transport.append(session.code, playerId(), seat, n, move)
        .then(accepted => {
          if (!accepted) {
            submittedRef.current = n
            setError('That move did not reach the game. Reload to catch up with your opponent.')
          }
        })
        .catch((e: unknown) => {
          submittedRef.current = n
          setError(e instanceof Error ? e.message : 'the move did not reach the game')
        })
    }
    return true
  }, [session, claim, online])

  /*
   * The other browser's moves. Every client replays the same log through the same `advance`, so a move
   * that arrives is applied exactly as the browser that made it applied it, and both boards stay one board.
   * A move numbered ahead of this browser means something was missed, which a reload settles; the design
   * deliberately has no merge, only a log.
   */
  useEffect(() => {
    if (!online || transport === null || !session) return
    const code = session.code
    return transport.watch(code, incoming => {
      setSession(prev => {
        if (!prev || prev.code !== code) return prev
        // this browser's own move coming back, or one it has already accounted for
        if (incoming.n < submittedRef.current) return prev
        if (incoming.n > submittedRef.current) {
          setError('This game has moved on without you. Reload to catch up.')
          return prev
        }
        const result = advance(prev.state, incoming.move, prev.seed)
        if (!result.ok) {
          setError(result.error)
          return prev
        }
        submittedRef.current = incoming.n + 1
        const next = result.value
        return {
          ...prev,
          state: next,
          clockMs: clockAfter(prev.state, incoming.move, prev.state.active, prev.clockMs),
          // an opponent's move never offers this browser an undo: the move is out in the world
          history: [],
          handoff: next.active !== prev.state.active && next.winner === null ? next.active : null,
        }
      })
    })
    // `session.code` is the only part of the session this subscription depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, session?.code])

  const undo = useCallback(() => {
    // R: undo is a hot-seat courtesy between two people at one screen. Online a move that is out is out,
    // because the other browser has already seen it.
    if (actingSeats(claim).length !== 2) return
    if (!session || session.history.length === 0) return
    const previous = session.history[session.history.length - 1]
    setError(null)
    setSession({ ...session, state: previous, history: session.history.slice(0, -1), handoff: null })
  }, [session, claim])

  const dismissHandoff = useCallback(() => {
    setSession(prev => prev ? { ...prev, handoff: null } : prev)
  }, [])

  // R7: abandoning drops this one game, never the other games the browser holds
  const abandon = useCallback(() => {
    if (session) deleteGame(session.code)
    roundRef.current = null
    setError(null)
    setClaim(null)
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
  // The interstitial is worded from the claim: both seats read "pass the device", a single seat sees only
  // its own turn, and a watcher never sees one. The board goes inert for exactly as long as it is up.
  const handoffSeat = session === null || session.handoff === null ? null
    : seats.length === 2 || seats.includes(session.handoff) ? session.handoff : null
  const canAct = session !== null && session.state.winner === null && seats.includes(session.state.active)
  const running = session !== null && session.state.winner === null && handoffSeat === null && legal.length > 0
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
    session, legal, error, clockRunning: running, seats, canAct, handoffSeat,
    canUndo: session !== null && session.history.length > 0 && seats.length === 2,
    start, resume, apply, undo, dismissHandoff, abandon,
  }), [session, legal, error, running, seats, canAct, handoffSeat,
    start, resume, apply, undo, dismissHandoff, abandon])

  return <GameContext.Provider value={store}>{children}</GameContext.Provider>
}
