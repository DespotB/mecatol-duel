# Engine Tactical Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the tactical action of the action phase in the existing `applyMove` dispatcher: turn structure and activation, movement with anomalies and wormholes, space combat with the pre-combat steps and retreat, invasion with bombardment, landing and ground combat, and production. Extend `legalMoves` so the whole tactical action can be driven from the enumerator alone, and prove it with a seeded 200-move smoke test.

**Architecture:** Everything stays pure: functions from state to state, no I/O, no React. This plan adds `src/engine/actionPhase.ts`, `board.ts`, `movement.ts`, `combat.ts`, `invasion.ts`, `production.ts`, grows the shared test kit in `src/engine/testUtils.ts` and rewrites `src/engine/legalMoves.ts`. The existing exports of plan 1 (`types.ts`, `data/units.ts`, `rng.ts`, `data/map.ts`, `adjacency.ts`, `data/techs.ts`, `research.ts`, `data/factions.ts`, `data/objectives.ts`, `setup.ts`, `economy.ts`, `strategyPhase.ts`, `index.ts`) are reused unchanged and with the signatures they have today (`unitStats` returns `Readonly<UnitStats>`, `SHIP_TYPES` and `NON_FIGHTER_SHIPS` are `readonly UnitType[]`, `nonFighterShips(units, owner)` and `capacity(units, owner, stats)` filter by unit owner, `applyMove` turns thrown errors into `{ ok: false }`, `data/map.ts` exports `MECATOL_ID`). New move kinds are added as cases to the `applyMove` switch and as branches in `legalMoves`. The only type change is one new field on `CombatState`, `retreatTo`, added in task 2 together with the matching line in `docs/spec/engine-design.md`; task 6 brings the rest of that document in line with the code.

**Tech Stack:** TypeScript 5 (strict), Vite 7 scaffold, Vitest 3, no runtime dependencies in the engine.

**Spec:** `docs/spec/game-rules.md` (rules v0.2 as amended, sections referenced below as R1..R8) and `docs/spec/engine-design.md` (state and move types, module layout). This plan covers R3.2 (tactical action), R4.1, R4.2 (guardian behaviour in combat), R4.3 and R4.4.

## Global Constraints

- Node 24, npm 11; run tests with `npm test` (Vitest, `vitest run`).
- `tsconfig.app.json` is strict, with `noUnusedLocals`; no `any`, no non-null assertions, no unused imports in engine or test code.
- Engine and data modules must not import React, DOM APIs or Node APIs.
- All code, comments, commit messages and docs in English. Shipped code never refers to plan tasks or plan numbers.
- Never mutate a `GameState` passed into a function; return new objects.
- Dice are ten-sided: `1 + Math.floor(rng() * 10)`; all randomness comes from the seed passed to `applyMove` or `createGame`. Inside a move, every separate roll uses its own generator `mulberry32(deriveSeed(seed, salt))` with a distinct salt, and every ability rolls through the single helper `board.rollHits`.
- **Every dice roll is logged as a `roll` entry** (`{ t: 'roll'; owner; rolls: DieRoll[]; context }`), one entry per rolling side and step.
- **Combat and invasion never leave a unit with `owner` of a seat that has no units in the system and no planet there:** carried fighters and infantry in space are trimmed to the remaining capacity when a space combat ends and after an announced retreat has been carried out, never after an individual round.
- **Every test freezes its fixture.** The helpers in `src/engine/testUtils.ts` return `deepFreeze(...)`, so this holds by construction; the small per-file move wrappers freeze again. An accidental mutation then throws, `applyMove`'s try/catch turns it into a failed move, and the test fails.
- Test names cite the spec section they cover, e.g. `'R4.1 step 2: anti-fighter barrage only destroys fighters'`.
- Commit after every task with a conventional message (`feat:`, `test:`, `chore:`).

---

### Task 1: Shared test kit, action-phase turn structure and activation

**Files:**
- Modify: `src/engine/testUtils.ts` (fixture helpers used by every test file of this plan)
- Create: `src/engine/actionPhase.ts`
- Modify: `src/engine/index.ts` (dispatcher cases `startTactical`, `pass`, `endTactical`)
- Modify: `src/engine/legalMoves.ts` (action-phase branch)
- Test: `src/engine/actionPhase.test.ts`

**Interfaces:**
- Produces in `testUtils.ts` (test-only module, imported by tests, never by engine code; every function returns a deep-frozen state):
  ```ts
  export function deepFreeze<T>(value: T): T                       // already there
  export const DUEL_CONFIG: GameConfig                             // l1z1x blue vs letnev red, speaker 0
  export function toActionPhase(seed?: number, active?: Seat): GameState   // createGame plus the full snake draft
  export function withUnits(state: GameState, systemId: string, owner: Owner, types: UnitType[], planetId?: string): GameState
  export function withTechs(state: GameState, seat: Seat, techs: string[]): GameState
  export function withPlayer(state: GameState, seat: Seat, patch: Partial<Player>): GameState
  export function withTactical(state: GameState, tactical: TacticalContext | null): GameState
  export function withPlanetOwner(state: GameState, systemId: string, planetId: string, owner: Seat | null): GameState
  export function cardsUsed(state: GameState): GameState           // marks every strategy card used, so passing is legal
  export function shipId(state: GameState, systemId: string, type: UnitType, owner?: Owner): number
  export function groundIds(state: GameState, systemId: string, planetId: string, owner?: Owner): number[]
  export function carriedIds(state: GameState, systemId: string, owner?: Owner): number[]
  export function hitsIn(state: GameState, context: string): number   // hits in the logged rolls of one context
  ```
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
  `startTactical` spends one tactic token, appends the seat to `system.activatedBy` and sets `state.tactical = { systemId, step: 'movement' }`; R3.2 forbids activating a system that already holds one of your command tokens, your home system included. `pass` sets `passed`, and when both players have passed sets `phase: 'status'` and `active = speaker`. `endTactical` is legal from step `'production'` (skipping production) and step `'done'`; it clears `state.tactical` and passes the turn.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/actionPhase.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove, legalMoves } from './index'
import { cardsUsed, deepFreeze, toActionPhase, withPlayer } from './testUtils'
import type { GameState, Seat } from './types'

const start = (state: GameState, systemId: string) => applyMove(deepFreeze(state), { type: 'startTactical', systemId }, 0)

describe('R3.2 action phase', () => {
  it('R3.2: activation spends a tactic token, marks the system and opens the movement step', () => {
    const s = toActionPhase()
    const r = start(s, 'bereg')
    if (!r.ok) throw new Error(r.error)
    expect(r.value.players[0].tokens.tactic).toBe(2)
    expect(r.value.systems.bereg.activatedBy).toEqual([0])
    expect(r.value.tactical).toEqual({ systemId: 'bereg', step: 'movement' })
    expect(s.players[0].tokens.tactic).toBe(3)   // input not mutated
  })
  it('R3.2: a system that already contains your own command token cannot be activated', () => {
    const base = toActionPhase()
    const s: GameState = { ...base, systems: { ...base.systems, bereg: { ...base.systems.bereg, activatedBy: [0 as Seat] } } }
    expect(start(s, 'bereg').ok).toBe(false)
    expect(start(s, 'quann').ok).toBe(true)
    const home: GameState = { ...base, systems: { ...base.systems, 'home-n': { ...base.systems['home-n'], activatedBy: [0 as Seat] } } }
    expect(start(home, 'home-n').ok).toBe(false)   // the home system is not an exception
  })
  it('R3.2: activation needs a tactic token and no running tactical action', () => {
    const base = toActionPhase()
    const broke = withPlayer(base, 0, { tokens: { tactic: 0, fleet: 3, strategy: 2 } })
    expect(start(broke, 'bereg').ok).toBe(false)
    const running: GameState = { ...base, tactical: { systemId: 'bereg', step: 'movement' } }
    expect(start(running, 'quann').ok).toBe(false)
  })
  it('R3.2: a player may not pass while holding an unused strategy card', () => {
    const s = toActionPhase()
    expect(applyMove(s, { type: 'pass' }, 0).ok).toBe(false)
    expect(applyMove(cardsUsed(s), { type: 'pass' }, 0).ok).toBe(true)
  })
  it('R3.2: after one pass the other player continues; when both have passed the status phase begins', () => {
    const s = cardsUsed(toActionPhase())
    const first = applyMove(s, { type: 'pass' }, 0)
    if (!first.ok) throw new Error(first.error)
    expect(first.value.players[0].passed).toBe(true)
    expect(first.value.active).toBe(1)
    expect(first.value.phase).toBe('action')
    const second = applyMove(first.value, { type: 'pass' }, 0)
    if (!second.ok) throw new Error(second.error)
    expect(second.value.phase).toBe('status')
    expect(second.value.active).toBe(second.value.speaker)
  })
  it('R3.2: after a finished tactical action the other seat is active, unless it has passed', () => {
    const base = toActionPhase()
    const done: GameState = { ...base, tactical: { systemId: 'bereg', step: 'done' } }
    const r = applyMove(deepFreeze(done), { type: 'endTactical' }, 0)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.tactical).toBeNull()
    expect(r.value.active).toBe(1)
    const alone = withPlayer(done, 1, { passed: true })
    const r2 = applyMove(alone, { type: 'endTactical' }, 0)
    if (!r2.ok) throw new Error(r2.error)
    expect(r2.value.active).toBe(0)
  })
  it('endTactical is rejected while the tactical action is unfinished and allowed from the production step', () => {
    const base = toActionPhase()
    expect(applyMove({ ...base, tactical: { systemId: 'bereg', step: 'movement' } }, { type: 'endTactical' }, 0).ok).toBe(false)
    expect(applyMove({ ...base, tactical: { systemId: 'bereg', step: 'production' } }, { type: 'endTactical' }, 0).ok).toBe(true)
    expect(applyMove(base, { type: 'endTactical' }, 0).ok).toBe(false)
  })
  it('legal moves without a running tactical action are the activations plus pass', () => {
    const s = toActionPhase()
    expect(legalMoves(s).filter(m => m.type === 'startTactical')).toHaveLength(7)
    expect(legalMoves(s).some(m => m.type === 'pass')).toBe(false)
    expect(legalMoves(cardsUsed(s)).some(m => m.type === 'pass')).toBe(true)
    expect(legalMoves(withPlayer(s, 0, { passed: true }))).toEqual([])
    expect(legalMoves({ ...s, tactical: { systemId: 'bereg', step: 'done' } })).toEqual([{ type: 'endTactical' }])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/engine/actionPhase.test.ts`
Expected: FAIL, `toActionPhase` is not exported from `./testUtils`.

- [ ] **Step 3: Grow the shared test kit**

```ts
// src/engine/testUtils.ts
import { applyMove } from './index'
import { createGame } from './setup'
import type { GameConfig, GameState, Owner, Player, Seat, StrategyCardId, TacticalContext, Unit, UnitType } from './types'

export function deepFreeze<T>(value: T): T {
  if (value !== null && (typeof value === 'object' || Array.isArray(value)) && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}

export const DUEL_CONFIG: GameConfig = {
  players: [{ faction: 'l1z1x', color: 'blue', name: 'A' }, { faction: 'letnev', color: 'red', name: 'B' }],
  speaker: 0,
}

/** A new game plus the whole snake draft, so the state sits in the action phase with `active` to hand. */
export function toActionPhase(seed = 1, active: Seat = 0): GameState {
  let s = createGame(DUEL_CONFIG, seed)
  for (const card of ['warfare', 'leadership', 'imperial', 'technology'] as StrategyCardId[]) {
    const r = applyMove(s, { type: 'pickStrategyCard', card }, 0)
    if (!r.ok) throw new Error(r.error)
    s = r.value
  }
  return deepFreeze({ ...s, active })
}

/** Places units in a system (in space, or on a planet when planetId is given) and takes them out of the reinforcements. */
export function withUnits(state: GameState, systemId: string, owner: Owner, types: UnitType[], planetId?: string): GameState {
  let nextId = state.nextUnitId
  const sys = state.systems[systemId]
  const made: Unit[] = types.map(type => ({ id: nextId++, type, owner, damaged: false }))
  const players = [...state.players] as GameState['players']
  if (owner !== 'guardian') {
    const p = players[owner]
    const reinforcements = { ...p.reinforcements }
    for (const type of types) reinforcements[type] = Math.max(0, reinforcements[type] - 1)
    players[owner] = { ...p, reinforcements }
  }
  const planets = sys.planets.map(p => p.id !== planetId ? p : {
    ...p,
    ground: [...p.ground, ...made.filter(u => u.type === 'infantry')],
    structures: [...p.structures, ...made.filter(u => u.type !== 'infantry')],
  })
  return deepFreeze({
    ...state, players, nextUnitId: nextId,
    systems: { ...state.systems, [systemId]: { ...sys, space: planetId ? sys.space : [...sys.space, ...made], planets } },
  })
}

export function withTechs(state: GameState, seat: Seat, techs: string[]): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], techs: [...players[seat].techs, ...techs] }
  return deepFreeze({ ...state, players })
}

export function withPlayer(state: GameState, seat: Seat, patch: Partial<Player>): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], ...patch }
  return deepFreeze({ ...state, players })
}

