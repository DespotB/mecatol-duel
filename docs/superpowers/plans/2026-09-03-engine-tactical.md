# Engine Tactical Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the tactical action of the action phase in the existing `applyMove` dispatcher: turn structure and activation, movement with anomalies and wormholes, space combat with the pre-combat steps and retreat, invasion with bombardment, landing and ground combat, and production. Extend `legalMoves` so the whole tactical action can be driven from the enumerator alone, and prove it with a seeded 200-move smoke test.

**Architecture:** Everything stays pure: functions from state to state, no I/O, no React. This plan adds `src/engine/actionPhase.ts`, `board.ts`, `movement.ts`, `combat.ts`, `invasion.ts`, `production.ts` and rewrites `src/engine/legalMoves.ts`. The existing exports of plan 1 (`types.ts`, `data/units.ts`, `rng.ts`, `data/map.ts`, `adjacency.ts`, `data/techs.ts`, `research.ts`, `data/factions.ts`, `data/objectives.ts`, `setup.ts`, `economy.ts`, `strategyPhase.ts`, `index.ts`) are reused unchanged and with the signatures they have after the fix wave (`unitStats` returns `Readonly<UnitStats>`, `SHIP_TYPES` and `NON_FIGHTER_SHIPS` are `readonly UnitType[]`, `nonFighterShips(units, owner)` and `capacity(units, owner, stats)` filter by unit owner, `applyMove` turns thrown errors into `{ ok: false }`, `data/map.ts` exports `MECATOL_ID`); new move kinds are added as cases to the `applyMove` switch and as branches in `legalMoves`. The only type change in this plan is one new field on `CombatState`, `retreatTo`, added in task 2, step 1 together with the matching line in `docs/spec/engine-design.md`; nothing else in `types.ts` is redefined.

**Tech Stack:** TypeScript 5 (strict), Vite 7 scaffold, Vitest 3, no runtime dependencies in the engine.

**Spec:** `docs/spec/game-rules.md` (rules v0.2, sections referenced below as R1..R8) and `docs/spec/engine-design.md` (state and move types, module layout). This plan covers R3.2 (tactical action), R4.1, R4.2 (guardian behaviour in combat), R4.3 and R4.4.

## Global Constraints

- Node 24, npm 11; run tests with `npm test` (Vitest, `vitest run`).
- `tsconfig.app.json` is strict; no `any`, no non-null assertions in engine code.
- Engine and data modules must not import React, DOM APIs or Node APIs.
- All code, comments, commit messages and docs in English.
- Never mutate a `GameState` passed into a function; return new objects.
- Dice are ten-sided: `1 + Math.floor(rng() * 10)`; all randomness comes from the seed passed to `applyMove` or `createGame`. Inside a move, every separate roll uses its own generator `mulberry32(deriveSeed(seed, salt))` with a distinct salt, so a move with several rolls stays deterministic.
- **Every dice roll is logged as a `roll` entry** (`{ t: 'roll'; owner; rolls: DieRoll[]; context }`), one entry per rolling side and step.
- **Combat and invasion never leave a unit with `owner` of a seat that has no units in the system and no planet there:** carried fighters and infantry in space are trimmed to the remaining capacity when a space combat ends and after an announced retreat has been carried out (never after an individual round, where losses may temporarily leave cargo unsupported).
- Every test that applies a move to a fixture freezes its input with `deepFreeze` from `src/engine/testUtils.ts`; an accidental mutation then throws, and `applyMove`'s try/catch turns it into a failed move, which fails the test.
- Test names cite the spec section they cover, e.g. `'R4.1 step 2: anti-fighter barrage only destroys fighters'`.
- Commit after every task with a conventional message (`feat:`, `test:`, `chore:`).

---

### Task 1: Action-phase turn structure and activation

**Files:**
- Create: `src/engine/actionPhase.ts`
- Modify: `src/engine/index.ts` (dispatcher cases `startTactical`, `pass`, `endTactical`)
- Modify: `src/engine/legalMoves.ts` (action-phase branch)
- Test: `src/engine/actionPhase.test.ts`

**Interfaces:**
- Produces in `actionPhase.ts`:
  ```ts
  export function otherSeat(seat: Seat): Seat
  export function canPass(state: GameState, seat: Seat): boolean            // R3.2: no unused strategy card left
  export function passTurn(state: GameState): GameState                     // active switches unless the other seat has passed
  export function activatableSystems(state: GameState, seat: Seat): string[]
  export function startTactical(state: GameState, systemId: string): Result<GameState>
  export function pass(state: GameState): Result<GameState>
  export function endTactical(state: GameState): Result<GameState>
  ```
  `startTactical` spends one tactic token, appends the seat to `system.activatedBy` and sets `state.tactical = { systemId, step: 'movement' }`. `pass` sets `passed`, and when both players have passed sets `phase: 'status'` and `active = speaker`. `endTactical` is legal from step `'production'` (skipping production) and step `'done'`; it clears `state.tactical` and passes the turn.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/actionPhase.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove, legalMoves } from './index'
import { createGame } from './setup'
import { deepFreeze } from './testUtils'
import type { GameConfig, GameState, Seat, StrategyCardId } from './types'

const config: GameConfig = { players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }], speaker: 0 }

function play(state: GameState, card: StrategyCardId): GameState {
  const r = applyMove(state, { type: 'pickStrategyCard', card }, 0)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

/** Runs the whole snake draft so the state is in the action phase. */
function toActionPhase(seed = 1): GameState {
  let s = createGame(config, seed)
  for (const card of ['warfare', 'leadership', 'imperial', 'technology'] as StrategyCardId[]) s = play(s, card)
  return s
}

/** Marks every strategy card as used, so passing is legal (strategic actions arrive in plan 3). */
function cardsUsed(state: GameState): GameState {
  return { ...state, players: state.players.map(p => ({ ...p, strategyCards: p.strategyCards.map(c => ({ ...c, used: true })) })) as GameState['players'] }
}

describe('R3.2 action phase', () => {
  it('activation spends a tactic token, marks the system and opens the movement step', () => {
    const s = deepFreeze({ ...toActionPhase(), active: 0 as Seat })   // a mutated input would throw and fail the move
    const r = applyMove(s, { type: 'startTactical', systemId: 'bereg' }, 0)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.players[0].tokens.tactic).toBe(2)
    expect(r.value.systems.bereg.activatedBy).toEqual([0])
    expect(r.value.tactical).toEqual({ systemId: 'bereg', step: 'movement' })
    expect(s.players[0].tokens.tactic).toBe(3)   // input not mutated
  })
  it('a system that already contains your own command token cannot be activated', () => {
    const base = { ...toActionPhase(), active: 0 as Seat }
    const s = { ...base, systems: { ...base.systems, bereg: { ...base.systems.bereg, activatedBy: [0 as Seat] } } }
    expect(applyMove(s, { type: 'startTactical', systemId: 'bereg' }, 0).ok).toBe(false)
    expect(applyMove(s, { type: 'startTactical', systemId: 'quann' }, 0).ok).toBe(true)
  })
  it('activation needs a tactic token and no running tactical action', () => {
    const base = { ...toActionPhase(), active: 0 as Seat }
    const broke = { ...base, players: [{ ...base.players[0], tokens: { tactic: 0, fleet: 3, strategy: 2 } }, base.players[1]] as GameState['players'] }
    expect(applyMove(broke, { type: 'startTactical', systemId: 'bereg' }, 0).ok).toBe(false)
    const running = { ...base, tactical: { systemId: 'bereg', step: 'movement' as const } }
    expect(applyMove(running, { type: 'startTactical', systemId: 'quann' }, 0).ok).toBe(false)
  })
  it('a player may not pass while holding an unused strategy card', () => {
    const s = { ...toActionPhase(), active: 0 as Seat }
    expect(applyMove(s, { type: 'pass' }, 0).ok).toBe(false)
    expect(applyMove(cardsUsed(s), { type: 'pass' }, 0).ok).toBe(true)
  })
  it('after one pass the other player continues; when both have passed the status phase begins', () => {
    const s = cardsUsed({ ...toActionPhase(), active: 0 as Seat })
    const first = applyMove(s, { type: 'pass' }, 0)
    if (!first.ok) throw new Error(first.error)
    expect(first.value.players[0].passed).toBe(true)
    expect(first.value.active).toBe(1)
    expect(first.value.phase).toBe('action')
    expect(applyMove(first.value, { type: 'pass' }, 0).ok).toBe(true)
    const second = applyMove(first.value, { type: 'pass' }, 0)
    if (!second.ok) throw new Error(second.error)
    expect(second.value.phase).toBe('status')
    expect(second.value.active).toBe(second.value.speaker)
  })
  it('turn alternation: after a finished tactical action the other seat is active, unless it has passed', () => {
    const base = { ...toActionPhase(), active: 0 as Seat }
    const done: GameState = { ...base, tactical: { systemId: 'bereg', step: 'done' } }
    const r = applyMove(done, { type: 'endTactical' }, 0)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.tactical).toBeNull()
    expect(r.value.active).toBe(1)
    const alone: GameState = { ...done, players: [done.players[0], { ...done.players[1], passed: true }] }
    const r2 = applyMove(alone, { type: 'endTactical' }, 0)
    if (!r2.ok) throw new Error(r2.error)
    expect(r2.value.active).toBe(0)
  })
  it('endTactical is rejected while the tactical action is unfinished and allowed from the production step', () => {
    const base = { ...toActionPhase(), active: 0 as Seat }
    expect(applyMove({ ...base, tactical: { systemId: 'bereg', step: 'movement' } }, { type: 'endTactical' }, 0).ok).toBe(false)
    expect(applyMove({ ...base, tactical: { systemId: 'bereg', step: 'production' } }, { type: 'endTactical' }, 0).ok).toBe(true)
    expect(applyMove(base, { type: 'endTactical' }, 0).ok).toBe(false)
  })
  it('legal moves without a running tactical action are the activations plus pass', () => {
    const s = { ...toActionPhase(), active: 0 as Seat }
    expect(legalMoves(s).filter(m => m.type === 'startTactical')).toHaveLength(7)
    expect(legalMoves(s).some(m => m.type === 'pass')).toBe(false)
    expect(legalMoves(cardsUsed(s)).some(m => m.type === 'pass')).toBe(true)
    const passed = { ...s, players: [{ ...s.players[0], passed: true }, s.players[1]] as GameState['players'] }
    expect(legalMoves(passed)).toEqual([])
    expect(legalMoves({ ...s, tactical: { systemId: 'bereg', step: 'done' } })).toEqual([{ type: 'endTactical' }])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/engine/actionPhase.test.ts`
Expected: FAIL, `Cannot find module './actionPhase'`.

- [ ] **Step 3: Implement the action-phase turn structure**

```ts
// src/engine/actionPhase.ts
import { SYSTEM_IDS } from '../data/map'
import type { GameState, Result, Seat } from './types'

export function otherSeat(seat: Seat): Seat {
  return seat === 0 ? 1 : 0
}

/** R3.2: a player may not pass while they still hold an unused strategy card. */
export function canPass(state: GameState, seat: Seat): boolean {
  return state.players[seat].strategyCards.every(c => c.used)
}

/** The turn goes to the other seat unless that seat has already passed. */
export function passTurn(state: GameState): GameState {
  const other = otherSeat(state.active)
  return state.players[other].passed ? state : { ...state, active: other }
}

export function activatableSystems(state: GameState, seat: Seat): string[] {
  if (state.players[seat].tokens.tactic < 1) return []
  return SYSTEM_IDS.filter(id => !state.systems[id].activatedBy.includes(seat))
}

export function startTactical(state: GameState, systemId: string): Result<GameState> {
  if (state.phase !== 'action') return { ok: false, error: 'not in the action phase' }
  if (state.tactical) return { ok: false, error: 'a tactical action is already running' }
  const seat = state.active
  const player = state.players[seat]
  if (player.passed) return { ok: false, error: 'this player has passed' }
  const sys = state.systems[systemId]
  if (!sys) return { ok: false, error: `unknown system ${systemId}` }
  if (player.tokens.tactic < 1) return { ok: false, error: 'no tactic token left' }
  if (sys.activatedBy.includes(seat)) return { ok: false, error: `R3.2: ${systemId} already contains your command token` }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, tokens: { ...player.tokens, tactic: player.tokens.tactic - 1 } }
  return {
    ok: true,
    value: {
      ...state,
      players,
      systems: { ...state.systems, [systemId]: { ...sys, activatedBy: [...sys.activatedBy, seat] } },
      tactical: { systemId, step: 'movement' },
    },
  }
}

export function pass(state: GameState): Result<GameState> {
  if (state.phase !== 'action') return { ok: false, error: 'not in the action phase' }
  if (state.tactical) return { ok: false, error: 'finish the tactical action first' }
  const seat = state.active
  if (state.players[seat].passed) return { ok: false, error: 'this player has already passed' }
  if (!canPass(state, seat)) return { ok: false, error: 'R3.2: cannot pass while holding an unused strategy card' }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], passed: true }
  const other = otherSeat(seat)
  if (players[other].passed) return { ok: true, value: { ...state, players, phase: 'status', active: state.speaker } }
  return { ok: true, value: { ...state, players, active: other } }
}

export function endTactical(state: GameState): Result<GameState> {
  const tac = state.tactical
  if (state.phase !== 'action' || !tac) return { ok: false, error: 'no tactical action is running' }
  if (tac.step !== 'done' && tac.step !== 'production') return { ok: false, error: `the ${tac.step} step is not finished` }
  return { ok: true, value: passTurn({ ...state, tactical: null }) }
}
```

- [ ] **Step 4: Wire the dispatcher and the enumerator**

`src/engine/index.ts`: add the import and the three cases.

```ts
// src/engine/index.ts
import { endTactical, pass, startTactical } from './actionPhase'
import { pickStrategyCard } from './strategyPhase'
import type { GameState, Move, Result } from './types'

