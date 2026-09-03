/**
 * The six trade posts of `docs/spec/trade-posts.md`. Two of them are in play at a time, one west and one
 * east, and the pair turns over every round: the status phase rolls a new pair from the four that were not
 * in play. Everything the board, the component panel and the rules page print about a post comes from here,
 * so the three cannot drift apart.
 */
export type PostId = 'sarnex' | 'tessik' | 'orrun' | 'kesh' | 'vandel' | 'dromm'
export type PostAbility = 'none' | 'techExchange' | 'clearingHouse' | 'charter' | 'layover' | 'refit'

export interface PostDef {
  id: PostId
  name: string
  kind: 'station' | 'ship'
  /** How many commodities the post buys in one sale; 4 at the Sarnex Wheel, 2 everywhere else. */
  commodityLimit: number
  ability: PostAbility
  /** Empty at the Sarnex Wheel, which has no special ability. */
  abilityName: string
  /** One sentence, short enough for the card under the model and the same wording the rules page uses. */
  abilityText: string
  art: string
}

export const POSTS: Record<PostId, PostDef> = {
  sarnex: {
    id: 'sarnex', name: 'Sarnex Wheel', kind: 'station', commodityLimit: 4,
    ability: 'none', abilityName: '',
    abilityText: 'No special ability: the ring simply buys twice as deep as any other post.',
    art: '/assets/posts/sarnex.png',
  },
  tessik: {
    id: 'tessik', name: 'Tessik Refinery', kind: 'station', commodityLimit: 2,
    ability: 'techExchange', abilityName: 'Technology exchange',
    abilityText: 'Return one general technology and take another of the same tier in a different colour, prerequisites ignored.',
    art: '/assets/posts/tessik.png',
  },
  orrun: {
    id: 'orrun', name: 'Orrun Port Authority', kind: 'station', commodityLimit: 2,
    ability: 'clearingHouse', abilityName: 'Clearing house',
    abilityText: 'Exhaust ready planets and take one trade good per resource or influence spent, up to 3.',
    art: '/assets/posts/orrun.png',
  },
  kesh: {
    id: 'kesh', name: 'Kesh Line Freighter', kind: 'ship', commodityLimit: 2,
    ability: 'charter', abilityName: 'Charter',
    abilityText: 'Return one command token from any pool (tactic, fleet or strategy) and take 4 trade goods.',
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
    abilityText: 'Return ships in a linked system and take one from your reinforcements that costs no more.',
    art: '/assets/posts/dromm.png',
  },
}

export const POST_IDS: readonly PostId[] = ['sarnex', 'tessik', 'orrun', 'kesh', 'vandel', 'dromm']

export function postDefById(id: PostId): PostDef {
  return POSTS[id]
}
