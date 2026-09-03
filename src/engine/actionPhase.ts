import { SYSTEM_IDS, homeSystemId } from '../data/map'
import type { GameState, Result, Seat, Unit } from './types'

export function otherSeat(seat: Seat): Seat {
  return seat === 0 ? 1 : 0
}

/** R3.2: a player may not pass while they still hold an unused strategy card. */
export function canPass(state: GameState, seat: Seat): boolean {
  return state.players[seat].strategyCards.every(c => c.used)
}

/**
 * R4.3 step 4: infantry that rolled their return arrive on the first planet of the home system the seat
 * controls. Reinforcements limit how many actually come back, and a seat that controls nothing at home
 * loses them; the counter is cleared either way.
 */
export function reviveInfantry(state: GameState, seat: Seat): GameState {
  const player = state.players[seat]
  if (player.pendingInfantry < 1) return state
  const homeId = homeSystemId(seat)
  const sys = state.systems[homeId]
  const target = sys.planets.find(p => p.owner === seat)
  const count = Math.min(player.pendingInfantry, player.reinforcements.infantry)
  const players = [...state.players] as GameState['players']
  if (!target || count < 1) {
    players[seat] = { ...player, pendingInfantry: 0 }
    return { ...state, players, log: [...state.log, { t: 'info', text: `seat ${seat} loses ${player.pendingInfantry} returning infantry` }] }
  }
  let nextId = state.nextUnitId
  const revived: Unit[] = []
  for (let i = 0; i < count; i++) revived.push({ id: nextId++, type: 'infantry', owner: seat, damaged: false })
  players[seat] = { ...player, pendingInfantry: 0, reinforcements: { ...player.reinforcements, infantry: player.reinforcements.infantry - count } }
  return {
    ...state, players, nextUnitId: nextId,
    systems: {
      ...state.systems,
      [homeId]: { ...sys, planets: sys.planets.map(p => p.id === target.id ? { ...p, ground: [...p.ground, ...revived] } : p) },
    },
    log: [...state.log, { t: 'info', text: `seat ${seat} returns ${count} infantry to ${target.id}` }],
  }
}

/** The turn goes to the other seat unless that seat has already passed; either way a turn starts (R4.3 step 4). */
export function passTurn(state: GameState): GameState {
  const other = otherSeat(state.active)
  const next: Seat = state.players[other].passed ? state.active : other
  return reviveInfantry({ ...state, active: next }, next)
}

export function activatableSystems(state: GameState, seat: Seat): string[] {
  if (state.players[seat].tokens.tactic < 1) return []
  return SYSTEM_IDS.filter(id => !state.systems[id].activatedBy.includes(seat))
}

export function startTactical(state: GameState, systemId: string): Result<GameState> {
  if (state.phase !== 'action') return { ok: false, error: 'not in the action phase' }
  if (state.tactical) return { ok: false, error: 'a tactical action is already running' }
  const seat = state.active
  const player = state.players[seat]
  if (player.passed) return { ok: false, error: 'this player has passed' }
  const sys = state.systems[systemId]
  if (!sys) return { ok: false, error: `unknown system ${systemId}` }
  if (player.tokens.tactic < 1) return { ok: false, error: 'no tactic token left' }
  if (sys.activatedBy.includes(seat)) return { ok: false, error: `R3.2: ${systemId} already contains your command token` }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, tokens: { ...player.tokens, tactic: player.tokens.tactic - 1 } }
  return {
    ok: true,
    value: {
      ...state,
      players,
      systems: { ...state.systems, [systemId]: { ...sys, activatedBy: [...sys.activatedBy, seat] } },
      tactical: { systemId, step: 'movement' },
    },
  }
}

export function pass(state: GameState): Result<GameState> {
  if (state.phase !== 'action') return { ok: false, error: 'not in the action phase' }
  if (state.tactical) return { ok: false, error: 'finish the tactical action first' }
  const seat = state.active
  if (state.players[seat].passed) return { ok: false, error: 'this player has already passed' }
  if (!canPass(state, seat)) return { ok: false, error: 'R3.2: cannot pass while holding an unused strategy card' }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], passed: true }
  const other = otherSeat(seat)
  if (players[other].passed) return { ok: true, value: { ...state, players, phase: 'status', active: state.speaker } }
  return { ok: true, value: reviveInfantry({ ...state, players, active: other }, other) }
}

export function endTactical(state: GameState): Result<GameState> {
  const tac = state.tactical
  if (state.phase !== 'action' || !tac) return { ok: false, error: 'no tactical action is running' }
  if (tac.step !== 'done' && tac.step !== 'production') return { ok: false, error: `the ${tac.step} step is not finished` }
  return { ok: true, value: passTurn({ ...state, tactical: null }) }
}