export function applyMove(state: GameState, move: Move, seed: number): Result<GameState> {
  void seed   // used from task 3 on for dice
  if (state.winner !== null) return { ok: false, error: 'game over' }
  try {
    let result: Result<GameState>
    switch (move.type) {
      case 'pickStrategyCard': result = pickStrategyCard(state, move.card); break
      case 'startTactical': result = startTactical(state, move.systemId); break
      case 'pass': result = pass(state); break
      case 'endTactical': result = endTactical(state); break
      default: result = { ok: false, error: `not implemented: ${move.type}` }
    }
    if (!result.ok) return result
    return { ok: true, value: { ...result.value, log: [...result.value.log, { t: 'move', seat: state.active, move }] } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export { createGame } from './setup'
export { legalMoves, validateMove } from './legalMoves'
export type * from './types'
```

`src/engine/legalMoves.ts`: replace the file with the action-phase aware version (task 6 fills in the tactical steps).

```ts
// src/engine/legalMoves.ts
import { activatableSystems, canPass } from './actionPhase'
import type { GameState, Move, Result } from './types'

export function legalMoves(state: GameState): Move[] {
  if (state.winner !== null) return []
  if (state.phase === 'strategy') {
    const seat = state.draft[0]
    if (seat === undefined || seat !== state.active) return []
    return state.strategyPool.map(c => ({ type: 'pickStrategyCard', card: c.id }))
  }
  if (state.phase !== 'action') return []   // status phase moves are added by plan 3
  const seat = state.active
  if (state.players[seat].passed) return []
  const tac = state.tactical
  if (!tac) {
    const out: Move[] = activatableSystems(state, seat).map(id => ({ type: 'startTactical', systemId: id }))
    if (canPass(state, seat)) out.push({ type: 'pass' })
    return out
  }
  if (tac.step === 'done' || tac.step === 'production') return [{ type: 'endTactical' }]
  return []   // movement, space combat and invasion moves are enumerated in task 6
}

export function validateMove(state: GameState, move: Move): Result<true> {
  const ok = legalMoves(state).some(m => JSON.stringify(m) === JSON.stringify(move))
  return ok ? { ok: true, value: true } : { ok: false, error: `illegal move ${move.type}` }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/engine/actionPhase.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: no errors.

```bash
git add src/engine/actionPhase.ts src/engine/actionPhase.test.ts src/engine/index.ts src/engine/legalMoves.ts
git commit -m "feat(engine): action phase turn structure, activation and passing"
```

---

### Task 2: Board helpers and movement

**Files:**
- Modify: `src/engine/types.ts` (new field `retreatTo` on `CombatState`)
- Modify: `docs/spec/engine-design.md` (the same field in the state shape block)
- Create: `src/engine/board.ts`
- Create: `src/engine/movement.ts`
- Modify: `src/engine/index.ts` (cases `moveShips`, `endMovement`)
- Test: `src/engine/movement.test.ts`

**Interfaces:**
- Produces in `board.ts` (shared by movement, combat, invasion and production):
  ```ts
  export function statsOwner(state: GameState, owner: Owner): StatsOwner
  export function hasTech(state: GameState, owner: Owner, tech: string): boolean
  export function shipsOf(sys: System, owner: Owner): Unit[]
  export function makeUnits(startId: number, type: UnitType, owner: Owner, count: number): Unit[]
  export function removeUnits(state: GameState, systemId: string, ids: number[]): GameState
  export function returnToReinforcements(state: GameState, units: Unit[]): GameState
  export function destroyUnits(state: GameState, systemId: string, units: Unit[]): GameState
  export function freeFighterSlots(state: GameState, seat: Seat, systemId: string): number   // 3 with Space Dock II in the system
  export function checkFleet(state: GameState, seat: Seat, systemId: string): Result<true>   // capacity and fleet pool (Armada +2), via economy.capacity and economy.nonFighterShips
  export function trimCargo(state: GameState, systemId: string, owner: Owner): GameState     // destroys cargo above capacity; only at the end of a combat and after a retreat
  ```
- Produces in `movement.ts`:
  ```ts
  export interface MoveSpec { unitId: number; from: string; carrying: number[] }
  export function pathLength(state: GameState, seat: Seat, from: string, to: string, moveValue: number): number | null
  export function movableShips(state: GameState, seat: Seat): { unitId: number; from: string }[]
  export function moveShips(state: GameState, specs: MoveSpec[]): Result<GameState>
  export function endMovement(state: GameState): Result<GameState>
  ```
  Movement rules (R3.2 step 2, R1 anomalies): move value from `unitStats`; a ship starting in the nebula has move 1; intermediate systems may not be a nebula and may not contain ships of another owner (guardians count); the asteroid field may only be entered or crossed with `antimass_deflectors`; wormholes come from `neighbours`; ships in a system that already holds the mover's own command token may not move; Gravity Drive grants +1 move to the first ship of the batch that needs it; carried units are fighters or infantry of the seat in the source system's space or on its planets, at most `capacity` per ship; after the batch `checkFleet` validates capacity and the fleet pool in the destination. `endMovement` sets step `'spaceCombat'` when both the active seat and another owner have ships in the system, otherwise `'invasion'`; the fresh `CombatState` carries `retreating: null` and `retreatTo: null` (the field added in step 1 of this task).

- [ ] **Step 1: Add the retreat destination to the combat state**

R4.1 step 5 announces a retreat before a round and carries it out after that round, so the announced destination has to be part of the state. `endMovement` below already fills it in, so the field goes in first. In `src/engine/types.ts` replace the `CombatState` line with:

```ts
export interface CombatState { round: number; attacker: Seat; defender: Owner; retreating: Seat | null; retreatTo: string | null; lastRolls: DieRoll[] }
```

Make the identical edit in the `State shape` code block of `docs/spec/engine-design.md`, so spec and code stay the same text. Nothing else changes; no existing code constructs a `CombatState` yet.

- [ ] **Step 2: Write the failing test**

```ts
// src/engine/movement.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { createGame } from './setup'
import { deepFreeze } from './testUtils'
import type { GameConfig, GameState, Owner, Seat, StrategyCardId, UnitType } from './types'

const config: GameConfig = { players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }], speaker: 0 }

function toActionPhase(seed = 1): GameState {
  let s = createGame(config, seed)
  for (const card of ['warfare', 'leadership', 'imperial', 'technology'] as StrategyCardId[]) {
    const r = applyMove(s, { type: 'pickStrategyCard', card }, 0)
    if (!r.ok) throw new Error(r.error)
    s = r.value
  }
  return s
}

/** Places units in a system (space, or on a planet when planetId is given) and takes them out of reinforcements. */
function withUnits(state: GameState, systemId: string, owner: Owner, types: UnitType[], planetId?: string): GameState {
  let next = state.nextUnitId
  const sys = state.systems[systemId]
  const made = types.map(type => ({ id: next++, type, owner, damaged: false }))
  const players = [...state.players] as GameState['players']
  if (owner !== 'guardian') {
    const p = players[owner]
    const reinforcements = { ...p.reinforcements }
    for (const t of types) reinforcements[t] = Math.max(0, reinforcements[t] - 1)
    players[owner] = { ...p, reinforcements }
  }
  const planets = sys.planets.map(p => p.id !== planetId ? p : {
    ...p,
    ground: [...p.ground, ...made.filter(u => u.type === 'infantry')],
    structures: [...p.structures, ...made.filter(u => u.type !== 'infantry')],
  })
  return {
    ...state, players, nextUnitId: next,
    systems: { ...state.systems, [systemId]: { ...sys, space: planetId ? sys.space : [...sys.space, ...made], planets } },
  }
}

function withTechs(state: GameState, seat: Seat, techs: string[]): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], techs: [...players[seat].techs, ...techs] }
  return { ...state, players }
}

function shipId(state: GameState, systemId: string, type: UnitType, owner: Owner = 0): number {
  const u = state.systems[systemId].space.find(x => x.type === type && x.owner === owner)
  if (!u) throw new Error(`no ${type} of ${String(owner)} in ${systemId}`)
  return u.id
}

function groundIds(state: GameState, systemId: string, planetId: string, owner: Owner = 0): number[] {
  return state.systems[systemId].planets.filter(p => p.id === planetId).flatMap(p => p.ground.filter(u => u.owner === owner).map(u => u.id))
}

function activate(state: GameState, seat: Seat, systemId: string): GameState {
  const r = applyMove(deepFreeze({ ...state, active: seat }), { type: 'startTactical', systemId }, 0)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

const move = (state: GameState, unitId: number, from: string, carrying: number[] = []) =>
  applyMove(state, { type: 'moveShips', moves: [{ unitId, from, carrying }] }, 0)

describe('R3.2 movement', () => {
  it('a carrier moves one system and carries infantry within its capacity', () => {
    const base = toActionPhase()
    const s = activate(base, 0, 'bereg')
    const carrier = shipId(s, 'home-n', 'carrier')
    const troops = groundIds(s, 'home-n', '000').slice(0, 4)
    const r = move(s, carrier, 'home-n', troops)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.systems.bereg.space.filter(u => u.owner === 0).map(u => u.type).sort()).toEqual(['carrier', 'infantry', 'infantry', 'infantry', 'infantry'])
    expect(r.value.systems['home-n'].planets[0].ground).toHaveLength(1)
    expect(r.value.systems['home-n'].space.some(u => u.id === carrier)).toBe(false)
  })
  it('carrying more than the capacity is rejected and a fighter cannot move on its own without Fighter II', () => {
    const s = activate(toActionPhase(), 0, 'bereg')
    const carrier = shipId(s, 'home-n', 'carrier')
    expect(move(s, carrier, 'home-n', groundIds(s, 'home-n', '000')).ok).toBe(false)   // 5 infantry, capacity 4
    expect(move(s, shipId(s, 'home-n', 'fighter'), 'home-n').ok).toBe(false)
    const upgraded = activate(withTechs(toActionPhase(), 0, ['fighter_ii']), 0, 'bereg')
    expect(move(upgraded, shipId(upgraded, 'home-n', 'fighter'), 'home-n').ok).toBe(true)
  })
  it('R1 anomaly: the asteroid field can only be entered with Antimass Deflectors', () => {
    const north = activate(withUnits(toActionPhase(), 'home-n', 0, ['destroyer']), 0, 'sakulag')
    expect(move(north, shipId(north, 'home-n', 'destroyer'), 'home-n').ok).toBe(false)
    const armed = activate(withUnits(withTechs(toActionPhase(), 0, ['antimass_deflectors']), 'home-n', 0, ['destroyer']), 0, 'sakulag')
    expect(move(armed, shipId(armed, 'home-n', 'destroyer'), 'home-n').ok).toBe(true)
    const letnev = activate(toActionPhase(), 1, 'sakulag')   // Letnev starts with Antimass Deflectors
    expect(move(letnev, shipId(letnev, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(true)
  })
  it('R1 anomaly: a ship must end its movement in the nebula and has move 1 when it starts there', () => {
    const intoNebula = activate(toActionPhase(), 1, 'quann')
    expect(move(intoNebula, shipId(intoNebula, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(true)
    const blocked = activate(withUnits(toActionPhase(), 'starpoint', 0, ['destroyer']), 1, 'bereg')
    expect(move(blocked, shipId(blocked, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(false)   // only route left is through the nebula
    const inNebula = withUnits(toActionPhase(), 'quann', 1, ['cruiser'])
    const far = activate(inNebula, 1, 'starpoint')
    expect(move(far, shipId(far, 'quann', 'cruiser', 1), 'quann').ok).toBe(false)   // two steps with move 1
    const near = activate(inNebula, 1, 'home-s')
    expect(move(near, shipId(near, 'quann', 'cruiser', 1), 'quann').ok).toBe(true)
  })
  it('R1 wormholes: the alpha wormhole makes bereg and starpoint one step apart', () => {
    const s = activate(withUnits(toActionPhase(), 'bereg', 0, ['carrier']), 0, 'starpoint')
    expect(move(s, shipId(s, 'bereg', 'carrier'), 'bereg').ok).toBe(true)
  })
  it('ships may not move through a system that contains enemy or guardian ships', () => {
    const open = activate(withUnits(toActionPhase(), 'home-n', 0, ['destroyer']), 0, 'quann')
    expect(move(open, shipId(open, 'home-n', 'destroyer'), 'home-n').ok).toBe(true)   // via bereg
    const blocked = activate(withUnits(withUnits(toActionPhase(), 'home-n', 0, ['destroyer']), 'bereg', 1, ['destroyer']), 0, 'quann')
    expect(move(blocked, shipId(blocked, 'home-n', 'destroyer'), 'home-n').ok).toBe(false)
  })
  it('ships in a system that contains your own command token cannot move', () => {
    const placed = withUnits(toActionPhase(), 'bereg', 0, ['carrier'])
    const tokened = { ...placed, systems: { ...placed.systems, bereg: { ...placed.systems.bereg, activatedBy: [0 as Seat] } } }
    const s = activate(tokened, 0, 'starpoint')
    expect(move(s, shipId(s, 'bereg', 'carrier'), 'bereg').ok).toBe(false)
  })
  it('R5 Gravity Drive gives +1 move to exactly one ship per activation', () => {
    const plain = activate(withUnits(toActionPhase(), 'home-n', 0, ['carrier']), 0, 'starpoint')
    expect(move(plain, shipId(plain, 'home-n', 'carrier'), 'home-n').ok).toBe(false)   // two steps with move 1
    const gd = activate(withUnits(withTechs(toActionPhase(), 0, ['gravity_drive']), 'home-n', 0, ['carrier', 'carrier']), 0, 'starpoint')
    const ids = gd.systems['home-n'].space.filter(u => u.type === 'carrier' && u.owner === 0).map(u => u.id)
    expect(move(gd, ids[0], 'home-n').ok).toBe(true)
    const both = applyMove(gd, { type: 'moveShips', moves: ids.map(id => ({ unitId: id, from: 'home-n', carrying: [] })) }, 0)
    expect(both.ok).toBe(false)
  })
  it('R4.4 fleet pool limits the arrivals, Armada gives Letnev two more', () => {
    const crowded = activate(withUnits(toActionPhase(), 'bereg', 0, ['cruiser', 'cruiser', 'cruiser']), 0, 'bereg')
    const from = withUnits(crowded, 'home-n', 0, ['destroyer'])
    expect(move(from, shipId(from, 'home-n', 'destroyer'), 'home-n').ok).toBe(false)   // fleet pool 3
    const letnev = activate(withUnits(toActionPhase(), 'starpoint', 1, ['cruiser', 'cruiser', 'cruiser', 'cruiser']), 1, 'starpoint')
    expect(move(letnev, shipId(letnev, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(true)   // 5 with Armada
    const full = activate(withUnits(toActionPhase(), 'starpoint', 1, ['cruiser', 'cruiser', 'cruiser', 'cruiser', 'cruiser']), 1, 'starpoint')
    expect(move(full, shipId(full, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(false)
  })
  it('endMovement goes to the space combat when enemy ships are present, otherwise to the invasion', () => {
    const empty = activate(toActionPhase(), 0, 'bereg')
    const r = applyMove(empty, { type: 'endMovement' }, 0)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.tactical?.step).toBe('invasion')
    expect(r.value.tactical?.invasion).toEqual({ planetId: null, landed: [], bombarded: [] })
    const mecatol = activate(withUnits(toActionPhase(), 'home-n', 0, ['destroyer']), 0, 'mecatol')
    const moved = move(mecatol, shipId(mecatol, 'home-n', 'destroyer'), 'home-n')
    if (!moved.ok) throw new Error(moved.error)
    const combat = applyMove(moved.value, { type: 'endMovement' }, 0)
    if (!combat.ok) throw new Error(combat.error)
    expect(combat.value.tactical?.step).toBe('spaceCombat')
    expect(combat.value.tactical?.combat).toMatchObject({ round: 0, attacker: 0, defender: 'guardian' })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/engine/movement.test.ts`
Expected: FAIL, `Cannot find module './movement'`.

- [ ] **Step 4: Implement the board helpers**

```ts
// src/engine/board.ts
import { isShip, type StatsOwner } from '../data/units'
import { capacity, fleetPoolLimit, nonFighterShips } from './economy'
import type { GameState, Owner, Result, Seat, System, Unit, UnitType } from './types'

export function statsOwner(state: GameState, owner: Owner): StatsOwner {
  return owner === 'guardian' ? 'guardian' : { faction: state.players[owner].faction, techs: state.players[owner].techs }
}

export function hasTech(state: GameState, owner: Owner, tech: string): boolean {
  return owner !== 'guardian' && state.players[owner].techs.includes(tech)
}

export function shipsOf(sys: System, owner: Owner): Unit[] {
  return sys.space.filter(u => u.owner === owner && isShip(u.type))
}

export function makeUnits(startId: number, type: UnitType, owner: Owner, count: number): Unit[] {
  return Array.from({ length: count }, (_, i) => ({ id: startId + i, type, owner, damaged: false }))
}

export function removeUnits(state: GameState, systemId: string, ids: number[]): GameState {
  const set = new Set(ids)
  if (!set.size) return state
  const sys = state.systems[systemId]
  return {
    ...state,
    systems: {
      ...state.systems,
      [systemId]: {
        ...sys,
        space: sys.space.filter(u => !set.has(u.id)),
        planets: sys.planets.map(p => ({ ...p, ground: p.ground.filter(u => !set.has(u.id)), structures: p.structures.filter(u => !set.has(u.id)) })),
      },
    },
  }
}

export function returnToReinforcements(state: GameState, units: Unit[]): GameState {
  if (!units.length) return state
  const players = [...state.players] as GameState['players']
  for (const u of units) {
    if (u.owner === 'guardian') continue
    const p = players[u.owner]
    players[u.owner] = { ...p, reinforcements: { ...p.reinforcements, [u.type]: p.reinforcements[u.type] + 1 } }
  }
  return { ...state, players }
}

export function destroyUnits(state: GameState, systemId: string, units: Unit[]): GameState {
  if (!units.length) return state
  return returnToReinforcements(removeUnits(state, systemId, units.map(u => u.id)), units)
}

/** R4.4: Space Dock II lets up to 3 fighters in the system ignore capacity. */
export function freeFighterSlots(state: GameState, seat: Seat, systemId: string): number {
  if (!state.players[seat].techs.includes('space_dock_ii')) return 0
  const sys = state.systems[systemId]
  return sys.planets.some(p => p.structures.some(u => u.type === 'spacedock' && u.owner === seat)) ? 3 : 0
}

/** Capacity for carried fighters and infantry plus the fleet pool for non-fighter ships (Armada +2). */
export function checkFleet(state: GameState, seat: Seat, systemId: string): Result<true> {
  const player = state.players[seat]
  const stats: StatsOwner = { faction: player.faction, techs: player.techs }
  const space = state.systems[systemId].space
  const mine = space.filter(u => u.owner === seat)
  const fighters = mine.filter(u => u.type === 'fighter').length
  const infantry = mine.filter(u => u.type === 'infantry').length
  const cap = capacity(space, seat, stats) + Math.min(freeFighterSlots(state, seat, systemId), fighters)
  let excess = fighters + infantry - cap
  if (excess > 0) {
    if (!player.techs.includes('fighter_ii') || excess > fighters) return { ok: false, error: `capacity exceeded in ${systemId}` }
  } else excess = 0
  if (nonFighterShips(space, seat) + excess > fleetPoolLimit(player)) return { ok: false, error: `fleet pool exceeded in ${systemId}` }
  return { ok: true, value: true }
}

/** Destroys carried infantry and fighters above the remaining capacity; called when a combat ends and after a retreat. */
export function trimCargo(state: GameState, systemId: string, owner: Owner): GameState {
  const sys = state.systems[systemId]
  const cap = capacity(sys.space, owner, statsOwner(state, owner))
  const mine = sys.space.filter(u => u.owner === owner)
  const infantry = mine.filter(u => u.type === 'infantry')
  const fighters = mine.filter(u => u.type === 'fighter')
  const keepInfantry = Math.min(infantry.length, cap)
  const keepFighters = hasTech(state, owner, 'fighter_ii') ? fighters.length : Math.min(fighters.length, Math.max(0, cap - keepInfantry))
  const doomed = [...infantry.slice(keepInfantry), ...fighters.slice(keepFighters)]
  return destroyUnits(state, systemId, doomed)
}
```

- [ ] **Step 5: Implement movement**

```ts
// src/engine/movement.ts
import { systemDef } from '../data/map'
import { isShip, unitStats, type StatsOwner } from '../data/units'
import { neighbours } from './adjacency'
import { checkFleet } from './board'
import type { GameState, Result, Seat, System, Unit } from './types'

export interface MoveSpec { unitId: number; from: string; carrying: number[] }

function passable(state: GameState, seat: Seat, id: string, destination: boolean, antimass: boolean): boolean {
  const def = systemDef(id)
  if (def.anomaly === 'asteroid' && !antimass) return false                       // R1: asteroid field
  if (!destination && def.anomaly === 'nebula') return false                      // R1: a ship entering a nebula must end there
  if (destination) return true
  return !state.systems[id].space.some(u => u.owner !== seat && isShip(u.type))   // R3.2: no moving through enemy or guardian ships
}

/** Shortest legal path length in steps, or null when the destination is out of reach. */
export function pathLength(state: GameState, seat: Seat, from: string, to: string, moveValue: number): number | null {
  if (from === to || moveValue < 1) return null
  const antimass = state.players[seat].techs.includes('antimass_deflectors')
  if (!passable(state, seat, to, true, antimass)) return null
  const seen = new Set([from])
  let frontier = [from]
  for (let d = 1; d <= moveValue && frontier.length; d++) {
    const next: string[] = []
    for (const id of frontier) for (const n of neighbours(id)) {
      if (n === to) return d
      if (seen.has(n)) continue
      seen.add(n)
      if (passable(state, seat, n, false, antimass)) next.push(n)
    }
    frontier = next
  }
  return null
}

function moveValueOf(state: GameState, seat: Seat, unit: Unit, from: string): number {
  const player = state.players[seat]
  const owner: StatsOwner = { faction: player.faction, techs: player.techs }
  const stats = unitStats(unit.type, owner)
  return systemDef(from).anomaly === 'nebula' ? Math.min(stats.move, 1) : stats.move
}

/** Every ship of the seat that could reach the active system this activation. */
export function movableShips(state: GameState, seat: Seat): { unitId: number; from: string }[] {
  const tac = state.tactical
  if (!tac || tac.step !== 'movement') return []
  const bonus = state.players[seat].techs.includes('gravity_drive') ? 1 : 0
  const out: { unitId: number; from: string }[] = []
  for (const sys of Object.values(state.systems)) {
    if (sys.id === tac.systemId || sys.activatedBy.includes(seat)) continue
    for (const u of sys.space) {
      if (u.owner !== seat || !isShip(u.type)) continue
      const value = moveValueOf(state, seat, u, sys.id)
      if (pathLength(state, seat, sys.id, tac.systemId, value + bonus) !== null) out.push({ unitId: u.id, from: sys.id })
    }
  }
  return out
}

export function moveShips(state: GameState, specs: MoveSpec[]): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'movement') return { ok: false, error: 'not in the movement step' }
  const seat = state.active
  const player = state.players[seat]
  const owner: StatsOwner = { faction: player.faction, techs: player.techs }
  let gravityDrive = player.techs.includes('gravity_drive')
  const taken = new Set<number>()
  const arriving: Unit[] = []
  for (const spec of specs) {
    const src = state.systems[spec.from]
    if (!src) return { ok: false, error: `unknown system ${spec.from}` }
    if (spec.from === tac.systemId) return { ok: false, error: 'ships in the active system do not move' }
    if (src.activatedBy.includes(seat)) return { ok: false, error: `R3.2: ships in ${spec.from} already carry your command token` }
    const ship = src.space.find(u => u.id === spec.unitId && u.owner === seat && isShip(u.type))
    if (!ship || taken.has(ship.id)) return { ok: false, error: `no movable ship ${spec.unitId} in ${spec.from}` }
    const value = moveValueOf(state, seat, ship, spec.from)
    if (value < 1) return { ok: false, error: `a ${ship.type} cannot move on its own` }
    let steps = pathLength(state, seat, spec.from, tac.systemId, value)
    if (steps === null && gravityDrive) {
      steps = pathLength(state, seat, spec.from, tac.systemId, value + 1)
      if (steps !== null) gravityDrive = false     // R5: Gravity Drive helps one ship per activation
    }
    if (steps === null) return { ok: false, error: `${ship.type} ${ship.id} cannot reach ${tac.systemId}` }
    taken.add(ship.id)
    arriving.push(ship)
    if (spec.carrying.length > unitStats(ship.type, owner).capacity) return { ok: false, error: `${ship.type} ${ship.id} carries more than its capacity` }
    for (const id of spec.carrying) {
      const cargo = src.space.find(u => u.id === id) ?? src.planets.flatMap(p => p.ground).find(u => u.id === id)
      if (!cargo || cargo.owner !== seat || (cargo.type !== 'fighter' && cargo.type !== 'infantry')) return { ok: false, error: `unit ${id} cannot be carried` }
      if (taken.has(id)) return { ok: false, error: `unit ${id} is carried twice` }
      taken.add(id)
      arriving.push(cargo)
    }
  }
  if (!arriving.length) return { ok: false, error: 'no ships moved' }
  const systems: Record<string, System> = {}
  for (const [id, sys] of Object.entries(state.systems)) {
    systems[id] = {
      ...sys,
      space: sys.space.filter(u => !taken.has(u.id)),
      planets: sys.planets.map(p => p.ground.some(u => taken.has(u.id)) ? { ...p, ground: p.ground.filter(u => !taken.has(u.id)) } : p),
    }
  }
  const dest = systems[tac.systemId]
  systems[tac.systemId] = { ...dest, space: [...dest.space, ...arriving] }
  const next: GameState = { ...state, systems }
  const fleet = checkFleet(next, seat, tac.systemId)
  if (!fleet.ok) return { ok: false, error: fleet.error }
  return { ok: true, value: next }
}

export function endMovement(state: GameState): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'movement') return { ok: false, error: 'not in the movement step' }
  const seat = state.active
  const sys = state.systems[tac.systemId]
  const mine = sys.space.filter(u => u.owner === seat && isShip(u.type))
  const foes = sys.space.filter(u => u.owner !== seat && isShip(u.type))
  if (mine.length && foes.length) {
    return { ok: true, value: { ...state, tactical: { ...tac, step: 'spaceCombat', combat: { round: 0, attacker: seat, defender: foes[0].owner, retreating: null, retreatTo: null, lastRolls: [] } } } }
  }
  return { ok: true, value: { ...state, tactical: { ...tac, step: 'invasion', invasion: { planetId: null, landed: [], bombarded: [] } } } }
}
```

- [ ] **Step 6: Wire the dispatcher**

In `src/engine/index.ts` add the import `import { endMovement, moveShips } from './movement'` and the cases:

```ts
    case 'moveShips': result = moveShips(state, move.moves); break
    case 'endMovement': result = endMovement(state); break
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -- src/engine/movement.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 8: Type-check and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/board.ts src/engine/movement.ts src/engine/movement.test.ts src/engine/index.ts
git commit -m "feat(engine): board helpers and tactical movement with anomalies, wormholes and fleet limits"
```

---

### Task 3: Space combat

**Files:**
- Create: `src/engine/combat.ts` (uses the `retreatTo` field added in task 2, step 1)
- Modify: `src/engine/index.ts` (cases `combatRound`, `retreat`)
- Test: `src/engine/combat.test.ts`

**Interfaces:**
- Produces in `combat.ts`:
  ```ts
  export function assignHits(units: Unit[], normal: number, restricted: number, owner: StatsOwner, nes: boolean): { units: Unit[]; destroyed: Unit[]; sustainedIds: number[] }
  export function applyCombatHits(state: GameState, systemId: string, owner: Owner, hits: number, restricted: number): GameState
  export function canMunitions(state: GameState, owner: Owner): boolean       // Letnev with 2 trade goods
  export function retreatTargets(state: GameState, seat: Seat): string[]
  export function combatRound(state: GameState, munitions: boolean, seed: number): Result<GameState>
  export function retreat(state: GameState, to: string): Result<GameState>
  ```
  `combat.round` is the index of the next round to resolve. Round 0 is the pre-combat step (R4.1: Assault Cannon, then space cannon offense, then anti-fighter barrage) and leaves `round: 1`. Every later call rolls one combat round for both sides simultaneously, applies the hits and increments the round. Hit assignment order (R4.1 step 4): sustain damage first (Non-Euclidean Shielding cancels 2), then `fighter, destroyer, cruiser, carrier, dreadnought, flagship, warsun`; hits from L1Z1X dreadnoughts and the L1Z1X flagship are `restricted` and skip fighters while non-fighters remain; Duranium Armor repairs one damaged unit that did not sustain this round.
  `retreat` is only an **announcement** (R4.1 step 5): the attacker may issue it before a round after the first (`combat.round >= 2`), only once, and only to a legal destination; it stores `retreating` and `retreatTo` and leaves the step at `'spaceCombat'`. The next `combatRound` is fought normally and only afterwards, if both sides still have ships, the retreating side moves to `retreatTo` with its cargo and the tactical step becomes `'done'`. Guardians never retreat.
  Combat ends when a side has no ships: attacker alive goes to `'invasion'` and marks `mandateEarnedThisRound` in `MECATOL_ID` or the opponent's home system (R7), otherwise the step is `'done'`. A side destroyed in the same round in which a retreat was announced ends the combat instead of retreating. Cargo above the remaining capacity is trimmed exactly at those two points (end of combat, executed retreat), never after an individual round.

- [ ] **Step 1: Check the state field is in place**

`CombatState` must already carry `retreatTo: string | null` (task 2, step 1). If it does not, add it there first, in `src/engine/types.ts` and in the `State shape` block of `docs/spec/engine-design.md`.

- [ ] **Step 2: Write the failing test**

```ts
// src/engine/combat.test.ts
import { describe, expect, it } from 'vitest'
import { unitStats } from '../data/units'
import { assignHits, applyCombatHits } from './combat'
import { applyMove } from './index'
import { createGame } from './setup'
import { deepFreeze } from './testUtils'
import type { GameConfig, GameState, Owner, Seat, StrategyCardId, Unit, UnitType } from './types'

const config: GameConfig = { players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }], speaker: 0 }
const letnev = { faction: 'letnev' as const, techs: [] as string[] }

function toActionPhase(seed = 1): GameState {
  let s = createGame(config, seed)
  for (const card of ['warfare', 'leadership', 'imperial', 'technology'] as StrategyCardId[]) {
    const r = applyMove(s, { type: 'pickStrategyCard', card }, 0)
    if (!r.ok) throw new Error(r.error)
    s = r.value
  }
  return s
}

function withUnits(state: GameState, systemId: string, owner: Owner, types: UnitType[], planetId?: string): GameState {
  let next = state.nextUnitId
  const sys = state.systems[systemId]
  const made = types.map(type => ({ id: next++, type, owner, damaged: false }))
  const players = [...state.players] as GameState['players']
  if (owner !== 'guardian') {
    const p = players[owner]
    const reinforcements = { ...p.reinforcements }
    for (const t of types) reinforcements[t] = Math.max(0, reinforcements[t] - 1)
    players[owner] = { ...p, reinforcements }
  }
  const planets = sys.planets.map(p => p.id !== planetId ? p : {
    ...p,
    ground: [...p.ground, ...made.filter(u => u.type === 'infantry')],
    structures: [...p.structures, ...made.filter(u => u.type !== 'infantry')],
  })
  return {
    ...state, players, nextUnitId: next,
    systems: { ...state.systems, [systemId]: { ...sys, space: planetId ? sys.space : [...sys.space, ...made], planets } },
  }
}

function withTechs(state: GameState, seat: Seat, techs: string[]): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], techs: [...players[seat].techs, ...techs] }
  return { ...state, players }
}

/** Empties a system and puts the two fleets in, then opens the space combat at the given round. */
function combat(systemId: string, attackerUnits: UnitType[], defenderUnits: UnitType[], round: number, seed = 1): GameState {
  const base = toActionPhase(seed)
  const cleared: GameState = { ...base, systems: { ...base.systems, [systemId]: { ...base.systems[systemId], space: [] } } }
  const s = withUnits(withUnits(cleared, systemId, 0, attackerUnits), systemId, 1, defenderUnits)
  return {
    ...s, active: 0,
    tactical: { systemId, step: 'spaceCombat', combat: { round, attacker: 0, defender: 1, retreating: null, retreatTo: null, lastRolls: [] } },
  }
}

const hitsIn = (state: GameState, context: string) =>
  state.log.flatMap(e => e.t === 'roll' && e.context === context ? e.rolls : []).filter(r => r.hit).length

const typesIn = (state: GameState, systemId: string, owner: Owner) =>
  state.systems[systemId].space.filter(u => u.owner === owner).map(u => u.type).sort()

const fight = (state: GameState, seed = 7, munitions?: boolean) => {
  const r = applyMove(deepFreeze(state), { type: 'combatRound', ...(munitions === undefined ? {} : { munitions }) }, seed)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('R4.1 hit assignment', () => {
  const units = (spec: [UnitType, boolean][]): Unit[] => spec.map(([type, damaged], i) => ({ id: i + 1, type, owner: 0, damaged }))
  it('R4.1 step 4: sustain damage cancels first, then the destruction order applies', () => {
    const r = assignHits(units([['dreadnought', false], ['fighter', false], ['cruiser', false]]), 1, 0, letnev, false)
    expect(r.destroyed).toHaveLength(0)
    expect(r.units.find(u => u.type === 'dreadnought')?.damaged).toBe(true)
    const r2 = assignHits(units([['dreadnought', true], ['fighter', false], ['cruiser', false], ['carrier', false]]), 3, 0, letnev, false)
    expect(r2.destroyed.map(u => u.type)).toEqual(['fighter', 'cruiser', 'carrier'])
  })
  it('R4.1 step 4: Non-Euclidean Shielding cancels 2 hits with one sustain', () => {
    const plain = assignHits(units([['dreadnought', false], ['fighter', false]]), 2, 0, letnev, false)
    expect(plain.destroyed.map(u => u.type)).toEqual(['fighter'])
    const nes = assignHits(units([['dreadnought', false], ['fighter', false]]), 2, 0, letnev, true)
    expect(nes.destroyed).toHaveLength(0)
    expect(nes.units.find(u => u.type === 'dreadnought')?.damaged).toBe(true)
  })
  it('R4.1 step 4: restricted hits ([0.0.1] and L1Z1X dreadnoughts) skip fighters while non-fighters remain', () => {
    const r = assignHits(units([['fighter', false], ['cruiser', false]]), 0, 1, letnev, false)
    expect(r.destroyed.map(u => u.type)).toEqual(['cruiser'])
    const only = assignHits(units([['fighter', false], ['fighter', false]]), 0, 1, letnev, false)
    expect(only.destroyed.map(u => u.type)).toEqual(['fighter'])
  })
  it('R4.1 step 4: Duranium Armor repairs one unit that did not sustain this round', () => {
    const s = withTechs(combat('bereg', ['cruiser'], ['dreadnought', 'dreadnought'], 1), 1, ['duranium_armor'])
    const damaged: GameState = {
      ...s,
      systems: { ...s.systems, bereg: { ...s.systems.bereg, space: s.systems.bereg.space.map((u, i) => u.owner === 1 && i === 1 ? { ...u, damaged: true } : u) } },
    }
    const after = applyCombatHits(damaged, 'bereg', 1, 1, 0)
    expect(after.systems.bereg.space.filter(u => u.owner === 1 && u.damaged)).toHaveLength(1)
    const without = applyCombatHits(s, 'bereg', 1, 1, 0)
    expect(without.systems.bereg.space.filter(u => u.owner === 1 && u.damaged)).toHaveLength(1)
  })
  it('destroyed units go back to the reinforcements', () => {
    const s = combat('bereg', ['cruiser'], ['cruiser'], 1)
    const before = s.players[1].reinforcements.cruiser
    const after = applyCombatHits(s, 'bereg', 1, 1, 0)
    expect(after.systems.bereg.space.filter(u => u.owner === 1)).toHaveLength(0)
    expect(after.players[1].reinforcements.cruiser).toBe(before + 1)
  })
})

describe('R4.1 space combat', () => {
  it('R4.1 step 1: defending PDS fire space cannon before the combat', () => {
    const base = combat('bereg', ['fighter', 'fighter', 'fighter'], ['cruiser'], 0)
    const s = withUnits(base, 'bereg', 1, ['pds'], 'bereg')
    const after = fight(s)
    const hits = hitsIn(after, 'space cannon offense')
    expect(after.log.some(e => e.t === 'roll' && e.context === 'space cannon offense')).toBe(true)
    expect(after.systems.bereg.space.filter(u => u.owner === 0)).toHaveLength(3 - hits)
    expect(after.tactical?.combat?.round).toBe(1)
  })
  it('R4.1 step 1: Graviton Laser System keeps space cannon hits off fighters', () => {
    const base = combat('bereg', ['fighter', 'cruiser'], ['cruiser'], 0)
    const s = withTechs(withUnits(base, 'bereg', 1, ['pds'], 'bereg'), 1, ['graviton_laser_system'])
    const after = fight(s)
    if (hitsIn(after, 'space cannon offense') > 0) expect(typesIn(after, 'bereg', 0)).not.toContain('cruiser')
  })
  it('R4.1 step 2: anti-fighter barrage only destroys fighters', () => {
    const s = combat('bereg', ['fighter', 'fighter', 'cruiser'], ['destroyer'], 0)
    const after = fight(s)
    const hits = hitsIn(after, 'anti-fighter barrage')
    expect(after.systems.bereg.space.filter(u => u.owner === 0 && u.type === 'fighter')).toHaveLength(Math.max(0, 2 - hits))
    expect(typesIn(after, 'bereg', 0)).toContain('cruiser')
  })
  it('R4.1 step 6: Assault Cannon destroys a non-fighter ship at the start of the combat', () => {
    const s = withTechs(combat('bereg', ['cruiser', 'cruiser', 'cruiser'], ['dreadnought', 'fighter'], 0), 0, ['assault_cannon'])
    const after = fight(s)
    expect(typesIn(after, 'bereg', 1)).toEqual(['fighter'])
    expect(after.players[1].reinforcements.dreadnought).toBe(s.players[1].reinforcements.dreadnought + 1)
  })
  it('R4.1 step 3: a combat round rolls every ship and logs both sides', () => {
    const s = combat('bereg', ['cruiser', 'cruiser'], ['carrier'], 1)
    const after = fight(s)
    const rolls = after.log.filter(e => e.t === 'roll' && e.context === 'space combat round 1')
    expect(rolls).toHaveLength(2)
    expect(after.tactical?.combat?.round).toBe(2)
    expect(after.tactical?.combat?.lastRolls.length).toBeGreaterThan(0)
    const again = fight(s)
    expect(JSON.stringify(again.systems.bereg.space)).toBe(JSON.stringify(after.systems.bereg.space))
  })
  it('R1 nebula: the defender gets +1 on the combat rolls', () => {
    const s = combat('quann', ['cruiser'], ['cruiser'], 1)
    const after = fight(s)
    const defence = after.log.flatMap(e => e.t === 'roll' && e.owner === 1 ? e.rolls : [])
    expect(defence.filter(r => r.value >= 6 && r.hit)).toHaveLength(defence.filter(r => r.value >= 6).length)
  })
  it('R4.1: Munitions Reserves costs Letnev 2 trade goods', () => {
    const base = combat('bereg', ['cruiser'], ['cruiser'], 1)
    const rich: GameState = { ...base, players: [base.players[0], { ...base.players[1], tradeGoods: 3 }] }
    const after = fight(rich, 7, true)
    expect(after.players[1].tradeGoods).toBe(1)
    expect(applyMove(base, { type: 'combatRound', munitions: true }, 7).ok).toBe(false)
  })
  it('R4.1 step 6: the combat ends when one side has no ships and the attacker moves on to the invasion', () => {
    let s = combat('bereg', ['dreadnought', 'dreadnought', 'cruiser'], ['fighter'], 1)
    for (let i = 0; i < 40 && s.tactical?.step === 'spaceCombat'; i++) s = fight(s, 100 + i)
    expect(s.tactical?.step === 'invasion' || s.tactical?.step === 'done').toBe(true)
    if (s.systems.bereg.space.some(u => u.owner === 0)) expect(s.tactical?.step).toBe('invasion')
  })
  it('R7 Mandate: winning a space combat in Mecatol Rex marks the mandate for the round', () => {
    let s = combat('mecatol', ['dreadnought', 'dreadnought', 'cruiser'], ['fighter'], 1)
    for (let i = 0; i < 40 && s.tactical?.step === 'spaceCombat'; i++) s = fight(s, 200 + i)
    if (s.systems.mecatol.space.some(u => u.owner === 0)) expect(s.players[0].mandateEarnedThisRound).toBe(true)
  })
  it('R4.1 step 5: the retreat is announced before a round and carried out after it', () => {
    const first = combat('bereg', ['dreadnought'], ['dreadnought'], 1)
    expect(applyMove(first, { type: 'retreat', to: 'home-n' }, 0).ok).toBe(false)   // not before the first round
    const later = combat('bereg', ['dreadnought'], ['dreadnought'], 2)
    expect(applyMove(later, { type: 'retreat', to: 'quann' }, 0).ok).toBe(false)    // no own units or command token there
    const announced = applyMove(later, { type: 'retreat', to: 'home-n' }, 0)
    if (!announced.ok) throw new Error(announced.error)
    expect(announced.value.tactical?.combat).toMatchObject({ retreating: 0, retreatTo: 'home-n' })
    expect(announced.value.tactical?.step).toBe('spaceCombat')
    expect(announced.value.systems.bereg.space.filter(u => u.owner === 0)).toHaveLength(1)   // nothing has moved yet
    expect(applyMove(announced.value, { type: 'retreat', to: 'home-n' }, 0).ok).toBe(false)  // only one announcement
    // one dreadnought per side rolls at most one hit and the other side sustains it, so both survive the round
    const after = fight(announced.value, 3)
    expect(after.systems.bereg.space.some(u => u.owner === 0)).toBe(false)
    expect(after.systems['home-n'].space.filter(u => u.owner === 0 && u.type === 'dreadnought')).toHaveLength(2)
    expect(after.tactical?.step).toBe('done')
    expect(after.log.some(e => e.t === 'info' && e.text.includes('retreats'))).toBe(true)
  })
  it('R4.1 step 5: an announced retreat is dropped when the combat ends in that round', () => {
    const s = combat('bereg', ['dreadnought', 'dreadnought', 'cruiser'], ['fighter'], 2)
    const announced = applyMove(s, { type: 'retreat', to: 'home-n' }, 0)
    if (!announced.ok) throw new Error(announced.error)
    let next = announced.value
    for (let i = 0; i < 40 && next.tactical?.step === 'spaceCombat'; i++) next = fight(next, 400 + i)
    if (!next.systems.bereg.space.some(u => u.owner === 1)) expect(next.tactical?.step).toBe('invasion')
  })
  it('carried infantry are trimmed when the combat ends, not after a single round', () => {
    const base = withUnits(combat('bereg', ['carrier'], ['cruiser', 'cruiser', 'cruiser'], 1), 'bereg', 0, ['infantry', 'infantry'])
    expect(unitStats('carrier', letnev).capacity).toBe(4)
    let s = base
    for (let i = 0; i < 40 && s.tactical?.step === 'spaceCombat'; i++) s = fight(s, 300 + i)
    const mine = s.systems.bereg.space.filter(u => u.owner === 0)
    if (mine.some(u => u.type === 'carrier')) expect(mine.filter(u => u.type === 'infantry')).toHaveLength(2)
    else expect(mine.filter(u => u.type === 'infantry')).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/engine/combat.test.ts`
Expected: FAIL, `Cannot find module './combat'`.

- [ ] **Step 4: Implement space combat**

```ts
// src/engine/combat.ts
import { MECATOL_ID, systemDef } from '../data/map'
import { NON_FIGHTER_SHIPS, isShip, unitStats, type StatsOwner } from '../data/units'
import { otherSeat } from './actionPhase'
import { destroyUnits, hasTech, shipsOf, statsOwner, trimCargo } from './board'
import { neighbours } from './adjacency'
import { deriveSeed, mulberry32, rollDice } from './rng'
import type { DieRoll, GameState, Owner, Result, Seat, Unit, UnitType } from './types'

const DESTROY_ORDER: UnitType[] = ['fighter', 'destroyer', 'cruiser', 'carrier', 'dreadnought', 'flagship', 'warsun']
interface Ctx { systemId: string; attacker: Seat; defender: Owner; round: number }

/** R4.1 step 4: sustain first, then the destruction order; restricted hits skip fighters while non-fighters remain. */
export function assignHits(units: Unit[], normal: number, restricted: number, owner: StatsOwner, nes: boolean): { units: Unit[]; destroyed: Unit[]; sustainedIds: number[] } {
  let list = units.map(u => ({ ...u }))
  const destroyed: Unit[] = []
  const sustainedIds: number[] = []
  let total = normal + restricted
  let restrictedLeft = restricted
  for (const u of list) {
    if (total <= 0) break
    if (u.damaged || !unitStats(u.type, owner).sustain) continue
    u.damaged = true
    sustainedIds.push(u.id)
    const cancelled = Math.min(nes ? 2 : 1, total)
    total -= cancelled
    restrictedLeft = Math.max(0, restrictedLeft - cancelled)
  }
  while (total > 0) {
    const nonFighterOnly = restrictedLeft > 0 && list.some(u => u.type !== 'fighter')
    const target = DESTROY_ORDER
      .filter(t => !nonFighterOnly || t !== 'fighter')
      .flatMap(t => list.filter(u => u.type === t))[0]
    if (!target) break
    list = list.filter(u => u.id !== target.id)
    destroyed.push(target)
    total--
    if (restrictedLeft > 0) restrictedLeft--
  }
  return { units: list, destroyed, sustainedIds }
}

export function applyCombatHits(state: GameState, systemId: string, owner: Owner, hits: number, restricted: number): GameState {
  if (hits <= 0) return state
  const sys = state.systems[systemId]
  const sOwner = statsOwner(state, owner)
  const { units, destroyed, sustainedIds } = assignHits(shipsOf(sys, owner), hits - restricted, restricted, sOwner, hasTech(state, owner, 'non_euclidean_shielding'))
  let kept = units
  if (hasTech(state, owner, 'duranium_armor')) {
    const repair = kept.find(u => u.damaged && !sustainedIds.includes(u.id))
    if (repair) kept = kept.map(u => u.id === repair.id ? { ...u, damaged: false } : u)
  }
  const others = sys.space.filter(u => !(u.owner === owner && isShip(u.type)))
  const next: GameState = { ...state, systems: { ...state.systems, [systemId]: { ...sys, space: [...others, ...kept] } } }
  return destroyUnits(next, systemId, destroyed)
}

export function canMunitions(state: GameState, owner: Owner): boolean {
  return owner !== 'guardian' && state.players[owner].faction === 'letnev' && state.players[owner].tradeGoods >= 2
}

function payMunitions(state: GameState, owner: Owner): GameState {
  if (owner === 'guardian') return state
  const players = [...state.players] as GameState['players']
  players[owner] = { ...players[owner], tradeGoods: players[owner].tradeGoods - 2 }
  return { ...state, players }
}

function combatRolls(state: GameState, ctx: Ctx, owner: Owner, bonus: number, reroll: boolean, seed: number, salt: number): { rolls: DieRoll[]; hits: number; restricted: number } {
  const sOwner = statsOwner(state, owner)
  const rng = mulberry32(deriveSeed(seed, salt))
  const rolls: DieRoll[] = []
  const l1z1x = owner !== 'guardian' && state.players[owner].faction === 'l1z1x'
  let hits = 0
  let restricted = 0
  for (const u of shipsOf(state.systems[ctx.systemId], owner)) {
    const stats = unitStats(u.type, sOwner)
    if (stats.combat === null) continue
    for (let d = 0; d < stats.combatDice; d++) {
      let value = rollDice(rng, 1)[0]
      let hit = value + bonus >= stats.combat
      if (!hit && reroll) {
        const again = rollDice(rng, 1)[0]
        if (again + bonus >= stats.combat) { value = again; hit = true }
      }
      rolls.push({ owner, unit: u.type, value, hit })
      if (!hit) continue
      hits++
      if (l1z1x && (u.type === 'dreadnought' || u.type === 'flagship')) restricted++
    }
  }
  return { rolls, hits, restricted }
}

function spaceCannonOffense(state: GameState, ctx: Ctx, seed: number): GameState {
  const sOwner = statsOwner(state, ctx.defender)
  const pds = state.systems[ctx.systemId].planets.flatMap(p => p.structures.filter(u => u.owner === ctx.defender && unitStats(u.type, sOwner).spaceCannon))
  if (!pds.length) return state
  const rng = mulberry32(deriveSeed(seed, 1))
  const rolls: DieRoll[] = []
  let extra = hasTech(state, ctx.defender, 'plasma_scoring') ? 1 : 0
  let hits = 0
  for (const u of pds) {
    const sc = unitStats(u.type, sOwner).spaceCannon
    if (!sc) continue
    const dice = sc.dice + extra
    extra = 0
    for (const value of rollDice(rng, dice)) {
      const hit = value >= sc.value
      rolls.push({ owner: ctx.defender, unit: u.type, value, hit })
      if (hit) hits++
    }
  }
  const logged: GameState = { ...state, log: [...state.log, { t: 'roll', owner: ctx.defender, rolls, context: 'space cannon offense' }] }
  const graviton = hasTech(state, ctx.defender, 'graviton_laser_system')
  return applyCombatHits(logged, ctx.systemId, ctx.attacker, hits, graviton ? hits : 0)
}

function antiFighterBarrage(state: GameState, ctx: Ctx, seed: number): GameState {
  let next = state
  let salt = 2
  for (const [side, foe] of [[ctx.attacker, ctx.defender], [ctx.defender, ctx.attacker]] as [Owner, Owner][]) {
    const sOwner = statsOwner(next, side)
    const rng = mulberry32(deriveSeed(seed, salt++))
    const rolls: DieRoll[] = []
    let hits = 0
    for (const u of shipsOf(next.systems[ctx.systemId], side)) {
      const afb = unitStats(u.type, sOwner).afb
      if (!afb) continue
      for (const value of rollDice(rng, afb.dice)) {
        const hit = value >= afb.value
        rolls.push({ owner: side, unit: u.type, value, hit })
        if (hit) hits++
      }
    }
    if (!rolls.length) continue
    next = { ...next, log: [...next.log, { t: 'roll', owner: side, rolls, context: 'anti-fighter barrage' }] }
    next = destroyUnits(next, ctx.systemId, shipsOf(next.systems[ctx.systemId], foe).filter(u => u.type === 'fighter').slice(0, hits))
  }
  return next
}

function assaultCannon(state: GameState, ctx: Ctx): GameState {
  let next = state
  for (const [side, foe] of [[ctx.attacker, ctx.defender], [ctx.defender, ctx.attacker]] as [Owner, Owner][]) {
    if (!hasTech(next, side, 'assault_cannon')) continue
    const sys = next.systems[ctx.systemId]
    if (shipsOf(sys, side).filter(u => NON_FIGHTER_SHIPS.includes(u.type)).length < 3) continue
    const victim = DESTROY_ORDER.filter(t => t !== 'fighter').flatMap(t => shipsOf(sys, foe).filter(u => u.type === t))[0]
    if (!victim) continue
    next = destroyUnits(next, ctx.systemId, [victim])
    next = { ...next, log: [...next.log, { t: 'info', text: `Assault Cannon destroys a ${victim.type}` }] }
  }
  return next
}

function markMandate(state: GameState, ctx: Ctx): GameState {
  if (ctx.systemId !== MECATOL_ID && systemDef(ctx.systemId).home !== otherSeat(ctx.attacker)) return state
  const players = [...state.players] as GameState['players']
  players[ctx.attacker] = { ...players[ctx.attacker], mandateEarnedThisRound: true }
  return { ...state, players, log: [...state.log, { t: 'info', text: `R7 Mandate First Strike earned by seat ${ctx.attacker}` }] }
}

/** R4.1 step 6: only when the combat is over is cargo above the remaining capacity destroyed. */
function endCombat(state: GameState, ctx: Ctx): GameState {
  return trimCargo(trimCargo(state, ctx.systemId, ctx.attacker), ctx.systemId, ctx.defender)
}

/** R4.1 step 5: the announced retreat happens after the round has been fought. */
function withdraw(state: GameState, ctx: Ctx, to: string): GameState {
  const tac = state.tactical
  if (!tac || !tac.combat) return state
  const sys = state.systems[ctx.systemId]
  const dest = state.systems[to]
  const leaving = sys.space.filter(u => u.owner === ctx.attacker)
  const next: GameState = {
    ...state,
    systems: {
      ...state.systems,
      [ctx.systemId]: { ...sys, space: sys.space.filter(u => u.owner !== ctx.attacker) },
      [to]: { ...dest, space: [...dest.space, ...leaving] },
    },
    tactical: { ...tac, step: 'done' },
    log: [...state.log, { t: 'info', text: `seat ${ctx.attacker} retreats from ${ctx.systemId} to ${to}` }],
  }
  return trimCargo(trimCargo(next, to, ctx.attacker), ctx.systemId, ctx.defender)
}

function finish(state: GameState, ctx: Ctx, rolls: DieRoll[]): GameState {
  const tac = state.tactical
  if (!tac || !tac.combat) return state
  const sys = state.systems[ctx.systemId]
  const attackerShips = shipsOf(sys, ctx.attacker).length
  const defenderShips = shipsOf(sys, ctx.defender).length
  const combat = { ...tac.combat, round: ctx.round + 1, lastRolls: rolls }
  if (!attackerShips) return endCombat({ ...state, tactical: { ...tac, step: 'done', combat } }, ctx)
  if (!defenderShips) {
    let won = markMandate(state, ctx)
    won = { ...won, log: [...won.log, { t: 'info', text: `space combat in ${ctx.systemId} won by seat ${ctx.attacker}` }] }
    return endCombat({ ...won, tactical: { ...tac, step: 'invasion', combat, invasion: { planetId: null, landed: [], bombarded: [] } } }, ctx)
  }
  if (combat.retreating === ctx.attacker && combat.retreatTo) return withdraw({ ...state, tactical: { ...tac, combat } }, ctx, combat.retreatTo)
  return { ...state, tactical: { ...tac, combat } }
}

export function combatRound(state: GameState, munitions: boolean, seed: number): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'spaceCombat' || !tac.combat) return { ok: false, error: 'not in a space combat' }
  const ctx: Ctx = { systemId: tac.systemId, attacker: tac.combat.attacker, defender: tac.combat.defender, round: tac.combat.round }
  const sys = state.systems[ctx.systemId]
  if (!shipsOf(sys, ctx.attacker).length || !shipsOf(sys, ctx.defender).length) return { ok: false, error: 'the space combat is already decided' }
  if (ctx.round === 0) {
    const pre = antiFighterBarrage(spaceCannonOffense(assaultCannon(state, ctx), ctx, seed), ctx, seed)
    return { ok: true, value: finish(pre, ctx, []) }
  }
  const users = [ctx.attacker, ctx.defender].filter(o => munitions && canMunitions(state, o))
  if (munitions && !users.length) return { ok: false, error: 'R4.1: Munitions Reserves is not available' }
  const nebula = systemDef(ctx.systemId).anomaly === 'nebula' ? 1 : 0
  const salt = ctx.round * 4
  const a = combatRolls(state, ctx, ctx.attacker, 0, users.includes(ctx.attacker), seed, salt + 10)
  const d = combatRolls(state, ctx, ctx.defender, nebula, users.includes(ctx.defender), seed, salt + 11)
  let next = state
  for (const o of users) next = payMunitions(next, o)
  next = { ...next, log: [...next.log,
    { t: 'roll', owner: ctx.attacker, rolls: a.rolls, context: `space combat round ${ctx.round}` },
    { t: 'roll', owner: ctx.defender, rolls: d.rolls, context: `space combat round ${ctx.round}` }] }
  next = applyCombatHits(next, ctx.systemId, ctx.defender, a.hits, a.restricted)
  next = applyCombatHits(next, ctx.systemId, ctx.attacker, d.hits, d.restricted)
  return { ok: true, value: finish(next, ctx, [...a.rolls, ...d.rolls]) }
}

/** R4.1 step 5: adjacent systems with own units or an own command token and no enemy ships. */
export function retreatTargets(state: GameState, seat: Seat): string[] {
  const tac = state.tactical
  if (!tac) return []
  return neighbours(tac.systemId).filter(id => {
    const sys = state.systems[id]
    if (sys.space.some(u => u.owner !== seat && isShip(u.type))) return false
    return sys.activatedBy.includes(seat)
      || sys.space.some(u => u.owner === seat)
      || sys.planets.some(p => p.owner === seat || p.ground.some(u => u.owner === seat))
  })
}

/** R4.1 step 5: announcement only; `combatRound` fights the round and then carries it out. */
export function retreat(state: GameState, to: string): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'spaceCombat' || !tac.combat) return { ok: false, error: 'not in a space combat' }
  const seat = state.active
  if (seat !== tac.combat.attacker) return { ok: false, error: 'R4.1: only the attacker may retreat' }
  if (tac.combat.round < 2) return { ok: false, error: 'R4.1: a retreat can only be announced before a round after the first' }
  if (tac.combat.retreating !== null) return { ok: false, error: 'a retreat is already announced' }
  if (!retreatTargets(state, seat).includes(to)) return { ok: false, error: `cannot retreat to ${to}` }
  return {
    ok: true,
    value: {
      ...state,
      tactical: { ...tac, combat: { ...tac.combat, retreating: seat, retreatTo: to } },
      log: [...state.log, { t: 'info', text: `seat ${seat} announces a retreat to ${to}` }],
    },
  }
}
```

- [ ] **Step 5: Wire the dispatcher**

In `src/engine/index.ts` add `import { combatRound, retreat } from './combat'`, remove the `void seed` line and add:

```ts
    case 'combatRound': result = combatRound(state, move.munitions ?? false, seed); break
    case 'retreat': result = retreat(state, move.to); break
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/engine/combat.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 7: Type-check and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/combat.ts src/engine/combat.test.ts src/engine/index.ts
git commit -m "feat(engine): space combat with pre-combat steps, hit assignment, abilities and retreat"
```

---

### Task 4: Invasion

**Files:**
- Create: `src/engine/invasion.ts`
- Modify: `src/engine/index.ts` (cases `bombard`, `land`, `groundCombatRound`, `endInvasion`)
- Test: `src/engine/invasion.test.ts`

**Interfaces:**
- Produces in `invasion.ts`:
  ```ts
  export function bombardablePlanets(state: GameState, seat: Seat): string[]
  export function landablePlanets(state: GameState, seat: Seat): { planetId: string; infantryIds: number[] }[]
  export function groundCombatPending(state: GameState, seat: Seat): boolean
  export function bombard(state: GameState, planetId: string, seed: number): Result<GameState>
  export function land(state: GameState, planetId: string, infantryIds: number[], seed: number): Result<GameState>
  export function groundCombatRound(state: GameState, seed: number): Result<GameState>
  export function endInvasion(state: GameState): Result<GameState>
  ```
  R4.3: bombardment rolls every ship of the seat with `bombardment` in the system, Plasma Scoring adds one die to one of them, and it is blocked by an enemy planetary shield unless the seat's Letnev flagship (Arc Secundus) is in the system; `l4_disruptors` does **not** help here, it only negates SPACE CANNON during the invasion (R4.3 step 3, printed card text). Each planet may be bombarded once per invasion. Landing takes infantry out of the system's `space` array, lets the planet's enemy PDS fire (hit 6+, Plasma Scoring extra die) unless the seat has `l4_disruptors`, and puts the survivors on the planet. Ground combat rolls both sides simultaneously (infantry 8, Infantry II 7); Harrow lets L1Z1X bombard again after each round. Control changes when the seat has ground forces on the planet and no defender is left: owner becomes the seat, the planet is exhausted, structures are destroyed, and L1Z1X (Assimilate) replaces them from its own reinforcements. `endInvasion` goes to `'production'` when the seat owns a space dock in the system, otherwise to `'done'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/invasion.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { createGame } from './setup'
import { deepFreeze } from './testUtils'
import type { GameConfig, GameState, Owner, Seat, StrategyCardId, UnitType } from './types'

const config: GameConfig = { players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }], speaker: 0 }

function toActionPhase(seed = 1): GameState {
  let s = createGame(config, seed)
  for (const card of ['warfare', 'leadership', 'imperial', 'technology'] as StrategyCardId[]) {
    const r = applyMove(s, { type: 'pickStrategyCard', card }, 0)
    if (!r.ok) throw new Error(r.error)
    s = r.value
  }
  return s
}

function withUnits(state: GameState, systemId: string, owner: Owner, types: UnitType[], planetId?: string): GameState {
  let next = state.nextUnitId
  const sys = state.systems[systemId]
  const made = types.map(type => ({ id: next++, type, owner, damaged: false }))
  const players = [...state.players] as GameState['players']
  if (owner !== 'guardian') {
    const p = players[owner]
    const reinforcements = { ...p.reinforcements }
    for (const t of types) reinforcements[t] = Math.max(0, reinforcements[t] - 1)
    players[owner] = { ...p, reinforcements }
  }
  const planets = sys.planets.map(p => p.id !== planetId ? p : {
    ...p,
    ground: [...p.ground, ...made.filter(u => u.type === 'infantry')],
    structures: [...p.structures, ...made.filter(u => u.type !== 'infantry')],
  })
  return {
    ...state, players, nextUnitId: next,
    systems: { ...state.systems, [systemId]: { ...sys, space: planetId ? sys.space : [...sys.space, ...made], planets } },
  }
}

function withTechs(state: GameState, seat: Seat, techs: string[]): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], techs: [...players[seat].techs, ...techs] }
  return { ...state, players }
}

