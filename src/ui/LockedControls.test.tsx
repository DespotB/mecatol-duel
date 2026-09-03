// src/ui/LockedControls.test.tsx
// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createGame } from '../engine'
import {
  DUEL_CONFIG, cardsUsed, toActionPhase, toStatusPhase, withCards, withPlanetOwner, withPlayer,
  withTactical, withUnits,
} from '../engine/testUtils'
import { ComponentPanel } from './flows/ComponentPanel'
import { StrategicDialog } from './flows/StrategicDialog'
import { BoardScreen } from './screens/BoardScreen'
import { renderWithSession } from './test/harness'
import type { ReactNode } from 'react'
import type { GameState, Seat } from '../engine/types'

function disabled(testId: string): boolean {
  return screen.getByTestId(testId).hasAttribute('disabled')
}

function other(seat: Seat): Seat {
  return seat === 0 ? 1 : 0
}

/**
 * The same screen twice: once for a browser that holds both seats, once for a browser that holds only the
 * seat which is not to act. Every control the check names has to work in the first and be dead in the
 * second, which is the whole point: the lock is the claim, never the state of the game.
 */
function bothWays(state: GameState, node: ReactNode, check: (locked: boolean) => void): void {
  const hotseat = renderWithSession(state, node, { seats: [0, 1] })
  check(false)
  hotseat.unmount()
  renderWithSession(state, node, { seats: [other(state.active)] })
  check(true)
}

describe('the controls of a seat this browser does not hold', () => {
  it('leaves the action bar with nothing to submit', () => {
    // both strategy cards spent, so passing is the legal move here
    bothWays(cardsUsed(toActionPhase()), <BoardScreen />, locked => {
      expect(disabled('btn-tactical')).toBe(locked)
      expect(disabled('btn-pass')).toBe(locked)
      // the log and the menu are not moves, so they stay open to anyone watching
      expect(disabled('btn-log')).toBe(false)
      expect(disabled('btn-menu')).toBe(false)
    })
  })

  it('leaves the strategic action of a ready card unreachable', () => {
    bothWays(toActionPhase(), <BoardScreen />, locked => {
      expect(disabled('btn-strategic')).toBe(locked)
      fireEvent.click(screen.getByTestId('btn-strategic'))
      expect(screen.queryByTestId('strategic-picker') === null).toBe(locked)
    })
  })

  it('says whose turn it is in one line, not in a modal', () => {
    renderWithSession(cardsUsed(toActionPhase()), <BoardScreen />, { seats: [1] })
    expect(screen.getByTestId('turn-line').textContent).toBe('A is to act. You play B.')
    expect(screen.queryByTestId('hint')).toBeNull()
    expect(screen.queryByTestId('handoff')).toBeNull()
  })

  it('keeps undo out of an online game altogether', () => {
    renderWithSession(toActionPhase(), <BoardScreen />, { seats: [0] })
    fireEvent.click(screen.getByTestId('btn-tactical'))
    fireEvent.click(screen.getByTestId('tile-bereg'))
    expect(screen.getByTestId('movement-panel')).toBeTruthy()
    expect(disabled('btn-undo')).toBe(true)
  })

  it('offers the strategy draft only to the seat that is drafting', () => {
    bothWays(createGame(DUEL_CONFIG, 1), <BoardScreen />, locked => {
      expect(disabled('strategy-card-leadership')).toBe(locked)
      expect(screen.queryByTestId('pick-prompt') === null).toBe(locked)
    })
  })

  it('keeps the board from being activated for the other seat', () => {
    renderWithSession(toActionPhase(), <BoardScreen />, { seats: [1] })
    expect(disabled('btn-tactical')).toBe(true)
    expect(document.querySelectorAll('.tile.selectable')).toHaveLength(0)
  })

  it('locks the movement panel', () => {
    const moving = withTactical(toActionPhase(), { systemId: 'bereg', step: 'movement' })
    bothWays(moving, <BoardScreen />, locked => {
      fireEvent.click(screen.getByTestId('ship-home-n-carrier-plus'))
      expect(disabled('btn-move-ships')).toBe(locked)
      expect(disabled('btn-end-movement')).toBe(locked)
    })
  })

  it('locks the combat dialog, its retreats and its munitions', () => {
    let s = withUnits(toActionPhase(), 'bereg', 0, ['cruiser'])
    s = withUnits(s, 'bereg', 1, ['cruiser'])
    s = withPlayer(s, 1, { tradeGoods: 2 })   // R4.1 step 6: Munitions Reserves cost a trade good
    // R4.1 step 5: a retreat can only be announced from round 2 on, and only by the attacker
    s = withTactical(s, {
      systemId: 'bereg', step: 'spaceCombat',
      combat: { round: 2, attacker: 0, defender: 1, retreating: null, retreatTo: null, lastRolls: [], pending: [] },
    })
    bothWays(s, <BoardScreen />, locked => {
      expect(disabled('btn-combat-round')).toBe(locked)
      expect(disabled('btn-retreat-home-n')).toBe(locked)
      expect(disabled('munitions-defender')).toBe(locked)
    })
  })

  it('locks the landing and the end of an invasion', () => {
    // Bereg has two planets, so two infantry make the panel propose one landing on each
    let s = withUnits(toActionPhase(), 'bereg', 0, ['carrier', 'infantry', 'infantry'])
    s = withTactical(s, { systemId: 'bereg', step: 'invasion', invasion: { planetId: null, landed: [], bombarded: [], round: 0 } })
    bothWays(s, <BoardScreen />, locked => {
      expect(disabled('btn-land-bereg')).toBe(locked)
      expect(disabled('btn-land-lirta-iv')).toBe(locked)
      expect(disabled('btn-end-invasion')).toBe(locked)
    })
  })

  it('locks the bombardment of a defended planet', () => {
    let s = withUnits(toActionPhase(), 'bereg', 0, ['dreadnought'])
    s = withUnits(s, 'bereg', 1, ['infantry'], 'bereg')
    s = withTactical(s, { systemId: 'bereg', step: 'invasion', invasion: { planetId: null, landed: [], bombarded: [], round: 0 } })
    bothWays(s, <BoardScreen />, locked => {
      expect(disabled('btn-bombard-bereg')).toBe(locked)
    })
  })

  it('locks the produce drawer, paid for and all', () => {
    const producing = withTactical(toActionPhase(), { systemId: 'home-n', step: 'production' })
    bothWays(producing, <BoardScreen />, locked => {
      fireEvent.click(screen.getByTestId('step-infantry-plus'))
      fireEvent.click(screen.getByTestId('pay-000'))
      expect(disabled('btn-produce')).toBe(locked)
      expect(disabled('btn-end-tactical')).toBe(locked)
    })
  })

  it('locks the slim bar that closes a tactical action with nothing to produce', () => {
    const done = withTactical(cardsUsed(toActionPhase()), { systemId: 'bereg', step: 'done' })
    bothWays(done, <BoardScreen />, locked => {
      expect(disabled('btn-end-tactical')).toBe(locked)
    })
  })

  it('locks the strategic dialog', () => {
    const s = withCards(withCards(toActionPhase(), 0, ['leadership']), 1, [])
    bothWays(s, <StrategicDialog card="leadership" onClose={() => undefined} />, locked => {
      for (let i = 0; i < 3; i++) fireEvent.click(screen.getByTestId('token-tactic-plus'))
      expect(disabled('btn-strategic-confirm')).toBe(locked)
    })
  })

  it('locks the secondary window of the seat that has to answer it', () => {
    const s = { ...cardsUsed(toActionPhase()), pendingSecondary: 'imperial' as const, active: 1 as Seat }
    bothWays(s, <BoardScreen />, locked => {
      // declining is always on offer, so it alone shows the lock; accepting has its own reasons to be dead
      expect(disabled('btn-secondary-decline')).toBe(locked)
      if (locked) expect(disabled('btn-secondary-accept')).toBe(true)
    })
  })

  it('locks the status dialog', () => {
    bothWays(toStatusPhase(toActionPhase()), <BoardScreen />, locked => {
      fireEvent.click(screen.getByTestId('token-tactic-plus'))
      fireEvent.click(screen.getByTestId('token-fleet-plus'))
      expect(disabled('btn-status-confirm')).toBe(locked)
    })
  })

  it('locks the component panel and its trade post', () => {
    const s = withPlanetOwner(cardsUsed(toActionPhase()), 'bereg', 'bereg', 0)
    bothWays(s, <ComponentPanel onClose={() => undefined} />, locked => {
      expect(disabled('btn-tradepost-east')).toBe(locked)
    })
  })

})

