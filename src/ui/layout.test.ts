import { describe, expect, it } from 'vitest'
import { SYSTEMS, TRADE_POSTS } from '../data/map'
import {
  ACTIVATION_SIZE, ACTIVATION_SPOT, FLEET_ANCHOR, FLEET_WIDTH, MAP_H, MAP_W, PLANET_SPOTS, POST_H, POST_POS,
  POST_W, SIGIL_SIZE, SIGIL_SPOT, TILE_H, TILE_POS, TILE_W, WORMHOLE_SIZE, WORMHOLE_SPOTS, boxInsideHex,
  lanePath, pointInsideHex, postAnchor, tileCentre,
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

describe('R8: the trade posts and their hyperlanes', () => {
  it('keeps both posts inside the map box and clear of every tile', () => {
    for (const post of ['west', 'east'] as const) {
      const pos = POST_POS[post]
      expect(pos.left, post).toBeGreaterThanOrEqual(0)
      expect(pos.left + POST_W, post).toBeLessThanOrEqual(MAP_W)
      expect(pos.top, post).toBeGreaterThanOrEqual(0)
      expect(pos.top + POST_H, post).toBeLessThanOrEqual(MAP_H)
    }
    // the flower occupies x180 to x760; a post that reached into it would sit on a hexagon
    const leftmostTile = Math.min(...Object.values(TILE_POS).map(p => p.left))
    const rightmostTile = Math.max(...Object.values(TILE_POS).map(p => p.left + TILE_W))
    expect(POST_POS.west.left + POST_W).toBeLessThanOrEqual(leftmostTile)
    expect(POST_POS.east.left).toBeGreaterThanOrEqual(rightmostTile)
  })

  it('anchors a lane on the post it leaves and the centre of the tile it plugs into', () => {
    // computed from the constants, never measured: the map is scaled with a CSS zoom at runtime
    expect(postAnchor('west')).toEqual({ left: POST_POS.west.left + POST_W, top: POST_POS.west.top + POST_H / 2 })
    expect(postAnchor('east')).toEqual({ left: POST_POS.east.left, top: POST_POS.east.top + POST_H / 2 })
    expect(tileCentre('sakulag')).toEqual({ left: TILE_POS.sakulag.left + TILE_W / 2, top: TILE_POS.sakulag.top + TILE_H / 2 })
  })

  it('draws one path per link, from the post to the tile', () => {
    for (const post of ['west', 'east'] as const) {
      const from = postAnchor(post)
      for (const systemId of TRADE_POSTS[post]) {
        const to = tileCentre(systemId)
        const d = lanePath(post, systemId)
        expect(d, `${post}-${systemId}`).toContain(`M ${String(from.left)} ${String(from.top)}`)
        expect(d, `${post}-${systemId}`).toContain(`${String(to.left)} ${String(to.top)}`)
      }
      // the two lanes of one post are different paths, one up and one down
      expect(lanePath(post, TRADE_POSTS[post][0])).not.toBe(lanePath(post, TRADE_POSTS[post][1]))
    }
  })
})
