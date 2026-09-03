// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { cardsUsed, toActionPhase, withTactical } from '../engine/testUtils'
import { gameKey } from './persist'
import { BoardScreen } from './screens/BoardScreen'
import { TEST_CODE, renderWithSession } from './test/harness'

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

  it('R3.2: ends a turn with nothing left in it instead of asking for a dead click', () => {
    // this seat has no free move open once the action is spent, so ending the turn is the only thing
    // left and the device goes over straight away; Tactical.test covers the case where a trade is open
    const done = withTactical(cardsUsed(toActionPhase()), { systemId: 'bereg', step: 'done' })
    renderWithSession(done, <BoardScreen />)
    fireEvent.click(screen.getByTestId('btn-end-tactical'))
    expect(screen.queryByTestId('btn-end-turn')).toBeNull()
    expect(screen.getByTestId('handoff').textContent).toContain('Pass the device to B')
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
    const raw = window.localStorage.getItem(gameKey(TEST_CODE))
    expect(raw).not.toBeNull()
    expect(raw).toContain('"seed":7')
    expect(store().session?.state.players[0].passed).toBe(true)
  })
})
