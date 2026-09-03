# Hot-Seat UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a playable hot-seat client on top of the finished rules engine. Two people share one browser: they name themselves on a setup screen, then play a whole game of Mecatol Duel on a board that reproduces the approved mockups, with every control derived from `legalMoves`, a chess clock, undo inside your own turn, a pass-the-device interstitial, a readable game log and a game that survives a page reload. Prove it with component tests and one scripted end-to-end game driven entirely through the rendered UI.

**Architecture:** Everything new lives under `src/ui/`. The engine stays exactly as it is: the UI imports `applyMove`, `createGame`, `legalMoves` and a set of read-only query helpers, and it never decides legality itself. One store (`src/ui/store.tsx`, a React context plus the `useGame` hook) owns the whole client state: the `GameState`, the game seed, an undo stack of previous states, the two clocks and the handoff flag. Every move goes through `apply(move)`, which calls `applyMove(state, move, deriveSeed(gameSeed, moveIndex))`, so a game is fully replayable from `(seed, move list)` and every test is deterministic. Screens are chosen by a twelve-line hash router (`#/` setup, `#/play` board, plus the game-over screen which is picked from `state.winner`). Presentational components (`src/ui/board/*`, `src/ui/hud/*`) take a `GameState` and props and render; interactive components (`src/ui/flows/*`) read the store, offer parameters for one move kind and submit it. A single stylesheet `src/ui/theme.css` carries the mockups' tokens (gold, navy, cut corners, Cinzel / Barlow Condensed / Barlow); there are no CSS-in-JS and no UI libraries.

**Tech Stack:** React 19 and Vite exactly as scaffolded, TypeScript strict, Vitest with `@testing-library/react` and `jsdom` (added in task 1), no runtime dependencies beyond `react` and `react-dom`.

**Spec:** `docs/spec/game-rules.md` (rules v0.2, referenced as R1..R8), `docs/spec/engine-design.md` (the engine contract), `docs/spec/lobby-architecture.md` section 2.8 (client state machine, hot-seat specifics, undo policy). The visual target is `/Users/despot_b/Assistant/notes/game-mockups/mecatol-duel-v2.html` (board, plus its `?panel=produce` and `?panel=tech` states), `/Users/despot_b/Assistant/notes/game-mockups/mecatol-duel-lobby.html` (setup screen) and the brief `/Users/despot_b/Assistant/notes/game-mockups/mockup-v2-brief.md`. Assets are already in `public/assets/`.

**Task order:** task 1 builds the shell (tooling, store, router, setup screen) because every later task tests through it. Task 2 is the board, task 3 the HUD around it, so that tasks 4a and 4b have something to attach controls to. Task 4 is split: 4a covers the tactical action (activation, movement, combat, invasion, production), 4b the strategic action, the secondary window, component actions, the status phase and the game-over screen. Task 5 adds the hot-seat courtesies (handoff, log, persistence). Task 6 plays one scripted game through the finished UI.

## Global Constraints

