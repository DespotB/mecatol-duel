import { GameProvider, useGame } from './store'
import { useHashRoute } from './route'
import { BoardScreen } from './screens/BoardScreen'
import { GameOverScreen } from './screens/GameOverScreen'
import { SetupScreen } from './screens/SetupScreen'

function Screens() {
  const { session } = useGame()
  const route = useHashRoute()
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
