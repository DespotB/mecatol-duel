# Hot-seat Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four issues the user raised after the first deploy: Space Dock I fighter slots, a HUD that docks to the viewport edges and scales its contents, played command tokens visible on the map, and a setup screen that matches the lobby mockup.

**Architecture:** The engine change is one helper plus spec text. The three UI tasks are independent: the docked HUD replaces the fixed 1440x900 block in `theme.css` with viewport-fixed regions scaled by CSS `zoom`; activation tokens are a new marker in `Tile.tsx`; the setup screen is a port of the lobby mockup's markup and CSS into `SetupScreen.tsx` plus a new `setup.css`. Tasks 2, 3 and 4 run in parallel worktrees, so each stays inside its own files.

**Tech Stack:** React 19, Vite, TypeScript strict, Vitest + @testing-library/react (jsdom), plain CSS (no Tailwind: the mockup is plain CSS and porting it verbatim is the most faithful path).

**Spec:** `docs/spec/game-rules.md` (rules), `notes/game-mockups/mecatol-duel-lobby.html` + `vault/.../Mockups/mecatol-duel-v2-lobby.png` (lobby design target, both under `~/Assistant/`).

## Global Constraints

- Engine: pure functions, immutable state, every roll logged, `Result` errors for rule rejections. No UI code in `src/engine`.
- Tests: `npm test` (Vitest) must pass; `npm run build` (tsc -b + vite) and `npm run lint` (oxlint) must be clean before every commit.
- Commit small and often, in English, no Claude co-author trailer. Never `rm -rf`; move discarded files to `~/Assistant/.trash/`.
- The visual design stays the TI Digital look: dark navy, gold hairlines, cut-corner panels, fonts Cinzel (display), Barlow Condensed (HUD labels), Barlow (body), already loaded in `index.html`.
- All unit and token art comes from `public/assets/` (sprites, tokens, tiles, factions). Missing art is copied from `~/Assistant/notes/game-mockups/assets/` (same upstream, same licence note).
- Screenshots for verification: run `npm run dev -- --port <PORT> --strictPort` in the worktree, then
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=W,H --screenshot=<file>.png "<url>"`.
  DEV-only demo routes: `http://localhost:<PORT>/?demo=1` (board, action phase draft), `?demo=1&panel=movement` (one activation in progress, tile `bereg` activated by the active seat), `?demo=1&panel=produce`, `?demo=1&panel=log`, `?demo=1&panel=handoff`. The setup screen is the plain root URL. Write screenshots under the worktree's `.superpowers/` directory (git-ignored), never commit them.

---

### Task 1: Space Dock I also grants the three free fighter slots

**Files:**
- Modify: `docs/spec/game-rules.md` (R4.4 paragraph)
- Modify: `src/engine/board.ts:82-86` (`freeFighterSlots`) and the doc comments at `board.ts:88-92`, `board.ts:158-162` that say "Space Dock II"
- Modify/Test: `src/engine/board.test.ts`, `src/engine/production.test.ts`, `src/engine/movement.test.ts` (wherever a test asserts that a dock without `space_dock_ii` grants no slots)

**Rule (verified against `data/reference/factions.json`, `units.space_dock.levels`):** both Space Dock I and Space Dock II carry "Up to 3 fighters in this system do not count against your ships' capacity." The earlier ruling that only Space Dock II grants the slots was wrong.

- [ ] **Step 1: Failing test.** In `src/engine/board.test.ts` add a test: a seat with only its starting techs (no `space_dock_ii`) and one own space dock on a planet in system X → `freeFighterSlots(state, seat, X) === 3`; the same seat with no dock in X → `0`; a dock owned by the other seat → `0`. Use the helpers in `src/engine/testUtils.ts` (`toActionPhase`, `withUnits`, or whatever the file exports; read it first).
- [ ] **Step 2: Run** `npx vitest run src/engine/board.test.ts` → the new test fails.
- [ ] **Step 3: Implement.** `freeFighterSlots` returns 3 when the seat has a space dock on any planet of the system, regardless of technology. Delete the `space_dock_ii` check. Update the three doc comments to "a space dock (I or II)".
- [ ] **Step 4:** Fix any existing test that encoded the old ruling (search `space_dock_ii` and "free" in `src/engine/*.test.ts`). A test that gave the seat `space_dock_ii` just to unlock the slots may keep the tech; a test that asserted 0 slots for Space Dock I flips to 3. Keep the trims and `checkFleet` behaviour otherwise unchanged.
- [ ] **Step 5: Spec.** In `docs/spec/game-rules.md` R4.4 replace "(Space Dock II: +4, and 3 fighters do not need capacity)" with "(Space Dock II: +4). A space dock, I or II, lets up to 3 fighters in its system ignore capacity" and change "(or Space Dock II slots)" to "(or the dock's 3 free slots)". Also fix the doc comment in `src/engine/production.ts` if it names Space Dock II for the slots.
- [ ] **Step 6:** `npm test && npm run build && npm run lint`, then commit: `fix(engine): Space Dock I grants the three free fighter slots too`.

