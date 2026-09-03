// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { toActionPhase } from '../engine/testUtils'
import {
  CODE_ALPHABET, INDEX_KEY, LEGACY_KEY, MAX_GAMES, PLAYER_KEY,
  actingSeats, claimKey, deleteGame, gameKey, hasGame, latestGameCode, listGames, loadGame,
  newGameCode, openSeats, playerId, readClaim, readClaims, saveGame, writeClaim,
} from './persist'
import type { Claim } from './persist'
import type { Session } from './store'

function session(code: string, clockMs: [number, number] = [123456, 654321]): Session {
  return { code, seed: 7, minutes: 15, state: toActionPhase(), history: [], clockMs, handoff: null }
}

describe('the saved games of one browser', () => {
  it('round-trips seed, clocks, state and history under the game code', () => {
    saveGame(session('ABC234'))
    const loaded = loadGame('ABC234')
    expect(loaded?.code).toBe('ABC234')
    expect(loaded?.seed).toBe(7)
    expect(loaded?.clockMs).toEqual([123456, 654321])
    expect(loaded?.state.phase).toBe('action')
    expect(loaded?.state.systems['home-n'].space).toHaveLength(5)
    expect(loaded?.handoff).toBeNull()
  })

  it('keeps two games side by side, each under its own key', () => {
    saveGame(session('AAA222'))
    saveGame(session('BBB333', [1000, 2000]))
    expect(loadGame('AAA222')?.clockMs).toEqual([123456, 654321])
    expect(loadGame('BBB333')?.clockMs).toEqual([1000, 2000])
    expect(hasGame('AAA222')).toBe(true)
    expect(hasGame('CCC444')).toBe(false)
  })

  it('indexes the games newest first, with the names and the round', () => {
    saveGame(session('AAA222'))
    saveGame(session('BBB333'))
    const listed = listGames()
    expect(listed.map(g => g.code)).toEqual(['BBB333', 'AAA222'])
    expect(listed[0].names).toEqual(['A', 'B'])
    expect(listed[0].round).toBe(1)
    expect(listed[0].updatedAt).toBeGreaterThan(0)
    expect(latestGameCode()).toBe('BBB333')
    // saving the older game again moves it back to the front
    saveGame(session('AAA222'))
    expect(latestGameCode()).toBe('AAA222')
  })

  it(`keeps at most ${String(MAX_GAMES)} games and drops the payloads it prunes`, () => {
    const codes = Array.from({ length: MAX_GAMES + 2 }, (_, i) => `G${String(i).padStart(5, '0')}`)
    for (const code of codes) saveGame(session(code))
    const listed = listGames().map(g => g.code)
    expect(listed).toHaveLength(MAX_GAMES)
    expect(listed[0]).toBe(codes[codes.length - 1])
    expect(listed).not.toContain(codes[0])
    expect(listed).not.toContain(codes[1])
    expect(window.localStorage.getItem(gameKey(codes[0]))).toBeNull()
    expect(window.localStorage.getItem(gameKey(codes[codes.length - 1]))).not.toBeNull()
  })

  it('deletes one game without touching the others', () => {
    saveGame(session('KEE222'))
    saveGame(session('DEL222'))
    deleteGame('DEL222')
    expect(loadGame('DEL222')).toBeNull()
    expect(loadGame('KEE222')?.seed).toBe(7)
    expect(listGames().map(g => g.code)).toEqual(['KEE222'])
  })

  it('R3.2: a game saved before turnDone existed loads with the flag cleared, not rejected', () => {
    // exactly what a deployed payload from before that change looks like: no `turnDone`, in the state and in
    // every history entry the undo stack still holds
    saveGame({ ...session('OLD222'), history: [session('OLD222').state] })
    const raw = JSON.parse(window.localStorage.getItem(gameKey('OLD222')) ?? '') as {
      state: Record<string, unknown>; history: Record<string, unknown>[]
    }
    delete raw.state.turnDone
    delete raw.history[0].turnDone
    window.localStorage.setItem(gameKey('OLD222'), JSON.stringify(raw))
    const loaded = loadGame('OLD222')
    expect(loaded).not.toBeNull()
    expect(loaded?.state.turnDone).toBe(false)
    expect(loaded?.history[0].turnDone).toBe(false)
  })

  it('migrates the single game of the first version to a coded game', () => {
    const legacy = { version: 1, seed: 42, minutes: 20, clockMs: [1000, 2000], state: toActionPhase(), history: [] }
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
    const listed = listGames()
    expect(listed).toHaveLength(1)
    expect(listed[0].code).toHaveLength(6)
    expect([...listed[0].code].every(c => CODE_ALPHABET.includes(c))).toBe(true)
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull()
    const migrated = loadGame(listed[0].code)
    expect(migrated?.seed).toBe(42)
    expect(migrated?.minutes).toBe(20)
    expect(migrated?.clockMs).toEqual([1000, 2000])
    expect(migrated?.state.phase).toBe('action')
  })

  it('ignores an empty, broken or foreign payload instead of throwing', () => {
    expect(loadGame('NOPE22')).toBeNull()
    window.localStorage.setItem(gameKey('BAD222'), 'not json')
    expect(loadGame('BAD222')).toBeNull()
    window.localStorage.setItem(gameKey('OLD222'), JSON.stringify({ version: 99, state: {} }))
    expect(loadGame('OLD222')).toBeNull()
    window.localStorage.setItem(INDEX_KEY, 'not json')
    expect(listGames()).toEqual([])
    window.localStorage.setItem(LEGACY_KEY, 'not json')
    expect(listGames()).toEqual([])
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('survives a blocked or full storage', () => {
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => { saveGame(session('FUL222')) }).not.toThrow()
    blocked.mockRestore()
    expect(loadGame('FUL222')).toBeNull()
  })
})

describe('the game code', () => {
  it('is six characters that cannot be misread aloud', () => {
    expect(CODE_ALPHABET).not.toMatch(/[ILO01]/)
    for (let i = 0; i < 200; i += 1) {
      const code = newGameCode(() => false)
      expect(code).toHaveLength(6)
      expect([...code].every(c => CODE_ALPHABET.includes(c))).toBe(true)
    }
  })

  it('is drawn again when it collides with a game this browser already holds', () => {
    const values = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
    let i = 0
    const random = vi.spyOn(Math, 'random').mockImplementation(() => values[i++] ?? 0.5)
    expect(newGameCode(code => code === 'AAAAAA')).toBe('SSSSSS')
    random.mockRestore()

  })
})

describe('the identity of one browser', () => {
  it('mints a player id once and reuses it for every game', () => {
    const first = playerId()
    expect(first.length).toBeGreaterThan(8)
    expect(playerId()).toBe(first)
    expect(window.localStorage.getItem(PLAYER_KEY)).toContain(first)
  })

  it('is a new visitor once the storage is gone', () => {
    const first = playerId()
    window.localStorage.clear()
    expect(playerId()).not.toBe(first)
  })

  it('survives a blocked storage by minting an id it cannot keep', () => {
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => playerId()).not.toThrow()
    expect(playerId().length).toBeGreaterThan(8)
    blocked.mockRestore()
  })
})

