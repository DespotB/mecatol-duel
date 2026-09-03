import type { FactionId, UnitStats, UnitType } from '../engine/types'

const base = (p: Partial<UnitStats>): UnitStats => ({
  cost: 0, producedPerCost: 1, combat: null, combatDice: 1, move: 0, capacity: 0, sustain: false,
  bombardment: null, afb: null, spaceCannon: null, planetaryShield: false, production: null, ...p,
})

const LEVEL_I: Record<UnitType, UnitStats> = {
  infantry: base({ cost: 1, producedPerCost: 2, combat: 8 }),
  fighter: base({ cost: 1, producedPerCost: 2, combat: 9 }),
  destroyer: base({ cost: 1, combat: 9, move: 2, afb: { value: 9, dice: 2 } }),
  cruiser: base({ cost: 2, combat: 7, move: 2 }),
  carrier: base({ cost: 3, combat: 9, move: 1, capacity: 4 }),
  dreadnought: base({ cost: 4, combat: 5, move: 1, capacity: 1, sustain: true, bombardment: { value: 5, dice: 1 } }),
  warsun: base({ cost: 12, combat: 3, combatDice: 3, move: 2, capacity: 6, sustain: true, bombardment: { value: 3, dice: 3 } }),
  flagship: base({ cost: 8, combat: 5, combatDice: 2, move: 1, capacity: 3, sustain: true }),
  pds: base({ spaceCannon: { value: 6, dice: 1 }, planetaryShield: true }),
  spacedock: base({ production: 2 }),
}

const LEVEL_II: Partial<Record<UnitType, Partial<UnitStats>>> = {
  infantry: { combat: 7 },
  fighter: { combat: 8, move: 2 },
  destroyer: { combat: 8, afb: { value: 6, dice: 3 } },
  cruiser: { combat: 6, move: 3, capacity: 1 },
  carrier: { move: 2, capacity: 6 },
  dreadnought: { move: 2 },
  spacedock: { production: 4 },
}

export const UPGRADE_TECH: Partial<Record<UnitType, string>> = {
  infantry: 'infantry_ii', fighter: 'fighter_ii', destroyer: 'destroyer_ii', cruiser: 'cruiser_ii',
  carrier: 'carrier_ii', dreadnought: 'dreadnought_ii', spacedock: 'space_dock_ii',
}

const FLAGSHIPS: Record<FactionId, UnitStats> = {
  l1z1x: base({ cost: 8, combat: 5, combatDice: 2, move: 1, capacity: 5, sustain: true }),
  letnev: base({ cost: 8, combat: 5, combatDice: 2, move: 1, capacity: 3, sustain: true, bombardment: { value: 5, dice: 3 } }),
}

const SUPER_DREADNOUGHT_I = base({ cost: 4, combat: 5, move: 1, capacity: 2, sustain: true, bombardment: { value: 5, dice: 1 } })
const SUPER_DREADNOUGHT_II = base({ cost: 4, combat: 4, move: 2, capacity: 2, sustain: true, bombardment: { value: 4, dice: 1 } })

export type StatsOwner = { faction: FactionId; techs: string[] } | 'guardian'

export function unitStats(type: UnitType, owner: StatsOwner): Readonly<UnitStats> {
  if (owner === 'guardian') return LEVEL_I[type]
  if (type === 'flagship') return FLAGSHIPS[owner.faction]
  if (type === 'dreadnought' && owner.faction === 'l1z1x') {
    return owner.techs.includes('super_dreadnought_ii') ? SUPER_DREADNOUGHT_II : SUPER_DREADNOUGHT_I
  }
  const upgrade = UPGRADE_TECH[type]
  if (upgrade && owner.techs.includes(upgrade) && LEVEL_II[type]) return { ...LEVEL_I[type], ...LEVEL_II[type] }
  return LEVEL_I[type]
}

export const SHIP_TYPES: readonly UnitType[] = ['fighter', 'destroyer', 'cruiser', 'carrier', 'dreadnought', 'warsun', 'flagship']
export const NON_FIGHTER_SHIPS: readonly UnitType[] = ['destroyer', 'cruiser', 'carrier', 'dreadnought', 'warsun', 'flagship']
export function isShip(type: UnitType): boolean { return SHIP_TYPES.includes(type) }

/**
 * Cheapest hull first: the order every rule follows that has to give a ship up rather than choose one, from
 * a hit the engine assigns itself to a fleet pool that no longer holds the fleet standing in it.
 */
export const DESTROY_ORDER: readonly UnitType[] = ['fighter', 'destroyer', 'cruiser', 'carrier', 'dreadnought', 'flagship', 'warsun']
export const NON_FIGHTER_ORDER: readonly UnitType[] = DESTROY_ORDER.filter(t => t !== 'fighter')