/** An invasion of `systemId` by seat 0 with the given ships and carried infantry in space. */
function invasion(systemId: string, ships: UnitType[], carried: number, seat: Seat = 0): GameState {
  const base = toActionPhase()
  const cleared: GameState = { ...base, systems: { ...base.systems, [systemId]: { ...base.systems[systemId], space: [] } } }
  const troops: UnitType[] = Array.from({ length: carried }, () => 'infantry')
  const s = withUnits(cleared, systemId, seat, [...ships, ...troops])
  return { ...s, active: seat, tactical: { systemId, step: 'invasion', invasion: { planetId: null, landed: [], bombarded: [] } } }
}

const carriedIds = (state: GameState, systemId: string, seat: Seat) =>
  state.systems[systemId].space.filter(u => u.owner === seat && u.type === 'infantry').map(u => u.id)

const planet = (state: GameState, systemId: string, planetId: string) => {
  const p = state.systems[systemId].planets.find(x => x.id === planetId)
  if (!p) throw new Error(`no planet ${planetId}`)
  return p
}

const hitsIn = (state: GameState, context: string) =>
  state.log.flatMap(e => e.t === 'roll' && e.context === context ? e.rolls : []).filter(r => r.hit).length

const apply = (state: GameState, move: Parameters<typeof applyMove>[1], seed = 5) => {
  const r = applyMove(deepFreeze(state), move, seed)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('R4.3 invasion', () => {
  it('R4.3 step 1: bombardment destroys ground forces and each planet is bombarded once', () => {
    const s = withUnits(invasion('bereg', ['dreadnought'], 0), 'bereg', 1, ['infantry', 'infantry', 'infantry'], 'bereg')
    const after = apply(s, { type: 'bombard', planetId: 'bereg' })
    const hits = hitsIn(after, 'bombardment of bereg')
    expect(planet(after, 'bereg', 'bereg').ground).toHaveLength(3 - hits)
    expect(after.tactical?.invasion?.bombarded).toEqual(['bereg'])
    expect(applyMove(after, { type: 'bombard', planetId: 'bereg' }, 5).ok).toBe(false)
  })
  it('R4.3 step 1: a planetary shield blocks the bombardment, L4 Disruptors do not help, Arc Secundus does', () => {
    const base = withUnits(invasion('bereg', ['dreadnought'], 0), 'bereg', 1, ['infantry'], 'bereg')
    const shielded = withUnits(base, 'bereg', 1, ['pds'], 'bereg')
    expect(applyMove(shielded, { type: 'bombard', planetId: 'bereg' }, 5).ok).toBe(false)
    const letnev = withUnits(withUnits(invasion('bereg', ['dreadnought'], 0, 1), 'bereg', 0, ['infantry'], 'bereg'), 'bereg', 0, ['pds'], 'bereg')
    expect(applyMove(withTechs(letnev, 1, ['l4_disruptors']), { type: 'bombard', planetId: 'bereg' }, 5).ok).toBe(false)
    const arcSecundus = withUnits(withUnits(invasion('bereg', ['flagship'], 0, 1), 'bereg', 0, ['infantry'], 'bereg'), 'bereg', 0, ['pds'], 'bereg')
    expect(applyMove(arcSecundus, { type: 'bombard', planetId: 'bereg' }, 5).ok).toBe(true)
  })
  it('R4.3 step 1: Plasma Scoring adds one bombardment die', () => {
    const s = withUnits(invasion('bereg', ['dreadnought'], 0), 'bereg', 1, ['infantry', 'infantry'], 'bereg')
    const after = apply(s, { type: 'bombard', planetId: 'bereg' })
    const rolls = after.log.flatMap(e => e.t === 'roll' && e.context === 'bombardment of bereg' ? e.rolls : [])
    expect(rolls).toHaveLength(2)   // dreadnought 1 die plus the Plasma Scoring die
  })
  it('R4.3 step 2 and 3: landing infantry are shot at by the PDS on the planet unless L4 Disruptors', () => {
    const base = withUnits(invasion('bereg', ['carrier'], 3), 'bereg', 1, ['pds'], 'bereg')
    const after = apply(base, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(base, 'bereg', 0) })
    const hits = hitsIn(after, 'space cannon defense on bereg')
    expect(planet(after, 'bereg', 'bereg').ground.filter(u => u.owner === 0)).toHaveLength(3 - hits)
    expect(after.systems.bereg.space.filter(u => u.type === 'infantry')).toHaveLength(0)
    const letnev = withTechs(withUnits(invasion('bereg', ['carrier'], 3, 1), 'bereg', 0, ['pds'], 'bereg'), 1, ['l4_disruptors'])
    const safe = apply(letnev, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(letnev, 'bereg', 1) })
    expect(planet(safe, 'bereg', 'bereg').ground.filter(u => u.owner === 1)).toHaveLength(3)
    expect(safe.log.some(e => e.t === 'roll' && e.context === 'space cannon defense on bereg')).toBe(false)
  })
  it('R4.3 step 4: ground combat rolls both sides until one is gone', () => {
    const base = withUnits(invasion('bereg', ['carrier'], 2), 'bereg', 1, ['infantry', 'infantry'], 'bereg')
    let s = apply(base, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(base, 'bereg', 0) })
    expect(s.tactical?.invasion?.planetId).toBe('bereg')
    for (let i = 0; i < 30; i++) {
      const p = planet(s, 'bereg', 'bereg')
      if (!p.ground.some(u => u.owner === 0) || !p.ground.some(u => u.owner === 1)) break
      s = apply(s, { type: 'groundCombatRound' }, 20 + i)
    }
    const ground = planet(s, 'bereg', 'bereg').ground
    expect(ground.some(u => u.owner === 0) && ground.some(u => u.owner === 1)).toBe(false)
    expect(s.log.some(e => e.t === 'roll' && e.context === 'ground combat on bereg')).toBe(true)
  })
  it('R4.3 step 5: control changes, the planet is exhausted and structures are destroyed', () => {
    const owned: GameState = (() => {
      const s = withUnits(invasion('bereg', ['carrier'], 2), 'bereg', 1, ['spacedock'], 'bereg')
      return { ...s, systems: { ...s.systems, bereg: { ...s.systems.bereg, planets: s.systems.bereg.planets.map(p => p.id === 'bereg' ? { ...p, owner: 1 as Seat } : p) } } }
    })()
    const letnevSeat = { ...owned, players: [owned.players[0], owned.players[1]] as GameState['players'] }
    const after = apply(letnevSeat, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(letnevSeat, 'bereg', 0) })
    const p = planet(after, 'bereg', 'bereg')
    expect(p.owner).toBe(0)
    expect(p.exhausted).toBe(true)
    expect(p.structures.map(u => u.type)).toEqual(['spacedock'])       // L1Z1X Assimilate keeps a dock of its own
    expect(p.structures.every(u => u.owner === 0)).toBe(true)
    expect(after.players[1].reinforcements.spacedock).toBe(letnevSeat.players[1].reinforcements.spacedock + 1)
  })
  it('R4.3 step 5: without Assimilate the structures are simply destroyed', () => {
    const s = withUnits(invasion('bereg', ['carrier'], 2, 1), 'bereg', 0, ['spacedock'], 'bereg')
    const owned: GameState = { ...s, systems: { ...s.systems, bereg: { ...s.systems.bereg, planets: s.systems.bereg.planets.map(p => p.id === 'bereg' ? { ...p, owner: 0 as Seat } : p) } } }
    const after = apply(owned, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(owned, 'bereg', 1) })
    const p = planet(after, 'bereg', 'bereg')
    expect(p.owner).toBe(1)
    expect(p.structures).toEqual([])
    expect(after.players[0].reinforcements.spacedock).toBe(owned.players[0].reinforcements.spacedock + 1)
  })
  it('R4.2 guardian infantry on Mecatol Rex defend normally', () => {
    const base = invasion('mecatol', ['carrier'], 3)
    let s = apply(base, { type: 'land', planetId: 'mecatol-rex', infantryIds: carriedIds(base, 'mecatol', 0) })
    expect(planet(s, 'mecatol', 'mecatol-rex').ground.filter(u => u.owner === 'guardian')).toHaveLength(2)
    for (let i = 0; i < 30; i++) {
      const p = planet(s, 'mecatol', 'mecatol-rex')
      if (!p.ground.some(u => u.owner === 0) || !p.ground.some(u => u.owner === 'guardian')) break
      s = apply(s, { type: 'groundCombatRound' }, 40 + i)
    }
    const p = planet(s, 'mecatol', 'mecatol-rex')
    if (p.ground.some(u => u.owner === 0)) expect(p.owner).toBe(0)
    else expect(p.owner).toBeNull()
  })
  it('HARROW: L1Z1X bombards again after each ground combat round', () => {
    const base = withUnits(invasion('bereg', ['carrier', 'dreadnought'], 2), 'bereg', 1, ['infantry', 'infantry', 'infantry', 'infantry'], 'bereg')
    const landed = apply(base, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(base, 'bereg', 0) })
    const after = apply(landed, { type: 'groundCombatRound' }, 11)
    expect(after.log.some(e => e.t === 'roll' && e.context === 'Harrow bombardment of bereg')).toBe(true)
  })
  it('endInvasion goes to the production step with an own space dock, otherwise straight to done', () => {
    const plain = invasion('bereg', ['carrier'], 0)
    expect(apply(plain, { type: 'endInvasion' }).tactical?.step).toBe('done')
    const withDock = withUnits(plain, 'bereg', 0, ['spacedock'], 'bereg')
    expect(apply(withDock, { type: 'endInvasion' }).tactical?.step).toBe('production')
  })
  it('endInvasion is rejected while a ground combat is unresolved', () => {
    const base = withUnits(invasion('bereg', ['carrier'], 2), 'bereg', 1, ['infantry', 'infantry', 'infantry', 'infantry', 'infantry'], 'bereg')
    const landed = apply(base, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(base, 'bereg', 0) })
    const p = planet(landed, 'bereg', 'bereg')
    if (p.ground.some(u => u.owner === 0)) expect(applyMove(landed, { type: 'endInvasion' }, 0).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/engine/invasion.test.ts`
Expected: FAIL, `Cannot find module './invasion'`.

- [ ] **Step 3: Implement the invasion**

```ts
// src/engine/invasion.ts
import { isShip, unitStats } from '../data/units'
import { destroyUnits, hasTech, removeUnits, statsOwner } from './board'
import { deriveSeed, mulberry32, rollDice } from './rng'
import type { DieRoll, GameState, Owner, Planet, Result, Seat, Unit } from './types'

function planetOf(state: GameState, systemId: string, planetId: string): Planet | undefined {
  return state.systems[systemId].planets.find(p => p.id === planetId)
}

/** R4.3 step 1: an enemy planetary shield blocks bombardment unless Arc Secundus is in the system. */
function shieldBlocks(state: GameState, systemId: string, planetId: string, seat: Seat): boolean {
  const planet = planetOf(state, systemId, planetId)
  if (!planet) return true
  const shielded = planet.structures.some(u => u.owner !== seat && unitStats(u.type, statsOwner(state, u.owner)).planetaryShield)
  if (!shielded) return false
  const arcSecundus = state.players[seat].faction === 'letnev'
    && state.systems[systemId].space.some(u => u.owner === seat && u.type === 'flagship')
  return !arcSecundus
}

function bombardment(state: GameState, systemId: string, planetId: string, seat: Seat, seed: number, salt: number, context: string): GameState {
  const sOwner = statsOwner(state, seat)
  const ships = state.systems[systemId].space.filter(u => u.owner === seat && isShip(u.type) && unitStats(u.type, sOwner).bombardment)
  if (!ships.length) return state
  const rng = mulberry32(deriveSeed(seed, salt))
  const rolls: DieRoll[] = []
  let extra = state.players[seat].techs.includes('plasma_scoring') ? 1 : 0
  let hits = 0
  for (const u of ships) {
    const b = unitStats(u.type, sOwner).bombardment
    if (!b) continue
    const dice = b.dice + extra
    extra = 0
    for (const value of rollDice(rng, dice)) {
      const hit = value >= b.value
      rolls.push({ owner: seat, unit: u.type, value, hit })
      if (hit) hits++
    }
  }
  const logged: GameState = { ...state, log: [...state.log, { t: 'roll', owner: seat, rolls, context }] }
  const planet = planetOf(logged, systemId, planetId)
  if (!planet) return logged
  return destroyUnits(logged, systemId, planet.ground.filter(u => u.owner !== seat).slice(0, hits))
}

export function bombardablePlanets(state: GameState, seat: Seat): string[] {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion) return []
  const sOwner = statsOwner(state, seat)
  if (!state.systems[tac.systemId].space.some(u => u.owner === seat && unitStats(u.type, sOwner).bombardment)) return []
  const done = tac.invasion.bombarded
  return state.systems[tac.systemId].planets
    .filter(p => !done.includes(p.id) && p.ground.some(u => u.owner !== seat) && !shieldBlocks(state, tac.systemId, p.id, seat))
    .map(p => p.id)
}

export function landablePlanets(state: GameState, seat: Seat): { planetId: string; infantryIds: number[] }[] {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion) return []
  const infantryIds = state.systems[tac.systemId].space.filter(u => u.owner === seat && u.type === 'infantry').map(u => u.id)
  if (!infantryIds.length) return []
  const busy = tac.invasion.planetId
  return state.systems[tac.systemId].planets
    .filter(p => !busy || p.id === busy || !p.ground.some(u => u.owner !== seat))
    .map(p => ({ planetId: p.id, infantryIds }))
}

