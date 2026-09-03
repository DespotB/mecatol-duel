import { useGame } from './store'

/** lobby-architecture 2.8: the hot-seat courtesy between two people sharing one screen. */
export function HandoffOverlay() {
  const { session, dismissHandoff } = useGame()
  if (!session || session.handoff === null) return null
  const player = session.state.players[session.handoff]
  return (
    <div className="overlay" data-testid="handoff">
      <h2 className="title goldtext">Pass the device to {player.name}</h2>
      <p className="tagline">{player.name} is next to act</p>
      <button type="button" className="btn gold" data-testid="handoff-continue" onClick={dismissHandoff}>
        I am {player.name}
      </button>
    </div>
  )
}
