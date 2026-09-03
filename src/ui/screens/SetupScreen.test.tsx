// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

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
})
