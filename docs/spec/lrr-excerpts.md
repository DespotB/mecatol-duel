---
title: TI4 base-game rules excerpts for Mecatol Duel
compiled: 2026-09-03
scope: Twilight Imperium Fourth Edition, base game only (no Prophecy of Kings)
---

# TI4 base-game rules excerpts (Living Rules Reference v1.1)

All quoted text below is verbatim from the Fantasy Flight Games **Living Rules Reference, Version 1.1 (02/03/18)**, the last pre-Codex, pre-PoK rules text. Paragraph numbers are the LRR glossary numbers (the PDF is two-column and was text-extracted; numbering has been re-attached by hand, so treat a paragraph number as "near this rule" rather than gospel). Strategy card wording is the printed card text as carried in the AsyncTI4 data. Everything in *italics* between quotes is editorial, not rules text.

Note on terminology: the base game calls the ship limit the **fleet pool** (the number of command tokens in the fleet pool of the command sheet); "fleet supply" is Third Edition wording.

## Sources

- Fantasy Flight Games, *Twilight Imperium Fourth Edition, Living Rules Reference v1.1*, 02/03/18, PDF: https://images-cdn.fantasyflightgames.com/filer_public/3a/fc/3afce41b-b757-4dc8-b005-3a5efffd0fad/ti4_living_rules_reference_v1_1.pdf (downloaded and text-extracted with pdftotext on 2026-09-03)
- AsyncTI4 TI4_map_generator_bot, `src/main/resources/data/strategy_cards/pok.json` (Imperial card, `source: base`), fetched 2026-09-03 via raw.githubusercontent.com
- AsyncTI4 TI4_map_generator_bot, `src/main/resources/data/units/baseUnits.json` (space dock / PDS faction-sheet values)
- Not usable at fetch time: twilight-imperium.fandom.com (Cloudflare challenge), tirules.com (site on indefinite hiatus)

## 1. Custodians token, Mecatol Rex, agenda phase trigger

### 26 CUSTODIANS TOKEN

> The custodians token begins each game on Mecatol Rex. The token represents the caretakers that safeguard the seat of the empire until the time when one of the great races claims the throne.
>
> 26.1 Units can move into the system that contains Mecatol Rex following normal rules; however, players cannot commit ground forces to land on Mecatol Rex until the custodians token is removed from the planet.
>
> 26.2 Before the "Commit Ground Forces" step of an invasion, the active player can remove the custodians token from Mecatol Rex by spending six influence. Then, he must commit at least one ground force to land on the planet.
> - If he cannot commit ground forces to land on Mecatol Rex, he cannot remove the custodians token.
>
> 26.3 When a player removes the custodians token from Mecatol Rex, he takes the token from the game board and places it in his play area. Then, he gains one victory point.
>
> 26.4 After a player removes the custodians token from Mecatol Rex, the agenda phase is added to all subsequent game rounds, including the game round during which the custodians token was removed from Mecatol Rex.

### 46 MECATOL REX

> Mecatol Rex is the planet placed in the center of the game board during setup.
>
> 46.1 During setup, the custodians token is placed on Mecatol Rex. This token prevents a player from committing ground forces to land on the planet unless he spends six influence to remove the token.

*Mecatol Rex planet values: 1 resource, 6 influence, no trait, tile 18.*

### 8 AGENDA PHASE (trigger and structure)

> During the agenda phase, players can cast votes on agendas that can change the rules of the game.
>
> 8.1 Players skip the agenda phase during the early portion of each game. After the custodians token is removed from Mecatol Rex, the agenda phase is added to each game round. To resolve the agenda phase, players perform the following steps:
>
> 8.2 STEP 1—FIRST AGENDA: Players resolve the first agenda by following these steps in order:
> i. REVEAL AGENDA: The speaker draws one agenda card from the top of the agenda deck and reads it aloud to all players, including all of its possible outcomes.
> ii. VOTE: Each player, starting with the player to the left of the speaker and continuing clockwise, can cast votes for an outcome of the current agenda.
> iii. RESOLVE OUTCOME: Players tally each vote that was cast and resolve the outcome that received the most votes.
>
> 8.3 STEP 2—SECOND AGENDA: Players repeat the "First Agenda" step of this phase for a second agenda.
>
> 8.4 STEP 3—READY PLANETS: Each player readies each of his exhausted planets. Then, a new game round begins starting with the strategy phase.
>
> 8.6 To cast votes, a player exhausts any number of his planets. The player casts a number of votes for an outcome of his choice equal to the combined influence values of the planets he exhausted.
> - When a player exhausts a planet to cast votes, he must cast the full amount of votes provided by that planet.
>
> 8.13 Trade goods cannot be spent to cast votes.
>
> 8.14 A player may choose to abstain by not casting any votes.
>
> 8.19 If there is a tie for the outcome that received the most votes, the speaker decides which of the tied outcomes to resolve.

### 36 GAME ROUND

> 36.1 A game round consists of the following four phases: 1. Strategy Phase 2. Action Phase 3. Status Phase 4. Agenda Phase
>
> 36.2 Players skip the agenda phase during the early portion of each game. After the custodians token is removed from Mecatol Rex, the agenda phase is added to each game round.

### 70.8 STATUS PHASE, STEP 8 (hand-off to the agenda phase)

> STEP 8—RETURN STRATEGY CARDS: Each player returns his strategy card to the common play area. Then, if a player has removed the custodians token from Mecatol Rex, the game round continues to the agenda phase. Otherwise, a new game round begins with the strategy phase.

### 87 VICTORY POINTS (relevant lines)

> The first player to gain 10 victory points wins the game.
>
> 87.7 The game ends immediately when one player has 10 victory points. If multiple players would simultaneously reach 10 victory points during the status or agenda phase, the player who is nearest the speaker in clockwise order is the winner.

## 2. Imperial strategy card

### Printed card text (initiative 8)

> PRIMARY ABILITY:
> Immediately score 1 public objective if you fulfill its requirements.
> Gain 1 victory point if you control Mecatol Rex; otherwise, draw 1 secret objective.
>
> SECONDARY ABILITY:
> Spend 1 token from your strategy pool to draw 1 secret objective.

