/**
 * The six trade posts (spec: docs/spec/trade-posts.md). Every game rolls two of them at setup, one west
 * and one east; `state.posts` holds which. `abilityText` is the one sentence the rules page prints
 * verbatim, so the page and the engine never disagree about what a post does.
 *
 * Stub note: this file is Task 1's interface (docs/superpowers/plans/2026-09-03-trade-posts.md). It is
 * written here only so this branch compiles ahead of the engine branch; a merge keeps one copy, and the
 * engine agent's version wins where they differ.
 */
export type PostId = 'sarnex' | 'tessik' | 'orrun' | 'kesh' | 'vandel' | 'dromm'
export type PostAbility = 'none' | 'techExchange' | 'clearingHouse' | 'charter' | 'layover' | 'refit'

export interface PostDef {
  id: PostId
  name: string
  kind: 'station' | 'ship'
  commodityLimit: number
  ability: PostAbility
  abilityName: string
  abilityText: string
  art: string
}

export const POSTS: Record<PostId, PostDef> = {
  sarnex: {
    id: 'sarnex',
    name: 'Sarnex Wheel',
    kind: 'station',
    commodityLimit: 4,
    ability: 'none',
    abilityName: '',
    abilityText: 'No special ability, its four-commodity limit is the ability.',
    art: '/assets/posts/sarnex.png',
  },
  tessik: {
    id: 'tessik',
    name: 'Tessik Refinery',
    kind: 'station',
    commodityLimit: 2,
    ability: 'techExchange',
    abilityName: 'Technology exchange',
    abilityText: 'Return one general technology you own and take another general technology of the same tier in a different colour, prerequisites ignored, unit upgrades and faction technologies excluded.',
    art: '/assets/posts/tessik.png',
  },
  orrun: {
    id: 'orrun',
    name: 'Orrun Port Authority',
    kind: 'station',
    commodityLimit: 2,
    ability: 'clearingHouse',
    abilityName: 'Clearing house',
    abilityText: 'Exhaust your ready planets and take one trade good per resource or influence spent, up to 3 trade goods, each planet paying resources or influence but never both.',
    art: '/assets/posts/orrun.png',
  },
  kesh: {
    id: 'kesh',
    name: 'Kesh Line Freighter',
    kind: 'ship',
    commodityLimit: 2,
    ability: 'charter',
    abilityName: 'Charter',
    abilityText: 'Return one command token from any pool and take 4 trade goods.',
    art: '/assets/posts/kesh.png',
  },
  vandel: {
    id: 'vandel',
    name: 'Vandel Bulk Tanker',
    kind: 'ship',
    commodityLimit: 2,
    ability: 'layover',
    abilityName: 'Layover',
    abilityText: 'Return one command token from any pool and take 3 more minutes on your chess clock.',
    art: '/assets/posts/vandel.png',
  },
  dromm: {
    id: 'dromm',
    name: 'Dromm Heavy Hauler',
    kind: 'ship',
    commodityLimit: 2,
    ability: 'refit',
    abilityName: 'Refit',
    abilityText: 'Return ships you have in a system linked to this post and take one ship from your reinforcements whose cost is not higher than the total cost you returned, fighters and infantry excluded.',
    art: '/assets/posts/dromm.png',
  },
}

export const POST_IDS: readonly PostId[] = ['sarnex', 'tessik', 'orrun', 'kesh', 'vandel', 'dromm']
