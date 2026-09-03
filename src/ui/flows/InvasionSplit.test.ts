// src/ui/flows/InvasionSplit.test.ts
import { describe, expect, it } from 'vitest'
import { suggestedSplit } from './InvasionPanel'

describe('R4.3: the landing suggestion', () => {
  it('splits evenly when it divides', () => {
    expect(suggestedSplit(4, 2, 0)).toEqual([2, 2])
    expect(suggestedSplit(2, 2, 0)).toEqual([1, 1])
    expect(suggestedSplit(6, 2, 7)).toEqual([3, 3])
  })

  it('gives the odd one to a planet drawn from the seed, not always the first', () => {
    expect(suggestedSplit(5, 2, 0)).toEqual([3, 2])
    expect(suggestedSplit(5, 2, 1)).toEqual([2, 3])
    // the same seed always proposes the same split, which is what a replay needs
    expect(suggestedSplit(5, 2, 1)).toEqual(suggestedSplit(5, 2, 1))
  })

  it('never proposes more than there is, and copes with one planet or none', () => {
    expect(suggestedSplit(3, 1, 0)).toEqual([3])
    expect(suggestedSplit(0, 2, 0)).toEqual([0, 0])
    expect(suggestedSplit(1, 2, 0)).toEqual([1, 0])
    expect(suggestedSplit(4, 0, 0)).toEqual([])
    for (const seed of [0, 1, 2, 13, 99]) {
      expect(suggestedSplit(7, 2, seed).reduce((a, b) => a + b, 0)).toBe(7)
    }
  })
})
