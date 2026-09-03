// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { cardsUsed, toActionPhase } from '../engine/testUtils'
import { BoardScreen } from './screens/BoardScreen'
import { renderWithSession } from './test/harness'

describe('hot-seat courtesies', () => {
  it('asks to pass the device when the seat to act changes', () => {
    renderWithSession(cardsUsed(toActionPhase()), <BoardScreen />)
    expect(screen.queryByTestId('handoff')).toBeNull()
    fireEvent.click(screen.getByTestId('btn-pass'))
    expect(screen.getByTestId('handoff').textContent).toContain('Pass the device to B')
    // the board behind the overlay takes no clicks and no focus while it is up
    expect(screen.getByTestId('board-screen').hasAttribute('inert')).toBe(true)
    fireEvent.click(screen.getByTestId('handoff-continue'))
    expect(screen.queryByTestId('handoff')).toBeNull()
    expect(screen.getByTestId('board-screen').hasAttribute('inert')).toBe(false)
  })

  it('makes the overlay a modal dialog and puts the focus on its continue button', () => {
    renderWithSession(cardsUsed(toActionPhase()), <BoardScreen />)
    fireEvent.click(screen.getByTestId('btn-pass'))
    const overlay = screen.getByTestId('handoff')
    expect(overlay.getAttribute('role')).toBe('dialog')
    expect(overlay.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByTestId('handoff-continue'))
  })

  it('renders the log with moves, dice and engine notes, and closes it on Escape', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    fireEvent.click(screen.getByTestId('btn-log'))
    const log = screen.getByTestId('log-panel')
    expect(log.textContent).toContain('A takes Warfare')
    expect(log.textContent).toContain('B takes Leadership')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('log-panel')).toBeNull()
    fireEvent.click(screen.getByTestId('btn-log'))
    fireEvent.click(screen.getByTestId('btn-log'))
    expect(screen.queryByTestId('log-panel')).toBeNull()
  })

  it('writes the session to localStorage after every move', () => {
    const { store } = renderWithSession(cardsUsed(toActionPhase()), <BoardScreen />)
    fireEvent.click(screen.getByTestId('btn-pass'))
    const raw = window.localStorage.getItem('md:local')
    expect(raw).not.toBeNull()
    expect(raw).toContain('"seed":7')
    expect(store().session?.state.players[0].passed).toBe(true)
  })
})
