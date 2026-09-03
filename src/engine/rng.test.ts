import { describe, expect, it } from 'vitest'
import { deriveSeed, mulberry32, rollDice } from './rng'

describe('rng (engine-design: determinism)', () => {
  it('same seed gives the same sequence', () => {
    const a = mulberry32(42), b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('different seeds differ', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)())
  })
  it('dice are ten-sided and never 0 or 11', () => {
    const rolls = rollDice(mulberry32(7), 1000)
    expect(Math.min(...rolls)).toBe(1)
    expect(Math.max(...rolls)).toBe(10)
    expect(rolls.every(r => Number.isInteger(r))).toBe(true)
  })
  it('deriveSeed is deterministic and salt-sensitive', () => {
    expect(deriveSeed(99, 1)).toBe(deriveSeed(99, 1))
    expect(deriveSeed(99, 1)).not.toBe(deriveSeed(99, 2))
  })
})
