import { describe, expect, it } from 'vitest'
import { SYSTEMS } from '../data/map'
import {
  ACTIVATION_SIZE, ACTIVATION_SPOT, FLEET_ANCHOR, FLEET_WIDTH, PLANET_SPOTS, SIGIL_SIZE, SIGIL_SPOT,
  TILE_H, TILE_W, WORMHOLE_SIZE, WORMHOLE_SPOTS, boxInsideHex, pointInsideHex,
} from './layout'

describe('every overlay sits inside the drawn hexagon', () => {
  it('knows the hexagon from its own corners', () => {
    expect(pointInsideHex(TILE_W / 2, TILE_H / 2)).toBe(true)
    expect(pointInsideHex(4, 6)).toBe(false)          // the cut top-left corner
    expect(pointInsideHex(TILE_W - 4, TILE_H - 6)).toBe(false)
  })
  it('holds the activation token and the faction emblem', () => {
    expect(boxInsideHex(ACTIVATION_SPOT.left, ACTIVATION_SPOT.top, ACTIVATION_SIZE, ACTIVATION_SIZE)).toBe(true)
    expect(boxInsideHex(SIGIL_SPOT.left, SIGIL_SPOT.top, SIGIL_SIZE, SIGIL_SIZE)).toBe(true)
  })
  it('holds every wormhole glyph', () => {
    for (const [systemId, spot] of Object.entries(WORMHOLE_SPOTS)) {
      expect(boxInsideHex(spot.left, spot.top, WORMHOLE_SIZE, WORMHOLE_SIZE), systemId).toBe(true)
    }
  })
  it('holds every fleet anchor, with room for a row of ships', () => {
    for (const [systemId, spot] of Object.entries(FLEET_ANCHOR)) {
      expect(boxInsideHex(spot.left, spot.top, FLEET_WIDTH, 46), systemId).toBe(true)
    }
  })
  it('holds every planet render and the anchor of every nameplate', () => {
    for (const def of SYSTEMS) {
      for (const planet of def.planets) {
        const spot = PLANET_SPOTS[planet.id]
        expect(spot, planet.id).toBeTruthy()
        if (spot.art) expect(boxInsideHex(spot.art.left, spot.art.top, spot.art.width, spot.art.height), planet.id).toBe(true)
        if (spot.plate) expect(pointInsideHex(spot.plate.left, spot.plate.top), planet.id).toBe(true)
      }
    }
  })
})
