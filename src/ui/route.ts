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

/** `#/?seed=7` fixes the game seed, which is what the tests use; without it the caller's fallback wins. */
export function seedFromRoute(route: string, fallback: number): number {
  const query = route.indexOf('?')
  if (query < 0) return fallback
  const value = new URLSearchParams(route.slice(query + 1)).get('seed')
  if (value === null) return fallback
  const seed = Number.parseInt(value, 10)
  return Number.isFinite(seed) ? seed : fallback
}
