// src/ui/games.e2e.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { toActionPhase } from '../engine/testUtils'
import App from './App'
import { playerId, readClaim, saveGame, writeClaim } from './persist'
import { navigate } from './route'

function startGame(north: string, south: string): string {
  fireEvent.change(screen.getByTestId('seat-name-0'), { target: { value: north } })
  fireEvent.change(screen.getByTestId('seat-name-1'), { target: { value: south } })
  fireEvent.click(screen.getByTestId('btn-start'))
  return window.location.hash
}

describe('a game code in the URL', () => {
  it('names the started game and brings the same browser back to it', () => {
    window.location.hash = '#/?seed=7'
    const view = render(<App ticking={false} />)
    const url = startGame('Despot', 'Kael')
    expect(url).toMatch(/^#\/g\/[A-Z2-9]{6}$/)
    expect(screen.getByTestId('board-screen')).toBeTruthy()

    // closing the tab and opening the same address again
    view.unmount()
    render(<App ticking={false} />)
    expect(window.location.hash).toBe(url)
    expect(screen.getByTestId('board-screen')).toBeTruthy()
    expect(screen.getByTestId('player-0').textContent).toContain('Despot')
  })

  it('tells a browser with no server and no local copy that no game carries the code', () => {
    window.location.hash = '#/?seed=7'
    const view = render(<App ticking={false} />)
    startGame('Despot', 'Kael')
    view.unmount()

    // another browser or device: same URL, its own empty storage
    window.localStorage.clear()
    render(<App ticking={false} />)
    const panel = screen.getByTestId('unknown-game')
    expect(panel.textContent).toContain('No game carries this code')
    expect(panel.textContent).toContain('saved in that browser alone')
    expect(panel.textContent).toContain('A shared link opens the game on any device')
    expect(screen.queryByTestId('board-screen')).toBeNull()
    fireEvent.click(screen.getByTestId('btn-lobby'))
    expect(screen.getByTestId('setup-screen')).toBeTruthy()
  })

  it('keeps two games side by side and resumes whichever the URL names', () => {
    window.location.hash = '#/?seed=7'
    render(<App ticking={false} />)
    const first = startGame('Despot', 'Kael')
    act(() => { navigate('#/') })
    const second = startGame('Ada', 'Bo')
    expect(second).not.toBe(first)
    expect(screen.getByTestId('player-0').textContent).toContain('Ada')

    act(() => { navigate(first) })
    expect(screen.getByTestId('player-0').textContent).toContain('Despot')
    act(() => { navigate(second) })
    expect(screen.getByTestId('player-0').textContent).toContain('Ada')
  })

  it('sends the bookmarked #/play to the newest saved game', () => {
    window.location.hash = '#/?seed=7'
    render(<App ticking={false} />)
    const url = startGame('Despot', 'Kael')
    act(() => { navigate('#/play') })
    expect(window.location.hash).toBe(url)
    expect(screen.getByTestId('board-screen')).toBeTruthy()
  })

  it('never asks the host of a game started from the lobby how they want to play it', () => {
    window.location.hash = '#/?seed=7'
    render(<App ticking={false} />)
    const url = startGame('Despot', 'Kael')
    expect(screen.queryByTestId('mode-question')).toBeNull()
    expect(screen.getByTestId('board-screen')).toBeTruthy()
    expect(readClaim(url.replace('#/g/', ''), playerId())?.seats).toEqual([0, 1])
  })

  it('sends #/play to the lobby when this browser holds no game', () => {
    window.location.hash = '#/play'
    render(<App ticking={false} />)
    expect(screen.getByTestId('setup-screen')).toBeTruthy()
    expect(window.location.hash).toBe('#/')
  })
})

describe('a game this browser has no claim for', () => {
  /** A saved game with no claim: what an older save, or a link opened for the first time, looks like. */
  function saved(code: string): void {
    saveGame({ code, seed: 7, minutes: 15, state: toActionPhase(), history: [], clockMs: [900000, 900000], handoff: null })
  }

  it('asks how to play it before it shows the board', () => {
    saved('MODE22')
    window.location.hash = '#/g/MODE22'
    render(<App ticking={false} />)
    expect(screen.getByTestId('mode-question')).toBeTruthy()
    expect(screen.queryByTestId('board-screen')).toBeNull()
    fireEvent.click(screen.getByTestId('btn-mode-hotseat'))
    expect(screen.getByTestId('board-screen')).toBeTruthy()
    expect(readClaim('MODE22', playerId())?.seats).toEqual([0, 1])
    expect(screen.getByTestId('hint')).toBeTruthy()
  })

  it('takes one seat and locks the board to it', () => {
    saved('SEAT22')
    window.location.hash = '#/g/SEAT22'
    render(<App ticking={false} />)
    fireEvent.click(screen.getByTestId('btn-take-seat-1'))
    expect(screen.getByTestId('board-screen')).toBeTruthy()
    expect(readClaim('SEAT22', playerId())?.seats).toEqual([1])
    expect(screen.getByTestId('turn-line').textContent).toContain('A is to act')
    expect(screen.getByTestId('btn-tactical').hasAttribute('disabled')).toBe(true)
  })

  it('offers only the seat the other browser left, and asks again for another game', () => {
    saved('HALF22')
    writeClaim('HALF22', { seats: [0], playerId: 'somebody-else' })
    window.location.hash = '#/g/HALF22'
    render(<App ticking={false} />)
    expect(screen.getByTestId('btn-take-seat-0').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('btn-take-seat-1').hasAttribute('disabled')).toBe(false)
    fireEvent.click(screen.getByTestId('btn-take-seat-1'))
    expect(screen.getByTestId('board-screen')).toBeTruthy()

    // a second game this browser has no claim for asks its own question
    saved('OTHR22')
    act(() => { navigate('#/g/OTHR22') })
    expect(screen.getByTestId('mode-question')).toBeTruthy()
  })

  it('leaves a visitor to a game two browsers hold watching the board', () => {
    saved('FULL22')
    writeClaim('FULL22', { seats: [0], playerId: 'first' })
    writeClaim('FULL22', { seats: [1], playerId: 'second' })
    window.location.hash = '#/g/FULL22'
    render(<App ticking={false} />)
    fireEvent.click(screen.getByTestId('btn-watch'))
    expect(readClaim('FULL22', playerId())?.seats).toEqual([])
    expect(screen.getByTestId('board-screen')).toBeTruthy()
    expect(screen.getByTestId('turn-line').textContent).toContain('Watching')
    expect(screen.getByTestId('btn-pass').hasAttribute('disabled')).toBe(true)
  })

  it('still says a game it does not hold at all is elsewhere', () => {
    window.location.hash = '#/g/GONE22'
    render(<App ticking={false} />)
    expect(screen.getByTestId('unknown-game')).toBeTruthy()
    expect(screen.queryByTestId('mode-question')).toBeNull()
  })
})
