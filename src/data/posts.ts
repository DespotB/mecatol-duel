/**
 * R8 / docs/spec/trade-posts.md: the six named trade posts. Every game rolls two of them from the game
 * seed, one for the west side and one for the east, and the pair lives in `state.posts`.
 *
 * Every post sells commodities for 1 trade good each, once per round per post per player. Five take up to
 * 2, the Sarnex Wheel takes up to 4. On top of that every post but the Sarnex Wheel has one special
 * ability, which is once per round for the whole table: the first player to use it takes it.
 */
export type PostId = 'sarnex' | 'tessik' | 'orrun' | 'kesh' | 'vandel' | 'dromm'
export type PostAbility = 'none' | 'techExchange' | 'clearingHouse' | 'charter' | 'layover' | 'refit'

export interface PostDef {
  id: PostId
  name: string
  /** What the render shows: a fixed installation or a hull under way. */
  kind: 'station' | 'ship'
  /** R8: the most commodities one sale may turn into trade goods. */
  commodityLimit: number
  ability: PostAbility
  /** Empty for a post without a special ability. */
  abilityName: string
  /** One sentence, the same wording the rules page prints. */
  abilityText: string
  art: string
}

export const POSTS: Record<PostId, PostDef> = {
  sarnex: {
    id: 'sarnex', name: 'Sarnex Wheel', kind: 'station', commodityLimit: 4,
    ability: 'none', abilityName: '', abilityText: 'No special ability: its size is its ability.',
    art: '/assets/posts/sarnex.png',
  },
  tessik: {
    id: 'tessik', name: 'Tessik Refinery', kind: 'station', commodityLimit: 2,
    ability: 'techExchange', abilityName: 'Technology exchange',
    abilityText: 'Return one general technology you own and take another general technology of the same tier in a different colour; prerequisites are ignored, unit upgrades and faction technologies are excluded on both sides.',
    art: '/assets/posts/tessik.png',
  },
  orrun: {
    id: 'orrun', name: 'Orrun Port Authority', kind: 'station', commodityLimit: 2,
    ability: 'clearingHouse', abilityName: 'Clearing house',
    abilityText: 'Exhaust your ready planets and take one trade good per resource or influence spent, up to 3 trade goods; each planet pays either its resources or its influence, never both.',
    art: '/assets/posts/orrun.png',
  },
  kesh: {
    id: 'kesh', name: 'Kesh Line Freighter', kind: 'ship', commodityLimit: 2,
    ability: 'charter', abilityName: 'Charter',
    abilityText: 'Return one command token from any pool and take 4 trade goods.',
    art: '/assets/posts/kesh.png',
  },
  vandel: {
    id: 'vandel', name: 'Vandel Bulk Tanker', kind: 'ship', commodityLimit: 2,
    ability: 'layover', abilityName: 'Layover',
    abilityText: 'Return one command token from any pool and take 3 more minutes on your chess clock.',
    art: '/assets/posts/vandel.png',
  },
  dromm: {
    id: 'dromm', name: 'Dromm Heavy Hauler', kind: 'ship', commodityLimit: 2,
    ability: 'refit', abilityName: 'Refit',
    abilityText: 'Return ships you have in a system linked to this post and take one ship from your reinforcements whose cost is not higher, placed in the same system; fighters and infantry cannot be part of a refit and any difference in cost is lost.',
    art: '/assets/posts/dromm.png',
  },
}

/** The draw order of the roll in `createGame`, so the same seed always spawns the same pair. */
export const POST_IDS: readonly PostId[] = ['sarnex', 'tessik', 'orrun', 'kesh', 'vandel', 'dromm']

export function postById(id: PostId): PostDef {
  return POSTS[id]
}
