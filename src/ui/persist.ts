import type { GameState, Seat } from '../engine/types'
import type { Session } from './store'

/**
 * One browser holds many games, one key each. localStorage rather than cookies: a cookie would ride along
 * with every request to the server, is capped at a few kilobytes and is no less browser-local, so it would
 * buy nothing here and cost bandwidth. Nothing leaves the device either way, which is exactly the point:
 * another browser has its own storage and therefore its own games.
 */
export const LEGACY_KEY = 'md:local'
export const INDEX_KEY = 'md:games'
export const PLAYER_KEY = 'md:player'
export const MAX_GAMES = 20
/** No I, L, O, 0 or 1: a code is read out loud across the table, and those five are misheard. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export function gameKey(code: string): string {
  return `md:game:${code}`
}

/**
 * The clock is written on its own, and often, because it moves ten times a second while the whole game is
 * only written when a move changes it. Without this a reload would hand back every second the player spent
 * thinking since their last move, which is a way to buy time by pressing F5. The record is tiny, so writing
 * it every couple of seconds costs nothing.
 */
export function clockKey(code: string): string {
  return `md:clock:${code}`
}

interface ClockRecord { clockMs: [number, number]; at: number }

function isClockRecord(value: unknown): value is ClockRecord {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Partial<ClockRecord>
  return Array.isArray(c.clockMs) && c.clockMs.length === 2
    && typeof c.clockMs[0] === 'number' && typeof c.clockMs[1] === 'number'
    && typeof c.at === 'number'
}

export function saveClock(code: string, clockMs: [number, number]): void {
  write(clockKey(code), { clockMs, at: Date.now() })
}

export function readClock(code: string): ClockRecord | null {
  const parsed = read(clockKey(code))
  return isClockRecord(parsed) ? parsed : null
}

export function claimKey(code: string): string {
  return `md:claim:${code}`
}

/** What the lobby needs to list a game without parsing the whole state. */
export interface GameSummary {
  code: string
  names: [string, string]
  round: number
  updatedAt: number
}

interface Legacy {
  version: 1
  seed: number
  minutes: number
  clockMs: [number, number]
  state: GameState
  history: GameState[]
}

type Payload = Legacy & GameSummary

function isLegacy(value: unknown): value is Legacy {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Partial<Legacy>
  return p.version === 1 && typeof p.seed === 'number' && typeof p.minutes === 'number'
    && Array.isArray(p.clockMs) && p.clockMs.length === 2
    && Array.isArray(p.history)
    // R7 changed the objectives and with them the shape of a player, so a game saved under version 1 is
    // not readable any more and is dropped rather than crashed into
    && typeof p.state === 'object' && p.state !== null && [2, 3].includes((p.state as { version: number }).version)
}

function isSummary(value: unknown): value is GameSummary {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Partial<GameSummary>
  return typeof s.code === 'string' && s.code.length > 0
    && Array.isArray(s.names) && s.names.length === 2
    && typeof s.names[0] === 'string' && typeof s.names[1] === 'string'
    && typeof s.round === 'number' && typeof s.updatedAt === 'number'
}

/**
 * R3.2: `turnDone` arrived after the first deploys, so a payload written before it has no such field. It
 * loads as a turn whose action is still open, the only safe reading, which keeps a game in progress playable
 * across the deploy; rejecting the payload would throw the game away instead.
 */
/**
 * A payload written by an older build lacks the fields that version's rules did not have yet. Reading it as
 * the current shape keeps a game in progress playable across a deploy, which is the whole point of saving it;
 * rejecting it would throw the game away. Each step states what the missing field must mean:
 * `turnDone` false (the action is still open), and for a game from before the trade posts had names, the
 * pair the status phase would have rolled anyway, unused.
 */
function normalise(state: GameState): GameState {
  const raw = state as unknown as Partial<GameState> & { turnDone?: unknown; posts?: unknown }
  let next = state
  if (typeof raw.turnDone !== 'boolean') next = { ...next, turnDone: false }
  if (typeof raw.posts !== 'object' || raw.posts === null) {
    next = { ...next, posts: { west: 'sarnex', east: 'kesh' }, postAbilityUsed: { west: false, east: false } }
  }
  return next.version === 3 ? next : { ...next, version: 3 }
}

function isPayload(value: unknown): value is Payload {
  return isLegacy(value) && isSummary(value)
}

// Every access is wrapped: a blocked, full or foreign storage must never throw into the UI.
function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // a full or blocked storage must never break the game in progress
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // nothing to do
  }
}

