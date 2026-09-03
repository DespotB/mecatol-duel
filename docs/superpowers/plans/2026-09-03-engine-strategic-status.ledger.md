# SDD ledger — plan: docs/superpowers/plans/2026-09-03-engine-strategic-status.md

Ruling: work on branch feat/engine-strategic (created from main after the Plan 2 merge); pre-flight scan was delegated (results and rulings recorded in the Plan 2 ledger under "Plan 3 pre-flight rulings" and applied to the plan text before execution) — cost if wrong: a missed conflict surfaces in a task review.
Carried from Plan 2 final review (deferred): bombard/landing salts scoped per planet (done for bombard); validateMove JSON comparison replaced in Task 6; movableShips Gravity Drive over-enumeration untested; `expect(x).toBe(wiped ? A : B)` style assertions in combat/invasion tests; spentInOneProductionThisRound records post-Sarween cost (Task 1 writes it into the spec).
Ruling: Plan 3 Tasks 1 and 7 run in parallel worktrees (feat/engine-objectives, feat/engine-revival, both off bcf922e) while the Plan 2 re-review finishes; merged into feat/engine-strategic after review — cost if wrong: a merge conflict in actionPhase.ts.
Task 1 and Task 7: implementers dispatched (base bcf922e).
Task 7: NEEDS_CONTEXT (brief assumes Tasks 2-6 merged). Ruling: implement the core revival mechanics now with the tests that need no statusPhase/strategic infrastructure (tests 1-3); the remaining tests (round boundary, secondary window) are added as Task 7b after Tasks 2-6 merge — cost if wrong: one extra small task.
Task 1: implemented in worktree (bcf922e..c40b17f, 151/151). Review dispatched.
Task 1: complete (bcf922e..c40b17f, review clean, merged into feat/engine-strategic at 9e758fe)
Task 1: minor (deferred): scoreObjective log fallback attributes unknown ids to the Mandate text.
Task 2: implemented in worktree (2138dc1..7d72118, 154/154). Review dispatched.
Ruling: integration branch feat/engine-int = feat/engine-strategic (Task 1) + feat/engine-cards (Task 2, review pending); Tasks 4 and 5 start in worktrees off it now; Task 3 (same file as Task 2) waits for the Task 2 review — cost if wrong: merge fixes later.
Task 7: implemented core in worktree (bcf922e..09b7d0b, 145/145; Task 7b deferred). Review dispatched.
Task 2: complete (2138dc1..7d72118, review clean, merged into feat/engine-strategic at e850f03)
Task 2: minor (deferred): Leadership ignores trade goods as influence (ruling: Task 3 adds params.tradeGoods as influence, 1 each); Trade secondary after shareWithOpponent is a no-op (Task 6 must not enumerate it); untested LRR 30.2 duplicate-token branch; effect log entries for cards.
Ruling: component actions (research, shipyard, tradePost) must reject while pendingSecondary is set (message sent to the Task 4 implementer).
Task 3: implementer dispatched (worktree off feat/engine-int).
Task 7: complete (core; bcf922e..09b7d0b, review clean, merged into feat/engine-strategic). Task 7b pending after Tasks 3-6.
Task 4: implemented in worktree (e80e745..98ae2d3, 169/169). Review dispatched (must check the pendingSecondary guard ruling).
Task 5: implemented in worktree (e80e745..3af656d, 174/174). Review dispatched.
Task 4: extra commit ca7eea7 (window tests) after the review package; include in the merge.
Task 4: review Needs fixes (shipyard window test missing) — already addressed by ca7eea7 (verified: per-move open-window tests present, suite green). Task 4: complete (e80e745..ca7eea7, merged into feat/engine-strategic at a1aa29d)
Task 3: implemented in worktree (08a569d..6de18a5, 177/177). Review dispatched.
Task 5: review Approved with 1 Important (inferred any via Object.fromEntries on the token-removal line) + minors; fix round 1/5 dispatched.
Task 3: complete (08a569d..6de18a5, review clean, merged into feat/engine-strategic at b377901)
Task 3: minor (deferred): warfareSecondary relies on seat === state.active (add a guard); payCost has no integer check; imperialPrimary duplicates scoreable logic; two test assertions not isolating their claim.
Task 5: fix round 1/5 implemented (3af656d..e5838ad, 176/176 in worktree). Scoped re-review dispatched.
Task 5: fix round 1/5 (5 addressed, 0 open; 3af656d..e5838ad)
Task 5: complete (merged into feat/engine-strategic; conflicts in index.ts and engine-design.md resolved by the controller, both additive; exhaustive-default type fix 5e4d31c)
Task 6 and Task 7b: implementers dispatched (worktrees off feat/engine-strategic).
Task 7b: implemented in worktree (5e4d31c..8639ee1, 199/199). Review dispatched.
Task 6: implemented in worktree (5e4d31c..ba1ed7a, 202/202 incl. 10-seed full games). Review dispatched.
Task 7b: complete (5e4d31c..8639ee1, review clean, merged into feat/engine-strategic at 8639ee1)
Task 6: review Needs fixes (Trade secondary no-op not suppressed; smoke invariants hand-rolled instead of checkFleet); fix round 1/5 dispatched.
Task 6: fix round 1/5 implemented (ba1ed7a..c636c1c, 203/203). Scoped re-review dispatched.
Task 6: fix round 1/5 (3 addressed, 0 open; ba1ed7a..c636c1c)
Task 6: complete (merged into feat/engine-strategic at 229765c)
All tasks complete. Final whole-branch review dispatched (merge-base 2138dc1).
Final review: With fixes. C1 payCost accepts NaN/strings; I1 Warfare redistribution can shrink the fleet pool below the board; I2 status-phase progress guard is dead code; I3 smoke test proves termination not coverage; I4 move log lacks the seed; I5 passed players resolving secondaries is unremarked in the spec.
Ruling (I5): a player who has passed may still resolve secondary abilities (TI4 LRR 34: passing ends your actions, not your secondaries); spec game-rules.md R3.2 gets an explicit sentence — cost if wrong: one line in legalMoves and the spec.
Ruling (I2): GameState gains `statusSubmitted: Seat[]`; the status move rejects a repeat submission and closes the phase when both seats are in; types.ts and engine-design.md updated — cost if wrong: a field.
Ruling (I4): the move log entry gains `seed: number` — cost if wrong: a field.
Ruling (I1): a Warfare redistribution that leaves any of the player's systems failing checkFleet is rejected — cost if wrong: one check.
Final fix wave dispatched (fix base 229765c).
Final fix wave: implemented (229765c..aea13a6, 221/221). Coverage: 17 of 19 move kinds and all cards reached in 10 seeds; unreachable by random play (unit-tested): research via Inheritance, shipyard, revival return, Mecatol capture. Scoped re-review dispatched.
Final fix wave: re-review clean (7/7 addressed, 221/221). Note: the in-progress Plan 4 doc got swept into fix commits c5b3e60 and 4eba5f6 by the fixer; final version committed separately.
Plan complete: feat/engine-strategic 2138dc1..aea13a6.
