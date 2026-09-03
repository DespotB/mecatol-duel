# Engine design

The rules engine is a pure TypeScript module in `src/engine/`: no React, no DOM, no I/O. The UI (hot-seat) and the online transport both drive it through the same two functions.

## Contract

```ts
export type Result<T> = { ok: true; value: T } | { ok: false; error: string; internal?: boolean }
export function applyMove(state: GameState, move: Move, seed: number): Result<GameState>
export function legalMoves(state: GameState): Move[]
export function createGame(config: GameConfig, seed: number): GameState
```

- `applyMove` never mutates its input; it returns a new state (structural sharing is fine, use plain object spreads).
- A rejected move comes back as `{ ok: false, error }`. `internal: true` marks the rare case where the engine threw instead of rejecting: an engine bug, never a rules question, so callers may treat it as fatal.
- All randomness inside a move comes from `seed` (a 32-bit integer) through `mulberry32`; the same state, move and seed always give the same result. Dice are `1 + floor(rng() * 10)`.
- `legalMoves` enumerates concrete moves for the active player; the UI builds its interaction from this list (highlighted systems, enabled buttons). Three kinds are templates whose parameters the UI fills in: `moveShips` (`moves: []`), `produce` (`units: {}`, `planets: []`, `tradeGoods: 0`) and `land` (pre-filled with every carried infantry, any subset is legal). `validateMove(state, move)` matches those three by `move.type` and every other kind structurally.
- A strategic action is two moves: the `strategic` move resolves the primary, marks the card used and sets `pendingSecondary`; the opponent then answers with exactly one `secondary` move (`accept: true` pays the strategy token and resolves the ability, `accept: false` declines). Only then does the turn pass. While `pendingSecondary` is set, no other move is legal, and the answering seat responds even when it has already passed, because the response is not a turn.
- The game log is part of the state (`state.log`), append-only, one entry per move plus one per dice roll, so replays and the online transport need only the move list and seeds.

## State shape (TypeScript, `src/engine/types.ts`)

```ts
export type Seat = 0 | 1
export type Owner = Seat | 'guardian'
export type FactionId = 'l1z1x' | 'letnev'
export type Color = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'black' | 'orange' | 'pink'
export type UnitType = 'infantry' | 'fighter' | 'destroyer' | 'cruiser' | 'carrier' | 'dreadnought' | 'warsun' | 'flagship' | 'pds' | 'spacedock'
export type TechColor = 'blue' | 'red' | 'green' | 'yellow'
export type StrategyCardId = 'leadership' | 'diplomacy' | 'trade' | 'warfare' | 'technology' | 'imperial'
export type Phase = 'strategy' | 'action' | 'status' | 'ended'

export interface Unit { id: number; type: UnitType; owner: Owner; damaged: boolean }
export interface Planet {
  id: string; name: string; resources: number; influence: number
  owner: Seat | null; exhausted: boolean
  ground: Unit[]        // infantry
  structures: Unit[]    // spacedock, pds
}
export interface System {
  id: string; name: string
  planets: Planet[]
  anomaly: 'asteroid' | 'nebula' | null
  wormhole: 'alpha' | 'beta' | null
  space: Unit[]                    // ships
  activatedBy: Seat[]              // command tokens on the system this round
}
export interface Player {
  seat: Seat; faction: FactionId; color: Color; name: string
  vp: number
  tokens: { tactic: number; fleet: number; strategy: number }
  tradeGoods: number; commodities: number
  techs: string[]                  // tech ids from data/techs.ts
  strategyCards: { id: StrategyCardId; used: boolean }[]
  passed: boolean
  scoredObjectives: string[]; mandateScored: boolean; mandateEarnedThisRound: boolean
  spentInOneProductionThisRound: number
  tradedThisRound: { west: boolean; east: boolean }
  inheritanceExhausted: boolean; shipyardUsed: boolean
  reinforcements: Record<UnitType, number>
}
export interface TacticalContext {
  systemId: string
  step: 'movement' | 'spaceCombat' | 'invasion' | 'production' | 'done'
  combat?: CombatState
  invasion?: InvasionState
}
export interface CombatState { round: number; attacker: Seat; defender: Owner; retreating: Seat | null; retreatTo: string | null; lastRolls: DieRoll[] }
export interface InvasionState { planetId: string | null; landed: number[]; bombarded: string[]; round: number }
export interface DieRoll { owner: Owner; unit: UnitType; value: number; hit: boolean }
export interface GameState {
  version: 1
  round: number; phase: Phase
  speaker: Seat; active: Seat
  strategyPool: { id: StrategyCardId; bonus: number }[]   // unpicked cards with trade goods
  draft: Seat[]                                          // remaining pick order in the strategy phase
  publicObjectives: string[]                             // revealed ids
  players: [Player, Player]
  systems: Record<string, System>
  tactical: TacticalContext | null
  pendingSecondary: StrategyCardId | null                // opponent may respond
  nextUnitId: number
  guardianRolls: number
  winner: Seat | null
  log: LogEntry[]
}
export type LogEntry = { t: 'move'; seat: Seat | null; move: Move } | { t: 'roll'; owner: Owner; rolls: DieRoll[]; context: string } | { t: 'info'; text: string }
```

