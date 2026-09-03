# Trade posts, specification v1

Two neutral trade posts sit outside the map, one west and one east. Until now both were the same
anonymous station. From this version there are **six named posts**, each with its own model and its own
ability, and every game rolls **two different ones**, one for each side.

The user's ruling, verbatim (German, dictated): "Ich finde sie gut, ich will dass sie alle ins Spiel
kommen, und bei jedem Spiel werden zufällig zwei gespawnt, also eine links und eine rechts. Es wird
zufällig zwischen diesen sechs ausgewählt. Die haben alle unterschiedliche Fähigkeiten. […] Man soll bei
jedem mindestens zwei Commodities tauschen können, bei denen die mehr können, mehr und vielleicht noch was
anderes."

## 1. Which posts are in play

**The posts change every round.** `createGame` rolls the first pair from the seeded RNG: draw one of the six
for the west, then one of the remaining five for the east. At the start of every later round a new pair is
rolled the same way, **excluding the two that were in play in the round before**, so the draw is from the
other four. A post can come back later, just never in the round straight after its own.

The user's ruling, verbatim (German, dictated): "In jeder Runde sollen neue Trading-Schiffe kommen, und die
zwei, die gerade waren, können nächste Runde nicht nochmal kommen. Es werden immer random zwei neu gespawnt,
aber nicht die zwei, die schon waren. Nicht jeden Zug, jede neue Runde."

The pair lives in the game state (`state.posts = { west, east }`), so a replay of the same seed produces the
same posts in the same rounds. The roll happens in the status phase, in the same step that readies the board
for the next round, and it is logged like every other roll. The linked systems stay as they are: west is
linked to `sakulag` and `starpoint`, east to `bereg` and `quann`.

Because the posts turn over, an ability nobody used is gone with them: the pressure to take a post's offer
while it is there is deliberate.

## 2. What every post can do

Every post sells commodities, which is the base ability and unchanged in shape: on your own turn, if you
control at least one planet in a system linked to that post, you may sell commodities for one trade good
each. **Once per round per post per player**, as today.

- Five of the six posts take **up to 2 commodities**.
- The **Sarnex Wheel** takes **up to 4**.

## 3. The special abilities

Each post has one special ability on top of the commodity sale. A special ability is **once per round for
the whole table**: the first player to use it takes it, and the other player cannot use that post's special
ability until the next round. The commodity sale stays available to both.

A special ability follows the same turn rules as the sale: your own turn, no tactical action running, no
open secondary window, not after you have passed, and you must control a planet in one of the post's linked
systems.

| Post | Model | Commodities | Special ability |
| --- | --- | --- | --- |
| Sarnex Wheel | ring habitat | up to 4 | none, its size is its ability |
| Tessik Refinery | industrial platform | up to 2 | **Technology exchange:** return one general technology you own and take another general technology of the same tier in a different colour. Prerequisites are ignored. Unit upgrades and faction technologies are excluded on both sides of the trade. |
| Orrun Port Authority | layered disc port | up to 2 | **Clearing house:** exhaust your ready planets and take one trade good per resource or influence spent, up to 3 trade goods. Each planet is exhausted once and pays either its resources or its influence, your choice, never both. |
| Kesh Line Freighter | container freighter | up to 2 | **Charter:** return one command token from any pool (tactic, fleet or strategy) and take 4 trade goods. |
| Vandel Bulk Tanker | bulk tanker | up to 2 | **Layover:** return one command token from any pool and take 3 more minutes on your chess clock. |
| Dromm Heavy Hauler | open-deck hauler | up to 2 | **Refit:** return ships you have in a system linked to this post and take one ship from your reinforcements whose cost is not higher than the total cost you returned. The new ship is placed in the same system. Any difference in cost is lost. Fighters and infantry cannot be part of a refit. |

Notes that follow from the rules already in the engine:

- **Tier** for the technology exchange is the number of prerequisites a technology prints, that is the sum
  of its colour requirements. Same tier, different colour, both sides general technologies.
- **Refit** may not put more non-fighter ships into the system than the fleet pool allows, and the flagship
  and the War Sun follow their usual limits (one flagship at a time, War Sun needs no technology).
- **Layover** is the one ability the engine cannot resolve on its own, because the engine is time-free. The
  move is recorded like any other and the UI adds the three minutes to that seat's clock when it applies it.
- A returned command token goes back to the player's reinforcements, it is not placed on the board.

## 4. What the player sees

The two posts are drawn beside the map with their own rendered model, their name, their commodity limit and
their special ability in one line. A post whose special ability has been used this round says so. The rules
page lists all six with their pictures.

Each post is **visibly wired to the two systems it serves**: a hyperlane runs from the post to each of its
linked tiles, drawn in the game's own lane style, so the connection is readable without opening a panel.
The user's words: "mach irgendwie klar sichtlich, dass man mit denen traden kann, wenn man auf einem dieser
beiden Hexes steht, vielleicht machst du sowas wie eine Hyperlane hin zu jeweils den beiden Hexes." A lane
whose system the player controls a planet in is lit; the other lane stays dim. When the post is out of
reach for both players the lanes are dim and the post's panel says why.
