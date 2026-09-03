import { describe, expect, it } from 'vitest'
import { POSTS, POST_IDS } from '../data/posts'
import { applyMove, legalMoves, postAbilityOptions, validateMove } from './index'
import { deepFreeze, shipId, toActionPhase, withCards, withExhausted, withPlanetOwner, withPlayer, withPosts, withTechs, withUnits } from './testUtils'
import type { GameState, PostAbilityParams, Result } from './types'

const value = (r: Result<GameState>): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const use = (state: GameState, post: 'west' | 'east', params: PostAbilityParams) =>
  applyMove(deepFreeze(state), { type: 'postAbility', post, params }, 0)
const error = (r: Result<GameState>): string => {
  if (r.ok) throw new Error('expected a rejection')
  return r.error
}

/** Seat 0 holds Bereg and Quann, so the east post is in reach; the pair in play is set per test. */
function eastInReach(seed = 1): GameState {
  const s = withPlanetOwner(toActionPhase(seed), 'bereg', 'bereg', 0)
  return withPlanetOwner(s, 'quann', 'quann', 0)
}

/** Seat 0 holds Starpoint, so the west post is in reach. */
function westInReach(seed = 1): GameState {
  return withPlanetOwner(toActionPhase(seed), 'starpoint', 'starpoint', 0)
}

describe('R8 the shared guard on every post ability', () => {
  it('needs your own turn with nothing else running, and a planet in a linked system', () => {
    const reachable = withPosts(eastInReach(), 'sarnex', 'tessik')
    const params: PostAbilityParams = { techId: 'neural_motivator', takeTechId: 'antimass_deflectors' }
    expect(use(reachable, 'east', params).ok).toBe(true)
    // out of reach: seat 0 holds nothing in Sakulag or Starpoint, and the west post is the Sarnex Wheel anyway
    expect(error(use(withPosts(toActionPhase(), 'tessik', 'sarnex'), 'west', params))).toMatch(/R8: no planet controlled/)
    const running = deepFreeze({ ...reachable, tactical: { systemId: 'bereg', step: 'movement' as const } })
    expect(error(use(running, 'east', params))).toMatch(/tactical/)
    const window = value(applyMove(withCards(reachable, 0, ['trade']), { type: 'strategic', card: 'trade' }, 0))
    expect(error(use(window, 'east', params))).toMatch(/secondary/i)
    expect(error(use(withPlayer(reachable, 0, { passed: true }), 'east', params))).toMatch(/passed/)
  })
  it('R8: all six posts carry an ability, so the guard\'s "none" branch is unreachable in play', () => {
    for (const id of POST_IDS) {
      expect(POSTS[id].ability, `${id} has no ability`).not.toBe('none')
      expect(POSTS[id].abilityName.length, `${id} has no ability name`).toBeGreaterThan(0)
    }
  })
  it('R8: the ability is once per round for the whole table, the sale stays open for both', () => {
    const s = withPosts(eastInReach(), 'sarnex', 'tessik')
    const done = value(use(s, 'east', { techId: 'neural_motivator', takeTechId: 'antimass_deflectors' }))
    expect(done.postAbilityUsed).toEqual({ west: false, east: true })
    // the same seat is out, and so is the opponent: the post's ability is spent for the round
    expect(error(use(done, 'east', { techId: 'plasma_scoring', takeTechId: 'sarween_tools' }))).toMatch(/already used this round/)
    const opponent = deepFreeze({ ...done, active: 1 as const, turnDone: false })
    expect(error(use(withPlanetOwner(opponent, 'quann', 'quann', 1), 'east', { techId: 'antimass_deflectors', takeTechId: 'neural_motivator' })))
      .toMatch(/already used this round/)
    // R8: the commodity sale is a different bookkeeping and is untouched by it
    expect(applyMove(done, { type: 'tradePost', post: 'east', commodities: 2 }, 0).ok).toBe(true)
  })
  it('R8: using an ability is free, it neither spends nor ends the turn', () => {
    const s = withPosts(eastInReach(), 'sarnex', 'tessik')
    const done = value(use(s, 'east', { techId: 'neural_motivator', takeTechId: 'antimass_deflectors' }))
    expect(done.active).toBe(0)
    expect(done.turnDone).toBe(false)
    expect(done.log.some(e => e.t === 'info' && e.text === 'seat 0 uses Technology exchange at the east post, the Tessik Refinery')).toBe(true)
    // and it stays available after the action is spent, like the sale
    const spent = value(applyMove(deepFreeze({ ...s, tactical: { systemId: 'bereg', step: 'done' as const } }), { type: 'endTactical' }, 0))
    expect(spent.turnDone).toBe(true)
    expect(use(spent, 'east', { techId: 'neural_motivator', takeTechId: 'antimass_deflectors' }).ok).toBe(true)
  })
})