export function groundCombatPending(state: GameState, seat: Seat): boolean {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion || !tac.invasion.planetId) return false
  const planet = planetOf(state, tac.systemId, tac.invasion.planetId)
  if (!planet) return false
  return planet.ground.some(u => u.owner === seat) && planet.ground.some(u => u.owner !== seat)
}

/** R4.3 step 5: the attacker takes the planet when no defender is left. */
function resolveControl(state: GameState, systemId: string, planetId: string, seat: Seat): GameState {
  const planet = planetOf(state, systemId, planetId)
  if (!planet || planet.owner === seat) return state
  if (!planet.ground.some(u => u.owner === seat) || planet.ground.some(u => u.owner !== seat)) return state
  const assimilate = state.players[seat].faction === 'l1z1x'
  const players = [...state.players] as GameState['players']
  const replacements: Unit[] = []
  let nextId = state.nextUnitId
  for (const s of planet.structures) {
    if (s.owner !== 'guardian') {
      const loser = players[s.owner]
      players[s.owner] = { ...loser, reinforcements: { ...loser.reinforcements, [s.type]: loser.reinforcements[s.type] + 1 } }
    }
    if (!assimilate) continue
    const me = players[seat]
    if (me.reinforcements[s.type] < 1) continue
    players[seat] = { ...me, reinforcements: { ...me.reinforcements, [s.type]: me.reinforcements[s.type] - 1 } }
    replacements.push({ id: nextId++, type: s.type, owner: seat, damaged: false })
  }
  const sys = state.systems[systemId]
  return {
    ...state, players, nextUnitId: nextId,
    systems: { ...state.systems, [systemId]: { ...sys, planets: sys.planets.map(p => p.id === planetId ? { ...p, owner: seat, exhausted: true, structures: replacements } : p) } },
    log: [...state.log, { t: 'info', text: `seat ${seat} takes control of ${planetId}` }],
  }
}

