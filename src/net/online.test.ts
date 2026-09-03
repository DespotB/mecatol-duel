import { describe, expect, it, vi } from 'vitest'
import { supabaseTransport } from './online'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameConfig, Move } from '../engine/types'

const CONFIG: GameConfig = {
  players: [
    { faction: 'l1z1x', color: 'blue', name: 'Ada' },
    { faction: 'letnev', color: 'red', name: 'Bo' },
  ],
  speaker: 0,
}
const MOVE: Move = { type: 'endTurn' }

/** A Supabase double: the three functions answer from `rpc`, the two tables from `rows`. */
function fake(options: {
  rpc?: Record<string, { data?: unknown; error?: { message: string } }>
  game?: unknown
  moves?: unknown[]
} = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const table = (rows: unknown) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => Promise.resolve({ data: rows, error: null }),
      maybeSingle: () => Promise.resolve({ data: rows, error: null }),
    }
    return chain
  }
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return Promise.resolve(options.rpc?.[name] ?? { data: true, error: null })
    },
    from: (name: string) => table(name === 'games' ? options.game ?? null : options.moves ?? []),
  } as unknown as SupabaseClient
  return { client, calls }
}

describe('the online transport', () => {
  it('creates a game through the checked function, with the seat the host took', async () => {
    const { client, calls } = fake()
    await supabaseTransport(client).create(
      { code: 'UXD489', seed: 7, minutes: 15, config: CONFIG, players: ['me', null] }, 'me', 0,
    )
    expect(calls[0]?.name).toBe('create_game')
    expect(calls[0]?.args).toMatchObject({ p_code: 'UXD489', p_seed: 7, p_minutes: 15, p_player: 'me', p_seat: 0 })
  })

  it('reports a seat someone else holds as taken rather than throwing', async () => {
    const { client } = fake({ rpc: { claim_seat: { data: false } } })
    await expect(supabaseTransport(client).claim('UXD489', 'me', 1)).resolves.toBe(false)
  })

  /** Losing the race is the normal outcome of two clients moving at once, not an error to report. */
  it('reports a lost race on append as false', async () => {
    const { client } = fake({ rpc: { append_move: { data: false } } })
    await expect(supabaseTransport(client).append('UXD489', 'me', 0, 4, MOVE)).resolves.toBe(false)
  })

  it('turns a database error into a thrown error, so a caller cannot mistake it for a refusal', async () => {
    const { client } = fake({ rpc: { append_move: { error: { message: 'no such game' } } } })
    await expect(supabaseTransport(client).append('UXD489', 'me', 0, 0, MOVE)).rejects.toThrow('no such game')
  })

  it('loads a game and its whole log, seats and all', async () => {
    const { client } = fake({
      game: { code: 'UXD489', seed: 7, minutes: 15, config: CONFIG, seat0_player: 'ada', seat1_player: null },
      moves: [{ n: 0, seat: 0, move: MOVE }, { n: 1, seat: 1, move: MOVE }],
    })
    const loaded = await supabaseTransport(client).load('UXD489')
    expect(loaded?.game.players).toEqual(['ada', null])
    expect(loaded?.moves.map(m => m.n)).toEqual([0, 1])
    expect(loaded?.moves[1]?.seat).toBe(1)
  })

  it('answers a code no game carries with null', async () => {
    const { client } = fake({ game: null })
    await expect(supabaseTransport(client).load('ZZZZZZ')).resolves.toBeNull()
  })

  it('subscribes to the moves of one game and hands back the way to stop', () => {
    const remove = vi.fn()
    const channel = { on: vi.fn(), subscribe: vi.fn() }
    channel.on.mockReturnValue(channel)
    channel.subscribe.mockReturnValue(channel)
    const client = { channel: () => channel, removeChannel: remove } as unknown as SupabaseClient
    const stop = supabaseTransport(client).watch('UXD489', () => undefined)
    expect(channel.on.mock.calls[0]?.[1]).toMatchObject({ table: 'moves', filter: 'code=eq.UXD489' })
    stop()
    expect(remove).toHaveBeenCalledWith(channel)
  })
})