- React 19 and Vite exactly as scaffolded (`npm run dev`, `npm run build`); no router library, no state library, no component library, no CSS framework.
- `tsconfig.app.json` is strict with `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` and `verbatimModuleSyntax`: no `any`, no non-null assertions, no enums, no parameter properties, and every type-only import written as `import type`.
- **No engine changes except one additive block**: task 1 step 3 appends a re-export list to `src/engine/index.ts` (read-only query helpers, no new logic, no behaviour change). `src/engine/*.ts` and `src/data/*.ts` are otherwise not edited by this plan. UI code never imports an engine module in order to reimplement a rule.
- **The engine is the only source of legality.** Every enabled control comes from `legalMoves(state)`: a button exists because a move of that kind is in the list, a system is clickable because a `startTactical` for it is in the list, a technology is researchable because a move naming it is in the list. The UI fills in parameters (`moveShips`, `produce`, the `params` of `strategic`/`secondary`/`status`, the infantry subset of `land`, the payment of `shipyard`) and lets `applyMove` judge them; a rejection is shown as a message, never worked around.
- **Parameter editors start from the enumerated move.** Where `legalMoves` already carries usable parameters (`land`, `strategic`, `secondary`, `shipyard`, `status`), the panel pre-fills its controls from that move and submits the edited copy, so "accept the default" always produces a legal move.
- All randomness comes from the store: `deriveSeed(session.seed, moveIndex)` where `moveIndex` is the number of `move` entries already in `state.log`. Components never call `Math.random()` or `Date.now()`.
- Component tests run with Vitest under jsdom; every UI test file starts with the docblock `// @vitest-environment jsdom` (the project default environment stays `node` so the engine suite is unaffected).
- Tests query by `data-testid` and by visible text, never by class name. Testid convention: `tile-<systemId>`, `stack-<systemId>-<owner>-<unitType>`, `ground-<planetId>-<owner>-<type>`, `structure-<planetId>-<owner>-<type>`, `control-<planetId>`, `player-<seat>`, `clock-<seat>`, `vp-<seat>`, `tokens-<seat>-<pool>`, `forces-<seat>-<type>`, `strategy-card-<card>`, `btn-<action>`.
- Deterministic tests only: every test either builds its fixture with `src/engine/testUtils.ts` or starts a game with a fixed seed (`#/?seed=7`). No test asserts a dice result it did not derive from a fixed seed.
- All UI copy is English, sentence case except the gold uppercase labels. No em dashes and no middle dots in copy or comments.
- Never mutate a `GameState`. The store replaces it; components read it.
- **Commit after every logical step: the failing test, the implementation and each fix are separate commits.** Conventional messages (`test:` for a failing test, `feat:`/`fix:`/`chore:` for the rest). Never squash a test and its implementation into one commit.

---

### Task 1: Tooling, game store, hash router and the setup screen

**Files:**
- Modify: `package.json` (dev dependencies, no script changes)
- Modify: `vite.config.ts` (Vitest configuration)
- Modify: `src/engine/index.ts` (additive re-export block, the only engine edit in this plan)
- Modify: `src/main.tsx`, `src/index.css`
- Delete: `src/App.tsx`, `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`
- Create: `src/ui/test/setup.ts`, `src/ui/route.ts`, `src/ui/history.ts`, `src/ui/store.tsx`, `src/ui/App.tsx`, `src/ui/screens/SetupScreen.tsx`, `src/ui/screens/BoardScreen.tsx`, `src/ui/screens/GameOverScreen.tsx`
- Test: `src/ui/history.test.ts`, `src/ui/store.test.tsx`, `src/ui/screens/SetupScreen.test.tsx`

**Interfaces:**
- `src/ui/history.ts`
  ```ts
  export function moveCount(state: GameState): number
  export function rollCount(state: GameState): number
  export function undoable(previous: GameState, next: GameState): boolean
  ```
  `undoable` is the undo rule of `lobby-architecture.md` section 2.8 in one function: a move may be taken back while the same seat is still to act and no dice were rolled by it.
- `src/ui/store.tsx`
  ```ts
  export interface Session {
    seed: number
    minutes: number
    state: GameState
    history: GameState[]
    clockMs: [number, number]
    handoff: Seat | null
  }
  export interface GameStore {
    session: Session | null
    legal: Move[]
    error: string | null
    canUndo: boolean
    start(config: GameConfig, seed: number, minutes: number): void
    resume(session: Session): void
    apply(move: Move): boolean
    undo(): void
    dismissHandoff(): void
    abandon(): void
  }
  export function GameProvider(props: { children: ReactNode; ticking?: boolean }): JSX.Element
  export function useGame(): GameStore
  ```
  `ticking` exists so component tests can switch the clock interval off; only `src/main.tsx` leaves it on.
- `src/ui/route.ts`
  ```ts
  export function useHashRoute(): string
  export function navigate(hash: string): void
  export function seedFromRoute(route: string, fallback: number): number
  ```

- [ ] **Step 1: Add the test dependencies**

