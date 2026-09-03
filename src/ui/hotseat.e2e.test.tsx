// src/ui/hotseat.e2e.test.tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

function click(testId: string): void {
  fireEvent.click(screen.getByTestId(testId))
}
function text(testId: string): string {
  return screen.getByTestId(testId).textContent ?? ''
}
/** The hot-seat interstitial appears whenever the seat to act changes; clicking through it is part of playing. */
function handoff(): void {
  const button = screen.queryByTestId('handoff-continue')
  if (button) fireEvent.click(button)
}

describe('a scripted hot-seat game', () => {
  it('R3.1 to R3.3: plays a full first round through the rendered UI', () => {
    window.location.hash = '#/?seed=7'
    render(<App ticking={false} />)

    // setup
    fireEvent.change(screen.getByTestId('seat-name-0'), { target: { value: 'Despot' } })
    fireEvent.change(screen.getByTestId('seat-name-1'), { target: { value: 'Kael' } })
    click('btn-start')
    expect(text('round')).toBe('Round 1 of 6, strategy phase')
    expect(text('clock-0')).toBe('15:00')

    // R3.1 snake draft: speaker, other, other, speaker
    click('strategy-card-leadership')
    handoff()
    click('strategy-card-trade')
    click('strategy-card-technology')
    handoff()
    click('strategy-card-warfare')
    expect(text('round')).toBe('Round 1 of 6, action phase')
    expect(text('strategy-state-leadership')).toBe('Despot, ready')
    expect(text('strategy-state-diplomacy')).toBe('unpicked, 1 trade good on it')
    expect(text('turn-0')).toBe('Your turn')                       // Leadership is initiative 1

    // turn 1: R3.2 tactical action with movement and an invasion
    click('btn-tactical')
    click('tile-bereg')
    expect(text('tokens-0-tactic')).toBe('2')
    fireEvent.click(screen.getByTestId('ship-home-n-carrier-plus'))
    for (let i = 0; i < 3; i++) click('cargo-home-n-fighter-plus')
    click('cargo-home-n-infantry-plus')
    click('btn-move-ships')
    expect(text('stack-bereg-0-fighter')).toBe('3')
    expect(screen.queryByTestId('stack-home-n-0-carrier')).toBeNull()
    click('btn-end-movement')
    expect(text('land-count-bereg')).toBe('1')
    click('btn-land-bereg')
    expect(screen.getByTestId('control-bereg')).toBeTruthy()
    expect(screen.getByTestId('planet-0-bereg')).toBeTruthy()
    click('btn-end-invasion')
    click('btn-end-tactical')
    handoff()
    expect(text('turn-1')).toBe('Your turn')

    // turn 2: R5 Technology primary, the opponent declines the secondary
    click('btn-strategic')
    click('strategic-pick-technology')
    fireEvent.click(screen.getByTestId('tech-card-sarween_tools'))
    click('btn-strategic-confirm')
    handoff()
    expect(screen.getByTestId('secondary-panel')).toBeTruthy()
    click('btn-secondary-decline')
    expect(screen.queryByTestId('secondary-panel')).toBeNull()
    expect(text('tech-1-sarween_tools')).toBe('Sarween Tools')
    expect(text('turn-0')).toBe('Your turn')

    // turn 3: R6 Leadership primary
    click('btn-strategic')
    click('strategic-pick-leadership')
    expect(text('token-tactic')).toBe('5')
    click('btn-strategic-confirm')
    expect(text('tokens-0-tactic')).toBe('5')
    handoff()
    click('btn-secondary-decline')
    expect(text('turn-1')).toBe('Your turn')

    // turn 4: R6 Trade primary; the responder is already replenished, so only declining is offered
    click('btn-strategic')
    click('strategic-pick-trade')
    click('btn-strategic-confirm')
    expect(text('economy-1-tradegoods')).toBe('3')
    handoff()
    expect(screen.getByTestId('btn-secondary-accept').hasAttribute('disabled')).toBe(true)
    click('btn-secondary-decline')
    expect(text('turn-0')).toBe('Your turn')

    // turn 5: R6 Warfare primary, and an accepted secondary that produces one infantry
    click('btn-strategic')
    click('strategic-pick-warfare')
    click('system-pick-bereg')
    click('btn-strategic-confirm')
    expect(text('tokens-0-tactic')).toBe('6')
    handoff()
    expect(text('secondary-units')).toContain('Produce at Arc Prime')
    expect(screen.getByTestId('btn-secondary-accept').hasAttribute('disabled')).toBe(true)   // nothing chosen yet
    click('step-infantry-plus')
    click('step-infantry-plus')
    click('pay-arc-prime')
    click('btn-secondary-accept')
    expect(text('forces-1-infantry')).toBe('5 Infantry I')
    expect(text('tokens-1-strategy')).toBe('1')
    expect(text('turn-1')).toBe('Your turn')

    // turn 6: R3.2 passing is legal once both cards are used
    expect(screen.getByTestId('btn-pass').hasAttribute('disabled')).toBe(false)
    click('btn-pass')
    handoff()
    expect(text('turn-0')).toBe('Your turn')

    // turn 7: R4.4 production at the home space dock
    click('btn-tactical')
    click('tile-home-n')
    click('btn-end-movement')
    click('btn-end-invasion')
    expect(text('produce-limit')).toBe('7')
    click('step-infantry-plus')
    click('step-infantry-plus')
    expect(text('produce-cost')).toBe('1')
    click('pay-000')
    click('btn-produce')
    expect(text('forces-0-infantry')).toBe('7 Infantry I')
    click('btn-end-tactical')

    // turn 8: both have passed, the status phase begins with the speaker
    click('btn-pass')
    expect(text('round')).toBe('Round 1 of 6, status phase')
    expect(screen.getByTestId('status-dialog').textContent).toContain('2 command tokens')
    click('btn-status-confirm')
    handoff()
    expect(screen.getByTestId('status-scoring').textContent).toContain('Own 3 technologies')
    click('btn-status-confirm')

    // R3.3: scoring, the reveal and the next round
    expect(text('vp-1')).toBe('1 of 7')
    expect(text('vp-0')).toBe('0 of 7')
    expect(screen.getByTestId('scored-own_3_techs-1')).toBeTruthy()
    expect(screen.getByTestId('objective-control_4_outside_home')).toBeTruthy()
    expect(text('round')).toBe('Round 2 of 6, strategy phase')
    expect(text('strategy-state-leadership')).toBe('unpicked')
    expect(text('strategy-state-diplomacy')).toBe('unpicked, 1 trade good on it')

    // the log carries the whole round
    click('btn-log')
    const log = screen.getByTestId('log-panel').textContent ?? ''
    expect(log).toContain('Despot activates Bereg')
    expect(log).toContain('Despot lands 1 infantry on Bereg')
    expect(log).toContain('Kael plays Technology')
    expect(log).toContain('Despot declines the Technology secondary')
    expect(log).toContain('Kael uses the Warfare secondary')
    expect(log).toContain('Despot produces 2 infantry')
  })
})
