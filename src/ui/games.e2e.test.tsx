// src/ui/games.e2e.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
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

  it('tells another browser that the game is not on this device', () => {
    window.location.hash = '#/?seed=7'
    const view = render(<App ticking={false} />)
    startGame('Despot', 'Kael')
    view.unmount()

    // another browser or device: same URL, its own empty storage
    window.localStorage.clear()
    render(<App ticking={false} />)
    const panel = screen.getByTestId('unknown-game')
    expect(panel.textContent).toContain('This game is not on this device')
    expect(panel.textContent).toContain('Games are saved in the browser they were started in.')
    expect(panel.textContent).toContain('online play')
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

  it('sends #/play to the lobby when this browser holds no game', () => {
    window.location.hash = '#/play'
    render(<App ticking={false} />)
    expect(screen.getByTestId('setup-screen')).toBeTruthy()
    expect(window.location.hash).toBe('#/')
  })
})
