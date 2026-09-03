# Mecatol Duel, game rules v0.2 (engine specification)

Two-player distillation of Twilight Imperium 4th edition (base game rules, no Prophecy of Kings). First version: L1Z1X Mindnet vs Barony of Letnev. Verified faction, unit, technology and tile data live in `data/reference/*.json`; verbatim rule excerpts in `docs/spec/lrr-excerpts.md`. Where this document and the reference data disagree, this document wins for the duel.

## 1. Components

- Map "Bereg Standoff", seven hexes in a flower:

| Position | System id | Tile art | Planets (res/inf) | Traits |
| --- | --- | --- | --- | --- |
| N | `home-n` | 06 [0.0.0] | [0.0.0] 5/0 | L1Z1X home |
| NE | `bereg` | 35 | Bereg 3/1, Lirta IV 2/3 | alpha wormhole |
| NW | `sakulag` | 44 asteroid field | Sakulag 2/1 | beta wormhole, asteroid field |
| C | `mecatol` | 18 | Mecatol Rex 1/6 | guardian fleet |
| SE | `quann` | 42 nebula | Quann 2/1 | beta wormhole, nebula |
| SW | `starpoint` | composed | Starpoint 3/1, Centauri 1/3 | alpha wormhole |
| S | `home-s` | 10 Arc Prime | Arc Prime 4/0, Wren Terra 2/1 | Letnev home |

- Adjacency: hex neighbours (centre touches all six; ring tiles touch their two ring neighbours and the centre), plus wormholes: alpha links `bereg` and `starpoint`, beta links `sakulag` and `quann`.
- Anomalies: asteroid field (`sakulag`): ships may move into or through it only if the player owns Antimass Deflectors. Nebula (`quann`): a ship that moves into the nebula must end its movement there; a ship starting its move in a nebula has move value 1; the defender gets +1 to combat rolls in a space combat there.
- Units: infantry, fighter, destroyer, cruiser, carrier, dreadnought (L1Z1X: super-dreadnought), war sun, flagship, PDS (L1Z1X starting unit only), space dock. Stats from `data/reference/factions.json` (`units`) and `techs.json` (`unit_upgrades`, `faction_extras`).
- Strategy cards: Leadership 1, Diplomacy 2, Trade 5, Warfare 6, Technology 7, Imperial 8. Texts from `factions.json` (`strategy_cards`), with the duel changes in section 6.
- Command tokens: three pools (tactic, fleet, strategy). Start 3 / 3 / 2. Fleet pool limits non-fighter ships per system (Letnev Armada: +2).
- Trade goods and commodities (commodity value 2 for both factions).
- Objectives: one public objective revealed per round (rounds 1 to 6), worth 1 VP each, plus the Mandate (section 7).

## 2. Setup

1. Seats: seat 0 north (home-n), seat 1 south (home-s). Each seat has a faction, a colour (red, blue, green, yellow, purple, black, orange, pink; both seats distinct) and a name.
2. Starting units on the home system as printed: L1Z1X 1 super-dreadnought, 1 carrier, 3 fighters, 5 infantry, 1 space dock, 1 PDS on [0.0.0]. Letnev 1 dreadnought, 1 carrier, 1 destroyer, 1 fighter, 3 infantry, 1 space dock (Arc Prime); infantry split 2 Arc Prime, 1 Wren Terra; the dock on Arc Prime.
3. Starting technologies: L1Z1X Neural Motivator, Plasma Scoring. Letnev Antimass Deflectors, Plasma Scoring.
4. Command tokens 3/3/2, trade goods 0, commodities 2 of 2, all home planets ready and controlled.
5. Mecatol Rex is neutral; place the first guardian fleet (section 5).
6. Speaker: seat 0 in round 1 (the UI may randomise before creating the game); the speaker alternates every round.
7. Reveal public objective 1.

## 3. Round structure

### 3.1 Strategy phase
Snake draft: speaker picks one card, the other player picks two, the speaker picks the last. The two remaining cards each get one trade good placed on them; the next player to pick such a card gains its trade goods. Initiative order for the action phase is by the lowest card number each player holds.

### 3.2 Action phase
Players alternate turns in initiative order. On a turn the active player performs exactly one of: tactical action, strategic action, component action, pass. After passing, a player takes no more turns this round; the other player continues until they also pass. A player may not pass while they still hold an unused strategy card (they must play it first). A player who has passed may still resolve the secondary ability of a strategy card the opponent plays, because answering a card is not a turn (TI4 rule). A player who has passed may not trade at a trade post, because trading needs a turn of their own (section 8).

