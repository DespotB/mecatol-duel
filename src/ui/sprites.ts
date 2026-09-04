import type { UnitType } from '../engine/types'
import type { ModelStyle } from './modelStyle'

export interface SpriteDef { pxPerModelUnit: number; spriteW: number; spriteH: number }

/** Copy of public/assets/sprites/manifest.json (`units`); src/ui/sprites.test.ts keeps the two in step. */
const MINIATURES: Record<UnitType, SpriteDef> = {
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

/** Copy of public/assets/sprites/topdown/manifest.json: the same models, orthographic and bow up. */
const TOP_DOWN: Record<UnitType, SpriteDef> = {
  dreadnought: { pxPerModelUnit: 144.4, spriteW: 392, spriteH: 795 },
  carrier: { pxPerModelUnit: 188.59, spriteW: 314, spriteH: 836 },
  cruiser: { pxPerModelUnit: 198.59, spriteW: 285, spriteH: 846 },
  destroyer: { pxPerModelUnit: 222.68, spriteW: 523, spriteH: 722 },
  fighter: { pxPerModelUnit: 357.26, spriteW: 660, spriteH: 612 },
  flagship: { pxPerModelUnit: 130.02, spriteW: 390, spriteH: 804 },
  warsun: { pxPerModelUnit: 156.33, spriteW: 494, spriteH: 500 },
  infantry: { pxPerModelUnit: 255.99, spriteW: 546, spriteH: 434 },
  spacedock: { pxPerModelUnit: 238.5, spriteW: 544, spriteH: 538 },
  pds: { pxPerModelUnit: 304.85, spriteW: 628, spriteH: 484 },
}

/**
 * Copy of public/assets/sprites/counters/manifest.json. The Async counters are already drawn to one scale
 * across the units, a 128 px fighter next to a 320 px flagship, so they share one pxPerModelUnit: it is set
 * so a carrier comes out the size it has as a miniature, and the art keeps its own hierarchy from there.
 */
const COUNTERS: Record<UnitType, SpriteDef> = {
  dreadnought: { pxPerModelUnit: 89, spriteW: 308, spriteH: 308 },
  carrier: { pxPerModelUnit: 89, spriteW: 280, spriteH: 276 },
  cruiser: { pxPerModelUnit: 89, spriteW: 268, spriteH: 268 },
  destroyer: { pxPerModelUnit: 89, spriteW: 204, spriteH: 196 },
  fighter: { pxPerModelUnit: 89, spriteW: 128, spriteH: 124 },
  flagship: { pxPerModelUnit: 89, spriteW: 320, spriteH: 324 },
  warsun: { pxPerModelUnit: 89, spriteW: 224, spriteH: 260 },
  infantry: { pxPerModelUnit: 89, spriteW: 156, spriteH: 172 },
  spacedock: { pxPerModelUnit: 89, spriteW: 168, spriteH: 172 },
  pds: { pxPerModelUnit: 89, spriteW: 132, spriteH: 148 },
}

export const SPRITE_SETS: Record<ModelStyle, Record<UnitType, SpriteDef>> = {
  models: MINIATURES, topdown: TOP_DOWN, counters: COUNTERS,
}

/**
 * A ship seen from straight above shows its whole length, where the three quarter view foreshortens it, so
 * the same model comes out half again as tall. This trims the top down set until its biggest piece sits
 * next to the others, which keeps every style inside the hexagon and keeps the fleets comparable. Relative
 * sizes inside a style are untouched: a fighter stays small next to a dreadnought.
 */
export const STYLE_SCALE: Record<ModelStyle, number> = { models: 1, topdown: 0.72, counters: 1 }

/** The tallest a unit can be drawn on the board in any style; the tile layout has to hold this. */
export function tallestSprite(scale: number = BOARD_SCALE): number {
  let tallest = 0
  for (const [style, set] of Object.entries(SPRITE_SETS)) {
    for (const type of Object.keys(set) as UnitType[]) {
      tallest = Math.max(tallest, spriteSize(type, scale, style as ModelStyle).height)
    }
  }
  return tallest
}

/** The folder each style's files live in; the miniatures kept the original flat path. */
export const SPRITE_FOLDER: Record<ModelStyle, string> = { models: '', topdown: 'topdown/', counters: 'counters/' }

/** Board pixels per model unit. The manifest's scale is what makes a fighter small next to a dreadnought. */
export const BOARD_SCALE = 11.6
/** The side panels and the production drawer show the same models smaller. */
export const PANEL_SCALE = 10.4

export function spriteSize(type: UnitType, scale: number = BOARD_SCALE, style: ModelStyle = 'models'): { width: number; height: number } {
  const def = SPRITE_SETS[style][type]
  const size = scale * STYLE_SCALE[style]
  return {
    width: Math.round(def.spriteW / def.pxPerModelUnit * size),
    height: Math.round(def.spriteH / def.pxPerModelUnit * size),
  }
}