### 40 IMPERIAL (STRATEGY CARD)

> The "Imperial" strategy card allows players to score victory points and draw secret objectives. This card's initiative value is "8."
>
> 40.1 During the action phase, if the active player has the "Imperial" strategy card, he can perform a strategic action to resolve that card's primary ability.
>
> 40.2 To resolve the primary ability on the "Imperial" strategy card, the active player can score one public objective of his choice if he meets that objective's requirements as described on its card. Then, if the active player controls Mecatol Rex, he gains one victory point; if he does not control Mecatol Rex, he can draw one secret objective card.
>
> 40.3 After the active player resolves the primary ability of the "Imperial" strategy card, each other player, beginning with the player to the left of the active player and proceeding clockwise, may spend one command token from his strategy pool to draw one secret objective card.
>
> 40.4 If a player has more than three secret objective cards after drawing a secret objective, he must choose one of his unscored secret objectives and return it to the secret objective deck. This number includes the secret objective cards in the player's hand and the cards he has already scored. Then, he shuffles the secret objective deck.

*Related: 52.16 "A player cannot score public objectives if he does not control each of the planets in his home system."*

## 3. Exhausted and readied planets, control

### 32 EXHAUSTED

> Some cards can be exhausted. A player cannot resolve abilities or spend the resources or influence of an exhausted card.
>
> 32.1 To exhaust a card, a player flips the card facedown.
>
> 32.2 During the "Ready Cards" step of the status phase, each player readies all of his exhausted cards by flipping them faceup.
>
> 32.3 A player exhausts his planet cards to spend either the resources or influence on that card.
>
> 32.4 Abilities, including some found on technology cards, may instruct a player to exhaust a card to resolve those abilities. If a card is already exhausted, it cannot be exhausted again.
>
> 32.5 After a player performs a strategic action, he exhausts the strategy card that corresponds to that action.

### 61 READIED

> Cards have a readied state, which indicates that a player can exhaust or resolve the abilities on those cards.
>
> 61.1 A card that is readied is placed faceup in a player's play area; a card that is exhausted is placed facedown in a player's area.
>
> 61.2 A player can exhaust a readied planet card to spend resources or influence from that card's planet.
>
> 61.3 A player can exhaust certain readied technology cards to resolve those cards' abilities.
> - Such a technology will specifically instruct a player to exhaust the card as part of the ability's cost.
>
> 61.4 If a card is exhausted, a player cannot resolve that card's abilities or spend resources or influence on that card until it is readied.
>
> 61.5 During a "Ready Cards" step, each player readies all of his exhausted cards by flipping them faceup.
>
> 61.6 When a player performs a strategic action, he exhausts his chosen strategy card.
> - That card is later readied during the status phase.

### 55 PLANETS (values, traits, specialties, planet card)

> Planets provide players with resources and influence. Planets are on system tiles and each has a name, a resource value, and an influence value. Some planets also have traits.
>
> 55.1 A planet's resources are indicated by the upper-left value that is surrounded by a yellow border.
>
> 55.2 A planet's influence is indicated by the lower-right value that is surrounded by a blue border.
>
> 55.3 A planet's trait has no inherent effects, but some game effects refer to a planet's trait. There are three traits: cultural, hazardous, and industrial.
>
> 55.4 Some planets have a technology specialty, which allows those planets to be exhausted to satisfy a prerequisite when researching technology.
>
> 55.5 Each planet has a corresponding planet card that displays its name, resource value, influence value, and trait, if it has one. If a player controls a planet, he keeps that planet's card in his play area.
>
> 55.6 A planet card has both a readied and exhausted state. When a planet is readied, it is placed faceup. When a planet is exhausted, it is placed facedown.
>
> 55.7 A player can spend a readied planet's resources or influence.
>
> 55.8 A player cannot spend an exhausted planet's resources or influence.

### 64 RESOURCES, 42 INFLUENCE, 82 TRADE GOODS (spending)

> 64.2 A player spends a planet's resources by exhausting its card.
>
> 64.3 A player can spend a trade good as if it were one resource.
>
> 42.2 A player can spend a planet's influence by exhausting that planet's card.
>
> 42.3 A player can spend a trade good as if it were one influence. Players cannot spend trade goods to cast votes during the agenda phase.
>
> 82.3 A player can spend trade goods at any time during the game.

### 24 CONTROL

> Each player begins the game with control of the planets in his home system. During the game, players can gain control of additional planets.
>
> 24.1 When a player gains control of a planet, he takes the planet card that corresponds to that planet and places it in his play area; that card is exhausted.
> - If a player is the first player to control a planet, he takes the planet card from the planet card deck.
> - If another player controls the planet, he takes that planet's card from the other player's play area.
>
> 24.2 A player cannot gain control of a planet that he already controls.
>
> 24.3 While a player controls a planet, that planet's card remains in his play area until he loses control of that planet.
>
> 24.4 A player can control a planet that he does not have any units on; he places a control token on that planet to mark that he controls it.
>
> 24.5 Except during the invasion step of a tactical action, a player loses control of a planet if he no longer has units on it and another player has units on it
> - The player that placed units on the planet gains control of that planet.
> - During the invasion step of a tactical action, control is determined during the "Establish Control" step.
>
> 24.6 A player can also lose control of a planet through some game effects.
>
> 24.7 If a player loses control of a planet that contains his control token, he removes his control token from the planet.

## 4. Production, space dock, capacity, fleet pool

### Space dock faction-sheet values (base game, all factions except Saar)

> SPACE DOCK: PRODUCTION X. This unit's PRODUCTION value is equal to 2 more than the resource value of this planet. Up to 3 fighters in this system do not count against your ships' capacity.

*Space Dock II raises "2 more" to "4 more". PDS: PLANETARY SHIELD, SPACE CANNON 6 (PDS II: SPACE CANNON 5 plus adjacent-system range).*

### 25 COST (ATTRIBUTE)

