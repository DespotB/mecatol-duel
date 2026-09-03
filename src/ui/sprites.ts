import type { UnitType } from '../engine/types'

export interface SpriteDef { pxPerModelUnit: number; spriteW: number; spriteH: number }

/** Copy of public/assets/sprites/manifest.json (`units`); src/ui/sprites.test.ts keeps the two in step. */
export const SPRITES: Record<UnitType, SpriteDef> = {
  dreadnought: { pxPerModelUnit: 144.4, spriteW: 548, spriteH: 503 },
  carrier: { pxPerModelUnit: 188.59, spriteW: 593, spriteH: 587 },
  cruiser: { pxPerModelUnit: 198.59, spriteW: 563, spriteH: 566 },
  destroyer: { pxPerModelUnit: 222.68, spriteW: 555, spriteH: 451 },
  fighter: { pxPerModelUnit: 357.26, spriteW: 826, spriteH: 517 },
  flagship: { pxPerModelUnit: 130.02, spriteW: 559, spriteH: 496 },
  warsun: { pxPerModelUnit: 156.33, spriteW: 505, spriteH: 606 },
  infantry: { pxPerModelUnit: 255.99, spriteW: 552, spriteH: 660 },
  spacedock: { pxPerModelUnit: 238.5, spriteW: 528, spriteH: 651 },
  pds: { pxPerModelUnit: 304.84, spriteW: 590, spriteH: 465 },
}

/** Board pixels per model unit. The manifest's scale is what makes a fighter small next to a dreadnought. */
export const BOARD_SCALE = 11.6
/** The side panels and the production drawer show the same models smaller. */
export const PANEL_SCALE = 10.4

export function spriteSize(type: UnitType, scale: number = BOARD_SCALE): { width: number; height: number } {
  const def = SPRITES[type]
  return {
    width: Math.round(def.spriteW / def.pxPerModelUnit * scale),
    height: Math.round(def.spriteH / def.pxPerModelUnit * scale),
  }
}
