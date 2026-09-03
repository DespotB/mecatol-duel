import type { FactionId, UnitType } from '../engine/types'

export interface FactionDef {
  id: FactionId; name: string; commodities: number
  startingTechs: string[]
  startingUnits: { type: UnitType; count: number; planetId?: string }[]
  abilities: string[]
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  l1z1x: {
    id: 'l1z1x', name: 'L1Z1X Mindnet', commodities: 2,
    startingTechs: ['neural_motivator', 'plasma_scoring'],
    startingUnits: [
      { type: 'dreadnought', count: 1 }, { type: 'carrier', count: 1 }, { type: 'fighter', count: 3 },
      { type: 'infantry', count: 5, planetId: '000' }, { type: 'spacedock', count: 1, planetId: '000' }, { type: 'pds', count: 1, planetId: '000' },
    ],
    abilities: ['assimilate', 'harrow'],
  },
  letnev: {
    id: 'letnev', name: 'Barony of Letnev', commodities: 2,
    startingTechs: ['antimass_deflectors', 'plasma_scoring'],
    startingUnits: [
      { type: 'dreadnought', count: 1 }, { type: 'carrier', count: 1 }, { type: 'destroyer', count: 1 }, { type: 'fighter', count: 1 },
      { type: 'infantry', count: 2, planetId: 'arc-prime' }, { type: 'infantry', count: 1, planetId: 'wren-terra' }, { type: 'spacedock', count: 1, planetId: 'arc-prime' },
    ],
    abilities: ['munitions_reserves', 'armada'],
  },
}
