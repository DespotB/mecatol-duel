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

/** Where the ships of a system start; the fleet flows to the right and wraps inside 200px. */
export const FLEET_ANCHOR: Record<string, Point> = {
  'home-n': { left: 16, top: 26 },
  bereg: { left: 14, top: 96 },
  sakulag: { left: 14, top: 26 },
  mecatol: { left: 14, top: 34 },
  quann: { left: 122, top: 24 },
  starpoint: { left: 16, top: 24 },
  'home-s': { left: 16, top: 96 },
}

export interface PlanetSpot {
  ground: Point                 // control token, then the ground forces to its right
  structures: Point             // space dock and PDS
  art?: { left: number; top: number; width: number; height: number }
  plate?: Point                 // only for planets the tile art does not print
}

export const PLANET_SPOTS: Record<string, PlanetSpot> = {
  '000': {
    ground: { left: 58, top: 104 }, structures: { left: 126, top: 56 },
    art: { left: 64, top: 34, width: 102, height: 102 }, plate: { left: 58, top: 142 },
  },
  bereg: {
    ground: { left: 66, top: 88 }, structures: { left: 66, top: 56 },
    art: { left: 58, top: 34, width: 88, height: 88 }, plate: { left: 62, top: 8 },
  },
  'lirta-iv': {
    ground: { left: 110, top: 148 }, structures: { left: 110, top: 116 },
    art: { left: 104, top: 98, width: 82, height: 82 }, plate: { left: 58, top: 170 },
  },
  sakulag: {
    ground: { left: 62, top: 98 }, structures: { left: 122, top: 98 },
    art: { left: 70, top: 44, width: 92, height: 92 }, plate: { left: 60, top: 140 },
  },
  'mecatol-rex': {
    ground: { left: 84, top: 66 }, structures: { left: 84, top: 100 },
    art: { left: 62, top: 30, width: 108, height: 108 }, plate: { left: 50, top: 144 },
  },
  quann: {
    ground: { left: 62, top: 100 }, structures: { left: 122, top: 100 },
    art: { left: 70, top: 44, width: 92, height: 92 }, plate: { left: 62, top: 140 },
  },
  starpoint: {
    ground: { left: 112, top: 60 }, structures: { left: 112, top: 28 },
    art: { left: 106, top: 30, width: 82, height: 82 }, plate: { left: 74, top: 8 },
  },
  centauri: {
    ground: { left: 52, top: 124 }, structures: { left: 52, top: 92 },
    art: { left: 44, top: 94, width: 82, height: 82 }, plate: { left: 46, top: 170 },
  },
  'arc-prime': {
    ground: { left: 66, top: 88 }, structures: { left: 66, top: 56 },
    art: { left: 58, top: 34, width: 88, height: 88 }, plate: { left: 62, top: 8 },
  },
  'wren-terra': {
    ground: { left: 110, top: 148 }, structures: { left: 110, top: 116 },
    art: { left: 104, top: 98, width: 82, height: 82 }, plate: { left: 58, top: 170 },
  },
}

export const WORMHOLE_SPOTS: Record<string, Point> = {
  bereg: { left: 176, top: 36 },
  sakulag: { left: 30, top: 36 },
  quann: { left: 178, top: 140 },
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
export const ACTIVATION_SPOT: { right: number; top: number } = { right: 4, top: 8 }

export const POST_POS: Record<'west' | 'east', Point> = {
  west: { left: 16, top: 254 },
  east: { left: 776, top: 254 },
}