describe('R8 Tessik Refinery: technology exchange', () => {
  const base = () => withPosts(eastInReach(), 'sarnex', 'tessik')

  it('returns a general technology for another of the same tier in a different colour', () => {
    const done = value(use(base(), 'east', { techId: 'neural_motivator', takeTechId: 'antimass_deflectors' }))
    expect(done.players[0].techs).toEqual(['plasma_scoring', 'antimass_deflectors'])
    expect(done.players[0].techs).not.toContain('neural_motivator')
  })
  it('rejects the same colour and a different tier', () => {
    // one general technology per colour and tier, so a same-colour trade is always a different tier too
    expect(error(use(base(), 'east', { techId: 'plasma_scoring', takeTechId: 'magen_defense_grid' }))).toMatch(/different colour/)
    expect(error(use(base(), 'east', { techId: 'neural_motivator', takeTechId: 'gravity_drive' }))).toMatch(/same tier/)
  })
  it('rejects unit upgrades and faction technologies on either side', () => {
    expect(error(use(base(), 'east', { techId: 'neural_motivator', takeTechId: 'carrier_ii' }))).toMatch(/general technolog/)
    expect(error(use(base(), 'east', { techId: 'neural_motivator', takeTechId: 'inheritance_systems' }))).toMatch(/general technolog/)
    const owner = withTechs(base(), 0, ['carrier_ii', 'inheritance_systems'])
    expect(error(use(owner, 'east', { techId: 'carrier_ii', takeTechId: 'antimass_deflectors' }))).toMatch(/general technolog/)
    expect(error(use(owner, 'east', { techId: 'inheritance_systems', takeTechId: 'antimass_deflectors' }))).toMatch(/general technolog/)
  })
  it('rejects a technology the player does not own, one already owned and an unknown id', () => {
    expect(error(use(base(), 'east', { techId: 'gravity_drive', takeTechId: 'dacxive_animators' }))).toMatch(/not owned/)
    expect(error(use(base(), 'east', { techId: 'neural_motivator', takeTechId: 'plasma_scoring' }))).toMatch(/already owned/)
    expect(error(use(base(), 'east', { techId: 'no_such_tech', takeTechId: 'antimass_deflectors' }))).toMatch(/unknown technology/)
    expect(error(use(base(), 'east', { takeTechId: 'antimass_deflectors' }))).toMatch(/R8: name the technology/)
  })
})

describe('R8 Orrun Port Authority: clearing house', () => {
  const base = () => withPosts(eastInReach(), 'sarnex', 'orrun')

  it('exhausts one ready planet for a trade good per resource or per influence it prints', () => {
    // Bereg prints 3 resources and 1 influence; the caller picks which of the two it pays
    const paid = value(use(base(), 'east', { planet: 'bereg', pays: 'resources' }))
    expect(paid.players[0].tradeGoods).toBe(3)
    expect(paid.systems.bereg.planets.find(p => p.id === 'bereg')?.exhausted).toBe(true)
    expect(paid.systems.bereg.planets.find(p => p.id === 'lirta-iv')?.exhausted).toBe(false)
    expect(value(use(base(), 'east', { planet: 'bereg', pays: 'influence' })).players[0].tradeGoods).toBe(1)
  })
  it('takes one planet only, never several and never both of its values', () => {
    const done = value(use(base(), 'east', { planet: 'quann', pays: 'resources' }))
    expect(done.players[0].tradeGoods).toBe(2)                                       // Quann's 2 resources, not 2 + 1
    expect(done.systems.bereg.planets.every(p => !p.exhausted)).toBe(true)           // no second planet was touched
    expect(error(use(base(), 'east', { planet: 'quann' }))).toMatch(/resources or its influence/)
    expect(error(use(base(), 'east', { pays: 'resources' }))).toMatch(/name the one planet/)
  })
  it('rejects an exhausted planet, one the seat does not control and a side that prints nothing', () => {
    expect(error(use(withExhausted(base(), ['quann']), 'east', { planet: 'quann', pays: 'resources' }))).toMatch(/exhausted/)
    expect(error(use(base(), 'east', { planet: 'arc-prime', pays: 'resources' }))).toMatch(/not controlled/)
    expect(error(use(base(), 'east', { planet: '000', pays: 'influence' }))).toMatch(/prints no influence/)   // [0.0.0] has none
  })
})

