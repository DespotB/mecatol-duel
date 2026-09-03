# SDD ledger — plan: docs/superpowers/plans/2026-09-03-engine-tactical.md

Ruling: work on branch feat/engine-tactical inside the repo (same reasoning as Plan 1) — cost if wrong: none.
Ruling: the pre-flight conflict scan is delegated to a review agent because the plan is 2316 lines; the controller rules on its table — cost if wrong: a missed conflict surfaces in a task review instead.
Carried from Plan 1: parked minors (setup.test.ts withIntruders fixture does not bump nextUnitId; initiativeOrder no-cards test symmetric only); TRADE_POSTS readonly tuple; validateMove JSON comparison to be replaced in Plan 2 Task 6.

## Pre-flight scan (delegated, 2026-09-03) and rulings
Ruling: legalMoves emits endInvasion only when no ground combat is pending — cost if wrong: none.
Ruling: Task 5 fleet-pool rejection test uses {warsun:1, cruiser:1} (4 > 3); the objective-4 test produces {dreadnought:1, infantry:4} (cost 6, one non-fighter) — cost if wrong: test rewrite.
Ruling: Task 2 commit step adds src/engine/types.ts and docs/spec/engine-design.md — cost if wrong: none.
Ruling: remove the unused StrategyCardId import in tacticalFlow.test.ts — cost if wrong: none.
Ruling: Graviton Laser hits that cannot go to non-fighters are lost (spec R4.1 step 1); [0.0.1]/L1Z1X dreadnought hits keep the "if able" preference — cost if wrong: one branch.
Ruling: production trims excess fighters instead of rejecting (spec R4.4 as amended); non-fighters beyond the fleet pool reject — cost if wrong: one branch.
Ruling: Fighter II capacity exemption adopted into the spec (R3.2) — cost if wrong: one clause.
Ruling: pre-combat order is space cannon offense, Assault Cannon, anti-fighter barrage (spec amended) — cost if wrong: reorder.
Ruling: space cannon offense is fired by PDS of every owner other than the active player in the system — cost if wrong: one filter.
Ruling: retreat destinations require own units or own command token only (spec R4.1 step 5), not merely a controlled planet — cost if wrong: one condition.
Ruling: Harrow fires automatically after each ground combat round in v1 (automatic assignment policy) — recorded, no change.
Ruling: the smoke test treats a rejected legal move as soft: it tries other legal moves and fails only if none applies; every rejection is counted and the test asserts the rejection count stays below 5 percent — cost if wrong: test tolerance.
Ruling: test helpers toActionPhase/withUnits/withTechs live once in src/engine/testUtils.ts (Task 1 adds them); the dice-roll block becomes one helper rollHits(rng, dice, value, extraDie) in board.ts used by combat and invasion — cost if wrong: refactor.
Ruling: dead export board.makeUnits, task-referencing comments, the letnevSeat alias, Task 3's no-op step, the shadowed `capacity` variable and the stale L4 note are removed; the nebula and Duranium tests are made discriminating (nebula: assert the +1 modifier through the pure rollHits threshold with a fixed seed; Duranium: choose a fixture where the repair changes the surviving count); engine-design.md gets actionPhase.ts and board.ts in the module table and the template paragraph updated in Task 6 — cost if wrong: plan edits only.
Plan revised and committed (ccd236b). Task 1 implementer dispatched (base ccd236b).
Task 1: implemented (ccd236b..8b6c029, 57/57). Review dispatched.
Task 1: complete (commits ccd236b..8b6c029, review clean)
Task 2: implementer dispatched (base 8b6c029).
Task 2: implemented (8b6c029..48e9a14, 69/69). Review dispatched.
Task 2: complete (commits 8b6c029..48e9a14, review clean)
Task 2: minor (deferred): movableShips has no direct test (covered via legalMoves in Task 6); trimCargo with fighter_ii keeps all fighters without a fleet-pool re-check, flag for the Task 3 reviewer.
Task 3: implementer dispatched (base 48e9a14).
Task 3: implemented (48e9a14..0676eb8, 89/89). Review dispatched.
Task 3: review Approved with 4 Important (plan-mandated) findings -> fix loop.
Ruling: Duranium Armor repairs one damaged unit per side after every combat round (round >= 1) regardless of hits, never during round 0 — spec R4.1.4; cost if wrong: one function.
Ruling: Munitions Reserves is per side: Move `combatRound.munitions?: { attacker?: boolean; defender?: boolean }`, each honoured only for a Letnev seat with >= 2 trade goods, requesting it otherwise is an error; the UI asks each Letnev player before the round — types.ts and engine-design.md updated; cost if wrong: a flag shape.
Ruling: rerolled dice are logged (original roll entry plus a reroll entry) — cost if wrong: log noise.
Ruling: space cannon offense also fires when the defender has PDS but no ships: endMovement resolves it immediately (a roll entry) before moving to invasion — spec R4.1.1; cost if wrong: one branch in movement.ts.
Ruling: fix now as well: preserve unit order in applyCombatHits; trimCargo honours freeFighterSlots and re-checks the fleet pool for fighter_ii excess (Task 2 deferred minor); retreatTargets counts structures as presence; pre-combat stops early when a side is wiped; munitions on round 0 is rejected like an unaffordable request; a comment documents the salt scheme.
Task 3: fix round 1/5 dispatched to the original implementer.
Task 3: fix round 1/5 implemented (0676eb8..2250a37, 97/97). Scoped re-review dispatched.
Task 3: fix round 1/5 (10 addressed, 0 open; commits 0676eb8..2250a37)
Task 3: complete (commits 48e9a14..2250a37, review clean after fix round 1)
Task 3: minor (deferred): salt comment says three shooting owners, real max is two.
Task 4: implementer dispatched (base 2250a37). Note for Task 4: endMovement now takes a seed and resolves PDS-only space cannon offense; Move combatRound.munitions is per side.
Task 4: implemented (ef2c2d1..9c0eb3c, 108/108; base for review excludes the CLAUDE.md docs commit ef2c2d1). Review dispatched. Infantry II revival is a known deferral.
Task 4: review Needs fixes: Critical bombard after landing not blocked and no resolveControl; Important enumerators untested; minors (salt comment, land sets planetId when the landing party dies, shieldBlocks owner qualifier, rollGroup duplication, own-infantry bombardment test).
Ruling: bombardment is legal only before the first landing of the invasion (spec R4.3 step order); after a landing only Harrow (inside groundCombatRound) bombards — cost if wrong: one condition.
Task 4: fix round 1/5 dispatched to the original implementer.
Ruling: Task 5 runs in parallel in worktree ../mecatol-duel-wt-production (branch feat/engine-production off 9c0eb3c) while Task 4 fixes continue; merged back after review; Plan 3 is drafted in parallel — cost if wrong: a merge conflict in index.ts.
Task 5: implementer dispatched in worktree (base 9c0eb3c).
Task 5: implemented in worktree (9c0eb3c..6db696a, 117/117). Review dispatched.
Task 4: fix round 1/5 implemented (9c0eb3c..d58754b, 113/113). Scoped re-review dispatched.
Task 5: review Needs fixes: Critical fighter trim ignores capacity of ships produced in the same order; Important trim formula diverges from checkFleet (freeFighterSlots cap, infantry in space); minors (flagship uniqueness branch unreachable in test, two test names without R4.4).
Ruling: the fighter trim uses the exact checkFleet arithmetic on the tentative post-production space (new ships included), so a trimmed order always passes checkFleet — cost if wrong: one helper.
Task 5: fix round 1/5 dispatched to the original implementer (worktree).
Task 4: fix round 1/5 (8 addressed, 0 open; commits 9c0eb3c..d58754b)
Task 4: complete (commits ef2c2d1..d58754b, review clean after fix round 1)
Task 4: minor (deferred): bombard and landing-defense salts are fixed per invasion, so two planets bombarded in one invasion roll the same dice; scope by planet index in Plan 3 or the final review.
Task 5: fix round 1/5 implemented (6db696a..32ee846, 120/120). Scoped re-review dispatched. Implementer read "0 ship capacity" as "0 spare capacity" (accepted).
Task 5: fix round 1/5 (3 addressed, 0 open; 6db696a..32ee846)
Task 5: complete (worktree branch merged into feat/engine-tactical at 5e89c92, 120/120)
Task 5: minor (deferred): trimCargo still inlines the capacity formula instead of fleetExcess; reinforcement check runs on the untrimmed fighter count.
Task 6: implementer dispatched (base 5e89c92).
Task 6: implemented (5e89c92..7b75c2a, 130/130; smoke test found and fixed stranded-cargo bug in moveShips). Review dispatched. Plan 3 committed as docs.
Task 6: complete (commits 5e89c92..7b75c2a, review clean)
Task 6: minor (deferred): validateMove non-template branch is JSON-order sensitive (Plan 3 Task 6 replaces it); both-sides munitions never enumerated.
Final whole-branch review dispatched (merge-base 701d0c341b0626725f0f1f2b05c738f6fe342ab5, head d91c861).