export function withTactical(state: GameState, tactical: TacticalContext | null): GameState {
  return deepFreeze({ ...state, tactical })
}

export function withPlanetOwner(state: GameState, systemId: string, planetId: string, owner: Seat | null): GameState {
  const sys = state.systems[systemId]
  return deepFreeze({
    ...state,
    systems: { ...state.systems, [systemId]: { ...sys, planets: sys.planets.map(p => p.id === planetId ? { ...p, owner } : p) } },
  })
}

export function cardsUsed(state: GameState): GameState {
  return deepFreeze({
    ...state,
    players: state.players.map(p => ({ ...p, strategyCards: p.strategyCards.map(c => ({ ...c, used: true })) })) as GameState['players'],
  })
}

export function shipId(state: GameState, systemId: string, type: UnitType, owner: Owner = 0): number {
  const unit = state.systems[systemId].space.find(u => u.type === type && u.owner === owner)
  if (!unit) throw new Error(`no ${type} of ${String(owner)} in ${systemId}`)
  return unit.id
}

export function groundIds(state: GameState, systemId: string, planetId: string, owner: Owner = 0): number[] {
  return state.systems[systemId].planets
    .filter(p => p.id === planetId)
    .flatMap(p => p.ground.filter(u => u.owner === owner).map(u => u.id))
}

export function carriedIds(state: GameState, systemId: string, owner: Owner = 0): number[] {
  return state.systems[systemId].space.filter(u => u.owner === owner && u.type === 'infantry').map(u => u.id)
}

export function hitsIn(state: GameState, context: string): number {
  return state.log.flatMap(e => e.t === 'roll' && e.context === context ? e.rolls : []).filter(r => r.hit).length
}
```

- [ ] **Step 4: Implement the action-phase turn structure**

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

- [ ] **Step 5: Wire the dispatcher and the enumerator**

```ts
// src/engine/index.ts
import { endTactical, pass, startTactical } from './actionPhase'
import { pickStrategyCard } from './strategyPhase'
import type { GameState, Move, Result } from './types'

export function applyMove(state: GameState, move: Move, seed: number): Result<GameState> {
  void seed
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
  if (state.phase !== 'action') return []
  const seat = state.active
  if (state.players[seat].passed) return []
  const tac = state.tactical
  if (!tac) {
    const out: Move[] = activatableSystems(state, seat).map(id => ({ type: 'startTactical', systemId: id }))
    if (canPass(state, seat)) out.push({ type: 'pass' })
    return out
  }
  if (tac.step === 'done' || tac.step === 'production') return [{ type: 'endTactical' }]
  return []
}

