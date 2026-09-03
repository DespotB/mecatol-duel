import { describe, expect, it } from 'vitest'
import { POST_IDS } from '../data/posts'
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
  it('R3.3 step 3 / R4.4: the status sheet never takes a token out of the fleet pool, so no fleet pays for it', () => {
    // three cruisers in Bereg sit exactly on the pool of 3. The distribution runs through enforceFleetPool
    // like Warfare and the two trade post abilities do, but step 3 only hands out new tokens: it never moves
    // one that is already on the sheet, so the helper has nothing to collect here.
    const s = withUnits(toStatusPhase(toActionPhase()), 'bereg', 0, ['cruiser', 'cruiser', 'cruiser'])
    expect(submit(s, plain(5, 2, 3)).ok).toBe(false)                 // 10, but the fleet pool would shrink
    const done = value(submit(s, plain(3, 4, 3)))
    expect(done.systems.bereg.space.filter(u => u.owner === 0)).toHaveLength(3)
    expect(done.log.some(e => e.t === 'info' && e.text.includes('beyond the fleet pool'))).toBe(false)
  })
  it('R3.3 step 1: fulfilled objectives, the mandates and Mecatol Rex score, each only once', () => {
    // a pool of one keeps the second status phase from revealing something that is already fulfilled
    let s: GameState = {
      ...toActionPhase(), publicObjectives: ['win_space_combat'],
      objectiveOrder: ['win_space_combat'], mecatolCombatWinner: 0,
    }
    s = withPlayer(s, 0, { spaceCombatWins: 1 })
    s = withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0)
    const done = bothSubmit(toStatusPhase(s))
    expect(done.players[0].vp).toBe(3)                               // the objective, First Strike, Mecatol Rex
    expect(done.players[0].scoredObjectives).toEqual(['win_space_combat'])
    expect(done.players[0].scoredMandates).toEqual(['first_strike'])
    expect(done.players[1].vp).toBe(0)
    const second = bothSubmit(toStatusPhase({ ...done, phase: 'action' }))
    expect(second.players[0].vp).toBe(4)                             // only Mecatol Rex again
  })
  it('R3.3 step 2: the next objective off the shuffled pool is revealed, none once it runs out', () => {
    const start = toActionPhase()
    const done = bothSubmit(toStatusPhase(start))
    expect(done.publicObjectives).toEqual([start.objectiveOrder[0], start.objectiveOrder[1]])
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
          ...base.players[0], inheritanceExhausted: true, resourcesSpentThisRound: 8, tradedThisRound: { west: true, east: true },
          passed: true, scoredMandates: ['first_strike'], scoredObjectives: ['win_space_combat'], shipyardUsed: true,
        },
        { ...base.players[1], passed: true },
      ] as GameState['players'],
      systems: { ...base.systems, bereg: { ...base.systems.bereg, activatedBy: [0 as const], planets: base.systems.bereg.planets.map(p => ({ ...p, exhausted: true })) } },
    })
    const done = bothSubmit(toStatusPhase(dirty))
    expect(done.systems.bereg.activatedBy).toEqual([])
    expect(done.systems.bereg.planets.every(p => !p.exhausted)).toBe(true)
    expect(done.players[0]).toMatchObject({ inheritanceExhausted: false, resourcesSpentThisRound: 0, passed: false, tradedThisRound: { west: false, east: false } })
    // these are once-per-game (or once-ever) flags, not per-round state: the reset must leave them untouched
    expect(done.players[0]).toMatchObject({ scoredMandates: ['first_strike'], scoredObjectives: ['win_space_combat'], shipyardUsed: true })
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
    s = { ...withPlayer(s, 1, { vp: 6 }), mecatolCombatWinner: 1 }
    s = withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0)                // player 0's own scoreAll() call scores this
    const done = bothSubmit(toStatusPhase(s))
    expect(done.players[0].vp).toBe(7)                                // 6 + 1 for Mecatol Rex
    expect(done.players[1].vp).toBe(7)                                // 6 + 1 for First Strike
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
  it('R3.3: a seat may not submit twice, and the submissions are tracked in statusSubmitted', () => {
    const s = toStatusPhase(toActionPhase())
    expect(s.statusSubmitted).toEqual([])
    const first = value(submit(s, plain(5, 3, 2)))
    expect(first.statusSubmitted).toEqual([0])
    // the same seat again, whatever the active seat says
    const again = submit({ ...first, active: 0 }, plain(7, 3, 2))
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error).toMatch(/already submitted/)
    const second = value(submit(first, plain(5, 3, 2)))
    expect(second.phase).toBe('strategy')
    expect(second.statusSubmitted).toEqual([])                        // the round advance clears it again
  })
  it('R3.3: a phase entered on the speaker\'s opponent still needs both submissions', () => {
    const s = deepFreeze({ ...toStatusPhase(toActionPhase()), active: 1 as const })
    expect(s.speaker).toBe(0)
    const first = value(submit(s, plain(3, 3, 4)))                    // seat 1 goes first here
    expect(first.phase).toBe('status')                                // not closed after one move
    expect(first.active).toBe(0)
    expect(first.statusSubmitted).toEqual([1])
    const second = value(submit(first, plain(5, 3, 2)))
    expect(second.phase).toBe('strategy')
    expect(second.players[0].tokens.tactic).toBe(5)                   // seat 0's own submission was applied
  })
  it('R8: every round brings two new posts, neither of them one of the round before', () => {
    for (const seed of [1, 2, 3, 5, 8, 13, 21]) {
      const before = toActionPhase(seed)
      const done = bothSubmit(toStatusPhase(before))
      expect(done.round).toBe(2)
      expect(done.posts.west).not.toBe(done.posts.east)
      expect([before.posts.west, before.posts.east]).not.toContain(done.posts.west)
      expect([before.posts.west, before.posts.east]).not.toContain(done.posts.east)
      // the pair is new, so an ability nobody took is simply gone and the fresh pair starts unused
      expect(done.postAbilityUsed).toEqual({ west: false, east: false })
      expect(done.log.filter(e => e.t === 'info' && e.text.startsWith('Trade posts:'))).toHaveLength(2)
      // the roll is seeded, so the same game rolled again brings the same pair in the same round
      expect(bothSubmit(toStatusPhase(before)).posts).toEqual(done.posts)
    }
  })
  it('R8: a used ability does not carry into the next round, even on the same side', () => {
    const before = toActionPhase(3)
    const used = deepFreeze({ ...before, postAbilityUsed: { west: true, east: true } })
    expect(bothSubmit(toStatusPhase(used)).postAbilityUsed).toEqual({ west: false, east: false })
  })
  it('R8: the excluded pair is the previous one, not a fixed two off the top of the list', () => {
    const excluded = new Set<string>()
    const arrived = new Set<string>()
    // the status move carries its own seed in real play (the UI derives it from the move count), so the
    // round-2 roll is varied here the same way; a fixed move seed would draw the same slots every game
    for (let seed = 1; seed <= 30; seed++) {
      const before = toActionPhase(seed)
      const done = bothSubmit(toStatusPhase(before), 500 + seed)
      excluded.add([before.posts.west, before.posts.east].sort().join('/'))
      arrived.add(done.posts.west)
      arrived.add(done.posts.east)
    }
    expect(excluded.size).toBeGreaterThan(1)          // different games sit out different pairs
    expect(arrived.size).toBe(POST_IDS.length)        // and every post still arrives in some game's round 2
  })
  it('R7: the round objective is scored from the round it was fulfilled in, then its counter resets', () => {
    let s = { ...toActionPhase(), round: 4, publicObjectives: ['control_4_outside_home', 'spend_6_resources'] }
    s = withPlayer(s, 0, { resourcesSpentThisRound: 6 })
    const done = bothSubmit(toStatusPhase(s))
    expect(done.players[0].scoredObjectives).toEqual(['spend_6_resources'])
    expect(done.players[0].resourcesSpentThisRound).toBe(0)
  })
})
