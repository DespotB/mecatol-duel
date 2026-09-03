# Engine Strategic Actions and Status Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the game loop. Add the six strategy cards with their primary and secondary abilities and the response window between them, the component actions (Inheritance Systems research, emergency shipyard) and the trade posts, the objective predicates, the status phase with scoring, token distribution, readying, guardian respawn, victory and round advance, and the legal-move enumeration for everything that is left. Prove it with a seeded smoke test that plays ten complete games from `createGame` to `phase: 'ended'`.

**Architecture:** Everything stays pure: functions from state to state, no I/O, no React. This plan adds `src/engine/objectives.ts`, `src/engine/strategicActions.ts`, `src/engine/componentActions.ts` and `src/engine/statusPhase.ts`, extends `src/engine/economy.ts`, `src/data/map.ts` and the shared test kit in `src/engine/testUtils.ts`, and rewrites `legalMoves` and `validateMove`. The modules of plan 1 and plan 2 are reused with the signatures they have today: `economy.payCost`/`productionCost`/`productionLimit`/`fleetPoolLimit`, `research.canResearch(player, techId, ignorePrereqs)`, `setup.rollGuardianFleet(state, seed)`/`unitsOf(state, owner)`, `actionPhase.otherSeat`/`canPass`/`passTurn`/`activatableSystems`, `production.produce(state, units, planets, tradeGoods)`, `rng.deriveSeed`, `data/map.MECATOL_ID`/`SYSTEM_IDS`/`TRADE_POSTS`/`systemDef`, `data/objectives.PUBLIC_OBJECTIVES`/`MANDATE`. New move kinds are added as cases to the `applyMove` switch and as branches in `legalMoves`. Two type changes only, both in task 2: three new optional fields on `StrategicParams` and a narrowed `via` on the `research` move; `GameState` itself does not change, the secondary window rides on the existing `pendingSecondary` field.

**Tech Stack:** TypeScript 5 (strict), Vite 7 scaffold, Vitest 3, no runtime dependencies in the engine.

**Spec:** `docs/spec/game-rules.md` (rules v0.2 as amended, sections referenced below as R1..R8) and `docs/spec/engine-design.md` (state and move types, module layout). This plan covers R3.1 (initiative and the fresh draft each round), R3.2 (strategic and component actions), R3.3 (status phase), R5 (research through the Technology card and Inheritance Systems), R6 (duel-specific card texts, emergency shipyard), R7 (objectives, Mandate, Mecatol Rex, victory and tie-breaks) and R8 (trade posts). Verbatim card texts come from `data/reference/factions.json` (`strategy_cards`), with the duel changes of R6.

**Task order:** the requested scope is grouped so that dependencies run forwards. Task 1 is the objective predicates, because the Imperial card (task 3) and the status phase (task 5) both score with them. Tasks 2 and 3 are the requested "strategic actions" task, split so that neither exceeds roughly 250 lines of new implementation code. Task 4 is component actions and trade posts, task 5 the status phase, task 6 the enumerator, the structural validator and the full-game smoke test.

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
- Test names cite the spec section they cover, e.g. `'R3.3 step 3: two command tokens, three with Hyper Metabolism'`.
- **Commit after every logical step: the failing test, the implementation and each fix are separate commits.** Conventional messages (`test:` for a failing test, `feat:`/`fix:`/`chore:` for the rest). Never squash a test and its implementation into one commit.

---

### Task 1: Objective predicates, scoring and victory point bookkeeping

**Files:**
- Create: `src/engine/objectives.ts`
- Modify: `docs/spec/engine-design.md` (module table)
- Test: `src/engine/objectives.test.ts`

**Interfaces:**
- Produces in `objectives.ts`:
  ```ts
  export function controlledPlanets(state: GameState, seat: Seat): { systemId: string; planetId: string }[]
  export function controlsMecatol(state: GameState, seat: Seat): boolean
  export function fulfils(state: GameState, seat: Seat, objectiveId: string): boolean
  export function scoreable(state: GameState, seat: Seat): string[]
  export function addVp(state: GameState, seat: Seat, points: number, reason: string): GameState
  export function scoreObjective(state: GameState, seat: Seat, objectiveId: string): GameState
  ```
  `fulfils` is pure and knows the six public objective ids of `data/objectives.ts` plus `MANDATE.id`; an unknown id is `false`, never a throw, so a corrupt move parameter cannot crash the engine. `scoreable` lists the revealed public objectives the seat fulfils and has not scored yet, plus the Mandate when it was earned this round and never scored. `scoreObjective` appends the id to `scoredObjectives` (or sets `mandateScored`), adds one victory point and logs an `info` entry; it does not check fulfilment, the callers do.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/objectives.test.ts
import { describe, expect, it } from 'vitest'
import { MANDATE } from '../data/objectives'
import { addVp, controlsMecatol, fulfils, scoreObjective, scoreable } from './objectives'
import { deepFreeze, toActionPhase, withPlanetOwner, withPlayer, withTechs, withUnits } from './testUtils'
import type { GameState } from './types'

/** Gives seat 0 the four neutral ring planets used by the control objectives. */
function withRing(state: GameState): GameState {
  let s = withPlanetOwner(state, 'bereg', 'bereg', 0)
  s = withPlanetOwner(s, 'bereg', 'lirta-iv', 0)
  s = withPlanetOwner(s, 'quann', 'quann', 0)
  return withPlanetOwner(s, 'sakulag', 'sakulag', 0)
}

