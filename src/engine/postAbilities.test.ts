import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { deepFreeze, toActionPhase, withCards, withExhausted, withPlanetOwner, withPlayer, withPosts, withTechs } from './testUtils'
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
  it('R8: a post without a special ability has nothing to offer', () => {
    const wheel = withPosts(eastInReach(), 'tessik', 'sarnex')
    expect(error(use(wheel, 'east', { techId: 'neural_motivator', takeTechId: 'antimass_deflectors' })))
      .toMatch(/Sarnex Wheel has no special ability/)
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

  it('exhausts ready planets for one trade good per resource or influence spent', () => {
    // Quann pays its 2 resources, Bereg its 1 influence
    const done = value(use(base(), 'east', { planets: ['quann'], influencePlanets: ['bereg'] }))
    expect(done.players[0].tradeGoods).toBe(3)
    expect(done.systems.quann.planets[0].exhausted).toBe(true)
    expect(done.systems.bereg.planets.find(p => p.id === 'bereg')?.exhausted).toBe(true)
    expect(done.systems.bereg.planets.find(p => p.id === 'lirta-iv')?.exhausted).toBe(false)
  })
  it('lets one planet pay either side, never both', () => {
    expect(value(use(base(), 'east', { planets: ['bereg'] })).players[0].tradeGoods).toBe(3)      // 3 resources
    expect(value(use(base(), 'east', { influencePlanets: ['bereg'] })).players[0].tradeGoods).toBe(1)
    expect(error(use(base(), 'east', { planets: ['bereg'], influencePlanets: ['bereg'] }))).toMatch(/exhausted/)
  })
  it('rejects more than 3 trade goods, an exhausted planet and a payment worth nothing', () => {
    expect(error(use(base(), 'east', { planets: ['bereg', 'quann'] }))).toMatch(/at most 3 trade goods/)
    expect(error(use(withExhausted(base(), ['quann']), 'east', { planets: ['quann'] }))).toMatch(/exhausted/)
    expect(error(use(base(), 'east', { influencePlanets: ['000'] }))).toMatch(/worth nothing/)     // [0.0.0] has no influence
    expect(error(use(base(), 'east', { planets: [] }))).toMatch(/at least one planet/)
    expect(error(use(base(), 'east', { planets: ['arc-prime'] }))).toMatch(/not controlled/)
  })
})
