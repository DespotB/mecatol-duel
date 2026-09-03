import { describe, expect, it } from 'vitest'
import { toActionPhase } from '../engine/testUtils'
import { moveCount, rollCount, undoable } from './history'
import type { GameState } from '../engine/types'

const base = toActionPhase()

function withRoll(state: GameState): GameState {
  return { ...state, log: [...state.log, { t: 'roll', owner: 0, rolls: [], context: 'space combat round 1' }] }
}

describe('undo inside your own turn', () => {
  it('counts the move and roll entries in the log', () => {
    expect(moveCount(base)).toBe(4)          // the four picks of the strategy phase
    expect(rollCount(base)).toBe(0)
    expect(rollCount(withRoll(base))).toBe(1)
  })
  it('lobby-architecture 2.8: a move is undoable while the same seat acts and nothing was rolled', () => {
    expect(undoable(base, base)).toBe(true)
    expect(undoable(base, { ...base, active: 1 })).toBe(false)
    expect(undoable(base, withRoll(base))).toBe(false)
  })
  it('R8: a post ability is final, like a die roll, because it is once per round for the table', () => {
    expect(undoable(base, { ...base, postAbilityUsed: { west: true, east: false } })).toBe(false)
    expect(undoable(base, { ...base, postAbilityUsed: { west: false, east: true } })).toBe(false)
  })
})
