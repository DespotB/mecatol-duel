import type { GameState, LogEntry } from '../engine/types'

export function moveCount(state: GameState): number {
  return state.log.reduce((n, e) => e.t === 'move' ? n + 1 : n, 0)
}

export function rollCount(state: GameState): number {
  return state.log.reduce((n, e) => e.t === 'roll' ? n + 1 : n, 0)
}

/**
 * lobby-architecture.md 2.8: hot-seat may take a move back by truncating the local log, but dice are final
 * and a turn that has already passed to the other seat is closed. Undo never crosses a phase boundary
 * either: a move that closes the strategy phase (or any other phase) is final even when the seat that
 * becomes active happens to coincide with the seat that was active before it.
 *
 * R8: a post's special ability is final for the same reason dice are. It is once per round for the whole
 * table, so taking it back would buy a free look at what the ability does and let the other seat be locked
 * out and unlocked at will; the layover and the time trade also move the chess clock, which the game state
 * does not carry and an undo therefore could not put back.
 */
export function undoable(previous: GameState, next: GameState): boolean {
  return next.active === previous.active && next.phase === previous.phase && rollCount(next) === rollCount(previous)
    && next.postAbilityUsed.west === previous.postAbilityUsed.west
    && next.postAbilityUsed.east === previous.postAbilityUsed.east
}

/** The dice of the last move: the trailing run of roll entries in the log. */
export function lastRolls(state: GameState): Extract<LogEntry, { t: 'roll' }>[] {
  const out: Extract<LogEntry, { t: 'roll' }>[] = []
  for (let i = state.log.length - 1; i >= 0; i--) {
    const entry = state.log[i]
    if (entry.t === 'roll') out.unshift(entry)
    else if (entry.t === 'move') break
  }
  return out
}
