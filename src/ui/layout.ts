export const TILE_W = 232
export const TILE_H = 201
export interface Point { left: number; top: number }

/** Flower positions inside the 940x698 map box, taken from the approved mockup. */
export const TILE_POS: Record<string, Point> = {
  'home-n': { left: 354, top: 47 },
  bereg: { left: 528, top: 148 },
  sakulag: { left: 180, top: 148 },
  mecatol: { left: 354, top: 248 },
  quann: { left: 528, top: 349 },
  starpoint: { left: 180, top: 349 },
  'home-s': { left: 354, top: 449 },
}

/**
 * Where the ships of a system start. One anchor for every system, on the wide left flank of the hexagon, so
 * a fleet never spills over a cut corner and never lands on a nameplate; the row flows right and wraps.
 */
export const FLEET_WIDTH = 164
export const FLEET_ANCHOR: Record<string, Point> = {
  'home-n': { left: 24, top: 84 },
  bereg: { left: 24, top: 84 },
  sakulag: { left: 24, top: 84 },
  mecatol: { left: 24, top: 84 },
  quann: { left: 24, top: 84 },
  starpoint: { left: 24, top: 84 },
  'home-s': { left: 24, top: 84 },
}

export interface PlanetSpot {
  ground: Point                 // control token, then the ground forces to its right
  structures: Point             // space dock and PDS
  art?: { left: number; top: number; width: number; height: number }
  plate?: Point                 // only for planets the tile art does not print
}

/**
 * Two-planet systems put one planet up on the left and the other down on the right, far enough apart that
 * the two spheres never touch. Every nameplate hugs its own planet the way the printed tiles place it: the
 * two value badges ride the planet's rim, upper left for the upper planet and lower left for the lower one,
 * and the name banner runs off it to the right.
 */
export const PLANET_SPOTS: Record<string, PlanetSpot> = {
  '000': {
    ground: { left: 92, top: 62 }, structures: { left: 92, top: 30 },
    art: { left: 68, top: 32, width: 96, height: 96 }, plate: { left: 56, top: 112 },
  },
  bereg: {
    ground: { left: 64, top: 74 }, structures: { left: 64, top: 42 },
    art: { left: 44, top: 30, width: 78, height: 78 }, plate: { left: 40, top: 34 },
  },
  'lirta-iv': {
    ground: { left: 130, top: 116 }, structures: { left: 130, top: 84 },
    art: { left: 114, top: 100, width: 70, height: 70 }, plate: { left: 64, top: 148 },
  },
  sakulag: {
    ground: { left: 92, top: 62 }, structures: { left: 92, top: 30 },
    art: { left: 68, top: 32, width: 96, height: 96 }, plate: { left: 56, top: 112 },
  },
  'mecatol-rex': {
    ground: { left: 92, top: 58 }, structures: { left: 92, top: 26 },
    art: { left: 64, top: 28, width: 104, height: 104 }, plate: { left: 52, top: 116 },
  },
  quann: {
    ground: { left: 92, top: 62 }, structures: { left: 92, top: 30 },
    art: { left: 68, top: 32, width: 96, height: 96 }, plate: { left: 56, top: 112 },
  },
  starpoint: {
    ground: { left: 64, top: 74 }, structures: { left: 64, top: 42 },
    art: { left: 44, top: 30, width: 78, height: 78 }, plate: { left: 40, top: 34 },
  },
  centauri: {
    ground: { left: 130, top: 116 }, structures: { left: 130, top: 84 },
    art: { left: 114, top: 100, width: 70, height: 70 }, plate: { left: 64, top: 148 },
  },
  'arc-prime': {
    ground: { left: 64, top: 74 }, structures: { left: 64, top: 42 },
    art: { left: 44, top: 30, width: 78, height: 78 }, plate: { left: 40, top: 34 },
  },
  'wren-terra': {
    ground: { left: 130, top: 116 }, structures: { left: 130, top: 84 },
    art: { left: 114, top: 100, width: 70, height: 70 }, plate: { left: 64, top: 148 },
  },
}

export const WORMHOLE_SPOTS: Record<string, Point> = {
  bereg: { left: 170, top: 40 },
  sakulag: { left: 36, top: 40 },
  quann: { left: 170, top: 134 },
  starpoint: { left: 194, top: 88 },
}

