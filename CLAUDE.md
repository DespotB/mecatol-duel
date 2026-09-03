# Mecatol Duel

Two-player Twilight Imperium 4 distillation. Pure TypeScript rules engine in `src/engine/` and `src/data/`, React UI on top, Vitest tests next to the modules.

## Rules for every change

- Commit after every logical step, in small commits: the failing test, the implementation, each fix, each doc change gets its own commit. Never bundle several tasks into one commit. Pushing may be batched; committing may not.
- Conventional commit messages (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`), English only.
- Before a commit that touches `src/`: `npm test`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint` must be clean.
- Engine and data modules: strict TypeScript, no `any`, no non-null assertions, no React/DOM/Node imports, never mutate an input `GameState`, all randomness from the seed passed in, every dice roll logged.
- The spec in `docs/spec/game-rules.md` is the binding authority; plans in `docs/superpowers/plans/` argue from it. Rulings taken during execution are recorded in the plan's `.ledger.md`.
