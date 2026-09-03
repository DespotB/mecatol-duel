import { describe, expect, it } from 'vitest'
import { advance, replay } from './advance'
import { moveCount } from './history'
import { createGame } from '../engine'
import type { GameConfig, Move } from '../engine/types'

const CONFIG: GameConfig = {
  players: [
    { faction: 'l1z1x', color: 'blue', name: 'Ada' },
    { faction: 'letnev', color: 'red', name: 'Bo' },
  ],
  speaker: 0,
}
const SEED = 4242

/** The strategy phase opens every game, so picking a card is a first move that always applies. */
const FIRST_MOVE: Move = { type: 'pickStrategyCard', card: 'warfare' }

describe('advance', () => {
  it('applies the move and reports the rules error unchanged when it does not', () => {
    const state = createGame(CONFIG, SEED)
    const bad = advance(state, { type: 'endTurn' }, SEED)
    expect(bad.ok).toBe(false)
  })

  it('logs exactly the move it was given when the turn is not over', () => {
    const state = createGame(CONFIG, SEED)
    const result = advance(state, FIRST_MOVE, SEED)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(moveCount(result.value)).toBeGreaterThanOrEqual(1)
  })
})

describe('replay', () => {
  it('rebuilds the opening position from no moves at all', () => {
    const result = replay(CONFIG, SEED, [])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual(createGame(CONFIG, SEED))
  })

  /** The whole design rests on this: the same seed and the same moves give the same board, everywhere. */
  it('arrives at the same board the submitting browser reached', () => {
    const submitted = advance(createGame(CONFIG, SEED), FIRST_MOVE, SEED)
    expect(submitted.ok).toBe(true)
    if (!submitted.ok) return
    const replayed = replay(CONFIG, SEED, [FIRST_MOVE])
    expect(replayed.ok).toBe(true)
    if (!replayed.ok) return
    expect(replayed.value).toEqual(submitted.value)
  })

  it('stops at the move that does not apply and names it', () => {
    const result = replay(CONFIG, SEED, [{ type: 'endTurn' }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('move 0')
  })
})