## Plan 3 pre-flight rulings (2026-09-03)
Ruling: fix inverted token-total assertions in Plan 3 Task 5 (sheet 8 + 2 gained = 10 is legal, 9 is not).
Ruling: Diplomacy primary is always playable; without an eligible system it only readies planets (empty variant enumerated) — spec R3.2 no-deadlock; cost if wrong: one branch.
Ruling: R3.1 stands: unpicked strategy cards keep their accumulated trade goods across rounds; the status phase returns picked cards with bonus 0 and leaves unpicked cards untouched — cost if wrong: one map.
Ruling: Diplomacy's token freezes the opponent's ships in that system (TI4: ships cannot move out of a system holding your own token); no reinforcement pool is modelled in v1 — accepted.
Ruling: Warfare primary requires removing a token when the player has one on the board (gain 1 then); with none on the board the card is playable as redistribution only, no gain — cost if wrong: one condition.
Ruling: reuse the exported researchable, use productionCost for the Warfare secondary cost, delete readyInfluence; fix the vacuous or wrong tests (empty withPlayer patch, always-true assertions, weak .every, misleading comment, test count, bothSubmit reads pools from state); decideWinner uses controlsMecatol.
Ruling: accepted reinterpretations: automatic scoring in the status phase, score+tokens per player before reveal, no trade-post sale during a tactical action or secondary window, validateMove structural for templates only.
Ruling: Plan 3 Task 6 keeps tacticalFlow.test.ts and its local fill unchanged; fillTemplate is used by fullGame.test.ts only.
Plan 3 revised and committed (a3cec2b).
Final review: With fixes. Critical #1 endMovement PDS-only branch skips trimCargo; Important #2 trimCargo lets infantry take Space Dock II fighter slots; #3 munitions enumerated in round 0; #4 Mandate only for the attacker; #5 landing into a running ground combat; #6 try/catch hides internal errors; #7 responder identity design.
Ruling: fix #1..#6 now in one fix wave; also: reinforcement check after the trim, withdraw re-checks the fleet pool (destroy cheapest excess non-fighters), bombard salt scoped by bombarded.length, smoke-test invariants use checkFleet and hard-fail on internal errors, move log entry precedes its rolls, salt comment "two".
Ruling (#4): the Mandate goes to whichever seat wins a space combat in the Mecatol Rex system or in the opponent's home system, attacker or defender (spec R7) — cost if wrong: one branch.
Ruling (#5): land is rejected while a ground combat is pending and a planet can be landed on only once per invasion (spec R4.3 step order) — cost if wrong: one condition.
Ruling (#6): Result error branch gains optional `internal: true` for thrown errors; the smoke test fails on internal errors — cost if wrong: a type field.
Ruling (#7): v1 keeps the active-seat model; the defender's Munitions decision stays a per-side flag in the attacker's combatRound move (hot-seat asks both players before the round); Plan 3's secondary flips `active` to the responder; a proper responder move for online play is a Plan 4 item — cost if wrong: a later refactor of one move.
Ruling: spentInOneProductionThisRound records the post-Sarween cost (documented in the spec by Plan 3).
Ruling: Infantry II revival becomes an explicit Plan 3 task (pendingInfantry per player, placed at the start of that player's next turn).
Final fix wave dispatched (fix base a3cec2b).
Final fix wave: implemented (a3cec2b..bcf922e, 141/141). Note: the Plan 3 Task 7 doc edit was swept into fix commits 6ba5adf/06a8280 by the fixer. Remote origin (github.com/DespotB/mecatol-duel) appeared, presumably created by Despot; push after merge. Scoped re-review dispatched.
Final fix wave: re-review clean (11/11 addressed, 141/141). Minor (deferred): no test for a guardian win leaving the Mandate unearned.
Plan complete: feat/engine-tactical 701d0c3..bcf922e.
