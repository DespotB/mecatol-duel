import { useEffect, useRef } from 'react'
import { useGame } from './store'

/**
 * lobby-architecture 2.8: the hot-seat courtesy between two people sharing one screen, and online the same
 * screen with the other half of the sentence. The claim words it: a browser that holds both seats is asked
 * to pass the device on, a browser that holds one seat is told its turn has come and sees nothing when the
 * turn goes the other way, and a watcher is never interrupted at all. `handoffSeat` has already made that
 * decision, so this component only chooses the words.
 */
export function HandoffOverlay() {
  const { session, seats, handoffSeat, dismissHandoff } = useGame()
  const continueRef = useRef<HTMLButtonElement | null>(null)
  const shown = handoffSeat !== null
  // the board behind is inert, so the single live control takes focus and a keyboard alone can carry on
  useEffect(() => {
    if (shown) continueRef.current?.focus()
  }, [shown])
  if (!session || handoffSeat === null) return null
  const player = session.state.players[handoffSeat]
  const sharing = seats.length === 2
  const title = sharing ? `Pass the device to ${player.name}` : 'Your turn'
  return (
    <div className="overlay" data-testid="handoff" role="dialog" aria-modal="true" aria-label={title}>
      <h2 className="title goldtext">{title}</h2>
      <p className="tagline">{player.name} is next to act</p>
      <button ref={continueRef} type="button" className="btn gold" data-testid="handoff-continue" onClick={dismissHandoff}>
        {sharing ? `I am ${player.name}` : 'Continue'}
      </button>
    </div>
  )
}
