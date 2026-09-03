import { describe, expect, it } from 'vitest'
import { relativeTime } from './format'

const NOW = Date.UTC(2026, 8, 3, 12, 0, 0)
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('relative time', () => {
  it('reads the last minute as just now', () => {
    expect(relativeTime(NOW, NOW)).toBe('just now')
    expect(relativeTime(NOW - 30 * SECOND, NOW)).toBe('just now')
    // a clock that went backwards must not produce "in 5 seconds"
    expect(relativeTime(NOW + 5 * SECOND, NOW)).toBe('just now')
  })

  it('counts minutes and hours', () => {
    expect(relativeTime(NOW - 75 * SECOND, NOW)).toBe('1 minute ago')
    expect(relativeTime(NOW - 2 * MINUTE, NOW)).toBe('2 minutes ago')
    expect(relativeTime(NOW - 59 * MINUTE, NOW)).toBe('59 minutes ago')
    expect(relativeTime(NOW - HOUR, NOW)).toBe('1 hour ago')
    expect(relativeTime(NOW - 5 * HOUR, NOW)).toBe('5 hours ago')
    expect(relativeTime(NOW - 23 * HOUR, NOW)).toBe('23 hours ago')
  })

  it('says yesterday, then days, weeks and months', () => {
    expect(relativeTime(NOW - 25 * HOUR, NOW)).toBe('yesterday')
    expect(relativeTime(NOW - 47 * HOUR, NOW)).toBe('yesterday')
    expect(relativeTime(NOW - 3 * DAY, NOW)).toBe('3 days ago')
    expect(relativeTime(NOW - 6 * DAY, NOW)).toBe('6 days ago')
    expect(relativeTime(NOW - 8 * DAY, NOW)).toBe('last week')
    expect(relativeTime(NOW - 21 * DAY, NOW)).toBe('3 weeks ago')
    expect(relativeTime(NOW - 70 * DAY, NOW)).toBe('2 months ago')
    expect(relativeTime(NOW - 400 * DAY, NOW)).toBe('over a year ago')
  })
})