describe('R8 Sarnex Time Machine Wheel: time trade', () => {
  const base = () => withPosts(eastInReach(), 'tessik', 'sarnex')

  it('grants one victory point and leaves the clock to the interface', () => {
    const s = base()
    const done = value(use(s, 'east', {}))
    expect(done.players[0].vp).toBe(1)
    expect(done.players[1].vp).toBe(0)
    expect(done.log.some(e => e.t === 'info' && e.text === 'seat 0 scores 1 VP: time trade at the Sarnex Time Machine Wheel')).toBe(true)
    // nothing else moves: the engine is time-free and the point is all it grants
    expect({ ...done, players: s.players, postAbilityUsed: s.postAbilityUsed, log: s.log }).toEqual(s)
  })
  it('is once per round for the table like every other ability', () => {
    const done = value(use(base(), 'east', {}))
    expect(error(use(done, 'east', {}))).toMatch(/already used this round/)
  })
})

describe('R8 Kesh Line Freighter: charter', () => {
  const base = () => withPosts(westInReach(), 'kesh', 'sarnex')

  it('returns one command token from any pool for 4 trade goods', () => {
    const done = value(use(base(), 'west', { pool: 'fleet' }))
    expect(done.players[0].tokens).toEqual({ tactic: 3, fleet: 2, strategy: 2 })
    expect(done.players[0].tradeGoods).toBe(4)
    // the token goes back to the reinforcements, so it never appears on the board
    expect(Object.values(done.systems).every(sys => sys.activatedBy.length === 0)).toBe(true)
    expect(value(use(base(), 'west', { pool: 'strategy' })).players[0].tokens.strategy).toBe(1)
  })
  it('rejects an empty pool and a pool that is not one of the three', () => {
    const broke = withPlayer(base(), 0, { tokens: { tactic: 3, fleet: 0, strategy: 2 } })
    expect(error(use(broke, 'west', { pool: 'fleet' }))).toMatch(/no command token in the fleet pool/)
    expect(error(use(base(), 'west', {}))).toMatch(/name the pool/)
    expect(error(use(base(), 'west', { pool: 'reinforcements' as 'fleet' }))).toMatch(/name the pool/)
  })
})

describe('R8 Vandel Bulk Tanker: layover', () => {
  const base = () => withPosts(westInReach(), 'vandel', 'sarnex')

  it('spends one command token and changes nothing else, the clock is the interface\'s business', () => {
    const s = base()
    const done = value(use(s, 'west', { pool: 'strategy' }))
    expect(done.players[0].tokens).toEqual({ tactic: 3, fleet: 3, strategy: 1 })
    expect(done.players[0].tradeGoods).toBe(0)
    expect(done.players[0].commodities).toBe(s.players[0].commodities)
    // every other field of the state is the one it started with; only the tokens, the flag and the log moved
    expect({ ...done, players: s.players, postAbilityUsed: s.postAbilityUsed, log: s.log }).toEqual(s)
    expect(done.log.some(e => e.t === 'info' && e.text === 'seat 0 uses Layover at the west post, the Vandel Bulk Tanker')).toBe(true)
  })
  it('rejects an empty pool', () => {
    const broke = withPlayer(base(), 0, { tokens: { tactic: 0, fleet: 3, strategy: 2 } })
    expect(error(use(broke, 'west', { pool: 'tactic' }))).toMatch(/no command token in the tactic pool/)
  })
})

