import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameProvider, useGame } from './store'
import { latestGameCode, loadGame, openSeats, playerId, readClaim, readClaims, saveGame, writeClaim } from './persist'
import type { Claim } from './persist'
import { codeFromRoute, gamePath, navigate, playRedirect, useHashRoute } from './route'
import { freeSeats, useRemoteGame } from './remote'
import { transport } from '../net/online'
import { BoardScreen } from './screens/BoardScreen'
import { GameOverScreen } from './screens/GameOverScreen'
import { ModeScreen } from './screens/ModeScreen'
import { RulesScreen } from './screens/RulesScreen'
import { SetupScreen } from './screens/SetupScreen'
import { UnknownGameScreen } from './screens/UnknownGameScreen'
import type { PostId } from '../data/posts'
import type { GameConfig } from './store'
import type { GameState, Move, Seat, StrategyCardId } from '../engine/types'
import { ModelStyleProvider } from './modelStyle'
import { MusicProvider } from './music'

// Manual/visual QA only (e.g. a headless screenshot of the board): `?demo=1` skips setup and starts
// a fixed hot-seat game straight into the action phase draft, seeded for a reproducible board.
const DEMO_CODE = 'DEMOAA'
const DEMO_CONFIG: GameConfig = {
  players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }],
  speaker: 0,
}

