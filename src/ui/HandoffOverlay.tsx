import { useEffect, useRef } from 'react'
import { useGame } from './store'

/** lobby-architecture 2.8: the hot-seat courtesy between two people sharing one screen. */
export function HandoffOverlay() {
  const { session, dismissHandoff } = useGame()
  const continueRef = useRef<HTMLButtonElement | null>(null)
  const shown = session !== null && session.handoff !== null
  // the board behind is inert, so the single live control takes focus and a keyboard alone can carry on
  useEffect(() => {
    if (shown) continueRef.current?.focus()
  }, [shown])
  if (!session || session.handoff === null) return null
  const player = session.state.players[session.handoff]
  return (
    <div
      className="overlay" data-testid="handoff"
      role="dialog" aria-modal="true" aria-label={`Pass the device to ${player.name}`}
    >
      <h2 className="title goldtext">Pass the device to {player.name}</h2>
      <p className="tagline">{player.name} is next to act</p>
      <button ref={continueRef} type="button" className="btn gold" data-testid="handoff-continue" onClick={dismissHandoff}>
        I am {player.name}
      </button>
    </div>
  )
}