Run:

```bash
npm install --save-dev @testing-library/react jsdom
```

Expected: `package.json` gains the two entries in `devDependencies` (caret ranges, at the time of writing `"@testing-library/react": "^16.3.0"` and `"jsdom": "^27.0.0"`; whatever npm resolves is fine as long as the suite runs). No `dependencies` change.

```bash
git add package.json package-lock.json
git commit -m "chore(ui): add testing-library and jsdom for component tests"
```

- [ ] **Step 2: Configure Vitest for component tests**

```ts
// vite.config.ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // the engine suite runs in node; UI test files opt into jsdom with a `@vitest-environment` docblock
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/ui/test/setup.ts'],
  },
})
```

```ts
// src/ui/test/setup.ts
import { afterEach } from 'vitest'

// Runs for every test file. Under node (the engine suite) there is nothing to clean up, so the
// testing-library import stays inside the jsdom branch and never loads react-dom in a DOM-less run.
afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
  window.localStorage.clear()
  window.location.hash = ''
})
```

Run: `npm test`
Expected: PASS, the whole engine suite unchanged.

```bash
git add vite.config.ts src/ui/test/setup.ts
git commit -m "chore(ui): vitest setup for jsdom component tests"
```

- [ ] **Step 3: Re-export the engine's read-only queries**

Append to `src/engine/index.ts`, below the existing exports:

```ts
// Read-only queries the UI derives its controls from. Re-exports only: no new logic, no behaviour change.
export { activatableSystems, canPass, otherSeat } from './actionPhase'
export { canMunitions, retreatTargets } from './combat'
export { canInheritance, canShipyard, inheritanceTechs, shipyardPlanets, tradePostOptions } from './componentActions'
export { capacity, cheapestPlanets, fleetPoolLimit, productionCost, productionLimit, readyResources } from './economy'
export { bombardablePlanets, groundCombatPending, landablePlanets } from './invasion'
export { movableShips } from './movement'
export { controlledPlanets, controlsMecatol, scoreable } from './objectives'
export { PRODUCIBLE } from './production'
export { researchable } from './research'
export { deriveSeed } from './rng'
export { unitsOf } from './setup'
export { tokensGained } from './statusPhase'
export { cardOwner, diplomacySystems, secondaryTokenCost, unusedCards, warfareTokenSystems } from './strategicActions'
export { INITIATIVE } from './strategyPhase'
```

Then add one line to the module table in `docs/spec/engine-design.md`, under the `src/engine/index.ts` row:

```md
| `src/engine/index.ts` | `applyMove` dispatcher, re-exports, and the read-only query helpers the UI builds its controls from |
```

Run: `npx tsc -p tsconfig.app.json --noEmit && npm test`
Expected: PASS, nothing behavioural changed.

```bash
git add src/engine/index.ts docs/spec/engine-design.md
git commit -m "feat(engine): re-export the read-only queries the UI needs"
```

- [ ] **Step 4: Write the failing tests for the history rule and the store**

```ts
// src/ui/history.test.ts
import { describe, expect, it } from 'vitest'
import { toActionPhase } from '../engine/testUtils'
import { moveCount, rollCount, undoable } from './history'
import type { GameState } from '../engine/types'

const base = toActionPhase()

function withRoll(state: GameState): GameState {
  return { ...state, log: [...state.log, { t: 'roll', owner: 0, rolls: [], context: 'space combat round 1' }] }
}

describe('undo inside your own turn', () => {
  it('counts the move and roll entries in the log', () => {
    expect(moveCount(base)).toBe(4)          // the four picks of the strategy phase
    expect(rollCount(base)).toBe(0)
    expect(rollCount(withRoll(base))).toBe(1)
  })
  it('lobby-architecture 2.8: a move is undoable while the same seat acts and nothing was rolled', () => {
    expect(undoable(base, base)).toBe(true)
    expect(undoable(base, { ...base, active: 1 })).toBe(false)
    expect(undoable(base, withRoll(base))).toBe(false)
  })
})
```

