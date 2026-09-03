import type { Color, FactionId, Owner, StrategyCardId, UnitType } from '../engine/types'

export const CARD_NUMBER: Record<StrategyCardId, number> = {
  leadership: 1, diplomacy: 2, trade: 5, warfare: 6, technology: 7, imperial: 8,
}

const TILE_FILE: Record<string, string> = {
  'home-n': '06_000.png', bereg: '35_Bereg.png', sakulag: '44_Asteroids.png', mecatol: '18_MR.png',
  quann: '42_Nebula.png', starpoint: '00_blue.png', 'home-s': '10_ArcPime.png',
}

/** Planet art for the systems whose tile does not print the planet (R1: composed tiles). */
const PLANET_FILE: Record<string, string> = {
  sakulag: 'planet_Sakulag.png', quann: 'planet_Quann.png',
  starpoint: 'planet_Starpoint.png', centauri: 'planet_Vefut.png',
}

/** The card file names do not follow the technology ids, so the mapping is explicit. */
const TECH_FILE: Record<string, string> = {
  antimass_deflectors: 'tech_antimass_deflectors.png', gravity_drive: 'tech_gravity_drive.png',
  fleet_logistics: 'tech_fleet_logistics.png', light_wave_deflector: 'tech_lightwave_deflector.png',
  plasma_scoring: 'tech_plasma_scoring.png', magen_defense_grid: 'tech_magen_defense_grid.png',
  duranium_armor: 'tech_duranium_armor.png', assault_cannon: 'tech_assault_cannon.png',
  neural_motivator: 'tech_neural_motivator.png', dacxive_animators: 'tech_dacxive_animators.png',
  hyper_metabolism: 'tech_hyper_metabolism.png', x89_bacterial_weapon: 'tech_x89_bacterial_weapon.png',
  sarween_tools: 'tech_sarween_tools.png', graviton_laser_system: 'tech_graviton_laser_system.png',
  transit_diodes: 'tech_transit_diodes.png', integrated_economy: 'tech_integrated_economy.png',
  infantry_ii: 'tech_infantry_2.jpg', fighter_ii: 'tech_fighter_2.jpg', destroyer_ii: 'tech_destroyer_2.jpg',
  cruiser_ii: 'tech_cruiser_2.jpg', carrier_ii: 'tech_carrier_2.jpg', dreadnought_ii: 'tech_dreadnought_2.jpg',
  space_dock_ii: 'tech_spacedock_2.jpg', war_sun: 'tech_warsun.jpg',
  inheritance_systems: 'tech_faction_inheritance_systems.jpg',
  super_dreadnought_ii: 'tech_faction_superdreadnought_2.jpg',
  l4_disruptors: 'tech_faction_l4_disruptors.jpg',
  non_euclidean_shielding: 'tech_faction_noneuclidean_shielding.jpg',
}

/** Reference cards for the production drawer; `flagship` is resolved by faction before this lookup. */
const UNIT_CARD: Record<UnitType, string> = {
  infantry: 'unit_generic_infantry.png', fighter: 'unit_generic_fighter.png',
  destroyer: 'unit_generic_destroyer.png', cruiser: 'unit_generic_cruiser.png',
  carrier: 'unit_generic_carrier.png', dreadnought: 'unit_generic_dreadnought.png',
  warsun: 'unit_generic_warsun_0.png', flagship: 'unit_generic_dreadnought.png',
  pds: 'unit_generic_pds.png', spacedock: 'unit_generic_spacedock.png',
}

export const MISC = {
  starfield: '/assets/misc/starfield.png',
  tradeGood: '/assets/misc/emoji_tg.png',
  commodity: '/assets/misc/emoji_comm.png',
  speaker: '/assets/misc/emoji_SpeakerToken.png',
  alpha: '/assets/misc/emoji_WHalpha.png',
  beta: '/assets/misc/emoji_WHbeta.png',
  anomaly: '/assets/tiles/tile_anomaly_chevron.png',
  objectiveBack: '/assets/cards/cardback_public1.png',
  mandateBack: '/assets/cards/cardback_secret.jpg',
}

export const BADGE = {
  resourceReady: '/assets/cards/pc_res_rdy.png',
  resourceExhausted: '/assets/cards/pc_res_exh.png',
  influenceReady: '/assets/cards/pc_inf_rdy.png',
  influenceExhausted: '/assets/cards/pc_inf_exh.png',
}

export const PORTRAIT: Record<FactionId, string> = {
  l1z1x: '/assets/factions/leader_l1z1x_commander.png',
  letnev: '/assets/factions/leader_letnev_commander.png',
}
export const SIGIL: Record<FactionId, string> = {
  l1z1x: '/assets/factions/l1z1x.png',
  letnev: '/assets/factions/letnev.png',
}

export function tileUrl(systemId: string): string {
  return `/assets/tiles/${TILE_FILE[systemId]}`
}
export function planetArtUrl(planetId: string): string | null {
  const file = PLANET_FILE[planetId]
  return file ? `/assets/tiles/${file}` : null
}
export function spriteUrl(colour: Color | 'grey', type: UnitType): string {
  return `/assets/sprites/${colour}_${type}.png`
}
export function tokenUrl(faction: FactionId, kind: 'command' | 'command-fleet' | 'control'): string {
  return `/assets/tokens/${faction}_${kind}.png`
}
export function strategyCardUrl(card: StrategyCardId): string {
  return `/assets/cards/strat_base_game_${CARD_NUMBER[card]}.png`
}
export function techArtUrl(techId: string): string {
  return `/assets/cards/${TECH_FILE[techId] ?? 'cardback_public2.png'}`
}
export function unitCardUrl(type: UnitType, faction: FactionId): string {
  if (type === 'flagship') {
    return faction === 'l1z1x'
      ? '/assets/factions/unit_l1z1x_flagship_001.png'
      : '/assets/factions/unit_letnev_flagship_arc_secundus.png'
  }
  if (type === 'dreadnought' && faction === 'l1z1x') return '/assets/factions/unit_l1z1x_superdreadnought.jpg'
  return `/assets/cards/${UNIT_CARD[type]}`
}
export function ownerKey(owner: Owner): string {
  return owner === 'guardian' ? 'guardian' : String(owner)
}