## Moves (`src/engine/moves.ts`)

```ts
export type Move =
  | { type: 'pickStrategyCard'; card: StrategyCardId }
  | { type: 'startTactical'; systemId: string }
  | { type: 'moveShips'; moves: { unitId: number; from: string; carrying: number[] }[] }   // all into tactical.systemId
  | { type: 'endMovement' }
  | { type: 'combatRound'; munitions?: { attacker?: boolean; defender?: boolean } }   // resolves one round (or the pre-combat steps on round 0); Munitions Reserves is per side
  | { type: 'retreat'; to: string }
  | { type: 'bombard'; planetId: string }
  | { type: 'land'; planetId: string; infantryIds: number[] }
  | { type: 'groundCombatRound' }
  | { type: 'endInvasion' }
  | { type: 'produce'; units: Partial<Record<UnitType, number>>; planets: string[]; tradeGoods: number }
  | { type: 'endTactical' }
  | { type: 'strategic'; card: StrategyCardId; params?: StrategicParams }
  | { type: 'secondary'; card: StrategyCardId; accept: boolean; params?: StrategicParams }
  | { type: 'research'; techId: string; via: 'inheritance' }   // component action; the Technology card carries its technologies in StrategicParams
  | { type: 'shipyard'; planetId: string; planets: string[]; tradeGoods: number }
  | { type: 'tradePost'; post: 'west' | 'east'; commodities: number }
  | { type: 'pass' }
  | { type: 'status'; params: StatusParams }             // one move per player: token distribution, then the engine finishes the phase when both are in
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
export interface StatusParams { tokens: { tactic: number; fleet: number; strategy: number } }
```

## Module layout

| File | Responsibility |
| --- | --- |
| `src/engine/types.ts` | state and move types above |
| `src/engine/rng.ts` | `mulberry32(seed)`, `rollDice(rng, n)` |
| `src/data/units.ts` | unit stat table with level I/II and faction variants, derived from `data/reference` |
| `src/data/techs.ts` | technology ids, colours, prerequisites, effects flags |
| `src/data/factions.ts` | starting units, techs, abilities flags |
| `src/data/map.ts` | Bereg Standoff systems, planets, adjacency, wormholes, trade post links |
| `src/data/objectives.ts` | public objective ids, order and texts, the Mandate |
| `src/engine/objectives.ts` | objective predicates, scoring and victory point bookkeeping |
| `src/engine/setup.ts` | `createGame`, guardian fleet table |
| `src/engine/economy.ts` | cost, payment, production value, fleet pool and capacity checks |
| `src/engine/strategyPhase.ts` | draft and initiative |
| `src/engine/actionPhase.ts` | activation, passing, turn alternation |
| `src/engine/board.ts` | shared unit helpers: stats owner, dice, unit removal, reinforcements, capacity and fleet checks |
| `src/engine/movement.ts` | adjacency with wormholes, move validation, anomalies |
| `src/engine/combat.ts` | space combat, anti-fighter barrage, space cannon, hit assignment, retreat |
| `src/engine/invasion.ts` | bombardment, landing, ground combat, control change |
| `src/engine/production.ts` | produce move |
| `src/engine/strategicActions.ts` | six cards primary and secondary |
| `src/engine/statusPhase.ts` | scoring, tokens, readying, guardian respawn, victory |
| `src/engine/legalMoves.ts` | enumerator and `validateMove` |
| `src/engine/index.ts` | `applyMove` dispatcher, re-exports |

Tests live next to each module as `*.test.ts` (Vitest). Every rule in `docs/spec/game-rules.md` has at least one test that quotes its section number in the test name.