---

### Task 2: Played command tokens on the map

**Files:**
- Modify: `src/ui/board/Tile.tsx`
- Modify: `src/ui/layout.ts` (one new constant `ACTIVATION_SPOT`)
- Modify: `src/ui/theme.css` (only the `/* map pieces */` section: add `.tile .acts` and `.tile .act` rules)
- Test: `src/ui/board/BoardMap.test.tsx`

**Interfaces:**
- Consumes: `System.activatedBy: Seat[]` (`src/engine/types.ts:28`), `tokenUrl(faction, 'command')` (`src/ui/art.ts:84`), `state.players[seat].faction`.

- [ ] **Step 1: Failing test.** In `BoardMap.test.tsx` render a state where `systems['bereg'].activatedBy = [0]` and assert an `<img data-testid="activation-bereg-0">` with `src` ending in `l1z1x_command.png` (seat 0's faction in the test fixture; read the fixture and use the faction it actually has) and `alt="Player 1 command token"` (use the seat's name from `state.players[seat].name`). A system with `activatedBy: []` renders no `activation-*` element. A system activated by both seats renders two tokens.
- [ ] **Step 2:** run the test file → fails.
- [ ] **Step 3: Implement.** In `Tile.tsx` after the fleet span render `<span className="acts" style={ACTIVATION_SPOT}>` with one `<img className="act" ...>` per seat in `system.activatedBy`, in seat order. Token size 34px wide (the sprite is a triangle with the faction symbol; keep its aspect ratio via `height="auto"`/CSS). `ACTIVATION_SPOT` in `layout.ts`: `{ left: 8, top: 8 }` within the tile (top-left corner, outside the planet art; check `PLANET_SPOTS` and `FLEET_ANCHOR` so it does not overlap planets or fleets; adjust to top-right if the top-left is taken on a tile and document why). Tokens sit above the hex art and below the fleet stacks (z-order via DOM order + `position:absolute`). CSS: `.tile .acts{position:absolute;display:flex;gap:4px;pointer-events:none}` `.tile .act{width:34px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.85))}`.
- [ ] **Step 4:** tests pass; `npm run build && npm run lint`.
- [ ] **Step 5: Screenshot check.** `?demo=1&panel=movement` at 1440x900: tile `bereg` shows the active seat's command token. Save to `.superpowers/activation.png`, confirm by viewing the image (Read tool) that the token is visible and does not cover a planet name plate.
- [ ] **Step 6:** commit `feat(ui): show played command tokens on activated systems`.

---

### Task 3: Docked HUD that scales its contents

