import { PUBLIC_OBJECTIVES } from '../data/objectives'
import { otherSeat } from './actionPhase'
import { distributeTokens } from './economy'
import { addVp, controlledPlanets, controlsMecatol, scoreObjective, scoreable } from './objectives'
import { deriveSeed } from './rng'
import { ALL_STRATEGY_CARDS, rollGuardianFleet } from './setup'
import type { GameState, Result, Seat, StatusParams, System } from './types'

// R3.3 step 5 / R4.2: seed salt for the status-phase guardian reroll, kept distinct from other seeded rolls
const GUARDIAN_REROLL_SALT = 91

/** R3.3 step 3: two command tokens, three with Hyper Metabolism. */
export function tokensGained(state: GameState, seat: Seat): number {
  return state.players[seat].techs.includes('hyper_metabolism') ? 3 : 2
}

/** R3.3 step 1: every objective the seat may score, plus 1 VP for Mecatol Rex. */
export function scoreAll(state: GameState, seat: Seat): GameState {
  let next = state
  for (const id of scoreable(state, seat)) next = scoreObjective(next, seat, id)
  if (controlsMecatol(next, seat)) next = addVp(next, seat, 1, 'Mecatol Rex')
  return next
}

/** R7: higher VP, then the Mecatol Rex controller, then more planets, then the speaker's opponent. */
export function decideWinner(state: GameState): Seat {
  const [a, b] = state.players
  if (a.vp !== b.vp) return a.vp > b.vp ? 0 : 1
  if (controlsMecatol(state, 0)) return 0
  if (controlsMecatol(state, 1)) return 1
  const planets: [number, number] = [controlledPlanets(state, 0).length, controlledPlanets(state, 1).length]
  if (planets[0] !== planets[1]) return planets[0] > planets[1] ? 0 : 1
  return otherSeat(state.speaker)
}

/** R7: the check fires at 7 VP and unconditionally after the round 6 status phase. */
export function victoryCheck(state: GameState): Seat | null {
  if (state.players[0].vp < 7 && state.players[1].vp < 7 && state.round < 6) return null
  return decideWinner(state)
}

/** R3.3 steps 2 and 4 to 6, run once both players have submitted their status move. */
export function finishStatusPhase(state: GameState, seed: number): GameState {
  let next = state
  const revealed = PUBLIC_OBJECTIVES[state.round]
  if (state.round < 6 && revealed && !next.publicObjectives.includes(revealed.id)) {
    next = {
      ...next,
      publicObjectives: [...next.publicObjectives, revealed.id],
      log: [...next.log, { t: 'info', text: `objective revealed: ${revealed.text}` }],
    }
  }
  const systems: Record<string, System> = Object.fromEntries(Object.entries(next.systems).map(([id, sys]): [string, System] => [id, {
    ...sys, activatedBy: [], planets: sys.planets.map(p => ({ ...p, exhausted: false })),
  }]))
  const players = [...next.players] as GameState['players']
  for (const seat of [0, 1] as const) {
    players[seat] = {
      ...players[seat], strategyCards: [], passed: false, inheritanceExhausted: false,
      mandateEarnedThisRound: false, spentInOneProductionThisRound: 0, tradedThisRound: { west: false, east: false },
    }
  }
  // R3.1: the played cards come back with bonus 0, the unpicked ones keep the trade goods they collected
  const strategyPool = ALL_STRATEGY_CARDS.map(id => ({ id, bonus: next.strategyPool.find(c => c.id === id)?.bonus ?? 0 }))
  next = { ...next, systems, players, strategyPool, tactical: null, turnDone: false, pendingSecondary: null, statusSubmitted: [] }
  // R3.3 step 5 / R4.2: a fresh guardian fleet as long as nobody controls Mecatol Rex
  if (!controlsMecatol(next, 0) && !controlsMecatol(next, 1)) next = rollGuardianFleet(next, deriveSeed(seed, GUARDIAN_REROLL_SALT))
  const winner = victoryCheck(next)
  if (winner !== null) {
    return { ...next, phase: 'ended', winner, draft: [], log: [...next.log, { t: 'info', text: `seat ${winner} wins with ${next.players[winner].vp} VP` }] }
  }
  // R3.3 step 6 and R3.1: the speaker token moves on and the next round drafts anew
  const speaker = otherSeat(next.speaker)
  const other = otherSeat(speaker)
  return { ...next, round: next.round + 1, phase: 'strategy', speaker, active: speaker, draft: [speaker, other, other, speaker] }
}

// R3.3: the status phase normally opens with `active === speaker` (set by `pass()` on the action phase's last
// pass, and by `toStatusPhase()` in tests), but the phase is closed by counting the submissions in
// `statusSubmitted`, not by comparing the active seat against the speaker: a state that entered the phase on
// the other seat still needs two moves, and no seat may submit twice.
export function status(state: GameState, params: StatusParams, seed: number): Result<GameState> {
  if (state.phase !== 'status') return { ok: false, error: 'not in the status phase' }
  const seat = state.active
  if (state.statusSubmitted.includes(seat)) return { ok: false, error: `R3.3: seat ${seat} has already submitted its status move` }
  const scored = scoreAll(state, seat)
  const distributed = distributeTokens(scored, seat, params.tokens, tokensGained(state, seat))
  if (!distributed.ok) return distributed
  const statusSubmitted = [...state.statusSubmitted, seat]
  const submitted: GameState = { ...distributed.value, statusSubmitted }
  // R3.3: the second submission closes the phase, whichever seat opened it
  if (statusSubmitted.length < 2) return { ok: true, value: { ...submitted, active: otherSeat(seat) } }
  return { ok: true, value: finishStatusPhase(submitted, seed) }
}