export function bombard(state: GameState, planetId: string, seed: number): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion) return { ok: false, error: 'not in the invasion step' }
  const seat = state.active
  const planet = planetOf(state, tac.systemId, planetId)
  if (!planet) return { ok: false, error: `planet ${planetId} is not in the active system` }
  if (tac.invasion.bombarded.includes(planetId)) return { ok: false, error: `${planetId} was already bombarded` }
  if (!planet.ground.some(u => u.owner !== seat)) return { ok: false, error: 'no ground forces to bombard' }
  if (shieldBlocks(state, tac.systemId, planetId, seat)) return { ok: false, error: 'R4.3: the planetary shield blocks the bombardment' }
  const sOwner = statsOwner(state, seat)
  if (!state.systems[tac.systemId].space.some(u => u.owner === seat && isShip(u.type) && unitStats(u.type, sOwner).bombardment)) {
    return { ok: false, error: 'no unit with BOMBARDMENT in the system' }
  }
  const next = bombardment(state, tac.systemId, planetId, seat, seed, 1, `bombardment of ${planetId}`)
  return { ok: true, value: { ...next, tactical: { ...tac, invasion: { ...tac.invasion, bombarded: [...tac.invasion.bombarded, planetId] } } } }
}

export function land(state: GameState, planetId: string, infantryIds: number[], seed: number): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion) return { ok: false, error: 'not in the invasion step' }
  const seat = state.active
  const sys = state.systems[tac.systemId]
  const planet = planetOf(state, tac.systemId, planetId)
  if (!planet) return { ok: false, error: `planet ${planetId} is not in the active system` }
  if (!infantryIds.length) return { ok: false, error: 'no infantry to land' }
  if (tac.invasion.planetId && tac.invasion.planetId !== planetId && groundCombatPending(state, seat)) {
    return { ok: false, error: 'finish the running ground combat first' }
  }
  const landing: Unit[] = []
  for (const id of infantryIds) {
    const u = sys.space.find(x => x.id === id && x.owner === seat && x.type === 'infantry')
    if (!u || landing.some(l => l.id === id)) return { ok: false, error: `no carried infantry ${id} in the active system` }
    landing.push(u)
  }
  let next = state
  let survivors = landing
  const pds = planet.structures.filter(u => u.owner !== seat && unitStats(u.type, statsOwner(state, u.owner)).spaceCannon)
  if (pds.length && !hasTech(state, seat, 'l4_disruptors')) {
    const defender = pds[0].owner
    const rng = mulberry32(deriveSeed(seed, 2))
    const rolls: DieRoll[] = []
    let extra = hasTech(state, defender, 'plasma_scoring') ? 1 : 0
    let hits = 0
    for (const u of pds) {
      const sc = unitStats(u.type, statsOwner(state, u.owner)).spaceCannon
      if (!sc) continue
      const dice = sc.dice + extra
      extra = 0
      for (const value of rollDice(rng, dice)) {
        const hit = value >= sc.value
        rolls.push({ owner: u.owner, unit: u.type, value, hit })
        if (hit) hits++
      }
    }
    next = { ...next, log: [...next.log, { t: 'roll', owner: defender, rolls, context: `space cannon defense on ${planetId}` }] }
    next = destroyUnits(next, tac.systemId, survivors.slice(0, hits))
    survivors = survivors.slice(hits)
  }
  next = removeUnits(next, tac.systemId, survivors.map(u => u.id))
  const target = next.systems[tac.systemId]
  next = {
    ...next,
    systems: { ...next.systems, [tac.systemId]: { ...target, planets: target.planets.map(p => p.id === planetId ? { ...p, ground: [...p.ground, ...survivors] } : p) } },
    tactical: { ...tac, invasion: { planetId, landed: [...tac.invasion.landed, ...survivors.map(u => u.id)], bombarded: tac.invasion.bombarded } },
  }
  return { ok: true, value: resolveControl(next, tac.systemId, planetId, seat) }
}

