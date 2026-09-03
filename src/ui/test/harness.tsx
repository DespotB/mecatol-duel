import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { playerId, writeClaim } from '../persist'
import { GameProvider, useGame } from '../store'
import type { GameStore, Session } from '../store'
import type { GameState, Seat } from '../../engine/types'

let current: GameStore | null = null

function Probe() {
  current = useGame()
  return null
}

/**
 * Renders `node` inside a provider whose session is the given state; the clock is off unless asked for.
 * `seats` claims those seats for this browser before the session opens, the way the mode question does;
 * without it the board plays both seats, which is the hot-seat every older test is written against.
 */
export const TEST_CODE = 'TESTAA'

export function renderWithSession(
  state: GameState,
  node: ReactNode,
  options?: { seed?: number; clockMs?: [number, number]; seats?: Seat[]; handoff?: Seat },
) {
  if (options?.seats) writeClaim(TEST_CODE, { seats: options.seats, playerId: playerId() })
  const view = render(<GameProvider ticking={false}><Probe />{node}</GameProvider>)
  act(() => {
    const session: Session = {
      code: TEST_CODE, seed: options?.seed ?? 7, minutes: 15, state, history: [],
      clockMs: options?.clockMs ?? [900000, 900000], handoff: options?.handoff ?? null,
    }
    current?.resume(session)
  })
  return {
    ...view,
    store(): GameStore {
      if (!current) throw new Error('the probe never saw the store')
      return current
    },
  }
}
