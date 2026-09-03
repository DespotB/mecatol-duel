import { systemDef } from '../data/map'
import { isShip, unitStats, type StatsOwner } from '../data/units'
import { neighbours } from './adjacency'
import { checkFleet } from './board'
import type { GameState, Result, Seat, System, Unit } from './types'

export interface MoveSpec { unitId: number; from: string; carrying: number[] }

function passable(state: GameState, seat: Seat, id: string, destination: boolean, antimass: boolean): boolean {
  const def = systemDef(id)
  if (def.anomaly === 'asteroid' && !antimass) return false                       // R1: asteroid field
  if (!destination && def.anomaly === 'nebula') return false                      // R1: a ship entering a nebula must end there
  if (destination) return true
  return !state.systems[id].space.some(u => u.owner !== seat && isShip(u.type))   // R3.2: no moving through enemy or guardian ships
}

/** Shortest legal path length in steps, or null when the destination is out of reach. */
export function pathLength(state: GameState, seat: Seat, from: string, to: string, moveValue: number): number | null {
  if (from === to || moveValue < 1) return null
  const antimass = state.players[seat].techs.includes('antimass_deflectors')
  if (!passable(state, seat, to, true, antimass)) return null
  const seen = new Set([from])
  let frontier = [from]
  for (let d = 1; d <= moveValue && frontier.length; d++) {
    const next: string[] = []
    for (const id of frontier) for (const n of neighbours(id)) {
      if (n === to) return d
      if (seen.has(n)) continue
      seen.add(n)
      if (passable(state, seat, n, false, antimass)) next.push(n)
    }
    frontier = next
  }
  return null
}

function moveValueOf(state: GameState, seat: Seat, unit: Unit, from: string): number {
  const player = state.players[seat]
  const stats = unitStats(unit.type, { faction: player.faction, techs: player.techs })
  return systemDef(from).anomaly === 'nebula' ? Math.min(stats.move, 1) : stats.move
}

/** Every ship of the seat that could reach the active system this activation. */
export function movableShips(state: GameState, seat: Seat): { unitId: number; from: string }[] {
  const tac = state.tactical
  if (!tac || tac.step !== 'movement') return []
  const bonus = state.players[seat].techs.includes('gravity_drive') ? 1 : 0
  const out: { unitId: number; from: string }[] = []
  for (const sys of Object.values(state.systems)) {
    if (sys.id === tac.systemId || sys.activatedBy.includes(seat)) continue
    for (const u of sys.space) {
      if (u.owner !== seat || !isShip(u.type)) continue
      if (pathLength(state, seat, sys.id, tac.systemId, moveValueOf(state, seat, u, sys.id) + bonus) !== null) {
        out.push({ unitId: u.id, from: sys.id })
      }
    }
  }
  return out
}

export function moveShips(state: GameState, specs: MoveSpec[]): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'movement') return { ok: false, error: 'not in the movement step' }
  const seat = state.active
  const player = state.players[seat]
  const stats: StatsOwner = { faction: player.faction, techs: player.techs }
  let gravityDrive = player.techs.includes('gravity_drive')
  const taken = new Set<number>()
  const arriving: Unit[] = []
  for (const spec of specs) {
    const src = state.systems[spec.from]
    if (!src) return { ok: false, error: `unknown system ${spec.from}` }
    if (spec.from === tac.systemId) return { ok: false, error: 'ships in the active system do not move' }
    if (src.activatedBy.includes(seat)) return { ok: false, error: `R3.2: ships in ${spec.from} already carry your command token` }
    const ship = src.space.find(u => u.id === spec.unitId && u.owner === seat && isShip(u.type))
    if (!ship || taken.has(ship.id)) return { ok: false, error: `no movable ship ${spec.unitId} in ${spec.from}` }
    const value = moveValueOf(state, seat, ship, spec.from)
    if (value < 1) return { ok: false, error: `a ${ship.type} cannot move on its own` }
    let steps = pathLength(state, seat, spec.from, tac.systemId, value)
    if (steps === null && gravityDrive) {
      steps = pathLength(state, seat, spec.from, tac.systemId, value + 1)
      if (steps !== null) gravityDrive = false     // R3.2: Gravity Drive helps one ship per activation
    }
    if (steps === null) return { ok: false, error: `${ship.type} ${ship.id} cannot reach ${tac.systemId}` }
    taken.add(ship.id)
    arriving.push(ship)
    if (spec.carrying.length > unitStats(ship.type, stats).capacity) return { ok: false, error: `${ship.type} ${ship.id} carries more than its capacity` }
    for (const id of spec.carrying) {
      const cargo = src.space.find(u => u.id === id) ?? src.planets.flatMap(p => p.ground).find(u => u.id === id)
      if (!cargo || cargo.owner !== seat || (cargo.type !== 'fighter' && cargo.type !== 'infantry')) return { ok: false, error: `unit ${id} cannot be carried` }
      if (taken.has(id)) return { ok: false, error: `unit ${id} is carried twice` }
      taken.add(id)
      arriving.push(cargo)
    }
  }
  if (!arriving.length) return { ok: false, error: 'no ships moved' }
  const systems: Record<string, System> = {}
  for (const [id, sys] of Object.entries(state.systems)) {
    systems[id] = {
      ...sys,
      space: sys.space.filter(u => !taken.has(u.id)),
      planets: sys.planets.map(p => p.ground.some(u => taken.has(u.id)) ? { ...p, ground: p.ground.filter(u => !taken.has(u.id)) } : p),
    }
  }
  const dest = systems[tac.systemId]
  systems[tac.systemId] = { ...dest, space: [...dest.space, ...arriving] }
  const next: GameState = { ...state, systems }
  const fleet = checkFleet(next, seat, tac.systemId)
  if (!fleet.ok) return { ok: false, error: fleet.error }
  return { ok: true, value: next }
}

export function endMovement(state: GameState): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'movement') return { ok: false, error: 'not in the movement step' }
  const seat = state.active
  const sys = state.systems[tac.systemId]
  const mine = sys.space.filter(u => u.owner === seat && isShip(u.type))
  const foes = sys.space.filter(u => u.owner !== seat && isShip(u.type))
  if (mine.length && foes.length) {
    const combat = { round: 0, attacker: seat, defender: foes[0].owner, retreating: null, retreatTo: null, lastRolls: [] }
    return { ok: true, value: { ...state, tactical: { ...tac, step: 'spaceCombat', combat } } }
  }
  return { ok: true, value: { ...state, tactical: { ...tac, step: 'invasion', invasion: { planetId: null, landed: [], bombarded: [] } } } }
}
