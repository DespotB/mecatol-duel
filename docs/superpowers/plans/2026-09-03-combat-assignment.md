# Manual Hit Assignment and the Combat Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each side assigns the hits it takes to its own ships (including the sustain-damage choice) instead of the engine assigning them automatically, and the space combat dialog shows what happened as two readable columns: ships with counts, the dice they threw, and the hits they scored.

**Architecture:** The engine grows a pending-hit queue on `CombatState`. Any roll step that scores hits against a seat's fleet either resolves them itself (when the owner has no real choice) or pushes a `PendingHits` entry; the combat cannot continue until the queue is empty. A new `assignHits` move consumes the head of the queue. The UI reads the queue and the round's dice out of the log and renders the two-column combat table plus the assignment controls; the hot-seat store hands the device to whichever seat has to assign.

**Tech Stack:** TypeScript engine (pure functions, seeded RNG), React 19 + Vite, Vitest + @testing-library/react.

**Spec:** `docs/spec/game-rules.md` R4.1 (this plan rewrites the hit-assignment paragraphs; Task 1 does that edit).

## Global Constraints

- Engine stays pure: `applyMove(state, move, seed) -> Result<GameState>`, immutable state, every die logged, rule rejections as `Result` errors, exceptions only for bugs (`internal: true`).
- Determinism is non-negotiable: the same seed and the same move sequence must replay identically. The pending queue changes *when* hits land, never *which dice were rolled*, so the existing salt scheme (`AFB_SALT_BASE`, `SPACE_CANNON_SALT_BASE`, `4r + 10 / 4r + 11`) stays exactly as it is.
- The guardian fleet has no player: the engine resolves guardian hit assignment itself, with the current automatic order, and never queues a pending entry for it.
- Every existing test must keep passing except the ones this plan explicitly rewrites. `npm test && npm run build && npm run lint` clean before every commit.
- Commit small and often, in English, no Claude co-author trailer. Never `rm -rf`.

## Rules being implemented (rulings for this duel engine)

1. **Who assigns.** The owner of the ships assigns the hits scored against them. Both sides roll first (as today, simultaneously), then hits are assigned: the attacker's fleet first, then the defender's. The dice are already on the table, so the order leaks nothing.
2. **Sustain is a choice.** A hit may be cancelled by an undamaged sustain-capable ship of the assigning side (Non-Euclidean Shielding cancels two hits with one sustain). The engine no longer sustains automatically.
3. **Restricted hits.** `noFighters` hits (Graviton Laser System) and the L1Z1X `preferNonFighters` hits must be absorbed by non-fighter ships while any is present; a restricted hit with no legal target is lost, exactly as today.
4. **No choice, no click.** When every legal resolution of a pending group is equivalent — all candidate ships are of the same type and damage state and none of them can sustain, or the hits kill the whole fleet — the engine resolves it itself and logs it. A pending entry is created only when the owner has a real decision.
5. **Anti-fighter barrage** stays automatic: its hits can only destroy fighters, which are interchangeable, so rule 4 always applies. It keeps happening for both sides in round 0, before any combat round, as it does today.
6. **Assault Cannon** destroys one enemy non-fighter ship: the victim's owner chooses it (a pending group of one `noFighters` hit), unless rule 4 applies.
7. **Ground combat and bombardment stay automatic.** Only infantry fight on the ground and they are interchangeable; there is no choice to make.

---

### Task 1: The pending-hit queue in the engine

**Files:**
- Modify: `src/engine/types.ts` (`CombatState`, `Move`, new `PendingHits`)
- Modify: `src/engine/combat.ts` (`applyCombatHits` and its callers, `combatRound`, `spaceCannonOffense`, `assaultCannon`, `finish`)
- Modify: `src/engine/legalMoves.ts` (offer `assignHits`, suppress everything else while the queue is non-empty)
- Modify: `src/engine/index.ts` (dispatch the new move, re-export the new read-only queries)
- Modify: `src/engine/movement.ts` (the `spaceCannonOffense`-only path when the attacker meets no ships)
- Modify: `docs/spec/game-rules.md` (R4.1: the four rulings above)
- Test: `src/engine/combat.test.ts` (or the file that holds the combat tests — find it), `src/engine/tacticalFlow.test.ts`, `src/engine/fullGame.test.ts`

