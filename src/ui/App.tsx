import { useEffect, useRef } from 'react'
import { GameProvider, useGame } from './store'
import { navigate, useHashRoute } from './route'
import { BoardScreen } from './screens/BoardScreen'
import { GameOverScreen } from './screens/GameOverScreen'
import { RulesScreen } from './screens/RulesScreen'
import { SetupScreen } from './screens/SetupScreen'
import type { GameConfig } from './store'
import type { Move, StrategyCardId } from '../engine/types'

// Manual/visual QA only (e.g. a headless screenshot of the board): `?demo=1` skips setup and starts
// a fixed hot-seat game straight into the action phase draft, seeded for a reproducible board.
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
    const panel = params.get('panel')
    // `&panel=handoff` / `&panel=log` are manual/visual QA hooks: they resume straight into a state
    // that already shows the overlay or has log entries, so a headless screenshot needs no clicks.
    if (panel === 'handoff' || panel === 'log') {
      void import('../engine/testUtils').then(({ cardsUsed, toActionPhase }) => {
        const state = toActionPhase(1, 0)
        resume(panel === 'handoff'
          ? { seed: 1, minutes: 15, state: cardsUsed(state), history: [], clockMs: [900000, 900000], handoff: 1 }
          : { seed: 1, minutes: 15, state, history: [], clockMs: [900000, 900000], handoff: null })
        navigate('#/play')
      })
      return
    }
    start(DEMO_CONFIG, 1, 15)
    navigate('#/play')
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

function Screens() {
  const { session } = useGame()
  const route = useHashRoute()
  useDemoBootstrap()
  useDemoScript()
  // a document, not a game screen: readable from the lobby and straight from the URL, running game or not
  if (route.startsWith('#/rules')) return <RulesScreen />
  if (session && session.state.winner !== null) return <GameOverScreen />
  if (session && route.startsWith('#/play')) return <BoardScreen />
  return <SetupScreen />
}

export default function App({ ticking = true }: { ticking?: boolean }) {
  return (
    <GameProvider ticking={ticking}>
      <Screens />
    </GameProvider>
  )
}
