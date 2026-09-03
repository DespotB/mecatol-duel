import { useEffect, useState } from 'react'

function current(): string {
  return window.location.hash || '#/'
}

// `hashchange` is queued rather than dispatched inline, so `navigate` also notifies the mounted hooks
// directly; a route change is then visible in the same tick, in the browser and in the tests alike.
const listeners = new Set<() => void>()

export function useHashRoute(): string {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const onChange = () => setRoute(current())
    window.addEventListener('hashchange', onChange)
    listeners.add(onChange)
    onChange()
    return () => {
      window.removeEventListener('hashchange', onChange)
      listeners.delete(onChange)
    }
  }, [])
  return route
}

export function navigate(hash: string): void {
  window.location.hash = hash
  for (const listener of [...listeners]) listener()
}

const GAME_PREFIX = '#/g/'

/** The route without its query string; `?seed=` may ride along on any address. */
function path(route: string): string {
  const query = route.indexOf('?')
  return query < 0 ? route : route.slice(0, query)
}

/** `#/g/<code>` is one saved game. Anything else, the lobby included, names no game. */
export function codeFromRoute(route: string): string | null {
  const p = path(route)
  if (!p.startsWith(GAME_PREFIX)) return null
  const code = p.slice(GAME_PREFIX.length).replace(/\/+$/, '').toUpperCase()
  return /^[A-Z0-9]{1,12}$/.test(code) ? code : null
}

export function gamePath(code: string): string {
  return `${GAME_PREFIX}${code}`
}

/**
 * `#/play` was the board's address before a game had a code. A bookmark from that version must not
 * dead-end, so it lands on the most recently updated saved game, or on the lobby when there is none.
 * Returns null for every other route, meaning "no redirect".
 */
export function playRedirect(route: string, latest: string | null): string | null {
  const p = path(route)
  if (p !== '#/play' && p !== '#/play/') return null
  const query = route.slice(p.length)
  return latest === null ? `#/${query}` : `${gamePath(latest)}${query}`
}

/** `#/?seed=7` fixes the game seed, which is what the tests use; without it the caller's fallback wins. */
export function seedFromRoute(route: string, fallback: number): number {
  const query = route.indexOf('?')
  if (query < 0) return fallback
  const value = new URLSearchParams(route.slice(query + 1)).get('seed')
  if (value === null) return fallback
  const seed = Number.parseInt(value, 10)
  return Number.isFinite(seed) ? seed : fallback
}
