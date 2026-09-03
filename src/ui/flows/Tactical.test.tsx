// src/ui/flows/Tactical.test.tsx
// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { toActionPhase, withPlayer, withTactical, withUnits } from '../../engine/testUtils'
import { BoardScreen } from '../screens/BoardScreen'
import { renderWithSession } from '../test/harness'

function activate(systemId: string) {
  fireEvent.click(screen.getByTestId('btn-tactical'))
  fireEvent.click(screen.getByTestId(`tile-${systemId}`))
}

describe('the tactical action', () => {
  it('R3.2 step 1: activation spends a tactic token and opens the movement step', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    activate('bereg')
    expect(screen.getByTestId('tokens-0-tactic').textContent).toBe('2')
    expect(screen.getByTestId('tile-bereg').className).toContain('active')
    expect(screen.getByTestId('movement-panel')).toBeTruthy()
  })

  it('R3.2 step 2: moves a carrier with fighters and infantry into the active system', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    activate('bereg')
    fireEvent.click(screen.getByTestId('ship-home-n-carrier-plus'))
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByTestId('cargo-home-n-fighter-plus'))
    fireEvent.click(screen.getByTestId('cargo-home-n-infantry-plus'))
    expect(screen.getByTestId('cargo-home-n-fighter').textContent).toBe('3')
    expect(screen.getByTestId('cargo-home-n-infantry-plus').hasAttribute('disabled')).toBe(true)  // capacity 4 is full
    fireEvent.click(screen.getByTestId('btn-move-ships'))
    expect(screen.getByTestId('stack-bereg-0-carrier')).toBeTruthy()
    expect(screen.getByTestId('stack-bereg-0-fighter').textContent).toBe('3')
    expect(screen.queryByTestId('stack-home-n-0-fighter')).toBeNull()
  })

  it('R3.2 step 2: shows the capacity of the picked ships and what it carries', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    activate('bereg')
    expect(screen.getByTestId('ship-card-home-n-carrier')).toBeTruthy()
    expect(screen.getByTestId('cargo-card-home-n-fighter')).toBeTruthy()
    fireEvent.click(screen.getByTestId('ship-home-n-carrier-plus'))
    expect(screen.getByTestId('capacity-home-n').textContent).toBe('Capacity 4, carrying 0')
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByTestId('cargo-home-n-fighter-plus'))
    expect(screen.getByTestId('capacity-home-n').textContent).toBe('Capacity 4, carrying 3')
  })

  it('R3.2 step 1: marks the systems no ship can reach before the activation', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    fireEvent.click(screen.getByTestId('btn-tactical'))
    expect(screen.getByTestId('noreach-starpoint')).toBeTruthy()   // two systems away
    expect(screen.getByTestId('noreach-quann')).toBeTruthy()
    expect(screen.queryByTestId('noreach-bereg')).toBeNull()
    expect(screen.queryByTestId('noreach-sakulag')).toBeNull()
    expect(screen.getByTestId('tile-starpoint').className).toContain('outofreach')
  })

  it('R3.2 step 2: names the range for a system two steps away', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    activate('starpoint')
    expect(screen.getByTestId('movement-obstacle').textContent).toContain('within range')
  })

  it('R4.3: lands infantry on an empty planet and takes control of it', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    activate('bereg')
    fireEvent.click(screen.getByTestId('ship-home-n-carrier-plus'))
    fireEvent.click(screen.getByTestId('cargo-home-n-infantry-plus'))
    fireEvent.click(screen.getByTestId('btn-move-ships'))
    fireEvent.click(screen.getByTestId('btn-end-movement'))
    expect(screen.getByTestId('invasion-panel')).toBeTruthy()
    expect(screen.getByTestId('land-count-bereg').textContent).toBe('1')
    fireEvent.click(screen.getByTestId('btn-land-bereg'))
    expect(screen.getByTestId('control-bereg')).toBeTruthy()
    expect(screen.getByTestId('planet-0-bereg')).toBeTruthy()
    fireEvent.click(screen.getByTestId('btn-end-invasion'))
    expect(screen.getByTestId('btn-end-tactical')).toBeTruthy()
  })

  it('R4.4: produces at the space dock, pays with a planet and exhausts it', () => {
    renderWithSession(toActionPhase(), <BoardScreen />)
    activate('home-n')
    fireEvent.click(screen.getByTestId('btn-end-movement'))
    fireEvent.click(screen.getByTestId('btn-end-invasion'))
    expect(screen.getByTestId('produce-drawer')).toBeTruthy()
    expect(screen.getByTestId('produce-limit').textContent).toBe('7')
    fireEvent.click(screen.getByTestId('step-infantry-plus'))
    fireEvent.click(screen.getByTestId('step-infantry-plus'))
    expect(screen.getByTestId('step-infantry').textContent).toBe('2')
    expect(screen.getByTestId('produce-cost').textContent).toBe('1')
    expect(screen.getByTestId('btn-produce').hasAttribute('disabled')).toBe(true)   // nothing paid yet
    fireEvent.click(screen.getByTestId('pay-000'))
    fireEvent.click(screen.getByTestId('btn-produce'))
    expect(screen.getByTestId('forces-0-infantry').textContent).toBe('7 Infantry I')
    expect(screen.getByTestId('planet-0-000').className).toContain('exh')
  })

  it('R4.1: the combat dialog fights rounds and offers Munitions Reserves from round 1', () => {
    let s = withUnits(toActionPhase(), 'bereg', 0, ['cruiser'])
    s = withUnits(s, 'bereg', 1, ['cruiser'])
    s = withPlayer(s, 1, { tradeGoods: 2 })
    s = withTactical(s, {
      systemId: 'bereg', step: 'spaceCombat',
      combat: { round: 0, attacker: 0, defender: 1, retreating: null, retreatTo: null, lastRolls: [] },
    })
    renderWithSession(s, <BoardScreen />)
    expect(screen.getByTestId('combat-round').textContent).toBe('Round 0')
    expect(screen.queryByTestId('munitions-defender')).toBeNull()
    fireEvent.click(screen.getByTestId('btn-combat-round'))
    expect(screen.getByTestId('combat-round').textContent).toBe('Round 1')
    expect(screen.getByTestId('munitions-defender')).toBeTruthy()
    expect(screen.queryByTestId('munitions-attacker')).toBeNull()               // L1Z1X has no Munitions Reserves
  })

  it('R4.3: bombardment is offered against a defended planet', () => {
    let s = withUnits(toActionPhase(), 'bereg', 0, ['dreadnought'])
    s = withUnits(s, 'bereg', 1, ['infantry'], 'bereg')
    s = withTactical(s, { systemId: 'bereg', step: 'invasion', invasion: { planetId: null, landed: [], bombarded: [], round: 0 } })
    renderWithSession(s, <BoardScreen />)
    expect(screen.getByTestId('btn-bombard-bereg')).toBeTruthy()
    expect(screen.queryByTestId('btn-land-bereg')).toBeNull()                   // no infantry in space
  })
})