function present(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

export function hasGame(code: string): boolean {
  return present(gameKey(code))
}

/** Six characters, redrawn while the browser already holds that code; the loop is bounded, never endless. */
export function newGameCode(exists: (code: string) => boolean): string {
  const draw = () => {
    let code = ''
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    return code
  }
  // `Math.random`, never the engine's seeded RNG: the game seed stays reproducible and independent
  let code = draw()
  for (let attempt = 0; attempt < 100 && exists(code); attempt += 1) code = draw()
  return code
}

/**
 * Which seats one browser may act for in one game: `[0, 1]` hot-seat, `[0]` or `[1]` when the link went to
 * someone else, `[]` for a watcher. It is a UI claim and nothing more: the engine stays a pure rules machine
 * that does not know who is holding the mouse.
 */
export interface Claim {
  seats: Seat[]
  playerId: string
}

function isSeat(value: unknown): value is Seat {
  return value === 0 || value === 1
}

function isClaim(value: unknown): value is Claim {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Partial<Claim>
  if (typeof c.playerId !== 'string' || c.playerId.length === 0) return false
  // a seat claimed twice is a claim nobody wrote on purpose, so it is dropped rather than trusted
  return Array.isArray(c.seats) && c.seats.every(isSeat) && new Set<unknown>(c.seats).size === c.seats.length
}

function mint(): string {
  const source = globalThis.crypto as Crypto | undefined
  if (source && typeof source.randomUUID === 'function') return source.randomUUID()
  return `p-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`
}

/**
 * The browser's identity, minted once and reused for every game it ever opens. Never a login and never a
 * name: it says "the same browser as before", nothing else. A storage that was cleared or is blocked simply
 * makes a new visitor, which costs a claim and no game.
 */
export function playerId(): string {
  const stored = read(PLAYER_KEY)
  if (typeof stored === 'string' && stored.length > 0) return stored
  const minted = mint()
  write(PLAYER_KEY, minted)
  return minted
}

/** Every claim this browser knows for one game: its own, and later the ones the server tells it about. */
export function readClaims(code: string): Claim[] {
  const parsed = read(claimKey(code))
  if (!Array.isArray(parsed)) return []
  return (parsed as unknown[]).filter(isClaim)
}

/** What this browser claimed for one game, or null while it has not answered the mode question yet. */
export function readClaim(code: string, id: string): Claim | null {
  return readClaims(code).find(entry => entry.playerId === id) ?? null
}

/** Writes one browser's claim, replacing whatever that same browser claimed before and only that. */
export function writeClaim(code: string, claim: Claim): void {
  write(claimKey(code), [claim, ...readClaims(code).filter(entry => entry.playerId !== claim.playerId)])
}

/**
 * The seats this browser may act for. No claim at all means both: a game saved before claims existed, or a
 * board rendered without one, is the hot-seat it has always been. An empty claim is a watcher, which is a
 * decision somebody made and therefore is not the same thing as no claim.
 */
export function actingSeats(claim: Claim | null): Seat[] {
  return claim === null ? [0, 1] : claim.seats
}

/** The seats a visitor can still take: every seat no other browser holds. Its own seat never blocks it. */
export function openSeats(claims: Claim[], id: string): Seat[] {
  const taken = new Set<Seat>(claims.filter(entry => entry.playerId !== id).flatMap(entry => entry.seats))
  return ([0, 1] as Seat[]).filter(seat => !taken.has(seat))
}

function readIndex(): GameSummary[] {
  const parsed = read(INDEX_KEY)
  if (!Array.isArray(parsed)) return []
  // stable sort: entries written in the same millisecond keep the order they were written in
  return (parsed as unknown[]).filter(isSummary).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** A game that is gone takes its seat claim with it; a stale claim would answer a question nobody asked. */
function forget(code: string): void {
  remove(gameKey(code))
  remove(claimKey(code))
  remove(clockKey(code))
}

function store(session: Session): void {
  const summary: GameSummary = {
    code: session.code,
    names: [session.state.players[0].name, session.state.players[1].name],
    round: session.state.round,
    updatedAt: Date.now(),
  }
  const payload: Payload = {
    ...summary, version: 1, seed: session.seed, minutes: session.minutes,
    clockMs: session.clockMs, state: session.state, history: session.history,
  }
  write(gameKey(session.code), payload)
  const entries = [summary, ...readIndex().filter(e => e.code !== session.code)]
  for (const dropped of entries.slice(MAX_GAMES)) forget(dropped.code)
  write(INDEX_KEY, entries.slice(0, MAX_GAMES))
}

/**
 * The first version kept one game under `md:local` and no code at all. The first read of any kind turns it
 * into a coded game, so a player who left a game running before this version simply finds it in the list.
 */
function migrate(): void {
  if (!present(LEGACY_KEY)) return
  const parsed = read(LEGACY_KEY)
  if (isLegacy(parsed)) {
    store({
      code: newGameCode(hasGame), seed: parsed.seed, minutes: parsed.minutes,
      state: normalise(parsed.state), history: parsed.history.map(normalise), clockMs: parsed.clockMs, handoff: null,
    })
  }
  remove(LEGACY_KEY)
}

export function listGames(): GameSummary[] {
  migrate()
  // an index entry whose payload is gone, or was written by an older version of the game, would be a row
  // that resumes into nothing, so it is dropped from the list and from storage
  const out: GameSummary[] = []
  for (const entry of readIndex()) {
    if (isPayload(read(gameKey(entry.code)))) out.push(entry)
    else forget(entry.code)
  }
  if (out.length !== readIndex().length) write(INDEX_KEY, out)
  return out
}

export function latestGameCode(): string | null {
  return listGames()[0]?.code ?? null
}

export function saveGame(session: Session): void {
  migrate()
  store(session)
}

export function loadGame(code: string): Session | null {
  migrate()
  const parsed = read(gameKey(code))
  if (!isPayload(parsed)) return null
  // the clock record is younger than the game whenever the player was thinking, so it wins
  const clock = readClock(code)
  const clockMs = clock && clock.at >= parsed.updatedAt ? clock.clockMs : parsed.clockMs
  return {
    code: parsed.code, seed: parsed.seed, minutes: parsed.minutes,
    state: normalise(parsed.state), history: parsed.history.map(normalise), clockMs, handoff: null,
  }
}

export function deleteGame(code: string): void {
  migrate()
  forget(code)
  write(INDEX_KEY, readIndex().filter(entry => entry.code !== code))
}
