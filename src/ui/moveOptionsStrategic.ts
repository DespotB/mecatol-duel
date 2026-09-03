// Own copy of the move-options readers for strategic, secondary, research, shipyard, tradePost and status
// moves (the parallel tactical-flows branch defines the full src/ui/moveOptions.ts surface, including these
// same functions, for the tactical moves; this file exists so the two worktrees do not both create the same
// new file path). Reads the enumerated moves and nothing else, exactly like moveOptions.ts.
import type { Move, StatusParams, StrategicParams, StrategyCardId } from '../engine/types'

export function strategicCards(legal: Move[]): StrategyCardId[] {
  return [...new Set(legal.flatMap(m => m.type === 'strategic' ? [m.card] : []))]
}

export function strategicVariants(legal: Move[], card: StrategyCardId): StrategicParams[] {
  return legal.flatMap(m => m.type === 'strategic' && m.card === card ? [m.params ?? {}] : [])
}

export function secondaryOffer(legal: Move[]): { accept: StrategicParams | null; card: StrategyCardId | null } {
  const secondaries = legal.filter((m): m is Extract<Move, { type: 'secondary' }> => m.type === 'secondary')
  const card = secondaries[0]?.card ?? null
  const accept = secondaries.find(m => m.accept)?.params ?? null
  return { accept, card }
}

export function inheritanceTechIds(legal: Move[]): string[] {
  return legal.flatMap(m => m.type === 'research' && m.via === 'inheritance' ? [m.techId] : [])
}

export function shipyardOffers(legal: Move[]): { planetId: string; planets: string[]; tradeGoods: number }[] {
  return legal.flatMap(m => m.type === 'shipyard' ? [{ planetId: m.planetId, planets: m.planets, tradeGoods: m.tradeGoods }] : [])
}

export function tradePostOffers(legal: Move[]): { post: 'west' | 'east'; commodities: number }[] {
  return legal.flatMap(m => m.type === 'tradePost' ? [{ post: m.post, commodities: m.commodities }] : [])
}

export function statusTemplate(legal: Move[]): StatusParams | null {
  const status = legal.find((m): m is Extract<Move, { type: 'status' }> => m.type === 'status')
  return status ? status.params : null
}
