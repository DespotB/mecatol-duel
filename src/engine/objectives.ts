import { MECATOL_ID, systemDef } from '../data/map'
import { MANDATE, PUBLIC_OBJECTIVES } from '../data/objectives'
import { NON_FIGHTER_SHIPS } from '../data/units'
import { colourCounts } from './research'
import type { GameState, Seat } from './types'

export function controlledPlanets(state: GameState, seat: Seat): { systemId: string; planetId: string }[] {
  const out: { systemId: string; planetId: string }[] = []
  for (const sys of Object.values(state.systems)) {
    for (const p of sys.planets) if (p.owner === seat) out.push({ systemId: sys.id, planetId: p.id })
  }
  return out
}

export function controlsMecatol(state: GameState, seat: Seat): boolean {
  return state.systems[MECATOL_ID].planets.some(p => p.owner === seat)
}

/** R7: the six public objectives and the Mandate. An unknown id is false, never a throw. */
export function fulfils(state: GameState, seat: Seat, objectiveId: string): boolean {
  const player = state.players[seat]
  switch (objectiveId) {
    case 'own_3_techs':
      return player.techs.length >= 3
    case 'control_4_outside_home':
      return controlledPlanets(state, seat).filter(p => systemDef(p.systemId).home !== seat).length >= 4
    case 'three_ships_mecatol':
      return state.systems[MECATOL_ID].space.filter(u => u.owner === seat && NON_FIGHTER_SHIPS.includes(u.type)).length >= 3
    case 'spend_6_production':
      return player.spentInOneProductionThisRound >= 6
    case 'control_5_planets':
      return controlledPlanets(state, seat).length >= 5
    case 'two_techs_same_colour':
      return Object.values(colourCounts(player.techs)).some(n => n >= 2)
    case MANDATE.id:
      return player.mandateEarnedThisRound
    default:
      return false
  }
}

/** R3.3 step 1: what the seat may score right now, each public objective once per game. */
export function scoreable(state: GameState, seat: Seat): string[] {
  const player = state.players[seat]
  const out = state.publicObjectives.filter(id => !player.scoredObjectives.includes(id) && fulfils(state, seat, id))
  if (!player.mandateScored && fulfils(state, seat, MANDATE.id)) out.push(MANDATE.id)
  return out
}

export function addVp(state: GameState, seat: Seat, points: number, reason: string): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], vp: players[seat].vp + points }
  return { ...state, players, log: [...state.log, { t: 'info', text: `seat ${seat} scores ${points} VP: ${reason}` }] }
}

/** R7: records the objective (or the Mandate) and adds its victory point. Fulfilment is checked by the caller. */
export function scoreObjective(state: GameState, seat: Seat, objectiveId: string): GameState {
  const players = [...state.players] as GameState['players']
  const player = players[seat]
  players[seat] = objectiveId === MANDATE.id
    ? { ...player, mandateScored: true }
    : { ...player, scoredObjectives: [...player.scoredObjectives, objectiveId] }
  const def = PUBLIC_OBJECTIVES.find(o => o.id === objectiveId)
  return addVp({ ...state, players }, seat, 1, def ? def.text : MANDATE.text)
}