function useDemoBootstrap() {
  const { session, start, resume } = useGame()
  useEffect(() => {
    // The whole hook is dev-only: `import.meta.env.DEV` folds to `false` in a production build, so this
    // body and the dynamic `../engine/testUtils` import below are dropped from the shipped bundle.
    if (!import.meta.env.DEV) return
    if (session || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') !== '1') return
    // a demo is a hot-seat game, so it answers the mode question for itself and lands on the board
    writeClaim(DEMO_CODE, { seats: [0, 1], playerId: playerId() })
    const panel = params.get('panel')
    // `&posts=tessik,kesh` is the same kind of hook for R8: it names the pair of trade posts to draw and
    // hands seat 0 Sakulag, so one hyperlane is lit and the other three are cold in the same shot.
    const posts = params.get('posts')
    // `&panel=handoff` / `&panel=log` are manual/visual QA hooks: they resume straight into a state
    // that already shows the overlay or has log entries, so a headless screenshot needs no clicks.
    if (panel === 'handoff' || panel === 'log' || posts !== null) {
      void import('../engine/testUtils').then(({ cardsUsed, toActionPhase, withPlanetOwner }) => {
        let state = toActionPhase(1, 0)
        if (posts !== null) {
          const [west, east] = posts.split(',') as PostId[]
          state = withPlanetOwner({ ...state, posts: { west, east } }, 'sakulag', 'sakulag', 0)
        }
        resume(panel === 'handoff'
          ? { code: DEMO_CODE, seed: 1, minutes: 15, state: cardsUsed(state), history: [], clockMs: [900000, 900000], handoff: 1 }
          : { code: DEMO_CODE, seed: 1, minutes: 15, state, history: [], clockMs: [900000, 900000], handoff: null })
        navigate(gamePath(DEMO_CODE))
      })
      return
    }
    // `&panel=mode` / `&panel=locked` are the seat-claim QA hooks: the first saves a game this browser
    // has no claim for and opens it, so the mode question is on screen; the second claims seat 1 of a
    // game seat 0 is to act in, so the board is on screen with every control of seat 0 locked.
    if (panel === 'mode' || panel === 'locked') {
      void import('../engine/testUtils').then(({ toActionPhase }) => {
        const state = toActionPhase(1, 0)
        const players = state.players.map((p, seat) => ({ ...p, name: seat === 0 ? 'Despot' : 'Kael' }))
        const code = panel === 'mode' ? 'MODEQQ' : 'LOCKQQ'
        saveGame({
          code, seed: 1, minutes: 15, history: [], clockMs: [781000, 900000], handoff: null,
          state: { ...state, players: players as GameState['players'] },
        })
        if (panel === 'locked') writeClaim(code, { seats: [1], playerId: playerId() })
        navigate(gamePath(code))
      })
      return
    }
    // `&panel=crowded` is the placement check: Bereg holds a big mixed fleet with the infantry its
    // carriers are still carrying (all of it belongs in space), Quann has a seat's infantry landed on the
    // planet under a dock and a PDS, Starpoint is activated by both seats, and Mecatol keeps its guardians.
    if (panel === 'crowded') {
      void import('../engine/testUtils').then(({ toActionPhase, withPlanetOwner, withUnits }) => {
        let state = toActionPhase(1, 0)
        state = withUnits(state, 'bereg', 0,
          ['flagship', 'warsun', 'dreadnought', 'dreadnought', 'carrier', 'carrier', 'cruiser', 'destroyer',
            'fighter', 'fighter', 'fighter', 'fighter', 'infantry', 'infantry', 'infantry'])
        state = withUnits(state, 'quann', 1, ['infantry', 'infantry', 'infantry', 'spacedock', 'pds'], 'quann')
        state = withPlanetOwner(state, 'quann', 'quann', 1)
        state = withUnits(state, 'quann', 1, ['carrier', 'destroyer', 'fighter'])
        state = { ...state, systems: { ...state.systems, starpoint: { ...state.systems.starpoint, activatedBy: [0, 1] } } }
        resume({ code: DEMO_CODE, seed: 1, minutes: 15, state, history: [], clockMs: [900000, 900000], handoff: null })
        navigate(gamePath(DEMO_CODE))
      })
      return
    }
    // `&panel=fleetpool` is the fleet pool warning: seat 0 holds Warfare and three cruisers sit in Bereg
    // exactly on its pool of three, so a sheet that takes a token out of the fleet pool costs a ship.
    if (panel === 'fleetpool') {
      void import('../engine/testUtils').then(({ toActionPhase, withCards, withUnits }) => {
        let state = withCards(withCards(toActionPhase(1, 0), 1, []), 0, ['warfare'])
        state = withUnits(state, 'bereg', 0, ['cruiser', 'cruiser', 'cruiser'])
        resume({ code: DEMO_CODE, seed: 1, minutes: 15, state, history: [], clockMs: [900000, 900000], handoff: null })
        navigate(gamePath(DEMO_CODE))
      })
      return
    }
    // `start` puts the new game's code in the URL itself
    start(DEMO_CONFIG, 1, 15)
    // Runs once on mount; `start`, `resume` and `session` come from a stable context store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// Manual/visual QA only: `?demo=1&panel=movement` or `?panel=produce` drives the draft and one
// tactical activation through real `apply()` moves, purely so a headless screenshot can land on
// the movement panel or the production drawer without a human at the keyboard.
const DRAFT: Move[] = (['warfare', 'leadership', 'imperial', 'technology'] as StrategyCardId[])
  .map(card => ({ type: 'pickStrategyCard', card }))
const DEMO_SCRIPTS: Record<string, Move[]> = {
  movement: [...DRAFT, { type: 'startTactical', systemId: 'bereg' }],
  // this draft's initiative order hands the first action-phase turn to seat 1, so the produce demo
  // activates seat 1's own home system (home-s) to get a real, non-zero production limit.
  produce: [...DRAFT, { type: 'startTactical', systemId: 'home-s' }, { type: 'endMovement' }, { type: 'endInvasion' }],
}

function movesMatch(a: Move, b: Move): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'pickStrategyCard' && b.type === 'pickStrategyCard') return a.card === b.card
  if (a.type === 'startTactical' && b.type === 'startTactical') return a.systemId === b.systemId
  return true
}

function useDemoScript() {
  const { session, legal, apply } = useGame()
  const step = useRef(0)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (typeof window === 'undefined' || !session) return
    const panel = new URLSearchParams(window.location.search).get('panel')
    const script = panel ? DEMO_SCRIPTS[panel] : undefined
    if (!script || step.current >= script.length) return
    const next = script[step.current]
    if (legal.some(m => movesMatch(m, next))) {
      apply(next)
      step.current += 1
    }
  }, [session, legal, apply])
}