describe('a watcher', () => {
  it('sees the whole board, the log and both clocks, and submits nothing', () => {
    renderWithSession(cardsUsed(toActionPhase()), <BoardScreen />, { seats: [] })
    expect(screen.getByTestId('board-screen')).toBeTruthy()
    expect(screen.getByTestId('clock-0').textContent).toBe('15:00')
    expect(screen.getByTestId('clock-1').textContent).toBe('15:00')
    expect(screen.getByTestId('player-0')).toBeTruthy()
    expect(screen.getByTestId('player-1')).toBeTruthy()
    expect(screen.getByTestId('tile-bereg')).toBeTruthy()
    expect(disabled('btn-tactical')).toBe(true)
    expect(disabled('btn-strategic')).toBe(true)
    expect(disabled('btn-component')).toBe(true)
    expect(disabled('btn-pass')).toBe(true)
    expect(disabled('btn-undo')).toBe(true)
    expect(screen.getByTestId('turn-line').textContent).toBe('Watching. It is A\'s turn.')
    fireEvent.click(screen.getByTestId('btn-log'))
    expect(screen.getByTestId('log-panel').textContent).toContain('A takes Warfare')
  })

  it('is not offered a turn it can never take', () => {
    renderWithSession(toStatusPhase(toActionPhase()), <BoardScreen />, { seats: [] })
    fireEvent.click(screen.getByTestId('token-tactic-plus'))
    fireEvent.click(screen.getByTestId('token-fleet-plus'))
    expect(disabled('btn-status-confirm')).toBe(true)
  })
})
