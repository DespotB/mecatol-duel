/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SPRITES, spriteSize } from './sprites'

describe('unit sprites', () => {
  it('the sprite table is a faithful copy of the shipped manifest', () => {
    const raw = readFileSync(new URL('../../public/assets/sprites/manifest.json', import.meta.url), 'utf8')
    const manifest = JSON.parse(raw) as { units: Record<string, { pxPerModelUnit: number; spriteW: number; spriteH: number }> }
    for (const [type, def] of Object.entries(SPRITES)) {
      expect(manifest.units[type]).toBeDefined()
      expect(manifest.units[type].pxPerModelUnit).toBe(def.pxPerModelUnit)
      expect(manifest.units[type].spriteW).toBe(def.spriteW)
      expect(manifest.units[type].spriteH).toBe(def.spriteH)
    }
  })
  it('the world scale reproduces the mockup sizes', () => {
    expect(spriteSize('dreadnought')).toEqual({ width: 44, height: 40 })
    expect(spriteSize('carrier')).toEqual({ width: 36, height: 36 })
    expect(spriteSize('cruiser')).toEqual({ width: 33, height: 33 })
    expect(spriteSize('destroyer')).toEqual({ width: 29, height: 23 })
    expect(spriteSize('fighter')).toEqual({ width: 27, height: 17 })
    expect(spriteSize('infantry')).toEqual({ width: 25, height: 30 })
    expect(spriteSize('pds')).toEqual({ width: 22, height: 18 })
    expect(spriteSize('spacedock')).toEqual({ width: 26, height: 32 })
  })
  it('a smaller scale keeps the proportions', () => {
    const big = spriteSize('dreadnought')
    const small = spriteSize('dreadnought', 5.8)
    expect(small.width).toBe(Math.round(big.width / 2))
  })
})
