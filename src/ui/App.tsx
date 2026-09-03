import { useEffect } from 'react'
import { GameProvider, useGame } from './store'
import { navigate, useHashRoute } from './route'
import { BoardScreen } from './screens/BoardScreen'
import { GameOverScreen } from './screens/GameOverScreen'
import { SetupScreen } from './screens/SetupScreen'
import type { GameConfig } from './store'

// Manual/visual QA only (e.g. a headless screenshot of the board): `?demo=1` skips setup and starts
// a fixed hot-seat game straight into the action phase draft, seeded for a reproducible board.
const DEMO_CONFIG: GameConfig = {
  players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }],
  speaker: 0,
}

function useDemoBootstrap() {
  const { session, start } = useGame()
  useEffect(() => {
    if (session || typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('demo') !== '1') return
    start(DEMO_CONFIG, 1, 15)
    navigate('#/play')
    // Runs once on mount; `start` and `session` come from a stable context store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

function Screens() {
  const { session } = useGame()
  const route = useHashRoute()
  useDemoBootstrap()
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
