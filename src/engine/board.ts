import { isShip, type StatsOwner } from '../data/units'
import { capacity, fleetPoolLimit, nonFighterShips } from './economy'
import { rollDice, type Rng } from './rng'
import type { DieRoll, GameState, Owner, Result, Seat, System, Unit, UnitType } from './types'

export function statsOwner(state: GameState, owner: Owner): StatsOwner {
  return owner === 'guardian' ? 'guardian' : { faction: state.players[owner].faction, techs: state.players[owner].techs }
}

export function hasTech(state: GameState, owner: Owner, tech: string): boolean {
  return owner !== 'guardian' && state.players[owner].techs.includes(tech)
}

export function shipsOf(sys: System, owner: Owner): Unit[] {
  return sys.space.filter(u => u.owner === owner && isShip(u.type))
}

/** The one dice helper: `dice` dice (Plasma Scoring adds one), a hit on `value` or higher. */
export function rollHits(rng: Rng, dice: number, value: number, extraDie: boolean): { rolls: number[]; hits: number } {
  const rolls = rollDice(rng, Math.max(0, dice + (extraDie ? 1 : 0)))
  return { rolls, hits: rolls.filter(v => v >= value).length }
}

export function dieRolls(owner: Owner, unit: UnitType, rolls: number[], value: number): DieRoll[] {
  return rolls.map(v => ({ owner, unit, value: v, hit: v >= value }))
}

export function removeUnits(state: GameState, systemId: string, ids: number[]): GameState {
  const set = new Set(ids)
  if (!set.size) return state
  const sys = state.systems[systemId]
  return {
    ...state,
    systems: {
      ...state.systems,
      [systemId]: {
        ...sys,
        space: sys.space.filter(u => !set.has(u.id)),
        planets: sys.planets.map(p => ({ ...p, ground: p.ground.filter(u => !set.has(u.id)), structures: p.structures.filter(u => !set.has(u.id)) })),
      },
    },
  }
}

export function returnToReinforcements(state: GameState, units: Unit[]): GameState {
  if (!units.length) return state
  const players = [...state.players] as GameState['players']
  for (const u of units) {
    if (u.owner === 'guardian') continue
    const p = players[u.owner]
    players[u.owner] = { ...p, reinforcements: { ...p.reinforcements, [u.type]: p.reinforcements[u.type] + 1 } }
  }
  return { ...state, players }
}

export function destroyUnits(state: GameState, systemId: string, units: Unit[]): GameState {
  if (!units.length) return state
  return returnToReinforcements(removeUnits(state, systemId, units.map(u => u.id)), units)
}

/** R4.4: Space Dock II lets up to 3 fighters in the system ignore capacity. */
export function freeFighterSlots(state: GameState, seat: Seat, systemId: string): number {
  if (!state.players[seat].techs.includes('space_dock_ii')) return 0
  return state.systems[systemId].planets.some(p => p.structures.some(u => u.type === 'spacedock' && u.owner === seat)) ? 3 : 0
}

/** Capacity for carried fighters and infantry plus the fleet pool for non-fighter ships (Armada +2). */
export function checkFleet(state: GameState, seat: Seat, systemId: string): Result<true> {
  const player = state.players[seat]
  const stats: StatsOwner = { faction: player.faction, techs: player.techs }
  const space = state.systems[systemId].space
  const mine = space.filter(u => u.owner === seat)
  const fighters = mine.filter(u => u.type === 'fighter').length
  const infantry = mine.filter(u => u.type === 'infantry').length
  const cap = capacity(space, seat, stats) + Math.min(freeFighterSlots(state, seat, systemId), fighters)
  let excess = fighters + infantry - cap
  if (excess > 0) {
    // R3.2: only Fighter II turns excess fighters into a fleet pool question instead of an illegal move
    if (!player.techs.includes('fighter_ii') || excess > fighters) return { ok: false, error: `capacity exceeded in ${systemId}` }
  } else excess = 0
  if (nonFighterShips(space, seat) + excess > fleetPoolLimit(player)) return { ok: false, error: `fleet pool exceeded in ${systemId}` }
  return { ok: true, value: true }
}

/** Destroys carried infantry and fighters above the remaining capacity, when a combat ends or a retreat resolves. */
export function trimCargo(state: GameState, systemId: string, owner: Owner): GameState {
  const sys = state.systems[systemId]
  const cap = capacity(sys.space, owner, statsOwner(state, owner))
  const mine = sys.space.filter(u => u.owner === owner)
  const infantry = mine.filter(u => u.type === 'infantry')
  const fighters = mine.filter(u => u.type === 'fighter')
  const keepInfantry = Math.min(infantry.length, cap)
  const keepFighters = hasTech(state, owner, 'fighter_ii') ? fighters.length : Math.min(fighters.length, Math.max(0, cap - keepInfantry))
  return destroyUnits(state, systemId, [...infantry.slice(keepInfantry), ...fighters.slice(keepFighters)])
}
