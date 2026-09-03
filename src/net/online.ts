import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameConfig, Move, Seat } from '../engine/types'

/**
 * The online transport, and the only place that knows a server exists.
 *
 * The engine is deterministic, so nothing here ever carries a game state: a game is its seed, its config
 * and an append-only list of moves, and every client replays that list to arrive at the same board. Joining,
 * reconnecting and refreshing are therefore one operation, `load`, and there is no session to keep alive.
 *
 * Writing goes through the three security definer functions in supabase/migrations/0001_games_and_moves.sql,
 * never through a plain insert: the server, not the client, checks that a caller holds the seat it claims
 * and that the move number is the next one. `append` returning false is not an error, it is this client
 * having lost a race, and the answer to it is to reload the log and try again.
 */

export interface OnlineGame {
  code: string
  seed: number
  minutes: number
  config: GameConfig
  /** The player id holding each seat, or null while the seat is open. */
  players: [string | null, string | null]
}

export interface OnlineMove {
  n: number
  seat: Seat
  move: Move
}

export interface Transport {
  /** Writes the game row and takes `seat` for `player`. The other seat stays open for the link. */
  create(game: OnlineGame, player: string, seat: Seat): Promise<void>
  /** Takes the seat if it is free or already this player's; false means someone else holds it. */
  claim(code: string, player: string, seat: Seat): Promise<boolean>
  /** Appends move number `n`; false means the seat is not this player's or `n` was not the next number. */
  append(code: string, player: string, seat: Seat, n: number, move: Move): Promise<boolean>
  /** The game and its whole log, or null when no game carries that code. */
  load(code: string): Promise<{ game: OnlineGame; moves: OnlineMove[] } | null>
  /** Calls `onMove` for every move appended from here on. The returned function ends the subscription. */
  watch(code: string, onMove: (move: OnlineMove) => void): () => void
}

interface GameRow {
  code: string
  seed: number
  minutes: number
  config: GameConfig
  seat0_player: string | null
  seat1_player: string | null
}

interface MoveRow {
  n: number
  seat: number
  move: Move
}

function toGame(row: GameRow): OnlineGame {
  return {
    code: row.code, seed: row.seed, minutes: row.minutes, config: row.config,
    players: [row.seat0_player, row.seat1_player],
  }
}

function toMove(row: MoveRow): OnlineMove {
  return { n: row.n, seat: (row.seat === 1 ? 1 : 0) as Seat, move: row.move }
}

export function supabaseTransport(client: SupabaseClient): Transport {
  return {
    async create(game, player, seat) {
      const { error } = await client.rpc('create_game', {
        p_code: game.code, p_seed: game.seed, p_minutes: game.minutes,
        p_config: game.config, p_player: player, p_seat: seat,
      })
      if (error) throw new Error(error.message)
    },

    async claim(code, player, seat) {
      const { data, error } = await client.rpc('claim_seat', { p_code: code, p_player: player, p_seat: seat })
      if (error) throw new Error(error.message)
      return data === true
    },

    async append(code, player, seat, n, move) {
      const { data, error } = await client.rpc('append_move', {
        p_code: code, p_player: player, p_seat: seat, p_n: n, p_move: move,
      })
      if (error) throw new Error(error.message)
      return data === true
    },

    async load(code) {
      const game = await client.from('games').select('*').eq('code', code).maybeSingle()
      if (game.error) throw new Error(game.error.message)
      if (!game.data) return null
      const moves = await client.from('moves').select('n,seat,move').eq('code', code).order('n')
      if (moves.error) throw new Error(moves.error.message)
      return {
        game: toGame(game.data as GameRow),
        moves: (moves.data as MoveRow[] | null ?? []).map(toMove),
      }
    },

    watch(code, onMove) {
      const channel = client
        .channel(`moves:${code}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'moves', filter: `code=eq.${code}` },
          payload => { onMove(toMove(payload.new as MoveRow)) },
        )
        .subscribe()
      return () => { void client.removeChannel(channel) }
    },
  }
}

/**
 * The transport this build was configured with, or null when it was built without the two environment
 * variables. Null is a supported state, not a failure: the game then behaves exactly as it did before there
 * was a server, hot-seat only, saved in the browser.
 */
export const transport: Transport | null = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key) return null
  return supabaseTransport(createClient(url, key, { auth: { persistSession: false } }))
})()

/** Whether this build can reach a server at all. The lobby offers online play only when it can. */
export function onlineAvailable(): boolean {
  return transport !== null
}