> Cost is an attribute of some units that is presented on those units' faction sheets and technology cards. A unit's cost determines the number of resources a player must spend to produce that unit.
>
> 25.1 To produce a unit, a player must spend a number of resources equal to or greater than the cost of the unit he is producing.
>
> 25.2 If the cost is accompanied by two icons—typically for fighters and ground forces—a player produces two of that unit for that cost.
>
> 25.3 If a unit does not have a cost, it cannot be produced.
> - Structures do not have costs and are usually placed by resolving the "Construction" strategy card.

### 58 PRODUCING UNITS

> The primary way in which a player produces new units is by resolving the "Production" abilities of his units during a tactical action. However, other game effects also allow players to produce units.
>
> 58.1 Each unit that a player can produce has a cost value presented on its faction sheet or technology card. To produce a unit, a player must spend a number of resources from planets he controls equal to or greater than the cost value of the unit he is producing.
> - Any resources spent in excess of a unit's cost are lost.
> - If a player is producing multiple units at a time, he can add the cost of all the units he is producing to create a total cost before he spends any resources.
>
> 58.2 If the cost is accompanied by two icons—typically for fighters and ground forces—a player produces two of that unit for that cost.
> - Each of the two units counts toward the total number of units a player can produce.
> - A player can choose to produce only one unit; however, he must still pay the entire cost.
>
> 58.3 When a player produces a unit through the use of his units' "Production" abilities during a tactical action, he follows the rules of the "Production" ability to determine where he can place his units in the active system.
>
> 58.4 When a player produces a unit through an ability outside of the tactical action, that ability will state where the player can place the units he is producing and how many units he can produce.
>
> 58.5 A player is limited by the number of units in his reinforcements.
> - If he does not have enough units in his reinforcements, he can remove units from any systems that do not contain one of his command tokens and place them in his reinforcements. Then, he can produce any units that he removed. He cannot remove a unit in this way unless he is immediately producing a unit of that type.
> - When producing a fighter or infantry unit, he can use a fighter or infantry token, as appropriate, from the supply instead of a plastic piece.
>
> 58.6 A player cannot produce ships in a system that contains other players' ships, but he can still produce ground forces.

### 59 PRODUCTION (UNIT ABILITY)

> During the "Production" step of a tactical action, the active player can resolve the "Production" ability of each of his units that are in the active system in order to produce units.
>
> 59.1 A unit's "Production" ability on its faction sheet is always followed by a value. This value is the maximum number of units that this unit can produce.
> - If the active player has multiple units in the active system that have the "Production" ability, he can produce a number of units up to the combined total of all of his units' production values in that system.
> - When producing fighters or infantry, each individual unit counts toward the producing unit's production limit.
> - A player can choose to produce one fighter or infantry instead of two, but he must still pay the full cost.
> - "Production" value from Arborec space docks cannot be used to produce infantry, even if the Arborec player controls other units with "Production" in the same system.
>
> 59.2 When a player produces ships by using "Production," he must place them in the active system.
>
> 59.3 When a player produces ground forces, he must place those unit on planets that contain a unit that used its "Production" ability.
>
> 59.4 If a player uses the "Production" ability of a unit in a space area of a system to produce ground forces, those ground forces may either be placed on a planet the player controls in that system or in the space area of that system.
> - If a player places a ground force in the space area of a system, it cannot exceed that player's capacity in that system.

### 68 SPACE DOCK

> A space dock is a structure that allows players to produce units.
>
> 68.1 Each space dock has a "Production" ability that indicates the number of units it can produce.
>
> 68.2 The primary way in which players acquire space docks is by resolving either the primary or secondary abilities of the "Construction" strategy card.
>
> 68.3 Space docks are placed on planets. Each planet can have a maximum of one space dock.
>
> 68.4 If a player's space dock is ever on a planet that contains a unit that belongs to another player and does not contain any of his own ground forces, that space dock is destroyed.

### 14 BLOCKADED

> A player's unit with "Production" is blockaded if it is in a system that contains another player's ships but does not contain any of his own ships.
>
> 14.1 A player cannot use a blockaded unit to produce ships; he can still use a blockaded unit to produce ground forces.

### 16 CAPACITY (ATTRIBUTE)

> Capacity is an attribute of some units that is presented on those units' faction sheets and technology cards.
>
> 16.1 A unit's capacity value indicates the maximum combined number of fighters and ground forces that it can transport.
>
> 16.2 The combined capacity values of a player's ships in a system determine the number of fighters and ground forces he can have in that system's space area.
>
> 16.3 If a player has more fighters and ground forces in the space area of a system than the total capacity of his ships in that system, he must destroy the excess units of his choice.
> - Ground forces on planets do not count against capacity.
> - A player's fighters and ground forces can exceed capacity during combat. At the end of combat, he must destroy the excess units.
>
> 16.4 Fighters and ground forces are not assigned to specific ships, except while they are being transported.

### 34 FLEET POOL ("fleet supply")

> The fleet pool is an area of a player's command sheet.
>
> 34.1 The number of command tokens in a player's fleet pool indicates the maximum number of non-fighter ships that a player can have in a system.
> - Units that are on planets or are being transported by a ship with capacity do not count against a player's fleet pool.
>
> 34.2 Players place command tokens in their fleet pools with the ship silhouette faceup.
>
> 34.3 If at any time the number of a player's ships in a system exceeds the number of tokens in his fleet pool, he chooses and destroys excess ships in that system.
>
> 34.4 Players do not spend command tokens from this pool.

### 65 SHIPS (relevant lines)

> 65.1 Ships are always placed in space.
>
> 65.2 A player can have a number of ships in a system equal to or less than the number of command tokens in his fleet pool.
> - Fighters do not count toward the fleet pool limit, and instead count against a player's capacity.

### 19 COMMAND TOKENS (starting values)

> 19.1 A player begins the game with eight command tokens on his command sheet: three in his tactic pool, three in his fleet pool, and two in his strategy pool.

### 84 TRANSPORT

