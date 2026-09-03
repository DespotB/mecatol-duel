import { NON_FIGHTER_SHIPS, isShip, unitStats, type StatsOwner } from '../data/units'
import type { GameState, Owner, Player, Result, Seat, Unit, UnitType } from './types'

export function readyResources(state: GameState, seat: Seat): number {
  let sum = 0
  for (const sys of Object.values(state.systems)) for (const p of sys.planets) if (p.owner === seat && !p.exhausted) sum += p.resources
  return sum
}

export function payCost(state: GameState, seat: Seat, cost: number, planets: string[], tradeGoods: number): Result<GameState> {
  const player = state.players[seat]
  if (tradeGoods < 0 || tradeGoods > player.tradeGoods) return { ok: false, error: 'not enough trade goods' }
  let paid = tradeGoods
  const systems = { ...state.systems }
  for (const planetId of planets) {
    const sysId = Object.keys(systems).find(id => systems[id].planets.some(p => p.id === planetId))
    if (!sysId) return { ok: false, error: `unknown planet ${planetId}` }
    const sys = systems[sysId]
    const planet = sys.planets.find(p => p.id === planetId)
    if (!planet || planet.owner !== seat) return { ok: false, error: `planet ${planetId} not controlled` }
    if (planet.exhausted) return { ok: false, error: `planet ${planetId} is exhausted` }
    paid += planet.resources
    systems[sysId] = { ...sys, planets: sys.planets.map(p => p.id === planetId ? { ...p, exhausted: true } : p) }
  }
  if (paid < cost) return { ok: false, error: `paid ${paid} of ${cost}` }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, tradeGoods: player.tradeGoods - tradeGoods }
  return { ok: true, value: { ...state, systems, players } }
}

export function productionCost(units: Partial<Record<UnitType, number>>, owner: StatsOwner, sarween: boolean): number {
  let cost = 0
  for (const [type, n] of Object.entries(units) as [UnitType, number][]) {
    if (!n) continue
    const s = unitStats(type, owner)
    cost += Math.ceil(n / s.producedPerCost) * s.cost
  }
  return sarween ? Math.max(0, cost - 1) : cost
}

export function productionLimit(state: GameState, seat: Seat, systemId: string): number {
  const player = state.players[seat]
  const sys = state.systems[systemId]
  if (!sys) return 0
  for (const p of sys.planets) {
    const dock = p.structures.find(u => u.type === 'spacedock' && u.owner === seat)
    if (dock) return p.resources + (unitStats('spacedock', { faction: player.faction, techs: player.techs }).production ?? 0)
  }
  return 0
}

export function fleetPoolLimit(player: Player): number {
  return player.tokens.fleet + (player.faction === 'letnev' ? 2 : 0)
}

export function nonFighterShips(units: Unit[], owner: Owner): number {
  return units.filter(u => u.owner === owner && NON_FIGHTER_SHIPS.includes(u.type)).length
}

export function capacity(units: Unit[], owner: Owner, stats: StatsOwner): number {
  return units.filter(u => u.owner === owner && isShip(u.type)).reduce((sum, u) => sum + unitStats(u.type, stats).capacity, 0)
}