```tsx
// src/ui/store.test.tsx
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { applyMove, createGame, deriveSeed } from '../engine'
import { cardsUsed, toActionPhase } from '../engine/testUtils'
import { GameProvider, useGame } from './store'
import type { GameConfig, Session } from './store'
import type { StrategyCardId } from '../engine/types'

const CONFIG: GameConfig = {
  players: [
    { faction: 'l1z1x', color: 'blue', name: 'North' },
    { faction: 'letnev', color: 'red', name: 'South' },
  ],
  speaker: 0,
}

function wrapper(ticking: boolean) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <GameProvider ticking={ticking}>{children}</GameProvider>
  }
}

function session(state: Session['state'], clockMs: [number, number]): Session {
  return { seed: 7, minutes: 15, state, history: [], clockMs, handoff: null }
}

describe('the hot-seat store', () => {
  it('starts a game and enumerates the legal picks', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    expect(result.current.session?.state.phase).toBe('strategy')
    expect(result.current.legal).toHaveLength(6)
    expect(result.current.legal.every(m => m.type === 'pickStrategyCard')).toBe(true)
    expect(result.current.session?.clockMs).toEqual([900000, 900000])
  })

  it('applies moves with a seed derived from the game seed and the move index', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    act(() => { result.current.apply({ type: 'pickStrategyCard', card: 'leadership' }) })
    const expected = applyMove(createGame(CONFIG, 7), { type: 'pickStrategyCard', card: 'leadership' }, deriveSeed(7, 0))
    expect(expected.ok).toBe(true)
    if (!expected.ok) return
    expect(result.current.session?.state).toEqual(expected.value)
  })

  it('reports the engine error and keeps the state on an illegal move', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    const before = result.current.session?.state
    act(() => { result.current.apply({ type: 'pass' }) })
    expect(result.current.session?.state).toBe(before)
    expect(result.current.error).toContain('not in the action phase')
  })

  it('undoes a move inside the same turn and clears the stack when the turn passes', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    for (const card of ['leadership', 'trade', 'technology', 'warfare'] as StrategyCardId[]) {
      act(() => { result.current.apply({ type: 'pickStrategyCard', card }) })
    }
    expect(result.current.session?.state.phase).toBe('action')
    expect(result.current.session?.state.active).toBe(0)      // leadership is initiative 1
    expect(result.current.canUndo).toBe(false)                // the draft changed seats every pick
    act(() => { result.current.apply({ type: 'startTactical', systemId: 'bereg' }) })
    expect(result.current.session?.state.players[0].tokens.tactic).toBe(2)
    expect(result.current.canUndo).toBe(true)
    act(() => { result.current.undo() })
    expect(result.current.session?.state.players[0].tokens.tactic).toBe(3)
    expect(result.current.session?.state.tactical).toBeNull()
    expect(result.current.canUndo).toBe(false)
  })

  it('flags the handoff when the seat to act changes', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(false) })
    act(() => { result.current.start(CONFIG, 7, 15) })
    act(() => { result.current.apply({ type: 'pickStrategyCard', card: 'leadership' }) })
    expect(result.current.session?.handoff).toBe(1)
    act(() => { result.current.dismissHandoff() })
    expect(result.current.session?.handoff).toBeNull()
  })

  it('R6: the clock runs for the active seat and passes automatically at zero', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(true) })
    act(() => { result.current.resume(session(cardsUsed(toActionPhase()), [1000, 60000])) })
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.session?.clockMs[0]).toBe(500)
    expect(result.current.session?.clockMs[1]).toBe(60000)
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.session?.clockMs[0]).toBe(0)
    expect(result.current.session?.state.players[0].passed).toBe(true)
    expect(result.current.session?.state.active).toBe(1)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail, then commit them**

Run: `npm test -- src/ui`
Expected: FAIL, `src/ui/history.ts` and `src/ui/store.tsx` do not exist.

```bash
git add src/ui/history.test.ts src/ui/store.test.tsx
git commit -m "test(ui): undo rule, seeded move application and the chess clock"
```

- [ ] **Step 6: Implement the history helpers and the store**

```ts
// src/ui/history.ts
import type { GameState } from '../engine/types'