> When a ship moves, it may transport any combination of fighters and ground forces, but the number of units it transports cannot exceed that ship's capacity value.
>
> 84.1 The ship can pick up and transport fighters and ground forces when it moves. During a tactical action, it can pick up and transport units from the active system, the system it started its movement in, and each system it moves through.
> - These transported units can only be dropped off in the active system.
>
> 84.2 Any fighters and ground forces that a ship transports must move with the ship and remain in the space area of a system.
>
> 84.3 Fighters and ground forces cannot be picked up from a system that contains one of their faction's command tokens other than the active system.
>
> 84.4 A player can land ground forces on a planet in a system during the "Invasion" step of a tactical action.

## 5. The tactical action and the full combat sequence

### Command-sheet quick reference (verbatim)

> THE TACTICAL ACTION
> 1) Activation
> 2) Movement
>   i) Move Ships
>   ii) Space Cannon Offense
> 3) Space Combat
>   i) Anti-Fighter Barrage
>   ii) Announce Retreats
>   iii) Make Combat Rolls
>   iv) Assign Hits
>   v) Retreat
> 4) Invasion
>   i) Bombardment
>   ii) Commit Ground Forces
>   iii) Space Cannon Defense
>   v) Ground Combat
>   vi) Establish Control
> 5) Production

### 78 TACTICAL ACTION

> The tactical action is the primary method by which players produce units, move ships, and extend their dominion within the galaxy. To perform a tactical action, the active player performs the following steps:
>
> 78.1 STEP 1—ACTIVATION: The active player must activate a system that does not contain one of his command tokens.
> - To activate a system, the active player places a command token from his tactic pool on that system. That system is the active system.
> - Other players' command tokens do not prevent a player from activating a system.
>
> 78.2 STEP 2—MOVEMENT: The active player may move any number of ships with a sufficient move value from any number of systems that do not contain one of his command tokens into the active system, following the rules for movement.
> - Ships that have capacity values can transport ground forces and fighters when moving.
> - The player may choose to not move any ships.
> - After the "Move Ships" step, all players can use the "Space Cannon" abilities of their units in the active system.
>
> 78.3 STEP 3—SPACE COMBAT: If two players have ships in the active system, those players must resolve a space combat.
> - If the active player is the only player with ships in the system, he skips this step.
>
> 78.4 STEP 4—INVASION: The active player may use his "Bombardment" abilities, commit units to land on planets, and resolve ground combat against other players' units.
>
> 78.5 STEP 5—PRODUCTION: The active player may resolve the "Production" abilities of his units in the active system.
> - The active player may do this even if he did not move units or land ground forces during this tactical action.

### 49 MOVEMENT

> A player can move his ships by resolving a tactical action during the action phase. Additionally, some abilities can move a unit outside of the tactical action.
>
> 49.2 Most ships have a move value printed on their faction sheets and technology cards. This value indicates the distance from its current system that a ship can move.
> - Other abilities and effects can increase this number.
>
> 49.3 To resolve movement, players perform the following steps:
>
> 49.4 STEP 1—MOVE SHIPS: A player can move any number of his eligible ships into the active system, obeying the following rules:
> - The ship must end its movement in the active system.
> - The ship must move along a path of adjacent systems, and the number of systems the ship enters cannot exceed its move value.
> - The ship cannot move through a system that contains ships that are controlled by another player.
> - The ship cannot move if it started its movement in another system that contains one of its faction's command tokens.
> - The ship can move through systems that contain its own faction's command tokens.
> - The ship can move out of the active system and back into it if its move value is high enough.
>
> 49.5 When a ship with a capacity value moves or is moved, it may transport ground forces and fighters.
>
> 49.6 The active player's ships move simultaneously.
>
> 49.7 STEP 2—SPACE CANNON OFFENSE: After the "Move Ships" step, players can use the "Space Cannon" abilities of their units in the active system.
>
> 49.8 If an ability moves a unit outside of the "Movement" step of a tactical action, players follow the rules specified by that ability; neither a unit's move value nor the rules specified above apply.

*FAQ (LRR v1.1): "Q: Can fighters block ship movement? A: Yes, fighters can block ship movement."*

### 66 SPACE CANNON (UNIT ABILITY)

> A unit that has the "Space Cannon" ability can use it during two different steps of a player's tactical action: after the "Move Ships" substep (Space Cannon Offense) and during an invasion (Space Cannon Defense).
>
> 66.1 A player is not required to be the active player to use the "Space Cannon" abilities of his units.
>
> SPACE CANNON OFFENSE
>
> 66.2 During a tactical action, after the "Move Ships" substep of the "Movement" step, players can resolve the "Space Cannon" abilities of their units by performing the following steps:
>
> 66.3 STEP 1— Beginning with the active player and proceeding clockwise, each player may use the "Space Cannon" ability of each of his units in the active system by rolling a specific number of dice for each of those units; these are called space cannon rolls. A hit is produced for each die roll that is equal to or greater than the unit's "Space Cannon" value.
> - If a unit has a "Space Cannon" ability, it is present on its faction sheet and technology cards.
> - "Space Cannon" is displayed as "Space Cannon X (Y)." The X is the minimum value needed for a die to produce a hit, and Y is the number of dice rolled. Not all "Space Cannon" abilities are accompanied by a (Y) value; a space cannon roll for such a unit consists of one die.
> - If a player has the "Deep Space Cannon" technology, he can use the "Space Cannon" ability of his PDS units that are in systems that are adjacent to the active system. The hits are still assigned to units in the active system.
> - Game effects that reroll, modify, or otherwise affect combat rolls do not affect space cannon rolls.
>
> 66.4 This ability can be used even if no ships were moved during the "Move Ships" step.
>
> 66.5 STEP 2—The active player must choose and destroy one of his ships in the active system for each hit result produced against his units.
> - If the active player is using the "Space Cannon" ability of his units, he chooses a player who has ships in the active system. That player must choose and destroy one of his ships in the active system for each hit the space cannon roll produced.
>
> SPACE CANNON DEFENSE
>
> 66.6 During the invasion step of a tactical action, after ground forces have been committed to land on planets, players other than the active player can resolve the "Space Cannon" abilities of their units on those planets by performing the following these steps:
>
> 66.7 STEP 1—Each player may use the "Space Cannon" ability of each of his units on the invaded planet by rolling a specific number of dice for each of those units; this is called a space cannon roll. A hit is produced for each die roll that is equal to or greater than the unit's "Space Cannon" value.
> - Game effects that allow the use of "Space Cannon" abilities against ships in adjacent systems have no effect during Space Cannon Defense.
>
> 66.8 STEP 2—The active player must choose and destroy one of his ground forces on the planet for each hit the space cannon roll produced.
> - Hits can only be assigned to units that were committed to the same planet as the units using the "Space Cannon" ability.

