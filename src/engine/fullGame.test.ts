import { describe, expect, it } from 'vitest'
import { homeSystemId } from '../data/map'
import { otherSeat } from './actionPhase'
import { capacity } from './economy'
import { applyMove, legalMoves, validateMove } from './index'
import { createGame, unitsOf } from './setup'
import { DUEL_CONFIG, fillTemplate, shuffle, toActionPhase, toStatusPhase, withCards, withPlanetOwner, withPlayer, withTechs } from './testUtils'
import type { GameState, Move, Seat } from './types'

const MAX_MOVES = 3000
const CLOSERS: readonly Move['type'][] = ['pass', 'status', 'endTactical', 'endMovement', 'endInvasion', 'secondary']

function invariants(state: GameState, landed: Map<string, Set<Seat>>): void {
  const units = [...unitsOf(state, 0), ...unitsOf(state, 1), ...unitsOf(state, 'guardian')]
  expect(new Set(units.map(u => u.id)).size).toBe(units.length)
  for (const u of units) expect(u.id).toBeLessThan(state.nextUnitId)
  expect(state.round).toBeLessThanOrEqual(6)
  // the reveal of R3.3 step 2 happens before the victory check, so a finished round may be one ahead
  expect(state.publicObjectives.length).toBeGreaterThanOrEqual(Math.min(state.round, 6))
  expect(state.publicObjectives.length).toBeLessThanOrEqual(6)
  expect(state.phase === 'ended').toBe(state.winner !== null)
  for (const seat of [0, 1] as Seat[]) {
    const p = state.players[seat]
    expect(Math.min(p.vp, p.tradeGoods, p.commodities, p.tokens.tactic, p.tokens.fleet, p.tokens.strategy)).toBeGreaterThanOrEqual(0)
    for (const n of Object.values(p.reinforcements)) expect(n).toBeGreaterThanOrEqual(0)
    expect(p.vp).toBeGreaterThanOrEqual(p.scoredObjectives.length)
    for (const id of p.scoredObjectives) expect(state.publicObjectives).toContain(id)
  }
  for (const sys of Object.values(state.systems)) {
    for (const seat of [0, 1] as Seat[]) {
      // a controlled planet outside your home system still holds your units, or you landed there earlier
      for (const planet of sys.planets) {
        if (planet.owner !== seat || sys.id === homeSystemId(seat)) continue
        const held = planet.ground.some(u => u.owner === seat) || planet.structures.some(u => u.owner === seat)
        expect(held || landed.get(planet.id)?.has(seat) === true).toBe(true)
      }
      if (state.tactical?.step === 'spaceCombat' && state.tactical.systemId === sys.id) continue
      const mine = sys.space.filter(u => u.owner === seat)
      if (!mine.length) continue
      const stats = { faction: state.players[seat].faction, techs: state.players[seat].techs }
      const loose = state.players[seat].techs.includes('fighter_ii') ? 0 : mine.filter(u => u.type === 'fighter').length
      expect(mine.filter(u => u.type === 'infantry').length + loose).toBeLessThanOrEqual(capacity(sys.space, seat, stats))
    }
  }
}

/** Plays one complete game with seeded random legal moves and checks the invariants after every move. */
function playGame(seed: number): { state: GameState; moves: number; attempts: number; rejected: number } {
  let bits = (seed * 2654435761) >>> 0
  const rng = () => { bits = (Math.imul(bits, 1664525) + 1013904223) >>> 0; return bits / 4294967296 }
  let state = createGame(DUEL_CONFIG, seed)
  const landed = new Map<string, Set<Seat>>()
  let moves = 0
  let attempts = 0
  let rejected = 0
  while (state.phase !== 'ended' && moves < MAX_MOVES) {
    const options = legalMoves(state)
    expect(options.length).toBeGreaterThan(0)
    // after half the budget the driver prefers the moves that close a turn, so every game terminates
    const closer = moves > MAX_MOVES / 2 ? options.find(m => CLOSERS.includes(m.type)) : undefined
    const order = closer ? [closer, ...shuffle(options, rng)] : shuffle(options, rng)
    let next: GameState | null = null
    for (const option of order) {
      const move = fillTemplate(state, option, rng)
      attempts++
      const r = applyMove(state, move, 1000 + moves)
      if (!r.ok) {
        if (r.internal) throw new Error(`internal error on ${move.type}: ${r.error}`)   // a bug, not an illegal move
        rejected++
        continue
      }
      if (move.type === 'land') {
        const seat = state.active
        const set = landed.get(move.planetId) ?? new Set<Seat>()
        set.add(seat)
        landed.set(move.planetId, set)
      }
      next = r.value
      break
    }
    expect(next).not.toBeNull()
    if (!next) break
    state = next
    moves++
    invariants(state, landed)
  }
  return { state, moves, attempts, rejected }
}

