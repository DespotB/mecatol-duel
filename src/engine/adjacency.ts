import { SYSTEMS, systemDef } from '../data/map'

export function neighbours(id: string): string[] {
  const def = systemDef(id)
  const out = new Set(def.neighbours)
  if (def.wormhole) for (const s of SYSTEMS) if (s.id !== id && s.wormhole === def.wormhole) out.add(s.id)
  return [...out]
}

export function adjacent(a: string, b: string): boolean {
  return neighbours(a).includes(b)
}

export function distance(from: string, to: string): number {
  if (from === to) return 0
  const seen = new Set([from])
  let frontier = [from]
  for (let d = 1; frontier.length; d++) {
    const next: string[] = []
    for (const id of frontier) for (const n of neighbours(id)) {
      if (n === to) return d
      if (!seen.has(n)) { seen.add(n); next.push(n) }
    }
    frontier = next
  }
  return Infinity
}
