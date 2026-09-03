import { pickStrategyCard } from './strategyPhase'
import type { GameState, Move, Result } from './types'

export function applyMove(state: GameState, move: Move, seed: number): Result<GameState> {
  void seed   // used by later plans for dice
  if (state.winner !== null) return { ok: false, error: 'game over' }
  let result: Result<GameState>
  switch (move.type) {
    case 'pickStrategyCard': result = pickStrategyCard(state, move.card); break
    default: result = { ok: false, error: `not implemented: ${move.type}` }
  }
  if (!result.ok) return result
  return { ok: true, value: { ...result.value, log: [...result.value.log, { t: 'move', seat: state.active, move }] } }
}

export { createGame } from './setup'
export { legalMoves, validateMove } from './legalMoves'
export type * from './types'