**Interfaces (produced for Tasks 2 and 3 — use these exact names):**

```ts
// types.ts
export interface PendingHits { owner: Seat; groups: HitGroup[]; context: string }   // HitGroup already exists in combat.ts; move it to types.ts
export interface CombatState {
  round: number; attacker: Seat; defender: Owner
  retreating: Seat | null; retreatTo: string | null
  lastRolls: DieRoll[]
  pending: PendingHits[]          // hits waiting to be assigned, head first; empty when the combat may continue
}
// Move
| { type: 'assignHits'; destroy: number[]; sustain: number[] }   // unit ids of the assigning seat, in the activated system
```

```ts
// combat.ts, exported read-only queries for the UI (re-exported from src/engine)
export function pendingFor(state: GameState): PendingHits | null          // head of the queue, or null
export function assignmentTargets(state: GameState): { destroy: Unit[]; sustain: Unit[] }   // legal picks for the head
export function assignmentComplete(state: GameState, destroy: number[], sustain: number[]): boolean
```

- [ ] **Step 1: Failing test — a real choice queues.** In the combat test file, build a space combat where the defender has a dreadnought and two fighters and takes 1 hit. Run `combatRound`. Assert: no ship was destroyed yet, `state.tactical.combat.pending` has one entry with `owner` = the defender's seat and one `any` hit, and `legalMoves(state)` contains an `assignHits` move and no `combatRound` move. Use the existing test helpers (read `src/engine/testUtils.ts` first).
- [ ] **Step 2:** run it → fails.
- [ ] **Step 3: Implement the queue.** `applyCombatHits` splits into: `resolveHits(state, systemId, owner, groups, context)` which (a) returns the state unchanged when no hits, (b) auto-resolves via the existing `assignHits` helper when the owner is the guardian or when rule 4 applies (write `isForcedAssignment(units, groups, owner, nes): boolean` next to it: true when the hits kill every ship, or when all candidate units share one `(type, damaged)` class and none of them can sustain), logging `{ t: 'info', text: '<n> hits assigned automatically in <system>' }`, and (c) otherwise appends a `PendingHits` entry. Every current call site of `applyCombatHits` goes through it with a context string: `'space cannon offense'`, `'assault cannon'`, `'anti-fighter barrage'`, `'combat round <r>'`.
- [ ] **Step 4: Implement the move.** `assignHits(state, destroy, sustain)` in `combat.ts`: reject when there is no pending head (`'no hits to assign'`), when the acting seat is not the head's owner (`'not your hits'`), when an id is not an own ship in the system, when a sustain id is damaged or cannot sustain, when an id appears in both lists, and when the picks do not cover exactly the assignable hits (`assignmentComplete` — see the feasibility rule below). On success: mark the sustained ships damaged, destroy the chosen ships (reuse `destroyUnits` so reinforcements stay right), log `{ t: 'info', text: '<name> assigns <n> hits: ...' }`, pop the head, and when the queue is now empty continue the combat exactly where it stopped (`finish(...)` for a combat round; the pre-combat steps continue with the next step).
- [ ] **Step 5: Feasibility rule** (`assignmentComplete`): each sustain absorbs 1 hit (2 with Non-Euclidean Shielding), each destroyed ship absorbs 1. Sort the groups strictest first (`noFighters`, `preferNonFighters`, `any`); non-fighter absorbers cover any group, fighter absorbers cover only `any` (and `preferNonFighters` once no non-fighter ship is left in the fleet at all). The pick is complete when it absorbs `min(total hits, the maximum the fleet can absorb)` hits; restricted hits with no legal target are lost, not required. Write the arithmetic as one small pure function with its own unit tests (at least: 3 hits vs 2 ships → both die, one hit lost; 1 `noFighters` hit vs 2 fighters + 1 cruiser → the cruiser must be picked; 1 `noFighters` hit vs 2 fighters only → nothing to pick, the hit is lost and the queue entry never appears).
- [ ] **Step 6: Sequencing.** While `pending` is non-empty, `legalMoves` offers only `assignHits` (no `combatRound`, no `retreat`, no `endTactical`, no `pass`) and `validateMove` rejects the rest with `'hits must be assigned first'`. A pre-combat round 0 that queues hits must resume its remaining steps (space cannon → assault cannon → anti-fighter barrage → `finish`) after the last assignment: keep the step list in the state (`combat.pending[0].context` tells you where you are) or, simpler and preferred, run the pre-combat steps as a small state machine driven off the context strings. Whichever you choose, document it in a comment, and test that a round 0 with a space-cannon hit and a later AFB still ends with `round === 1`.
- [ ] **Step 7: Guardian.** A combat against the guardian fleet queues nothing for the guardian side and still queues the seat's own hits. Test both directions.
- [ ] **Step 8: Regression.** `fullGame.test.ts` plays whole games; it will now stall on assignments. Extend its driver so that whenever `pendingFor(state)` is non-null it plays a legal `assignHits` (pick the first `assignmentTargets().destroy` entries needed, no sustain), then continue. Assert the games still finish for all ten seeds and the replay stays deterministic.
- [ ] **Step 9: Spec.** Rewrite the R4.1 hit paragraphs in `docs/spec/game-rules.md` with rulings 1-7 above.
- [ ] **Step 10:** `npm test && npm run build && npm run lint`; commit in slices (`feat(engine): pending hit queue`, `feat(engine): assignHits move`, `test(engine): full games assign their hits`, `docs: R4.1 manual hit assignment`).

