import type { GameState } from '../engine/types'
import type { Session } from './store'

export const STORAGE_KEY = 'md:local'

interface Payload {
  version: 1
  seed: number
  minutes: number
  clockMs: [number, number]
  state: GameState
  history: GameState[]
}

function isPayload(value: unknown): value is Payload {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Partial<Payload>
  return p.version === 1 && typeof p.seed === 'number' && typeof p.minutes === 'number'
    && Array.isArray(p.clockMs) && p.clockMs.length === 2
    && Array.isArray(p.history)
    && typeof p.state === 'object' && p.state !== null && p.state.version === 1
}

export function saveSession(session: Session): void {
  const payload: Payload = {
    version: 1, seed: session.seed, minutes: session.minutes,
    clockMs: session.clockMs, state: session.state, history: session.history,
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // a full or blocked storage must never break the game in progress
  }
}

export function loadSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isPayload(parsed)) return null
    return {
      seed: parsed.seed, minutes: parsed.minutes, state: parsed.state,
      history: parsed.history, clockMs: parsed.clockMs, handoff: null,
    }
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to do
  }
}