/**
 * Played command tokens (System.activatedBy), top-right corner. The top-left corner looks free at a
 * glance but the fleet anchor sits right in it on three tiles (home-n, sakulag, starpoint: FLEET_ANCHOR
 * left 14-16, top 24-26), so a token there sits on top of the very first ship of any fleet at that
 * system. The centre of the top edge is out too: Mecatol Rex's guardian-fleet label spans roughly
 * x57-175 there. left:194 clears the guardian label, every FLEET_ANCHOR, and every PLANET_SPOTS art
 * rect (Starpoint's reaches to x192, the widest of the seven) with a few px to spare, confirmed against
 * live-rendered geometry, not just the declared spot values. Anchored to the right edge rather than to a
 * left offset so that a system both seats activated keeps its second token on the tile: the tokens grow
 * inwards and overlap like stacked cardboard instead of running past the hex into the neighbouring tile.
 */
/**
 * Overlays sit inside the drawn hexagon, not inside the tile's bounding box: the four cut corners are
 * transparent, so anything anchored there floats next to the system instead of on it. `layout.test.ts`
 * checks every spot below against HEX_POINTS.
 */
export const HEX_POINTS: readonly Point[] = [
  { left: 58, top: 1 }, { left: 174, top: 1 }, { left: 231, top: 100.5 },
  { left: 174, top: 200 }, { left: 58, top: 200 }, { left: 1, top: 100.5 },
]

/** True when the whole box lies inside the tile's hexagon. */
export function boxInsideHex(left: number, top: number, width: number, height: number): boolean {
  const corners: [number, number][] = [[left, top], [left + width, top], [left, top + height], [left + width, top + height]]
  return corners.every(([x, y]) => pointInsideHex(x, y))
}

export function pointInsideHex(x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = HEX_POINTS.length - 1; i < HEX_POINTS.length; j = i++) {
    const a = HEX_POINTS[i]
    const b = HEX_POINTS[j]
    const straddles = (a.top > y) !== (b.top > y)
    if (straddles && x < (b.left - a.left) * (y - a.top) / (b.top - a.top) + a.left) inside = !inside
  }
  return inside
}

/** The activation command token, on the wide left flank and above everything else on the tile. */
export const ACTIVATION_SPOT: Point = { left: 20, top: 92 }
export const ACTIVATION_SIZE = 34
/** The faction emblem of a home system, top right inside the hexagon. */
export const SIGIL_SPOT: Point = { left: 150, top: 20 }
export const SIGIL_SIZE = 30
export const WORMHOLE_SIZE = 26

/**
 * The two trade posts live in the margins the flower leaves free: the tiles occupy x180 to x760 of the
 * 940-wide map box, so 176 px are open on either side. A post takes 172 of them, which is what the rendered
 * model needs to read as a model rather than an icon, and the four px left over keep the panel off the
 * hexagon's widest point. Vertically the panel is centred on the map, level with Mecatol Rex.
 */
export const POST_W = 172
export const POST_H = 302
export const POST_POS: Record<'west' | 'east', Point> = {
  west: { left: 4, top: 198 },
  east: { left: 940 - 4 - POST_W, top: 198 },
}
/** The model box inside the panel; the render is letterboxed into it, so every post keeps its own ratio. */
export const POST_ART_W = 160
export const POST_ART_H = 146

/** Where a hyperlane leaves the post: the inner edge of the panel, at half its height. */
export function postAnchor(post: 'west' | 'east'): Point {
  const pos = POST_POS[post]
  return { left: post === 'west' ? pos.left + POST_W : pos.left, top: pos.top + POST_H / 2 }
}

/** The centre of a tile, which is where a hyperlane ends; the tile art covers the last stretch of it. */
export function tileCentre(systemId: string): Point {
  const pos = TILE_POS[systemId]
  return { left: pos.left + TILE_W / 2, top: pos.top + TILE_H / 2 }
}

/**
 * R8: the hyperlane from a post to one of the two systems it serves. A straight line between the two
 * anchors would run through the gap between the tiles as a spoke; the lane bows away from the map's
 * middle instead, so the two lanes of one post read as a fan of routes rather than as a pair of rails.
 * Everything is in design pixels and derived from the tile and post constants: the map is scaled with a
 * CSS zoom at runtime, so nothing here may ever be measured off the DOM.
 */
export const LANE_BOW = 26
export function lanePath(post: 'west' | 'east', systemId: string): string {
  const from = postAnchor(post)
  const to = tileCentre(systemId)
  const midX = (from.left + to.left) / 2
  const midY = (from.top + to.top) / 2
  // the bow points away from the horizontal centre line the post sits on, upwards for the upper system
  const away = Math.sign(to.top - from.top) || 1
  const cx = midX + (post === 'west' ? -LANE_BOW / 2 : LANE_BOW / 2)
  const cy = midY + away * LANE_BOW
  return `M ${String(from.left)} ${String(from.top)} Q ${String(cx)} ${String(cy)} ${String(to.left)} ${String(to.top)}`
}
