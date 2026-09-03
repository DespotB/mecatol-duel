import { applyMove, createGame, deriveSeed, legalMoves } from '../engine'
import { moveCount } from './history'
import type { GameConfig, GameState, Move, Result } from '../engine/types'

/** The turn is spent and nothing free is left: only ending it remains, so the UI does not ask. */
function onlyEndTurn(state: GameState): boolean {
  const moves = legalMoves(state)
  return moves.length === 1 && moves[0].type === 'endTurn'
}

/**
 * One submitted move and everything that follows from it on its own.
 *
 * R3.2: an action ends the action, not the turn, so the player can still take a free move such as a trade
 * post sale. When nothing free is open, ending the turn is the only thing left and asking for a click (in
 * hot-seat: a device handoff) buys nothing, so the engine's own verdict decides it here. A free move is the
 * player's own detour, so it never ends the turn behind their back: after a trade or a post's special
 * ability they press End turn themselves.
 *
 * This is the whole of what a move means, and both the browser that submits it and the browser that later
 * receives it over the wire go through here. Anything a submitting client did that a replaying client did
 * not would be a board that differs between the two, which is the one failure this design cannot absorb.
 * Every seed is derived from the game seed and the number of moves already logged, so the dice fall the
 * same way in both.
 */
export function advance(state: GameState, move: Move, gameSeed: number): Result<GameState> {
  const result = applyMove(state, move, deriveSeed(gameSeed, moveCount(state)))
  if (!result.ok) return result
  let next = result.value
  const free = move.type === 'tradePost' || move.type === 'postAbility'
  while (!free && next.winner === null && onlyEndTurn(next)) {
    const ended = applyMove(next, { type: 'endTurn' }, deriveSeed(gameSeed, moveCount(next)))
    if (!ended.ok) break
    next = ended.value
  }
  return { ok: true, value: next }
}

/**
 * A game rebuilt from what the server stores: its config, its seed and the moves in order. Joining,
 * reconnecting and refreshing are all this one operation, which is what the deterministic engine buys.
 * A move the rules reject means the log and this build disagree, so it stops there and says so rather
 * than handing back half a game.
 */
export function replay(config: GameConfig, seed: number, moves: Move[]): Result<GameState> {
  let state = createGame(config, seed)
  for (const [i, move] of moves.entries()) {
    const result = advance(state, move, seed)
    if (!result.ok) return { ok: false, error: `move ${String(i)} does not apply: ${result.error}` }
    state = result.value
  }
  return { ok: true, value: state }
}