Tactical action (a system that already contains one of your command tokens cannot be activated, your home system included):
1. Activation: spend one tactic token into the system.
2. Movement: move ships from other systems into the active system. A ship may move only if its move value covers the path length; it may not move through a system containing enemy ships (guardian ships count as enemy); wormholes make their two systems adjacent; anomaly rules of section 1. Gravity Drive: one ship gets +1 move this activation. Ships with capacity carry fighters and infantry from the system they start in; capacity may not be exceeded at the end of movement. Fighter II: fighters may move without being transported, and fighters in excess of capacity count against the fleet pool instead of being destroyed (TI4 rule). A ship in a system that contains the player's own command token from an earlier activation may not move (it was already used, TI4 rule: ships in systems with the player's token cannot move out).
3. Space combat if enemy or guardian ships are present (section 4).
4. Invasion: bombardment, then landing infantry on planets, ground combat, control (section 4.3).
5. Production if the player has a space dock in the active system (section 4.4).

Strategic action: play the primary ability of one of your unused strategy cards; the opponent may then use the secondary by spending one strategy token. The card is then used for the round.

Component actions available in v1: Inheritance Systems (L1Z1X), Emergency shipyard (section 6), trade at a trade post (section 8, free during your turn, not an action).

### 3.3 Status phase
1. Score: each player may score each public objective they fulfil (once per objective per game), the Mandate if fulfilled and not yet scored, and 1 VP for controlling Mecatol Rex.
2. Reveal the next public objective (rounds 1 to 5; round 6 has none).
3. Each player gains two command tokens (Hyper Metabolism: three) and distributes them freely among pools.
4. Ready all cards and planets, return strategy cards, remove command tokens from the map.
5. If Mecatol Rex is uncontrolled, roll a new guardian fleet.
6. Check victory (section 7). Then the speaker passes to the other player and the round counter increases.

## 4. Combat and production

### 4.1 Space combat (in the active system)
1. Space cannon offense: PDS in the system (only the L1Z1X starting PDS exists) fire once at the attacker before combat: 1 die per PDS, hit on 6+ (Graviton Laser System: hits cannot be assigned to fighters).
2. Anti-fighter barrage: each destroyer rolls its barrage dice (I: 2 dice at 9, II: 3 dice at 6); hits destroy enemy fighters only.
3. Combat rounds: every ship rolls its combat dice, a hit is a roll of combat value or higher. Plasma Scoring: one unit with bombardment or space cannon rolls one extra die (used in the relevant step). Nebula: defender +1. Munitions Reserves (Letnev): at the start of each round the Letnev player may pay 2 trade goods to reroll any of their dice this round.
4. Hit assignment is automatic in v1: first cancel hits with sustain damage on undamaged dreadnoughts, war suns and flagships (Non-Euclidean Shielding: 2 hits per sustain; Duranium Armor: repair one damaged unit after each round), then destroy fighters, destroyers, cruisers, carriers, damaged dreadnoughts, flagship, war sun in that order. [0.0.1] and L1Z1X dreadnoughts: their hits must be assigned to non-fighter ships if any exist.
5. Retreat: before each round after the first, the attacker may announce a retreat to an adjacent system that contains their units or command token and no enemy ships; the retreat happens after that round.
6. Combat ends when one side has no ships. Guardian ships never retreat. Assault Cannon: after space cannon offense and before anti-fighter barrage, if the player has 3 or more non-fighter ships, the opponent destroys one non-fighter ship. Order of the pre-combat steps: space cannon offense, Assault Cannon, anti-fighter barrage. Hits that cannot be assigned under a restriction (Graviton Laser System) are lost.

### 4.2 Guardian fleet
Neutral, grey. Composition rolled from a table so that the total cost is exactly 8: (dreadnought, cruiser, destroyer, 2 fighters), (2 dreadnoughts), (carrier, cruiser, 2 destroyers, 2 fighters), (dreadnought, 2 cruisers), (2 cruisers, 2 destroyers, 4 fighters), (carrier, dreadnought, 2 fighters). Always 2 infantry on Mecatol Rex. Guardian units use level I stats and no technologies. They never move. A new fleet is rolled in every status phase while Mecatol Rex is uncontrolled; once a player controls Mecatol Rex no guardian fleet returns.