describe('the seat claim of one browser on one game', () => {
  const ME = 'me-1234'
  const THEM = 'them-5678'

  it('writes and reads a claim under the game code, one code at a time', () => {
    writeClaim('AAA222', { seats: [0], playerId: ME })
    writeClaim('BBB333', { seats: [0, 1], playerId: ME })
    expect(readClaim('AAA222', ME)).toEqual({ seats: [0], playerId: ME })
    expect(readClaim('BBB333', ME)).toEqual({ seats: [0, 1], playerId: ME })
    expect(readClaim('CCC444', ME)).toBeNull()
    expect(window.localStorage.getItem(claimKey('AAA222'))).not.toBeNull()
  })

  it('replaces what the same browser claimed before and leaves other browsers alone', () => {
    writeClaim('AAA222', { seats: [0], playerId: THEM })
    writeClaim('AAA222', { seats: [1], playerId: ME })
    writeClaim('AAA222', { seats: [], playerId: ME })
    expect(readClaim('AAA222', ME)).toEqual({ seats: [], playerId: ME })
    expect(readClaim('AAA222', THEM)).toEqual({ seats: [0], playerId: THEM })
    expect(readClaims('AAA222')).toHaveLength(2)
  })

  it('ignores an empty, broken or foreign claim instead of throwing', () => {
    expect(readClaims('NOPE22')).toEqual([])
    window.localStorage.setItem(claimKey('BAD222'), 'not json')
    expect(readClaims('BAD222')).toEqual([])
    window.localStorage.setItem(claimKey('ODD222'), JSON.stringify([
      { seats: [0], playerId: ME },      // the one good entry
      { seats: [2], playerId: THEM },    // no such seat
      { seats: [0, 0], playerId: THEM }, // the same seat twice
      { seats: [1] },                    // nobody holds it
      'nonsense',
    ]))
    expect(readClaims('ODD222')).toEqual([{ seats: [0], playerId: ME }])
  })

  it('survives a blocked storage', () => {
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => { writeClaim('FUL222', { seats: [0, 1], playerId: ME }) }).not.toThrow()
    blocked.mockRestore()
    expect(readClaim('FUL222', ME)).toBeNull()
  })

  it('forgets the claim with the game', () => {
    saveGame(session('DEL222'))
    writeClaim('DEL222', { seats: [0, 1], playerId: ME })
    deleteGame('DEL222')
    expect(readClaim('DEL222', ME)).toBeNull()
    expect(window.localStorage.getItem(claimKey('DEL222'))).toBeNull()
  })

  it('forgets the claim of a game pruned out of the list', () => {
    const codes = Array.from({ length: MAX_GAMES + 1 }, (_, i) => `G${String(i).padStart(5, '0')}`)
    for (const code of codes) {
      saveGame(session(code))
      writeClaim(code, { seats: [0, 1], playerId: ME })
    }
    expect(readClaim(codes[0], ME)).toBeNull()
    expect(readClaim(codes[codes.length - 1], ME)).not.toBeNull()
  })
})