export function moveCount(state: GameState): number {
  return state.log.reduce((n, e) => e.t === 'move' ? n + 1 : n, 0)
}

export function rollCount(state: GameState): number {
  return state.log.reduce((n, e) => e.t === 'roll' ? n + 1 : n, 0)
}

/**
 * lobby-architecture.md 2.8: hot-seat may take a move back by truncating the local log, but dice are final
 * and a turn that has already passed to the other seat is closed.
 */
export function undoable(previous: GameState, next: GameState): boolean {
  return next.active === previous.active && rollCount(next) === rollCount(previous)
}
```

```tsx
// src/ui/store.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { applyMove, createGame, deriveSeed, legalMoves } from '../engine'
import type { GameConfig, GameState, Move, Seat } from '../engine/types'
import { moveCount, undoable } from './history'

export type { GameConfig } from '../engine/types'

const TICK_MS = 100
// R6: a player whose clock ran out gets three more minutes at the start of every later round
const ROUND_BONUS_MS = 180000

export interface Session {
  seed: number
  minutes: number
  state: GameState
  history: GameState[]
  clockMs: [number, number]
  handoff: Seat | null
}

export interface GameStore {
  session: Session | null
  legal: Move[]
  error: string | null
  canUndo: boolean
  start(config: GameConfig, seed: number, minutes: number): void
  resume(session: Session): void
  apply(move: Move): boolean
  undo(): void
  dismissHandoff(): void
  abandon(): void
}

const GameContext = createContext<GameStore | null>(null)

export function useGame(): GameStore {
  const store = useContext(GameContext)
  if (!store) throw new Error('useGame must be used inside a GameProvider')
  return store
}