### 10 ANTI-FIGHTER BARRAGE (UNIT ABILITY)

> A unit with the "Anti-Fighter Barrage" ability may be able to destroy an opponent's fighters at the start of the first round of a space combat. During the "Anti-Fighter Barrage" step of space combat, players perform the following steps:
>
> 10.1 STEP 1—Each player rolls dice for each of his units in the combat that has the "Anti-Fighter Barrage" ability; this is called an anti-fighter barrage roll. A hit is produced for each die roll that is equal to or greater than the unit's anti-fighter barrage value.
> - If a unit has an "Anti-Fighter Barrage" ability, it is presented on its faction sheet and technology cards.
> - The "Anti-Fighter Barrage" ability is displayed as "Anti-Fighter Barrage X (Y)." The X is the minimum value needed for a die to produce a hit, and Y is the number of dice rolled.
> - Game effects that reroll, modify, or otherwise affect combat rolls do not affect anti-fighter barrage rolls
>
> 10.2 STEP 2:—Each player must choose and destroy one of his fighters in the active system for each hit his opponent's anti-fighter barrage roll produced.
> - If a player has to assign more hits than he has fighters in the active system, the excess hits have no effect.

### 67 SPACE COMBAT

> After resolving the "Space Cannon Offense" step of a tactical action, if two players have ships in the active system, those players must resolve a space combat.
>
> 67.1 If the active player is the only player with ships in the system, he skips the "Space Combat" step of the tactical action and proceeds to the "Invasion" step.
>
> 67.2 If an ability occurs "before combat," it occurs immediately before the "Anti-Fighter Barrage" step.
>
> 67.3 To resolve a space combat, players perform the following steps:
>
> STEP 1—ANTI-FIGHTER BARRAGE: If this is the first round of a space combat, the players may simultaneously use the "Anti-Fighter Barrage" ability of any of their units in the active system.
> - If one or both players no longer have ships in the active system after resolving this step, the space combat ends immediately.
> - Players cannot resolve "Anti-Fighter Barrage" abilities during any rounds of space combat other than the first round.
>
> 67.4 STEP 2—ANNOUNCE RETREATS: Each player may announce a retreat, beginning with the defender.
> - A retreat will not occur immediately; the units will retreat during the "Retreat" step.
> - If the defender announces a retreat, the attacker cannot announce a retreat during that combat round.
> - If a player wishes to retreat with any of his ground forces that are on planets he controls in the active system, he may place those units in the space area of the active system during this step.
>
> 67.5 STEP 3—ROLL DICE: Each player rolls one die for each ship he has in the active system; this is called a combat roll. If a unit's combat roll produces a result that is equal to or greater than that unit's combat value, that result produces a hit.
> - If a unit's combat value contains two or more burst icons, the player rolls one die for each burst icon instead.
> - If a player has ships that have different combat values in the active system, he rolls these dice separately.
>   -- First, he should roll all dice for his units with a combat value of "1." Then, he should roll all dice for his units with combat value of "2," and then "3," continuing in numerical order until he has rolled dice for each of his ships.
>   -- A player keeps track of the number of hits his combat rolls produce. The total number of hits he produces will destroy units during the "Assign Hits" step.
>   -- If a player has an ability that rerolls a die or affects a die after it is rolled, he must resolve that ability immediately after rolling the die. For example, if the player made a combat roll for his dreadnoughts, he must decide if he wants to use an ability to reroll those dice before making a combat roll for his destroyers.
>   -- The attacker makes all of his combat rolls during this step before the defender. This procedure is important for abilities that allow a player to reroll an opponent's die.
>
> 67.6 STEP 4—ASSIGN HITS: Each player must choose and destroy one of his ships in the active system for each hit his opponent produced.
> - Before assigning hits, players may use their units' "Sustain Damage" abilities to cancel hits.
> - When a unit is destroyed, the player who controls that unit removes it from the board and places it in his reinforcements.
>
> 67.7 STEP 5—RETREAT: If a player announced a retreat during the first step of a combat, he must retreat.
> - If a player announced a retreat during the "Announce Retreats" step and if his opponent has no ships left in the system, the combat immediately ends and the retreat does not occur.
> - To retreat, a player takes all of his ships in the combat that have a move value and moves them to an adjacent system. Fighters and ground forces in the active system that are unable to move or be transported are destroyed
> - The system that a player's units retreat to must contain one or more of his units, a planet he controls, or both. Additionally, the system cannot contain ships controlled by another player.
> - After retreating, a player must place a command token from his reinforcements in the system to which he retreated. If that system already contains one of his command tokens, he does not place an additional token there. If the player has no command tokens in his reinforcements, he must use one from his command sheet instead.
>
> 67.8 After the "Retreat" step, if both players still have ships in the active system, they resolve another round of space combat beginning with the "Announce Retreats" step.
>
> 67.9 Space combat ends immediately when only one player—or neither player—has a ship in the active system.
> - "End of combat" and "end of combat round" effects still occur.
>
> 67.10 After a combat ends, the player with one or more ships remaining in the system is the winner of the combat; the other player is the loser of the combat. If neither player has a ship remaining, the combat ends in a draw and there is no winner.
> - If the winner of the combat has fighters or ground forces in space that exceed his ships' capacity in the active system, he must destroy the excess units of his choice.

### 17 COMBAT (ATTRIBUTE), 13 ATTACKER, 28 DEFENDER, 53 OPPONENT, 29 DESTROYED

