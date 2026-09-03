// src/engine/board.test.ts
import { describe, expect, it } from 'vitest'
import { freeFighterSlots } from './board'
import { toActionPhase, withUnits } from './testUtils'

describe('freeFighterSlots', () => {
  it('R4.4: a space dock (I or II) grants 3 free fighter slots regardless of technology', () => {
    const base = toActionPhase()
    expect(base.players[0].techs.includes('space_dock_ii')).toBe(false)   // starting techs only, no upgrade
    const withDock = withUnits(base, 'bereg', 0, ['spacedock'], 'bereg')
    expect(freeFighterSlots(withDock, 0, 'bereg')).toBe(3)
  })
  it('R4.4: no dock of the seat\'s own in the system grants no free slots', () => {
    const base = toActionPhase()
    expect(freeFighterSlots(base, 0, 'bereg')).toBe(0)
  })
  it('R4.4: a dock owned by the other seat grants no free slots', () => {
    const base = toActionPhase()
    const withOtherDock = withUnits(base, 'bereg', 1, ['spacedock'], 'bereg')
    expect(freeFighterSlots(withOtherDock, 0, 'bereg')).toBe(0)
  })
})