/**
 * One saved game, addressed by its code. The store may already hold it (it was just started, or the
 * player came from the lobby); otherwise it is read from this browser's storage on the spot. The read is
 * synchronous, so the "not on this device" panel is only ever shown for a game that really is absent.
 *
 * Before the board, the claim: a game this browser has no claim for asks how it wants to play this one,
 * and the answer is written under the code and never asked again.
 */
function GameRoute({ code }: { code: string }) {
  const { session, resume } = useGame()
  const open = session !== null && session.code === code
  const stored = useMemo(() => open ? null : loadGame(code), [open, code])
  /*
   * A game this browser does not hold is not necessarily lost: a shared link points at a game on the
   * server, and the server has everything needed to rebuild it. So the local storage is asked first, and
   * only a code neither this browser nor the server knows lands on the "not on this device" panel.
   */
  const remote = useRemoteGame(code, !open && stored === null)
  const arrived = remote.kind === 'found' ? remote.session : null
  const [claim, setClaim] = useState<Claim | null>(() => readClaim(code, playerId()))
  const [taken, setTaken] = useState(false)
  // a different game is a different question, so the claim is re-read whenever the address changes
  useEffect(() => { setClaim(readClaim(code, playerId())); setTaken(false) }, [code])
  const held = claim !== null
  useEffect(() => {
    if (!held) return
    if (stored) { resume(stored); return }
    // the game came off the wire: it is this browser's now, so it is saved before it is opened
    if (arrived) { saveGame(arrived); resume(arrived) }
  }, [held, stored, arrived, resume])
  const answer = useCallback((seats: Seat[]) => {
    const id = playerId()
    const write = () => {
      const made: Claim = { seats, playerId: id }
      writeClaim(code, made)
      setClaim(made)
    }
    // Online, the seat is the server's to give: a second visitor asking for the same seat is told no
    // rather than both of them believing they hold it. Hot-seat on a game off the wire takes both seats,
    // which the server refuses unless both are free, and that refusal is the same answer.
    const wire = transport
    if (wire !== null && arrived !== null) {
      void Promise.all(seats.map(seat => wire.claim(code, id, seat)))
        .then(results => { if (results.every(Boolean)) write(); else setTaken(true) })
        .catch(() => { setTaken(true) })
      return
    }
    write()
  }, [code, arrived])
  const game = open && session !== null ? session : stored ?? arrived
  if (game === null) {
    // still asking the server, so nothing is claimed yet either way
    if (remote.kind === 'loading') return <UnknownGameScreen code={code} looking />
    return <UnknownGameScreen code={code} error={remote.kind === 'error' ? remote.message : undefined} />
  }
  if (!held) {
    return (
      <ModeScreen
        code={code} names={[game.state.players[0].name, game.state.players[1].name]}
        free={remote.kind === 'found' && !taken
          ? freeSeats(remote.players, playerId())
          : openSeats(readClaims(code), playerId())}
        onClaim={answer}
      />
    )
  }
  if (open && session !== null) {
    return session.state.winner !== null ? <GameOverScreen /> : <BoardScreen />
  }
  // one frame while the store adopts the game the line above just read
  return null
}

function Screens() {
  const route = useHashRoute()
  useDemoBootstrap()
  useDemoScript()
  // `#/play` was the board's address before games had codes; a bookmark from that version still lands
  // somewhere sensible, on the newest saved game or in the lobby.
  useEffect(() => {
    const target = playRedirect(route, latestGameCode())
    if (target !== null) navigate(target)
  }, [route])
  // a document, not a game screen: readable from the lobby and straight from the URL, running game or not
  if (route.startsWith('#/rules')) return <RulesScreen />
  const code = codeFromRoute(route)
  if (code !== null) return <GameRoute code={code} />
  return <SetupScreen />
}

export default function App({ ticking = true }: { ticking?: boolean }) {
  return (
    <MusicProvider>
      <ModelStyleProvider>
        <GameProvider ticking={ticking}>
          <Screens />
        </GameProvider>
      </ModelStyleProvider>
    </MusicProvider>
  )
}