**Files:**
- Modify: `src/ui/theme.css` (the `/* layout */` block lines 65-79, the `/* drawers and dialogs */` block lines 181-223, `.crash` lines 280-284). Do not touch the setup/landing/seat rules (lines 225-278, 286-287): another task moves them.
- Create: `src/ui/useViewportScale.ts`
- Modify: `src/ui/screens/BoardScreen.tsx` (wrap the centre area)
- Test: `src/ui/useViewportScale.test.ts`, extend `src/ui/screens/BoardScreen.test.tsx` if it exists (else add one focused test in `src/ui/hotseat.e2e.test.tsx`'s style; read the harness in `src/ui/test/harness.tsx`)

**The user's requirement, verbatim (German):** "Das Dunkle [die untere Leiste] sollte immer unten sein. Die zwei seitlichen sollten immer seitlich sein. Und einfach nur die Elemente drinnen kleiner werden bzw. größer, wenn ich rein zoome. Sie sollten oben und unten gebunden sein, und [die obere Leiste] sollte auch fix wie so eine Nav-Bar immer oben sein und immer bis zum Ende reichen." Today the whole HUD is a fixed 1440x900 block centred on the page; zooming the browser out leaves it floating in empty space.

**Design:**
- Design coordinates stay 1440x900. A scale factor `k = clamp(0.55, min(vw/1440, vh/900), 1.25)` is computed from `window.innerWidth/innerHeight` in `useViewportScale()` (listens to `resize`, returns `{ k, s }`) and written as CSS custom properties `--k` and `--s` on `.app` via inline style.
- Regions become viewport-fixed and scaled with the CSS `zoom` property (standard in Chrome, Safari, Firefox 126+): a zoomed fixed region with `left:0;right:0` still spans the full viewport width, and its 118px design height renders as 118·k real pixels. Exactly the requested behaviour: bars docked at the edges, contents scaled.
  - `.app{position:fixed;inset:0}` (no zoom, no width/height).
  - `.topbar{position:fixed;top:0;left:0;right:0;height:118px;zoom:var(--k)}` (keep its flex layout; the player blocks sit at the two ends and the strategy strip/objectives centre; with `justify-content` so extra width goes to the gaps, not to the right edge).
  - `.bottombar{position:fixed;bottom:0;left:0;right:0;height:84px;zoom:var(--k)}`.
  - `.colL{position:fixed;left:8px;top:126px;bottom:92px;width:234px;zoom:var(--k)}`, `.colR` mirrored with `right:8px`. The panel inside fills the column height (`.colL>.cut{height:100%}` already applies via `.box>.cut`? check; add `overflow:auto` on the panel's `.in` so a short viewport scrolls the panel instead of clipping).
  - Centre stage: new `.stage{position:fixed;left:250px;right:250px;top:118px;bottom:84px;zoom:var(--k);display:flex;align-items:center;justify-content:center;overflow:hidden}` wrapping `BoardMap`, the tactical/strategic flows, the scrim, drawers, dialogs and the log panel. Inside it `.map{position:relative;width:940px;height:698px;zoom:var(--s)}` where `s = min((vw/k - 500)/940, (vh/k - 202)/698)` clamped to `[0.5, 2]`, so the board fills the stage on wide or tall viewports (`--s` is the second value the hook returns).
  - Overlays move from page coordinates to stage coordinates: `.scrim{position:absolute;inset:0}`; `.drawer{position:absolute;left:50%;transform:translateX(-50%);width:min(940px,calc(100% - 16px))}`, `.drawer.bottom{bottom:0}`, `.drawer.full{top:8px;bottom:8px}` with `overflow:auto` on `.drawer.full .in` and the tech columns' `max-height` replaced by `max-height:calc(100% - 40px)` or removed; `.dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(700px,calc(100% - 16px))}`; `.logpanel{position:absolute;left:0;top:8px;bottom:8px;width:min(520px,60%)}`. Keep `.overlay` (handoff) as is: it is `position:fixed;inset:0` and unscaled by design; give its content `zoom:var(--k)` only if the hook's value is available there (it is fine to leave it unscaled).
  - `.crash{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}` (no fixed width).
- No horizontal page scrollbar at any viewport from 1024x640 up to 2560x1440 and at browser zoom 50%–200%. Nothing in the HUD may overlap the board's tiles at 1440x900 (that is the reference layout and must look identical to today's at that size).

- [ ] **Step 1: Failing hook test.** `useViewportScale.test.ts`: mock `window.innerWidth/innerHeight` (e.g. `Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })`), render the hook with `renderHook` from @testing-library/react, assert `{k:1, s:1}` at 1440x900; `k=0.8, s=1` at 1280x720 (min(0.889,0.8)=0.8; stage 1600−500=1100 → 1100/940=1.17, 900−202=698 → 698/698=1 → s=1); `k=1.25` at 2560x1440 and `s` = min((2048−500)/940, (1152−202)/698) = min(1.647, 1.361) = 1.36 (assert with `toBeCloseTo(1.361, 2)`); `k=0.55` floor at 640x400. Dispatch a `resize` event and assert the value updates. Round `k` and `s` to 3 decimals.
- [ ] **Step 2:** run → fails (module missing).
- [ ] **Step 3: Implement hook** with `useState` + `useEffect` resize listener (guard `typeof window === 'undefined'` → `{k:1,s:1}`).
- [ ] **Step 4: Restructure BoardScreen.** `.app` gets `style={{ '--k': k, '--s': s } as CSSProperties}`; move `BoardMap`, the tactical flows fragment, the `flows-4b` div, and `LogPanel` inside `<div className="stage" data-testid="stage">`; `TopBar`, both `SidePanel`s and `ActionBar` stay direct children of `.app`. Check every flow component for its own positioning classes (`.drawer`, `.dialog`, `.scrim`, `.logpanel`) and that none sets inline page coordinates (grep `left:` / `top:` in `src/ui/flows/*.tsx` and `LogPanel.tsx`; fix any that do to the new scheme).
- [ ] **Step 5: CSS** as designed. Also review `src/ui/hud/TopBar.tsx` for hard-coded widths that assumed 1440 (`.pblock` width 258, `.hintbox` 390): allowed to stay, but the bar must not overflow at k-scaled width for any viewport ≥ 1024 wide (at 1024x640, k=0.711, the zoomed bar is 1440 design px wide: same as today, fine).
- [ ] **Step 6: Tests.** Existing UI tests (`npm test`) must keep passing; add one RTL assertion that `.stage` contains the board (`tile-mecatol`) and the `.app` style carries `--k`.
- [ ] **Step 7: Screenshot matrix** (demo route `?demo=1&panel=produce` so a drawer is open, and plain `?demo=1`): 1440x900, 1920x1080, 1280x720, 1024x640, 2560x1440. Save as `.superpowers/hud-WxH.png`, view each (Read tool) and confirm: top bar spans the full width at the top, bottom bar at the bottom spanning full width, side panels at the edges, board centred and not overlapping, drawer inside the stage, no page scrollbar. Fix and re-shoot until all five pass. Also emulate browser zoom by shooting 1440x900 with `--force-device-scale-factor=1` at window 2880x1800 (equivalent to 50% zoom) and 720x450 (200% zoom): the bars must still dock.
- [ ] **Step 8:** `npm test && npm run build && npm run lint`; commit in slices: `feat(ui): viewport scale hook`, `feat(ui): dock the HUD to the viewport edges and scale its contents`, `fix(ui): stage-relative drawers and dialogs`.

---

### Task 4: Setup screen matches the lobby mockup

**Files:**
- Create: `src/ui/setup.css` (imported from `SetupScreen.tsx`)
- Modify: `src/ui/screens/SetupScreen.tsx` (rewrite the markup to the mockup's structure)
- Modify: `src/ui/theme.css`: delete the blocks `/* setup and game over */` (`.setup`, `.hero`, `.title`, `.tagline`), `/* landing menu, ported from the lobby mockup */` (`.menu…`, `.box…`, `.btn.ghost…`), `.seats/.seat/.seat-top/.faction/.row`, `/* seat fleet row */` (`.units/.unit/.swatches/.sw/.chosen`) and `.setup-foot/.clockfield` (lines 225-278 and 286-287) and move them, adapted, into `setup.css`. Leave `.crash*` (lines 280-284) and everything above line 225 untouched: another task edits those.
- Copy assets: `~/Assistant/notes/game-mockups/assets/cards/pa_tech_techicons_biotic_rdy.png` and `pa_tech_techicons_warfare_rdy.png` → `public/assets/cards/` (plus `..._propulsion_rdy.png` and `..._cybernetic_rdy.png` if present upstream, for the four tech colours). Check `public/assets/factions/` already has `l1z1x.png`, `letnev.png`, `leader_l1z1x_commander.png`, `leader_letnev_commander.png` (it does) and `public/assets/tokens/` the command tokens (it does).
- Test: `src/ui/screens/SetupScreen.test.tsx` (extend or create; the existing e2e test `src/ui/hotseat.e2e.test.tsx` drives the setup screen by test ids: keep every existing `data-testid` working: `setup-screen`, `btn-resume`, `landing-hotseat`, `btn-play-device`, `landing-online`, `btn-create-online`, `landing-join`, `btn-join-code`, `seat-position-N`, `seat-name-N`, `seat-faction-N`, `colour-N-<colour>`, `chosen-colour-N`, `seat-N-fleet`, `seat-N-fleet-<type>`, `seat-N-fleet-<type>-count`, `btn-swap-factions`, `minutes`, `btn-start`).

**Design target:** `~/Assistant/notes/game-mockups/mecatol-duel-lobby.html` rendered as `~/Assistant/vault/Privat/Hobbys & Freizeit/Gaming/Spielideen/Mockups/mecatol-duel-v2-lobby.png` (view the PNG first). Port the mockup's CSS and markup as directly as possible (same class names are fine, prefixed where they would clash with `theme.css`). The user's words: "Hintergrund ist anders, Schriften sind anders, die Container sind anders, es fehlen Sachen." Everything visible in the PNG appears in the setup screen, adapted to hot-seat as follows:

- Hero: "MECATOL DUEL" in gold Cinzel with the thin gold rule and diamond under it, tagline in Barlow Condensed tracking as in the mockup. Background: the mockup's `.space` (starfield, nebula gradients, the faint orbit arcs, the planet limb at the bottom right) scoped as `.setup .space …` in `setup.css` so the board screen's background stays untouched.
- Three menu boxes exactly as in the mockup: "Play on this device" (two faction command tokens as the icon, text "Pass the tablet, chess clock 15 minutes each." where 15 is the live minutes value, button "Play hot-seat" scrolls to the seats, note "No account, no network"); "Create online lobby" (crosshair icon, text as in the mockup, gold button "Create lobby" disabled with the note "Coming with online play"); "Join with a code" (input with placeholder "K7X2QP" style and a "Join" button, both disabled, same note).
- Lobby panel: tab reads "HOT-SEAT" (no code). Top row: left label "MODE" with the field showing "This device, pass it between turns"; right status "● BOTH SEATS ON THIS DEVICE  |  2 OF 2 SEATS TAKEN".
- Two seat cards as in the mockup (gold-framed portrait with the faction symbol below it, faint faction watermark at the right, seat label "SEAT 1"/"SEAT 2" with chips "NORTH"/"SOUTH" and "FACTION CHOSEN"). The player name is an input styled like the mockup's big name (Barlow 30px, white, no visible border until focus). Faction name in gold Cinzel. Rows: COLOUR (eight swatches, the chosen one ringed, colour name in the chosen colour's tint), STARTING FLEET (sprites with count badges, then the text line "Super-Dreadnought I, Carrier, 3 Fighters, 5 Infantry, PDS, Space Dock" built from the faction data), STARTING TECHS (tech icon per colour + name). Portraits: `leader_l1z1x_commander.png` / `leader_letnev_commander.png`, symbols `l1z1x.png` / `letnev.png`.
- Footer row: the seven-hex map preview (the mockup builds it from tile images: port it), MAP "Bereg Standoff" + "7 systems, Mecatol Rex in the centre, home systems north and south", CLOCK with the minutes input inline ("15 minutes per player", "Chess clock, runs only on your turn"), TARGET "7 victory points or 6 rounds" + "Most points after round 6 wins the duel", and the big gold button "PLAY HOT-SEAT" (enabled; `btn-start`). "Swap factions" becomes a small quiet button in the lobby panel's top row (right of the MODE field). "Resume the saved game" stays in the hero when a session exists.
- Credits line at the bottom: "Fan project. Twilight Imperium and its artwork belong to Fantasy Flight Games. Unit, tile and card images via AsyncTI4."
- Responsive: `.setup{max-width:1440px;margin:0 auto;padding:52px 80px 40px}`; below 1200px the three menu boxes stack and the two seat cards stack; nothing overflows horizontally.

- [ ] **Step 1:** View the PNG and read the mockup HTML end to end. Copy the tech icons.
- [ ] **Step 2: Tests first.** Add/extend `SetupScreen.test.tsx`: renders the tab text "Hot-seat", both seat cards with portraits (`img[alt="L1Z1X Mindnet portrait"]` etc.), the fleet text line for seat 0 equals "Super-Dreadnought I, Carrier, 3 Fighters, 5 Infantry, PDS, Space Dock" (derive the expected string from `FACTIONS['l1z1x'].startingUnits`; if the flagship-less starting fleet differs, assert the derived string), the map name "Bereg Standoff", and that `btn-start` starts a game (existing e2e covers it). Run → fails.
- [ ] **Step 3: Implement** `setup.css` + the new markup.
- [ ] **Step 4:** `npm test` (all, including the e2e that drives the setup screen) `&& npm run build && npm run lint`.
- [ ] **Step 5: Screenshot comparison** at 1440x900 (and 2880x1800 with `--force-device-scale-factor=2` for a retina shot): `.superpowers/setup-1440.png`. View it next to the mockup PNG and list every visible difference (fonts, spacing, colours, missing elements); fix and re-shoot until the only differences are the intended hot-seat adaptations. Also shoot 1024x900 to confirm the stacked layout.
- [ ] **Step 6:** commit in slices: `chore(assets): tech icons for the setup screen`, `feat(ui): setup screen ported from the lobby mockup`, `style(ui): move setup styles into setup.css`.
