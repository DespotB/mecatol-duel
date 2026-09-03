import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { decideWinner, tokensGained } from './statusPhase'
import { deepFreeze, toActionPhase, toStatusPhase, withPlanetOwner, withPlayer, withTechs, withUnits } from './testUtils'
import type { GameState, Result, StatusParams } from './types'

const value = (r: Result<GameState>): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const submit = (state: GameState, params: StatusParams, seed = 7) => applyMove(deepFreeze(state), { type: 'status', params }, seed)
const plain = (tactic: number, fleet = 3, strategy = 2): StatusParams => ({ tokens: { tactic, fleet, strategy } })

/** Both players through the status phase, speaker first; the new tokens all go into the tactic pool. */
function bothSubmit(state: GameState, seed = 7): GameState {
  const step = (s: GameState): GameState => {
    const seat = s.active
    const tokens = s.players[seat].tokens
    return value(submit(s, { tokens: { ...tokens, tactic: tokens.tactic + tokensGained(s, seat) } }, seed))
  }
  return step(step(state))
}

describe('R3.3 status phase', () => {
  it('R3.3 step 3: two command tokens, three with Hyper Metabolism, distributed but never moved', () => {
    const s = toStatusPhase(toActionPhase())
    expect(s.players[0].tokens).toEqual({ tactic: 3, fleet: 3, strategy: 2 })   // 8 on the sheet, 2 to come
    expect(submit(s, plain(5)).ok).toBe(true)                        // 5 + 3 + 2 = 10, both into the tactic pool
    expect(submit(s, plain(3, 4, 3)).ok).toBe(true)                  // 10, one into each of the other pools
    expect(submit(s, plain(4)).ok).toBe(false)                       // 9, one token unassigned
    expect(submit(s, plain(6)).ok).toBe(false)                       // 11, one token too many
    expect(submit(s, plain(2, 5, 3)).ok).toBe(false)                 // 10, but the tactic pool shrinks
    const hyper = toStatusPhase(withTechs(toActionPhase(), 0, ['hyper_metabolism']))
    expect(submit(hyper, plain(6)).ok).toBe(true)                    // 11, three tokens
    expect(submit(hyper, plain(5)).ok).toBe(false)
  })
  it('R3.3 step 1: fulfilled objectives, the Mandate and Mecatol Rex score, each only once', () => {
    let s = withTechs(toActionPhase(), 0, ['sarween_tools'])
    s = withPlayer(s, 0, { mandateEarnedThisRound: true })
    s = withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0)
    const done = bothSubmit(toStatusPhase(s))
    expect(done.players[0].vp).toBe(3)                               // objective 1, Mandate, Mecatol Rex
    expect(done.players[0].scoredObjectives).toEqual(['own_3_techs'])
    expect(done.players[0].mandateScored).toBe(true)
    expect(done.players[1].vp).toBe(0)
    const second = bothSubmit(toStatusPhase({ ...done, phase: 'action' }))
    expect(second.players[0].vp).toBe(4)                             // only Mecatol Rex again
  })
  it('R3.3 step 2: the next objective is revealed in rounds 1 to 5, none after round 6', () => {
    const done = bothSubmit(toStatusPhase(toActionPhase()))
    expect(done.publicObjectives).toEqual(['own_3_techs', 'control_4_outside_home'])
    expect(done.round).toBe(2)
    const late = bothSubmit(toStatusPhase({ ...toActionPhase(), round: 6, publicObjectives: ['a', 'b', 'c', 'd', 'e', 'f'] }))
    expect(late.publicObjectives).toHaveLength(6)
    expect(late.phase).toBe('ended')
  })
  it('R3.3 step 4/R3.1: planets and cards ready, played cards return at 0, unpicked keep their bonus', () => {
    const base = toActionPhase()
    const dirty = deepFreeze({
      ...base,
      players: [
        {
          ...base.players[0], inheritanceExhausted: true, spentInOneProductionThisRound: 8, tradedThisRound: { west: true, east: true },
          passed: true, mandateEarnedThisRound: true, mandateScored: true, scoredObjectives: ['own_3_techs'], shipyardUsed: true,
        },
        { ...base.players[1], passed: true },
      ] as GameState['players'],
      systems: { ...base.systems, bereg: { ...base.systems.bereg, activatedBy: [0 as const], planets: base.systems.bereg.planets.map(p => ({ ...p, exhausted: true })) } },
    })
    const done = bothSubmit(toStatusPhase(dirty))
    expect(done.systems.bereg.activatedBy).toEqual([])
    expect(done.systems.bereg.planets.every(p => !p.exhausted)).toBe(true)
    expect(done.players[0]).toMatchObject({ inheritanceExhausted: false, spentInOneProductionThisRound: 0, passed: false, mandateEarnedThisRound: false, tradedThisRound: { west: false, east: false } })
    // these are once-per-game (or once-ever) flags, not per-round state: the reset must leave them untouched
    expect(done.players[0]).toMatchObject({ mandateScored: true, scoredObjectives: ['own_3_techs'], shipyardUsed: true })
    expect(done.players.every(p => p.strategyCards.length === 0)).toBe(true)
    // R3.1: warfare, leadership, imperial and technology were played and come back at 0; the two unpicked
    // cards keep the trade good each of them collected at the end of the draft
    expect(done.strategyPool.map(c => c.id)).toEqual(['leadership', 'diplomacy', 'trade', 'warfare', 'technology', 'imperial'])
    expect(done.strategyPool.map(c => c.bonus)).toEqual([0, 1, 1, 0, 0, 0])
    const picked = applyMove(done, { type: 'pickStrategyCard', card: 'diplomacy' }, 0)
    if (!picked.ok) throw new Error(picked.error)
    expect(picked.value.players[1].tradeGoods).toBe(done.players[1].tradeGoods + 1)
  })
  it('R3.3 step 5 / R4.2: a new guardian fleet only while Mecatol Rex is uncontrolled', () => {
    const s = toStatusPhase(toActionPhase())
    expect(bothSubmit(s).guardianRolls).toBe(2)
    const owned = toStatusPhase(withPlanetOwner(toActionPhase(), 'mecatol', 'mecatol-rex', 1))
    const done = bothSubmit(owned)
    expect(done.guardianRolls).toBe(1)
    expect(done.nextUnitId).toBe(owned.nextUnitId)              // no new guardian units were made
  })
  it('R4.2: the guardian reroll is deterministic, same seed gives the same fleet', () => {
    const composition = (state: GameState) =>
      state.systems.mecatol.space.filter(u => u.owner === 'guardian').map(u => u.type).sort()
    const runOnce = () => bothSubmit(toStatusPhase(toActionPhase()), 42)
    const a = runOnce()
    const b = runOnce()
    expect(composition(a)).toEqual(composition(b))
    expect(a.guardianRolls).toBe(b.guardianRolls)
  })
  it('R3.3 step 6 / R7: 7 victory points end the game, round 6 ends it in any case', () => {
    const rich = withPlayer(toActionPhase(), 1, { vp: 7 })
    const done = bothSubmit(toStatusPhase(rich))
    expect(done.phase).toBe('ended')
    expect(done.winner).toBe(1)
    const open = bothSubmit(toStatusPhase(withPlayer(toActionPhase(), 1, { vp: 6 })))
    expect(open.phase).toBe('strategy')
    expect(open.winner).toBeNull()
    const last = bothSubmit(toStatusPhase({ ...withPlayer(toActionPhase(), 0, { vp: 2 }), round: 6 }))
    expect(last.phase).toBe('ended')
    expect(last.winner).toBe(0)
    expect(last.round).toBe(6)
  })
  it('R7: the tie-break chain is Mecatol Rex, then planets, then the speaker\'s opponent', () => {
    const tied = withPlayer(withPlayer(toActionPhase(), 0, { vp: 4 }), 1, { vp: 4 })
    expect(decideWinner(withPlayer(tied, 0, { vp: 5 }))).toBe(0)                        // higher VP first
    expect(decideWinner(withPlanetOwner(tied, 'mecatol', 'mecatol-rex', 1))).toBe(1)    // then Mecatol Rex
    expect(decideWinner(tied)).toBe(1)                                                  // then planets, 1 against 2
    // one planet each side of the map makes it 2 against 2, so only the speaker is left
    const even = withPlanetOwner(tied, 'bereg', 'bereg', 0)
    expect(decideWinner(even)).toBe(1)                                                  // the speaker's opponent
    expect(decideWinner({ ...even, speaker: 1 })).toBe(0)
  })
  it('R7: both players reach 7 VP in the same status phase through real submissions, tie-break decides', () => {
    let s = withPlayer(toActionPhase(), 0, { vp: 6 })
    s = withPlayer(s, 1, { vp: 6, mandateEarnedThisRound: true })
    s = withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0)                // player 0's own scoreAll() call scores this
    const done = bothSubmit(toStatusPhase(s))
    expect(done.players[0].vp).toBe(7)                                // 6 + 1 for Mecatol Rex
    expect(done.players[1].vp).toBe(7)                                // 6 + 1 for the Mandate
    expect(done.phase).toBe('ended')
    expect(done.winner).toBe(0)                                       // tied at 7, decided by the Mecatol Rex controller
  })
  it('R3.1/R3.3 step 6: the speaker changes and the next round starts with a fresh draft', () => {
    const done = bothSubmit(toStatusPhase(toActionPhase()))
    expect(done.speaker).toBe(1)
    expect(done.active).toBe(1)
    expect(done.phase).toBe('strategy')
    expect(done.draft).toEqual([1, 0, 0, 1])
    expect(done.tactical).toBeNull()
    expect(done.pendingSecondary).toBeNull()
  })
  it('R3.3: the phase ends only when both players have submitted, speaker first', () => {
    const s = toStatusPhase(toActionPhase())
    const first = value(submit(s, plain(5, 3, 2)))
    expect(first.phase).toBe('status')
    expect(first.active).toBe(1)
    expect(first.players[0].tokens.tactic).toBe(5)
    const second = value(submit(first, plain(5, 3, 2)))
    expect(second.phase).toBe('strategy')
    expect(submit({ ...toActionPhase(), phase: 'action' }, plain(5)).ok).toBe(false)
  })
  it('R7 objective 3 and 4 are scored from the round they were fulfilled in', () => {
    let s = { ...toActionPhase(), round: 4, publicObjectives: ['own_3_techs', 'control_4_outside_home', 'three_ships_mecatol', 'spend_6_production'] }
    s = withPlayer(s, 0, { spentInOneProductionThisRound: 6 })
    s = withUnits(s, 'mecatol', 0, ['cruiser', 'cruiser', 'destroyer'])
    const done = bothSubmit(toStatusPhase(s))
    expect(done.players[0].scoredObjectives).toEqual(['three_ships_mecatol', 'spend_6_production'])
    expect(done.players[0].spentInOneProductionThisRound).toBe(0)
  })
})