---

### Task 2: The combat table

**Files:**
- Rewrite: `src/ui/flows/CombatDialog.tsx`
- Create: `src/ui/flows/combat.css` (all new styles live here, NOT in `theme.css`)
- Create: `src/ui/flows/Die.tsx` (one d10 face)
- Modify: `src/ui/history.ts` if the dialog needs a per-round, per-owner view of the rolls (add a query there rather than filtering the log inline)
- Test: `src/ui/flows/CombatDialog.test.tsx`

**The user's request, verbatim (German, dictated):** "Den Combat Space vielleicht mit so zwei vertikalen Tabellen, dann die Icons wieder wie auf dem Spielfeld nur hier gelistet von den Schiffen und die Anzahl, und dann daneben ein echter Würfel oder mehrere Würfel. Wenn es zum Beispiel drei Schiffe sind, neben diesem Schiff in der gleichen Row den Würfel und was er gewürfelt hat, und dann nochmal daneben den Hit, also wenn da drei Würfel sind und zwei haben gehittet, dann zwei Hits, vielleicht mit so einem Explosions-Icon." Today the dialog prints one flat line per roll ("Player 1: 4, 5, 8, 5, 2") and nobody can tell which ship threw what.

**Layout:** two columns side by side, attacker left, defender right, each headed by the player's name, faction sigil and ship count. One row per unit type present in that fleet:

| ship sprite + count badge | the dice that type threw, as d10 faces | the hits it scored |