describe('which seats a browser may act for', () => {
  const ME = 'me-1234'
  const THEM = 'them-5678'
  const claim = (seats: Claim['seats'], id = ME): Claim => ({ seats, playerId: id })

  it('reads the seats straight off the claim', () => {
    expect(actingSeats(claim([0, 1]))).toEqual([0, 1])
    expect(actingSeats(claim([1]))).toEqual([1])
    expect(actingSeats(claim([]))).toEqual([])
  })

  it('plays both seats when there is no claim at all: that is what hot-seat was before claims existed', () => {
    expect(actingSeats(null)).toEqual([0, 1])
  })

  it('offers every seat no other browser holds, the visitor\'s own seat included', () => {
    expect(openSeats([], ME)).toEqual([0, 1])
    expect(openSeats([claim([0], THEM)], ME)).toEqual([1])
    expect(openSeats([claim([1], THEM)], ME)).toEqual([0])
    expect(openSeats([claim([0], ME)], ME)).toEqual([0, 1])
    expect(openSeats([claim([], THEM)], ME)).toEqual([0, 1])
  })

  it('leaves no seat for a visitor who arrives at a game two browsers already hold', () => {
    expect(openSeats([claim([0], THEM), claim([1], 'third')], ME)).toEqual([])
    expect(openSeats([claim([0, 1], THEM)], ME)).toEqual([])
  })
})

describe('a game saved by an older version of the rules', () => {
  it('is dropped instead of loaded, and disappears from the list', () => {
    saveGame(session('OLDONE'))
    expect(loadGame('OLDONE')).toBeTruthy()
    // the shape of version 1: the objectives and the player fields it carried are gone
    const raw = JSON.parse(window.localStorage.getItem('md:game:OLDONE') ?? '{}') as { state: { version: number } }
    raw.state.version = 1
    window.localStorage.setItem('md:game:OLDONE', JSON.stringify(raw))
    expect(loadGame('OLDONE')).toBeNull()
    expect(listGames().map(g => g.code)).not.toContain('OLDONE')
  })
})
