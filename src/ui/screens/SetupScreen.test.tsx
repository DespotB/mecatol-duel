// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { FACTIONS } from '../../data/factions'
import { createGame } from '../../engine'
import { listGames, saveGame } from '../persist'
import type { FactionId, UnitType } from '../../engine/types'

function startingCount(faction: FactionId, type: UnitType): number {
  return FACTIONS[faction].startingUnits.filter(u => u.type === type).reduce((n, u) => n + u.count, 0)
}

function renderApp(hash = '#/?seed=7') {
  window.location.hash = hash
  return render(<App ticking={false} />)
}

/** A game already in this browser's storage, as if it had been started earlier. */
function savedGame(code: string, north: string, south: string) {
  const state = createGame({
    players: [{ faction: 'l1z1x', color: 'blue', name: north }, { faction: 'letnev', color: 'red', name: south }],
    speaker: 0,
  }, 7)
  saveGame({ code, seed: 7, minutes: 15, state, history: [], clockMs: [900000, 900000], handoff: null })
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

  it('asks how the game is played before anything else, hot-seat first', () => {
    renderApp()
    expect(screen.getByTestId('mode-hotseat').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('mode-online').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('btn-start').textContent).toContain('Start hot-seat game')
    // the seat picker belongs to the online answer alone
    expect(screen.queryByTestId('pick-seat')).toBeNull()
  })

  it('switches to online, offers the two seats and says what the lobby now means', () => {
    renderApp()
    fireEvent.click(screen.getByTestId('mode-online'))
    expect(screen.getByTestId('mode-online').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('btn-start').textContent).toContain('Create the game')
    expect(screen.getByTestId('pick-seat')).toBeTruthy()
    expect(screen.getByTestId('host-seat-0').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('lobby-status').textContent).toContain('1 of 2 seats taken')
    fireEvent.click(screen.getByTestId('host-seat-1'))
    expect(screen.getByTestId('host-seat-1').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('lobby-mode').textContent).toContain('you take south')
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

  it('keeps the mode blurb in step with the clock', () => {
    renderApp()
    expect(screen.getByTestId('mode-line').textContent).toContain('15 minutes each on the chess clock')
    fireEvent.change(screen.getByTestId('minutes'), { target: { value: '20' } })
    expect(screen.getByTestId('mode-line').textContent).toContain('20 minutes each on the chess clock')
  })

  it('draws three game slots, empty until this browser holds a game', () => {
    renderApp()
    expect(screen.getByTestId('games-tab').textContent).toContain('0 of 3')
    expect(screen.getByTestId('game-slot-empty-0')).toBeTruthy()
    expect(screen.getByTestId('game-slot-empty-2')).toBeTruthy()
    cleanup()
    savedGame('AAA222', 'Despot', 'Kael')
    renderApp()
    expect(screen.getByTestId('games-tab').textContent).toContain('1 of 3')
    expect(screen.getByTestId('saved-game-AAA222')).toBeTruthy()
    // the slot the game took is gone, the other two are still drawn
    expect(screen.queryByTestId('game-slot-empty-0')).toBeNull()
    expect(screen.getByTestId('game-slot-empty-1')).toBeTruthy()
  })

  it('refuses a fourth game and says why, rather than dropping the oldest', () => {
    savedGame('AAA222', 'Despot', 'Kael')
    savedGame('BBB333', 'Ada', 'Bo')
    savedGame('CCC444', 'Cy', 'Dee')
    renderApp()
    expect(screen.getByTestId('games-tab').textContent).toContain('3 of 3')
    expect(screen.getByTestId('btn-start').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('start-note').textContent).toContain('Delete one to start another')
  })

  it('lists the saved games newest first and resumes the one that is picked', () => {
    savedGame('AAA222', 'Despot', 'Kael')
    savedGame('BBB333', 'Ada', 'Bo')
    renderApp()
    const rows = screen.getAllByTestId(/^saved-game-/)
    expect(rows.map(row => row.getAttribute('data-testid'))).toEqual(['saved-game-BBB333', 'saved-game-AAA222'])
    expect(rows[0].textContent).toContain('Ada')
    expect(rows[0].textContent).toContain('Bo')
    expect(rows[0].textContent).toContain('BBB333')
    expect(rows[0].textContent).toContain('Round 1')
    expect(rows[0].textContent).toContain('just now')

    fireEvent.click(screen.getByTestId('btn-resume-AAA222'))
    expect(window.location.hash).toBe('#/g/AAA222')
    // this one was saved before the browser claimed a seat, so the game asks once how to play it
    fireEvent.click(screen.getByTestId('btn-mode-hotseat'))
    expect(screen.getByTestId('board-screen')).toBeTruthy()
    expect(screen.getByTestId('player-0').textContent).toContain('Despot')
  })

  /** The page scales itself to its own height, so a block that grows with the games would resize the screen. */
  it('keeps the page the same height however many games are saved', () => {
    renderApp()
    const bare = screen.getByTestId('setup-screen').style.zoom
    cleanup()
    savedGame('AAA222', 'Despot', 'Kael')
    savedGame('BBB333', 'Ada', 'Bo')
    renderApp()
    expect(screen.getByTestId('setup-screen').style.zoom).toBe(bare)
  })

  it('deletes one saved game and leaves the others alone', () => {
    savedGame('AAA222', 'Despot', 'Kael')
    savedGame('BBB333', 'Ada', 'Bo')
    renderApp()
    fireEvent.click(screen.getByTestId('btn-delete-AAA222'))
    expect(screen.queryByTestId('saved-game-AAA222')).toBeNull()
    expect(screen.getByTestId('saved-game-BBB333')).toBeTruthy()
    expect(listGames().map(game => game.code)).toEqual(['BBB333'])
  })

  it('credits Fantasy Flight Games, AsyncTI4 and the music the licence asks it to name', () => {
    renderApp()
    const legal = screen.getByTestId('setup-legal').textContent ?? ''
    expect(legal).toContain('Twilight Imperium and its artwork belong to Fantasy Flight Games')
    expect(legal).toContain('Unit, tile and card images via AsyncTI4')
    expect(legal).toContain('Kevin MacLeod')
    expect(legal).toContain('Creative Commons By Attribution 4.0')
    expect(legal).toContain('re-encoded for the web')   // CC BY asks that a change be named
  })
})
