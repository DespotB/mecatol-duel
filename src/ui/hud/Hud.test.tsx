// src/ui/hud/Hud.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { cardsUsed, toActionPhase, withPlayer } from '../../engine/testUtils'
import { renderWithSession } from '../test/harness'
import { BoardScreen } from '../screens/BoardScreen'

describe('the HUD', () => {
  it('shows both players with their faction, clock and turn state', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    expect(screen.getByTestId('player-0').textContent).toContain('L1Z1X Mindnet')
    expect(screen.getByTestId('player-1').textContent).toContain('Barony of Letnev')
    expect(screen.getByTestId('clock-0').textContent).toBe('15:00')
    expect(screen.getByTestId('turn-0').textContent).toBe('Your turn')
    expect(screen.getByTestId('turn-1').textContent).toBe('Waiting')
    expect(screen.getByTestId('speaker-0')).toBeTruthy()
    expect(screen.queryByTestId('speaker-1')).toBeNull()
  })

  it('R3.1: the strategy strip shows who holds each card and what it is worth', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    expect(screen.getByTestId('strategy-state-warfare').textContent).toBe('A, ready')
    expect(screen.getByTestId('strategy-state-leadership').textContent).toBe('B, ready')
    expect(screen.getByTestId('strategy-state-trade').textContent).toBe('+1 trade good')
    expect(screen.getByTestId('strategy-card-technology').className).toContain('own-0')
  })

  it('R7: the objectives strip lists the revealed objectives and the Mandate', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    expect(screen.getByTestId('objective-own_3_techs').textContent).toContain('Own 3 technologies')
    expect(screen.queryByTestId('objective-control_5_planets')).toBeNull()
    expect(screen.getByTestId('mandate').textContent).toContain('First Strike')
  })

  it('shows victory points, command tokens, planets, economy, technologies and forces', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    expect(screen.getByTestId('vp-0').textContent).toBe('0 of 7')
    expect(screen.getByTestId('tokens-0-tactic').textContent).toBe('3')
    expect(screen.getByTestId('tokens-0-fleet').textContent).toBe('3')
    expect(screen.getByTestId('tokens-0-strategy').textContent).toBe('2')
    expect(screen.getByTestId('planet-0-000').textContent).toContain('[0.0.0]')
    expect(screen.getByTestId('economy-0-resources').textContent).toBe('5')
    expect(screen.getByTestId('economy-0-influence').textContent).toBe('0')
    expect(screen.getByTestId('economy-0-commodities').textContent).toBe('2 of 2')
    expect(screen.getByTestId('tech-0-neural_motivator').textContent).toBe('Neural Motivator')
    expect(screen.getByTestId('forces-0-dreadnought').textContent).toBe('1 Super-Dreadnought I')
    expect(screen.getByTestId('forces-0-infantry').textContent).toBe('5 Infantry I')
    expect(screen.getByTestId('forces-1-destroyer').textContent).toBe('1 Destroyer I')
  })

  it('R3.2: the action bar enables exactly the actions the engine offers', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    expect(screen.getByTestId('btn-tactical').hasAttribute('disabled')).toBe(false)
    expect(screen.getByTestId('btn-strategic').hasAttribute('disabled')).toBe(false)
    expect(screen.getByTestId('btn-component').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('btn-pass').hasAttribute('disabled')).toBe(true)   // two unused cards
    expect(screen.getByTestId('btn-undo').hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByTestId('btn-tactical'))
    expect(screen.getByTestId('hint').textContent).toBe('Tactical action. Choose a system to activate.')
  })

  it('R3.2: a player without a tactic token cannot start a tactical action', () => {
    const broke = withPlayer(toActionPhase(), 0, { tokens: { tactic: 0, fleet: 3, strategy: 2 } })
    renderWithSession(broke, <BoardScreen />)
    expect(screen.getByTestId('btn-tactical').hasAttribute('disabled')).toBe(true)
  })

  it('shows an engine rejection in the hint area and clears it on the next accepted move', () => {
    const { store } = renderWithSession(cardsUsed(toActionPhase()), <BoardScreen />)
    expect(screen.queryByTestId('engine-error')).toBeNull()
    act(() => { store().apply({ type: 'endTactical' }) })
    expect(screen.getByTestId('engine-error').textContent).toBe('no tactical action is running')
    expect(screen.queryByTestId('hint')).toBeNull()
    fireEvent.click(screen.getByTestId('btn-pass'))
    expect(screen.queryByTestId('engine-error')).toBeNull()
    expect(screen.getByTestId('hint')).toBeTruthy()
  })
})
