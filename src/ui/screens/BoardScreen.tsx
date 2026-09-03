import { useGame } from '../store'

const PHASE_LABEL: Record<string, string> = {
  strategy: 'strategy phase', action: 'action phase', status: 'status phase', ended: 'game over',
}

export function BoardScreen() {
  const { session } = useGame()
  if (!session) return null
  const state = session.state
  return (
    <div className="app" data-testid="board-screen">
      <div className="space"><div className="stars" /><div className="neb" /><div className="swirl" /><div className="limb" /><div className="dust" /></div>
      <div className="r" data-testid="round">Round {state.round} of 6, {PHASE_LABEL[state.phase]}</div>
    </div>
  )
}
