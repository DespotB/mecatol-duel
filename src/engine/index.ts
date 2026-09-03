import { endTactical, pass, startTactical } from './actionPhase'
import { combatRound, retreat } from './combat'
import { endMovement, moveShips } from './movement'
import { pickStrategyCard } from './strategyPhase'
import type { GameState, Move, Result } from './types'

export function applyMove(state: GameState, move: Move, seed: number): Result<GameState> {
  if (state.winner !== null) return { ok: false, error: 'game over' }
  try {
    let result: Result<GameState>
    switch (move.type) {
      case 'pickStrategyCard': result = pickStrategyCard(state, move.card); break
      case 'startTactical': result = startTactical(state, move.systemId); break
      case 'pass': result = pass(state); break
      case 'endTactical': result = endTactical(state); break
      case 'moveShips': result = moveShips(state, move.moves); break
      case 'endMovement': result = endMovement(state); break
      case 'combatRound': result = combatRound(state, move.munitions ?? false, seed); break
      case 'retreat': result = retreat(state, move.to); break
      default: result = { ok: false, error: `not implemented: ${move.type}` }
    }
    if (!result.ok) return result
    return { ok: true, value: { ...result.value, log: [...result.value.log, { t: 'move', seat: state.active, move }] } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export { createGame } from './setup'
export { legalMoves, validateMove } from './legalMoves'
export type * from './types'