describe('R7 objectives', () => {
  it('R7 objective 1: own 3 technologies, the two starting technologies count', () => {
    const s = toActionPhase()
    expect(s.players[0].techs).toHaveLength(2)
    expect(fulfils(s, 0, 'own_3_techs')).toBe(false)
    expect(fulfils(withTechs(s, 0, ['sarween_tools']), 0, 'own_3_techs')).toBe(true)
  })
  it('R7 objective 2: control 4 planets outside your home system', () => {
    const s = toActionPhase()
    expect(fulfils(withPlanetOwner(withRing(s), 'sakulag', 'sakulag', null), 0, 'control_4_outside_home')).toBe(false)
    expect(fulfils(withRing(s), 0, 'control_4_outside_home')).toBe(true)
    expect(fulfils(withRing(s), 1, 'control_4_outside_home')).toBe(false)
  })
  it('R7 objective 3: 3 or more non-fighter ships in the Mecatol Rex system', () => {
    const s = toActionPhase()
    expect(fulfils(withUnits(s, 'mecatol', 0, ['cruiser', 'destroyer', 'fighter', 'fighter']), 0, 'three_ships_mecatol')).toBe(false)
    expect(fulfils(withUnits(s, 'mecatol', 0, ['cruiser', 'destroyer', 'carrier']), 0, 'three_ships_mecatol')).toBe(true)
  })
  it('R7 objective 4: 6 resources spent in a single production this round', () => {
    const s = toActionPhase()
    expect(fulfils(withPlayer(s, 0, { spentInOneProductionThisRound: 5 }), 0, 'spend_6_production')).toBe(false)
    expect(fulfils(withPlayer(s, 0, { spentInOneProductionThisRound: 6 }), 0, 'spend_6_production')).toBe(true)
  })
  it('R7 objective 5: control 5 planets, home planets included', () => {
    const s = withRing(toActionPhase())
    expect(fulfils(s, 0, 'control_5_planets')).toBe(true)          // [0.0.0] plus the four ring planets
    expect(fulfils(withPlanetOwner(s, 'quann', 'quann', null), 0, 'control_5_planets')).toBe(false)
  })
  it('R7 objective 6: two technologies of the same colour, unit upgrades have no colour', () => {
    const s = toActionPhase()
    expect(fulfils(s, 0, 'two_techs_same_colour')).toBe(false)      // one green, one red
    expect(fulfils(withTechs(s, 0, ['fighter_ii', 'carrier_ii']), 0, 'two_techs_same_colour')).toBe(false)
    expect(fulfils(withTechs(s, 0, ['dacxive_animators']), 0, 'two_techs_same_colour')).toBe(true)
  })
  it('R7 Mandate: earned by a won space combat this round, unknown ids are false', () => {
    const s = toActionPhase()
    expect(fulfils(s, 0, MANDATE.id)).toBe(false)
    expect(fulfils(withPlayer(s, 0, { mandateEarnedThisRound: true }), 0, MANDATE.id)).toBe(true)
    expect(fulfils(s, 0, 'no_such_objective')).toBe(false)
  })
  it('R7: scoreable lists revealed, fulfilled and unscored objectives plus the Mandate', () => {
    const s = withPlayer(withTechs(toActionPhase(), 0, ['sarween_tools']), 0, { mandateEarnedThisRound: true })
    expect(s.publicObjectives).toEqual(['own_3_techs'])
    expect(scoreable(s, 0)).toEqual(['own_3_techs', MANDATE.id])
    expect(scoreable(withPlayer(s, 0, { scoredObjectives: ['own_3_techs'], mandateScored: true }), 0)).toEqual([])
    expect(scoreable(s, 1)).toEqual([])
  })
  it('R7: scoring records the objective and adds one victory point', () => {
    const s = deepFreeze(toActionPhase())
    const scored = scoreObjective(s, 0, 'own_3_techs')
    expect(scored.players[0].vp).toBe(1)
    expect(scored.players[0].scoredObjectives).toEqual(['own_3_techs'])
    const mandate = scoreObjective(scored, 0, MANDATE.id)
    expect(mandate.players[0].vp).toBe(2)
    expect(mandate.players[0].mandateScored).toBe(true)
    expect(mandate.players[0].scoredObjectives).toEqual(['own_3_techs'])
    expect(addVp(mandate, 0, 1, 'Mecatol Rex').players[0].vp).toBe(3)
    expect(s.players[0].vp).toBe(0)                                // input not mutated
  })
  it('R7: Mecatol Rex control is read from the centre system', () => {
    const s = toActionPhase()
    expect(controlsMecatol(s, 0)).toBe(false)
    expect(controlsMecatol(withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0), 0)).toBe(true)
    expect(controlsMecatol(withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0), 1)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails, then commit it**

Run: `npm test -- src/engine/objectives.test.ts`
Expected: FAIL, `src/engine/objectives.ts` does not exist.

```bash
git add src/engine/objectives.test.ts
git commit -m "test(engine): objective predicates and scoring"
```

- [ ] **Step 3: Implement the objective predicates**

```ts
// src/engine/objectives.ts
import { MECATOL_ID, systemDef } from '../data/map'
import { MANDATE, PUBLIC_OBJECTIVES } from '../data/objectives'
import { NON_FIGHTER_SHIPS } from '../data/units'
import { colourCounts } from './research'
import type { GameState, Seat } from './types'

export function controlledPlanets(state: GameState, seat: Seat): { systemId: string; planetId: string }[] {
  const out: { systemId: string; planetId: string }[] = []
  for (const sys of Object.values(state.systems)) {
    for (const p of sys.planets) if (p.owner === seat) out.push({ systemId: sys.id, planetId: p.id })
  }
  return out
}

export function controlsMecatol(state: GameState, seat: Seat): boolean {
  return state.systems[MECATOL_ID].planets.some(p => p.owner === seat)
}

/** R7: the six public objectives and the Mandate. An unknown id is false, never a throw. */
export function fulfils(state: GameState, seat: Seat, objectiveId: string): boolean {
  const player = state.players[seat]
  switch (objectiveId) {
    case 'own_3_techs':
      return player.techs.length >= 3
    case 'control_4_outside_home':
      return controlledPlanets(state, seat).filter(p => systemDef(p.systemId).home !== seat).length >= 4
    case 'three_ships_mecatol':
      return state.systems[MECATOL_ID].space.filter(u => u.owner === seat && NON_FIGHTER_SHIPS.includes(u.type)).length >= 3
    case 'spend_6_production':
      return player.spentInOneProductionThisRound >= 6
    case 'control_5_planets':
      return controlledPlanets(state, seat).length >= 5
    case 'two_techs_same_colour':
      return Object.values(colourCounts(player.techs)).some(n => n >= 2)
    case MANDATE.id:
      return player.mandateEarnedThisRound
    default:
      return false
  }
}

/** R3.3 step 1: what the seat may score right now, each public objective once per game. */
export function scoreable(state: GameState, seat: Seat): string[] {
  const player = state.players[seat]
  const out = state.publicObjectives.filter(id => !player.scoredObjectives.includes(id) && fulfils(state, seat, id))
  if (!player.mandateScored && fulfils(state, seat, MANDATE.id)) out.push(MANDATE.id)
  return out
}

export function addVp(state: GameState, seat: Seat, points: number, reason: string): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], vp: players[seat].vp + points }
  return { ...state, players, log: [...state.log, { t: 'info', text: `seat ${seat} scores ${points} VP: ${reason}` }] }
}

/** R7: records the objective (or the Mandate) and adds its victory point. Fulfilment is checked by the caller. */
export function scoreObjective(state: GameState, seat: Seat, objectiveId: string): GameState {
  const players = [...state.players] as GameState['players']
  const player = players[seat]
  players[seat] = objectiveId === MANDATE.id
    ? { ...player, mandateScored: true }
    : { ...player, scoredObjectives: [...player.scoredObjectives, objectiveId] }
  const def = PUBLIC_OBJECTIVES.find(o => o.id === objectiveId)
  return addVp({ ...state, players }, seat, 1, def ? def.text : MANDATE.text)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/engine/objectives.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Bring the module table in line**

In `docs/spec/engine-design.md`, replace the `src/data/objectives.ts` row of the module table with these two rows:

```
| `src/data/objectives.ts` | public objective ids, order and texts, the Mandate |
| `src/engine/objectives.ts` | objective predicates, scoring and victory point bookkeeping |
```

- [ ] **Step 6: Type-check, lint and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/objectives.ts docs/spec/engine-design.md
git commit -m "feat(engine): objective predicates, scoring and victory point bookkeeping"
```

---

### Task 2: Strategic actions I, the secondary window, Leadership, Diplomacy and Trade

**Files:**
- Modify: `src/engine/types.ts` (three new `StrategicParams` fields, narrowed `research.via`)
- Modify: `src/engine/economy.ts` (`exhaustPlanets`, `distributeTokens`, `payCost` rewritten on top of `exhaustPlanets`)
- Modify: `src/engine/actionPhase.ts` (`startTactical` and `pass` are blocked while a secondary window is open)
- Create: `src/engine/strategicActions.ts`
- Modify: `src/engine/index.ts` (dispatcher cases `strategic`, `secondary`)
- Modify: `src/engine/testUtils.ts` (`withCards`, `withExhausted`)
- Modify: `docs/spec/engine-design.md` (move types and the response window)
- Test: `src/engine/strategicActions.test.ts`

**Interfaces:**
- Type changes in `types.ts`, exactly these two:
  ```ts
  export interface StrategicParams {
    systemId?: string          // Diplomacy: the chosen system; Warfare: the system to take your command token from
    planets?: string[]         // planets exhausted to pay (Leadership influence, Technology resources, Warfare production) or readied (Diplomacy)
    techId?: string; secondTechId?: string
    tradeGoods?: number
    units?: Partial<Record<UnitType, number>>
    tokens?: { tactic: number; fleet: number; strategy: number }   // the resulting command sheet after Leadership or Warfare
    objectiveId?: string       // Imperial primary: the public objective to score
    shareWithOpponent?: boolean // Trade primary: let the opponent replenish for free
  }
  ```
  and `{ type: 'research'; techId: string; via: 'inheritance' }`: the Technology card carries its technologies in `StrategicParams`, so the two other `via` values would be dead branches.
- Produces in `economy.ts`:
  ```ts
  export function exhaustPlanets(state: GameState, seat: Seat, planets: string[]): Result<{ state: GameState; resources: number; influence: number }>
  export function distributeTokens(state: GameState, seat: Seat, wanted: Player['tokens'] | undefined, gained: number, redistribute?: boolean): Result<GameState>
  ```
  `distributeTokens` takes the **resulting** command sheet: every pool must be a non-negative integer, the three pools must sum to the current total plus `gained`, and without `redistribute` no pool may fall below its current value (R3.3 and Leadership hand out new tokens, only Warfare may move existing ones). `wanted === undefined` means "all new tokens into the tactic pool", which makes the enumerator's templates directly playable.
- Produces in `strategicActions.ts`:
  ```ts
  export function cardOwner(state: GameState, card: StrategyCardId): Seat | null
  export function unusedCards(state: GameState, seat: Seat): StrategyCardId[]
  export function secondaryTokenCost(card: StrategyCardId): number     // 0 for Leadership, 1 otherwise
  export function diplomacySystems(state: GameState, seat: Seat): string[]
  export function warfareTokenSystems(state: GameState, seat: Seat): string[]
  export function readyPlanets(state: GameState, seat: Seat, planets: string[], max: number): Result<GameState>
  export function grantTech(state: GameState, seat: Seat, techId: string, ignorePrereqs: boolean): Result<GameState>
  export function strategic(state: GameState, card: StrategyCardId, params: StrategicParams | undefined): Result<GameState>
  export function secondary(state: GameState, card: StrategyCardId, accept: boolean, params: StrategicParams | undefined): Result<GameState>
  ```
  R3.2 flow: `strategic` resolves the primary, marks the card used, sets `pendingSecondary` to the card and hands `active` to the opponent. The opponent answers with exactly one `secondary` move, `accept` true or false; only then does the turn pass on (`passTurn` from the card holder, so the opponent keeps the turn unless they have already passed). While `pendingSecondary` is set no other move is legal, which is why `startTactical` and `pass` grow a guard. `grantTech` is exported because task 4 researches through Inheritance Systems with `ignorePrereqs`, and `diplomacySystems`/`warfareTokenSystems` because both the handlers and the enumerator of task 6 need exactly the same eligibility rule.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/strategicActions.test.ts
import { describe, expect, it } from 'vitest'
import { applyMove } from './index'
import { deepFreeze, toActionPhase, withCards, withExhausted, withPlanetOwner, withPlayer } from './testUtils'
import type { GameState, Result, StrategicParams, StrategyCardId } from './types'

const play = (state: GameState, card: StrategyCardId, params?: StrategicParams) =>
  applyMove(deepFreeze(state), { type: 'strategic', card, params }, 0)
const answer = (state: GameState, card: StrategyCardId, accept: boolean, params?: StrategicParams) =>
  applyMove(deepFreeze(state), { type: 'secondary', card, accept, params }, 0)
const value = (r: Result<GameState>): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.value
}

/** Seat 0 holds the card and is active, seat 1 answers; both keep the printed 3/3/2 command sheet. */
function holder(card: StrategyCardId): GameState {
  return withCards(withCards(toActionPhase(), 1, []), 0, [card])
}

describe('R3.2 strategic actions', () => {
  it('R3.2: the primary marks the card used, opens the secondary window and hands over the turn', () => {
    const s = holder('trade')
    const played = value(play(s, 'trade'))
    expect(played.players[0].strategyCards).toEqual([{ id: 'trade', used: true }])
    expect(played.pendingSecondary).toBe('trade')
    expect(played.active).toBe(1)
    expect(s.players[0].strategyCards[0].used).toBe(false)        // input not mutated
  })
  it('R3.2: nothing else happens while a secondary window is open', () => {
    const played = value(play(holder('trade'), 'trade'))
    expect(applyMove(played, { type: 'startTactical', systemId: 'bereg' }, 0).ok).toBe(false)
    expect(applyMove(played, { type: 'pass' }, 0).ok).toBe(false)
    expect(applyMove(played, { type: 'strategic', card: 'warfare' }, 0).ok).toBe(false)
    const done = value(answer(played, 'trade', false))
    expect(done.pendingSecondary).toBeNull()
    expect(done.active).toBe(1)                                   // the answering seat now takes its own turn
  })
  it('R3.2: a passed opponent still answers, and the turn goes back to the card holder', () => {
    const s = withPlayer(holder('trade'), 1, { passed: true, strategyCards: [] })
    const done = value(answer(value(play(s, 'trade')), 'trade', false))
    expect(done.active).toBe(0)
  })
  it('R3.2: only the holder plays a card, only once, and only the opponent answers', () => {
    const s = holder('trade')
    expect(play(s, 'warfare').ok).toBe(false)                     // seat 0 does not hold it
    const played = value(play(s, 'trade'))
    expect(answer({ ...played, active: 0 }, 'trade', true).ok).toBe(false)
    const done = value(answer(played, 'trade', false))
    expect(play({ ...done, active: 0 }, 'trade').ok).toBe(false)  // already used
    expect(answer(done, 'trade', false).ok).toBe(false)           // window closed
  })
  it('R6 Leadership primary: 3 command tokens plus 1 for every 3 influence spent', () => {
    let s = holder('leadership')
    s = withPlanetOwner(s, 'bereg', 'lirta-iv', 0)                // influence 3
    s = withPlanetOwner(s, 'starpoint', 'centauri', 0)            // influence 3
    const played = value(play(s, 'leadership', { planets: ['lirta-iv', 'centauri'], tokens: { tactic: 6, fleet: 4, strategy: 3 } }))
    expect(played.players[0].tokens).toEqual({ tactic: 6, fleet: 4, strategy: 3 })   // 8 + 3 + 2
    expect(played.systems.bereg.planets.find(p => p.id === 'lirta-iv')?.exhausted).toBe(true)
    expect(value(play(s, 'leadership')).players[0].tokens).toEqual({ tactic: 6, fleet: 3, strategy: 2 })
  })
  it('R6 Leadership: the distribution takes exactly the new tokens and never moves old ones', () => {
    const s = holder('leadership')
    expect(play(s, 'leadership', { tokens: { tactic: 4, fleet: 4, strategy: 2 } }).ok).toBe(false)   // 10, not 11
    expect(play(s, 'leadership', { tokens: { tactic: 2, fleet: 4, strategy: 5 } }).ok).toBe(false)   // tactic below 3
    expect(play(s, 'leadership', { tokens: { tactic: 3, fleet: 3, strategy: 5 } }).ok).toBe(true)
    expect(play(s, 'leadership', { planets: ['arc-prime'] }).ok).toBe(false)                          // not controlled
  })
  it('R6 Leadership secondary: 1 token per 3 influence and no strategy token cost', () => {
    let s = holder('leadership')
    s = withPlanetOwner(s, 'bereg', 'lirta-iv', 1)
    const answered = value(answer(value(play(s, 'leadership')), 'leadership', true, { planets: ['lirta-iv'] }))
    expect(answered.players[1].tokens).toEqual({ tactic: 4, fleet: 3, strategy: 2 })
    expect(answered.systems.bereg.planets.find(p => p.id === 'lirta-iv')?.exhausted).toBe(true)
  })
  it('R6 Diplomacy errata primary: the opponent gets a command token there, up to 2 planets are readied', () => {
    const s = withExhausted(holder('diplomacy'), ['000'])
    const played = value(play(s, 'diplomacy', { systemId: 'home-n', planets: ['000'] }))
    expect(played.systems['home-n'].activatedBy).toEqual([1])
    expect(played.systems['home-n'].planets[0].exhausted).toBe(false)
    const done = value(answer(played, 'diplomacy', false))
    expect(applyMove(done, { type: 'startTactical', systemId: 'home-n' }, 0).ok).toBe(false)   // seat 1 is blocked there
    expect(applyMove(done, { type: 'startTactical', systemId: 'quann' }, 0).ok).toBe(true)
  })
  it('R6 Diplomacy: not Mecatol Rex, only a system with a planet you control, at most 2 planets', () => {
    const s = withExhausted(holder('diplomacy'), ['000'])
    expect(play(s, 'diplomacy', { systemId: 'mecatol' }).ok).toBe(false)
    expect(play(s, 'diplomacy', { systemId: 'quann' }).ok).toBe(false)
    expect(play(s, 'diplomacy', {}).ok).toBe(false)
    expect(play(s, 'diplomacy', { systemId: 'home-n', planets: ['000', '000', '000'] }).ok).toBe(false)
    expect(play(withExhausted(s, ['000'], false), 'diplomacy', { systemId: 'home-n', planets: ['000'] }).ok).toBe(false)
  })
  it('R3.2/R6 Diplomacy: with no eligible system the primary is still playable', () => {
    let s = withExhausted(holder('diplomacy'), ['000'])
    s = withPlanetOwner(s, 'home-n', '000', null)                 // seat 0 controls nothing but Mecatol Rex
    s = withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0)
    const played = value(play(s, 'diplomacy', {}))
    expect(played.pendingSecondary).toBe('diplomacy')
    expect(played.systems.mecatol.activatedBy).toEqual([])        // Mecatol Rex is never chosen
    expect(play(s, 'diplomacy', { systemId: 'mecatol' }).ok).toBe(false)
  })
  it('R6 Diplomacy secondary: a strategy token readies up to 2 exhausted planets you control', () => {
    const s = withExhausted(holder('diplomacy'), ['000', 'arc-prime', 'wren-terra'])
    const played = value(play(s, 'diplomacy', { systemId: 'home-n' }))
    const answered = value(answer(played, 'diplomacy', true, { planets: ['arc-prime', 'wren-terra'] }))
    expect(answered.players[1].tokens.strategy).toBe(1)
    expect(answered.systems['home-s'].planets.map(p => p.exhausted)).toEqual([false, false])   // both named planets
    expect(answer(withPlayer(played, 1, { tokens: { tactic: 3, fleet: 3, strategy: 0 } }), 'diplomacy', true, { planets: ['arc-prime'] }).ok).toBe(false)
  })
  it('R6 Trade primary: 3 trade goods, commodities replenished, the opponent may replenish too', () => {
    const s = withPlayer(withPlayer(holder('trade'), 0, { commodities: 0 }), 1, { commodities: 0 })
    const alone = value(play(s, 'trade'))
    expect(alone.players[0]).toMatchObject({ tradeGoods: 3, commodities: 2 })
    expect(alone.players[1].commodities).toBe(0)
    const shared = value(play(s, 'trade', { shareWithOpponent: true }))
    expect(shared.players[1].commodities).toBe(2)
  })
  it('R6 Trade secondary: a strategy token replenishes commodities', () => {
    const s = withPlayer(holder('trade'), 1, { commodities: 0 })
    const answered = value(answer(value(play(s, 'trade')), 'trade', true))
    expect(answered.players[1]).toMatchObject({ commodities: 2, tokens: { tactic: 3, fleet: 3, strategy: 1 } })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails, then commit it**

Run: `npm test -- src/engine/strategicActions.test.ts`
Expected: FAIL, `src/engine/strategicActions.ts` does not exist and `withCards`/`withExhausted` are missing.

```bash
git add src/engine/strategicActions.test.ts
git commit -m "test(engine): strategic action framework, Leadership, Diplomacy and Trade"
```

- [ ] **Step 3: Extend the move types and the design document**

In `src/engine/types.ts`, replace the `research` line of the `Move` union with:

```ts
  | { type: 'research'; techId: string; via: 'inheritance' }   // component action; the Technology card carries its technologies in StrategicParams
```

and replace `StrategicParams` with:

```ts
export interface StrategicParams {
  systemId?: string                 // Diplomacy: the chosen system; Warfare: where your command token comes off the board
  planets?: string[]                // planets exhausted to pay (Leadership influence, Technology and Warfare resources) or readied (Diplomacy)
  techId?: string; secondTechId?: string
  tradeGoods?: number
  units?: Partial<Record<UnitType, number>>
  tokens?: { tactic: number; fleet: number; strategy: number }   // the resulting command sheet after Leadership or Warfare
  objectiveId?: string              // Imperial primary: the public objective to score
  shareWithOpponent?: boolean       // Trade primary: the opponent replenishes without paying
}
```

In `docs/spec/engine-design.md`, make the same two edits in the `Moves` block, and add this bullet to the `Contract` section, after the `legalMoves` bullet:

```
- A strategic action is two moves: the `strategic` move resolves the primary, marks the card used and sets `pendingSecondary`; the opponent then answers with exactly one `secondary` move (`accept: true` pays the strategy token and resolves the ability, `accept: false` declines). Only then does the turn pass. While `pendingSecondary` is set, no other move is legal, and the answering seat responds even when it has already passed, because the response is not a turn.
```

- [ ] **Step 4: Extend the economy helpers**

```ts
// src/engine/economy.ts, replacing payCost and adding three exports
/** Exhausts the listed ready planets of the seat and reports what they were worth. */
export function exhaustPlanets(state: GameState, seat: Seat, planets: string[]): Result<{ state: GameState; resources: number; influence: number }> {
  let resources = 0
  let influence = 0
  const systems = { ...state.systems }
  for (const planetId of planets) {
    const sysId = Object.keys(systems).find(id => systems[id].planets.some(p => p.id === planetId))
    if (!sysId) return { ok: false, error: `unknown planet ${planetId}` }
    const sys = systems[sysId]
    const planet = sys.planets.find(p => p.id === planetId)
    if (!planet || planet.owner !== seat) return { ok: false, error: `planet ${planetId} not controlled` }
    if (planet.exhausted) return { ok: false, error: `planet ${planetId} is exhausted` }
    resources += planet.resources
    influence += planet.influence
    systems[sysId] = { ...sys, planets: sys.planets.map(p => p.id === planetId ? { ...p, exhausted: true } : p) }
  }
  return { ok: true, value: { state: { ...state, systems }, resources, influence } }
}

export function payCost(state: GameState, seat: Seat, cost: number, planets: string[], tradeGoods: number): Result<GameState> {
  const player = state.players[seat]
  if (tradeGoods < 0 || tradeGoods > player.tradeGoods) return { ok: false, error: 'not enough trade goods' }
  const spent = exhaustPlanets(state, seat, planets)
  if (!spent.ok) return spent
  const paid = tradeGoods + spent.value.resources
  if (paid < cost) return { ok: false, error: `paid ${paid} of ${cost}` }
  const players = [...spent.value.state.players] as GameState['players']
  players[seat] = { ...player, tradeGoods: player.tradeGoods - tradeGoods }
  return { ok: true, value: { ...spent.value.state, players } }
}

const TOKEN_POOLS = ['tactic', 'fleet', 'strategy'] as const

/**
 * R3.3 and R6: `wanted` is the resulting command sheet. The three pools must sum to the current total
 * plus `gained`; without `redistribute` no pool may shrink, because Leadership and the status phase hand
 * out new tokens and only Warfare moves the ones already on the sheet. Undefined means "all into tactic".
 */
export function distributeTokens(state: GameState, seat: Seat, wanted: Player['tokens'] | undefined, gained: number, redistribute = false): Result<GameState> {
  const current = state.players[seat].tokens
  const target = wanted ?? { ...current, tactic: current.tactic + gained }
  for (const pool of TOKEN_POOLS) {
    if (!Number.isInteger(target[pool]) || target[pool] < 0) return { ok: false, error: `invalid token count for the ${pool} pool` }
    if (!redistribute && target[pool] < current[pool]) return { ok: false, error: `the ${pool} pool may not shrink here` }
  }
  const total = TOKEN_POOLS.reduce((sum, pool) => sum + target[pool], 0)
  if (total !== current.tactic + current.fleet + current.strategy + gained) return { ok: false, error: `distribute exactly ${gained} new command tokens` }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], tokens: target }
  return { ok: true, value: { ...state, players } }
}
```

`readyResources`, `productionCost`, `productionLimit`, `fleetPoolLimit`, `nonFighterShips` and `capacity` stay as they are.

- [ ] **Step 5: Guard the other action-phase moves and grow the test kit**

In `src/engine/actionPhase.ts` add one guard to `startTactical`, directly after the `if (state.tactical)` line:

```ts
  if (state.pendingSecondary) return { ok: false, error: 'R3.2: the opponent still has to answer the last strategy card' }
```

and the same line to `pass`, directly after its `if (state.tactical)` line.

In `src/engine/testUtils.ts` append:

```ts
/** Replaces the seat's strategy cards, all unused. */
export function withCards(state: GameState, seat: Seat, cards: StrategyCardId[]): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], strategyCards: cards.map(id => ({ id, used: false })) }
  return deepFreeze({ ...state, players })
}

export function withExhausted(state: GameState, planetIds: string[], exhausted = true): GameState {
  const systems = Object.fromEntries(Object.entries(state.systems).map(([id, sys]) => [id, {
    ...sys, planets: sys.planets.map(p => planetIds.includes(p.id) ? { ...p, exhausted } : p),
  }]))
  return deepFreeze({ ...state, systems })
}
```

- [ ] **Step 6: Implement the framework and the first three cards**

```ts
// src/engine/strategicActions.ts
import { FACTIONS } from '../data/factions'
import { MECATOL_ID, SYSTEM_IDS } from '../data/map'
import { otherSeat, passTurn } from './actionPhase'
import { distributeTokens, exhaustPlanets } from './economy'
import { canResearch } from './research'
import type { GameState, Result, Seat, StrategicParams, StrategyCardId } from './types'

/** The seat holding the card, used or not. */
export function cardOwner(state: GameState, card: StrategyCardId): Seat | null {
  for (const seat of [0, 1] as Seat[]) if (state.players[seat].strategyCards.some(c => c.id === card)) return seat
  return null
}

export function unusedCards(state: GameState, seat: Seat): StrategyCardId[] {
  return state.players[seat].strategyCards.filter(c => !c.used).map(c => c.id)
}

/** R3.2: every secondary but Leadership costs one token from the strategy pool. */
export function secondaryTokenCost(card: StrategyCardId): number {
  return card === 'leadership' ? 0 : 1
}

function spendStrategyTokens(state: GameState, seat: Seat, cost: number): Result<GameState> {
  if (cost === 0) return { ok: true, value: state }
  const player = state.players[seat]
  if (player.tokens.strategy < cost) return { ok: false, error: 'R3.2: no token in the strategy pool' }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, tokens: { ...player.tokens, strategy: player.tokens.strategy - cost } }
  return { ok: true, value: { ...state, players } }
}

/** R6 Diplomacy: every system but Mecatol Rex in which the seat controls a planet. */
export function diplomacySystems(state: GameState, seat: Seat): string[] {
  return SYSTEM_IDS.filter(id => id !== MECATOL_ID && state.systems[id].planets.some(p => p.owner === seat))
}

/** R6 Warfare: every system that holds a command token of the seat. */
export function warfareTokenSystems(state: GameState, seat: Seat): string[] {
  return SYSTEM_IDS.filter(id => state.systems[id].activatedBy.includes(seat))
}

/** R6 Diplomacy: readies up to `max` exhausted planets the seat controls. */
export function readyPlanets(state: GameState, seat: Seat, planets: string[], max: number): Result<GameState> {
  if (planets.length > max) return { ok: false, error: `R6: at most ${max} planets` }
  let systems = state.systems
  for (const planetId of planets) {
    const sysId = Object.keys(systems).find(id => systems[id].planets.some(p => p.id === planetId))
    if (!sysId) return { ok: false, error: `unknown planet ${planetId}` }
    const sys = systems[sysId]
    const planet = sys.planets.find(p => p.id === planetId)
    if (!planet || planet.owner !== seat) return { ok: false, error: `planet ${planetId} not controlled` }
    if (!planet.exhausted) return { ok: false, error: `planet ${planetId} is not exhausted` }
    systems = { ...systems, [sysId]: { ...sys, planets: sys.planets.map(p => p.id === planetId ? { ...p, exhausted: false } : p) } }
  }
  return { ok: true, value: { ...state, systems } }
}

/** R5: adds the technology after the prerequisite check; Inheritance Systems ignores the prerequisites. */
export function grantTech(state: GameState, seat: Seat, techId: string, ignorePrereqs: boolean): Result<GameState> {
  const player = state.players[seat]
  if (!canResearch(player, techId, ignorePrereqs)) return { ok: false, error: `R5: ${techId} cannot be researched` }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, techs: [...player.techs, techId] }
  return { ok: true, value: { ...state, players, log: [...state.log, { t: 'info', text: `seat ${seat} researches ${techId}` }] } }
}

function replenish(state: GameState, seat: Seat): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], commodities: FACTIONS[players[seat].faction].commodityValue }
  return { ...state, players }
}

function addTradeGoods(state: GameState, seat: Seat, n: number): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], tradeGoods: players[seat].tradeGoods + n }
  return { ...state, players }
}

/** R6 Leadership: `base` command tokens plus one for every 3 influence exhausted. */
function leadership(state: GameState, seat: Seat, params: StrategicParams, base: number): Result<GameState> {
  const spent = exhaustPlanets(state, seat, params.planets ?? [])
  if (!spent.ok) return spent
  return distributeTokens(spent.value.state, seat, params.tokens, base + Math.floor(spent.value.influence / 3))
}

/**
 * R6 Diplomacy, errata text: the opponent places a command token, then up to 2 of your planets ready.
 * R3.2: a card must always be playable, so with no eligible system only the readying half resolves.
 */
function diplomacyPrimary(state: GameState, seat: Seat, params: StrategicParams): Result<GameState> {
  const systemId = params.systemId
  if (systemId === undefined) {
    if (diplomacySystems(state, seat).length > 0) return { ok: false, error: 'R6: Diplomacy needs a system' }
    return readyPlanets(state, seat, params.planets ?? [], 2)
  }
  const sys = state.systems[systemId]
  if (!sys) return { ok: false, error: `unknown system ${systemId}` }
  if (systemId === MECATOL_ID) return { ok: false, error: 'R6: not the Mecatol Rex system' }
  if (!sys.planets.some(p => p.owner === seat)) return { ok: false, error: `R6: you control no planet in ${systemId}` }
  const other = otherSeat(seat)
  const systems = sys.activatedBy.includes(other)
    ? state.systems
    : { ...state.systems, [systemId]: { ...sys, activatedBy: [...sys.activatedBy, other] } }
  return readyPlanets({ ...state, systems }, seat, params.planets ?? [], 2)
}

function primary(state: GameState, seat: Seat, card: StrategyCardId, params: StrategicParams): Result<GameState> {
  switch (card) {
    case 'leadership':
      return leadership(state, seat, params, 3)
    case 'diplomacy':
      return diplomacyPrimary(state, seat, params)
    case 'trade': {
      let next = replenish(addTradeGoods(state, seat, 3), seat)
      if (params.shareWithOpponent) next = replenish(next, otherSeat(seat))
      return { ok: true, value: next }
    }
    default:
      return { ok: false, error: `no primary implemented for ${card}` }
  }
}

function secondaryEffect(state: GameState, seat: Seat, card: StrategyCardId, params: StrategicParams): Result<GameState> {
  switch (card) {
    case 'leadership':
      return leadership(state, seat, params, 0)
    case 'diplomacy':
      return readyPlanets(state, seat, params.planets ?? [], 2)
    case 'trade':
      return { ok: true, value: replenish(state, seat) }
    default:
      return { ok: false, error: `no secondary implemented for ${card}` }
  }
}

export function strategic(state: GameState, card: StrategyCardId, params: StrategicParams | undefined): Result<GameState> {
  if (state.phase !== 'action') return { ok: false, error: 'not in the action phase' }
  if (state.tactical) return { ok: false, error: 'finish the tactical action first' }
  if (state.pendingSecondary) return { ok: false, error: 'R3.2: the opponent still has to answer the last strategy card' }
  const seat = state.active
  if (state.players[seat].passed) return { ok: false, error: 'this player has passed' }
  const entry = state.players[seat].strategyCards.find(c => c.id === card)
  if (!entry) return { ok: false, error: `R3.2: seat ${seat} does not hold ${card}` }
  if (entry.used) return { ok: false, error: `R3.2: ${card} is already used` }
  const played = primary(state, seat, card, params ?? {})
  if (!played.ok) return played
  const players = [...played.value.players] as GameState['players']
  players[seat] = { ...players[seat], strategyCards: players[seat].strategyCards.map(c => c.id === card ? { ...c, used: true } : c) }
  return { ok: true, value: { ...played.value, players, pendingSecondary: card, active: otherSeat(seat) } }
}

export function secondary(state: GameState, card: StrategyCardId, accept: boolean, params: StrategicParams | undefined): Result<GameState> {
  if (state.phase !== 'action') return { ok: false, error: 'not in the action phase' }
  if (state.pendingSecondary !== card) return { ok: false, error: `R3.2: no secondary window for ${card}` }
  const seat = state.active
  const owner = cardOwner(state, card)
  if (owner === null || owner === seat) return { ok: false, error: 'R3.2: the card holder does not answer their own card' }
  let next = state
  if (accept) {
    const paid = spendStrategyTokens(state, seat, secondaryTokenCost(card))
    if (!paid.ok) return paid
    const used = secondaryEffect(paid.value, seat, card, params ?? {})
    if (!used.ok) return used
    next = used.value
  }
  // R3.2: the turn passes on from the card holder, so the answering seat keeps it unless it has passed.
  return { ok: true, value: passTurn({ ...next, pendingSecondary: null, active: owner }) }
}
```

- [ ] **Step 7: Wire the dispatcher**

In `src/engine/index.ts` add `import { secondary, strategic } from './strategicActions'` and the two cases:

```ts
      case 'strategic': result = strategic(state, move.card, move.params); break
      case 'secondary': result = secondary(state, move.card, move.accept, move.params); break
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- src/engine/strategicActions.test.ts src/engine/economy.test.ts src/engine/actionPhase.test.ts`
Expected: PASS, 13 new tests plus the untouched economy and action-phase suites.

- [ ] **Step 9: Type-check, lint and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/strategicActions.ts src/engine/economy.ts src/engine/actionPhase.ts src/engine/types.ts src/engine/index.ts src/engine/testUtils.ts docs/spec/engine-design.md
git commit -m "feat(engine): strategic action framework with Leadership, Diplomacy and Trade"
```

---

### Task 3: Strategic actions II, Warfare, Technology and Imperial

**Files:**
- Modify: `src/data/map.ts` (`homeSystemId`)
- Modify: `src/engine/strategicActions.ts` (the two switches, three new card functions)
- Modify: `src/engine/strategicActions.test.ts` (second describe block)

**Interfaces:**
- Produces in `data/map.ts`: `export function homeSystemId(seat: Seat): string`.
- R6 Warfare primary: `params.systemId` is **required** while the seat has a command token on the board; the card then takes that token off the board and the seat gains one. With no token on the board the card is pure redistribution, gains nothing and stays playable, so a player can always discharge it (R3.2).
- `primary` and `secondaryEffect` in `strategicActions.ts` become exhaustive over `StrategyCardId`; the `default` branches disappear, so a future card cannot be forgotten silently.
- Warfare's secondary reuses `production.produce` unchanged: the state is staged with `tactical = { systemId: homeSystemId(seat), step: 'production' }`, `produce` runs with the full R4.4 rule set (limit, cost with Sarween Tools, reinforcements, fleet pool, trimmed fighters) and the original `tactical` is put back afterwards. The strategy token is already spent by `secondary`, so `warfareSecondary` only produces.
- Technology resolves both technologies in order, so the first may be the prerequisite of the second; the second one costs 6 resources through `payCost`. The secondary costs the strategy token plus 4 resources. Both go through `canResearch`, so faction restrictions and the missing Dreadnought II for L1Z1X hold.
- Imperial scores at most one revealed, fulfilled and unscored public objective through `objectives.scoreObjective`, then adds 1 VP when the seat controls Mecatol Rex. Every parameter is optional, so a card can always be discharged; that is what keeps a player from being stuck with an unplayable card and unable to pass (R3.2).

- [ ] **Step 1: Write the failing test**

Append to `src/engine/strategicActions.test.ts`; its `testUtils` import grows by `withTechs` and the file imports `warfareTokenSystems` from `./strategicActions`, everything else is already there:

```ts
describe('R3.2 strategic actions, the remaining three cards', () => {
  it('R6 Warfare primary: a command token comes off the board, one is gained and the sheet is redistributed', () => {
    const base = holder('warfare')
    const s = deepFreeze({ ...base, systems: { ...base.systems, bereg: { ...base.systems.bereg, activatedBy: [0 as const] } } })
    const played = value(play(s, 'warfare', { systemId: 'bereg', tokens: { tactic: 2, fleet: 5, strategy: 2 } }))
    expect(played.systems.bereg.activatedBy).toEqual([])
    expect(played.players[0].tokens).toEqual({ tactic: 2, fleet: 5, strategy: 2 })   // 8 + 1, freely moved
    expect(play(s, 'warfare', { systemId: 'quann' }).ok).toBe(false)                  // no token of yours there
    expect(play(s, 'warfare', {}).ok).toBe(false)                                     // a token is on the board, name it
  })
  it('R6 Warfare primary: without a token on the board it only redistributes and gains nothing', () => {
    const s = holder('warfare')
    expect(warfareTokenSystems(s, 0)).toEqual([])
    expect(play(s, 'warfare', { tokens: { tactic: 1, fleet: 4, strategy: 3 } }).ok).toBe(true)
    expect(play(s, 'warfare', { tokens: { tactic: 2, fleet: 4, strategy: 3 } }).ok).toBe(false)   // 9, not 8
    expect(value(play(s, 'warfare')).players[0].tokens).toEqual({ tactic: 3, fleet: 3, strategy: 2 })
  })
  it('R6 Warfare secondary: a strategy token produces at the home space dock under the R4.4 rules', () => {
    const played = value(play(holder('warfare'), 'warfare'))
    const answered = value(answer(played, 'warfare', true, { units: { infantry: 2 }, planets: ['wren-terra'], tradeGoods: 0 }))
    expect(answered.players[1].tokens.strategy).toBe(1)
    expect(answered.systems['home-s'].planets.find(p => p.id === 'arc-prime')?.ground).toHaveLength(4)
    expect(answered.tactical).toBeNull()
    expect(answer(played, 'warfare', true, { units: { infantry: 99 }, planets: ['wren-terra'] }).ok).toBe(false)
    expect(answer(played, 'warfare', true, {}).ok).toBe(false)                        // nothing to produce
  })
  it('R5/R6 Technology primary: one technology, a second for 6 resources, in order', () => {
    const s = withPlayer(holder('technology'), 0, { tradeGoods: 1 })
    const played = value(play(s, 'technology', { techId: 'antimass_deflectors', secondTechId: 'gravity_drive', planets: ['000'], tradeGoods: 1 }))
    expect(played.players[0].techs).toContain('antimass_deflectors')
    expect(played.players[0].techs).toContain('gravity_drive')      // prerequisite met by the first one
    expect(played.players[0].tradeGoods).toBe(0)
    expect(played.systems['home-n'].planets[0].exhausted).toBe(true)
  })
  it('R5: the second technology needs the first, the payment and a met prerequisite', () => {
    const s = holder('technology')
    expect(play(s, 'technology', { secondTechId: 'sarween_tools', planets: ['000'], tradeGoods: 1 }).ok).toBe(false)
    expect(play(s, 'technology', { techId: 'sarween_tools', secondTechId: 'antimass_deflectors', planets: ['000'] }).ok).toBe(false)   // 5 of 6
    expect(play(s, 'technology', { techId: 'war_sun' }).ok).toBe(false)                // prerequisites missing
    expect(play(s, 'technology', { techId: 'l4_disruptors' }).ok).toBe(false)          // wrong faction
    expect(value(play(s, 'technology')).players[0].techs).toHaveLength(2)              // researching nothing is allowed
  })
  it('R5/R6 Technology secondary: a strategy token and 4 resources for one technology', () => {
    const played = value(play(holder('technology'), 'technology'))
    const answered = value(answer(played, 'technology', true, { techId: 'sarween_tools', planets: ['arc-prime'] }))
    expect(answered.players[1].techs).toContain('sarween_tools')
    expect(answered.players[1].tokens.strategy).toBe(1)
    expect(answer(played, 'technology', true, { techId: 'sarween_tools', planets: ['wren-terra'] }).ok).toBe(false)   // 2 of 4
    expect(answer(played, 'technology', true, {}).ok).toBe(false)
  })
  it('R7/R6 Imperial primary: scores one fulfilled public objective and 1 VP for Mecatol Rex', () => {
    let s = withTechs(holder('imperial'), 0, ['sarween_tools'])
    s = withPlanetOwner(s, 'mecatol', 'mecatol-rex', 0)
    const played = value(play(s, 'imperial', { objectiveId: 'own_3_techs' }))
    expect(played.players[0].vp).toBe(2)
    expect(played.players[0].scoredObjectives).toEqual(['own_3_techs'])
    expect(play(s, 'imperial', { objectiveId: 'control_5_planets' }).ok).toBe(false)   // not revealed
    expect(play(holder('imperial'), 'imperial', { objectiveId: 'own_3_techs' }).ok).toBe(false)   // not fulfilled
    expect(play(withPlayer(s, 0, { scoredObjectives: ['own_3_techs'] }), 'imperial', { objectiveId: 'own_3_techs' }).ok).toBe(false)
    expect(value(play(holder('imperial'), 'imperial')).players[0].vp).toBe(0)          // no objective, no Mecatol Rex
  })
  it('R6 Imperial secondary: a strategy token for 2 trade goods', () => {
    const played = value(play(holder('imperial'), 'imperial'))
    const answered = value(answer(played, 'imperial', true))
    expect(answered.players[1]).toMatchObject({ tradeGoods: 2, tokens: { tactic: 3, fleet: 3, strategy: 1 } })
    expect(value(answer(played, 'imperial', false)).players[1].tradeGoods).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails, then commit it**

Run: `npm test -- src/engine/strategicActions.test.ts`
Expected: FAIL, eight new tests, `no primary implemented for warfare` and friends, and `warfareTokenSystems` is not exported yet.

```bash
git add src/engine/strategicActions.test.ts
git commit -m "test(engine): Warfare, Technology and Imperial strategy cards"
```

- [ ] **Step 3: Add the home system lookup**

In `src/data/map.ts` append:

```ts
export function homeSystemId(seat: Seat): string {
  const sys = SYSTEMS.find(s => s.home === seat)
  if (!sys) throw new Error(`no home system for seat ${seat}`)
  return sys.id
}
```

- [ ] **Step 4: Implement the three remaining cards**

In `src/engine/strategicActions.ts` extend the imports:

```ts
import { MECATOL_ID, homeSystemId } from '../data/map'
import { payCost } from './economy'
import { controlsMecatol, addVp, fulfils, scoreObjective } from './objectives'
import { produce } from './production'
```

(the existing `import { distributeTokens, exhaustPlanets } from './economy'` line becomes `import { distributeTokens, exhaustPlanets, payCost } from './economy'`).

Add the three card functions above `primary`:

```ts
/**
 * R6 Warfare: one of your command tokens leaves the board and you gain one, then you may move any of them.
 * With a token on the board the system must be named; with none the card is pure redistribution and gains
 * nothing, so it stays playable (R3.2).
 */
function warfarePrimary(state: GameState, seat: Seat, params: StrategicParams): Result<GameState> {
  const onBoard = warfareTokenSystems(state, seat)
  const systemId = params.systemId
  if (systemId === undefined) {
    if (onBoard.length > 0) return { ok: false, error: 'R6: name the system your command token comes from' }
    return distributeTokens(state, seat, params.tokens, 0, true)
  }
  const sys = state.systems[systemId]
  if (!sys) return { ok: false, error: `unknown system ${systemId}` }
  if (!sys.activatedBy.includes(seat)) return { ok: false, error: `R6: no command token of yours in ${systemId}` }
  const next = { ...state, systems: { ...state.systems, [systemId]: { ...sys, activatedBy: sys.activatedBy.filter(s => s !== seat) } } }
  return distributeTokens(next, seat, params.tokens, 1, true)
}

/** R6 Warfare secondary: the R4.4 production of a space dock in your own home system. */
function warfareSecondary(state: GameState, seat: Seat, params: StrategicParams): Result<GameState> {
  const staged: GameState = { ...state, tactical: { systemId: homeSystemId(seat), step: 'production' } }
  const made = produce(staged, params.units ?? {}, params.planets ?? [], params.tradeGoods ?? 0)
  if (!made.ok) return made
  return { ok: true, value: { ...made.value, tactical: state.tactical } }
}

/** R5: one technology, then optionally a second one for 6 resources; the first may be the prerequisite. */
function technologyPrimary(state: GameState, seat: Seat, params: StrategicParams): Result<GameState> {
  let next = state
  if (params.techId !== undefined) {
    const first = grantTech(next, seat, params.techId, false)
    if (!first.ok) return first
    next = first.value
  }
  if (params.secondTechId !== undefined) {
    if (params.techId === undefined) return { ok: false, error: 'R5: the second technology needs the first' }
    const paid = payCost(next, seat, 6, params.planets ?? [], params.tradeGoods ?? 0)
    if (!paid.ok) return paid
    const second = grantTech(paid.value, seat, params.secondTechId, false)
    if (!second.ok) return second
    next = second.value
  }
  return { ok: true, value: next }
}

function technologySecondary(state: GameState, seat: Seat, params: StrategicParams): Result<GameState> {
  if (params.techId === undefined) return { ok: false, error: 'R5: name the technology to research' }
  const paid = payCost(state, seat, 4, params.planets ?? [], params.tradeGoods ?? 0)
  if (!paid.ok) return paid
  return grantTech(paid.value, seat, params.techId, false)
}

/** R6/R7 Imperial: score one fulfilled public objective, then 1 VP for Mecatol Rex. */
function imperialPrimary(state: GameState, seat: Seat, params: StrategicParams): Result<GameState> {
  let next = state
  const id = params.objectiveId
  if (id !== undefined) {
    if (!state.publicObjectives.includes(id)) return { ok: false, error: `R7: ${id} is not a revealed public objective` }
    if (state.players[seat].scoredObjectives.includes(id)) return { ok: false, error: `R7: ${id} is already scored` }
    if (!fulfils(state, seat, id)) return { ok: false, error: `R7: ${id} is not fulfilled` }
    next = scoreObjective(next, seat, id)
  }
  if (controlsMecatol(next, seat)) next = addVp(next, seat, 1, 'Imperial primary: Mecatol Rex')
  return { ok: true, value: next }
}
```

Replace both switches with their exhaustive versions:

```ts
function primary(state: GameState, seat: Seat, card: StrategyCardId, params: StrategicParams): Result<GameState> {
  switch (card) {
    case 'leadership':
      return leadership(state, seat, params, 3)
    case 'diplomacy':
      return diplomacyPrimary(state, seat, params)
    case 'trade': {
      let next = replenish(addTradeGoods(state, seat, 3), seat)
      if (params.shareWithOpponent) next = replenish(next, otherSeat(seat))
      return { ok: true, value: next }
    }
    case 'warfare':
      return warfarePrimary(state, seat, params)
    case 'technology':
      return technologyPrimary(state, seat, params)
    case 'imperial':
      return imperialPrimary(state, seat, params)
  }
}

function secondaryEffect(state: GameState, seat: Seat, card: StrategyCardId, params: StrategicParams): Result<GameState> {
  switch (card) {
    case 'leadership':
      return leadership(state, seat, params, 0)
    case 'diplomacy':
      return readyPlanets(state, seat, params.planets ?? [], 2)
    case 'trade':
      return { ok: true, value: replenish(state, seat) }
    case 'warfare':
      return warfareSecondary(state, seat, params)
    case 'technology':
      return technologySecondary(state, seat, params)
    case 'imperial':
      return { ok: true, value: addTradeGoods(state, seat, 2) }   // R6: replaces "draw a secret objective"
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/engine/strategicActions.test.ts src/engine/production.test.ts`
Expected: PASS, 21 tests in the strategic suite, production untouched.

- [ ] **Step 6: Type-check, lint and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/strategicActions.ts src/data/map.ts
git commit -m "feat(engine): Warfare, Technology and Imperial strategy cards"
```

---

### Task 4: Component actions and trade posts

**Files:**
- Modify: `src/engine/economy.ts` (`cheapestPlanets`)
- Create: `src/engine/componentActions.ts`
- Modify: `src/engine/index.ts` (dispatcher cases `research`, `shipyard`, `tradePost`)
- Modify: `docs/spec/engine-design.md` (module table)
- Test: `src/engine/componentActions.test.ts`

**Interfaces:**
- Produces in `economy.ts`:
  ```ts
  export function cheapestPlanets(state: GameState, seat: Seat, cost: number): string[] | null
  ```
  The cheapest set of ready planets of the seat that covers `cost`: minimal total resources, then the fewest planets, then map order. `cost <= 0` gives `[]`, an impossible cost gives `null`. It exists because the `research` move carries no payment parameters, and the enumerator uses it to build payable templates.
- Produces in `componentActions.ts`:
  ```ts
  export function canInheritance(state: GameState, seat: Seat): boolean
  export function inheritanceTechs(state: GameState, seat: Seat): string[]
  export function research(state: GameState, techId: string): Result<GameState>
  export function canShipyard(state: GameState, seat: Seat): boolean
  export function shipyardPlanets(state: GameState, seat: Seat): string[]
  export function shipyard(state: GameState, planetId: string, planets: string[], tradeGoods: number): Result<GameState>
  export function tradePostOptions(state: GameState, seat: Seat): ('west' | 'east')[]
  export function tradePost(state: GameState, post: 'west' | 'east', commodities: number): Result<GameState>
  ```
  R3.2: a component action is a whole turn, so `research` and `shipyard` end it with `passTurn`. R8: trading at a post is free and the turn goes on. All three need the seat's own turn in the action phase with no tactical action and no open secondary window. R6: Inheritance Systems exhausts (`inheritanceExhausted`), costs 2 resources and ignores prerequisites; the emergency shipyard is once per game (`shipyardUsed`), only while the seat controls no space dock at all, and costs one strategy token plus 4 resources.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/componentActions.test.ts
import { describe, expect, it } from 'vitest'
import { canShipyard, tradePostOptions } from './componentActions'
import { applyMove } from './index'
import { deepFreeze, toActionPhase, withCards, withExhausted, withPlanetOwner, withPlayer, withTechs } from './testUtils'
import type { GameState, Result } from './types'

const value = (r: Result<GameState>): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const inherit = (state: GameState, techId: string) => applyMove(deepFreeze(state), { type: 'research', techId, via: 'inheritance' }, 0)
const build = (state: GameState, planetId: string, planets: string[], tradeGoods = 0) =>
  applyMove(deepFreeze(state), { type: 'shipyard', planetId, planets, tradeGoods }, 0)
const sell = (state: GameState, post: 'west' | 'east', commodities: number) =>
  applyMove(deepFreeze(state), { type: 'tradePost', post, commodities }, 0)

/** Takes every space dock of the seat off the board, the precondition of the emergency shipyard. */
function withoutDocks(state: GameState, seat: 0 | 1): GameState {
  const systems = Object.fromEntries(Object.entries(state.systems).map(([id, sys]) => [id, {
    ...sys, planets: sys.planets.map(p => ({ ...p, structures: p.structures.filter(u => !(u.type === 'spacedock' && u.owner === seat)) })),
  }]))
  return deepFreeze({ ...state, systems })
}

describe('R6/R8 component actions', () => {
  it('R6: Inheritance Systems exhausts, pays 2 resources, ignores prerequisites and ends the turn', () => {
    const s = withTechs(toActionPhase(), 0, ['inheritance_systems'])
    const done = value(inherit(s, 'war_sun'))                       // red 3 and yellow 1 are missing
    expect(done.players[0].techs).toContain('war_sun')
    expect(done.players[0].inheritanceExhausted).toBe(true)
    expect(done.systems['home-n'].planets[0].exhausted).toBe(true)  // [0.0.0] is the only ready planet
    expect(done.active).toBe(1)
    expect(inherit({ ...done, active: 0 }, 'sarween_tools').ok).toBe(false)   // the card stays exhausted this round
  })
  it('R6: without the technology, without resources or with a known technology the action is illegal', () => {
    expect(inherit(toActionPhase(), 'war_sun').ok).toBe(false)      // seat 0 does not own the card
    const rich = withTechs(toActionPhase(), 0, ['inheritance_systems'])
    expect(inherit(rich, 'plasma_scoring').ok).toBe(false)          // already owned
    expect(inherit(rich, 'dreadnought_ii').ok).toBe(false)          // never available to L1Z1X
    const broke = withExhausted(rich, ['000'])                      // [0.0.0] is the only planet seat 0 controls
    expect(inherit(broke, 'sarween_tools').ok).toBe(false)          // no ready planet pays the 2 resources
  })
  it('R6: the emergency shipyard needs no space dock, a strategy token and 4 resources, once per game', () => {
    const s = withoutDocks(toActionPhase(), 0)
    expect(canShipyard(toActionPhase(), 0)).toBe(false)             // a dock still stands on [0.0.0]
    expect(canShipyard(s, 0)).toBe(true)
    const done = value(build(s, '000', ['000']))
    expect(done.systems['home-n'].planets[0].structures.some(u => u.type === 'spacedock' && u.owner === 0)).toBe(true)
    expect(done.players[0]).toMatchObject({ shipyardUsed: true, tokens: { tactic: 3, fleet: 3, strategy: 1 } })
    expect(done.systems['home-n'].planets[0].exhausted).toBe(true)
    expect(done.active).toBe(1)
    expect(canShipyard(done, 0)).toBe(false)
    expect(build(withPlayer(s, 0, { tokens: { tactic: 3, fleet: 3, strategy: 0 } }), '000', ['000']).ok).toBe(false)
    expect(build(s, 'arc-prime', ['000']).ok).toBe(false)           // not controlled
    expect(build(s, '000', []).ok).toBe(false)                      // 0 of 4 resources
  })
  it('R8: a trade post sells up to 2 commodities 1:1 and does not end the turn', () => {
    const base = toActionPhase()
    expect(tradePostOptions(base, 0)).toEqual([])                   // no planet next to a post
    const s = withPlanetOwner(base, 'bereg', 'bereg', 0)
    expect(tradePostOptions(s, 0)).toEqual(['east'])
    const done = value(sell(s, 'east', 2))
    expect(done.players[0]).toMatchObject({ commodities: 0, tradeGoods: 2, tradedThisRound: { west: false, east: true } })
    expect(done.active).toBe(0)                                     // R8: trading is free
    expect(sell(done, 'east', 1).ok).toBe(false)                    // once per round per post
    expect(sell(s, 'west', 1).ok).toBe(false)                       // no planet next to the west post
    expect(sell(s, 'east', 3).ok).toBe(false)
    expect(sell(s, 'east', 0).ok).toBe(false)
  })
  it('R3.2: component actions need your own turn with nothing else running', () => {
    const s = withTechs(withPlanetOwner(toActionPhase(), 'bereg', 'bereg', 0), 0, ['inheritance_systems'])
    const running: GameState = deepFreeze({ ...s, tactical: { systemId: 'bereg', step: 'movement' } })
    expect(inherit(running, 'war_sun').ok).toBe(false)
    expect(sell(running, 'east', 1).ok).toBe(false)
    const window = value(applyMove(withCards(s, 0, ['trade']), { type: 'strategic', card: 'trade' }, 0))
    expect(inherit(window, 'war_sun').ok).toBe(false)
    expect(sell(window, 'east', 1).ok).toBe(false)
    expect(sell(withPlayer(s, 0, { passed: true }), 'east', 1).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails, then commit it**

Run: `npm test -- src/engine/componentActions.test.ts`
Expected: FAIL, `src/engine/componentActions.ts` does not exist.

```bash
git add src/engine/componentActions.test.ts
git commit -m "test(engine): Inheritance Systems, emergency shipyard and trade posts"
```

- [ ] **Step 3: Add the payment helper**

Append to `src/engine/economy.ts`:

```ts
/**
 * The cheapest set of ready planets of the seat that covers `cost`: least total resources, then fewest
 * planets, then map order. Used where a move carries no payment parameters (R6 Inheritance Systems) and by
 * the enumerator to build payable templates. Seven systems means at most nine planets, so the exact search
 * over all subsets is cheap and deterministic.
 */
export function cheapestPlanets(state: GameState, seat: Seat, cost: number): string[] | null {
  if (cost <= 0) return []
  const ready: { id: string; resources: number }[] = []
  for (const sys of Object.values(state.systems)) {
    for (const p of sys.planets) if (p.owner === seat && !p.exhausted) ready.push({ id: p.id, resources: p.resources })
  }
  let best: { ids: string[]; total: number } | null = null
  for (let mask = 1; mask < 1 << ready.length; mask++) {
    let total = 0
    const ids: string[] = []
    for (let i = 0; i < ready.length; i++) if (mask & (1 << i)) { total += ready[i].resources; ids.push(ready[i].id) }
    if (total < cost) continue
    if (!best || total < best.total || (total === best.total && ids.length < best.ids.length)) best = { ids, total }
  }
  return best ? best.ids : null
}
```

- [ ] **Step 4: Implement the component actions**

```ts
// src/engine/componentActions.ts
import { TRADE_POSTS } from '../data/map'
import { TECHS } from '../data/techs'
import { passTurn } from './actionPhase'
import { cheapestPlanets, payCost } from './economy'
import { controlledPlanets } from './objectives'
import { canResearch } from './research'
import { unitsOf } from './setup'
import { grantTech } from './strategicActions'
import type { GameState, Result, Seat, Unit } from './types'

const INHERITANCE_COST = 2
const SHIPYARD_COST = 4

/** R3.2: a component action needs your own turn, with no tactical action and no open secondary window. */
function turnReady(state: GameState): Result<Seat> {
  if (state.phase !== 'action') return { ok: false, error: 'not in the action phase' }
  if (state.tactical) return { ok: false, error: 'finish the tactical action first' }
  if (state.pendingSecondary) return { ok: false, error: 'R3.2: the opponent still has to answer the last strategy card' }
  const seat = state.active
  if (state.players[seat].passed) return { ok: false, error: 'this player has passed' }
  return { ok: true, value: seat }
}

export function canInheritance(state: GameState, seat: Seat): boolean {
  const player = state.players[seat]
  return player.techs.includes('inheritance_systems') && !player.inheritanceExhausted
    && cheapestPlanets(state, seat, INHERITANCE_COST) !== null
}

/** R5/R6: Inheritance Systems ignores the prerequisites, so every technology of the faction is open. */
export function inheritanceTechs(state: GameState, seat: Seat): string[] {
  return TECHS.map(t => t.id).filter(id => canResearch(state.players[seat], id, true))
}

export function research(state: GameState, techId: string): Result<GameState> {
  const ready = turnReady(state)
  if (!ready.ok) return ready
  const seat = ready.value
  const player = state.players[seat]
  if (!player.techs.includes('inheritance_systems')) return { ok: false, error: 'R6: Inheritance Systems is not owned' }
  if (player.inheritanceExhausted) return { ok: false, error: 'R6: Inheritance Systems is exhausted' }
  const planets = cheapestPlanets(state, seat, INHERITANCE_COST)
  if (!planets) return { ok: false, error: `R6: ${INHERITANCE_COST} resources are needed` }
  const paid = payCost(state, seat, INHERITANCE_COST, planets, 0)
  if (!paid.ok) return paid
  const granted = grantTech(paid.value, seat, techId, true)
  if (!granted.ok) return granted
  const players = [...granted.value.players] as GameState['players']
  players[seat] = { ...players[seat], inheritanceExhausted: true }
  return { ok: true, value: passTurn({ ...granted.value, players }) }
}

export function canShipyard(state: GameState, seat: Seat): boolean {
  const player = state.players[seat]
  return !player.shipyardUsed && player.tokens.strategy >= 1 && player.reinforcements.spacedock >= 1
    && !unitsOf(state, seat).some(u => u.type === 'spacedock')
    && cheapestPlanets(state, seat, SHIPYARD_COST) !== null
    && controlledPlanets(state, seat).length > 0
}

export function shipyardPlanets(state: GameState, seat: Seat): string[] {
  return controlledPlanets(state, seat).map(p => p.planetId)
}

/** R6: once per game, only without a space dock, one strategy token plus 4 resources. */
export function shipyard(state: GameState, planetId: string, planets: string[], tradeGoods: number): Result<GameState> {
  const ready = turnReady(state)
  if (!ready.ok) return ready
  const seat = ready.value
  const player = state.players[seat]
  if (player.shipyardUsed) return { ok: false, error: 'R6: the emergency shipyard is used up' }
  if (unitsOf(state, seat).some(u => u.type === 'spacedock')) return { ok: false, error: 'R6: only while you control no space dock' }
  if (player.reinforcements.spacedock < 1) return { ok: false, error: 'no space dock in the reinforcements' }
  if (player.tokens.strategy < 1) return { ok: false, error: 'R6: no token in the strategy pool' }
  const sysId = Object.keys(state.systems).find(id => state.systems[id].planets.some(p => p.id === planetId))
  if (!sysId) return { ok: false, error: `unknown planet ${planetId}` }
  const target = state.systems[sysId].planets.find(p => p.id === planetId)
  if (!target || target.owner !== seat) return { ok: false, error: `planet ${planetId} not controlled` }
  const paid = payCost(state, seat, SHIPYARD_COST, planets, tradeGoods)
  if (!paid.ok) return paid
  const dock: Unit = { id: paid.value.nextUnitId, type: 'spacedock', owner: seat, damaged: false }
  const players = [...paid.value.players] as GameState['players']
  const me = players[seat]
  players[seat] = {
    ...me, shipyardUsed: true,
    tokens: { ...me.tokens, strategy: me.tokens.strategy - 1 },
    reinforcements: { ...me.reinforcements, spacedock: me.reinforcements.spacedock - 1 },
  }
  const sys = paid.value.systems[sysId]
  return {
    ok: true,
    value: passTurn({
      ...paid.value, players, nextUnitId: paid.value.nextUnitId + 1,
      systems: {
        ...paid.value.systems,
        [sysId]: { ...sys, planets: sys.planets.map(p => p.id === planetId ? { ...p, structures: [...p.structures, dock] } : p) },
      },
      log: [...paid.value.log, { t: 'info', text: `seat ${seat} builds an emergency space dock on ${planetId}` }],
    }),
  }
}

/** R8: the posts a seat may still use this round. */
export function tradePostOptions(state: GameState, seat: Seat): ('west' | 'east')[] {
  const player = state.players[seat]
  if (player.commodities < 1) return []
  return (['west', 'east'] as const).filter(post => !player.tradedThisRound[post]
    && TRADE_POSTS[post].some(id => state.systems[id].planets.some(p => p.owner === seat)))
}

/** R8: at most 2 commodities for 1 trade good each, once per round per post; the turn goes on. */
export function tradePost(state: GameState, post: 'west' | 'east', commodities: number): Result<GameState> {
  const ready = turnReady(state)
  if (!ready.ok) return ready
  const seat = ready.value
  const player = state.players[seat]
  if (!Number.isInteger(commodities) || commodities < 1 || commodities > 2) return { ok: false, error: 'R8: 1 or 2 commodities' }
  if (commodities > player.commodities) return { ok: false, error: 'R8: not enough commodities' }
  if (player.tradedThisRound[post]) return { ok: false, error: `R8: the ${post} post is already used this round` }
  if (!TRADE_POSTS[post].some(id => state.systems[id].planets.some(p => p.owner === seat))) {
    return { ok: false, error: `R8: no planet controlled in a system linked to the ${post} post` }
  }
  const players = [...state.players] as GameState['players']
  players[seat] = {
    ...player,
    commodities: player.commodities - commodities,
    tradeGoods: player.tradeGoods + commodities,
    tradedThisRound: { ...player.tradedThisRound, [post]: true },
  }
  return {
    ok: true,
    value: { ...state, players, log: [...state.log, { t: 'info', text: `seat ${seat} sells ${commodities} commodities at the ${post} post` }] },
  }
}
```

- [ ] **Step 5: Wire the dispatcher and the module table**

In `src/engine/index.ts` add `import { research, shipyard, tradePost } from './componentActions'` and the three cases:

```ts
      case 'research': result = research(state, move.techId); break
      case 'shipyard': result = shipyard(state, move.planetId, move.planets, move.tradeGoods); break
      case 'tradePost': result = tradePost(state, move.post, move.commodities); break
```

In `docs/spec/engine-design.md` add one row to the module table, below `src/engine/strategicActions.ts`:

```
| `src/engine/componentActions.ts` | Inheritance Systems research, emergency shipyard, trade posts |
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/engine/componentActions.test.ts src/engine/economy.test.ts`
Expected: PASS, 5 new tests.

- [ ] **Step 7: Type-check, lint and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/componentActions.ts src/engine/economy.ts src/engine/index.ts docs/spec/engine-design.md
git commit -m "feat(engine): Inheritance Systems research, emergency shipyard and trade posts"
```

---

### Task 5: Status phase, scoring, victory and round advance

**Files:**
- Create: `src/engine/statusPhase.ts`
- Modify: `src/engine/index.ts` (dispatcher case `status`)
- Modify: `src/engine/testUtils.ts` (`toStatusPhase`)
- Modify: `docs/spec/engine-design.md` (module table row wording)
- Test: `src/engine/statusPhase.test.ts`

**Interfaces:**
- Produces in `statusPhase.ts`:
  ```ts
  export function tokensGained(state: GameState, seat: Seat): number       // 2, three with Hyper Metabolism
  export function scoreAll(state: GameState, seat: Seat): GameState
  export function decideWinner(state: GameState): Seat
  export function victoryCheck(state: GameState): Seat | null
  export function finishStatusPhase(state: GameState, seed: number): GameState
  export function status(state: GameState, params: StatusParams, seed: number): Result<GameState>
  ```
  R3.3: each player submits one `status` move, the speaker first, then the other seat; the move carries only the token distribution, everything a player may score is scored automatically because the duel has no reason to decline a point. The second move finishes the phase: reveal the next public objective (rounds 1 to 5), ready every planet, ready the exhausted cards (`inheritanceExhausted`), return the played strategy cards to the pool with bonus 0 while the unpicked cards keep the trade goods they have collected (R3.1), take every command token off the map, reset the per-round flags (`passed`, `mandateEarnedThisRound`, `spentInOneProductionThisRound`, `tradedThisRound`), roll a new guardian fleet while Mecatol Rex is uncontrolled, run the victory check, pass the speaker token and start the next round in the strategy phase with a fresh snake draft.
  R7 victory: the check fires when a player has 7 or more VP, and unconditionally after the round 6 status phase. `decideWinner` is higher VP, then the Mecatol Rex controller, then more planets, then the opponent of the speaker of the finished round, so it is called before the speaker token moves.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/statusPhase.test.ts
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
        { ...base.players[0], inheritanceExhausted: true, spentInOneProductionThisRound: 8, tradedThisRound: { west: true, east: true }, passed: true, mandateEarnedThisRound: true, mandateScored: true },
        { ...base.players[1], passed: true },
      ] as GameState['players'],
      systems: { ...base.systems, bereg: { ...base.systems.bereg, activatedBy: [0 as const], planets: base.systems.bereg.planets.map(p => ({ ...p, exhausted: true })) } },
    })
    const done = bothSubmit(toStatusPhase(dirty))
    expect(done.systems.bereg.activatedBy).toEqual([])
    expect(done.systems.bereg.planets.every(p => !p.exhausted)).toBe(true)
    expect(done.players[0]).toMatchObject({ inheritanceExhausted: false, spentInOneProductionThisRound: 0, passed: false, mandateEarnedThisRound: false, tradedThisRound: { west: false, east: false } })
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
```

- [ ] **Step 2: Run the test to verify it fails, then commit it**

Run: `npm test -- src/engine/statusPhase.test.ts`
Expected: FAIL, `src/engine/statusPhase.ts` and `toStatusPhase` do not exist.

```bash
git add src/engine/statusPhase.test.ts
git commit -m "test(engine): status phase scoring, readying, victory and round advance"
```

- [ ] **Step 3: Grow the test kit**

Append to `src/engine/testUtils.ts`:

```ts
/** Puts a state into the status phase the way `pass` does: speaker first, nothing else running. */
export function toStatusPhase(state: GameState): GameState {
  return deepFreeze({ ...state, phase: 'status' as const, tactical: null, pendingSecondary: null, active: state.speaker })
}
```

- [ ] **Step 4: Implement the status phase**

```ts
// src/engine/statusPhase.ts
import { MECATOL_ID } from '../data/map'
import { PUBLIC_OBJECTIVES } from '../data/objectives'
import { otherSeat } from './actionPhase'
import { distributeTokens } from './economy'
import { addVp, controlledPlanets, controlsMecatol, scoreObjective, scoreable } from './objectives'
import { deriveSeed } from './rng'
import { ALL_STRATEGY_CARDS, rollGuardianFleet } from './setup'
import type { GameState, Result, Seat, StatusParams } from './types'

/** R3.3 step 3: two command tokens, three with Hyper Metabolism. */
export function tokensGained(state: GameState, seat: Seat): number {
  return state.players[seat].techs.includes('hyper_metabolism') ? 3 : 2
}

/** R3.3 step 1: every objective the seat may score, plus 1 VP for Mecatol Rex. */
export function scoreAll(state: GameState, seat: Seat): GameState {
  let next = state
  for (const id of scoreable(state, seat)) next = scoreObjective(next, seat, id)
  if (controlsMecatol(next, seat)) next = addVp(next, seat, 1, 'Mecatol Rex')
  return next
}

/** R7: higher VP, then the Mecatol Rex controller, then more planets, then the speaker's opponent. */
export function decideWinner(state: GameState): Seat {
  const [a, b] = state.players
  if (a.vp !== b.vp) return a.vp > b.vp ? 0 : 1
  if (controlsMecatol(state, 0)) return 0
  if (controlsMecatol(state, 1)) return 1
  const planets: [number, number] = [controlledPlanets(state, 0).length, controlledPlanets(state, 1).length]
  if (planets[0] !== planets[1]) return planets[0] > planets[1] ? 0 : 1
  return otherSeat(state.speaker)
}

/** R7: the check fires at 7 VP and unconditionally after the round 6 status phase. */
export function victoryCheck(state: GameState): Seat | null {
  if (state.players[0].vp < 7 && state.players[1].vp < 7 && state.round < 6) return null
  return decideWinner(state)
}

/** R3.3 steps 2 and 4 to 6, run once both players have submitted their status move. */
export function finishStatusPhase(state: GameState, seed: number): GameState {
  let next = state
  const revealed = PUBLIC_OBJECTIVES[state.round]
  if (state.round < 6 && revealed && !next.publicObjectives.includes(revealed.id)) {
    next = {
      ...next,
      publicObjectives: [...next.publicObjectives, revealed.id],
      log: [...next.log, { t: 'info', text: `objective revealed: ${revealed.text}` }],
    }
  }
  const systems = Object.fromEntries(Object.entries(next.systems).map(([id, sys]) => [id, {
    ...sys, activatedBy: [], planets: sys.planets.map(p => ({ ...p, exhausted: false })),
  }]))
  const players = next.players.map(p => ({
    ...p, strategyCards: [], passed: false, inheritanceExhausted: false,
    mandateEarnedThisRound: false, spentInOneProductionThisRound: 0, tradedThisRound: { west: false, east: false },
  })) as GameState['players']
  // R3.1: the played cards come back with bonus 0, the unpicked ones keep the trade goods they collected
  const strategyPool = ALL_STRATEGY_CARDS.map(id => ({ id, bonus: next.strategyPool.find(c => c.id === id)?.bonus ?? 0 }))
  next = { ...next, systems, players, strategyPool, tactical: null, pendingSecondary: null }
  // R3.3 step 5 / R4.2: a fresh guardian fleet as long as nobody controls Mecatol Rex
  if (!next.systems[MECATOL_ID].planets.some(p => p.owner !== null)) next = rollGuardianFleet(next, deriveSeed(seed, 91))
  const winner = victoryCheck(next)
  if (winner !== null) {
    return { ...next, phase: 'ended', winner, draft: [], log: [...next.log, { t: 'info', text: `seat ${winner} wins with ${next.players[winner].vp} VP` }] }
  }
  // R3.3 step 6 and R3.1: the speaker token moves on and the next round drafts anew
  const speaker = otherSeat(next.speaker)
  const other = otherSeat(speaker)
  return { ...next, round: next.round + 1, phase: 'strategy', speaker, active: speaker, draft: [speaker, other, other, speaker] }
}

export function status(state: GameState, params: StatusParams, seed: number): Result<GameState> {
  if (state.phase !== 'status') return { ok: false, error: 'not in the status phase' }
  const seat = state.active
  const scored = scoreAll(state, seat)
  const distributed = distributeTokens(scored, seat, params.tokens, tokensGained(state, seat))
  if (!distributed.ok) return distributed
  // R3.3: the speaker submits first; the second move closes the phase
  if (seat === state.speaker) return { ok: true, value: { ...distributed.value, active: otherSeat(seat) } }
  return { ok: true, value: finishStatusPhase(distributed.value, seed) }
}
```

- [ ] **Step 5: Wire the dispatcher and the module table**

In `src/engine/index.ts` add `import { status } from './statusPhase'` and the case:

```ts
      case 'status': result = status(state, move.params, seed); break
```

In `docs/spec/engine-design.md` replace the `src/engine/statusPhase.ts` row with:

```
| `src/engine/statusPhase.ts` | one status move per player: scoring, token distribution, readying, guardian respawn, victory and round advance |
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/engine/statusPhase.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 7: Type-check, lint and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/statusPhase.ts src/engine/index.ts src/engine/testUtils.ts docs/spec/engine-design.md
git commit -m "feat(engine): status phase with scoring, readying, victory check and round advance"
```

---

### Task 6: Legal moves for every phase, structural validation and the full-game smoke test

**Files:**
- Modify: `src/engine/legalMoves.ts` (strategic, secondary, component, trade post and status branches; structural `validateMove`)
- Modify: `src/engine/testUtils.ts` (`shuffle`, `fillTemplate`)
- Modify: `docs/spec/engine-design.md` (the `legalMoves` contract bullet)
- Test: `src/engine/fullGame.test.ts`

**Interfaces:**
- `legalMoves` covers all four phases. In the action phase it offers, for the active seat: every activatable system, one `strategic` move per unused card with directly playable parameters (one per eligible system for Diplomacy and for Warfare, the bare card when there is none, one per researchable technology for Technology, one per scoreable objective for Imperial), one `research` move per technology Inheritance Systems can reach, one `shipyard` move per controlled planet, one `tradePost` move per usable post, and `pass` when R3.2 allows it. While `pendingSecondary` is set, the answering seat gets exactly `accept: false` plus, when it is affordable and useful, `accept: true` with a payable template; that branch runs **before** the `passed` check, because the response is not a turn. In the status phase the active seat gets one `status` template with all new tokens in the tactic pool.
- `validateMove` no longer compares JSON. It matches by kind: the fields that identify a move are compared, the parameter payloads that the UI fills in are not.
  ```ts
  export function legalMoves(state: GameState): Move[]
  export function validateMove(state: GameState, move: Move): Result<true>
  ```
  The eligibility helpers are not duplicated here: `diplomacySystems`, `warfareTokenSystems` and `research.researchable` are the same functions the handlers use, so an enumerated move can never be refused for a reason the enumerator did not know about. `TEMPLATE_KINDS` disappears; the structural matcher covers what it did. Run `grep -rn "TEMPLATE_KINDS" src` first: if something still imports it, keep the export.
- Produces in `testUtils.ts`: `shuffle<T>(list: T[], rng: () => number): T[]` and `fillTemplate(state: GameState, move: Move, rng: () => number): Move`, used by `fullGame.test.ts` only; `tacticalFlow.test.ts` keeps its own local `fill` and is not touched by this plan. Only `moveShips` and `produce` need filling, every other enumerated move is already concrete.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/fullGame.test.ts
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
      if (!r.ok) { rejected++; continue }
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
```

- [ ] **Step 2: Run the test to verify it fails, then commit it**

Run: `npm test -- src/engine/fullGame.test.ts`
Expected: FAIL, `fillTemplate` and `shuffle` are not exported and the enumerator returns nothing for the new move kinds.

```bash
git add src/engine/fullGame.test.ts
git commit -m "test(engine): legal moves in every phase and a seeded full-game smoke test"
```

- [ ] **Step 3: Share the template helpers in the test kit**

Append to `src/engine/testUtils.ts`:

```ts
export function shuffle<T>(list: T[], rng: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/**
 * Turns a template move into a concrete one; falls back to the closing move of the step. Only `moveShips`
 * and `produce` need this, every other enumerated move already carries usable parameters.
 */
export function fillTemplate(state: GameState, move: Move, rng: () => number): Move {
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
    const planets = cheapestPlanets(state, seat, cost)
    if (!planets) return { type: 'endTactical' }
    return { type: 'produce', units: { infantry: 1 }, planets, tradeGoods: 0 }
  }
  return move
}
```

and extend the imports of `testUtils.ts`:

```ts
import { unitStats } from '../data/units'
import { capacity, cheapestPlanets, fleetPoolLimit, nonFighterShips, productionCost } from './economy'
import { movableShips } from './movement'
```

with `Move` added to the type import list.

- [ ] **Step 4: Complete the enumerator and the structural validator**

Replace the imports of `src/engine/legalMoves.ts` with:

```ts
import { activatableSystems, canPass } from './actionPhase'
import { canMunitions, retreatTargets } from './combat'
import { canInheritance, canShipyard, inheritanceTechs, shipyardPlanets, tradePostOptions } from './componentActions'
import { cheapestPlanets, productionCost, productionLimit } from './economy'
import { bombardablePlanets, groundCombatPending, landablePlanets } from './invasion'
import { movableShips } from './movement'
import { fulfils } from './objectives'
import { researchable } from './research'
import { homeSystemId } from '../data/map'
import { cardOwner, diplomacySystems, secondaryTokenCost, unusedCards, warfareTokenSystems } from './strategicActions'
import { tokensGained } from './statusPhase'
import type { GameState, Move, Result, Seat, StrategicParams, StrategyCardId } from './types'
```

Leave `tacticalMoves` exactly as it is. Add these helpers above `legalMoves`:

```ts
/** One directly playable primary per card; the UI may fill in richer parameters, the handler checks them. */
function primaryMoves(state: GameState, seat: Seat, card: StrategyCardId): Move[] {
  switch (card) {
    case 'diplomacy': {
      // R6: with no eligible system the card is played bare, which is what the handler allows
      const systems = diplomacySystems(state, seat)
      if (!systems.length) return [{ type: 'strategic', card, params: {} }]
      return systems.map((systemId): Move => ({ type: 'strategic', card, params: { systemId, planets: [] } }))
    }
    case 'warfare': {
      // R6: a token on the board must be named, so the bare variant is offered only when there is none
      const systems = warfareTokenSystems(state, seat)
      if (!systems.length) return [{ type: 'strategic', card, params: {} }]
      return systems.map((systemId): Move => ({ type: 'strategic', card, params: { systemId } }))
    }
    case 'technology': {
      const techs = researchable(state.players[seat])
      if (!techs.length) return [{ type: 'strategic', card, params: {} }]
      return techs.map((techId): Move => ({ type: 'strategic', card, params: { techId } }))
    }
    case 'imperial': {
      const open = state.publicObjectives.filter(id => !state.players[seat].scoredObjectives.includes(id) && fulfils(state, seat, id))
      return [{ type: 'strategic', card, params: {} }, ...open.map((objectiveId): Move => ({ type: 'strategic', card, params: { objectiveId } }))]
    }
    default:
      return [{ type: 'strategic', card, params: {} }]
  }
}

/** The affordable secondary answers; every one of them is accepted by its handler. */
function secondaryMoves(state: GameState, seat: Seat, card: StrategyCardId): Move[] {
  const player = state.players[seat]
  if (player.tokens.strategy < secondaryTokenCost(card)) return []
  const params: StrategicParams = {}
  switch (card) {
    case 'leadership':
      return [{ type: 'secondary', card, accept: true, params }]
    case 'diplomacy': {
      const exhausted: string[] = []
      for (const sys of Object.values(state.systems)) {
        for (const p of sys.planets) if (p.owner === seat && p.exhausted && exhausted.length < 2) exhausted.push(p.id)
      }
      return exhausted.length ? [{ type: 'secondary', card, accept: true, params: { planets: exhausted } }] : []
    }
    case 'trade':
      return [{ type: 'secondary', card, accept: true, params }]
    case 'warfare': {
      const home = state.systems[homeSystemId(seat)]
      const dock = home.planets.some(p => p.structures.some(u => u.type === 'spacedock' && u.owner === seat))
      if (!dock || player.reinforcements.infantry < 1 || productionLimit(state, seat, home.id) < 1) return []
      const stats = { faction: player.faction, techs: player.techs }
      const cost = productionCost({ infantry: 1 }, stats, player.techs.includes('sarween_tools'))
      const planets = cheapestPlanets(state, seat, cost)
      if (!planets) return []
      return [{ type: 'secondary', card, accept: true, params: { units: { infantry: 1 }, planets, tradeGoods: 0 } }]
    }
    case 'technology': {
      const planets = cheapestPlanets(state, seat, 4)
      if (!planets) return []
      return researchable(state.players[seat]).map((techId): Move => ({ type: 'secondary', card, accept: true, params: { techId, planets } }))
    }
    case 'imperial':
      return [{ type: 'secondary', card, accept: true, params }]
  }
}
```

Replace `legalMoves` and `validateMove` with:

```ts
export function legalMoves(state: GameState): Move[] {
  if (state.winner !== null || state.phase === 'ended') return []
  if (state.phase === 'strategy') {
    const seat = state.draft[0]
    if (seat === undefined || seat !== state.active) return []
    return state.strategyPool.map(c => ({ type: 'pickStrategyCard', card: c.id }))
  }
  if (state.phase === 'status') {
    const seat = state.active
    const tokens = state.players[seat].tokens
    return [{ type: 'status', params: { tokens: { ...tokens, tactic: tokens.tactic + tokensGained(state, seat) } } }]
  }
  if (state.phase !== 'action') return []
  const seat = state.active
  // R3.2: the answer to a strategy card is not a turn, so it comes before the passed check
  const pending = state.pendingSecondary
  if (pending !== null) {
    if (cardOwner(state, pending) === seat) return []
    return [{ type: 'secondary', card: pending, accept: false }, ...secondaryMoves(state, seat, pending)]
  }
  if (state.players[seat].passed) return []
  if (state.tactical) return tacticalMoves(state)
  const out: Move[] = activatableSystems(state, seat).map(id => ({ type: 'startTactical', systemId: id }))
  for (const card of unusedCards(state, seat)) out.push(...primaryMoves(state, seat, card))
  if (canInheritance(state, seat)) {
    for (const techId of inheritanceTechs(state, seat)) out.push({ type: 'research', techId, via: 'inheritance' })
  }
  if (canShipyard(state, seat)) {
    const planets = cheapestPlanets(state, seat, 4) ?? []
    for (const planetId of shipyardPlanets(state, seat)) out.push({ type: 'shipyard', planetId, planets, tradeGoods: 0 })
  }
  for (const post of tradePostOptions(state, seat)) {
    out.push({ type: 'tradePost', post, commodities: Math.min(2, state.players[seat].commodities) })
  }
  if (canPass(state, seat)) out.push({ type: 'pass' })
  return out
}

/** Compares the fields that identify a move; the parameters the UI fills in are not compared. */
function matches(candidate: Move, move: Move): boolean {
  if (candidate.type !== move.type) return false
  switch (move.type) {
    case 'pickStrategyCard':
      return candidate.type === 'pickStrategyCard' && candidate.card === move.card
    case 'startTactical':
      return candidate.type === 'startTactical' && candidate.systemId === move.systemId
    case 'combatRound': {
      if (candidate.type !== 'combatRound') return false
      const a = candidate.munitions
      const b = move.munitions
      return (a?.attacker ?? false) === (b?.attacker ?? false) && (a?.defender ?? false) === (b?.defender ?? false)
    }
    case 'retreat':
      return candidate.type === 'retreat' && candidate.to === move.to
    case 'bombard':
      return candidate.type === 'bombard' && candidate.planetId === move.planetId
    case 'land':
      return candidate.type === 'land' && candidate.planetId === move.planetId
    case 'strategic':
      return candidate.type === 'strategic' && candidate.card === move.card
    case 'secondary':
      return candidate.type === 'secondary' && candidate.card === move.card && candidate.accept === move.accept
    case 'research':
      return candidate.type === 'research' && candidate.techId === move.techId
    case 'shipyard':
      return candidate.type === 'shipyard' && candidate.planetId === move.planetId
    case 'tradePost':
      return candidate.type === 'tradePost' && candidate.post === move.post
    default:
      // moveShips, produce, status and the closing moves are identified by their kind alone
      return true
  }
}

export function validateMove(state: GameState, move: Move): Result<true> {
  const ok = legalMoves(state).some(candidate => matches(candidate, move))
  return ok ? { ok: true, value: true } : { ok: false, error: `illegal move ${move.type}` }
}
```

Keep the import list in step with what the file actually uses; `noUnusedLocals` and oxlint reject a leftover import.

- [ ] **Step 5: Bring the contract in line**

In `docs/spec/engine-design.md` replace the `legalMoves` bullet of the `Contract` section with:

```
- `legalMoves` enumerates concrete moves for the active player in all four phases; the UI builds its interaction from this list (highlighted systems, enabled buttons). Two kinds stay templates whose parameters the UI fills in: `moveShips` (`moves: []`) and `produce` (`units: {}`, `planets: []`, `tradeGoods: 0`); `land`, `strategic`, `secondary`, `shipyard` and `status` carry directly playable defaults that the UI may replace. `validateMove(state, move)` compares only the fields that identify a move (system, planet, card, technology, post, accept), never the parameter payload, so a richer but legal parameter set is accepted.
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, every suite (units, rng, adjacency, research, setup, economy, strategyPhase, actionPhase, movement, combat, invasion, production, tacticalFlow, objectives, strategicActions, componentActions, statusPhase, fullGame).

- [ ] **Step 7: Type-check, lint and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/legalMoves.ts src/engine/testUtils.ts src/engine/fullGame.test.ts docs/spec/engine-design.md
git commit -m "feat(engine): legal moves for every phase, structural validation and a full-game smoke test"
```

---

### Task 7: Infantry II revival

**Files:**
- Modify: `src/engine/types.ts` (`Player.pendingInfantry`)
- Modify: `src/engine/setup.ts` (initialise the field)
- Modify: `src/engine/board.ts` (`rollRevival`)
- Modify: `src/engine/invasion.ts` (one wrapper around the four points where ground forces die)
- Modify: `src/engine/actionPhase.ts` (`reviveInfantry`, `passTurn`, `pass`)
- Modify: `src/engine/strategyPhase.ts` (revive when the action phase opens)
- Modify: `docs/spec/engine-design.md` (State shape)
- Test: `src/engine/revival.test.ts`

**Interfaces:**
- One new field, `Player.pendingInfantry: number`, initialised to 0 in `setup.makePlayer` and mirrored into the `State shape` block of `docs/spec/engine-design.md`. It is **not** reset in the status phase: infantry that rolled their return keep waiting across the round boundary.
- Produces in `board.ts`:
  ```ts
  export function rollRevival(state: GameState, destroyed: Unit[], seed: number): GameState
  ```
  R4.3 step 4: for each seat that owns `infantry_ii`, one die per destroyed infantry of that seat, a 6 or higher adds one to `pendingInfantry`. One `roll` log entry per seat with the context `Infantry II revival`, so a test can count the hits without knowing the seed. Seats without the technology roll nothing and log nothing.
- Produces in `actionPhase.ts`:
  ```ts
  export function reviveInfantry(state: GameState, seat: Seat): GameState
  ```
  Places `pendingInfantry` infantry on the first planet of the seat's home system that the seat controls and resets the counter. The units come out of `reinforcements.infantry`; what the reinforcements cannot cover, and everything if the seat controls no planet at home, is lost. `passTurn` calls it for the seat that receives the turn (which is the current seat again when the opponent has passed), `pass` calls it for the seat it hands the turn to, and `strategyPhase.pickStrategyCard` calls it for the seat that opens the action phase of the new round. The secondary window does **not** call it: answering a strategy card is not a turn.
- The invasion hooks all go through one wrapper, so the three kill sites of `invasion.ts` (bombardment, space cannon defense on the landing party, both sides of a ground combat round) keep their existing salts and gain a derived child seed for the revival roll.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/revival.test.ts
import { homeSystemId } from '../data/map'
import { describe, expect, it } from 'vitest'
import { otherSeat } from './actionPhase'
import { applyMove, legalMoves } from './index'
import { tokensGained } from './statusPhase'
import { carriedIds, cardsUsed, deepFreeze, hitsIn, toActionPhase, toStatusPhase, withCards, withPlanetOwner, withPlayer, withTechs, withUnits } from './testUtils'
import type { GameState, Result, Seat, UnitType } from './types'

const ok = (r: Result<GameState>): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const revivalRolls = (state: GameState): number => state.log.filter(e => e.t === 'roll' && e.context === 'Infantry II revival').length

/** Seat 0 lands two infantry on Quann against `defenders` infantry of seat 1. */
function invading(defenders: number, seed = 3): GameState {
  let s = withTechs(toActionPhase(), 0, ['infantry_ii'])
  s = withPlanetOwner(s, 'quann', 'quann', 1)
  s = withUnits(s, 'quann', 1, Array<UnitType>(defenders).fill('infantry'), 'quann')
  s = withUnits(s, 'quann', 0, ['carrier', 'infantry', 'infantry'])
  const started = ok(applyMove(deepFreeze(s), { type: 'startTactical', systemId: 'quann' }, seed))
  const moved = ok(applyMove(started, { type: 'endMovement' }, seed))
  return ok(applyMove(moved, { type: 'land', planetId: 'quann', infantryIds: carriedIds(moved, 'quann', 0) }, seed))
}

/** Both players through a status phase, all new tokens into the tactic pool. */
function runStatus(state: GameState): GameState {
  const step = (s: GameState): GameState => {
    const seat = s.active
    const t = s.players[seat].tokens
    return ok(applyMove(s, { type: 'status', params: { tokens: { ...t, tactic: t.tactic + tokensGained(s, seat) } } }, 7))
  }
  return step(step(toStatusPhase(state)))
}

describe('R4.3 step 4 Infantry II revival', () => {
  it('R4.3 step 4: infantry lost in ground combat roll to return, but only with Infantry II', () => {
    let s = invading(6)
    for (let i = 0; i < 20 && s.systems.quann.planets[0].ground.some(u => u.owner === 0); i++) {
      s = ok(applyMove(s, { type: 'groundCombatRound' }, 30 + i))
    }
    expect(revivalRolls(s)).toBeGreaterThan(0)                       // six defenders at 8+ wipe two attackers
    expect(s.players[0].pendingInfantry).toBe(hitsIn(s, 'Infantry II revival'))
    expect(s.players[1].pendingInfantry).toBe(0)                     // seat 1 has no Infantry II
  })
  it('R4.3 step 4: bombardment and space cannon defense roll for the same return', () => {
    let s = withTechs(toActionPhase(), 1, ['infantry_ii'])
    s = withPlanetOwner(s, 'quann', 'quann', 1)
    s = withUnits(s, 'quann', 1, ['infantry', 'infantry', 'infantry'], 'quann')
    s = withUnits(s, 'quann', 0, ['dreadnought'])
    const started = ok(applyMove(deepFreeze(s), { type: 'startTactical', systemId: 'quann' }, 4))
    const moved = ok(applyMove(started, { type: 'endMovement' }, 4))
    const bombed = ok(applyMove(moved, { type: 'bombard', planetId: 'quann' }, 4))
    const killed = 3 - bombed.systems.quann.planets[0].ground.filter(u => u.owner === 1).length
    expect(revivalRolls(bombed)).toBe(killed > 0 ? 1 : 0)            // one entry per group that lost infantry
    expect(bombed.players[1].pendingInfantry).toBe(hitsIn(bombed, 'Infantry II revival'))
    expect(bombed.players[0].pendingInfantry).toBe(0)

    let t = withTechs(toActionPhase(), 0, ['infantry_ii'])
    t = withPlanetOwner(t, 'quann', 'quann', 1)
    t = withUnits(t, 'quann', 1, ['pds'], 'quann')
    t = withUnits(t, 'quann', 0, ['carrier', 'infantry', 'infantry'])
    const s2 = ok(applyMove(deepFreeze(t), { type: 'startTactical', systemId: 'quann' }, 6))
    const m2 = ok(applyMove(s2, { type: 'endMovement' }, 6))
    const landed = ok(applyMove(m2, { type: 'land', planetId: 'quann', infantryIds: carriedIds(m2, 'quann', 0) }, 6))
    const lost = 2 - landed.systems.quann.planets[0].ground.filter(u => u.owner === 0).length
    expect(revivalRolls(landed)).toBe(lost > 0 ? 1 : 0)
    expect(landed.players[0].pendingInfantry).toBe(hitsIn(landed, 'Infantry II revival'))
  })
  it('R4.3 step 4: the infantry come back on a home planet at the start of your next turn', () => {
    const s = withPlayer(cardsUsed(toActionPhase(1, 1)), 0, { pendingInfantry: 2 })
    const before = s.players[0].reinforcements.infantry
    const done = ok(applyMove(s, { type: 'pass' }, 0))                // seat 1 passes, seat 0 is on turn
    expect(done.active).toBe(0)
    expect(done.players[0].pendingInfantry).toBe(0)
    expect(done.players[0].reinforcements.infantry).toBe(before - 2)
    expect(done.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(7)
  })
  it('R4.3 step 4: without a home planet or reinforcements the infantry are lost', () => {
    const base = withPlayer(cardsUsed(toActionPhase(1, 1)), 0, { pendingInfantry: 2 })
    const homeless = withPlanetOwner(base, 'home-n', '000', null)
    const lost = ok(applyMove(homeless, { type: 'pass' }, 0))
    expect(lost.players[0].pendingInfantry).toBe(0)
    expect(lost.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(5)
    const empty = withPlayer(base, 0, { pendingInfantry: 2, reinforcements: { ...base.players[0].reinforcements, infantry: 1 } })
    const partial = ok(applyMove(empty, { type: 'pass' }, 0))
    expect(partial.players[0]).toMatchObject({ pendingInfantry: 0, reinforcements: expect.objectContaining({ infantry: 0 }) })
    expect(partial.systems['home-n'].planets[0].ground.filter(u => u.owner === 0)).toHaveLength(6)
  })
  it('R3.3/R4.3: pending infantry survive the status phase and arrive when the next action phase opens', () => {
    const s = withPlayer(withPlayer(toActionPhase(), 0, { pendingInfantry: 1 }), 1, { pendingInfantry: 1 })
    let next = runStatus(s)
    expect(next.players.map(p => p.pendingInfantry)).toEqual([1, 1])
    expect(next.phase).toBe('strategy')
    while (next.phase === 'strategy') next = ok(applyMove(next, legalMoves(next)[0], 0))
    const first: Seat = next.active
    expect(next.players[first].pendingInfantry).toBe(0)
    expect(next.players[otherSeat(first)].pendingInfantry).toBe(1)   // the opponent waits for its own turn
    expect(next.systems[homeSystemId(first)].planets.some(p => p.ground.some(u => u.owner === first))).toBe(true)
  })
  it('R3.2/R4.3: answering a strategy card is not a turn, so nothing returns yet', () => {
    const s = withPlayer(withCards(withCards(toActionPhase(), 1, []), 0, ['trade']), 1, { pendingInfantry: 1 })
    const played = ok(applyMove(s, { type: 'strategic', card: 'trade' }, 0))
    expect(played.active).toBe(1)
    expect(played.players[1].pendingInfantry).toBe(1)                // the window is a response, not a turn
    const answered = ok(applyMove(played, { type: 'secondary', card: 'trade', accept: false }, 0))
    expect(answered.players[1].pendingInfantry).toBe(0)              // now seat 1 takes its turn
  })
})
```

- [ ] **Step 2: Run the test to verify it fails, then commit it**

Run: `npm test -- src/engine/revival.test.ts`
Expected: FAIL, `pendingInfantry` is not a field of `Player`.

```bash
git add src/engine/revival.test.ts
git commit -m "test(engine): Infantry II revival"
```

- [ ] **Step 3: Add the field**

In `src/engine/types.ts`, extend `Player` after `inheritanceExhausted: boolean; shipyardUsed: boolean`:

```ts
  pendingInfantry: number          // R4.3 step 4: Infantry II waiting to return at the start of your next turn
```

In `src/engine/setup.ts`, in `makePlayer`, extend the same line:

```ts
    inheritanceExhausted: false, shipyardUsed: false, pendingInfantry: 0, reinforcements,
```

In `docs/spec/engine-design.md`, add the same field to the `Player` interface of the `State shape` block, directly below `inheritanceExhausted: boolean; shipyardUsed: boolean`:

```
  pendingInfantry: number          // Infantry II waiting to return at the start of your next turn
```

- [ ] **Step 4: Roll for the return**

In `src/engine/board.ts` extend the rng import to `import { deriveSeed, mulberry32, rollDice, type Rng } from './rng'` and append:

```ts
/**
 * R4.3 step 4: every destroyed infantry of a player with Infantry II rolls once, a 6 or higher makes it
 * return at the start of that player's next turn. One log entry per seat, so the hits can be counted from
 * the log; a seat without the technology rolls nothing.
 */
export function rollRevival(state: GameState, destroyed: Unit[], seed: number): GameState {
  let next = state
  for (const seat of [0, 1] as Seat[]) {
    const lost = destroyed.filter(u => u.owner === seat && u.type === 'infantry')
    if (!lost.length || !state.players[seat].techs.includes('infantry_ii')) continue
    const { rolls, hits } = rollHits(mulberry32(deriveSeed(seed, seat)), lost.length, 6, false)
    const players = [...next.players] as GameState['players']
    players[seat] = { ...players[seat], pendingInfantry: players[seat].pendingInfantry + hits }
    next = {
      ...next, players,
      log: [...next.log, { t: 'roll', owner: seat, rolls: dieRolls(seat, 'infantry', rolls, 6), context: 'Infantry II revival' }],
    }
  }
  return next
}
```

- [ ] **Step 5: Hook the invasion**

In `src/engine/invasion.ts` add `rollRevival` to the `./board` import and, below the salt constants, the wrapper:

```ts
/**
 * R4.3 step 4: the revival roll hangs off the salt of the step that killed the infantry, as a derived child
 * seed, so it never enters the salt space of the invasion itself.
 */
const REVIVAL_SALT = 1

function destroyGround(state: GameState, systemId: string, units: Unit[], seed: number, salt: number): GameState {
  return rollRevival(destroyUnits(state, systemId, units), units, deriveSeed(deriveSeed(seed, salt), REVIVAL_SALT))
}
```

Then route the four places where ground forces die through it, leaving everything else untouched:

```ts
// in bombardment(), the final line
  return destroyGround(logged, systemId, planet.ground.filter(u => u.owner !== seat).slice(0, hits), seed, salt)

// in land(), inside the space cannon defense branch
    next = destroyGround(next, tac.systemId, survivors.slice(0, hits), seed, LANDING_DEFENSE_SALT)

// in groundCombatRound(), the two hit applications
  next = destroyGround(next, tac.systemId, foes.slice(0, a.hits), seed, GROUND_SALT_BASE + 3 * round)
  next = destroyGround(next, tac.systemId, mine.slice(0, d.hits), seed, GROUND_SALT_BASE + 3 * round + 1)
```

`destroyUnits` stays imported, `destroyGround` is its only caller now.

- [ ] **Step 6: Bring them back at the start of the turn**

In `src/engine/actionPhase.ts` extend the map import to `import { SYSTEM_IDS, homeSystemId } from '../data/map'`, add `Unit` to the type import, and replace `passTurn` with:

```ts
/**
 * R4.3 step 4: infantry that rolled their return arrive on the first planet of the home system the seat
 * controls. Reinforcements limit how many actually come back, and a seat that controls nothing at home
 * loses them; the counter is cleared either way.
 */
export function reviveInfantry(state: GameState, seat: Seat): GameState {
  const player = state.players[seat]
  if (player.pendingInfantry < 1) return state
  const homeId = homeSystemId(seat)
  const sys = state.systems[homeId]
  const target = sys.planets.find(p => p.owner === seat)
  const count = Math.min(player.pendingInfantry, player.reinforcements.infantry)
  const players = [...state.players] as GameState['players']
  if (!target || count < 1) {
    players[seat] = { ...player, pendingInfantry: 0 }
    return { ...state, players, log: [...state.log, { t: 'info', text: `seat ${seat} loses ${player.pendingInfantry} returning infantry` }] }
  }
  let nextId = state.nextUnitId
  const revived: Unit[] = []
  for (let i = 0; i < count; i++) revived.push({ id: nextId++, type: 'infantry', owner: seat, damaged: false })
  players[seat] = { ...player, pendingInfantry: 0, reinforcements: { ...player.reinforcements, infantry: player.reinforcements.infantry - count } }
  return {
    ...state, players, nextUnitId: nextId,
    systems: {
      ...state.systems,
      [homeId]: { ...sys, planets: sys.planets.map(p => p.id === target.id ? { ...p, ground: [...p.ground, ...revived] } : p) },
    },
    log: [...state.log, { t: 'info', text: `seat ${seat} returns ${count} infantry to ${target.id}` }],
  }
}

/** The turn goes to the other seat unless that seat has already passed; either way a turn starts (R4.3 step 4). */
export function passTurn(state: GameState): GameState {
  const other = otherSeat(state.active)
  const next: Seat = state.players[other].passed ? state.active : other
  return reviveInfantry({ ...state, active: next }, next)
}
```

and in `pass`, replace the last line with:

```ts
  return { ok: true, value: reviveInfantry({ ...state, players, active: other }, other) }
```

In `src/engine/strategyPhase.ts` add `import { reviveInfantry } from './actionPhase'` and wrap the state that opens the action phase, replacing the assignment inside `if (draft.length === 0)`:

```ts
    next = reviveInfantry({ ...next, strategyPool, phase: 'action', active: order[0], players: [{ ...next.players[0], passed: false }, { ...next.players[1], passed: false }] }, order[0])
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 6 new tests and every earlier suite, including `invasion`, `actionPhase`, `strategyPhase` and `fullGame`.

- [ ] **Step 8: Type-check, lint and commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`

```bash
git add src/engine/types.ts src/engine/setup.ts src/engine/board.ts src/engine/invasion.ts src/engine/actionPhase.ts src/engine/strategyPhase.ts src/engine/revival.test.ts docs/spec/engine-design.md
git commit -m "feat(engine): Infantry II revival with pending infantry returning at the start of a turn"
```

---

## Self-review notes

### Spec coverage

| Rule | Where | Notes |
| --- | --- | --- |
| R3.1 strategy phase | `strategyPhase.ts` (plan 1), `statusPhase.finishStatusPhase`, task 5 | the draft itself is unchanged; the status phase rebuilds the pool in `ALL_STRATEGY_CARDS` order, played cards with bonus 0 and unpicked cards with the trade goods they carry, and sets a fresh snake draft `[speaker, other, other, speaker]` for the new speaker, so initiative is recomputed every round |
| R3.2 strategic action | `strategicActions.ts`, tasks 2 and 3 | primary, card marked used, `pendingSecondary` window, exactly one `secondary` answer with `accept` true or false, only then does the turn pass; `startTactical` and `pass` are blocked while the window is open |
| R3.2 component action | `componentActions.ts`, task 4 | Inheritance Systems and the emergency shipyard are whole turns and end with `passTurn`; the trade post is free and the turn goes on |
| R3.3 status phase | `statusPhase.ts`, task 5 | one move per player, speaker first: scoring, 2 or 3 command tokens distributed without moving old ones, reveal, ready planets and the exhausted card, cards back to the pool, tokens off the map, per-round flags reset, guardian reroll, victory check, speaker swap, round advance |
| R5 research | `strategicActions.grantTech`, `componentActions.research` | Technology primary researches one and optionally a second for 6 resources, in order, so the first may be the prerequisite; secondary costs a strategy token plus 4 resources; Inheritance Systems exhausts, pays 2 resources and ignores prerequisites; everything goes through `canResearch`, so faction restrictions hold |
| R6 duel changes | `strategicActions.ts`, `componentActions.ts` | Imperial secondary gives 2 trade goods, Diplomacy uses the errata text (opponent's token, ready up to 2 planets you control anywhere), the emergency shipyard is once per game without a space dock for a strategy token plus 4 resources |
| R7 objectives and victory | `objectives.ts` (task 1), `statusPhase.ts` (task 5), Imperial primary (task 3) | the six predicates, the Mandate, 1 VP per status phase for Mecatol Rex, scored once per objective per game, the immediate Imperial score, victory at 7 VP or after round 6 with the full tie-break chain |
| R8 trade posts | `componentActions.tradePost`, task 4 | at most 2 commodities 1:1, once per round per post, a controlled planet in a linked system, on your own turn, no turn cost, `tradedThisRound` reset in the status phase |

### Type consistency

- Exactly two type changes, both in task 2 and both mirrored into `docs/spec/engine-design.md` in the same step: `StrategicParams` gains `tokens`, `objectiveId` and `shareWithOpponent`, and the `research` move narrows to `via: 'inheritance'`. `GameState`, `Player`, `System`, `Planet` and `StatusParams` are untouched; the secondary window rides on the `pendingSecondary` field that plan 1 already put in the state, and who played the card is derived with `cardOwner` instead of a new field.
- `params.tokens` always means the **resulting** command sheet, in Leadership, in Warfare and in the status phase, so a single helper (`economy.distributeTokens`) validates all three; only Warfare passes `redistribute: true`.
- `params.planets` means "planets this ability exhausts" everywhere except Diplomacy, where the ability readies instead of paying; no card both pays and readies, so the field never carries two meanings in one move.
- `economy.payCost` is rewritten on top of the new `exhaustPlanets` and keeps its signature, its error strings and its behaviour, so `production.ts` and its tests are unaffected.
- `production.produce` is reused unchanged by the Warfare secondary through a staged `tactical` context; the original context (always `null` during a strategic action) is restored afterwards, so no caller can observe the staging.
- New modules export only what other modules use: `objectives.ts` feeds Imperial, the status phase, `componentActions.shipyardPlanets` and the enumerator; `strategicActions.grantTech` and `readyPlanets` are exported for task 4 and for symmetry between primary and secondary; `TEMPLATE_KINDS` is deleted because the structural matcher replaces it.
- Every new fixture helper lives in `src/engine/testUtils.ts` and returns `deepFreeze(...)`. `fillTemplate` and `shuffle` are added there for `fullGame.test.ts`; the tactical plan's `tacticalFlow.test.ts` keeps its own local copies and no file of that plan is edited here.

### Resolved ambiguities and v1 policies

1. **The secondary window is a response, not a turn.** After a primary, `active` moves to the opponent, who owes exactly one `secondary` move. A player who has already passed still answers (the enumerator checks `pendingSecondary` before `passed`), and afterwards the turn resumes from the card holder through `passTurn`, so a passed answerer hands it straight back.
2. **Every primary can always be played** (controller ruling). Technology may research nothing, Imperial may score nothing. Diplomacy needs a system while the seat controls a planet in one, and may be played bare when it controls none outside Mecatol Rex; Warfare needs the system while the seat has a command token on the board, and is pure redistribution when it has none. Both handlers and the enumerator ask the same helpers (`diplomacySystems`, `warfareTokenSystems`), so the enumerated variant is always the legal one. Without this a player could hold an unplayable card, be unable to pass (R3.2) and deadlock the action phase.
3. **Leadership overpay is lost.** Influence works like resources: exhausted planets pay in full, remainders below 3 give no token.
4. **Diplomacy places a token, not a pool token** (controller ruling). The duel models no reinforcement pool of command tokens in v1, so the opponent's token costs them nothing; it is an entry in `system.activatedBy`. That entry blocks their activation of the system (R3.2) and also freezes their ships there, which is the TI4 rule that ships cannot move out of a system holding your own command token, and is intended. If their seat is already listed, nothing happens (LRR 30.2).
5. **The Warfare token goes to reinforcements.** The removed token leaves the board and the card's "then gain 1 command token" is the compensation, so the sheet grows by exactly one; with no token on the board nothing is gained. The redistribution may then move any token, the only place where `distributeTokens` allows a pool to shrink.
6. **Warfare secondary produces under the full R4.4 rules**, including the production limit of the home dock, Sarween Tools, reinforcements, the fleet pool and the fighter trim, because it literally calls `produce`.
7. **Technology resolves in order.** The second technology may use the first as a prerequisite, and it may not be researched without the first.
8. **Imperial scores immediately but does not end the game.** R7 makes victory a check, and the checks happen in the status phase, so `winner` is only ever set there; a player who passes 7 VP through Imperial wins at the end of the same round unless the opponent catches up.
9. **The `research` move is the component action only.** The Technology card carries its technologies in `StrategicParams`, so `via: 'technology' | 'technologySecond'` would have been dead branches; the union is narrowed instead of leaving them to be rejected at runtime.
10. **Inheritance Systems pays automatically.** The move carries no payment parameters, so the engine exhausts the cheapest set of ready planets that covers 2 resources (`cheapestPlanets`: least total, then fewest planets, then map order) and never spends trade goods unasked; if no set of ready planets reaches 2, the action is illegal.
11. **The emergency shipyard needs no dock anywhere**, not merely none in one system, and `shipyardUsed` keeps it to once per game even if the dock is lost again later.
12. **Trading needs a clean turn** (controller ruling). R8 says "during your own turn", and the engine reads that as: your turn in the action phase, no tactical action running, no secondary window open, so there is no sale in the middle of an activation or of a card response. That keeps the enumerator's tactical branch untouched, at the price of not allowing a sale in the middle of an activation.
13. **Scoring in the status phase is automatic** (controller ruling). R3.3 says a player "may" score; in v1 there is never a reason to decline, so `scoreAll` takes everything and `StatusParams` stays as designed, carrying only the token distribution.
14. **The speaker submits the status move first**, and the second submission closes the phase. That derives "who has already submitted" from `active` and `speaker` without a new state field, and `pass` already leaves `active` on the speaker when the phase begins.
15. **Scoring and the token distribution happen per player, before the reveal** (controller ruling). Both players score and take their tokens on their own `status` move, and only the second move runs R3.3 steps 2 and 4 to 6, so the objective revealed for the next round can never be scored in the status phase that revealed it.
16. **Unpicked strategy cards keep their trade goods across rounds** (R3.1). `finishStatusPhase` rebuilds the pool in `ALL_STRATEGY_CARDS` order: the four played cards come back at bonus 0, the two that nobody picked keep the bonus they carry, and the next player to pick one of them collects it.
17. **`validateMove` is structural, and loose only where the UI fills parameters** (controller ruling). It compares the fields that identify a move (system, planet, card, technology, post, accept, munitions) and ignores only the payloads a UI fills in: `moveShips.moves`, `produce`'s order and payment, the infantry subset of `land`, the `params` of `strategic` and `secondary`, the payment of `shipyard` and the distribution of `status`. Everything else is matched field by field, so a wrong system or card is rejected.
18. **Starting technologies count.** Objective 1 asks to own 3 technologies and both factions start with 2, so one research fulfils it; objective 6 counts only coloured technologies, unit upgrades have no colour.
19. **The tie-break speaker is the speaker of the finished round.** `decideWinner` runs before the speaker token moves, so "the speaker's opponent" means the opponent of the player who was speaker during the round that just ended.
20. **A guardian fleet is rolled while Mecatol Rex is uncontrolled**, including in the status phase that ends the game; the roll is seeded through `deriveSeed(seed, 91)` so replays stay deterministic.
21. **The smoke test biases towards closing moves after half its budget.** Uniform random play alone would not guarantee that six rounds fit into 3000 moves; the bias only changes which legal move is picked, never which moves are legal, and every game still passes through complete rounds. Up to 5 percent rejected attempts are tolerated, exactly as in the tactical plan, because a template can be filled in a way its handler refuses.

### Deferred

- **Infantry II revival** (R4.3 step 4): a destroyed infantry returning on 6+ at the start of the next turn still needs a per-player holding area that the state shape does not have. Deferred again, with the status phase now in place it is a `Player` field plus one hook in `passTurn`.
- **Action cards, promissory notes, agenda phase, secret objectives**: not in v1 at all (R6).
- **Chess clock enforcement** (R6): the engine stays time-free by design; the transport records a timestamp per move and enforces the 15 minutes, the automatic pass at zero and the 3 extra minutes per later round (see `docs/spec/lobby-architecture.md`).
- **Declining a score**: `scoreAll` takes every fulfilled objective. If a later rule ever makes scoring costly, the choice belongs in `StatusParams`.
- **Richer enumerator templates**: the enumerator offers one payable variant per card (for example a single infantry for the Warfare secondary, no influence for Leadership). The UI can build better parameters and `validateMove` accepts them; an exhaustive enumeration of every payment split is deliberately out of scope.
- **War Sun removing the planetary shield** and **Antimass Deflectors giving -1 against SPACE CANNON**: printed abilities the rules document does not mention; unchanged from the tactical plan.
