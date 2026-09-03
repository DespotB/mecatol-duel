// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { codeFromRoute, gamePath, playRedirect, seedFromRoute } from './route'

describe('the hash router', () => {
  it('reads the game code out of #/g/<code>', () => {
    expect(codeFromRoute('#/g/ABC234')).toBe('ABC234')
    expect(codeFromRoute('#/g/ABC234?seed=7')).toBe('ABC234')
    expect(codeFromRoute('#/g/ABC234/')).toBe('ABC234')
    // a code is read out loud and typed by hand, so the case it arrives in does not matter
    expect(codeFromRoute('#/g/abc234')).toBe('ABC234')
  })

  it('has no code for the lobby, the old board route or a truncated address', () => {
    expect(codeFromRoute('#/')).toBeNull()
    expect(codeFromRoute('#/?seed=7')).toBeNull()
    expect(codeFromRoute('#/g/')).toBeNull()
    expect(codeFromRoute('#/g')).toBeNull()
    expect(codeFromRoute('#/play')).toBeNull()
    expect(codeFromRoute('#/g/AB CD')).toBeNull()
  })

  it('addresses a game by its code', () => {
    expect(gamePath('ABC234')).toBe('#/g/ABC234')
    expect(codeFromRoute(gamePath('ABC234'))).toBe('ABC234')
  })

  it('sends the bookmarked #/play to the newest saved game, or to the lobby when there is none', () => {
    expect(playRedirect('#/play', 'ABC234')).toBe('#/g/ABC234')
    expect(playRedirect('#/play', null)).toBe('#/')
    expect(playRedirect('#/play?seed=7', 'ABC234')).toBe('#/g/ABC234?seed=7')
    expect(playRedirect('#/play?seed=7', null)).toBe('#/?seed=7')
  })

  it('leaves every other route alone', () => {
    expect(playRedirect('#/', 'ABC234')).toBeNull()
    expect(playRedirect('#/g/ABC234', 'ABC234')).toBeNull()
  })

  it('keeps ?seed= working on the game route as well', () => {
    expect(seedFromRoute('#/?seed=7', 1)).toBe(7)
    expect(seedFromRoute('#/g/ABC234?seed=7', 1)).toBe(7)
    expect(seedFromRoute('#/g/ABC234', 1)).toBe(1)
    expect(seedFromRoute('#/g/ABC234?seed=nonsense', 1)).toBe(1)
  })
})