> 17.1 During combat, if a unit's combat roll produces a result equal to or greater than its combat value, it produces a hit.
>
> 17.2 If a unit's combat value contains two or more burst icons, instead of rolling a single die, the player rolls one die for each burst icon when making that unit's combat rolls.
>
> 13 ATTACKER: During combat, the active player is the attacker.
>
> 28 DEFENDER: During either a space or ground combat, the player who is not the active player is the defender.
>
> 53 OPPONENT: During combat, a player's opponent is the other player that either has ships in the system at the start of the space combat or has ground forces on the planet at the start of a ground combat.
>
> 29 DESTROYED: Various game effects can cause a unit to be destroyed. When a player's unit is destroyed, it is removed from the game board and returned to his reinforcements.
> 29.1 When a player assigns hits that were produced against his units, he chooses a number of his units to be destroyed equal to the number of hits produced against his units.
> 29.2 Forcing a player to remove a unit from the board by reducing the number of command tokens in his fleet pool does not count as destroying a unit.

*FAQ: "Q: Are the '0' faces of the ten-sided dice included with the game intended to represent the result of a '10'? A: Yes, the '0' face is a '10' result."*

### 76 SUSTAIN DAMAGE (UNIT ABILITY)

> Some units have the "Sustain Damage" ability. Immediately before a player assigns damage to his units, he can use the "Sustain Damage" ability of any of his units in the active system.
>
> 76.1 For each "Sustain Damage" ability that a player uses, one hit produced by another player's units is canceled. Then, each unit using this ability is placed on its side to indicate that it is damaged.
>
> 76.2 A damaged unit does not have reduced capabilities and is functionally the same as an undamaged unit, except that it cannot use the "Sustain Damage" ability.
>
> 76.3 A damaged unit cannot use the "Sustain Damage" ability until it is repaired during the status phase or by another game effect.
>
> 76.4 A unit can use its "Sustain Damage" ability any time a hit is produced against it. This includes hits produced during combat and from unit abilities such as the "Space Cannon" ability.
> - The Barony of Letnev's "Non-Euclidean Shielding" faction technology allows the Letnev player's units with the "Sustain Damage" ability to cancel up to two hits instead of one.
>
> 76.5 The "Sustain Damage" ability cannot be used to cancel an effect that directly destroys a unit.
>
> 76.6 A unit can only use the "Sustain Damage" ability if it is eligible to be hit. For example, a player cannot use a dreadnought's "Sustain Damage" ability to cancel a hit from "Anti-Fighter Barrage."

*Status phase, STEP 7—REPAIR UNITS: "Each player repairs all of his units that have the 'Sustain Damage' ability by turning those units upright."*

### 44 INVASION

> Invasion is a step of the tactical action during which the active player can land ground forces on planets to gain control of those planets. To resolve an invasion, players perform the following steps:
>
> 44.1 STEP 1—BOMBARDMENT: The active player may use the "Bombardment" ability of any of his units in the active system.
>
> 44.2 STEP 2—COMMIT GROUND FORCES: If the active player has ground forces in the space area of the active system, he may commit any number of those ground forces to land on any of the planets in that system.
> - To commit a ground force to a planet, the active player places that ground force unit on that planet.
> - The planet may contain another player's ground forces.
> - If the active player does not wish to commit ground forces, he proceeds to the "Production" step of the tactical action.
>
> 44.3 STEP 3—SPACE CANNON DEFENSE: If the active player commits any ground forces to a planet that contains units that have the "Space Cannon" ability, those "Space Cannon" abilities can be used against the committed ground forces.
> - If the active player committed ground forces to more than one planet that contained units with a "Space Cannon" ability, the active player chooses the order in which those "Space Cannon" abilities are resolved.
>
> 44.4 STEP 4—GROUND COMBAT: If the active player commits ground forces to land on a planet that contains another player's ground forces, those players resolve a ground combat on that planet.
> - If players must resolve a combat on more than one planet, the active player chooses the order in which those combats are resolved.
>
> 44.5 STEP 5—ESTABLISH CONTROL: The active player gains control of each planet he committed ground forces to that still contains at least one of his ground forces.
> - When a player gains control of a planet, any structures on the planet that belong to other players are immediately destroyed.
> - When a player gains control of a planet, he gains the planet card that matches that planet and exhausts that card.
> - A player cannot gain control of a planet he already controls.
> - If there was a combat, and all units belonging to both players were destroyed, the player who was the defender retains control of the planet and places one of his control markers on the planet.

### 15 BOMBARDMENT (UNIT ABILITY)

> A unit with the "Bombardment" ability may be able to destroy another player's ground forces during an invasion. During the "Bombardment" step of an invasion, players perform the following steps:
>
> 15.1 STEP 1— The active player chooses which planet each of his units that has a "Bombardment" ability will bombard. Then he rolls dice for each of those units; this is called a bombardment roll. A hit is produced for each die roll that is equal to or greater than the unit's "Bombardment" value.
> - If a unit has a "Bombardment" ability, it is presented on its faction sheet and technology cards.
> - The "Bombardment" ability is displayed as "Bombardment X (Y)." The X is the minimum value needed for a die to produce a hit, and Y is the number of dice rolled. Not all "Bombardment" abilities have a (Y) value; a bombardment roll for such a unit consists of one die.
> - Game effects that reroll, modify, or otherwise affect combat rolls do not affect bombardment rolls.
> - Multiple planets in a system may be bombarded, but a player must declare which planet a unit is bombarding before making a bombardment roll.
> - The L1Z1X's "Harrow" ability does not affect the L1Z1X player's own ground forces.
> - Planets that contain a unit with the "Planetary Shield" ability cannot be bombarded.
>
> 15.2 STEP 2— The player who controls the planet that is being bombarded chooses and destroys one of his ground forces on that planet for each hit result the bombardment roll produced.
> - If a player has to assign more hits than he has ground forces, the excess hits have no effect.

### 56 PLANETARY SHIELD (UNIT ABILITY)

