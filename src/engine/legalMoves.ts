import { activatableSystems, canPass } from './actionPhase'
import type { GameState, Move, Result } from './types'

export function legalMoves(state: GameState): Move[] {
  if (state.winner !== null) return []
  if (state.phase === 'strategy') {
    const seat = state.draft[0]
    if (seat === undefined || seat !== state.active) return []
    return state.strategyPool.map(c => ({ type: 'pickStrategyCard', card: c.id }))
  }
  if (state.phase !== 'action') return []   // status phase moves are added by later plans
  const seat = state.active
  if (state.players[seat].passed) return []
  const tac = state.tactical
  if (!tac) {
    const out: Move[] = activatableSystems(state, seat).map(id => ({ type: 'startTactical', systemId: id }))
    if (canPass(state, seat)) out.push({ type: 'pass' })
    return out
  }
  if (tac.step === 'done' || tac.step === 'production') return [{ type: 'endTactical' }]
  return []
}

export function validateMove(state: GameState, move: Move): Result<true> {
  const ok = legalMoves(state).some(m => JSON.stringify(m) === JSON.stringify(move))
  return ok ? { ok: true, value: true } : { ok: false, error: `illegal move ${move.type}` }
}
