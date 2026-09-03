// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { FACTIONS } from '../../data/factions'
import type { FactionId, UnitType } from '../../engine/types'

function startingCount(faction: FactionId, type: UnitType): number {
  return FACTIONS[faction].startingUnits.filter(u => u.type === type).reduce((n, u) => n + u.count, 0)
}

function renderApp(hash = '#/?seed=7') {
  window.location.hash = hash
  return render(<App ticking={false} />)
}

describe('the setup screen', () => {
  it('offers two seats with the v1 factions and the eight TI colours', () => {
    renderApp()
    expect(screen.getByTestId('seat-faction-0').textContent).toBe('L1Z1X Mindnet')
    expect(screen.getByTestId('seat-faction-1').textContent).toBe('Barony of Letnev')
    expect(screen.getByTestId('seat-position-0').textContent).toBe('North')
    expect(screen.getByTestId('seat-position-1').textContent).toBe('South')
    expect(screen.getAllByTestId(/^colour-0-/)).toHaveLength(8)
  })

  it('swaps the factions between the seats', () => {
    renderApp()
    fireEvent.click(screen.getByTestId('btn-swap-factions'))
    expect(screen.getByTestId('seat-faction-0').textContent).toBe('Barony of Letnev')
    expect(screen.getByTestId('seat-faction-1').textContent).toBe('L1Z1X Mindnet')
  })

  it('R2: keeps the two colours distinct', () => {
    renderApp()
    expect(screen.getByTestId('colour-1-blue').hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByTestId('colour-1-green'))
    expect(screen.getByTestId('chosen-colour-1').textContent).toBe('Green')
    expect(screen.getByTestId('colour-0-green').hasAttribute('disabled')).toBe(true)
  })

  it('starts the game and shows the board', () => {
    renderApp()
    fireEvent.change(screen.getByTestId('seat-name-0'), { target: { value: 'Despot' } })
    fireEvent.change(screen.getByTestId('seat-name-1'), { target: { value: 'Kael' } })
    fireEvent.click(screen.getByTestId('btn-start'))
    expect(screen.getByTestId('board-screen')).toBeTruthy()
    expect(screen.getByTestId('round').textContent).toBe('Round 1 of 6, strategy phase')
  })

  it('offers hot-seat play now and disables the two online panels until they ship', () => {
    renderApp()
    expect(screen.getByTestId('landing-hotseat').querySelector('button')?.hasAttribute('disabled')).toBe(false)
    expect(screen.getByTestId('landing-online').querySelector('button')?.hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('landing-join').querySelector('button')?.hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('landing-online').textContent).toContain('coming with online play')
    expect(screen.getByTestId('landing-join').textContent).toContain('coming with online play')
  })

  it('lists the starting fleet as a row of unit sprites with counts', () => {
    renderApp()
    // l1z1x: dreadnought, carrier, fighter, infantry, pds, spacedock
    expect(screen.getByTestId('seat-0-fleet').querySelectorAll('img')).toHaveLength(6)
    expect(screen.getByTestId('seat-0-fleet-fighter-count').textContent).toBe('3')
    expect(screen.getByTestId('seat-0-fleet-infantry-count').textContent).toBe('5')
    // letnev: dreadnought, carrier, destroyer, fighter, infantry, spacedock
    expect(screen.getByTestId('seat-1-fleet').querySelectorAll('img')).toHaveLength(6)
    expect(screen.getByTestId('seat-1-fleet-fighter-count').textContent).toBe('1')
    expect(screen.getByTestId('seat-1-fleet-infantry-count').textContent).toBe('3') // 2 on Arc Prime, 1 on Wren Terra
  })

  it('presents the lobby as a hot-seat lobby with both seats taken', () => {
    renderApp()
    expect(screen.getByTestId('lobby-tab').textContent).toContain('Hot-seat')
    expect(screen.getByTestId('lobby-status').textContent).toContain('2 of 2 seats taken')
  })

  it('shows a leader portrait and a faction symbol for each seat', () => {
    renderApp()
    expect(screen.getByAltText('L1Z1X Mindnet portrait').getAttribute('src')).toBe('/assets/factions/leader_l1z1x_commander.png')
    expect(screen.getByAltText('Barony of Letnev portrait').getAttribute('src')).toBe('/assets/factions/leader_letnev_commander.png')
    expect(screen.getByTestId('seat-symbol-0').getAttribute('src')).toBe('/assets/factions/l1z1x.png')
    expect(screen.getByTestId('seat-symbol-1').getAttribute('src')).toBe('/assets/factions/letnev.png')
  })

  it('spells the starting fleet out under the sprites', () => {
    renderApp()
    const fighters = startingCount('l1z1x', 'fighter')
    const infantry = startingCount('l1z1x', 'infantry')
    expect(screen.getByTestId('seat-0-fleet-caption').textContent)
      .toBe(`Super-Dreadnought I, Carrier, ${fighters} Fighters, ${infantry} Infantry, PDS, Space Dock`)
    expect(screen.getByTestId('seat-1-fleet-caption').textContent)
      .toBe(`Dreadnought, Carrier, Destroyer, Fighter, ${startingCount('letnev', 'infantry')} Infantry, Space Dock`)
  })

  it('names the starting techs of both factions', () => {
    renderApp()
    expect(screen.getByTestId('seat-0-techs').textContent).toBe('Neural Motivator, Plasma Scoring')
    expect(screen.getByTestId('seat-1-techs').textContent).toBe('Antimass Deflectors, Plasma Scoring')
  })

  it('names the map, the clock and the target below the seats', () => {
    renderApp()
    expect(screen.getByTestId('setup-map').textContent).toContain('Bereg Standoff')
    expect(screen.getByTestId('setup-map').textContent).toContain('7 systems, Mecatol Rex in the centre, home systems north and south')
    expect(screen.getByTestId('setup-clock').textContent).toContain('minutes per player')
    expect(screen.getByTestId('setup-target').textContent).toContain('7 victory points or 6 rounds')
    expect(screen.getByTestId('minutes').getAttribute('value')).toBe('15')
  })

  it('keeps the hot-seat blurb in step with the clock', () => {
    renderApp()
    expect(screen.getByTestId('landing-hotseat').textContent).toContain('chess clock 15 minutes each')
    fireEvent.change(screen.getByTestId('minutes'), { target: { value: '20' } })
    expect(screen.getByTestId('landing-hotseat').textContent).toContain('chess clock 20 minutes each')
  })

  it('credits Fantasy Flight Games and AsyncTI4', () => {
    renderApp()
    expect(screen.getByTestId('setup-legal').textContent)
      .toBe('Fan project. Twilight Imperium and its artwork belong to Fantasy Flight Games. Unit, tile and card images via AsyncTI4.')
  })
})
