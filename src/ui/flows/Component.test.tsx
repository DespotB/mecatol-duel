// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { toActionPhase, withPlanetOwner, withPlayer, withTechs, withUnits } from '../../engine/testUtils'
import { renderWithSession } from '../test/harness'
import { ComponentPanel } from './ComponentPanel'
import type { PostId } from '../../data/posts'
import type { GameState } from '../../engine/types'

/** Seat 0 on turn, holding Sakulag and Starpoint, so the west post is in reach and the east one is not. */
function atPosts(west: PostId, east: PostId): GameState {
  const base = toActionPhase(1, 0)
  const owned = withPlanetOwner(withPlanetOwner(base, 'sakulag', 'sakulag', 0), 'starpoint', 'starpoint', 0)
  return { ...owned, posts: { west, east }, postAbilityUsed: { west: false, east: false } }
}

const noop = () => { /* the panel is not closed in these tests */ }

describe('the component panel offers what the two posts in play can do', () => {
  it('R8: sells commodities up to the post its own limit, four at the Sarnex Wheel', () => {
    const state = withPlayer(atPosts('sarnex', 'kesh'), 0, { commodities: 4 })
    const view = renderWithSession(state, <ComponentPanel onClose={noop} />)
    expect(screen.getByTestId('post-sale-west').textContent).toContain('Sarnex Time Machine Wheel')
    expect(screen.getByTestId('sale-west')).toHaveProperty('textContent', '4')
    fireEvent.click(screen.getByTestId('btn-tradepost-west'))
    const player = view.store().session?.state.players[0]
    expect(player?.tradeGoods).toBe(4)
    expect(player?.commodities).toBe(0)
  })

  it('R8: the special ability is offered with its name, and disabled with a reason when it is out of reach', () => {
    const state = atPosts('kesh', 'tessik')
    renderWithSession(state, <ComponentPanel onClose={noop} />)
    expect(screen.getByTestId('btn-ability-west').textContent).toContain('Charter')
    expect(screen.getByTestId('btn-ability-west').hasAttribute('disabled')).toBe(false)
    expect(screen.getByTestId('btn-ability-east').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('ability-reason-east').textContent).toContain('Bereg or Quann')
  })

  it('R8: an ability already taken this round is disabled for the other seat too', () => {
    const state = { ...atPosts('kesh', 'tessik'), postAbilityUsed: { west: true, east: false } }
    renderWithSession(state, <ComponentPanel onClose={noop} />)
    expect(screen.getByTestId('btn-ability-west').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('ability-reason-west').textContent).toContain('Used this round')
  })

  it('R8: the charter picks a pool and pays four trade goods', () => {
    const view = renderWithSession(atPosts('kesh', 'tessik'), <ComponentPanel onClose={noop} />)
    fireEvent.click(screen.getByTestId('btn-ability-west'))
    fireEvent.click(screen.getByTestId('pool-fleet'))
    fireEvent.click(screen.getByTestId('btn-ability-confirm'))
    const player = view.store().session?.state.players[0]
    expect(player?.tradeGoods).toBe(4)
    expect(player?.tokens.fleet).toBe(2)
    expect(view.store().session?.state.postAbilityUsed.west).toBe(true)
  })

  it('R8: the time trade names the price on the button and takes half the clock for a victory point', () => {
    const view = renderWithSession(atPosts('sarnex', 'tessik'), <ComponentPanel onClose={noop} />, { clockMs: [600000, 900000] })
    fireEvent.click(screen.getByTestId('btn-ability-west'))
    // half of ten minutes, spelled out in real numbers rather than as "half your clock"
    expect(screen.getByTestId('btn-ability-confirm').textContent).toContain('05:00')
    fireEvent.click(screen.getByTestId('btn-ability-confirm'))
    expect(view.store().session?.state.players[0].vp).toBe(1)
    expect(view.store().session?.clockMs[0]).toBe(300000)
  })

  it('R8: the clearing house exhausts one planet, paying its resources or its influence', () => {
    const view = renderWithSession(atPosts('orrun', 'tessik'), <ComponentPanel onClose={noop} />)
    fireEvent.click(screen.getByTestId('btn-ability-west'))
    fireEvent.click(screen.getByTestId('ch-planet-starpoint'))
    fireEvent.click(screen.getByTestId('ch-pay-influence'))
    fireEvent.click(screen.getByTestId('btn-ability-confirm'))
    const state = view.store().session?.state
    expect(state?.players[0].tradeGoods).toBe(1)
    expect(state?.systems.starpoint.planets.find(p => p.id === 'starpoint')?.exhausted).toBe(true)
  })

  it('R8: the technology exchange trades one general technology for another of the same tier', () => {
    const base = withTechs(atPosts('tessik', 'kesh'), 0, ['neural_motivator'])
    const view = renderWithSession(base, <ComponentPanel onClose={noop} />)
    fireEvent.click(screen.getByTestId('btn-ability-west'))
    fireEvent.click(screen.getByTestId('give-tech-neural_motivator'))
    fireEvent.click(screen.getByTestId('tech-card-antimass_deflectors'))
    fireEvent.click(screen.getByTestId('btn-ability-confirm'))
    const techs = view.store().session?.state.players[0].techs ?? []
    expect(techs).toContain('antimass_deflectors')
    expect(techs).not.toContain('neural_motivator')
  })

  it('R8: the refit returns ships and takes ships of no greater total cost', () => {
    const withShips = withUnits(atPosts('dromm', 'kesh'), 'starpoint', 0, ['dreadnought'])
    const view = renderWithSession(withShips, <ComponentPanel onClose={noop} />)
    fireEvent.click(screen.getByTestId('btn-ability-west'))
    const ship = screen.getByTestId(/^refit-give-/)
    fireEvent.click(ship)
    // a dreadnought is worth four, so two cruisers fit and three do not
    fireEvent.click(screen.getByTestId('step-cruiser-plus'))
    fireEvent.click(screen.getByTestId('step-cruiser-plus'))
    expect(screen.getByTestId('refit-total').textContent).toContain('4')
    fireEvent.click(screen.getByTestId('step-cruiser-plus'))
    expect(screen.getByTestId('btn-ability-confirm').hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByTestId('step-cruiser-minus'))
    fireEvent.click(screen.getByTestId('btn-ability-confirm'))
    const space = view.store().session?.state.systems.starpoint.space ?? []
    expect(space.filter(u => u.type === 'cruiser').length).toBe(2)
    expect(space.filter(u => u.type === 'dreadnought').length).toBe(0)
  })

  it('R8: a post out of commodities offers no sale, and says why', () => {
    const broke = withPlayer(atPosts('kesh', 'tessik'), 0, { commodities: 0 })
    renderWithSession(broke, <ComponentPanel onClose={noop} />)
    expect(screen.getByTestId('btn-tradepost-west').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('sale-reason-west').textContent).toContain('No commodities')
  })
})
