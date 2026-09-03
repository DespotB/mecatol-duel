# Six Trade Posts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two anonymous trade posts with six named ones, each with its own model and ability, of which every game rolls two, and make the connection between a post and the systems it serves visible on the board.

**Architecture:** The engine gains a post table and one move per ability, plus the rolled pair in the game state. The UI draws the rolled posts with their rendered models, wires each to its two systems with a hyperlane, and offers the abilities in the component panel. The rules page documents all six with their pictures.

**Tech Stack:** TypeScript engine (pure, seeded RNG), React 19 + Vite, Vitest + @testing-library/react.

**Spec:** `docs/spec/trade-posts.md` — binding. Where this plan and the spec disagree, the spec wins.

## Global Constraints

- Engine stays pure and deterministic: same seed, same posts, same replay. Rolling the posts uses the setup RNG with its own documented salt, never `Math.random`.
- Rule rejections are `Result` errors; exceptions mean a bug. Every roll and every ability use is logged.
- The engine is time-free: the Vandel Bulk Tanker's three minutes are applied by the UI when it sees the move, never by the engine.
- `npm test && npm run build && npm run lint` clean before every commit. Small commits, English messages, no Claude co-author trailer.
- Art: the six renders live in `/Users/despot_b/Assistant/notes/game-mockups/tradeposts/post-*.png` and are copied into `public/assets/posts/` under the post's id. They are transparent PNGs about 500 to 700 px wide.

## Interfaces produced in Task 1, consumed by Tasks 2 and 3

```ts
// src/data/posts.ts
export type PostId = 'sarnex' | 'tessik' | 'orrun' | 'kesh' | 'vandel' | 'dromm'
export type PostAbility = 'none' | 'techExchange' | 'clearingHouse' | 'charter' | 'layover' | 'refit'
export interface PostDef {
  id: PostId
  name: string            // "Sarnex Wheel"
  kind: 'station' | 'ship'
  commodityLimit: number  // 4 for sarnex, else 2
  ability: PostAbility
  abilityName: string     // "Technology exchange", empty for sarnex
  abilityText: string     // one sentence, the same wording the rules page uses
  art: string             // '/assets/posts/sarnex.png'
}
export const POSTS: Record<PostId, PostDef>
export const POST_IDS: readonly PostId[]

// src/engine/types.ts
interface GameState { …; posts: { west: PostId; east: PostId }; postAbilityUsed: { west: boolean; east: boolean } }
type Move = … | { type: 'postAbility'; post: 'west' | 'east'; params: PostAbilityParams }
interface PostAbilityParams {
  techId?: string; takeTechId?: string          // techExchange
  planets?: string[]; influencePlanets?: string[] // clearingHouse: planets paying resources, planets paying influence
  pool?: 'tactic' | 'fleet' | 'strategy'         // charter, layover
  give?: number[]; take?: UnitType               // refit: unit ids given, unit type taken
}

// src/engine (re-exports, read-only queries for the UI)
export function postDef(state: GameState, post: 'west' | 'east'): PostDef
export function postAbilityOptions(state: GameState, seat: Seat, post: 'west' | 'east'): PostAbilityParams[]
```

---

### Task 1: The posts in the engine

**Files:**
- Create: `src/data/posts.ts`, `src/engine/postAbilities.ts`
- Modify: `src/engine/types.ts`, `src/engine/setup.ts` (roll the pair), `src/engine/componentActions.ts` (the commodity limit now comes from the post), `src/engine/legalMoves.ts`, `src/engine/index.ts`, `src/data/map.ts` if the linked systems live there
- Modify: `docs/spec/game-rules.md` R8 (point it at `docs/spec/trade-posts.md` and drop the fixed "up to 2")
- Test: `src/engine/postAbilities.test.ts` (new), `src/engine/componentActions.test.ts`, `src/engine/setup.test.ts`, `src/engine/fullGame.test.ts`

