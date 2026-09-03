// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TRADE_POSTS } from '../../data/map'
import { toActionPhase, withPlanetOwner } from '../../engine/testUtils'
import { BoardMap } from './BoardMap'
import type { PostId } from '../../data/posts'
import type { GameState, Seat } from '../../engine/types'

const state = toActionPhase()

/** R8: the rolled pair is part of the state, so a test names the two posts it wants to see drawn. */
function withPosts(base: GameState, west: PostId, east: PostId): GameState {
  return { ...base, posts: { west, east } }
}

describe('the board', () => {
  it('draws all seven systems with their tile art', () => {
    render(<BoardMap state={state} />)
    for (const id of ['home-n', 'bereg', 'sakulag', 'mecatol', 'quann', 'starpoint', 'home-s']) {
      expect(screen.getByTestId(`tile-${id}`)).toBeTruthy()
    }
    // R1: the tile file is the background alone, the planets are drawn on top from their own renders
    expect(screen.getByTestId('hex-mecatol').getAttribute('src')).toContain('00_blue.png')
    expect(screen.getByTestId('planet-art-mecatol-rex').getAttribute('src')).toContain('planet_Mecatol.png')
  })

  it('stacks the units of a system with a count badge', () => {
    render(<BoardMap state={state} />)
    expect(screen.getByTestId('stack-home-n-0-fighter').textContent).toBe('3')
    expect(screen.getByTestId('stack-home-n-0-carrier').textContent).toBe('')
    expect(screen.getByTestId('sprite-home-n-0-dreadnought').getAttribute('src')).toContain('blue_dreadnought.png')
    expect(screen.getByTestId('sprite-home-n-0-dreadnought').getAttribute('width')).toBe('44')
    expect(screen.getByTestId('stack-home-s-1-destroyer')).toBeTruthy()
  })

  it('shows ground forces, structures and control tokens on the planets', () => {
    render(<BoardMap state={state} />)
    expect(screen.getByTestId('ground-000-0-infantry').textContent).toBe('5')
    expect(screen.getByTestId('structure-000-0-spacedock')).toBeTruthy()
    expect(screen.getByTestId('structure-000-0-pds')).toBeTruthy()
    expect(screen.getByTestId('control-000').getAttribute('src')).toContain('l1z1x_control.png')
    expect(screen.getByTestId('ground-arc-prime-1-infantry').textContent).toBe('2')
    expect(screen.getByTestId('ground-wren-terra-1-infantry').textContent).toBe('1')
    expect(screen.queryByTestId('control-sakulag')).toBeNull()
  })

  it('R4.2: the guardian fleet is grey and carries two infantry on Mecatol Rex', () => {
    render(<BoardMap state={state} />)
    expect(screen.getByTestId('guardian-label').textContent).toBe('Guardian fleet, worth 8')
    expect(screen.getByTestId('ground-mecatol-rex-guardian-infantry').textContent).toBe('2')
    const ships = screen.getAllByTestId(/^sprite-mecatol-guardian-/)
    expect(ships.length).toBeGreaterThan(0)
    for (const ship of ships) expect(ship.getAttribute('src')).toContain('/grey_')
  })

  it('R1: every planet carries its own nameplate, and wormholes show their glyph', () => {
    render(<BoardMap state={state} />)
    expect(screen.getByTestId('plate-sakulag').textContent).toBe('21Sakulag')
    expect(screen.getByTestId('plate-centauri').textContent).toBe('13Centauri')
    expect(screen.getByTestId('plate-bereg').textContent).toBe('31Bereg')
    expect(screen.getByTestId('plate-mecatol-rex').textContent).toBe('16Mecatol Rex')
    expect(screen.getByTestId('sigil-home-n').getAttribute('src')).toContain('l1z1x.png')
    expect(screen.getByTestId('sigil-home-s').getAttribute('src')).toContain('letnev.png')
    expect(screen.getByTestId('wormhole-bereg').getAttribute('src')).toContain('WHalpha')
    expect(screen.getByTestId('wormhole-quann').getAttribute('src')).toContain('WHbeta')
  })

  it('only calls back for a system the caller marked selectable', () => {
    const onSelect = vi.fn()
    render(<BoardMap state={state} selectable={['bereg']} activeSystemId="quann" onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('tile-bereg'))
    fireEvent.click(screen.getByTestId('tile-sakulag'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('bereg')
    expect(screen.getByTestId('tile-quann').className).toContain('active')
    expect(screen.getByTestId('tile-bereg').className).toContain('selectable')
  })

  it('makes a selectable tile a focusable button that answers to Enter and Space', () => {
    const onSelect = vi.fn()
    render(<BoardMap state={state} selectable={['bereg']} onSelect={onSelect} />)
    const tile = screen.getByTestId('tile-bereg')
    expect(tile.getAttribute('role')).toBe('button')
    expect(tile.getAttribute('tabindex')).toBe('0')
    expect(tile.getAttribute('aria-label')).toBe('Activate Bereg')
    tile.focus()
    expect(document.activeElement).toBe(tile)
    fireEvent.keyDown(tile, { key: 'Enter' })
    fireEvent.keyDown(tile, { key: ' ' })
    fireEvent.keyDown(tile, { key: 'a' })
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onSelect).toHaveBeenCalledWith('bereg')
    // a tile that cannot be activated stays out of the tab order
    const idle = screen.getByTestId('tile-sakulag')
    expect(idle.getAttribute('role')).toBeNull()
    expect(idle.getAttribute('tabindex')).toBeNull()
  })

  it('R8: both trade posts sit outside the map, each drawn as the post the state rolled', () => {
    render(<BoardMap state={withPosts(state, 'sarnex', 'tessik')} />)
    const west = screen.getByTestId('post-west')
    expect(west.textContent).toContain('Sarnex Wheel')
    expect(west.textContent).toContain('4 commodities for 4 trade goods')
    expect(screen.getByTestId('post-art-west').getAttribute('src')).toBe('/assets/posts/sarnex.png')
    // R8: the Sarnex Wheel is the one post without a special ability, and the card says so
    expect(screen.getByTestId('post-ability-west').textContent).toBe('No special ability')
    const east = screen.getByTestId('post-east')
    expect(east.textContent).toContain('Tessik Refinery')
    expect(east.textContent).toContain('2 commodities for 2 trade goods')
    expect(screen.getByTestId('post-art-east').getAttribute('src')).toBe('/assets/posts/tessik.png')
    expect(screen.getByTestId('post-ability-east').textContent).toBe('Technology exchange')
  })

  it('R8: the pair turns over with the round, and the panel marks it as new', () => {
    const { rerender } = render(<BoardMap state={withPosts(state, 'sarnex', 'tessik')} />)
    expect(screen.getByTestId('post-new-west').textContent).toBe('New this round')
    rerender(<BoardMap state={{ ...withPosts(state, 'orrun', 'kesh'), round: 2 }} />)
    expect(screen.getByTestId('post-art-west').getAttribute('src')).toBe('/assets/posts/orrun.png')
    expect(screen.getByTestId('post-art-east').getAttribute('src')).toBe('/assets/posts/kesh.png')
    expect(screen.getByTestId('post-west').textContent).toContain('Orrun Port Authority')
    expect(screen.getByTestId('post-east').textContent).toContain('Kesh Line Freighter')
    expect(screen.getByTestId('post-new-west').textContent).toBe('New this round')
    expect(screen.getByTestId('post-new-east').textContent).toBe('New this round')
  })

  it('R8: a post says whether the sale and the ability are still open for the seat', () => {
    const reachable = withPlanetOwner(withPosts(state, 'tessik', 'orrun'), 'sakulag', 'sakulag', 0)
    const { rerender } = render(<BoardMap state={reachable} />)
    expect(screen.getByTestId('post-state-west').textContent).toBe('Sale open')
    // R8: out of reach for the acting seat, and the card says why rather than going quiet
    expect(screen.getByTestId('post-state-east').textContent).toBe('Hold a planet in Bereg or Quann')
    expect(screen.queryByTestId('post-used-west')).toBeNull()
    // R8: the special ability is once per round for the whole table, so a used one is spent for both seats
    rerender(<BoardMap state={{ ...reachable, postAbilityUsed: { west: true, east: false } }} />)
    expect(screen.getByTestId('post-used-west').textContent).toBe('Ability used this round')
    expect(screen.queryByTestId('post-used-east')).toBeNull()
  })

  it('R8: a hyperlane runs from each post to both systems it serves', () => {
    render(<BoardMap state={state} />)
    for (const [post, systems] of Object.entries(TRADE_POSTS)) {
      for (const systemId of systems) {
        const lane = screen.getByTestId(`lane-${post}-${systemId}`)
        expect(lane.querySelectorAll('path').length, `${post}-${systemId}`).toBeGreaterThan(0)
      }
    }
  })

  it('R8: only the lane of a system the acting seat holds a planet in is lit', () => {
    render(<BoardMap state={withPlanetOwner(state, 'starpoint', 'starpoint', 0)} />)
    expect(screen.getByTestId('lane-west-starpoint').getAttribute('class')).toContain('lit')
    for (const id of ['lane-west-sakulag', 'lane-east-bereg', 'lane-east-quann']) {
      expect(screen.getByTestId(id).getAttribute('class'), id).not.toContain('lit')
    }
  })

  it('shows a played command token per seat with a token on the system, and none on an idle system', () => {
    const activated = {
      ...state,
      systems: {
        ...state.systems,
        bereg: { ...state.systems.bereg, activatedBy: [0] as Seat[] },
        sakulag: { ...state.systems.sakulag, activatedBy: [0, 1] as Seat[] },
      },
    }
    render(<BoardMap state={activated} />)
    const seat0 = screen.getByTestId('activation-bereg-0')
    expect(seat0.getAttribute('src')).toContain('l1z1x_command.png')
    expect(seat0.getAttribute('alt')).toBe(`${state.players[0].name} command token`)
    expect(screen.getByTestId('activation-sakulag-0').getAttribute('src')).toContain('l1z1x_command.png')
    expect(screen.getByTestId('activation-sakulag-1').getAttribute('src')).toContain('letnev_command.png')
    expect(screen.getByTestId('activation-sakulag-1').getAttribute('alt')).toBe(`${state.players[1].name} command token`)
    expect(screen.queryByTestId('activation-quann-0')).toBeNull()
    expect(screen.queryByTestId('activation-quann-1')).toBeNull()
  })
})