> Units cannot use the "Bombardment" ability against a planet that contains a unit that has the "Planetary Shield" ability.
>
> 56.1 The "Planetary Shield" ability does not prevent a planet from being affected by the "X-89 Bacterial Weapon" technology.
>
> 56.2 The "Planetary Shield" ability prevents an L1Z1X player from using his "Harrow" faction ability.
>
> 56.3 If a war sun is in a system with any number of other players' units that have the "Planetary Shield" ability, those units are treated as if they do not have that ability.
> - Units treated as if they do not have a "Planetary Shield" ability cannot use the "Magen Defense Grid" technology.
> - A war sun can use its "Bombardment" ability against planets that contain units that have the "Planetary Shield" ability.

### 38 GROUND COMBAT

> During the "Invasion" step of a tactical action, if the active player commits ground forces to land on a planet that contains another player's ground forces, those players resolve a ground combat on that planet. To resolve a ground combat, players perform the following steps:
>
> 38.1 STEP 1—ROLL DICE: Each player rolls one die for each ground force he has on the planet; this is a combat roll. If a unit's combat roll produces a result that is equal to or greater than that unit's combat value, that roll produces a hit.
> - If a unit's combat value contains two or more burst icons, the player rolls one die for each burst icon instead.
>
> 38.2 STEP 2—ASSIGN HITS: Each player must choose one of his ground forces on the planet to be destroyed for each hit result his opponent produced.
> - When a unit is destroyed, the player who controls that unit removes it from the board and places it in his reinforcements.
>
> 38.3 After assigning hits, if both players still have ground forces on the planet, players resolve a new combat round starting with the "Roll Dice" step.
>
> 38.4 Ground combat ends immediately when only one player (or neither player) has ground forces on the planet.
> - "End of combat" and "end of combat round" effects still occur.
> - After a combat ends, the player with one or more ground forces remaining on the planet is the winner of the combat; the other player is the loser of the combat.
> - If neither player has a ground force remaining, then there is no winner; the combat ends in a draw.

### 54 PDS, 74 STRUCTURES

> 54.1 Each PDS has the "Space Cannon" ability.
> 54.2 The primary way by which players acquire PDS units is by resolving either the primary or secondary ability of the "Construction" strategy card.
> 54.3 A PDS unit is placed on a planet. Each planet can have a maximum of two PDS units.
> 54.4 If a player's PDS is ever on a planet that contains a unit that belongs to another player and does not contain any of his own ground forces, that PDS is destroyed.
>
> 74.3 Structures cannot move or be transported.
> 74.4 A player can have a maximum of one space dock on each planet.
> 74.5 A player can have a maximum of two PDS units on each planet.

## 6. Technology research rules

### 79 TECHNOLOGY (selected)

> 79.7 Each technology that is not a unit upgrade has a colored symbol displayed in the lower-right corner of the card and on its card back that indicates that technology's color.
> - A technology's color has no inherent game effect; however, each technology a player owns can satisfy a prerequisite of a matching color when researching other technology.
> - Unit upgrades do not have a color and do not satisfy prerequisites.
> - There are four colors of technologies as follows: Biotic, Propulsion, Cybernetic, Warfare
>
> 79.8 Most technology cards have a column of colored symbols displayed in the lower-left corner of the card. Each symbol in this column is a prerequisite.
> - A technology card's prerequisites indicate the number and color of technologies a player must own to research that technology card.
>
> 79.9 A player can research technology by resolving either the primary or secondary ability of the "Technology" strategy card during the action phase. Other game effects may also instruct a player to research technology.
>
> 79.10 To research technology, a player gains that technology card from his technology deck and places it in his play area near his faction sheet.
> - Players place any unit upgrades they gain faceup on their faction sheets, covering the unit that shares a name with that upgrade card.
>
> 79.11 A player cannot research a faction technology that does not match his faction.
>
> 79.12 When researching technology, a player must satisfy each of a technology's prerequisites to research it. To satisfy a technology's prerequisites, he must own one technology of the matching color for each prerequisite symbol on the technology card he wishes to research.
> - Players may use certain abilities or technology specialties to ignore some prerequisites.
>
> 79.14 When researching technology, a player can exhaust a planet he controls that has a technology specialty to ignore one prerequisite symbol of the matching type on the technology card he is researching.
>
> 79.15 If the planet card is already exhausted, it cannot be used to ignore a prerequisite.

### 80 TECHNOLOGY (STRATEGY CARD), initiative 7

> Printed card: PRIMARY ABILITY: Research 1 technology. Spend 6 resources to research 1 technology. SECONDARY ABILITY: Spend 1 token from your strategy pool and 4 resources to research 1 technology.
>
> 80.2 To resolve the primary ability on the "Technology" strategy card, the active player can research one technology of his choice. Then, he may spend six resources to research one additional technology of his choice.
>
> 80.3 After the active player resolves the primary ability of the "Technology" strategy card, each other player, beginning with the player to the left of the active player and proceeding clockwise, may spend one command token from his strategy pool and four resources to research one technology of his choice.

### 86 UNIT UPGRADES

> 86.1 Unit upgrades share a name with a unit that is printed on a player's faction sheet, but have a higher roman numeral. For example, a player's "Carrier I" unit is upgraded by the unit upgrade technology "Carrier II.
>
> 86.2 Players place unit upgrades they gain faceup on their faction sheets, covering the unit that shares a name with that upgrade card.
>
> 86.4 After a player gains a unit upgrade card, each of that player's units that correspond to that upgrade card is treated as having the attributes and abilities printed on that upgrade card. Any previous attributes of that unit, such as the one printed on that player's faction sheet, are ignored.

### 88 WARFARE (STRATEGY CARD), secondary (home-system production)

> 88.3 After the active player resolves the primary ability of the "Warfare" strategy card, each other player, beginning with the player to the left of the active player and proceeding clockwise, may spend one command token from his strategy pool to resolve the "Production" ability of one space dock in his home system.
> - The command token is not placed in his home system.

## 7. Map: adjacency, wormholes, anomalies, tile backs

### 6 ADJACENCY, 89 WORMHOLES