export function GameProvider({ children, ticking = true }: { children: ReactNode; ticking?: boolean }) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const roundRef = useRef<number | null>(null)

  const legal = useMemo(() => session ? legalMoves(session.state) : [], [session])

  const start = useCallback((config: GameConfig, seed: number, minutes: number) => {
    const ms = minutes * 60000
    roundRef.current = 1
    setError(null)
    setSession({ seed, minutes, state: createGame(config, seed), history: [], clockMs: [ms, ms], handoff: null })
  }, [])

  const resume = useCallback((next: Session) => {
    roundRef.current = next.state.round
    setError(null)
    setSession(next)
  }, [])

  const apply = useCallback((move: Move): boolean => {
    if (!session) return false
    const result = applyMove(session.state, move, deriveSeed(session.seed, moveCount(session.state)))
    if (!result.ok) {
      setError(result.error)
      return false
    }
    const next = result.value
    const keep = undoable(session.state, next)
    setError(null)
    setSession({
      ...session,
      state: next,
      history: keep ? [...session.history, session.state] : [],
      handoff: next.active !== session.state.active && next.winner === null ? next.active : null,
    })
    return true
  }, [session])

  const undo = useCallback(() => {
    if (!session || session.history.length === 0) return
    const previous = session.history[session.history.length - 1]
    setError(null)
    setSession({ ...session, state: previous, history: session.history.slice(0, -1), handoff: null })
  }, [session])

  const dismissHandoff = useCallback(() => {
    setSession(prev => prev ? { ...prev, handoff: null } : prev)
  }, [])

  const abandon = useCallback(() => {
    roundRef.current = null
    setError(null)
    setSession(null)
  }, [])

  // R6: the clock runs only for the seat to act, and only during the action phase
  const running = session !== null && session.state.phase === 'action' && session.state.winner === null && session.handoff === null
  const seat = session ? session.state.active : 0
  useEffect(() => {
    if (!ticking || !running) return
    const id = setInterval(() => {
      setSession(prev => {
        if (!prev) return prev
        const clockMs: [number, number] = [prev.clockMs[0], prev.clockMs[1]]
        clockMs[seat] = Math.max(0, clockMs[seat] - TICK_MS)
        return { ...prev, clockMs }
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [ticking, running, seat])

  // R6: at zero the player passes automatically; while passing is illegal (an unused strategy card, an open
  // secondary window, a running tactical action) the clock simply stays at zero until it becomes legal
  useEffect(() => {
    if (!session || !running) return
    if (session.clockMs[session.state.active] > 0) return
    if (legal.some(m => m.type === 'pass')) apply({ type: 'pass' })
  }, [session, running, legal, apply])

  // R6: three extra minutes for a flagged player at the start of every later round
  useEffect(() => {
    if (!session) return
    if (roundRef.current === session.state.round) return
    roundRef.current = session.state.round
    setSession(prev => prev ? {
      ...prev,
      clockMs: [prev.clockMs[0] || ROUND_BONUS_MS, prev.clockMs[1] || ROUND_BONUS_MS],
    } : prev)
  }, [session])

  const store: GameStore = useMemo(() => ({
    session, legal, error, canUndo: session !== null && session.history.length > 0,
    start, resume, apply, undo, dismissHandoff, abandon,
  }), [session, legal, error, start, resume, apply, undo, dismissHandoff, abandon])

  return <GameContext.Provider value={store}>{children}</GameContext.Provider>
}
```

- [ ] **Step 7: Run the store tests**

Run: `npm test -- src/ui`
Expected: PASS, 8 tests.

```bash
git add src/ui/history.ts src/ui/store.tsx
git commit -m "feat(ui): hot-seat game store with seeded moves, undo and the chess clock"
```

- [ ] **Step 8: Write the failing setup-screen test**

```tsx
// src/ui/screens/SetupScreen.test.tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

function renderApp(hash = '#/?seed=7') {
  window.location.hash = hash
  return render(<App ticking={false} />)
}

describe('the setup screen', () => {
  it('offers two seats with the v1 factions and the eight TI colours', () => {
    renderApp()
    expect(screen.getByTestId('seat-faction-0').textContent).toBe('L1Z1X Mindnet')
    expect(screen.getByTestId('seat-faction-1').textContent).toBe('Barony of Letnev')
    expect(screen.getByTestId('seat-position-0').textContent).toBe('North')
    expect(screen.getByTestId('seat-position-1').textContent).toBe('South')
    expect(screen.getAllByTestId(/^colour-0-/)).toHaveLength(8)
  })

  it('swaps the factions between the seats', () => {
    renderApp()
    fireEvent.click(screen.getByTestId('btn-swap-factions'))
    expect(screen.getByTestId('seat-faction-0').textContent).toBe('Barony of Letnev')
    expect(screen.getByTestId('seat-faction-1').textContent).toBe('L1Z1X Mindnet')
  })

  it('R2: keeps the two colours distinct', () => {
    renderApp()
    expect(screen.getByTestId('colour-1-blue').hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByTestId('colour-1-green'))
    expect(screen.getByTestId('chosen-colour-1').textContent).toBe('Green')
    expect(screen.getByTestId('colour-0-green').hasAttribute('disabled')).toBe(true)
  })

  it('starts the game and shows the board', () => {
    renderApp()
    fireEvent.change(screen.getByTestId('seat-name-0'), { target: { value: 'Despot' } })
    fireEvent.change(screen.getByTestId('seat-name-1'), { target: { value: 'Kael' } })
    fireEvent.click(screen.getByTestId('btn-start'))
    expect(screen.getByTestId('board-screen')).toBeTruthy()
    expect(screen.getByTestId('round').textContent).toBe('Round 1 of 6, strategy phase')
  })
})
```

- [ ] **Step 9: Run the test to verify it fails, then commit it**

Run: `npm test -- src/ui/screens`
Expected: FAIL, `src/ui/App.tsx` does not exist.

```bash
git add src/ui/screens/SetupScreen.test.tsx
git commit -m "test(ui): setup screen seats, colours and starting a game"
```

- [ ] **Step 10: Implement the router, the app shell and the three screens**

```ts
// src/ui/route.ts
import { useEffect, useState } from 'react'

function current(): string {
  return window.location.hash || '#/'
}

export function useHashRoute(): string {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const onChange = () => setRoute(current())
    window.addEventListener('hashchange', onChange)
    onChange()
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(hash: string): void {
  window.location.hash = hash
}

/** `#/?seed=7` fixes the game seed, which is what the tests use; without it the caller's fallback wins. */
export function seedFromRoute(route: string, fallback: number): number {
  const query = route.indexOf('?')
  if (query < 0) return fallback
  const value = new URLSearchParams(route.slice(query + 1)).get('seed')
  if (value === null) return fallback
  const seed = Number.parseInt(value, 10)
  return Number.isFinite(seed) ? seed : fallback
}
```

```tsx
// src/ui/App.tsx
import { GameProvider, useGame } from './store'
import { useHashRoute } from './route'
import { BoardScreen } from './screens/BoardScreen'
import { GameOverScreen } from './screens/GameOverScreen'
import { SetupScreen } from './screens/SetupScreen'

function Screens() {
  const { session } = useGame()
  const route = useHashRoute()
  if (session && session.state.winner !== null) return <GameOverScreen />
  if (session && route.startsWith('#/play')) return <BoardScreen />
  return <SetupScreen />
}

export default function App({ ticking = true }: { ticking?: boolean }) {
  return (
    <GameProvider ticking={ticking}>
      <Screens />
    </GameProvider>
  )
}
```

```tsx
// src/ui/screens/SetupScreen.tsx
import { useState } from 'react'
import { FACTIONS } from '../../data/factions'
import { navigate, seedFromRoute, useHashRoute } from '../route'
import { useGame } from '../store'
import type { Color, FactionId, Seat } from '../../engine/types'

const COLOURS: Color[] = ['red', 'blue', 'green', 'yellow', 'purple', 'black', 'orange', 'pink']
const COLOUR_NAMES: Record<Color, string> = {
  red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow',
  purple: 'Purple', black: 'Black', orange: 'Orange', pink: 'Pink',
}
const POSITION: [string, string] = ['North', 'South']

export function SetupScreen() {
  const { start } = useGame()
  const route = useHashRoute()
  const [names, setNames] = useState<[string, string]>(['Player 1', 'Player 2'])
  const [factions, setFactions] = useState<[FactionId, FactionId]>(['l1z1x', 'letnev'])
  const [colours, setColours] = useState<[Color, Color]>(['blue', 'red'])
  const [minutes, setMinutes] = useState(15)

  function setName(seat: Seat, value: string) {
    setNames(seat === 0 ? [value, names[1]] : [names[0], value])
  }
  function setColour(seat: Seat, value: Color) {
    setColours(seat === 0 ? [value, colours[1]] : [colours[0], value])
  }
  function onStart() {
    const seed = seedFromRoute(route, Math.floor(Math.random() * 0x7fffffff))
    start({
      players: [
        { faction: factions[0], color: colours[0], name: names[0].trim() || 'Player 1' },
        { faction: factions[1], color: colours[1], name: names[1].trim() || 'Player 2' },
      ],
      speaker: 0,
    }, seed, minutes)
    navigate('#/play')
  }

  return (
    <div className="setup" data-testid="setup-screen">
      <div className="space"><div className="stars" /><div className="neb" /><div className="limb" /><div className="dust" /></div>
      <header className="hero">
        <h1 className="title goldtext">Mecatol Duel</h1>
        <p className="tagline">Twilight Imperium for two players, thirty minutes</p>
      </header>
      <div className="seats">
        {([0, 1] as Seat[]).map(seat => (
          <div className="cut seat" key={seat}>
            <div className="in">
              <div className="seat-top">
                <span className="lbl">Seat {seat + 1}</span>
                <span className="lbl dim" data-testid={`seat-position-${seat}`}>{POSITION[seat]}</span>
              </div>
              <input
                className="field" data-testid={`seat-name-${seat}`} value={names[seat]}
                aria-label={`Name of seat ${seat + 1}`} onChange={e => setName(seat, e.target.value)}
              />
              <div className="faction goldtext" data-testid={`seat-faction-${seat}`}>{FACTIONS[factions[seat]].name}</div>
              <div className="row colour">
                <span className="lbl">Colour</span>
                <div className="swatches">
                  {COLOURS.map(colour => (
                    <button
                      key={colour} type="button"
                      className={`sw ${colour}${colours[seat] === colour ? ' sel' : ''}`}
                      data-testid={`colour-${seat}-${colour}`}
                      title={COLOUR_NAMES[colour]}
                      disabled={colours[seat === 0 ? 1 : 0] === colour}
                      onClick={() => setColour(seat, colour)}
                    />
                  ))}
                </div>
                <span className="chosen" data-testid={`chosen-colour-${seat}`}>{COLOUR_NAMES[colours[seat]]}</span>
              </div>
              <div className="row">
                <span className="lbl">Starting techs</span>
                <span>{FACTIONS[factions[seat]].startingTechs.map(id => id.replace(/_/g, ' ')).join(', ')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="setup-foot">
        <button type="button" className="btn quiet" data-testid="btn-swap-factions" onClick={() => setFactions([factions[1], factions[0]])}>
          Swap factions
        </button>
        <label className="clockfield">
          <span className="lbl">Minutes each</span>
          <input
            type="number" min={1} max={60} className="field small" data-testid="minutes"
            value={minutes} onChange={e => setMinutes(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
          />
        </label>
        <button type="button" className="btn gold" data-testid="btn-start" onClick={onStart}>Play hot-seat</button>
      </div>
    </div>
  )
}
```

```tsx
// src/ui/screens/BoardScreen.tsx
import { useGame } from '../store'

const PHASE_LABEL: Record<string, string> = {
  strategy: 'strategy phase', action: 'action phase', status: 'status phase', ended: 'game over',
}

export function BoardScreen() {
  const { session } = useGame()
  if (!session) return null
  const state = session.state
  return (
    <div className="app" data-testid="board-screen">
      <div className="space"><div className="stars" /><div className="neb" /><div className="swirl" /><div className="limb" /><div className="dust" /></div>
      <div className="r" data-testid="round">Round {state.round} of 6, {PHASE_LABEL[state.phase]}</div>
    </div>
  )
}
```

```tsx
// src/ui/screens/GameOverScreen.tsx
import { navigate } from '../route'
import { useGame } from '../store'

export function GameOverScreen() {
  const { session, abandon } = useGame()
  if (!session || session.state.winner === null) return null
  const state = session.state
  const winner = state.players[state.winner]
  return (
    <div className="setup" data-testid="game-over">
      <div className="space"><div className="stars" /><div className="neb" /><div className="limb" /><div className="dust" /></div>
      <header className="hero">
        <h1 className="title goldtext" data-testid="winner">{winner.name} wins</h1>
        <p className="tagline" data-testid="final-score">
          {state.players[0].name} {state.players[0].vp} victory points, {state.players[1].name} {state.players[1].vp}
        </p>
      </header>
      <div className="setup-foot">
        <button type="button" className="btn gold" data-testid="btn-new-game" onClick={() => { abandon(); navigate('#/') }}>
          New game
        </button>
      </div>
    </div>
  )
}
```

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

```css
/* src/index.css */
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; background: #05070f; }
```

Remove the scaffold:

```bash
git rm src/App.tsx src/App.css src/assets/hero.png src/assets/react.svg src/assets/vite.svg
```

- [ ] **Step 11: Run the tests, type-check, lint and commit**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: PASS, the engine suite plus 12 UI tests.

```bash
git add src/ui/route.ts src/ui/App.tsx src/ui/screens src/main.tsx src/index.css
git commit -m "feat(ui): app shell, hash router, setup screen and screen routing"
```
