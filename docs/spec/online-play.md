# Online play, design

The user's framing, verbatim (German, dictated): "Meiner Meinung nach muss man das gar nicht so hart
trennen. Beides bekommt einen Code, also oben in der URL. Wenn ich lokal spiele, werde ich am Anfang
gefragt, ob ich nur einen Player kontrollieren will oder beide. Wenn ich Hot-seat auswähle, kontrolliere
ich beide Spieler auf einem Rechner in einer Session. Wenn ich online auswähle, muss ich mir einen Spieler
auswählen und kann die URL jemand anderem senden, und der kann dann den anderen Spieler auswählen. Und dann
müssen wir die Funktion einbauen, dass im Spiel selbst die Leute nur ihren Player kontrollieren können
anstatt beide."

That is the right shape and it is what this document specifies. There is no separate online product: there
is one game, addressed by its code, and a **seat claim** that says which seats this browser may act for.

## 1. One game, one code, a claim per browser

Every game already has a six-character code and lives at `#/g/<code>`. On top of that the browser holds a
claim for that game:

```ts
type Claim = { seats: Seat[]; playerId: string }   // [0,1] for hot-seat, [0] or [1] online, [] for a watcher
```

- `playerId` is a random id minted once per browser and kept in localStorage. It is the browser's identity,
  never a login.
- The first screen of a game the browser has no claim for asks the one question that matters: **play both
  seats on this device, or take one seat and send the link on.** Hot-seat writes `seats: [0, 1]`, online
  writes the seat picked.
- Opening the link on another device asks the same question, sees the taken seat as taken, and claims the
  free one. A third visitor gets `seats: []` and watches.
- The claim decides what the UI lets you do, not what the engine allows: the engine stays a pure rules
  machine that does not know who is holding the mouse.

## 2. What changes inside the game

- Controls for a seat the claim does not hold are disabled, with one line saying whose turn it is.
- The handoff overlay stays, online as well as in hot-seat. The user asked for it explicitly: "den
  Übergabebildschirm würde ich trotzdem machen, dann sieht man einfach direkt, dass man jetzt dran ist."
  Its wording follows the claim: a both-seats claim reads "Pass the device to <name>", a single-seat claim
  reads "Your turn" and only appears for the seat that is now to act, never for the one that just moved.
  A watcher sees no overlay at all.
- The log, the board, the clocks and every panel stay fully visible to both players and to a watcher. This
  is an open-information duel: the only secret is what someone is about to do.
- Undo is a hot-seat courtesy and stays there: online, a move that is out is out.

## 3. What has to exist for two devices

Nothing above needs a server. The seat claim is browser-local and works today, and it is worth building
first because it makes hot-seat and online the same code path.

Two devices seeing the same game is the part that does need one, and there is no way around it: localStorage
is per browser. The design is deliberately small.

**Sync the move log, not the state.** The engine is deterministic: same seed, same moves, same board. So the
server stores a game row and an append-only list of moves, and every client replays them. That keeps the
payload tiny, makes the whole game auditable, and means a client that was offline catches up by fetching the
moves it missed.

```
games   : code (pk), created_at, config jsonb, seed int, seat0_player text, seat1_player text, minutes int
moves   : code (fk), n int, move jsonb, seat int, at timestamptz, primary key (code, n)
```

- **Appending a move** goes through a Postgres function rather than a plain insert: it checks that the
  caller's `playerId` holds the seat the move claims, and that `n` is exactly the next number. Two clients
  racing on the same number means one of them loses and refetches, which is exactly right.
- **Receiving** is a Supabase Realtime subscription on `moves` for that code. A new row arrives, the client
  applies it to its own state, and the board updates. No polling.
- **Joining** fetches the game row and every move, replays them, and the player is in mid-game.
- **The clock** runs off the move timestamps the server writes, so neither client can cheat it by pausing.
  The seat to act is charged the time between the last move and the next one; the UI ticks locally between
  moves for smoothness and corrects itself on every arriving move.
- **Reconnect and refresh** are the same path as joining, which is what makes this design robust: there is
  no session to keep alive, only a log to replay.

Supabase gives all of this with anonymous keys and row-level security; no accounts, no login, no email. The
`playerId` in the URL-less localStorage is enough identity for a game between two people who share a link.

## 4. Order of work

1. **The seat claim, offline.** The mode question, the claim in localStorage, the controls locked to the
   claim, and the handoff worded from the claim. Hot-seat behaves exactly as today. Nothing else changes.
   This is small and is worth shipping on its own.
2. **The transport.** A Supabase project, the two tables, the append function, the realtime subscription and
   the replay-on-join, behind an interface the store talks to, so a hot-seat game keeps running with no
   network at all.
3. **The clock on server time**, replacing the local tick as the source of truth.
4. **The polish that only matters online:** a "waiting for your opponent" state, a shareable invite panel
   with the link and the code, a watcher mode, and what happens when someone abandons a game.

Steps 1 and 4 are ordinary UI work. Step 2 is the real one, and it is a day of work rather than a week,
because the engine being deterministic and pure removes almost all of the hard parts: no server-side game
logic, no state merging, no authority beyond "is it your turn and is this the next move number".
