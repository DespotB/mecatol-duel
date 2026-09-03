# SDD ledger — plan: docs/superpowers/plans/2026-09-03-hotseat-ui.md

Ruling: work on branch feat/hotseat-ui; independent tasks run in worktrees as in Plan 3; pre-flight scan delegated (opus overloaded, sonnet used) — cost if wrong: a missed conflict surfaces in a task review.
Carried from Plan 3 final review (deferred): warfareSecondary seat guard; imperialPrimary duplicates scoreable; scoreObjective log fallback; untested LRR 30.2 duplicate-token branch; richer per-card log entries (useful for the UI log panel).
Decision: after Plan 4 the app is deployed to Vercel (Despot, 03.09.2026).

## Pre-flight rulings (2026-09-03)
Ruling: force rows and any count-plus-label text render with an explicit `{' '}` joiner (or a single template string) so textContent matches the tests ("5 Infantry I"); applies to Task 3 and every later component with the same pattern — cost if wrong: test edits.
Ruling: `readyInfluence` is exported from economy.ts and re-exported by the Task 1 barrel; format.ts imports it instead of reimplementing — cost if wrong: one import.
Ruling: the mockup has authority for the board, the produce and tech drawers and the lobby; the other dialogs (movement, combat, invasion, strategic cards, secondary window, component actions, status, handoff, log) are built in the same visual language (cut-corner panels, gold hairlines, Cinzel/Barlow); after Plan 4 all screens are screenshotted for Despot's review — cost if wrong: a design pass.
Ruling: while the handoff overlay is shown the board root gets the `inert` attribute; the handoff test asserts it — cost if wrong: one attribute.
Ruling: the setup screen keeps the mockup's landing structure (three panels; "Create online lobby" and "Join with a code" present but disabled with a "coming with online play" note) above the seat configuration, and the seat cards show the starting fleet with unit sprites plus the starting techs — cost if wrong: layout work in Task 1.
Ruling: the commodity cap is read from FACTIONS[faction].commodityValue; Task 4b's implementer adds the imports BoardScreen needs.
Task 1: implementer dispatched (base fc09546).
Ruling (Task 1): undo is allowed only while the same seat is active, the phase is unchanged and no dice were rolled since; `undoable` gains `next.phase === previous.phase` (the draft completion is a boundary) — cost if wrong: one condition.
Task 1: implemented (fc09546..622a300, 235/235, build ok). Review dispatched. Task 2 started in parallel in a worktree off 622a300.
Task 1: complete (fc09546..622a300, review clean)
Task 1: minor (deferred): SPRITE_MANIFEST hand-copied (no build-time link); two oxlint warnings in store.tsx from brief code.
Task 2: implemented in worktree (622a300..dd3557b, 245/245, screenshot ok). Review dispatched; Task 3 started in a worktree off dd3557b. Minor (deferred): trade post station art is a placeholder shape, redraw per mockup later.
Task 2: fix (tsconfig types scoped, c7a90e8) — trivial, no re-review. Task 2: complete (622a300..c7a90e8, merged into feat/hotseat-ui at c7a90e8)
Task 3: implemented in worktree (dd3557b..7a93fbc, 251/251, screenshot ok). Review dispatched; Tasks 4a and 4b started in worktrees off 7a93fbc (BoardScreen.tsx conflicts expected, controller resolves). Minor (deferred): "Super-Dreadnought I" force label wraps to three lines; speaker token overlaps the name in the top bar.
Task 3: review Needs fixes (force labels wrap mid-word instead of the mockup .fc.wide full-width row; clock bar denominator hardcoded 900000; running badge ignores handoff). Fix round 1/5 dispatched.
Task 3: fix round 1/5 implemented (7a93fbc..d66a12a). Re-review dispatched.
Task 4a: implemented in worktree (7a93fbc..dde3550, 257/257, screenshots ok). Review dispatched.
Task 3: fix round 1/5 (3 addressed, 0 open; 7a93fbc..d66a12a). Task 3: complete (merged into feat/hotseat-ui at a0688ff). Minor (deferred): wide row applies to both dreadnought labels, mockup widens only the Super-Dreadnought.
Task 4b: implemented in worktree (7a93fbc..1765315, 257/257, tech drawer screenshot ok). Review dispatched. Integration note: dedupe moveOptionsStrategic/PayRowStrategic/StepperStrategic against Task 4a after the merge; minor: tech drawer overlaps the bottom bar hint.
Task 4a: complete (7a93fbc..dde3550, review clean, merged into feat/hotseat-ui at bfa6e63)
Task 4b: complete (7a93fbc..1765315, review clean, merged into feat/hotseat-ui at 8a54364; BoardScreen import conflict resolved by the controller). Integration dedupe dispatched.
Integration dedupe: complete (8a54364..2b4a743, merged at 2b4a743). Ruling: no separate review, the changes are deletions of byte-identical files plus two reviewer-requested minors.
Task 5: implemented in worktree (8a54364..7c371bc, 268/268). Review dispatched; Task 6 started in a worktree off 7c371bc.
Task 6: implemented in worktree (7c371bc..a5b9c8e, 269/269, e2e passed first run). Ruling: Task 6 is test-only; its review is folded into the final whole-branch review — cost if wrong: none.
Task 5: complete (review clean; Important: inert test assertion missing -> final fix wave). Task 6: merged. BoardScreen import conflict resolved by the controller. Final whole-branch review dispatched (merge-base fc09546, head 65c9cc4).
Final review: With fixes. Important: 1 setup screen lacks the lobby CSS; 2 hero hidden behind the backdrop; 3 engine rejections silent and confirm buttons never disabled; 4 clock tick re-enumerates legalMoves and saves at 10 Hz; 5 demo bootstrap and testUtils in the production bundle; 6 no error boundary; 7 tiles not keyboard reachable, dialogs without role/focus; 8 inert test assertion missing; 9 tab title. Minors: webfonts not loaded, vercel.json rewrite, strategy strip labels collide, dead .scrim, clock bonus untested.
Ruling: all nine Important items plus webfonts, vercel.json and the strategy-strip collision are fixed before merge; fixed 1440x900 layout stays (plan non-goal), responsive layout is a Plan 5 item.
Final fix wave dispatched (fix base 65c9cc4).
Final fix wave: implemented (65c9cc4..872f70f, 279/279, demo code out of the bundle, setup screenshot ok). Scoped re-review dispatched.
Final fix wave: re-review clean (12/12 addressed, 279/279). Plan complete: feat/hotseat-ui fc09546..872f70f.
