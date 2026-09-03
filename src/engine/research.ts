import { TECHS, techDef } from '../data/techs'
import type { FactionId, TechColor } from './types'

type TechOwner = { faction: FactionId; techs: string[] }

export function colourCounts(techs: string[]): Record<TechColor, number> {
  const c: Record<TechColor, number> = { blue: 0, red: 0, green: 0, yellow: 0 }
  for (const id of techs) { const t = techDef(id); if (t.colour) c[t.colour]++ }
  return c
}

function availableTo(player: TechOwner, techId: string): boolean {
  const t = techDef(techId)
  if (t.kind === 'faction' && t.faction !== player.faction) return false
  if (techId === 'dreadnought_ii' && player.faction === 'l1z1x') return false
  return true
}

export function canResearch(player: TechOwner, techId: string, ignorePrereqs = false): boolean {
  if (player.techs.includes(techId) || !availableTo(player, techId)) return false
  if (ignorePrereqs) return true
  const have = colourCounts(player.techs)
  const need = techDef(techId).prereq
  return (Object.keys(need) as TechColor[]).every(colour => have[colour] >= (need[colour] ?? 0))
}

export function researchable(player: TechOwner): string[] {
  return TECHS.map(t => t.id).filter(id => canResearch(player, id))
}