function groundRolls(state: GameState, units: Unit[], owner: Owner, seed: number, salt: number): { rolls: DieRoll[]; hits: number } {
  const sOwner = statsOwner(state, owner)
  const rng = mulberry32(deriveSeed(seed, salt))
  const rolls: DieRoll[] = []
  let hits = 0
  for (const u of units) {
    const stats = unitStats(u.type, sOwner)
    if (stats.combat === null) continue
    for (const value of rollDice(rng, stats.combatDice)) {
      const hit = value >= stats.combat
      rolls.push({ owner, unit: u.type, value, hit })
      if (hit) hits++
    }
  }
  return { rolls, hits }
}

export function groundCombatRound(state: GameState, seed: number): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion || !tac.invasion.planetId) return { ok: false, error: 'no ground combat is running' }
  const seat = state.active
  const planetId = tac.invasion.planetId
  const planet = planetOf(state, tac.systemId, planetId)
  if (!planet) return { ok: false, error: `planet ${planetId} is not in the active system` }
  const mine = planet.ground.filter(u => u.owner === seat)
  const foes = planet.ground.filter(u => u.owner !== seat)
  if (!mine.length || !foes.length) return { ok: false, error: 'the ground combat is already decided' }
  const defender = foes[0].owner
  const a = groundRolls(state, mine, seat, seed, 3)
  const d = groundRolls(state, foes, defender, seed, 4)
  let next: GameState = { ...state, log: [...state.log,
    { t: 'roll', owner: seat, rolls: a.rolls, context: `ground combat on ${planetId}` },
    { t: 'roll', owner: defender, rolls: d.rolls, context: `ground combat on ${planetId}` }] }
  next = destroyUnits(next, tac.systemId, foes.slice(0, a.hits))
  next = destroyUnits(next, tac.systemId, mine.slice(0, d.hits))
  const after = planetOf(next, tac.systemId, planetId)
  if (state.players[seat].faction === 'l1z1x' && after && after.ground.some(u => u.owner !== seat) && !shieldBlocks(next, tac.systemId, planetId, seat)) {
    next = bombardment(next, tac.systemId, planetId, seat, seed, 5, `Harrow bombardment of ${planetId}`)
  }
  return { ok: true, value: resolveControl(next, tac.systemId, planetId, seat) }
}