> 6 Two system tiles are adjacent to each other if any of the tiles' edges are touching each another.
> 6.1 A system that has a wormhole is treated as being adjacent to a system that has a matching wormhole.
> 6.2 A unit or planet is adjacent to all system tiles that are adjacent to the system tile that contains that unit or planet.
> - A system is not adjacent to itself.
> - A planet counts as being adjacent to the system that contains that planet.
>
> 89 Some systems contain wormholes. Systems that contain identical wormholes are adjacent.
> 89.1 There are two basic types of wormholes: alpha and beta.
> 89.2 PDS units that have been upgraded by the "PDS II—Deep Space Cannon" unit upgrade technology can use their "Space Cannon" abilities through wormholes.
> 89.3 Players can be neighbors and perform transactions through wormholes.
> 89.4 There is one advanced type of wormhole: delta. This wormhole follows all normal wormhole rules.
> - This wormhole is present on the Creuss Gate system tile and the Ghosts of Creuss home system tile.

### 9 ANOMALIES, 11 ASTEROID FIELD, 37 GRAVITY RIFT, 50 NEBULA, 75 SUPERNOVA

> 9 An anomaly is a system tile that has unique rules.
> 9.1 An anomaly is identified by a red border located on the tile's corners.
> 9.2 There are four types of anomalies: asteroid fields, nebulae, supernovas, and gravity rifts.
>
> 11.1 A ship cannot move through or into an asteroid field.
>
> 37.1 A ship that will move out of or through a gravity rift at any time during its movement, applies +1 to its move value.
> - This can allow a ship to reach the active system from farther away than it normally could.
> 37.2 For each ship that moves out of or through a gravity rift, one die is rolled immediately before the "Move Ships" step ends (after those ships have moved into the active system); on a result of 1–3, that ship is destroyed.
> - Dice are not rolled for units that are being transported by ships with capacity.
> - Units that are being transported are destroyed if the ship transporting them is destroyed.
>
> 50.1 A ship can only move into a nebula if it is the active system.
> - A ship cannot move through a nebula. That is, a ship cannot move into and out of a nebula during the same movement.
> 50.2 A ship that begins the "Movement" step of a tactical action in a nebula treats its move value as "1" for the duration of that step.
> 50.3 If a space combat occurs in a nebula, the defender applies +1 to the combat rolls of his ships during that combat.
>
> 75.1 A ship cannot move through or into a supernova.

### 77 SYSTEM TILES

> A system tile represents an area of the galaxy. Players place system tiles during setup to create the game board.
> 77.1 The back of each system tile is colored green, blue, or red.
> 77.2 System tiles with a green-colored back are home systems. Each home system is unique to one of the game's factions.
> 77.3 System tiles with a blue-colored back each contain one or more planets.
> 77.4 System tiles with a red-colored back are anomalies or are systems that do not contain planets.
> 77.5 Planets are located in systems. Ground forces and structures are always placed on planets.
> 77.6 Any area on a system tile that is not a planet is space. Ships are always placed in the space area.

## 8. Status phase (for the round loop)

> 70 During the status phase, players score objectives and prepare for the next game round. To resolve the status phase, players perform the following steps:
> 70.1 STEP 1—SCORE OBJECTIVES: Following initiative order, each player may score up to one public objective and one secret objective that can be fulfilled during the status phase. To score an objective, he must fulfill the requirements on the card; if he does, he gains a number of victory points indicated on the card.
> 70.2 STEP 2—REVEAL PUBLIC OBJECTIVE: The speaker reveals an unrevealed public objective card by flipping that card faceup.
> - The speaker cannot reveal "Stage II" objectives until all "Stage I" objectives are revealed.
> - The game ends if there are no unrevealed public objectives at the start of this step.
> 70.3 STEP 3—DRAW ACTION CARDS: Following initiative order, each player draws one action card.
> 70.4 STEP 4—REMOVE COMMAND TOKENS: Each player removes all of his command tokens from the game board and returns them to his reinforcements.
> 70.5 STEP 5—GAIN AND REDISTRIBUTE COMMAND TOKENS: Each player gains two command tokens from his reinforcements. Then, he can redistribute all of the command tokens on his command sheet, including the two he just gained, among his strategy, tactic, and fleet pools.
> - Players should remember to check the number of their ships in each system after reducing the size of their fleet pools.
> 70.6 STEP 6—READY CARDS: Each player readies all of his exhausted cards, including strategy cards.
> 70.7 STEP 7—REPAIR UNITS: Each player repairs all of his units that have the "Sustain Damage" ability by turning those units upright.
> 70.8 STEP 8—RETURN STRATEGY CARDS: Each player returns his strategy card to the common play area. Then, if a player has removed the custodians token from Mecatol Rex, the game round continues to the agenda phase. Otherwise, a new game round begins with the strategy phase.

## 9. FAQ lines that matter for an implementation (LRR v1.1 FAQ, verbatim)

> Q: Does each unit participating in Bombardment or Space Cannon roll an additional die for the Plasma Scoring technology?
> A: No. "Plasma Scoring" only grants one additional die for each "Bombardment" or "Space Cannon" roll, and the unit benefitting from this technology must be decided before rolling.
>
> Q: When an ability other than "Production" allows you to produce one or more units, do you have to pay for the units produced?
> A: Yes, a unit that is produced must always be paid for.
>
> Q: When producing a unit with an ability other than "Production," does the price reduction from the "Sarween Tools" technology apply?
> A: No, "Sarween Tools" is only used with the "Production" ability.
>
> Q: How should a space combat be resolved if it is mathematically impossible for either side to win—for example, certain configurations of ships using the "Non-Euclidean Shielding" and "Duranium Armor" technologies in concert?
> A: If neither side has the potential to win, the attacker must retreat.
>
> Q: Can fighters block ship movement?
> A: Yes, fighters can block ship movement (this was added as a correction in the Living Rules Reference version 1.1).

## Errata carried in LRR v1.1 (relevant to the tech list)

> HYPER METABOLISM: The text of the "Hyper Metabolism" technology should read as follows: "During the status phase, gain 3 command tokens instead of 2."
>
> DIPLOMACY: The text of the "Diplomacy" strategy card's secondary ability should read as follows: "Spend 1 token from your strategy pool to ready up to 2 exhausted planets you control."