- The sprite is the same art as on the board (`spriteUrl(colour, type)`, `colourOf` for the guardian's grey), 30px tall, with the count badge styled like the board's `.stk .cnt`.
- A die face is a d10 rhombus (CSS `clip-path`, gold hairline on the dark panel) with the rolled number; a die that hit is filled gold with dark text, a miss stays outlined and dim. The unit's target value is shown once per row as a small "≥ N" label so the numbers make sense.
- The hits cell shows one burst icon per hit (inline SVG, gold; no new asset dependency) and the total.
- Rows for the pre-combat steps (space cannon offense, anti-fighter barrage) get their own labelled block above the combat rounds, because they are thrown by PDS and destroyers before round 1: label each block with its context string ("Space cannon offense", "Anti-fighter barrage", "Round 1"), newest last.
- Keep the round counter, the Munitions Reserves checkboxes, the retreat buttons and the "Open fire" / "Fight round N" button, and keep every existing `data-testid` (`combat-dialog`, `combat-round`, `btn-combat-round`, `munitions-attacker`, `munitions-defender`, `retreat-announced`, `btn-retreat-<id>`). `combat-rolls-<i>` may be replaced, but then update the tests that use it.

- [ ] **Step 1: Failing test.** `CombatDialog.test.tsx`: given a state whose log holds a combat round with two dreadnought dice (one hit) and three fighter dice (one hit) for seat 0, the dialog renders a row `combat-row-0-dreadnought` containing two `die` elements, one of them marked as a hit, and a hits cell reading 1; and a row `combat-row-0-fighter` with three dice. Run → fails.
- [ ] **Step 2:** Implement `Die.tsx` and the table. Build the rows by grouping the round's `DieRoll[]` by `owner` then `unit` — `DieRoll` already carries both.
- [ ] **Step 3:** Screenshot: `npm run dev -- --port 5186 --strictPort`, drive a combat through the demo route if one exists (check `src/ui/App.tsx` for the `?demo=1&panel=…` scripts and add a `panel=combat` script if none reaches a space combat — it is DEV-only code, the same pattern as the existing ones), shoot 1440x900, view the PNG, iterate until the table is readable.
- [ ] **Step 4:** tests, build, lint, commit.

---

### Task 3: Assigning the hits in the UI

**Files:**
- Modify: `src/ui/flows/CombatDialog.tsx` (+ `combat.css`)
- Modify: `src/ui/store.tsx` (the acting seat for the hot-seat handoff)
- Modify: `src/ui/moveOptions.ts` (a helper that reads the pending entry and the legal targets out of the engine queries)
- Test: `src/ui/flows/CombatDialog.test.tsx`, `src/ui/hotseat.e2e.test.tsx`

**Interfaces:** consumes `pendingFor`, `assignmentTargets`, `assignmentComplete` from `src/engine` (Task 1) and the `assignHits` move.

- [ ] **Step 1: Failing test.** With a pending entry for seat 1 (two `any` hits, a dreadnought and three fighters in the fleet), the dialog shows an assignment block `data-testid="assign-panel"` naming the seat and "2 hits", one clickable target per ship (`assign-target-<unitId>`), a sustain toggle on the dreadnought (`assign-sustain-<unitId>`), a disabled confirm button (`btn-assign-confirm`) until the picks cover the hits, and no "Fight round" button while the queue is non-empty. Run → fails.
- [ ] **Step 2: Implement.** Targets are the ship sprites again, greyed when picked for destruction, marked with a damage stripe when picked to sustain; a running "2 of 2 hits covered" line; confirm applies `{ type: 'assignHits', destroy, sustain }`. Sustain-capable ships offer both actions (click = destroy, a small shield button = sustain). The hits being assigned are labelled with their context ("from anti-fighter barrage", "from round 1") and restricted hits say so ("must hit a non-fighter ship").
- [ ] **Step 3: Hot-seat handoff.** The seat that must assign is usually not `state.active`. Add `actingSeat(state)` to the engine (`pendingFor(state)?.owner ?? state.active`), re-export it, and use it in `store.tsx` wherever the handoff and the clock decide whose turn it is, so the device is passed to the assigning player and passed back afterwards. Do not let the chess clock charge the assigning seat's own time for the opponent's assignment: the clock keeps running for `state.active`, as it does today. Cover both in tests.
- [ ] **Step 4: Screenshot** the assignment state at 1440x900, view it, iterate.
- [ ] **Step 5:** full `npm test && npm run build && npm run lint`, commit in slices.