export function endInvasion(state: GameState): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion') return { ok: false, error: 'not in the invasion step' }
  const seat = state.active
  if (groundCombatPending(state, seat)) return { ok: false, error: 'the ground combat is unresolved' }
  const dock = state.systems[tac.systemId].planets.some(p => p.structures.some(u => u.type === 'spacedock' && u.owner === seat))
  return { ok: true, value: { ...state, tactical: { ...tac, step: dock ? 'production' : 'done' } } }
}
```

- [ ] **Step 4: Wire the dispatcher**

In `src/engine/index.ts` add `import { bombard, endInvasion, groundCombatRound, land } from './invasion'` and the cases:

```ts
    case 'bombard': result = bombard(state, move.planetId, seed); break
    case 'land': result = land(state, move.planetId, move.infantryIds, seed); break
    case 'groundCombatRound': result = groundCombatRound(state, seed); break
    case 'endInvasion': result = endInvasion(state); break
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/engine/invasion.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/invasion.ts src/engine/invasion.test.ts src/engine/index.ts
git commit -m "feat(engine): invasion with bombardment, landing, ground combat and control change"
```

---

### Task 5: Production

**Files:**
- Create: `src/engine/production.ts`
- Modify: `src/engine/index.ts` (case `produce`)
- Test: `src/engine/production.test.ts`

**Interfaces:**
- Produces in `production.ts`:
  ```ts
  export const PRODUCIBLE: UnitType[]     // infantry, fighter, destroyer, cruiser, carrier, dreadnought, warsun, flagship
  export function produce(state: GameState, units: Partial<Record<UnitType, number>>, planets: string[], tradeGoods: number): Result<GameState>
  ```
  R4.4: the seat needs its own space dock in the active system; the number of units may not exceed `productionLimit`; PDS and space docks cannot be produced (no Construction in the duel); a War Sun needs the `war_sun` technology; only one flagship per player may exist; reinforcements limit each type; the cost comes from `productionCost` (Sarween Tools included) and is paid with `payCost`; the highest cost of the round is stored in `spentInOneProductionThisRound` (R7 objective 4); ships appear in the system's space, infantry on the dock's planet; `checkFleet` then validates the fleet pool and the fighter capacity (Space Dock II gives 3 free fighter slots). Afterwards the step is `'done'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/production.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { createGame } from './setup'
import { deepFreeze } from './testUtils'
import type { GameConfig, GameState, Seat, StrategyCardId, UnitType } from './types'

const config: GameConfig = { players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }], speaker: 0 }

function toActionPhase(seed = 1): GameState {
  let s = createGame(config, seed)
  for (const card of ['warfare', 'leadership', 'imperial', 'technology'] as StrategyCardId[]) {
    const r = applyMove(s, { type: 'pickStrategyCard', card }, 0)
    if (!r.ok) throw new Error(r.error)
    s = r.value
  }
  return s
}

function withTechs(state: GameState, seat: Seat, techs: string[]): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], techs: [...players[seat].techs, ...techs] }
  return { ...state, players }
}

/** Seat 0 in the production step of its own home system. */
function producing(seed = 1): GameState {
  const base = toActionPhase(seed)
  return { ...base, active: 0, tactical: { systemId: 'home-n', step: 'production', invasion: { planetId: null, landed: [], bombarded: [] } } }
}

const produce = (state: GameState, units: Partial<Record<UnitType, number>>, planets: string[], tradeGoods = 0) =>
  applyMove(deepFreeze(state), { type: 'produce', units, planets, tradeGoods }, 0)