describe('legal moves in every phase', () => {
  it('R3.2: the action phase offers activations, strategy cards, component actions and passing', () => {
    let s = withCards(withCards(toActionPhase(), 1, []), 0, ['technology', 'imperial'])
    s = withTechs(s, 0, ['inheritance_systems'])
    s = withPlanetOwner(s, 'bereg', 'bereg', 0)
    const moves = legalMoves(s)
    expect(moves.filter(m => m.type === 'startTactical')).toHaveLength(7)
    expect(moves.some(m => m.type === 'strategic' && m.card === 'technology')).toBe(true)
    expect(moves.some(m => m.type === 'strategic' && m.card === 'imperial')).toBe(true)
    expect(moves.some(m => m.type === 'research')).toBe(true)
    expect(moves.some(m => m.type === 'tradePost' && m.post === 'east')).toBe(true)
    expect(moves.some(m => m.type === 'pass')).toBe(false)          // two unused cards
    for (const move of moves) expect(applyMove(s, move, 5).ok).toBe(true)
  })
  it('R3.2: the secondary window offers exactly the two answers, even after passing', () => {
    const base = withCards(withCards(toActionPhase(), 0, ['trade']), 1, [])
    const played = applyMove(base, { type: 'strategic', card: 'trade' }, 0)
    if (!played.ok) throw new Error(played.error)
    const moves = legalMoves(played.value)
    expect(moves).toHaveLength(2)
    expect(moves.every(m => m.type === 'secondary')).toBe(true)
    expect(legalMoves(withPlayer(played.value, 1, { passed: true }))).toHaveLength(2)
    for (const move of moves) expect(applyMove(played.value, move, 5).ok).toBe(true)
    expect(validateMove(played.value, { type: 'pass' }).ok).toBe(false)
  })
  it('R3.3: the status phase offers one status template per player', () => {
    const s = toStatusPhase(toActionPhase())
    const moves = legalMoves(s)
    expect(moves).toEqual([{ type: 'status', params: { tokens: { tactic: 5, fleet: 3, strategy: 2 } } }])
    expect(applyMove(s, moves[0], 5).ok).toBe(true)
    expect(validateMove(s, { type: 'status', params: { tokens: { tactic: 3, fleet: 4, strategy: 3 } } }).ok).toBe(true)
  })
  it('validateMove matches structurally, not by JSON', () => {
    const s = withCards(toActionPhase(), 0, ['technology'])
    expect(validateMove(s, { type: 'strategic', card: 'technology', params: { techId: 'sarween_tools', planets: [] } }).ok).toBe(true)
    expect(validateMove(s, { type: 'strategic', card: 'imperial' }).ok).toBe(false)
    expect(validateMove(s, { type: 'startTactical', systemId: 'bereg' }).ok).toBe(true)
    expect(validateMove(s, { type: 'startTactical', systemId: 'nowhere' }).ok).toBe(false)
    expect(validateMove(s, { type: 'tradePost', post: 'west', commodities: 1 }).ok).toBe(false)
    expect(validateMove({ ...s, phase: 'ended', winner: 0 }, { type: 'pass' }).ok).toBe(false)
  })
})

describe('R3.1 to R3.3 full game', () => {
  it('plays ten seeded games to the end and keeps every invariant', () => {
    let byPoints = 0
    let byRound6 = 0
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]) {
      const { state, moves, attempts, rejected } = playGame(seed)
      expect(state.phase).toBe('ended')
      expect(moves).toBeLessThan(MAX_MOVES)
      expect(state.round).toBeLessThanOrEqual(6)
      expect(rejected).toBeLessThanOrEqual(Math.ceil(attempts * 0.05))
      expect(state.log.filter(e => e.t === 'move').length).toBe(moves)
      const winner = state.winner
      expect(winner).not.toBeNull()
      if (winner === null) continue
      // R7: a game ends either because someone reached 7 VP or because the round 6 status phase decided it
      if (state.players[winner].vp >= 7) byPoints++
      else {
        expect(state.round).toBe(6)
        expect(state.players[winner].vp).toBeGreaterThanOrEqual(state.players[otherSeat(winner)].vp)
        byRound6++
      }
    }
    expect(byPoints + byRound6).toBe(10)
  })
})
