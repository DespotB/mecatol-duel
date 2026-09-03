// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { toActionPhase } from '../../engine/testUtils'
import { BoardMap } from './BoardMap'

const state = toActionPhase()

describe('the board', () => {
  it('draws all seven systems with their tile art', () => {
    render(<BoardMap state={state} />)
    for (const id of ['home-n', 'bereg', 'sakulag', 'mecatol', 'quann', 'starpoint', 'home-s']) {
      expect(screen.getByTestId(`tile-${id}`)).toBeTruthy()
    }
    expect(screen.getByTestId('hex-mecatol').getAttribute('src')).toContain('18_MR.png')
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

  it('R1: composed tiles carry a planet plate, printed tiles do not, and wormholes show their glyph', () => {
    render(<BoardMap state={state} />)
    expect(screen.getByTestId('plate-sakulag').textContent).toBe('21Sakulag')
    expect(screen.getByTestId('plate-centauri').textContent).toBe('13Centauri')
    expect(screen.queryByTestId('plate-bereg')).toBeNull()
    expect(screen.getByTestId('wormhole-bereg').getAttribute('src')).toContain('WHalpha')
    expect(screen.getByTestId('wormhole-quann').getAttribute('src')).toContain('WHbeta')
    expect(screen.getByTestId('anomaly-sakulag')).toBeTruthy()
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

  it('R8: both trade posts sit outside the map with their state', () => {
    render(<BoardMap state={state} />)
    expect(screen.getByTestId('post-west').textContent).toContain('Kasda Exchange')
    expect(screen.getByTestId('post-east').textContent).toContain('Vorhal Freeport')
  })
})
