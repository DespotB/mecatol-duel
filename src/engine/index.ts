import { endTactical, pass, startTactical } from './actionPhase'
import { combatRound, retreat } from './combat'
import { research, shipyard, tradePost } from './componentActions'
import { bombard, endInvasion, groundCombatRound, land } from './invasion'
import { endMovement, moveShips } from './movement'
import { produce } from './production'
import { secondary, strategic } from './strategicActions'
import { status } from './statusPhase'
import { pickStrategyCard } from './strategyPhase'
import type { GameState, Move, Result } from './types'

export function applyMove(state: GameState, move: Move, seed: number): Result<GameState> {
  if (state.winner !== null) return { ok: false, error: 'game over' }
  // the move is logged before it is dispatched, so it always precedes the dice rolls it produced; a rejected
  // move returns the error and the caller keeps its untouched state, log entry included
  const logged: GameState = { ...state, log: [...state.log, { t: 'move', seat: state.active, move, seed }] }
  try {
    switch (move.type) {
      case 'pickStrategyCard': return pickStrategyCard(logged, move.card)
      case 'startTactical': return startTactical(logged, move.systemId)
      case 'pass': return pass(logged)
      case 'endTactical': return endTactical(logged)
      case 'moveShips': return moveShips(logged, move.moves)
      case 'endMovement': return endMovement(logged, seed)
      case 'combatRound': return combatRound(logged, move.munitions, seed)
      case 'retreat': return retreat(logged, move.to)
      case 'bombard': return bombard(logged, move.planetId, seed)
      case 'land': return land(logged, move.planetId, move.infantryIds, seed)
      case 'groundCombatRound': return groundCombatRound(logged, seed)
      case 'endInvasion': return endInvasion(logged)
      case 'produce': return produce(logged, move.units, move.planets, move.tradeGoods)
      case 'strategic': return strategic(logged, move.card, move.params)
      case 'secondary': return secondary(logged, move.card, move.accept, move.params)
      case 'research': return research(logged, move.techId)
      case 'shipyard': return shipyard(logged, move.planetId, move.planets, move.tradeGoods)
      case 'tradePost': return tradePost(logged, move.post, move.commodities)
      case 'status': return status(logged, move.params, seed)
      default: {
        // every Move kind is dispatched above; this only runs for a malformed move from outside the type system
        const unknown: never = move
        return { ok: false, error: `not implemented: ${String((unknown as { type?: string }).type)}` }
      }
    }
  } catch (e) {
    // an exception is an engine bug, not a rules rejection; `internal` keeps the two apart for callers
    return { ok: false, error: e instanceof Error ? e.message : String(e), internal: true }
  }
}

export { createGame } from './setup'
export { legalMoves, validateMove } from './legalMoves'
export type * from './types'
