import { useEffect, useState } from 'react'
import { replay } from './advance'
import { transport } from '../net/online'
import type { OnlineGame } from '../net/online'
import type { Session } from './store'
import type { Seat } from '../engine/types'

/**
 * A game this browser does not hold, fetched from the server and replayed into a session.
 *
 * This is the whole of joining: the server has the seed, the config and the moves, the engine is
 * deterministic, so replaying them lands on exactly the board the other player is looking at. Refreshing
 * and reconnecting go through the same path, which is why there is no session to keep alive anywhere.
 */
export type Remote =
  /** this build has no server configured, so a game is only ever where it was started */
  | { kind: 'off' }
  | { kind: 'loading' }
  /** the server does not know this code either */
  | { kind: 'absent' }
  | { kind: 'found'; session: Session; players: [string | null, string | null] }
  | { kind: 'error'; message: string }

/** The seats no other player holds on the server, so the ones this browser may still take. */
export function freeSeats(players: OnlineGame['players'], player: string): Seat[] {
  return ([0, 1] as Seat[]).filter(seat => players[seat] === null || players[seat] === player)
}

export function useRemoteGame(code: string, enabled: boolean): Remote {
  const [remote, setRemote] = useState<Remote>(() => transport === null ? { kind: 'off' } : { kind: 'loading' })

  useEffect(() => {
    if (!enabled || transport === null) return
    let live = true
    setRemote({ kind: 'loading' })
    transport.load(code)
      .then(found => {
        if (!live) return
        if (!found) { setRemote({ kind: 'absent' }); return }
        // The clock is not on server time yet (step 3 of docs/spec/online-play.md): a joining browser
        // starts both clocks full rather than pretending to know what has been spent so far.
        const ms = found.game.minutes * 60000
        const state = replay(found.game.config, found.game.seed, found.moves.map(m => m.move))
        if (!state.ok) { setRemote({ kind: 'error', message: state.error }); return }
        setRemote({
          kind: 'found',
          players: found.game.players,
          session: {
            code: found.game.code, seed: found.game.seed, minutes: found.game.minutes,
            state: state.value, history: [], clockMs: [ms, ms], handoff: null,
          },
        })
      })
      .catch((error: unknown) => {
        if (live) setRemote({ kind: 'error', message: error instanceof Error ? error.message : 'could not reach the server' })
      })
    return () => { live = false }
  }, [code, enabled])

  return remote
}
