import { systemDef } from '../data/map'
import { techDef } from '../data/techs'
import { UPGRADE_TECH } from '../data/units'
import { readyInfluence } from '../engine'
import type { GameState, Planet, Player, Seat, StrategyCardId, UnitType } from '../engine/types'

export { readyInfluence }

export const CARD_NAME: Record<StrategyCardId, string> = {
  leadership: 'Leadership', diplomacy: 'Diplomacy', trade: 'Trade',
  warfare: 'Warfare', technology: 'Technology', imperial: 'Imperial',
}

const UNIT_NAME: Record<UnitType, string> = {
  infantry: 'Infantry', fighter: 'Fighter', destroyer: 'Destroyer', cruiser: 'Cruiser',
  carrier: 'Carrier', dreadnought: 'Dreadnought', warsun: 'War Sun', flagship: 'Flagship',
  pds: 'PDS', spacedock: 'Space dock',
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** R5: the label follows the owner's technologies, so an upgraded unit reads II. */
export function unitLabel(type: UnitType, player: Player): string {
  if (type === 'flagship') return player.faction === 'l1z1x' ? 'Flagship [0.0.1]' : 'Flagship Arc Secundus'
  if (type === 'dreadnought' && player.faction === 'l1z1x') {
    return player.techs.includes('super_dreadnought_ii') ? 'Super-Dreadnought II' : 'Super-Dreadnought I'
  }
  const upgrade = UPGRADE_TECH[type]
  const two = upgrade !== undefined && player.techs.includes(upgrade)
  if (type === 'pds') return 'PDS'
  if (type === 'spacedock') return two ? 'Space dock II' : 'Space dock'
  return two ? `${UNIT_NAME[type]} II` : `${UNIT_NAME[type]} I`
}

export function techLabel(techId: string): string {
  return techDef(techId).name
}

export function planetLabel(state: GameState, planetId: string): string {
  for (const sys of Object.values(state.systems)) {
    const planet = sys.planets.find(p => p.id === planetId)
    if (planet) return planet.name
  }
  return planetId
}

export function systemLabel(systemId: string): string {
  return systemDef(systemId).name
}

export function ownedPlanets(state: GameState, seat: Seat): Planet[] {
  return Object.values(state.systems).flatMap(sys => sys.planets.filter(p => p.owner === seat))
}