describe('R8 Dromm Heavy Hauler: refit', () => {
  /** Seat 0 holds Starpoint with the ships the test names in its space. */
  const withShips = (types: Parameters<typeof withUnits>[3], techs: string[] = []) =>
    withPosts(withUnits(withTechs(westInReach(), 0, techs), 'starpoint', 0, types), 'dromm', 'sarnex')
  const carriers = () => withShips(['carrier', 'carrier'])
  const mine = (s: GameState, type?: string) =>
    s.systems.starpoint.space.filter(u => u.owner === 0 && (type === undefined || u.type === type)).map(u => u.id)

  it('turns two carriers in Starpoint into one dreadnought in Starpoint', () => {
    const s = carriers()
    const before = s.players[0].reinforcements
    const done = value(use(s, 'west', { give: mine(s), take: { dreadnought: 1 } }))
    const space = done.systems.starpoint.space.filter(u => u.owner === 0)
    expect(space.map(u => u.type)).toEqual(['dreadnought'])
    expect(space[0].id).toBe(s.nextUnitId)
    expect(done.nextUnitId).toBe(s.nextUnitId + 1)
    // the two carriers went back to the reinforcements, the dreadnought came out of them
    expect(done.players[0].reinforcements.carrier).toBe(before.carrier + 2)
    expect(done.players[0].reinforcements.dreadnought).toBe(before.dreadnought - 1)
  })
  it('goes the other way too: one dreadnought for eight fighters, never nine', () => {
    // a fighter is produced two to a cost, so it is worth half a cost and a dreadnought is worth eight
    const s = withShips(['dreadnought'])
    const give = mine(s, 'dreadnought')
    expect(error(use(s, 'west', { give, take: { fighter: 9 } }))).toMatch(/cost 4.5, the ships returned are worth 4/)
    // eight fighters need eight capacity, so two war suns stay behind to carry them; the printed home fleet
    // already holds three fighters, so the pool is topped back up to the eight this trade wants
    const built = withShips(['dreadnought', 'warsun', 'warsun'])
    const roomy = withPlayer(built, 0, { reinforcements: { ...built.players[0].reinforcements, fighter: 8 } })
    const done = value(use(roomy, 'west', { give: mine(roomy, 'dreadnought'), take: { fighter: 8 } }))
    expect(done.systems.starpoint.space.filter(u => u.owner === 0 && u.type === 'fighter')).toHaveLength(8)
    expect(done.systems.starpoint.space.some(u => u.type === 'dreadnought')).toBe(false)
  })
  it('adds up a mixed set on both sides', () => {
    const s = withShips(['carrier', 'cruiser', 'fighter', 'fighter'])         // 3 + 2 + 0.5 + 0.5 = 6
    const done = value(use(s, 'west', { give: mine(s), take: { dreadnought: 1, cruiser: 1 } }))   // 4 + 2
    const types = done.systems.starpoint.space.filter(u => u.owner === 0).map(u => u.type).sort()
    expect(types).toEqual(['cruiser', 'dreadnought'])
  })
  it('rejects a set that costs more than what was returned', () => {
    const s = withShips(['carrier'])
    const give = mine(s)
    expect(error(use(s, 'west', { give, take: { dreadnought: 1 } }))).toMatch(/cost 4, the ships returned are worth 3/)
    expect(value(use(s, 'west', { give, take: { cruiser: 1 } })).systems.starpoint.space.some(u => u.type === 'cruiser')).toBe(true)
  })
  it('rejects infantry and everything else that is not a ship, on either side', () => {
    const s = withShips(['carrier'])
    const give = mine(s)
    expect(error(use(s, 'west', { give, take: { infantry: 1 } }))).toMatch(/infantry is not a ship/)
    expect(error(use(s, 'west', { give, take: { spacedock: 1 } }))).toMatch(/spacedock is not a ship/)
    expect(error(use(s, 'west', { give, take: { cruiser: 1.5 } }))).toMatch(/whole number of ships/)
    // infantry carried in the space of the system is cargo, not a hull that can be handed in
    const carried = withUnits(s, 'starpoint', 0, ['infantry'])
    const infantry = carried.systems.starpoint.space.filter(u => u.type === 'infantry').map(u => u.id)
    expect(error(use(carried, 'west', { give: [...give, ...infantry], take: { cruiser: 1 } }))).toMatch(/infantry is not a ship/)
  })
  it('rejects a refit that would leave the fleet over capacity or over the fleet pool', () => {
    // two carriers carry five fighters; one dreadnought carries one, so four of them would be homeless
    const s = withShips(['carrier', 'carrier', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter'])
    expect(error(use(s, 'west', { give: mine(s, 'carrier'), take: { dreadnought: 1 } }))).toMatch(/capacity exceeded in starpoint/)
    // with Fighter II the homeless fighters count against the fleet pool instead, which is 3
    const rescued = withShips(['carrier', 'carrier', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter'], ['fighter_ii'])
    expect(error(use(rescued, 'west', { give: mine(rescued, 'carrier'), take: { dreadnought: 1 } }))).toMatch(/fleet pool exceeded in starpoint/)
    // four cruisers for four destroyers is affordable, but the fleet pool of 3 will not hold them
    const four = withShips(['cruiser', 'cruiser', 'cruiser'])
    expect(error(use(four, 'west', { give: mine(four), take: { destroyer: 6 } }))).toMatch(/fleet pool exceeded in starpoint/)
  })
  it('rejects ships outside the post\'s systems, ships of the other seat and a malformed give list', () => {
    const s = carriers()
    const give = mine(s)
    // the printed home fleet sits in home-n, which no post serves
    expect(error(use(s, 'west', { give: [shipId(s, 'home-n', 'carrier')], take: { cruiser: 1 } })))
      .toMatch(/must be in one system linked to the west post/)
    const split = withUnits(s, 'sakulag', 0, ['carrier'])
    expect(error(use(split, 'west', { give: [...give, shipId(split, 'sakulag', 'carrier')], take: { dreadnought: 1 } })))
      .toMatch(/all in the same system/)
    expect(error(use(s, 'west', { give: [give[0], give[0]], take: { cruiser: 1 } }))).toMatch(/only be returned once/)
    expect(error(use(s, 'west', { give: [], take: { cruiser: 1 } }))).toMatch(/name the ships to return/)
    expect(error(use(s, 'west', { give }))).toMatch(/name the ships to take/)
    // affordable but not in stock: the two carriers come back as carriers, never as the dreadnought asked for
    const empty = withPlayer(s, 0, { reinforcements: { ...s.players[0].reinforcements, dreadnought: 0 } })
    expect(error(use(empty, 'west', { give, take: { dreadnought: 1 } }))).toMatch(/only 0 dreadnought in the reinforcements/)
  })
})

describe('R8 postAbilityOptions and the enumerator', () => {
  const abilities = POST_IDS

  it('offers only picks the handler accepts, for every ability', () => {
    for (const id of abilities) {
      const s = withUnits(withPosts(westInReach(), id, 'sarnex'), 'starpoint', 0, ['carrier', 'carrier', 'cruiser'])
      const options = postAbilityOptions(s, 0, 'west')
      expect(options.length, `${id} offers nothing`).toBeGreaterThan(0)
      for (const params of options) expect(use(s, 'west', params).ok, `${id}: ${JSON.stringify(params)}`).toBe(true)
    }
  })
  it('offers nothing where the guard says no', () => {
    const s = withPosts(westInReach(), 'kesh', 'sarnex')
    expect(postAbilityOptions(s, 0, 'east')).toEqual([])                      // the east post is out of reach
    expect(postAbilityOptions(s, 1, 'west')).toEqual([])                      // not seat 1's turn
    expect(postAbilityOptions(withPlayer(s, 0, { passed: true }), 0, 'west')).toEqual([])
    expect(postAbilityOptions(deepFreeze({ ...s, postAbilityUsed: { west: true, east: false } }), 0, 'west')).toEqual([])
    expect(postAbilityOptions(withPosts(toActionPhase(), 'kesh', 'sarnex'), 0, 'west')).toEqual([])   // out of reach
  })
  it('offers the clearing house one pick per planet and side, the richest first', () => {
    const s = withPosts(eastInReach(), 'sarnex', 'orrun')
    const options = postAbilityOptions(s, 0, 'east')
    // [0.0.0] pays 5 resources, Bereg 3 or 1, Quann 2 or 1; the richest pick is offered first
    const payouts = options.map(o => value(use(s, 'east', o)).players[0].tradeGoods)
    expect(payouts).toEqual([5, 3, 2, 1, 1])
  })
  it('offers the pools of the charter with the fullest first', () => {
    const s = withPlayer(withPosts(westInReach(), 'kesh', 'sarnex'), 0, { tokens: { tactic: 1, fleet: 0, strategy: 4 } })
    expect(postAbilityOptions(s, 0, 'west')).toEqual([{ pool: 'strategy' }, { pool: 'tactic' }])
  })
  it('legalMoves carries the ability as a free move, before and after the action', () => {
    const s = withPosts(westInReach(), 'kesh', 'sarnex')
    expect(legalMoves(s).some(m => m.type === 'postAbility' && m.post === 'west')).toBe(true)
    expect(validateMove(s, { type: 'postAbility', post: 'west', params: { pool: 'strategy' } }).ok).toBe(true)
    expect(validateMove(s, { type: 'postAbility', post: 'east', params: { pool: 'strategy' } }).ok).toBe(false)
    const spent = value(applyMove(deepFreeze({ ...s, tactical: { systemId: 'starpoint', step: 'done' as const } }), { type: 'endTactical' }, 0))
    expect(legalMoves(spent).some(m => m.type === 'postAbility')).toBe(true)
    // and it is gone once it has been taken
    const done = value(use(spent, 'west', { pool: 'fleet' }))
    expect(legalMoves(done).some(m => m.type === 'postAbility')).toBe(false)
  })
})
