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
    fireEvent.click(screen.getByTestId('handoff-continue'))
    expect(screen.queryByTestId('handoff')).toBeNull()
  })

  it('renders the log with moves, dice and engine notes', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    fireEvent.click(screen.getByTestId('btn-log'))
    const log = screen.getByTestId('log-panel')
    expect(log.textContent).toContain('A takes Warfare')
    expect(log.textContent).toContain('B takes Leadership')
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
