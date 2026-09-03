import { applyMove } from './index'
import { createGame } from './setup'
import type { GameConfig, GameState, Owner, Player, Seat, StrategyCardId, TacticalContext, Unit, UnitType } from './types'

export function deepFreeze<T>(value: T): T {
  if (value !== null && (typeof value === 'object' || Array.isArray(value)) && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}

export const DUEL_CONFIG: GameConfig = {
  players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }],
  speaker: 0,
}

/** A new game plus the whole snake draft, so the state sits in the action phase with `active` to hand. */
export function toActionPhase(seed = 1, active: Seat = 0): GameState {
  let s = createGame(DUEL_CONFIG, seed)
  for (const card of ['warfare', 'leadership', 'imperial', 'technology'] as StrategyCardId[]) {
    const r = applyMove(s, { type: 'pickStrategyCard', card }, 0)
    if (!r.ok) throw new Error(r.error)
    s = r.value
  }
  return deepFreeze({ ...s, active })
}

/** Places units in a system (in space, or on a planet when planetId is given) and takes them out of the reinforcements. */
export function withUnits(state: GameState, systemId: string, owner: Owner, types: UnitType[], planetId?: string): GameState {
  let nextId = state.nextUnitId
  const sys = state.systems[systemId]
  const made: Unit[] = types.map(type => ({ id: nextId++, type, owner, damaged: false }))
  const players = [...state.players] as GameState['players']
  if (owner !== 'guardian') {
    const p = players[owner]
    const reinforcements = { ...p.reinforcements }
    for (const type of types) reinforcements[type] = Math.max(0, reinforcements[type] - 1)
    players[owner] = { ...p, reinforcements }
  }
  const planets = sys.planets.map(p => p.id !== planetId ? p : {
    ...p,
    ground: [...p.ground, ...made.filter(u => u.type === 'infantry')],
    structures: [...p.structures, ...made.filter(u => u.type !== 'infantry')],
  })
  return deepFreeze({
    ...state, players, nextUnitId: nextId,
    systems: { ...state.systems, [systemId]: { ...sys, space: planetId ? sys.space : [...sys.space, ...made], planets } },
  })
}

export function withTechs(state: GameState, seat: Seat, techs: string[]): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], techs: [...players[seat].techs, ...techs] }
  return deepFreeze({ ...state, players })
}

export function withPlayer(state: GameState, seat: Seat, patch: Partial<Player>): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], ...patch }
  return deepFreeze({ ...state, players })
}

export function withTactical(state: GameState, tactical: TacticalContext | null): GameState {
  return deepFreeze({ ...state, tactical })
}

export function withPlanetOwner(state: GameState, systemId: string, planetId: string, owner: Seat | null): GameState {
  const sys = state.systems[systemId]
  return deepFreeze({
    ...state,
    systems: { ...state.systems, [systemId]: { ...sys, planets: sys.planets.map(p => p.id === planetId ? { ...p, owner } : p) } },
  })
}

export function cardsUsed(state: GameState): GameState {
  return deepFreeze({
    ...state,
    players: state.players.map(p => ({ ...p, strategyCards: p.strategyCards.map(c => ({ ...c, used: true })) })) as GameState['players'],
  })
}

export function shipId(state: GameState, systemId: string, type: UnitType, owner: Owner = 0): number {
  const unit = state.systems[systemId].space.find(u => u.type === type && u.owner === owner)
  if (!unit) throw new Error(`no ${type} of ${String(owner)} in ${systemId}`)
  return unit.id
}

export function groundIds(state: GameState, systemId: string, planetId: string, owner: Owner = 0): number[] {
  return state.systems[systemId].planets
    .filter(p => p.id === planetId)
    .flatMap(p => p.ground.filter(u => u.owner === owner).map(u => u.id))
}

export function carriedIds(state: GameState, systemId: string, owner: Owner = 0): number[] {
  return state.systems[systemId].space.filter(u => u.owner === owner && u.type === 'infantry').map(u => u.id)
}

export function hitsIn(state: GameState, context: string): number {
  return state.log.flatMap(e => e.t === 'roll' && e.context === context ? e.rolls : []).filter(r => r.hit).length
}
