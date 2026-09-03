// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { toActionPhase } from '../engine/testUtils'
import { STORAGE_KEY, clearSession, loadSession, saveSession } from './persist'
import type { Session } from './store'

const session: Session = {
  seed: 7, minutes: 15, state: toActionPhase(), history: [], clockMs: [123456, 654321], handoff: null,
}

describe('hot-seat persistence', () => {
  it('round-trips seed, clocks, state and history', () => {
    saveSession(session)
    const loaded = loadSession()
    expect(loaded?.seed).toBe(7)
    expect(loaded?.clockMs).toEqual([123456, 654321])
    expect(loaded?.state.phase).toBe('action')
    expect(loaded?.state.systems['home-n'].space).toHaveLength(5)
    expect(loaded?.handoff).toBeNull()
  })
  it('ignores an empty, broken or foreign payload', () => {
    expect(loadSession()).toBeNull()
    window.localStorage.setItem(STORAGE_KEY, 'not json')
    expect(loadSession()).toBeNull()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, state: {} }))
    expect(loadSession()).toBeNull()
    saveSession(session)
    clearSession()
    expect(loadSession()).toBeNull()
  })
})