- [ ] **Step 1: Failing test** in `setup.test.ts`: `createGame` with a fixed seed puts two different `PostId`s in `state.posts`, the same two on a replay of that seed, and a different seed can produce a different pair (assert over a handful of seeds that at least two distinct pairs appear). Run → fails.
- [ ] **Step 2:** `src/data/posts.ts` with the six definitions exactly as the spec's table lists them, and the roll in `setup.ts` using a documented salt. Commit.
- [ ] **Step 3: Failing test** in `componentActions.test.ts`: at a Sarnex Wheel a player may sell 4 commodities in one go, at any other post only 2, and the existing once-per-round-per-player rule still holds. Implement by reading `commodityLimit` off the rolled post instead of the hard-coded 2. Commit.
- [ ] **Step 4:** The `postAbility` move, one branch per ability, in `src/engine/postAbilities.ts`, dispatched from `index.ts`. Each branch validates its own parameters and rejects with an `R8:` message. The shared preconditions (your turn, no tactical action, no open secondary, not passed, you control a planet in a linked system, `postAbilityUsed[post]` is false, the post actually has that ability) live in one guard used by all of them. Every use sets `postAbilityUsed[post] = true` and logs an `info` entry naming the post and the ability. Commit.
- [ ] **Step 5: One test per ability**, red first, each asserting the effect and one rejection:
  - **techExchange:** returning `neural_motivator` (green, tier 1) for `antimass_deflectors` (blue, tier 1) works; same colour is rejected; a different tier is rejected; a unit upgrade or faction technology on either side is rejected; a technology the player does not own is rejected.
  - **clearingHouse:** exhausting two ready planets for 3 trade goods works and the planets end exhausted; a planet paying both resources and influence is rejected; more than 3 trade goods is rejected; an already exhausted planet is rejected.
  - **charter:** a token from the fleet pool becomes 4 trade goods; an empty pool is rejected.
  - **layover:** a token from any pool is spent, the state changes nothing else, and the log entry names the post and the seat (the clock is the UI's business).
  - **refit:** two carriers in `starpoint` become one dreadnought in `starpoint`; a ship whose cost exceeds what was returned is rejected; fighters or infantry in `give` are rejected; a refit that would break the fleet pool is rejected; ships in a system that is not linked to the post are rejected.
  Commit per ability or in two batches, never red.
- [ ] **Step 6:** `postAbilityOptions` enumerates what the seat could legally do at that post right now, in the shape the UI needs, and `legalMoves` offers a `postAbility` move whenever at least one option exists. `fullGame.test.ts` drives it like every other move; keep the seeds finishing and the replay deterministic, retuning the coverage tail if a move kind falls out. Commit.
- [ ] **Step 7:** Spec edit, full `npm test && npm run build && npm run lint`, commit.

---

### Task 2: The posts on the board

**Files:**
- Copy: the six renders into `public/assets/posts/<id>.png` (from `/Users/despot_b/Assistant/notes/game-mockups/tradeposts/`, renamed: `post-1-ring.png` → `sarnex.png`, `post-2-refinery.png` → `tessik.png`, `post-3-port.png` → `orrun.png`, `post-4-freighter.png` → `kesh.png`, `post-5-tanker.png` → `vandel.png`, `post-6-hauler.png` → `dromm.png`)
- Modify: `src/ui/board/TradePosts.tsx`, `src/ui/layout.ts` (post positions and the lane geometry), `src/ui/theme.css` (`/* map pieces */` only), `src/ui/flows/ComponentPanel.tsx` (offer the abilities)
- Test: `src/ui/board/BoardMap.test.tsx`, `src/ui/flows/Component.test.tsx` or the file that covers the component panel

- [ ] **Step 1:** Copy and downscale the renders to a sensible board size (the model should read at about 150 to 190 px wide; keep the source aspect ratio and the transparency), commit as its own slice.
- [ ] **Step 2: Failing test:** the board renders the west post's name and art from `state.posts.west`, and a different rolled pair renders different art. Implement: the post panel shows the render, the name, the commodity limit and the ability line, and says "used this round" when `postAbilityUsed` is set. Commit.
- [ ] **Step 3: The hyperlanes.** Draw a lane from each post to each of its two linked tiles: an SVG layer behind the tiles, one path per link, in the game's lane style (thin, cool blue, a soft glow, a subtle dash that reads as a route rather than a border). A lane whose system the acting seat controls a planet in is lit; the other stays dim. Anchor the paths on the post's edge and the tile's centre, computed from `TILE_POS` and the post positions in `layout.ts`, never hard-coded pixels. Test that both lanes exist for each post and carry the lit class only when the seat qualifies. Commit.
- [ ] **Step 4: The ability in the component panel.** The existing trade entry becomes two: "Sell commodities" with the post's own limit, and the post's special ability with its name. Each ability gets the controls it needs: a technology picker for the exchange (the drawer already exists), a planet picker for the clearing house (reuse `PayRow`), a pool picker for charter and layover, and a ship picker for the refit. Disabled with a reason when the ability is used up or out of reach. Commit.
- [ ] **Step 5: The clock bonus.** `src/ui/store.tsx` adds 180000 ms to the acting seat's clock when it applies a `postAbility` move with `ability === 'layover'`, and only then. Test it in the store's own test. Commit.
- [ ] **Step 6:** Screenshots at 1440x900 and 1920x1080 of a board whose posts are rolled to two different kinds, with `--virtual-time-budget=8000`; view them, check the lanes read as lanes and the models as models, iterate. Commit.

---

### Task 3: The posts in the rules

**Files:**
- Modify: `src/ui/screens/RulesScreen.tsx`, `src/ui/rules.css`
- Test: `src/ui/screens/RulesScreen.test.tsx`

- [ ] **Step 1: Failing test:** the rules page has a "Trade posts" section naming all six posts and their abilities, each with its picture, and states that every game rolls two of them. Run → fails.
- [ ] **Step 2:** Write the section: one row per post with the render at about 120 px, the name, the commodity limit and the ability sentence, taken from `POSTS` so the page cannot drift from the engine. Above them one short paragraph: two posts per game, one west and one east, rolled at setup; the commodity sale is once per round per player; the special ability is once per round for whoever takes it first. Update the existing trade post bullet in "What is different from Twilight Imperium" to point at the new section. Commit.
- [ ] **Step 3:** Screenshot the section at 1440 and at 420 css px wide, view both, fix what does not read, commit.
