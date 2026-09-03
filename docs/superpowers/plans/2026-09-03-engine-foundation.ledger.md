# SDD ledger — plan: docs/superpowers/plans/2026-09-03-engine-foundation.md

Ruling: work on branch feat/engine-foundation inside the repo instead of a separate worktree — fresh local repo, nothing else runs in it, the branch is the isolation; cost if wrong: none beyond a branch switch.

## Pre-flight scan (2026-09-03)
| Pair / task | Produces vs consumes | Finding |
| --- | --- | --- |
| T1 types.ts vs spec engine-design.md | plan says copy "State shape" and "Moves" blocks | `Result<T>` lives in the spec's "Contract" block, not in those two; T5/T6 import it from types. Ruling: T1 also defines `export type Result<T>` in types.ts (verbatim from the Contract block). |
| T1 units.ts vs T6 economy.ts | exports unitStats, StatsOwner, NON_FIGHTER_SHIPS, isShip | consistent |
| T3 map.ts vs T5 setup.ts | SYSTEMS with home seats, planet ids '000', 'arc-prime', 'wren-terra' | consistent with factions.ts planetIds |
| T4 techs.ts vs T1 units.ts UPGRADE_TECH | ids infantry_ii, fighter_ii, destroyer_ii, cruiser_ii, carrier_ii, dreadnought_ii, space_dock_ii, war_sun, super_dreadnought_ii | consistent |
| T5 setup.ts vs T6 strategyPhase.ts | draft order [speaker, other, other, speaker], strategyPool with bonus | consistent; draft empty -> action phase handled in T6 |
| T6 economy.test.ts | test 'payCost exhausts planets' contains a dead `withTg` block before the real `s` | Ruling: implementer deletes the two dead lines; test intent unchanged |
| T6 strategyPhase.test.ts | `pick` helper uses a convoluted conditional type for the card parameter | Ruling: implementer may replace it with `StrategyCardId` imported from './types' |
| T1..T6 guardian fleet arithmetic | six compositions | each sums to 8 with fighters at 1 per 2, verified by hand |


Tasks 1-3: implemented as one batch (commits de819f8..b065295, 16/16 tests, tsc clean). Implementer concern: TRADE_POSTS is `as const` readonly tuples; watch when a later task needs mutable string[].
Tasks 1-3: task review dispatched (base 2771e2a, head b065295).

Tasks 1-3: complete (commits 2771e2a..b065295, review clean)
Tasks 1-3: minor (deferred): unitStats returns shared references into module tables; consider Object.freeze on LEVEL_I/FLAGSHIPS/SUPER_DREADNOUGHT_*
Tasks 1-3: minor (deferred): TRADE_POSTS is readonly tuple type (as const), annotate when a consumer needs string[]
Tasks 1-3: minor (deferred): reviewer claims tsconfig.app.json lacks "strict": true; controller check result recorded below
Controller check: neither tsconfig sets "strict"; Ruling: tasks 4-6 implementer adds "strict": true to tsconfig.app.json as a chore commit before Task 4 and fixes any fallout — cost if wrong: a few type annotations.
Tasks 4-6: implementer dispatched (base b065295).
Tasks 4-6: implemented (commits b8d028b..42c9a32, 41/41 tests, strict on, lint clean). Task review dispatched.
Tasks 4-6: complete (commits b065295..42c9a32, review clean)
Tasks 4-6: minor (deferred): validateMove uses JSON.stringify comparison (plan-mandated, replace with structural checks in Plan 2)
Tasks 4-6: minor (deferred): economy.ts has two import statements from ../data/units, merge
Tasks 4-6: minor (deferred): no test covers the full PUBLIC_OBJECTIVES array; payCost unknown-planet branch untested
Final whole-branch review dispatched (merge-base 2771e2a, head 42c9a32).
Final review: With fixes. Important: (1) rollGuardianFleet wipes non-guardian ships/ground; (2) unitStats returns shared mutable refs; (3) nonFighterShips/capacity owner-blind; (4) throwing lookups behind Result contract, applyMove has no try/catch; (5) no deepFreeze mutation test on applyMove. Minors triaged per review.
Ruling: spec R4.4 stands, the 3 free fighter slots belong to Space Dock II only (TI4 base Space Dock I has no such clause; the reference JSON's base entry is the anomaly) — cost if wrong: production check is one line to move.
Ruling: spec R3.2 parenthetical "unless the system is their home system" is removed; you can never activate a system that already contains your own command token, home included (TI4 rule) — cost if wrong: one condition in Plan 2.
Ruling: the engine stays time-free; move timestamps are recorded by the transport (moves table), R6 text adjusted; LogEntry gets no timestamp — cost if wrong: add an optional `at` field later.
Ruling: noUncheckedIndexedAccess not enabled now (judgement call in the review); revisit after Plan 2.
Final fix wave dispatched (fix base 42c9a32).
Plan 2 drafted at docs/superpowers/plans/2026-09-03-engine-tactical.md (uncommitted, pending reconciliation with the fix wave).
Ruling (Plan 2): retreat follows spec R4.1 step 5, announced before a round and executed after it; add `retreatTo: string | null` to CombatState — cost if wrong: one field and one branch.
Ruling (Plan 2): L4 Disruptors negates only space cannon defense during invasion (printed card); bombardment through planetary shield only with Arc Secundus; spec R4.3 step 1 text to be corrected — cost if wrong: one condition.
Ruling (Plan 2): cargo above capacity is destroyed at the end of a space combat and after a retreat, not after every round — cost if wrong: one call site.
Final fix wave: complete (commits 42c9a32..059d85f, 49/49 tests). Scoped re-review dispatched.
Spec fix committed: R4.3 step 1 no longer lists L4 Disruptors for bombardment (ruling above).
Final fix wave: re-review clean (all 11 addressed). Parked minors for Plan 2 entry: setup.test.ts withIntruders fixture does not bump nextUnitId (duplicate ids in fixture); initiativeOrder no-cards test only covers the symmetric case.
Plan complete: feat/engine-foundation 2771e2a..e43bde3, 49/49 tests.
