import type { GameState, Move, Result } from './types'

export function legalMoves(state: GameState): Move[] {
  if (state.winner !== null) return []
  if (state.phase === 'strategy') {
    const seat = state.draft[0]
    if (seat === undefined || seat !== state.active) return []
    return state.strategyPool.map(c => ({ type: 'pickStrategyCard', card: c.id }))
  }
  return []   // action and status phase moves are added by later plans
}

export function validateMove(state: GameState, move: Move): Result<true> {
  const ok = legalMoves(state).some(m => JSON.stringify(m) === JSON.stringify(move))
  return ok ? { ok: true, value: true } : { ok: false, error: `illegal move ${move.type}` }
}