### 4.3 Invasion
1. Bombardment: each ship with bombardment rolls against a chosen planet; planets with a PDS (planetary shield) cannot be bombarded unless the attacker has Arc Secundus in the system (L4 Disruptors does not affect bombardment; it only negates space cannon defense, step 3); hits destroy ground forces. Harrow (L1Z1X): bombardment may also be used after each ground combat round.
2. Landing: the player commits infantry from ships in the system to planets.
3. Space cannon defense: PDS on the planet fire at landing infantry (hit 6+), unless the attacker has L4 Disruptors.
4. Ground combat: infantry roll (I: 8, II: 7), simultaneous, until one side is gone. Infantry II: a destroyed infantry returns on a roll of 6+ to the home system at the start of the player's next turn.
5. Control: if attacking infantry survive and no defenders remain, the planet changes control, exhausted. Structures on the planet are destroyed, except that L1Z1X (Assimilate) replaces the space dock and PDS with their own. Losing your last space dock has no further rule effect beyond section 6.

### 4.4 Production
A space dock produces up to (planet resources + 2) units (Space Dock II: +4). A space dock, I or II, lets up to 3 fighters in its system ignore capacity. Costs from the unit table; fighters and infantry come in pairs for their cost. Payment: exhaust ready planets (resources) and spend trade goods (1 each); overpay is lost. Sarween Tools: total cost -1 (minimum 0). Fleet pool: after production, non-fighter ships in the system may not exceed the fleet pool (Armada: +2); fighters need capacity of ships in the system (or the dock's 3 free slots), excess fighters are not produced (the move succeeds with the trimmed count); non-fighter ships beyond the fleet pool make the production illegal. A War Sun needs no technology: it may be produced from the first round. Flagship: one per player at a time.

## 5. Technology
Research via Technology strategy card (primary: one technology; secondary: one technology for one strategy token plus 4 resources... note: the base card says the primary lets you research one, then optionally spend 6 resources for a second; the secondary costs a strategy token and 4 resources) and via Inheritance Systems (component action, exhaust the card, spend 2 resources, ignore prerequisites). Prerequisites are colour counts of owned technologies (`techs.json`). Unit upgrades replace the unit's stats. L1Z1X's dreadnought upgrade is Super-Dreadnought II. No PDS II, no Construction, no War Sun technology.

## 6. Duel-specific rules
- Imperial secondary: spend one strategy token to gain 2 trade goods (replaces "draw a secret objective").
- Diplomacy uses the errata text (ready up to 2 exhausted planets you control; the opponent places a command token from reinforcements in the chosen system, which they then cannot activate this round).
- Emergency shipyard: once per game, component action: spend one strategy token and 4 resources to place a space dock on a planet you control, only if you control no space dock.
- No action cards, no promissory notes, no agenda phase, no secret objectives in v1.
- Chess clock: 15 minutes per player, running whenever it is that player's turn to decide something, in every phase: picking a strategy card, taking an action, answering a secondary, distributing status tokens. It stops only while the handoff screen is up and once the game is over, so neither player can hold the other one hostage by sitting on a draft pick. At zero the player automatically passes for the rest of the round and receives 3 extra minutes at the start of each later round. The engine is time-free; the transport records a timestamp per move (see lobby-architecture.md) and enforces the clock.

## 7. Objectives and victory
- Public objectives, one revealed per round in order: (1) Own 3 technologies. (2) Control 4 planets outside your home system. (3) Have 3 or more non-fighter ships in the Mecatol Rex system. (4) Spend 6 resources in a single production. (5) Control 5 planets. (6) Own 2 technologies of the same colour. Each is worth 1 VP, scored once per player in a status phase (objective 4 is scored in the status phase of the round in which it was fulfilled). Objective 4 counts the resources actually paid for one production, that is the cost after Sarween Tools, so a production whose printed cost is 6 but which Sarween Tools reduces to 5 does not fulfil it.
- Mandate "First Strike": win a space combat in the Mecatol Rex system or in the opponent's home system. 1 VP, once per player, scored in the status phase of the round it happened.
- Mecatol Rex: 1 VP per status phase in which you control the planet. Imperial primary: 1 VP immediately if you control Mecatol Rex.
- Victory: the first player to reach 7 VP at a victory check wins. If both reach 7 in the same status phase, or after the round 6 status phase nobody has 7: higher VP wins; ties go to the Mecatol Rex controller, then to the player with more planets, then to the speaker's opponent.

## 8. Trade posts
Two neutral posts outside the map: west (linked to systems `sakulag` and `starpoint`) and east (linked to `bereg` and `quann`). During your own turn in the action phase, at most once per round per post, you may sell up to 2 commodities for 1 trade good each at a post, if you control at least one planet in one of its linked systems. Trade posts are not systems: no movement, no activation, no combat. Commodities replenish through the Trade card. Engine narrowing: trading is only offered on a clean turn of your own, that is with no tactical action running and no open secondary window, and never after you have passed.