describe('R4.4 production', () => {
  it('produces ships into the space and infantry onto the dock planet, then finishes the step', () => {
    const s = producing()
    const r = produce(s, { cruiser: 1, infantry: 2 }, ['000'])
    if (!r.ok) throw new Error(r.error)
    expect(r.value.systems['home-n'].space.filter(u => u.type === 'cruiser' && u.owner === 0)).toHaveLength(1)
    expect(r.value.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(7)
    expect(r.value.systems['home-n'].planets[0].exhausted).toBe(true)
    expect(r.value.players[0].reinforcements.cruiser).toBe(s.players[0].reinforcements.cruiser - 1)
    expect(r.value.tactical?.step).toBe('done')
    const ids = r.value.systems['home-n'].space.map(u => u.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('R4.4: the production limit is the planet resources plus the dock bonus', () => {
    const s = producing()
    expect(produce(s, { infantry: 8 }, ['000']).ok).toBe(false)     // limit 7
    expect(produce(s, { infantry: 6, fighter: 1 }, ['000']).ok).toBe(true)
  })
  it('R4.4: fighters and infantry come in pairs and Sarween Tools takes one off the total', () => {
    const s = producing()
    expect(produce(s, { fighter: 2, infantry: 2 }, []).ok).toBe(false)   // cost 2, nothing paid
    const paid = produce(s, { fighter: 2, infantry: 2 }, ['000'])
    expect(paid.ok).toBe(true)
    const sarween = withTechs(s, 0, ['sarween_tools'])
    const free = produce(sarween, { infantry: 2 }, [])
    expect(free.ok).toBe(true)                                          // cost 1 minus 1
  })
  it('R4.4: a War Sun needs the technology and only one flagship may exist', () => {
    const rich: GameState = (() => {
      const s = producing()
      return { ...s, players: [{ ...s.players[0], tradeGoods: 20 }, s.players[1]] }
    })()
    expect(produce(rich, { warsun: 1 }, [], 12).ok).toBe(false)
    expect(produce(withTechs(rich, 0, ['war_sun']), { warsun: 1 }, [], 12).ok).toBe(false)   // limit 7 units is fine, fleet pool is not
    expect(produce(rich, { flagship: 1 }, [], 8).ok).toBe(true)
    expect(produce(rich, { flagship: 2 }, [], 16).ok).toBe(false)
  })
  it('R4.4: reinforcements and the fleet pool limit the production', () => {
    const s = producing()
    const empty: GameState = { ...s, players: [{ ...s.players[0], reinforcements: { ...s.players[0].reinforcements, cruiser: 0 }, tradeGoods: 10 }, s.players[1]] }
    expect(produce(empty, { cruiser: 1 }, [], 2).ok).toBe(false)
    const rich: GameState = { ...s, players: [{ ...s.players[0], tradeGoods: 10 }, s.players[1]] }
    expect(produce(rich, { cruiser: 2 }, [], 4).ok).toBe(false)   // 2 in the system plus 2 is over the fleet pool of 3
    expect(produce(rich, { cruiser: 1 }, [], 2).ok).toBe(true)
  })
  it('R4.4: fighters need capacity, Space Dock II adds three free slots', () => {
    const rich: GameState = (() => {
      const s = producing()
      return { ...s, players: [{ ...s.players[0], tradeGoods: 10 }, s.players[1]] }
    })()
    expect(produce(rich, { fighter: 6 }, [], 3).ok).toBe(false)   // capacity 6, three fighters already there
    expect(produce(withTechs(rich, 0, ['space_dock_ii']), { fighter: 6 }, [], 3).ok).toBe(true)
  })
  it('R4.4: PDS and space docks cannot be produced in the duel', () => {
    const s = producing()
    expect(produce(s, { pds: 1 }, ['000']).ok).toBe(false)
    expect(produce(s, { spacedock: 1 }, ['000']).ok).toBe(false)
  })
  it('R7 objective 4: the highest spend of the round is recorded', () => {
    const s = producing()
    const first = produce(s, { infantry: 2 }, ['000'])
    if (!first.ok) throw new Error(first.error)
    expect(first.value.players[0].spentInOneProductionThisRound).toBe(1)
    const again: GameState = { ...first.value, tactical: { systemId: 'home-n', step: 'production' } }
    const second = produce({ ...again, players: [{ ...again.players[0], tradeGoods: 6 }, again.players[1]] }, { dreadnought: 1, cruiser: 1 }, [], 6)
    if (!second.ok) throw new Error(second.error)
    expect(second.value.players[0].spentInOneProductionThisRound).toBe(6)
  })
  it('production needs a space dock of your own in the active system', () => {
    const s = producing()
    const elsewhere: GameState = { ...s, tactical: { systemId: 'bereg', step: 'production' } }
    expect(produce(elsewhere, { infantry: 2 }, ['000']).ok).toBe(false)
    expect(applyMove({ ...s, tactical: { systemId: 'home-n', step: 'movement' } }, { type: 'produce', units: { infantry: 2 }, planets: ['000'], tradeGoods: 0 }, 0).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/engine/production.test.ts`
Expected: FAIL, `Cannot find module './production'`.

- [ ] **Step 3: Implement production**

```ts
// src/engine/production.ts
import type { StatsOwner } from '../data/units'
import { checkFleet } from './board'
import { payCost, productionCost, productionLimit } from './economy'
import { unitsOf } from './setup'
import type { GameState, Result, Unit, UnitType } from './types'

export const PRODUCIBLE: UnitType[] = ['infantry', 'fighter', 'destroyer', 'cruiser', 'carrier', 'dreadnought', 'warsun', 'flagship']

export function produce(state: GameState, units: Partial<Record<UnitType, number>>, planets: string[], tradeGoods: number): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'production') return { ok: false, error: 'not in the production step' }
  const seat = state.active
  const player = state.players[seat]
  const dockPlanet = state.systems[tac.systemId].planets.find(p => p.structures.some(u => u.type === 'spacedock' && u.owner === seat))
  if (!dockPlanet) return { ok: false, error: 'R4.4: no space dock of your own in the active system' }
  const entries = (Object.entries(units) as [UnitType, number][]).filter(([, n]) => n !== 0)
  if (!entries.length) return { ok: false, error: 'nothing to produce' }
  let total = 0
  for (const [type, n] of entries) {
    if (n < 0 || !Number.isInteger(n)) return { ok: false, error: `invalid count for ${type}` }
    if (!PRODUCIBLE.includes(type)) return { ok: false, error: `R4.4: ${type} cannot be produced` }
    if (type === 'warsun' && !player.techs.includes('war_sun')) return { ok: false, error: 'R4.4: a War Sun needs the War Sun technology' }
    if (player.reinforcements[type] < n) return { ok: false, error: `not enough ${type} in the reinforcements` }
    total += n
  }
  const flagships = units.flagship ?? 0
  if (flagships > 1 || (flagships === 1 && unitsOf(state, seat).some(u => u.type === 'flagship'))) {
    return { ok: false, error: 'R4.4: only one flagship at a time' }
  }
  const limit = productionLimit(state, seat, tac.systemId)
  if (total > limit) return { ok: false, error: `R4.4: production limit ${limit} exceeded by ${total} units` }
  const owner: StatsOwner = { faction: player.faction, techs: player.techs }
  const cost = productionCost(units, owner, player.techs.includes('sarween_tools'))
  const paid = payCost(state, seat, cost, planets, tradeGoods)
  if (!paid.ok) return paid
  let nextId = paid.value.nextUnitId
  const ships: Unit[] = []
  const ground: Unit[] = []
  const players = [...paid.value.players] as GameState['players']
  let me = players[seat]
  for (const [type, n] of entries) {
    for (let i = 0; i < n; i++) {
      const unit: Unit = { id: nextId++, type, owner: seat, damaged: false }
      if (type === 'infantry') ground.push(unit); else ships.push(unit)
    }
    me = { ...me, reinforcements: { ...me.reinforcements, [type]: me.reinforcements[type] - n } }
  }
  players[seat] = { ...me, spentInOneProductionThisRound: Math.max(me.spentInOneProductionThisRound, cost) }
  const sys = paid.value.systems[tac.systemId]
  const next: GameState = {
    ...paid.value, players, nextUnitId: nextId,
    systems: {
      ...paid.value.systems,
      [tac.systemId]: {
        ...sys,
        space: [...sys.space, ...ships],
        planets: sys.planets.map(p => p.id === dockPlanet.id ? { ...p, ground: [...p.ground, ...ground] } : p),
      },
    },
    log: [...paid.value.log, { t: 'info', text: `seat ${seat} produces ${total} units for ${cost}` }],
  }
  const fleet = checkFleet(next, seat, tac.systemId)
  if (!fleet.ok) return { ok: false, error: fleet.error }
  return { ok: true, value: { ...next, tactical: { ...tac, step: 'done' } } }
}
```

- [ ] **Step 4: Wire the dispatcher**

In `src/engine/index.ts` add `import { produce } from './production'` and the case:

```ts
    case 'produce': result = produce(state, move.units, move.planets, move.tradeGoods); break
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/engine/production.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/production.ts src/engine/production.test.ts src/engine/index.ts
git commit -m "feat(engine): production with cost, limits, fleet pool and capacity checks"
```

---

### Task 6: Legal move enumeration and seeded smoke test

**Files:**
- Modify: `src/engine/legalMoves.ts` (all tactical steps, template kinds)
- Test: `src/engine/tacticalFlow.test.ts`

**Interfaces:**
- `legalMoves` now enumerates for every tactical step. Three move kinds are **templates**, because the UI fills in their parameters: `moveShips` (`moves: []`), `produce` (`units: {}, planets: [], tradeGoods: 0`) and `land` (pre-filled with every carried infantry, but any subset is legal). `validateMove` matches these by `move.type` only; all other kinds are matched structurally as before.
  ```ts
  export const TEMPLATE_KINDS: Move['type'][]   // 'moveShips' | 'produce' | 'land'
  export function legalMoves(state: GameState): Move[]
  export function validateMove(state: GameState, move: Move): Result<true>
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/tacticalFlow.test.ts
import { describe, expect, it } from 'vitest'
import { NON_FIGHTER_SHIPS, unitStats } from '../data/units'
import { capacity, fleetPoolLimit, productionCost } from './economy'
import { applyMove, legalMoves, validateMove } from './index'
import { movableShips } from './movement'
import { createGame, unitsOf } from './setup'
import { deepFreeze } from './testUtils'
import type { GameConfig, GameState, Move, Seat, StrategyCardId } from './types'

const config: GameConfig = { players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }], speaker: 0 }

function draft(state: GameState): GameState {
  let s = state
  while (s.phase === 'strategy') {
    const moves = legalMoves(s)
    const r = applyMove(s, moves[0], 0)
    if (!r.ok) throw new Error(r.error)
    s = r.value
  }
  return s
}

/** Plan 2 has no strategic actions yet, so the cards are marked used to make passing legal. */
function cardsUsed(state: GameState): GameState {
  return { ...state, players: state.players.map(p => ({ ...p, strategyCards: p.strategyCards.map(c => ({ ...c, used: true })) })) as GameState['players'] }
}

/** Starts the next action round: tokens back, planets ready, tokens off the map. */
function nextRound(state: GameState): GameState {
  const systems = Object.fromEntries(Object.entries(state.systems).map(([id, sys]) => [id, {
    ...sys, activatedBy: [], planets: sys.planets.map(p => ({ ...p, exhausted: false })),
  }]))
  const players = state.players.map(p => ({
    ...p, passed: false, tokens: { ...p.tokens, tactic: 3 }, strategyCards: p.strategyCards.map(c => ({ ...c, used: true })),
  })) as GameState['players']
  return { ...state, phase: 'action', round: state.round + 1, players, systems, tactical: null, active: state.speaker }
}

function invariants(state: GameState): void {
  const units = [...unitsOf(state, 0), ...unitsOf(state, 1), ...unitsOf(state, 'guardian')]
  expect(new Set(units.map(u => u.id)).size).toBe(units.length)
  for (const u of units) expect([0, 1, 'guardian']).toContain(u.owner)
  for (const p of state.players) {
    expect(p.tradeGoods).toBeGreaterThanOrEqual(0)
    expect(Math.min(p.tokens.tactic, p.tokens.fleet, p.tokens.strategy)).toBeGreaterThanOrEqual(0)
    for (const n of Object.values(p.reinforcements)) expect(n).toBeGreaterThanOrEqual(0)
  }
  for (const sys of Object.values(state.systems)) {
    if (state.tactical?.step === 'spaceCombat' && state.tactical.systemId === sys.id) continue
    for (const seat of [0, 1] as Seat[]) {
      const mine = sys.space.filter(u => u.owner === seat)
      if (!mine.length) continue
      const stats = { faction: state.players[seat].faction, techs: state.players[seat].techs }
      const cap = capacity(sys.space, seat, stats)
      const fighters = state.players[seat].techs.includes('fighter_ii') ? 0 : mine.filter(u => u.type === 'fighter').length
      expect(mine.filter(u => u.type === 'infantry').length + fighters).toBeLessThanOrEqual(cap)
    }
  }
}

/** Turns a template move into a concrete one; falls back to the step's closing move. */
function fill(state: GameState, move: Move): Move {
  const tac = state.tactical
  const seat = state.active
  if (move.type === 'moveShips') {
    if (!tac) return { type: 'endMovement' }
    const player = state.players[seat]
    const owner = { faction: player.faction, techs: player.techs }
    const dest = state.systems[tac.systemId]
    const room = fleetPoolLimit(player) - dest.space.filter(u => u.owner === seat && NON_FIGHTER_SHIPS.includes(u.type)).length
    for (const option of movableShips(state, seat)) {
      const ship = state.systems[option.from].space.find(u => u.id === option.unitId)
      if (!ship || ship.type === 'fighter') continue
      if (room < 1) continue
      const capacity = unitStats(ship.type, owner).capacity
      const cargo = state.systems[option.from].planets.flatMap(p => p.ground.filter(u => u.owner === seat)).slice(0, capacity).map(u => u.id)
      return { type: 'moveShips', moves: [{ unitId: option.unitId, from: option.from, carrying: cargo }] }
    }
    return { type: 'endMovement' }
  }
  if (move.type === 'produce') {
    const player = state.players[seat]
    if (player.reinforcements.infantry < 1) return { type: 'endTactical' }
    const cost = productionCost({ infantry: 1 }, { faction: player.faction, techs: player.techs }, player.techs.includes('sarween_tools'))
    const planets: string[] = []
    let paid = 0
    for (const sys of Object.values(state.systems)) for (const p of sys.planets) {
      if (paid >= cost) continue
      if (p.owner === seat && !p.exhausted) { planets.push(p.id); paid += p.resources }
    }
    if (paid < cost) return { type: 'endTactical' }
    return { type: 'produce', units: { infantry: 1 }, planets, tradeGoods: 0 }
  }
  return move
}

describe('tactical legal moves', () => {
  it('enumerates every tactical step', () => {
    const base = deepFreeze({ ...draft(createGame(config, 3)), active: 0 as Seat })
    const start = applyMove(base, { type: 'startTactical', systemId: 'mecatol' }, 1)
    if (!start.ok) throw new Error(start.error)
    const movement = legalMoves(start.value)
    expect(movement.some(m => m.type === 'moveShips')).toBe(true)
    expect(movement.some(m => m.type === 'endMovement')).toBe(true)
    expect(validateMove(start.value, { type: 'moveShips', moves: [{ unitId: 1, from: 'home-n', carrying: [] }] }).ok).toBe(true)
    const moved = applyMove(start.value, fill(start.value, { type: 'moveShips', moves: [] }), 1)
    if (!moved.ok) throw new Error(moved.error)
    const combat = applyMove(moved.value, { type: 'endMovement' }, 1)
    if (!combat.ok) throw new Error(combat.error)
    expect(combat.value.tactical?.step).toBe('spaceCombat')
    expect(legalMoves(combat.value).some(m => m.type === 'combatRound')).toBe(true)
    const invading: GameState = { ...combat.value, tactical: { systemId: 'mecatol', step: 'invasion', invasion: { planetId: null, landed: [], bombarded: [] } } }
    expect(legalMoves(invading).some(m => m.type === 'endInvasion')).toBe(true)
    const producing: GameState = { ...combat.value, tactical: { systemId: 'home-n', step: 'production' } }
    expect(legalMoves(producing).some(m => m.type === 'produce')).toBe(true)
    expect(legalMoves(producing).some(m => m.type === 'endTactical')).toBe(true)
  })
  it('a whole tactical action can be played from the enumerator alone', () => {
    let s = cardsUsed({ ...draft(createGame(config, 4)), active: 0 as Seat })
    const start = applyMove(s, { type: 'startTactical', systemId: 'bereg' }, 1)
    if (!start.ok) throw new Error(start.error)
    s = start.value
    for (let i = 0; i < 30 && s.tactical; i++) {
      const moves = legalMoves(s)
      expect(moves.length).toBeGreaterThan(0)
      const r = applyMove(s, fill(s, moves[moves.length - 1]), 50 + i)
      if (!r.ok) throw new Error(r.error)
      s = r.value
      invariants(s)
    }
    expect(s.tactical).toBeNull()
    expect(s.active).toBe(1)
  })
  it('a seeded 200-move run keeps every invariant', () => {
    let s = cardsUsed(draft(createGame(config, 9)))
    let rngState = 12345
    const rng = () => { rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0; return rngState / 4294967296 }
    let applied = 0
    for (let i = 0; i < 200; i++) {
      if (s.phase !== 'action') { s = nextRound(s); continue }
      const moves = legalMoves(s)
      if (!moves.length) { s = nextRound(s); continue }
      const move = fill(s, moves[Math.floor(rng() * moves.length)])
      const r = applyMove(s, move, 1000 + i)
      if (!r.ok) throw new Error(`${move.type} rejected: ${r.error}`)
      s = r.value
      applied++
      invariants(s)
    }
    expect(applied).toBeGreaterThan(120)
    expect(s.log.filter(e => e.t === 'roll').length).toBeGreaterThan(0)
    expect(s.round).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/engine/tacticalFlow.test.ts`
Expected: FAIL, the movement, combat and invasion steps enumerate no moves.

- [ ] **Step 3: Complete the enumerator**

```ts
// src/engine/legalMoves.ts
import { activatableSystems, canPass } from './actionPhase'
import { canMunitions, retreatTargets } from './combat'
import { productionLimit } from './economy'
import { bombardablePlanets, groundCombatPending, landablePlanets } from './invasion'
import { movableShips } from './movement'
import type { GameState, Move, Result } from './types'

/** Kinds whose parameters the UI fills in; the enumerator only offers a template. */
export const TEMPLATE_KINDS: Move['type'][] = ['moveShips', 'produce', 'land']

function tacticalMoves(state: GameState): Move[] {
  const tac = state.tactical
  if (!tac) return []
  const seat = state.active
  switch (tac.step) {
    case 'movement': {
      const out: Move[] = []
      if (movableShips(state, seat).length) out.push({ type: 'moveShips', moves: [] })
      out.push({ type: 'endMovement' })
      return out
    }
    case 'spaceCombat': {
      const out: Move[] = [{ type: 'combatRound' }]
      const combat = tac.combat
      if (!combat) return out
      if (canMunitions(state, combat.attacker) || canMunitions(state, combat.defender)) out.push({ type: 'combatRound', munitions: true })
      if (combat.round > 1 && seat === combat.attacker && combat.retreating === null) {
        for (const to of retreatTargets(state, seat)) out.push({ type: 'retreat', to })   // R4.1 step 5: one announcement per combat
      }
      return out
    }
    case 'invasion': {
      const out: Move[] = []
      for (const planetId of bombardablePlanets(state, seat)) out.push({ type: 'bombard', planetId })
      for (const { planetId, infantryIds } of landablePlanets(state, seat)) out.push({ type: 'land', planetId, infantryIds })
      if (groundCombatPending(state, seat)) out.push({ type: 'groundCombatRound' })
      out.push({ type: 'endInvasion' })
      return out
    }
    case 'production': {
      const out: Move[] = []
      if (productionLimit(state, seat, tac.systemId) > 0) out.push({ type: 'produce', units: {}, planets: [], tradeGoods: 0 })
      out.push({ type: 'endTactical' })
      return out
    }
    case 'done':
      return [{ type: 'endTactical' }]
  }
}

export function legalMoves(state: GameState): Move[] {
  if (state.winner !== null) return []
  if (state.phase === 'strategy') {
    const seat = state.draft[0]
    if (seat === undefined || seat !== state.active) return []
    return state.strategyPool.map(c => ({ type: 'pickStrategyCard', card: c.id }))
  }
  if (state.phase !== 'action') return []   // status phase moves are added by plan 3
  const seat = state.active
  if (state.players[seat].passed) return []
  if (state.tactical) return tacticalMoves(state)
  const out: Move[] = activatableSystems(state, seat).map(id => ({ type: 'startTactical', systemId: id }))
  if (canPass(state, seat)) out.push({ type: 'pass' })
  return out
}

export function validateMove(state: GameState, move: Move): Result<true> {
  const moves = legalMoves(state)
  const ok = TEMPLATE_KINDS.includes(move.type)
    ? moves.some(m => m.type === move.type)
    : moves.some(m => JSON.stringify(m) === JSON.stringify(move))
  return ok ? { ok: true, value: true } : { ok: false, error: `illegal move ${move.type}` }
}
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS, all suites (units, rng, adjacency, research, setup, economy, strategyPhase, actionPhase, movement, combat, invasion, production, tacticalFlow).

- [ ] **Step 5: Type-check, lint and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/legalMoves.ts src/engine/tacticalFlow.test.ts
git commit -m "feat(engine): tactical legal move enumeration and seeded flow smoke test"
```

---

## Self-review notes

### Spec coverage

| Rule | Where | Notes |
| --- | --- | --- |
| R3.2 tactical action, turn order, passing | `actionPhase.ts`, task 1 | activation token, no double activation, pass blocked by an unused strategy card, both passed ends the phase |
| R3.2 step 2 movement | `movement.ts`, task 2 | move values, path search, blockers, wormholes, asteroid, nebula, Gravity Drive, capacity, own-token ships, fleet pool |
| R4.1 space combat | `combat.ts`, task 3 | space cannon offense, anti-fighter barrage, Assault Cannon, combat rounds, nebula defender +1, Munitions Reserves, hit assignment with sustain, Non-Euclidean Shielding, Duranium Armor and restricted L1Z1X hits, retreat as an announcement carried out after the next round, end of combat, R7 Mandate |
| R4.2 guardian behaviour | `combat.ts`, `invasion.ts` | guardians use level I stats and no techs (`statsOwner` returns `'guardian'`), never retreat (only the attacker may), block movement like enemies, their infantry defend Mecatol Rex normally, their destroyed units are not returned to any reinforcement pool |
| R4.3 invasion | `invasion.ts`, task 4 | bombardment with planetary shield (only Arc Secundus gets through), Plasma Scoring, Harrow, landing, space cannon defense (negated by L4 Disruptors, its only effect), ground combat, control change with Assimilate |
| R4.4 production | `production.ts`, task 5 | production limit, cost with Sarween Tools, payment, reinforcements, fleet pool, fighter capacity with Space Dock II, War Sun tech, one flagship |
| R7 objective 4 and Mandate | `production.ts`, `combat.ts` | `spentInOneProductionThisRound`, `mandateEarnedThisRound` (scoring itself is plan 3) |

### Type consistency

- One field is added to `types.ts` and to the `State shape` block of `docs/spec/engine-design.md` (task 2, step 1): `CombatState.retreatTo: string | null`, the announced retreat destination. Nothing else is redefined. `TacticalContext.step`, `CombatState` and `InvasionState` are otherwise used exactly as designed: `combat.round` is the index of the **next** round (0 = pre-combat), `combat.retreating`/`combat.retreatTo` hold a pending announcement, `combat.lastRolls` holds the dice of the last resolved round, `invasion.planetId` is the planet with the running ground combat, `invasion.landed` collects the landed infantry ids and `invasion.bombarded` the planets already bombarded this invasion.
- `StatsOwner` comes from `src/data/units.ts` and is produced centrally by `board.statsOwner`; `Result`, `GameState` and `Move` come from `types.ts`. The post-fix-wave signatures are used as they are: `unitStats` returns `Readonly<UnitStats>` and is never written to, `SHIP_TYPES` and `NON_FIGHTER_SHIPS` are only read, `board.checkFleet` and `board.trimCargo` delegate to `economy.capacity(units, owner, stats)` and `economy.nonFighterShips(units, owner)` instead of filtering by owner themselves, and `combat.markMandate` uses `MECATOL_ID` from `data/map.ts` rather than the string literal.
- New helper modules: `board.ts` (shared unit and fleet helpers), `movement.ts`, `combat.ts`, `invasion.ts`, `production.ts`. `legalMoves.ts` imports from all of them; nothing imports `legalMoves.ts` except `index.ts`, so there is no cycle.
- `applyMove` keeps its signature, its try/catch (a thrown `Error` becomes `{ ok: false, error }`) and its single log append; every dice roll is appended by the move handler before the `move` entry. Tests pass their fixtures through `deepFreeze` from `src/engine/testUtils.ts`, so a mutation of the input state throws inside the dispatcher and turns into a failed move that fails the test: task 1 in the activation test, task 2 in the `activate` helper, task 3 in the `fight` helper, task 4 in the `apply` helper, task 5 in the `produce` helper and task 6 in the enumeration test.

### Resolved spec ambiguities

1. **Round counter and pre-combat.** R4.1 lists space cannon, barrage and then rounds, but `CombatState` has only one counter. Ruling: `round: 0` means the pre-combat step is still pending; the first `combatRound` move resolves Assault Cannon, space cannon offense and barrage and leaves `round: 1`.
2. **Retreat timing.** Follows R4.1 step 5 literally: `retreat` is an announcement before a round after the first (`combat.round >= 2`), at most one per combat and only by the attacker; the next `combatRound` is fought in full and only afterwards do the retreating ships and their cargo move to `retreatTo`, the combat ends and the tactical step becomes `'done'`. `CombatState` gained `retreatTo: string | null` for the destination. If either side is wiped out in that round, the combat simply ends and the announcement is dropped (a destroyed attacker cannot retreat, and an attacker who clears the system has won and goes on to the invasion).
3. **Who may retreat.** R4.1 step 5 names only the attacker, so the defender never retreats; guardians never retreat either.
4. **Combat only with two fleets.** If the active player has no ships in the activated system, `endMovement` goes straight to the invasion even when enemy ships are present; there is nothing to fight with.
5. **Carrying.** R3.2 allows picking up along the path; the engine only loads fighters and infantry from the ship's own starting system (space or its planets). Simpler, never illegal, and enough for the duel map where paths are at most two steps.
6. **Munitions Reserves.** The flag on `combatRound` applies to every side in the combat that is Letnev and can pay 2 trade goods, and rerolls each missed die once. In the v1 pairing only one seat is Letnev, so there is no ambiguity.
7. **Excess cargo.** TI4 destroys units above capacity; the engine trims at exactly two points, when a space combat ends and after an executed retreat (`trimCargo`), never after an individual round, infantry first and then fighters unless Fighter II makes them free (they then count against the fleet pool instead). Cargo may therefore sit above capacity while a combat is still running, which is why the smoke test's capacity invariant skips the system with the running space combat.
8. **Objective 4 spending.** `spentInOneProductionThisRound` records the production cost after Sarween Tools, not the overpaid amount; overpay is lost per R4.4.
9. **L4 Disruptors.** The phrase "or L4 Disruptors" in R4.3 step 1 is a slip in the rules document and is being removed by the controller, so it is not implemented. The printed text applies: L4 Disruptors only stops SPACE CANNON against your units during an invasion (R4.3 step 3). Bombarding a planet with a planetary shield is possible only with Arc Secundus in the system; War Sun's shield removal stays deferred.
10. **Templates in `legalMoves`.** `engine-design.md` speaks of templates with `params: undefined`, but the `Move` type has no `params` field. Ruling: `moveShips`, `produce` and `land` are emitted with empty or maximal parameters and `validateMove` matches these three kinds by type only.

### Deferred

- **Infantry II revival** (R4.3 step 4): a destroyed infantry returning on 6+ at the start of the next turn needs a per-player holding area that the state shape does not have. Out of scope, to be added with the status phase.
- **Action cards, promissory notes, agenda phase**: not in v1 at all (R6).
- **Strategic actions, component actions, trade posts, status phase, scoring and victory**: plan 3. Until then a player can only pass when all their strategy cards are marked used, so the smoke test marks them used itself.
- **War Sun removing the planetary shield** and **Antimass Deflectors giving -1 against SPACE CANNON**: both are printed abilities that R4.1 and R4.3 do not mention; not implemented, to be revisited when the rules document is updated.
- **Fleet pool after a retreat**: the destination system is not re-checked against the fleet pool, only the cargo is trimmed.
- `validateMove` still compares JSON for the non-template kinds; replace with structural checks when the move list grows further.