export function validateMove(state: GameState, move: Move): Result<true> {
  const ok = legalMoves(state).some(m => JSON.stringify(m) === JSON.stringify(move))
  return ok ? { ok: true, value: true } : { ok: false, error: `illegal move ${move.type}` }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- src/engine/actionPhase.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Type-check and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: no errors.

```bash
git add src/engine/testUtils.ts src/engine/actionPhase.ts src/engine/actionPhase.test.ts src/engine/index.ts src/engine/legalMoves.ts
git commit -m "feat(engine): action phase turn structure, activation and shared test fixtures"
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
  export function rollHits(rng: Rng, dice: number, value: number, extraDie: boolean): { rolls: number[]; hits: number }
      // the one dice helper: `dice` dice, plus one for Plasma Scoring, a hit on `value` or higher
  export function dieRolls(owner: Owner, unit: UnitType, rolls: number[], value: number): DieRoll[]
  export function removeUnits(state: GameState, systemId: string, ids: number[]): GameState
  export function returnToReinforcements(state: GameState, units: Unit[]): GameState
  export function destroyUnits(state: GameState, systemId: string, units: Unit[]): GameState
  export function freeFighterSlots(state: GameState, seat: Seat, systemId: string): number   // 3 with Space Dock II in the system
  export function checkFleet(state: GameState, seat: Seat, systemId: string): Result<true>   // capacity and fleet pool (Armada +2)
  export function trimCargo(state: GameState, systemId: string, owner: Owner): GameState     // only when a combat ends or a retreat resolves
  ```
- Produces in `movement.ts`:
  ```ts
  export interface MoveSpec { unitId: number; from: string; carrying: number[] }
  export function pathLength(state: GameState, seat: Seat, from: string, to: string, moveValue: number): number | null
  export function movableShips(state: GameState, seat: Seat): { unitId: number; from: string }[]
  export function moveShips(state: GameState, specs: MoveSpec[]): Result<GameState>
  export function endMovement(state: GameState): Result<GameState>
  ```
  Movement rules (R3.2 step 2, R1 anomalies): move value from `unitStats`; a ship starting in the nebula has move 1; intermediate systems may not be a nebula and may not contain ships of another owner (guardians count); the asteroid field may only be entered or crossed with `antimass_deflectors`; wormholes come from `neighbours`; ships in a system that already holds the mover's own command token may not move; Gravity Drive grants +1 move to the first ship of the batch that needs it; carried units are fighters or infantry of the seat in the system the ship starts in, at most `capacity` per ship; after the batch `checkFleet` validates capacity and the fleet pool in the destination, where R3.2's Fighter II clause applies: Fighter II fighters may move alone and fighters above capacity count against the fleet pool instead of being illegal. `endMovement` sets step `'spaceCombat'` when both the active seat and another owner have ships in the system, otherwise `'invasion'`.

- [ ] **Step 1: Add the retreat destination to the combat state**

R4.1 step 5 announces a retreat before a round and carries it out after that round, so the announced destination is part of the state, and `endMovement` below already fills it in. In `src/engine/types.ts` replace the `CombatState` line with:

```ts
export interface CombatState { round: number; attacker: Seat; defender: Owner; retreating: Seat | null; retreatTo: string | null; lastRolls: DieRoll[] }
```

Make the identical edit in the `State shape` code block of `docs/spec/engine-design.md`, so spec and code stay the same text. Nothing constructs a `CombatState` yet, so nothing else changes.

- [ ] **Step 2: Write the failing test**

```ts
// src/engine/movement.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { deepFreeze, groundIds, shipId, toActionPhase, withTechs, withUnits } from './testUtils'
import type { GameState, Seat } from './types'

function activate(state: GameState, seat: Seat, systemId: string): GameState {
  const r = applyMove(deepFreeze({ ...state, active: seat }), { type: 'startTactical', systemId }, 0)
  if (!r.ok) throw new Error(r.error)
  return deepFreeze(r.value)
}

const move = (state: GameState, unitId: number, from: string, carrying: number[] = []) =>
  applyMove(deepFreeze(state), { type: 'moveShips', moves: [{ unitId, from, carrying }] }, 0)

describe('R3.2 movement', () => {
  it('R3.2 step 2: a carrier moves one system and carries infantry within its capacity', () => {
    const s = activate(toActionPhase(), 0, 'bereg')
    const carrier = shipId(s, 'home-n', 'carrier')
    const troops = groundIds(s, 'home-n', '000').slice(0, 4)
    const r = move(s, carrier, 'home-n', troops)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.systems.bereg.space.filter(u => u.owner === 0).map(u => u.type).sort())
      .toEqual(['carrier', 'infantry', 'infantry', 'infantry', 'infantry'])
    expect(r.value.systems['home-n'].planets[0].ground).toHaveLength(1)
    expect(r.value.systems['home-n'].space.some(u => u.id === carrier)).toBe(false)
  })
  it('R3.2 step 2: carrying more than the capacity is rejected', () => {
    const s = activate(toActionPhase(), 0, 'bereg')
    expect(move(s, shipId(s, 'home-n', 'carrier'), 'home-n', groundIds(s, 'home-n', '000')).ok).toBe(false)
  })
  it('R3.2 step 2: a fighter only moves on its own with Fighter II', () => {
    const plain = activate(toActionPhase(), 0, 'bereg')
    expect(move(plain, shipId(plain, 'home-n', 'fighter'), 'home-n').ok).toBe(false)
    const upgraded = activate(withTechs(toActionPhase(), 0, ['fighter_ii']), 0, 'bereg')
    const r = move(upgraded, shipId(upgraded, 'home-n', 'fighter'), 'home-n')
    if (!r.ok) throw new Error(r.error)
    expect(r.value.systems.bereg.space.filter(u => u.owner === 0 && u.type === 'fighter')).toHaveLength(1)
  })
  it('R3.2 step 2: Fighter II fighters above the capacity count against the fleet pool', () => {
    const base = withTechs(toActionPhase(), 0, ['fighter_ii'])
    const crowded = withUnits(base, 'bereg', 0, ['cruiser', 'cruiser', 'fighter'])   // 2 non-fighters plus one loose fighter
    const s = activate(crowded, 0, 'bereg')
    // the loose fighter and the arriving one have no capacity, so both count as non-fighter ships: 2 + 2 > fleet pool 3
    expect(move(s, shipId(s, 'home-n', 'fighter'), 'home-n').ok).toBe(false)
    const smaller = activate(withUnits(base, 'bereg', 0, ['cruiser', 'fighter']), 0, 'bereg')
    expect(move(smaller, shipId(smaller, 'home-n', 'fighter'), 'home-n').ok).toBe(true)   // 1 + 2 = 3
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
    expect(move(blocked, shipId(blocked, 'home-s', 'destroyer', 1), 'home-s').ok).toBe(false)   // the only route left crosses the nebula
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
  it('R3.2 step 2: ships may not move through a system that contains enemy or guardian ships', () => {
    const open = activate(withUnits(toActionPhase(), 'home-n', 0, ['destroyer']), 0, 'quann')
    expect(move(open, shipId(open, 'home-n', 'destroyer'), 'home-n').ok).toBe(true)   // via bereg
    const blocked = activate(withUnits(withUnits(toActionPhase(), 'home-n', 0, ['destroyer']), 'bereg', 1, ['destroyer']), 0, 'quann')
    expect(move(blocked, shipId(blocked, 'home-n', 'destroyer'), 'home-n').ok).toBe(false)
  })
  it('R3.2 step 2: ships in a system that contains your own command token cannot move', () => {
    const placed = withUnits(toActionPhase(), 'bereg', 0, ['carrier'])
    const tokened: GameState = { ...placed, systems: { ...placed.systems, bereg: { ...placed.systems.bereg, activatedBy: [0 as Seat] } } }
    const s = activate(tokened, 0, 'starpoint')
    expect(move(s, shipId(s, 'bereg', 'carrier'), 'bereg').ok).toBe(false)
  })
  it('R3.2 step 2: Gravity Drive gives +1 move to exactly one ship per activation', () => {
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
    expect(combat.value.tactical?.combat).toEqual({ round: 0, attacker: 0, defender: 'guardian', retreating: null, retreatTo: null, lastRolls: [] })
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
import { rollDice, type Rng } from './rng'
import type { DieRoll, GameState, Owner, Result, Seat, System, Unit, UnitType } from './types'

export function statsOwner(state: GameState, owner: Owner): StatsOwner {
  return owner === 'guardian' ? 'guardian' : { faction: state.players[owner].faction, techs: state.players[owner].techs }
}

export function hasTech(state: GameState, owner: Owner, tech: string): boolean {
  return owner !== 'guardian' && state.players[owner].techs.includes(tech)
}

export function shipsOf(sys: System, owner: Owner): Unit[] {
  return sys.space.filter(u => u.owner === owner && isShip(u.type))
}

/** The one dice helper: `dice` dice (Plasma Scoring adds one), a hit on `value` or higher. */
export function rollHits(rng: Rng, dice: number, value: number, extraDie: boolean): { rolls: number[]; hits: number } {
  const rolls = rollDice(rng, Math.max(0, dice + (extraDie ? 1 : 0)))
  return { rolls, hits: rolls.filter(v => v >= value).length }
}

export function dieRolls(owner: Owner, unit: UnitType, rolls: number[], value: number): DieRoll[] {
  return rolls.map(v => ({ owner, unit, value: v, hit: v >= value }))
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
  return state.systems[systemId].planets.some(p => p.structures.some(u => u.type === 'spacedock' && u.owner === seat)) ? 3 : 0
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
    // R3.2: only Fighter II turns excess fighters into a fleet pool question instead of an illegal move
    if (!player.techs.includes('fighter_ii') || excess > fighters) return { ok: false, error: `capacity exceeded in ${systemId}` }
  } else excess = 0
  if (nonFighterShips(space, seat) + excess > fleetPoolLimit(player)) return { ok: false, error: `fleet pool exceeded in ${systemId}` }
  return { ok: true, value: true }
}

/** Destroys carried infantry and fighters above the remaining capacity, when a combat ends or a retreat resolves. */
export function trimCargo(state: GameState, systemId: string, owner: Owner): GameState {
  const sys = state.systems[systemId]
  const cap = capacity(sys.space, owner, statsOwner(state, owner))
  const mine = sys.space.filter(u => u.owner === owner)
  const infantry = mine.filter(u => u.type === 'infantry')
  const fighters = mine.filter(u => u.type === 'fighter')
  const keepInfantry = Math.min(infantry.length, cap)
  const keepFighters = hasTech(state, owner, 'fighter_ii') ? fighters.length : Math.min(fighters.length, Math.max(0, cap - keepInfantry))
  return destroyUnits(state, systemId, [...infantry.slice(keepInfantry), ...fighters.slice(keepFighters)])
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
  const stats = unitStats(unit.type, { faction: player.faction, techs: player.techs })
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
      if (pathLength(state, seat, sys.id, tac.systemId, moveValueOf(state, seat, u, sys.id) + bonus) !== null) {
        out.push({ unitId: u.id, from: sys.id })
      }
    }
  }
  return out
}

export function moveShips(state: GameState, specs: MoveSpec[]): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'movement') return { ok: false, error: 'not in the movement step' }
  const seat = state.active
  const player = state.players[seat]
  const stats: StatsOwner = { faction: player.faction, techs: player.techs }
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
      if (steps !== null) gravityDrive = false     // R3.2: Gravity Drive helps one ship per activation
    }
    if (steps === null) return { ok: false, error: `${ship.type} ${ship.id} cannot reach ${tac.systemId}` }
    taken.add(ship.id)
    arriving.push(ship)
    if (spec.carrying.length > unitStats(ship.type, stats).capacity) return { ok: false, error: `${ship.type} ${ship.id} carries more than its capacity` }
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
    const combat = { round: 0, attacker: seat, defender: foes[0].owner, retreating: null, retreatTo: null, lastRolls: [] }
    return { ok: true, value: { ...state, tactical: { ...tac, step: 'spaceCombat', combat } } }
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
Expected: PASS, 12 tests.

- [ ] **Step 8: Type-check and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/types.ts docs/spec/engine-design.md src/engine/board.ts src/engine/movement.ts src/engine/movement.test.ts src/engine/index.ts
git commit -m "feat(engine): board helpers and tactical movement with anomalies, wormholes and fleet limits"
```

---

### Task 3: Space combat

**Files:**
- Create: `src/engine/combat.ts`
- Modify: `src/engine/index.ts` (cases `combatRound`, `retreat`)
- Test: `src/engine/combat.test.ts`

**Interfaces:**
- Produces in `combat.ts`:
  ```ts
  export type HitMode = 'any' | 'noFighters' | 'preferNonFighters'
  export interface HitGroup { count: number; mode: HitMode }
  export function assignHits(units: Unit[], groups: HitGroup[], owner: StatsOwner, nes: boolean): { units: Unit[]; destroyed: Unit[]; sustainedIds: number[]; lost: number }
  export function applyCombatHits(state: GameState, systemId: string, owner: Owner, groups: HitGroup[]): GameState
  export function defenderModifier(systemId: string): number      // R4.1 step 3: +1 in a nebula
  export function canMunitions(state: GameState, owner: Owner): boolean       // Letnev with 2 trade goods
  export function retreatTargets(state: GameState, seat: Seat): string[]
  export function combatRound(state: GameState, munitions: boolean, seed: number): Result<GameState>
  export function retreat(state: GameState, to: string): Result<GameState>
  ```
  `combat.round` is the index of the next round to resolve. Round 0 is the pre-combat step and runs in the order of R4.1 step 6: **space cannon offense, Assault Cannon, anti-fighter barrage**; it leaves `round: 1`. Space cannon offense is fired by the PDS of every owner in the system other than the active player, one roll entry per owner. Every later call rolls one combat round for both sides simultaneously, applies the hits and increments the round.
  Hit assignment (R4.1 step 4 and 6): sustain damage cancels first (Non-Euclidean Shielding cancels 2), then units are destroyed in the order `fighter, destroyer, cruiser, carrier, dreadnought, flagship, warsun`. A `'preferNonFighters'` group ([0.0.1] and L1Z1X dreadnoughts, "if able") falls back to fighters when no non-fighter is left; a `'noFighters'` group (Graviton Laser System) cannot fall back, and those hits are **lost**. Duranium Armor repairs one damaged unit that did not sustain this round.
  `retreat` is only an announcement (R4.1 step 5): the attacker may issue it before a round after the first (`combat.round >= 2`), once, to an adjacent system that holds the attacker's units or command token and no enemy ships; it stores `retreating` and `retreatTo` and leaves the step at `'spaceCombat'`. The next `combatRound` is fought normally and only afterwards, if both sides still have ships, the retreating side moves to `retreatTo` with its cargo and the step becomes `'done'`. Guardians never retreat.
  Combat ends when a side has no ships: attacker alive goes to `'invasion'` and marks `mandateEarnedThisRound` in `MECATOL_ID` or the opponent's home system (R7), otherwise the step is `'done'`. Cargo above the remaining capacity is trimmed exactly at the end of a combat and after an executed retreat, never after an individual round.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/combat.test.ts
import { describe, expect, it } from 'vitest'
import { unitStats } from '../data/units'
import { rollHits } from './board'
import { applyCombatHits, assignHits, defenderModifier, type HitGroup } from './combat'
import { applyMove } from './index'
import { mulberry32 } from './rng'
import { deepFreeze, hitsIn, toActionPhase, withPlanetOwner, withPlayer, withTechs, withUnits } from './testUtils'
import type { GameState, Owner, Unit, UnitType } from './types'

const letnev = { faction: 'letnev' as const, techs: [] as string[] }

/** Clears the system, puts both fleets in and opens the space combat at the given round. */
function combat(systemId: string, attacker: UnitType[], defenderUnits: UnitType[], round: number, defender: Owner = 1, seed = 1): GameState {
  const base = toActionPhase(seed)
  const cleared: GameState = { ...base, systems: { ...base.systems, [systemId]: { ...base.systems[systemId], space: [] } } }
  const s = withUnits(withUnits(cleared, systemId, 0, attacker), systemId, defender, defenderUnits)
  return deepFreeze({
    ...s,
    tactical: { systemId, step: 'spaceCombat', combat: { round, attacker: 0, defender, retreating: null, retreatTo: null, lastRolls: [] } },
  })
}

const fight = (state: GameState, seed = 7, munitions?: boolean) => {
  const r = applyMove(deepFreeze(state), { type: 'combatRound', ...(munitions === undefined ? {} : { munitions }) }, seed)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

const fightToEnd = (state: GameState, seed: number) => {
  let s = state
  for (let i = 0; i < 40 && s.tactical?.step === 'spaceCombat'; i++) s = fight(s, seed + i)
  return s
}

const owned = (state: GameState, systemId: string, owner: Owner) => state.systems[systemId].space.filter(u => u.owner === owner)
const units = (spec: [UnitType, boolean][]): Unit[] => spec.map(([type, damaged], i) => ({ id: i + 1, type, owner: 0, damaged }))

describe('R4.1 dice', () => {
  it('R4.1 step 3: the nebula defender bonus lowers the threshold by one on the same dice', () => {
    expect(defenderModifier('quann')).toBe(1)
    expect(defenderModifier('bereg')).toBe(0)
    const plain = rollHits(mulberry32(5), 6, 7, false)
    const inNebula = rollHits(mulberry32(5), 6, 6, false)
    expect(inNebula.rolls).toEqual(plain.rolls)
    expect(inNebula.hits).toBe(plain.rolls.filter(v => v >= 6).length)
    expect(rollHits(mulberry32(5), 6, 7, true).rolls).toHaveLength(7)   // Plasma Scoring adds one die
  })
})

describe('R4.1 step 4 hit assignment', () => {
  it('sustain damage cancels first, then the destruction order applies', () => {
    const one = assignHits(units([['dreadnought', false], ['fighter', false], ['cruiser', false]]), [{ count: 1, mode: 'any' }], letnev, false)
    expect(one.destroyed).toHaveLength(0)
    expect(one.units.find(u => u.type === 'dreadnought')?.damaged).toBe(true)
    const three = assignHits(units([['dreadnought', true], ['fighter', false], ['cruiser', false], ['carrier', false]]), [{ count: 3, mode: 'any' }], letnev, false)
    expect(three.destroyed.map(u => u.type)).toEqual(['fighter', 'cruiser', 'carrier'])
  })
  it('Non-Euclidean Shielding cancels 2 hits with one sustain', () => {
    const plain = assignHits(units([['dreadnought', false], ['fighter', false]]), [{ count: 2, mode: 'any' }], letnev, false)
    expect(plain.destroyed.map(u => u.type)).toEqual(['fighter'])
    const nes = assignHits(units([['dreadnought', false], ['fighter', false]]), [{ count: 2, mode: 'any' }], letnev, true)
    expect(nes.destroyed).toHaveLength(0)
    expect(nes.units.find(u => u.type === 'dreadnought')?.damaged).toBe(true)
  })
  it('preferNonFighters hits ([0.0.1] and L1Z1X dreadnoughts) skip fighters while non-fighters remain', () => {
    const mixed = assignHits(units([['fighter', false], ['cruiser', false]]), [{ count: 1, mode: 'preferNonFighters' }], letnev, false)
    expect(mixed.destroyed.map(u => u.type)).toEqual(['cruiser'])
    const only = assignHits(units([['fighter', false], ['fighter', false]]), [{ count: 1, mode: 'preferNonFighters' }], letnev, false)
    expect(only.destroyed.map(u => u.type)).toEqual(['fighter'])
    expect(only.lost).toBe(0)
  })
  it('R4.1 step 6: noFighters hits (Graviton Laser System) that cannot be assigned are lost', () => {
    const mixed = assignHits(units([['fighter', false], ['cruiser', false]]), [{ count: 2, mode: 'noFighters' }], letnev, false)
    expect(mixed.destroyed.map(u => u.type)).toEqual(['cruiser'])
    expect(mixed.lost).toBe(1)
    const fighters = assignHits(units([['fighter', false], ['fighter', false]]), [{ count: 2, mode: 'noFighters' }], letnev, false)
    expect(fighters.destroyed).toHaveLength(0)
    expect(fighters.units).toHaveLength(2)
    expect(fighters.lost).toBe(2)
  })
  it('Duranium Armor repairs one unit that did not sustain this round', () => {
    const base = combat('bereg', ['cruiser'], ['dreadnought', 'dreadnought'], 1)
    const ids = owned(base, 'bereg', 1).map(u => u.id)
    const damaged: GameState = {
      ...base,
      systems: { ...base.systems, bereg: { ...base.systems.bereg, space: base.systems.bereg.space.map(u => u.id === ids[1] ? { ...u, damaged: true } : u) } },
    }
    const hit: HitGroup[] = [{ count: 1, mode: 'any' }]
    const without = applyCombatHits(deepFreeze(damaged), 'bereg', 1, hit)
    expect(without.systems.bereg.space.filter(u => u.owner === 1 && u.damaged)).toHaveLength(2)
    const repaired = applyCombatHits(withTechs(damaged, 1, ['duranium_armor']), 'bereg', 1, hit)
    expect(repaired.systems.bereg.space.filter(u => u.owner === 1 && u.damaged)).toHaveLength(1)
    expect(repaired.systems.bereg.space.filter(u => u.owner === 1)).toHaveLength(2)
  })
  it('destroyed units go back to the reinforcements', () => {
    const s = combat('bereg', ['cruiser'], ['cruiser'], 1)
    const after = applyCombatHits(s, 'bereg', 1, [{ count: 1, mode: 'any' }])
    expect(owned(after, 'bereg', 1)).toHaveLength(0)
    expect(after.players[1].reinforcements.cruiser).toBe(s.players[1].reinforcements.cruiser + 1)
  })
})

describe('R4.1 space combat', () => {
  it('R4.1 step 1: every PDS that is not the active player fires, guardian defender included', () => {
    const base = combat('mecatol', ['fighter', 'fighter', 'fighter'], ['cruiser'], 0, 'guardian')
    const s = withUnits(withPlanetOwner(base, 'mecatol', 'mecatol-rex', 1), 'mecatol', 1, ['pds'], 'mecatol-rex')
    const after = fight(s)
    const entries = after.log.filter(e => e.t === 'roll' && e.context === 'space cannon offense')
    expect(entries).toHaveLength(1)
    expect(entries[0].t === 'roll' && entries[0].owner).toBe(1)
    expect(owned(after, 'mecatol', 0)).toHaveLength(3 - hitsIn(after, 'space cannon offense'))
    expect(after.tactical?.combat?.round).toBe(1)
  })
  it('R4.1 step 1: Graviton Laser System hits are lost against a fighter-only fleet', () => {
    const base = combat('bereg', ['fighter', 'fighter'], ['cruiser'], 0)
    const s = withTechs(withUnits(base, 'bereg', 1, ['pds'], 'bereg'), 1, ['graviton_laser_system'])
    const after = fight(s)
    expect(after.log.some(e => e.t === 'roll' && e.context === 'space cannon offense')).toBe(true)
    expect(owned(after, 'bereg', 0).filter(u => u.type === 'fighter')).toHaveLength(2)
  })
  it('R4.1 step 2: anti-fighter barrage only destroys fighters', () => {
    const s = combat('bereg', ['fighter', 'fighter', 'cruiser'], ['destroyer'], 0)
    const after = fight(s)
    const hits = hitsIn(after, 'anti-fighter barrage')
    expect(owned(after, 'bereg', 0).filter(u => u.type === 'fighter')).toHaveLength(Math.max(0, 2 - hits))
    expect(owned(after, 'bereg', 0).some(u => u.type === 'cruiser')).toBe(true)
  })
  it('R4.1 step 6: the pre-combat steps run as space cannon offense, Assault Cannon, anti-fighter barrage', () => {
    const base = combat('bereg', ['cruiser', 'cruiser', 'cruiser', 'cruiser', 'cruiser'], ['destroyer', 'destroyer'], 0)
    const s = withTechs(withUnits(base, 'bereg', 1, ['pds'], 'bereg'), 0, ['assault_cannon'])
    const after = fight(s)
    const order = after.log.flatMap(e =>
      e.t === 'roll' && e.context === 'space cannon offense' ? ['cannon']
        : e.t === 'info' && e.text.startsWith('Assault Cannon') ? ['assault']
          : e.t === 'roll' && e.context === 'anti-fighter barrage' ? ['barrage'] : [])
    expect(order).toEqual(['cannon', 'assault', 'barrage'])
    expect(owned(after, 'bereg', 1).filter(u => u.type === 'destroyer')).toHaveLength(1)
  })
  it('R4.1 step 6: Assault Cannon destroys one non-fighter ship of the opponent', () => {
    const s = withTechs(combat('bereg', ['cruiser', 'cruiser', 'cruiser'], ['dreadnought', 'fighter'], 0), 0, ['assault_cannon'])
    const after = fight(s)
    expect(owned(after, 'bereg', 1).map(u => u.type)).toEqual(['fighter'])
    expect(after.players[1].reinforcements.dreadnought).toBe(s.players[1].reinforcements.dreadnought + 1)
  })
  it('R4.1 step 3: a combat round rolls every ship, logs both sides and is deterministic for a seed', () => {
    const s = combat('bereg', ['cruiser', 'cruiser'], ['carrier'], 1)
    const after = fight(s)
    expect(after.log.filter(e => e.t === 'roll' && e.context === 'space combat round 1')).toHaveLength(2)
    expect(after.tactical?.combat?.round).toBe(2)
    expect(after.tactical?.combat?.lastRolls.length).toBe(3)
    expect(JSON.stringify(fight(s).systems.bereg.space)).toBe(JSON.stringify(after.systems.bereg.space))
  })
  it('R4.1 step 3: in a nebula the defender hits one lower', () => {
    const inNebula = fight(combat('quann', ['cruiser'], ['cruiser'], 1))
    const defence = inNebula.log.flatMap(e => e.t === 'roll' && e.owner === 1 ? e.rolls : [])
    expect(defence).toHaveLength(1)
    for (const r of defence) expect(r.hit).toBe(r.value >= 6)   // cruiser combat 7, nebula +1
    const plain = fight(combat('bereg', ['cruiser'], ['cruiser'], 1))
    for (const r of plain.log.flatMap(e => e.t === 'roll' && e.owner === 1 ? e.rolls : [])) expect(r.hit).toBe(r.value >= 7)
  })
  it('R4.1 step 3: Munitions Reserves costs Letnev 2 trade goods', () => {
    const base = combat('bereg', ['cruiser'], ['cruiser'], 1)
    const after = fight(withPlayer(base, 1, { tradeGoods: 3 }), 7, true)
    expect(after.players[1].tradeGoods).toBe(1)
    expect(applyMove(base, { type: 'combatRound', munitions: true }, 7).ok).toBe(false)
  })
  it('R4.1 step 6: the combat ends when one side has no ships and the winner goes on', () => {
    const after = fightToEnd(combat('bereg', ['dreadnought', 'dreadnought', 'cruiser'], ['fighter'], 1), 100)
    const attackerLeft = owned(after, 'bereg', 0).length > 0
    expect(after.tactical?.step).toBe(attackerLeft ? 'invasion' : 'done')
    expect(owned(after, 'bereg', 1)).toHaveLength(attackerLeft ? 0 : 1)
  })
  it('R7 Mandate: winning a space combat in Mecatol Rex marks the mandate for the round', () => {
    const after = fightToEnd(combat('mecatol', ['dreadnought', 'dreadnought', 'cruiser'], ['fighter'], 1, 'guardian'), 200)
    expect(after.players[0].mandateEarnedThisRound).toBe(owned(after, 'mecatol', 0).length > 0)
  })
  it('R4.1 step 5: the retreat is announced before a round and carried out after it', () => {
    expect(applyMove(combat('bereg', ['dreadnought'], ['dreadnought'], 1), { type: 'retreat', to: 'home-n' }, 0).ok).toBe(false)
    const later = combat('bereg', ['dreadnought'], ['dreadnought'], 2)
    expect(applyMove(later, { type: 'retreat', to: 'quann' }, 0).ok).toBe(false)                             // no units and no token there
    expect(applyMove(withPlanetOwner(later, 'quann', 'quann', 0), { type: 'retreat', to: 'quann' }, 0).ok).toBe(false)   // a controlled planet is not enough
    const announced = applyMove(later, { type: 'retreat', to: 'home-n' }, 0)
    if (!announced.ok) throw new Error(announced.error)
    expect(announced.value.tactical?.combat).toMatchObject({ retreating: 0, retreatTo: 'home-n' })
    expect(announced.value.tactical?.step).toBe('spaceCombat')
    expect(owned(announced.value, 'bereg', 0)).toHaveLength(1)                                              // nothing has moved yet
    expect(applyMove(announced.value, { type: 'retreat', to: 'home-n' }, 0).ok).toBe(false)                  // one announcement per combat
    // one dreadnought per side rolls at most one hit, which the other side sustains, so both survive the round
    const after = fight(announced.value, 3)
    expect(owned(after, 'bereg', 0)).toHaveLength(0)
    expect(owned(after, 'home-n', 0).filter(u => u.type === 'dreadnought')).toHaveLength(2)
    expect(after.tactical?.step).toBe('done')
    expect(after.log.some(e => e.t === 'info' && e.text.includes('retreats'))).toBe(true)
  })
  it('R4.1 step 5: an announced retreat is dropped when the combat ends in that round', () => {
    const announced = applyMove(combat('bereg', ['dreadnought', 'dreadnought', 'cruiser'], ['fighter'], 2), { type: 'retreat', to: 'home-n' }, 0)
    if (!announced.ok) throw new Error(announced.error)
    const after = fightToEnd(announced.value, 400)
    const attackerLeft = owned(after, 'bereg', 0).length > 0
    const defenderLeft = owned(after, 'bereg', 1).length > 0
    expect(after.tactical?.step).toBe(attackerLeft && !defenderLeft ? 'invasion' : 'done')
  })
  it('R4.1 step 6: carried infantry are trimmed when the combat ends, not after a single round', () => {
    const base = withUnits(combat('bereg', ['carrier'], ['cruiser', 'cruiser', 'cruiser'], 1), 'bereg', 0, ['infantry', 'infantry'])
    expect(unitStats('carrier', letnev).capacity).toBe(4)
    const after = fightToEnd(base, 300)
    const mine = owned(after, 'bereg', 0)
    expect(mine.filter(u => u.type === 'infantry')).toHaveLength(mine.some(u => u.type === 'carrier') ? 2 : 0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/engine/combat.test.ts`
Expected: FAIL, `Cannot find module './combat'`.

- [ ] **Step 3: Implement space combat**

```ts
// src/engine/combat.ts
import { MECATOL_ID, systemDef } from '../data/map'
import { NON_FIGHTER_SHIPS, isShip, unitStats, type StatsOwner } from '../data/units'
import { otherSeat } from './actionPhase'
import { neighbours } from './adjacency'
import { destroyUnits, dieRolls, hasTech, rollHits, shipsOf, statsOwner, trimCargo } from './board'
import { deriveSeed, mulberry32 } from './rng'
import type { DieRoll, GameState, Owner, Result, Seat, Unit, UnitType } from './types'

const DESTROY_ORDER: readonly UnitType[] = ['fighter', 'destroyer', 'cruiser', 'carrier', 'dreadnought', 'flagship', 'warsun']
const NON_FIGHTER_ORDER: readonly UnitType[] = DESTROY_ORDER.filter(t => t !== 'fighter')

export type HitMode = 'any' | 'noFighters' | 'preferNonFighters'
export interface HitGroup { count: number; mode: HitMode }
const MODE_RANK: Record<HitMode, number> = { noFighters: 0, preferNonFighters: 1, any: 2 }

interface Ctx { systemId: string; attacker: Seat; defender: Owner; round: number }

/** R4.1 step 3: the defender rolls at +1 in a nebula, which is one lower on the threshold. */
export function defenderModifier(systemId: string): number {
  return systemDef(systemId).anomaly === 'nebula' ? 1 : 0
}

/** R4.1 steps 4 and 6: sustain first, then the destruction order; restricted hits with no target are lost. */
export function assignHits(units: Unit[], groups: HitGroup[], owner: StatsOwner, nes: boolean): { units: Unit[]; destroyed: Unit[]; sustainedIds: number[]; lost: number } {
  let list = units.map(u => ({ ...u }))
  const destroyed: Unit[] = []
  const sustainedIds: number[] = []
  const queue = groups.filter(g => g.count > 0).map(g => ({ ...g })).sort((a, b) => MODE_RANK[a.mode] - MODE_RANK[b.mode])
  let lost = 0
  for (const u of list) {
    if (!queue.some(g => g.count > 0)) break
    if (u.damaged || !unitStats(u.type, owner).sustain) continue
    u.damaged = true
    sustainedIds.push(u.id)
    let cancel = nes ? 2 : 1
    for (const g of queue) {
      const take = Math.min(cancel, g.count)
      g.count -= take
      cancel -= take
      if (cancel <= 0) break
    }
  }
  for (const g of queue) {
    while (g.count > 0) {
      const first = (types: readonly UnitType[]) => types.flatMap(t => list.filter(u => u.type === t))[0]
      const target = g.mode === 'noFighters' ? first(NON_FIGHTER_ORDER)
        : g.mode === 'preferNonFighters' ? (first(NON_FIGHTER_ORDER) ?? first(DESTROY_ORDER))
          : first(DESTROY_ORDER)
      if (!target) {
        if (g.mode === 'noFighters' && list.length) lost += g.count
        break
      }
      list = list.filter(u => u.id !== target.id)
      destroyed.push(target)
      g.count--
    }
  }
  return { units: list, destroyed, sustainedIds, lost }
}

export function applyCombatHits(state: GameState, systemId: string, owner: Owner, groups: HitGroup[]): GameState {
  if (!groups.some(g => g.count > 0)) return state
  const sys = state.systems[systemId]
  const result = assignHits(shipsOf(sys, owner), groups, statsOwner(state, owner), hasTech(state, owner, 'non_euclidean_shielding'))
  let kept = result.units
  if (hasTech(state, owner, 'duranium_armor')) {
    const repair = kept.find(u => u.damaged && !result.sustainedIds.includes(u.id))
    if (repair) kept = kept.map(u => u.id === repair.id ? { ...u, damaged: false } : u)
  }
  const others = sys.space.filter(u => !(u.owner === owner && isShip(u.type)))
  const next: GameState = { ...state, systems: { ...state.systems, [systemId]: { ...sys, space: [...others, ...kept] } } }
  return destroyUnits(next, systemId, result.destroyed)
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
  const l1z1x = owner !== 'guardian' && state.players[owner].faction === 'l1z1x'
  const rolls: DieRoll[] = []
  let hits = 0
  let restricted = 0
  for (const u of shipsOf(state.systems[ctx.systemId], owner)) {
    const stats = unitStats(u.type, sOwner)
    if (stats.combat === null) continue
    const value = stats.combat - bonus
    let roll = rollHits(rng, stats.combatDice, value, false)
    if (reroll) {
      const again = rollHits(rng, roll.rolls.filter(v => v < value).length, value, false)
      roll = { rolls: [...roll.rolls.filter(v => v >= value), ...again.rolls], hits: roll.hits + again.hits }
    }
    rolls.push(...dieRolls(owner, u.type, roll.rolls, value))
    hits += roll.hits
    if (l1z1x && (u.type === 'dreadnought' || u.type === 'flagship')) restricted += roll.hits
  }
  return { rolls, hits, restricted }
}

/** R4.1 step 1: the PDS of every owner in the system except the active player fire at the attacker. */
function spaceCannonOffense(state: GameState, ctx: Ctx, seed: number): GameState {
  const shooters: Owner[] = []
  for (const p of state.systems[ctx.systemId].planets) for (const u of p.structures) {
    if (u.owner !== ctx.attacker && !shooters.includes(u.owner)) shooters.push(u.owner)
  }
  let next = state
  let salt = 1
  for (const owner of shooters) {
    const sOwner = statsOwner(next, owner)
    const pds = next.systems[ctx.systemId].planets.flatMap(p => p.structures.filter(u => u.owner === owner && unitStats(u.type, sOwner).spaceCannon))
    if (!pds.length) continue
    const rng = mulberry32(deriveSeed(seed, salt++))
    const rolls: DieRoll[] = []
    let extraDie = hasTech(next, owner, 'plasma_scoring')
    let hits = 0
    for (const u of pds) {
      const sc = unitStats(u.type, sOwner).spaceCannon
      if (!sc) continue
      const roll = rollHits(rng, sc.dice, sc.value, extraDie)
      extraDie = false
      rolls.push(...dieRolls(owner, u.type, roll.rolls, sc.value))
      hits += roll.hits
    }
    next = { ...next, log: [...next.log, { t: 'roll', owner, rolls, context: 'space cannon offense' }] }
    const mode: HitMode = hasTech(next, owner, 'graviton_laser_system') ? 'noFighters' : 'any'
    next = applyCombatHits(next, ctx.systemId, ctx.attacker, [{ count: hits, mode }])
  }
  return next
}

/** R4.1 step 6: with 3 or more non-fighter ships the opponent loses one non-fighter ship. */
function assaultCannon(state: GameState, ctx: Ctx): GameState {
  let next = state
  for (const [side, foe] of [[ctx.attacker, ctx.defender], [ctx.defender, ctx.attacker]] as [Owner, Owner][]) {
    if (!hasTech(next, side, 'assault_cannon')) continue
    const sys = next.systems[ctx.systemId]
    if (shipsOf(sys, side).filter(u => NON_FIGHTER_SHIPS.includes(u.type)).length < 3) continue
    const victim = NON_FIGHTER_ORDER.flatMap(t => shipsOf(sys, foe).filter(u => u.type === t))[0]
    if (!victim) continue
    next = destroyUnits(next, ctx.systemId, [victim])
    next = { ...next, log: [...next.log, { t: 'info', text: `Assault Cannon destroys a ${victim.type}` }] }
  }
  return next
}

/** R4.1 step 2: destroyer barrage, hits destroy enemy fighters only. */
function antiFighterBarrage(state: GameState, ctx: Ctx, seed: number): GameState {
  let next = state
  let salt = 3
  for (const [side, foe] of [[ctx.attacker, ctx.defender], [ctx.defender, ctx.attacker]] as [Owner, Owner][]) {
    const sOwner = statsOwner(next, side)
    const rng = mulberry32(deriveSeed(seed, salt++))
    const rolls: DieRoll[] = []
    let hits = 0
    for (const u of shipsOf(next.systems[ctx.systemId], side)) {
      const afb = unitStats(u.type, sOwner).afb
      if (!afb) continue
      const roll = rollHits(rng, afb.dice, afb.value, false)
      rolls.push(...dieRolls(side, u.type, roll.rolls, afb.value))
      hits += roll.hits
    }
    if (!rolls.length) continue
    next = { ...next, log: [...next.log, { t: 'roll', owner: side, rolls, context: 'anti-fighter barrage' }] }
    next = destroyUnits(next, ctx.systemId, shipsOf(next.systems[ctx.systemId], foe).filter(u => u.type === 'fighter').slice(0, hits))
  }
  return next
}

function markMandate(state: GameState, ctx: Ctx): GameState {
  if (ctx.systemId !== MECATOL_ID && systemDef(ctx.systemId).home !== otherSeat(ctx.attacker)) return state
  const players = [...state.players] as GameState['players']
  players[ctx.attacker] = { ...players[ctx.attacker], mandateEarnedThisRound: true }
  return { ...state, players, log: [...state.log, { t: 'info', text: `Mandate First Strike earned by seat ${ctx.attacker}` }] }
}

/** Cargo above the remaining capacity is destroyed when the combat is over. */
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
    return { ok: true, value: finish(antiFighterBarrage(assaultCannon(spaceCannonOffense(state, ctx, seed), ctx), ctx, seed), ctx, []) }
  }
  const users = [ctx.attacker, ctx.defender].filter(o => munitions && canMunitions(state, o))
  if (munitions && !users.length) return { ok: false, error: 'Munitions Reserves is not available' }
  const salt = ctx.round * 4
  const a = combatRolls(state, ctx, ctx.attacker, 0, users.includes(ctx.attacker), seed, salt + 10)
  const d = combatRolls(state, ctx, ctx.defender, defenderModifier(ctx.systemId), users.includes(ctx.defender), seed, salt + 11)
  let next = state
  for (const o of users) next = payMunitions(next, o)
  next = { ...next, log: [...next.log,
    { t: 'roll', owner: ctx.attacker, rolls: a.rolls, context: `space combat round ${ctx.round}` },
    { t: 'roll', owner: ctx.defender, rolls: d.rolls, context: `space combat round ${ctx.round}` }] }
  next = applyCombatHits(next, ctx.systemId, ctx.defender, [{ count: a.hits - a.restricted, mode: 'any' }, { count: a.restricted, mode: 'preferNonFighters' }])
  next = applyCombatHits(next, ctx.systemId, ctx.attacker, [{ count: d.hits - d.restricted, mode: 'any' }, { count: d.restricted, mode: 'preferNonFighters' }])
  return { ok: true, value: finish(next, ctx, [...a.rolls, ...d.rolls]) }
}

/** R4.1 step 5: adjacent systems that hold the retreating player's units or command token and no enemy ships. */
export function retreatTargets(state: GameState, seat: Seat): string[] {
  const tac = state.tactical
  if (!tac) return []
  return neighbours(tac.systemId).filter(id => {
    const sys = state.systems[id]
    if (sys.space.some(u => u.owner !== seat && isShip(u.type))) return false
    return sys.activatedBy.includes(seat)
      || sys.space.some(u => u.owner === seat)
      || sys.planets.some(p => p.ground.some(u => u.owner === seat))
  })
}

/** R4.1 step 5: announcement only; the next `combatRound` fights the round and then carries it out. */
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

- [ ] **Step 4: Wire the dispatcher**

In `src/engine/index.ts` add `import { combatRound, retreat } from './combat'`, delete the `void seed` line and add:

```ts
    case 'combatRound': result = combatRound(state, move.munitions ?? false, seed); break
    case 'retreat': result = retreat(state, move.to); break
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/engine/combat.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 6: Type-check and commit**

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
- Produces in `invasion.ts` (every enumerator works on the active player, so none of them takes a seat):
  ```ts
  export function bombardablePlanets(state: GameState): string[]
  export function landablePlanets(state: GameState): { planetId: string; infantryIds: number[] }[]
  export function groundCombatPending(state: GameState): boolean
  export function bombard(state: GameState, planetId: string, seed: number): Result<GameState>
  export function land(state: GameState, planetId: string, infantryIds: number[], seed: number): Result<GameState>
  export function groundCombatRound(state: GameState, seed: number): Result<GameState>
  export function endInvasion(state: GameState): Result<GameState>
  ```
  R4.3 step 1: bombardment rolls every ship of the seat with `bombardment` in the system, Plasma Scoring adds one die to one of them, and an enemy planetary shield blocks it unless the seat's Letnev flagship (Arc Secundus) is in the system. L4 Disruptors does **not** affect bombardment; it only negates space cannon defense in step 3. Each planet may be bombarded once per invasion. Landing takes infantry out of the system's `space` array, lets the planet's enemy PDS fire (hit 6+, Plasma Scoring extra die) unless the seat has `l4_disruptors`, and puts the survivors on the planet. Ground combat rolls both sides simultaneously (infantry 8, Infantry II 7); Harrow lets L1Z1X bombard again automatically after each round. Control changes when the seat has ground forces on the planet and no defender is left: owner becomes the seat, the planet is exhausted, structures are destroyed, and L1Z1X (Assimilate) replaces them from its own reinforcements. `endInvasion` goes to `'production'` when the seat owns a space dock in the system, otherwise to `'done'`, and is rejected while a ground combat is pending.
  `landablePlanets` and `bombardablePlanets` mirror the validators exactly, so every enumerated move is accepted.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/invasion.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { carriedIds, deepFreeze, hitsIn, toActionPhase, withPlanetOwner, withTactical, withTechs, withUnits } from './testUtils'
import type { GameState, Move, Seat, UnitType } from './types'

/** Clears the system, gives the seat ships plus carried infantry and opens the invasion step. */
function invasion(systemId: string, ships: UnitType[], carried: number, seat: Seat = 0): GameState {
  const base = toActionPhase(1, seat)
  const cleared: GameState = { ...base, systems: { ...base.systems, [systemId]: { ...base.systems[systemId], space: [] } } }
  const troops: UnitType[] = Array.from({ length: carried }, () => 'infantry')
  const s = withUnits(cleared, systemId, seat, [...ships, ...troops])
  return withTactical(s, { systemId, step: 'invasion', invasion: { planetId: null, landed: [], bombarded: [] } })
}

const apply = (state: GameState, move: Move, seed = 5) => {
  const r = applyMove(deepFreeze(state), move, seed)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

const planet = (state: GameState, systemId: string, planetId: string) => {
  const p = state.systems[systemId].planets.find(x => x.id === planetId)
  if (!p) throw new Error(`no planet ${planetId}`)
  return p
}

const groundOf = (state: GameState, systemId: string, planetId: string, owner: Seat | 'guardian') =>
  planet(state, systemId, planetId).ground.filter(u => u.owner === owner)

describe('R4.3 invasion', () => {
  it('R4.3 step 1: bombardment destroys ground forces and each planet is bombarded once', () => {
    const s = withUnits(invasion('bereg', ['dreadnought'], 0), 'bereg', 1, ['infantry', 'infantry', 'infantry'], 'bereg')
    const after = apply(s, { type: 'bombard', planetId: 'bereg' })
    expect(groundOf(after, 'bereg', 'bereg', 1)).toHaveLength(3 - hitsIn(after, 'bombardment of bereg'))
    expect(after.tactical?.invasion?.bombarded).toEqual(['bereg'])
    expect(applyMove(after, { type: 'bombard', planetId: 'bereg' }, 5).ok).toBe(false)
    expect(applyMove(s, { type: 'bombard', planetId: 'lirta-iv' }, 5).ok).toBe(false)   // no ground forces there
  })
  it('R4.3 step 1: a planetary shield blocks the bombardment, L4 Disruptors does not help, Arc Secundus does', () => {
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
    expect(rolls).toHaveLength(2)   // the dreadnought's die plus the Plasma Scoring die
  })
  it('R4.3 steps 2 and 3: landing infantry are shot at by the PDS on the planet unless L4 Disruptors', () => {
    const base = withUnits(invasion('bereg', ['carrier'], 3), 'bereg', 1, ['pds'], 'bereg')
    const after = apply(base, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(base, 'bereg', 0) })
    expect(groundOf(after, 'bereg', 'bereg', 0)).toHaveLength(3 - hitsIn(after, 'space cannon defense on bereg'))
    expect(after.systems.bereg.space.filter(u => u.type === 'infantry')).toHaveLength(0)
    const letnev = withTechs(withUnits(invasion('bereg', ['carrier'], 3, 1), 'bereg', 0, ['pds'], 'bereg'), 1, ['l4_disruptors'])
    const safe = apply(letnev, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(letnev, 'bereg', 1) })
    expect(groundOf(safe, 'bereg', 'bereg', 1)).toHaveLength(3)
    expect(safe.log.some(e => e.t === 'roll' && e.context === 'space cannon defense on bereg')).toBe(false)
  })
  it('R4.3 step 4: ground combat rolls both sides until one of them is gone', () => {
    const base = withUnits(invasion('bereg', ['carrier'], 2), 'bereg', 1, ['infantry', 'infantry'], 'bereg')
    let s = apply(base, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(base, 'bereg', 0) })
    expect(s.tactical?.invasion?.planetId).toBe('bereg')
    for (let i = 0; i < 30; i++) {
      const ground = planet(s, 'bereg', 'bereg').ground
      if (!ground.some(u => u.owner === 0) || !ground.some(u => u.owner === 1)) break
      s = apply(s, { type: 'groundCombatRound' }, 20 + i)
    }
    const ground = planet(s, 'bereg', 'bereg').ground
    expect(ground.some(u => u.owner === 0) && ground.some(u => u.owner === 1)).toBe(false)
    expect(s.log.some(e => e.t === 'roll' && e.context === 'ground combat on bereg')).toBe(true)
    expect(planet(s, 'bereg', 'bereg').owner).toBe(ground.some(u => u.owner === 0) ? 0 : null)
  })
  it('R4.3 step 5: control changes, the planet is exhausted and the structures are destroyed', () => {
    const base = withUnits(invasion('bereg', ['carrier'], 2, 1), 'bereg', 0, ['spacedock'], 'bereg')
    const s = withPlanetOwner(base, 'bereg', 'bereg', 0)
    const after = apply(s, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(s, 'bereg', 1) })
    const p = planet(after, 'bereg', 'bereg')
    expect(p.owner).toBe(1)
    expect(p.exhausted).toBe(true)
    expect(p.structures).toEqual([])
    expect(after.players[0].reinforcements.spacedock).toBe(s.players[0].reinforcements.spacedock + 1)
  })
  it('R4.3 step 5: L1Z1X Assimilate replaces the structures with its own', () => {
    const base = withUnits(invasion('bereg', ['carrier'], 2), 'bereg', 1, ['spacedock'], 'bereg')
    const s = withPlanetOwner(base, 'bereg', 'bereg', 1)
    const after = apply(s, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(s, 'bereg', 0) })
    const p = planet(after, 'bereg', 'bereg')
    expect(p.owner).toBe(0)
    expect(p.structures.map(u => u.type)).toEqual(['spacedock'])
    expect(p.structures.every(u => u.owner === 0)).toBe(true)
    expect(after.players[0].reinforcements.spacedock).toBe(s.players[0].reinforcements.spacedock - 1)
    expect(after.players[1].reinforcements.spacedock).toBe(s.players[1].reinforcements.spacedock + 1)
  })
  it('R4.2: guardian infantry on Mecatol Rex defend normally', () => {
    const base = invasion('mecatol', ['carrier'], 3)
    let s = apply(base, { type: 'land', planetId: 'mecatol-rex', infantryIds: carriedIds(base, 'mecatol', 0) })
    expect(groundOf(s, 'mecatol', 'mecatol-rex', 'guardian')).toHaveLength(2)
    for (let i = 0; i < 30; i++) {
      const ground = planet(s, 'mecatol', 'mecatol-rex').ground
      if (!ground.some(u => u.owner === 0) || !ground.some(u => u.owner === 'guardian')) break
      s = apply(s, { type: 'groundCombatRound' }, 40 + i)
    }
    const mine = groundOf(s, 'mecatol', 'mecatol-rex', 0)
    expect(planet(s, 'mecatol', 'mecatol-rex').owner).toBe(mine.length ? 0 : null)
  })
  it('HARROW: L1Z1X bombards again after each ground combat round', () => {
    const base = withUnits(invasion('bereg', ['carrier', 'dreadnought'], 2), 'bereg', 1, ['infantry', 'infantry', 'infantry', 'infantry'], 'bereg')
    const landed = apply(base, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(base, 'bereg', 0) })
    const after = apply(landed, { type: 'groundCombatRound' }, 11)
    expect(after.log.some(e => e.t === 'roll' && e.context === 'Harrow bombardment of bereg')).toBe(true)
    const letnev = withUnits(invasion('bereg', ['carrier', 'dreadnought'], 2, 1), 'bereg', 0, ['infantry', 'infantry', 'infantry', 'infantry'], 'bereg')
    const other = apply(apply(letnev, { type: 'land', planetId: 'bereg', infantryIds: carriedIds(letnev, 'bereg', 1) }), { type: 'groundCombatRound' }, 11)
    expect(other.log.some(e => e.t === 'roll' && e.context === 'Harrow bombardment of bereg')).toBe(false)
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
    expect(applyMove(landed, { type: 'endInvasion' }, 0).ok).toBe(false)
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
import { destroyUnits, dieRolls, hasTech, removeUnits, rollHits, statsOwner } from './board'
import { deriveSeed, mulberry32 } from './rng'
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
  let extraDie = state.players[seat].techs.includes('plasma_scoring')
  let hits = 0
  for (const u of ships) {
    const b = unitStats(u.type, sOwner).bombardment
    if (!b) continue
    const roll = rollHits(rng, b.dice, b.value, extraDie)
    extraDie = false
    rolls.push(...dieRolls(seat, u.type, roll.rolls, b.value))
    hits += roll.hits
  }
  const logged: GameState = { ...state, log: [...state.log, { t: 'roll', owner: seat, rolls, context }] }
  const planet = planetOf(logged, systemId, planetId)
  if (!planet) return logged
  return destroyUnits(logged, systemId, planet.ground.filter(u => u.owner !== seat).slice(0, hits))
}

export function bombardablePlanets(state: GameState): string[] {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion) return []
  const seat = state.active
  const sOwner = statsOwner(state, seat)
  const canBombard = state.systems[tac.systemId].space.some(u => u.owner === seat && isShip(u.type) && unitStats(u.type, sOwner).bombardment)
  if (!canBombard) return []
  return state.systems[tac.systemId].planets
    .filter(p => !tac.invasion?.bombarded.includes(p.id)
      && p.ground.some(u => u.owner !== seat)
      && !shieldBlocks(state, tac.systemId, p.id, seat))
    .map(p => p.id)
}

export function groundCombatPending(state: GameState): boolean {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion || !tac.invasion.planetId) return false
  const planet = planetOf(state, tac.systemId, tac.invasion.planetId)
  if (!planet) return false
  const seat = state.active
  return planet.ground.some(u => u.owner === seat) && planet.ground.some(u => u.owner !== seat)
}

export function landablePlanets(state: GameState): { planetId: string; infantryIds: number[] }[] {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion' || !tac.invasion) return []
  const seat = state.active
  const infantryIds = state.systems[tac.systemId].space.filter(u => u.owner === seat && u.type === 'infantry').map(u => u.id)
  if (!infantryIds.length) return []
  const busy = groundCombatPending(state) ? tac.invasion.planetId : null
  return state.systems[tac.systemId].planets
    .filter(p => !busy || p.id === busy)
    .map(p => ({ planetId: p.id, infantryIds }))
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
    systems: {
      ...state.systems,
      [systemId]: { ...sys, planets: sys.planets.map(p => p.id === planetId ? { ...p, owner: seat, exhausted: true, structures: replacements } : p) },
    },
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
  if (groundCombatPending(state) && tac.invasion.planetId !== planetId) return { ok: false, error: 'finish the running ground combat first' }
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
    const defender: Owner = pds[0].owner
    const sOwner = statsOwner(state, defender)
    const rng = mulberry32(deriveSeed(seed, 2))
    const rolls: DieRoll[] = []
    let extraDie = hasTech(state, defender, 'plasma_scoring')
    let hits = 0
    for (const u of pds) {
      const sc = unitStats(u.type, sOwner).spaceCannon
      if (!sc) continue
      const roll = rollHits(rng, sc.dice, sc.value, extraDie)
      extraDie = false
      rolls.push(...dieRolls(defender, u.type, roll.rolls, sc.value))
      hits += roll.hits
    }
    next = { ...next, log: [...next.log, { t: 'roll', owner: defender, rolls, context: `space cannon defense on ${planetId}` }] }
    next = destroyUnits(next, tac.systemId, survivors.slice(0, hits))
    survivors = survivors.slice(hits)
  }
  next = removeUnits(next, tac.systemId, survivors.map(u => u.id))
  const target = next.systems[tac.systemId]
  next = {
    ...next,
    systems: {
      ...next.systems,
      [tac.systemId]: { ...target, planets: target.planets.map(p => p.id === planetId ? { ...p, ground: [...p.ground, ...survivors] } : p) },
    },
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
    const roll = rollHits(rng, stats.combatDice, stats.combat, false)
    rolls.push(...dieRolls(owner, u.type, roll.rolls, stats.combat))
    hits += roll.hits
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
  // HARROW: L1Z1X may bombard after every ground combat round; v1 does it automatically
  if (state.players[seat].faction === 'l1z1x' && after && after.ground.some(u => u.owner !== seat) && !shieldBlocks(next, tac.systemId, planetId, seat)) {
    next = bombardment(next, tac.systemId, planetId, seat, seed, 5, `Harrow bombardment of ${planetId}`)
  }
  return { ok: true, value: resolveControl(next, tac.systemId, planetId, seat) }
}

export function endInvasion(state: GameState): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'invasion') return { ok: false, error: 'not in the invasion step' }
  if (groundCombatPending(state)) return { ok: false, error: 'the ground combat is unresolved' }
  const seat = state.active
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
  export const PRODUCIBLE: readonly UnitType[]     // infantry, fighter, destroyer, cruiser, carrier, dreadnought, warsun, flagship
  export function produce(state: GameState, units: Partial<Record<UnitType, number>>, planets: string[], tradeGoods: number): Result<GameState>
  ```
  R4.4: the seat needs its own space dock in the active system; PDS and space docks cannot be produced (no Construction in the duel); a War Sun needs the `war_sun` technology; only one flagship per player may exist; reinforcements limit each type. **Fighters above the capacity of the ships in the system plus the Space Dock II slots are trimmed before payment: the move succeeds with the trimmed count and logs an info entry**; non-fighter ships beyond the fleet pool (Armada +2) make the production illegal. The unit count of the trimmed order may not exceed `productionLimit`; the cost comes from `productionCost` (Sarween Tools included) and is paid with `payCost`, overpay is lost; the highest cost of the round is stored in `spentInOneProductionThisRound` (R7 objective 4). Ships appear in the system's space, infantry on the dock's planet, and the step becomes `'done'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/production.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { deepFreeze, toActionPhase, withPlayer, withTactical, withTechs, withUnits } from './testUtils'
import type { GameState, UnitType } from './types'

/** Seat 0 in the production step of its own home system: dock on a 5 resource planet, fleet pool 3, capacity 6. */
const producing = (seed = 1) => withTactical(toActionPhase(seed), { systemId: 'home-n', step: 'production' })

const produce = (state: GameState, units: Partial<Record<UnitType, number>>, planets: string[], tradeGoods = 0) =>
  applyMove(deepFreeze(state), { type: 'produce', units, planets, tradeGoods }, 0)

const fighters = (state: GameState) => state.systems['home-n'].space.filter(u => u.owner === 0 && u.type === 'fighter').length

describe('R4.4 production', () => {
  it('produces ships into the space and infantry onto the dock planet, then finishes the step', () => {
    const s = producing()
    const r = produce(s, { cruiser: 1, infantry: 2 }, ['000'])
    if (!r.ok) throw new Error(r.error)
    expect(r.value.systems['home-n'].space.filter(u => u.owner === 0 && u.type === 'cruiser')).toHaveLength(1)
    expect(r.value.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(7)
    expect(r.value.systems['home-n'].planets[0].exhausted).toBe(true)
    expect(r.value.players[0].reinforcements.cruiser).toBe(s.players[0].reinforcements.cruiser - 1)
    expect(r.value.players[0].reinforcements.infantry).toBe(s.players[0].reinforcements.infantry - 2)
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
    expect(produce(s, { fighter: 2, infantry: 2 }, []).ok).toBe(false)     // cost 2, nothing paid
    expect(produce(s, { fighter: 2, infantry: 2 }, ['000']).ok).toBe(true)
    expect(produce(withTechs(s, 0, ['sarween_tools']), { infantry: 2 }, []).ok).toBe(true)   // cost 1 minus 1
  })
  it('R4.4: a War Sun needs the technology and only one flagship may exist', () => {
    const rich = withPlayer(producing(), 0, { tradeGoods: 20 })
    expect(produce(rich, { warsun: 1 }, [], 12).ok).toBe(false)
    expect(produce(withTechs(rich, 0, ['war_sun']), { warsun: 1 }, [], 12).ok).toBe(true)    // 3 non-fighter ships is exactly the fleet pool
    expect(produce(rich, { flagship: 2 }, [], 16).ok).toBe(false)
    expect(produce(withUnits(rich, 'home-n', 0, ['flagship']), { flagship: 1 }, [], 8).ok).toBe(false)
  })
  it('R4.4: reinforcements and the fleet pool limit the production', () => {
    const s = producing()
    const empty = withPlayer(s, 0, { reinforcements: { ...s.players[0].reinforcements, cruiser: 0 }, tradeGoods: 20 })
    expect(produce(empty, { cruiser: 1 }, [], 2).ok).toBe(false)
    const rich = withTechs(withPlayer(s, 0, { tradeGoods: 20 }), 0, ['war_sun'])
    expect(produce(rich, { warsun: 1, cruiser: 1 }, [], 14).ok).toBe(false)   // 2 present plus 2 produced is over the fleet pool of 3
    expect(produce(rich, { cruiser: 1 }, [], 2).ok).toBe(true)
  })
  it('R4.4: fighters above the capacity are trimmed and the production still succeeds', () => {
    const rich = withPlayer(producing(), 0, { tradeGoods: 10 })
    expect(fighters(rich)).toBe(3)                                  // carrier 4 plus super-dreadnought 2 is capacity 6
    const r = produce(rich, { fighter: 6 }, [], 3)
    if (!r.ok) throw new Error(r.error)
    expect(fighters(r.value)).toBe(6)                               // only three fit
    expect(r.value.log.some(e => e.t === 'info' && e.text.includes('not produced'))).toBe(true)
    const dock2 = produce(withTechs(rich, 0, ['space_dock_ii']), { fighter: 6 }, [], 3)
    if (!dock2.ok) throw new Error(dock2.error)
    expect(fighters(dock2.value)).toBe(9)                           // three free Space Dock II slots
    const none = produce(withPlayer(rich, 0, { tradeGoods: 10 }), { fighter: 0 }, [])
    expect(none.ok).toBe(false)
  })
  it('R4.4: PDS and space docks cannot be produced in the duel', () => {
    const s = producing()
    expect(produce(s, { pds: 1 }, ['000']).ok).toBe(false)
    expect(produce(s, { spacedock: 1 }, ['000']).ok).toBe(false)
  })
  it('R7 objective 4: the highest spend of the round is recorded', () => {
    const first = produce(producing(), { infantry: 2 }, ['000'])
    if (!first.ok) throw new Error(first.error)
    expect(first.value.players[0].spentInOneProductionThisRound).toBe(1)
    const again = withPlayer(withTactical(first.value, { systemId: 'home-n', step: 'production' }), 0, { tradeGoods: 6 })
    const second = produce(again, { dreadnought: 1, infantry: 4 }, [], 6)   // 4 + 2 resources, 5 units, one more non-fighter ship
    if (!second.ok) throw new Error(second.error)
    expect(second.value.players[0].spentInOneProductionThisRound).toBe(6)
    expect(second.value.players[0].tradeGoods).toBe(0)
    expect(second.value.systems['home-n'].space.filter(u => u.owner === 0 && u.type === 'dreadnought')).toHaveLength(2)
    expect(second.value.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(11)
  })
  it('production needs a space dock of your own in the active system and the production step', () => {
    const s = producing()
    expect(produce(withTactical(s, { systemId: 'bereg', step: 'production' }), { infantry: 2 }, ['000']).ok).toBe(false)
    expect(produce(withTactical(s, { systemId: 'home-n', step: 'movement' }), { infantry: 2 }, ['000']).ok).toBe(false)
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
import { checkFleet, freeFighterSlots } from './board'
import { capacity, payCost, productionCost, productionLimit } from './economy'
import { unitsOf } from './setup'
import type { GameState, Result, Seat, Unit, UnitType } from './types'

export const PRODUCIBLE: readonly UnitType[] = ['infantry', 'fighter', 'destroyer', 'cruiser', 'carrier', 'dreadnought', 'warsun', 'flagship']

/** R4.4: how many more fighters the system can hold, capacity plus the Space Dock II slots. */
function fighterRoom(state: GameState, seat: Seat, systemId: string): number {
  const player = state.players[seat]
  const stats: StatsOwner = { faction: player.faction, techs: player.techs }
  const space = state.systems[systemId].space
  const carried = space.filter(u => u.owner === seat && (u.type === 'fighter' || u.type === 'infantry')).length
  return Math.max(0, capacity(space, seat, stats) + freeFighterSlots(state, seat, systemId) - carried)
}

export function produce(state: GameState, units: Partial<Record<UnitType, number>>, planets: string[], tradeGoods: number): Result<GameState> {
  const tac = state.tactical
  if (!tac || tac.step !== 'production') return { ok: false, error: 'not in the production step' }
  const seat = state.active
  const player = state.players[seat]
  const dockPlanet = state.systems[tac.systemId].planets.find(p => p.structures.some(u => u.type === 'spacedock' && u.owner === seat))
  if (!dockPlanet) return { ok: false, error: 'R4.4: no space dock of your own in the active system' }
  for (const [type, n] of Object.entries(units) as [UnitType, number][]) {
    if (n === 0) continue
    if (n < 0 || !Number.isInteger(n)) return { ok: false, error: `invalid count for ${type}` }
    if (!PRODUCIBLE.includes(type)) return { ok: false, error: `R4.4: ${type} cannot be produced` }
    if (type === 'warsun' && !player.techs.includes('war_sun')) return { ok: false, error: 'R4.4: a War Sun needs the War Sun technology' }
    if (player.reinforcements[type] < n) return { ok: false, error: `not enough ${type} in the reinforcements` }
  }
  // R4.4: fighters above the capacity are simply not produced
  const wanted = units.fighter ?? 0
  const room = fighterRoom(state, seat, tac.systemId)
  const trimmedFighters = Math.max(0, wanted - room)
  const order: Partial<Record<UnitType, number>> = trimmedFighters ? { ...units, fighter: room } : units
  const entries = (Object.entries(order) as [UnitType, number][]).filter(([, n]) => n > 0)
  if (!entries.length) return { ok: false, error: 'nothing to produce' }
  const flagships = order.flagship ?? 0
  if (flagships > 1 || (flagships === 1 && unitsOf(state, seat).some(u => u.type === 'flagship'))) {
    return { ok: false, error: 'R4.4: only one flagship at a time' }
  }
  const total = entries.reduce((sum, [, n]) => sum + n, 0)
  const limit = productionLimit(state, seat, tac.systemId)
  if (total > limit) return { ok: false, error: `R4.4: production limit ${limit} exceeded by ${total} units` }
  const stats: StatsOwner = { faction: player.faction, techs: player.techs }
  const cost = productionCost(order, stats, player.techs.includes('sarween_tools'))
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
  const log = [...paid.value.log, { t: 'info' as const, text: `seat ${seat} produces ${total} units for ${cost}` }]
  if (trimmedFighters) log.push({ t: 'info' as const, text: `${trimmedFighters} fighters exceed the capacity and are not produced` })
  const next: GameState = {
    ...paid.value, players, nextUnitId: nextId, log,
    systems: {
      ...paid.value.systems,
      [tac.systemId]: {
        ...sys,
        space: [...sys.space, ...ships],
        planets: sys.planets.map(p => p.id === dockPlanet.id ? { ...p, ground: [...p.ground, ...ground] } : p),
      },
    },
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
git commit -m "feat(engine): production with cost, limits, trimmed fighters and fleet pool checks"
```

---

### Task 6: Legal move enumeration, spec update and seeded smoke test

**Files:**
- Modify: `src/engine/legalMoves.ts` (all tactical steps, template kinds)
- Modify: `docs/spec/engine-design.md` (module table and the template paragraph)
- Test: `src/engine/tacticalFlow.test.ts`

**Interfaces:**
- `legalMoves` enumerates for every tactical step. Three move kinds are **templates**, because the UI fills in their parameters: `moveShips` (`moves: []`), `produce` (`units: {}, planets: [], tradeGoods: 0`) and `land` (pre-filled with every carried infantry, but any subset is legal). `validateMove` matches these by `move.type`; all other kinds are matched structurally.
  ```ts
  export const TEMPLATE_KINDS: readonly Move['type'][]   // 'moveShips' | 'produce' | 'land'
  export function legalMoves(state: GameState): Move[]
  export function validateMove(state: GameState, move: Move): Result<true>
  ```
  In the invasion step `endInvasion` is only offered while no ground combat is pending, so every enumerated move is accepted by its validator.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/tacticalFlow.test.ts
import { describe, expect, it } from 'vitest'
import { unitStats } from '../data/units'
import { capacity, fleetPoolLimit, nonFighterShips, productionCost } from './economy'
import { applyMove, legalMoves, validateMove } from './index'
import { movableShips } from './movement'
import { createGame, unitsOf } from './setup'
import { DUEL_CONFIG, cardsUsed, deepFreeze, toActionPhase, withTactical } from './testUtils'
import type { GameState, Move, Seat } from './types'

function draft(state: GameState): GameState {
  let s = state
  while (s.phase === 'strategy') {
    const r = applyMove(s, legalMoves(s)[0], 0)
    if (!r.ok) throw new Error(r.error)
    s = r.value
  }
  return s
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/** Starts the next action round: tokens back, planets ready, command tokens off the map. */
function nextRound(state: GameState): GameState {
  const systems = Object.fromEntries(Object.entries(state.systems).map(([id, sys]) => [id, {
    ...sys, activatedBy: [], planets: sys.planets.map(p => ({ ...p, exhausted: false })),
  }]))
  const players = state.players.map(p => ({
    ...p, passed: false, tokens: { ...p.tokens, tactic: 3 }, strategyCards: p.strategyCards.map(c => ({ ...c, used: true })),
  })) as GameState['players']
  return deepFreeze({ ...state, phase: 'action', round: state.round + 1, players, systems, tactical: null, active: state.speaker })
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
    if (state.tactical?.step === 'spaceCombat' && state.tactical.systemId === sys.id) continue   // cargo is trimmed when the combat ends
    for (const seat of [0, 1] as Seat[]) {
      const mine = sys.space.filter(u => u.owner === seat)
      if (!mine.length) continue
      const stats = { faction: state.players[seat].faction, techs: state.players[seat].techs }
      const loose = state.players[seat].techs.includes('fighter_ii') ? 0 : mine.filter(u => u.type === 'fighter').length
      expect(mine.filter(u => u.type === 'infantry').length + loose).toBeLessThanOrEqual(capacity(sys.space, seat, stats))
    }
  }
}

/** Turns a template move into a concrete one; falls back to the step's closing move. */
function fill(state: GameState, move: Move, rng: () => number): Move {
  const tac = state.tactical
  const seat = state.active
  const player = state.players[seat]
  const stats = { faction: player.faction, techs: player.techs }
  if (move.type === 'moveShips') {
    if (!tac) return { type: 'endMovement' }
    const dest = state.systems[tac.systemId]
    const mineThere = dest.space.filter(u => u.owner === seat)
    const room = fleetPoolLimit(player) - nonFighterShips(dest.space, seat)
    for (const option of shuffle(movableShips(state, seat), rng)) {
      const ship = state.systems[option.from].space.find(u => u.id === option.unitId)
      if (!ship || ship.type === 'fighter' || room < 1) continue
      const free = capacity([...mineThere, ship], seat, stats) - mineThere.filter(u => u.type === 'infantry' || u.type === 'fighter').length
      const slots = Math.max(0, Math.min(free, unitStats(ship.type, stats).capacity))
      const cargo = state.systems[option.from].planets.flatMap(p => p.ground.filter(u => u.owner === seat)).slice(0, slots).map(u => u.id)
      return { type: 'moveShips', moves: [{ unitId: option.unitId, from: option.from, carrying: cargo }] }
    }
    return { type: 'endMovement' }
  }
  if (move.type === 'produce') {
    if (player.reinforcements.infantry < 1) return { type: 'endTactical' }
    const cost = productionCost({ infantry: 1 }, stats, player.techs.includes('sarween_tools'))
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
    const base = toActionPhase(3)
    const start = applyMove(base, { type: 'startTactical', systemId: 'mecatol' }, 1)
    if (!start.ok) throw new Error(start.error)
    const rng = () => 0.5
    const movement = legalMoves(start.value)
    expect(movement.some(m => m.type === 'moveShips')).toBe(true)
    expect(movement.some(m => m.type === 'endMovement')).toBe(true)
    expect(validateMove(start.value, { type: 'moveShips', moves: [{ unitId: 1, from: 'home-n', carrying: [] }] }).ok).toBe(true)
    const moved = applyMove(start.value, fill(start.value, { type: 'moveShips', moves: [] }, rng), 1)
    if (!moved.ok) throw new Error(moved.error)
    const combat = applyMove(moved.value, { type: 'endMovement' }, 1)
    if (!combat.ok) throw new Error(combat.error)
    expect(combat.value.tactical?.step).toBe('spaceCombat')
    expect(legalMoves(combat.value).some(m => m.type === 'combatRound')).toBe(true)
    const invading = withTactical(combat.value, { systemId: 'mecatol', step: 'invasion', invasion: { planetId: null, landed: [], bombarded: [] } })
    expect(legalMoves(invading).some(m => m.type === 'endInvasion')).toBe(true)
    const producing = withTactical(combat.value, { systemId: 'home-n', step: 'production' })
    expect(legalMoves(producing).some(m => m.type === 'produce')).toBe(true)
    expect(legalMoves(producing).some(m => m.type === 'endTactical')).toBe(true)
  })
  it('R4.3: endInvasion is not enumerated while a ground combat is pending', () => {
    const base = toActionPhase(3)
    const mecatol = base.systems.mecatol
    const landed = deepFreeze({
      ...base,
      systems: { ...base.systems, mecatol: { ...mecatol, planets: mecatol.planets.map(p => ({ ...p, ground: [...p.ground, { id: 900, type: 'infantry' as const, owner: 0 as Seat, damaged: false }] })) } },
      tactical: { systemId: 'mecatol', step: 'invasion' as const, invasion: { planetId: 'mecatol-rex', landed: [900], bombarded: [] } },
    })
    const moves = legalMoves(landed)
    expect(moves.some(m => m.type === 'groundCombatRound')).toBe(true)
    expect(moves.some(m => m.type === 'endInvasion')).toBe(false)
    for (const move of moves) expect(applyMove(landed, move, 1).ok).toBe(true)
  })
  it('a whole tactical action can be played from the enumerator alone', () => {
    const rng = () => 0.5
    let s = cardsUsed(toActionPhase(4))
    const start = applyMove(s, { type: 'startTactical', systemId: 'bereg' }, 1)
    if (!start.ok) throw new Error(start.error)
    s = start.value
    for (let i = 0; i < 30 && s.tactical; i++) {
      const moves = legalMoves(s)
      expect(moves.length).toBeGreaterThan(0)
      const r = applyMove(s, fill(s, moves[moves.length - 1], rng), 50 + i)
      if (!r.ok) throw new Error(r.error)
      s = r.value
      invariants(s)
    }
    expect(s.tactical).toBeNull()
    expect(s.active).toBe(1)
  })
  it('a seeded 200-move run keeps every invariant', () => {
    let s = cardsUsed(draft(createGame(DUEL_CONFIG, 9)))
    let seedState = 12345
    const rng = () => { seedState = (Math.imul(seedState, 1664525) + 1013904223) >>> 0; return seedState / 4294967296 }
    let applied = 0
    let attempts = 0
    let rejected = 0
    for (let i = 0; i < 200; i++) {
      if (s.phase !== 'action') { s = nextRound(s); continue }
      const moves = shuffle(legalMoves(s), rng)
      if (!moves.length) { s = nextRound(s); continue }
      let next: GameState | null = null
      for (const move of moves) {
        attempts++
        const r = applyMove(s, fill(s, move, rng), 1000 + i)
        if (r.ok) { next = r.value; break }
        rejected++
      }
      expect(next).not.toBeNull()
      if (!next) break
      s = next
      applied++
      invariants(s)
    }
    expect(applied).toBeGreaterThan(120)
    expect(rejected).toBeLessThanOrEqual(Math.ceil(attempts * 0.05))
    expect(s.log.filter(e => e.t === 'roll').length).toBeGreaterThan(0)
    expect(s.round).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/engine/tacticalFlow.test.ts`
Expected: FAIL, the movement, space combat and invasion steps enumerate no moves.

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
export const TEMPLATE_KINDS: readonly Move['type'][] = ['moveShips', 'produce', 'land']

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
        for (const to of retreatTargets(state, seat)) out.push({ type: 'retreat', to })   // one announcement per combat
      }
      return out
    }
    case 'invasion': {
      const out: Move[] = []
      for (const planetId of bombardablePlanets(state)) out.push({ type: 'bombard', planetId })
      for (const { planetId, infantryIds } of landablePlanets(state)) out.push({ type: 'land', planetId, infantryIds })
      if (groundCombatPending(state)) out.push({ type: 'groundCombatRound' })
      else out.push({ type: 'endInvasion' })
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
  if (state.phase !== 'action') return []
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

- [ ] **Step 4: Bring the design document in line with the code**

In `docs/spec/engine-design.md`:

Replace the `legalMoves` bullet of the `Contract` section with:

```
- `legalMoves` enumerates concrete moves for the active player; the UI builds its interaction from this list (highlighted systems, enabled buttons). Three kinds are templates whose parameters the UI fills in: `moveShips` (`moves: []`), `produce` (`units: {}`, `planets: []`, `tradeGoods: 0`) and `land` (pre-filled with every carried infantry, any subset is legal). `validateMove(state, move)` matches those three by `move.type` and every other kind structurally.
```

Add two rows to the module table, above `src/engine/movement.ts`:

```
| `src/engine/actionPhase.ts` | activation, passing, turn alternation |
| `src/engine/board.ts` | shared unit helpers: stats owner, dice, unit removal, reinforcements, capacity and fleet checks |
```

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, all suites (units, rng, adjacency, research, setup, economy, strategyPhase, actionPhase, movement, combat, invasion, production, tacticalFlow).

- [ ] **Step 6: Type-check, lint and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/legalMoves.ts src/engine/tacticalFlow.test.ts docs/spec/engine-design.md
git commit -m "feat(engine): tactical legal move enumeration, design doc update and seeded flow smoke test"
```

---

## Self-review notes

### Spec coverage

| Rule | Where | Notes |
| --- | --- | --- |
| R3.2 tactical action | `actionPhase.ts`, task 1 | activation token, no double activation (home system included), pass blocked by an unused strategy card, turn alternation, both passed ends the phase |
| R3.2 step 2 movement | `movement.ts`, task 2 | move values, path search, blockers, wormholes, asteroid, nebula, Gravity Drive, carrying from the starting system, own-token ships, capacity and fleet pool, Fighter II moving alone and counting against the fleet pool |
| R4.1 space combat | `combat.ts`, task 3 | pre-combat in the order space cannon offense, Assault Cannon, anti-fighter barrage; space cannon fired by every non-active owner; Graviton Laser hits lost when only fighters remain; combat rounds, nebula defender +1, Munitions Reserves; hit assignment with sustain, Non-Euclidean Shielding, Duranium Armor and the L1Z1X "if able" restriction; retreat announced and carried out after the next round; end of combat and the R7 Mandate |
| R4.2 guardian behaviour | `combat.ts`, `invasion.ts` | guardians use level I stats and no techs (`statsOwner` returns `'guardian'`), never retreat (only the attacker may), block movement like enemies, their infantry defend Mecatol Rex normally, their destroyed units go to no reinforcement pool, and a seat's PDS fires even when the guardian is the combat defender |
| R4.3 invasion | `invasion.ts`, task 4 | bombardment with the planetary shield (only Arc Secundus gets through), Plasma Scoring, automatic Harrow, landing, space cannon defense (negated by L4 Disruptors, its only effect), ground combat, control change with Assimilate |
| R4.4 production | `production.ts`, task 5 | production limit, cost with Sarween Tools, payment, reinforcements, fleet pool rejection, fighters above capacity trimmed with an info entry, Space Dock II slots, War Sun tech, one flagship |
| R7 hooks | `production.ts`, `combat.ts` | `spentInOneProductionThisRound` and `mandateEarnedThisRound`; the scoring itself is plan 3 |

### Type consistency

- One field is added to `types.ts` and to the `State shape` block of `docs/spec/engine-design.md` (task 2, step 1): `CombatState.retreatTo: string | null`. Task 6 brings the rest of that document in line: two module rows and the template paragraph. Nothing else in `types.ts` changes.
- `combat.round` is the index of the **next** round (0 = pre-combat), `combat.retreating`/`combat.retreatTo` hold a pending announcement, `combat.lastRolls` the dice of the last resolved round; `invasion.planetId` is the planet with the running ground combat, `invasion.landed` the landed infantry ids, `invasion.bombarded` the planets already bombarded this invasion.
- `StatsOwner` comes from `src/data/units.ts` and is produced centrally by `board.statsOwner`. The current signatures are used as they are: `unitStats` returns `Readonly<UnitStats>` and is never written to, `SHIP_TYPES` and `NON_FIGHTER_SHIPS` are only read, `board.checkFleet`, `board.trimCargo` and `production.fighterRoom` delegate to `economy.capacity(units, owner, stats)` and `economy.nonFighterShips(units, owner)`, and `combat.markMandate` uses `MECATOL_ID`.
- Exactly one dice helper: `board.rollHits(rng, dice, value, extraDie)` with `board.dieRolls` for the log entries. Space cannon offense, space cannon defense, bombardment, combat rolls and ground combat all go through it; the Munitions Reserves reroll is one further `rollHits` call on the missed dice.
- `applyMove` keeps its signature, its try/catch and its single log append; every dice roll is appended by the move handler before the `move` entry. All fixture helpers live in `src/engine/testUtils.ts` and return `deepFreeze(...)`, so mutation of an input state throws inside the dispatcher and fails the test.
- No dead exports: `board.ts` exports only what movement, combat, invasion and production use, and shipped code carries no references to plan tasks.

### Resolved ambiguities and v1 policies

1. **Round counter and pre-combat.** `round: 0` means the pre-combat step is still pending; the first `combatRound` runs R4.1 step 6's order (space cannon offense, Assault Cannon, anti-fighter barrage) and leaves `round: 1`.
2. **Retreat.** Implemented exactly as R4.1 step 5: announcement before a round after the first, at most one per combat, by the attacker only; the round is fought and only then do the ships and their cargo move. If either side is wiped out in that round the combat ends and the announcement is dropped, so an attacker who clears the system goes on to the invasion.
3. **Who may retreat.** R4.1 step 5 names only the attacker; the defender and the guardians never retreat.
4. **Combat needs two fleets.** If the active player has no ships in the activated system, `endMovement` goes straight to the invasion even when enemy ships are present; there is nothing to fight with.
5. **Carrying.** R3.2 loads fighters and infantry from the system the ship starts in, which is what the engine does (space or planets of that system).
6. **Munitions Reserves.** The flag applies to every side in the combat that is Letnev and can pay 2 trade goods, and rerolls each missed die once. In the v1 pairing only one seat is Letnev.
7. **Excess cargo.** Trimmed at exactly two points, when a space combat ends and after an executed retreat (`trimCargo`), infantry first and then fighters unless Fighter II makes them free. Cargo may sit above capacity while a combat runs, so the smoke test's capacity invariant skips the system with the running combat.
8. **Objective 4 spending.** `spentInOneProductionThisRound` records the production cost after Sarween Tools and after the fighter trim, not the overpaid amount.
9. **L4 Disruptors.** The spec reads correctly: it affects only the space cannon defense of R4.3 step 3. Bombarding through a planetary shield needs Arc Secundus in the system.
10. **Trimmed fighters are trimmed before payment.** R4.4 says excess fighters are not produced; the engine drops them before the cost is computed, so nobody pays for a unit that never appears. An order that consists only of untrimmable fighters is rejected as `nothing to produce`.
11. **Harrow is automatic.** R4.3 step 1 lets L1Z1X bombard after each ground combat round; v1 always does it (there is no free choice to model yet) as long as defenders remain and no planetary shield blocks it.
12. **Templates in `legalMoves`.** `moveShips`, `produce` and `land` are emitted with empty or maximal parameters and `validateMove` matches these three kinds by type only; `engine-design.md` now says the same.

### Deferred

- **Infantry II revival** (R4.3 step 4): a destroyed infantry returning on 6+ at the start of the next turn needs a per-player holding area that the state shape does not have. To be added with the status phase.
- **Action cards, promissory notes, agenda phase, secret objectives**: not in v1 at all (R6).
- **Strategic actions, component actions, trade posts, status phase, scoring and victory**: plan 3. Until then a player can only pass when all their strategy cards are marked used, so the flow tests mark them used themselves.
- **War Sun removing the planetary shield** and **Antimass Deflectors giving -1 against SPACE CANNON**: printed abilities that R4.1 and R4.3 do not mention; not implemented, to be revisited when the rules document is updated.
- **Fleet pool after a retreat**: the destination system is not re-checked against the fleet pool, only its cargo is trimmed.
- `validateMove` still compares JSON for the non-template kinds; replace with structural checks when the move list grows further.
