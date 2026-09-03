import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { GameProvider, useGame } from '../store'
import type { GameStore, Session } from '../store'
import type { GameState } from '../../engine/types'

let current: GameStore | null = null

function Probe() {
  current = useGame()
  return null
}

/** Renders `node` inside a provider whose session is the given state; the clock is off unless asked for. */
export function renderWithSession(state: GameState, node: ReactNode, options?: { seed?: number; clockMs?: [number, number] }) {
  const view = render(<GameProvider ticking={false}><Probe />{node}</GameProvider>)
  act(() => {
    const session: Session = {
      seed: options?.seed ?? 7, minutes: 15, state, history: [],
      clockMs: options?.clockMs ?? [900000, 900000], handoff: null,
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
