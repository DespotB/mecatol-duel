import { TRADE_POSTS } from '../data/map'
import { POSTS } from '../data/posts'
import { TECHS, findTech } from '../data/techs'
import { SHIP_TYPES, unitStats } from '../data/units'
import { checkFleet } from './board'
import { turnReady } from './componentActions'
import { exhaustPlanets } from './economy'
import { addVp } from './objectives'
import type { PostDef } from '../data/posts'
import type { TechDef } from '../data/techs'
import type { StatsOwner } from '../data/units'
import type { GameState, PostAbilityParams, Result, Seat, TechColor, Unit, UnitType } from './types'

/** R8: the post in play on that side this round. */
export function postDef(state: GameState, post: 'west' | 'east'): PostDef {
  return POSTS[state.posts[post]]
}

/** The tier of a technology is the number of prerequisites it prints, the sum of its colour requirements. */
function tier(prereq: Partial<Record<TechColor, number>>): number {
  return Object.values(prereq).reduce((sum: number, n) => sum + (n ?? 0), 0)
}

/**
 * R8: the shared preconditions of every special ability. They are the ones the commodity sale already has
 * (your own turn, no tactical action, no open secondary window, not passed, a planet in a linked system),
 * plus the one that is the ability's own: nobody at the table has taken it this round.
 */
function abilityReady(state: GameState, post: 'west' | 'east'): Result<Seat> {
  const ready = turnReady(state)
  if (!ready.ok) return ready
  const seat = ready.value
  const def = postDef(state, post)
  if (state.postAbilityUsed[post]) return { ok: false, error: `R8: the ${def.name} ability is used this round` }
  if (!TRADE_POSTS[post].some(id => state.systems[id].planets.some(p => p.owner === seat))) {
    return { ok: false, error: `R8: no planet controlled in a system linked to the ${post} post` }
  }
  return { ok: true, value: seat }
}

/** Every general technology; the exchange never touches a unit upgrade or a faction technology. */
function generalTechs(): TechDef[] {
  return TECHS.filter(t => t.kind === 'general')
}

/** R8, Tessik Refinery: what a general technology may be traded for, same tier and a different colour. */
export function exchangeTargets(state: GameState, seat: Seat, techId: string): string[] {
  const given = findTech(techId)
  if (!given || given.kind !== 'general') return []
  const owned = state.players[seat].techs
  if (!owned.includes(techId)) return []
  return generalTechs()
    .filter(t => t.id !== techId && !owned.includes(t.id) && t.colour !== given.colour && tier(t.prereq) === tier(given.prereq))
    .map(t => t.id)
}

/**
 * R8, Dromm Heavy Hauler: what a ship is worth in a refit. A fighter costs 1 for 2, so it is worth half a
 * cost and a dreadnought is worth eight of them; that is what "counts fighters at their real value" means.
 */
export function refitValue(type: UnitType, stats: StatsOwner): number {
  const printed = unitStats(type, stats)
  return printed.cost / printed.producedPerCost
}

/** R8: a refit moves ships, never infantry, which is no ship. */
export const REFIT_TYPES: readonly UnitType[] = SHIP_TYPES

function refitShips(state: GameState, seat: Seat, systemId: string): Unit[] {
  return state.systems[systemId].space.filter(u => u.owner === seat && REFIT_TYPES.includes(u.type))
}

function statsOf(state: GameState, seat: Seat): StatsOwner {
  const player = state.players[seat]
  return { faction: player.faction, techs: player.techs }
}

/**
 * R8: what the seat could legally do at that post right now, in the shape the UI needs. It is an offer list,
 * not an enumeration of every combination: the refit takes a set of ships on each side and the panel builds
 * those from the state, so one playable representative per choice is enough there.
 */
export function postAbilityOptions(state: GameState, seat: Seat, post: 'west' | 'east'): PostAbilityParams[] {
  const ready = abilityReady(state, post)
  if (!ready.ok || ready.value !== seat) return []
  const player = state.players[seat]
  const out: PostAbilityParams[] = []
  switch (postDef(state, post).ability) {
    case 'timeTrade':
      // the clock is the UI's business, so there is nothing to choose and nothing that can make it illegal
      return [{}]
    case 'techExchange':
      for (const techId of player.techs) {
        for (const takeTechId of exchangeTargets(state, seat, techId)) out.push({ techId, takeTechId })
      }
      return out
    case 'clearingHouse':
      for (const sys of Object.values(state.systems)) {
        for (const p of sys.planets) {
          if (p.owner !== seat || p.exhausted) continue
          if (p.resources >= 1) out.push({ planet: p.id, pay: 'resources' })
          if (p.influence >= 1) out.push({ planet: p.id, pay: 'influence' })
        }
      }
      return out
    case 'charter':
    case 'layover':
      return (['tactic', 'fleet', 'strategy'] as const).filter(pool => player.tokens[pool] >= 1).map(pool => ({ pool }))
    case 'refit': {
      const stats = statsOf(state, seat)
      for (const systemId of TRADE_POSTS[post]) {
        for (const ship of refitShips(state, seat, systemId)) {
          const budget = refitValue(ship.type, stats)
          for (const take of REFIT_TYPES) {
            if (player.reinforcements[take] < 1) continue
            if (refitValue(take, stats) > budget) continue
            out.push({ give: [ship.id], take: { [take]: 1 } })
          }
        }
      }
      return out
    }
  }
}

function techExchange(state: GameState, seat: Seat, params: PostAbilityParams): Result<GameState> {
  const { techId, takeTechId } = params
  if (!techId || !takeTechId) return { ok: false, error: 'R8: name the technology given and the one taken' }
  if (!exchangeTargets(state, seat, techId).includes(takeTechId)) {
    return { ok: false, error: 'R8: the exchange takes a general technology of the same tier in another colour' }
  }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], techs: [...players[seat].techs.filter(id => id !== techId), takeTechId] }
  return { ok: true, value: { ...state, players } }
}

/** R8, Orrun Port Authority: exactly one ready planet, paying either its resources or its influence. */
function clearingHouse(state: GameState, seat: Seat, params: PostAbilityParams): Result<GameState> {
  const { planet, pay } = params
  if (!planet || !pay) return { ok: false, error: 'R8: name one ready planet and whether it pays resources or influence' }
  const exhausted = exhaustPlanets(state, seat, [planet])
  if (!exhausted.ok) return exhausted
  const gained = pay === 'resources' ? exhausted.value.resources : exhausted.value.influence
  if (gained < 1) return { ok: false, error: `R8: ${planet} prints no ${pay}` }
  const players = [...exhausted.value.state.players] as GameState['players']
  players[seat] = { ...players[seat], tradeGoods: players[seat].tradeGoods + gained }
  return { ok: true, value: { ...exhausted.value.state, players } }
}

/** R8: the token goes back to the reinforcements, it is never placed on the board. */
function returnToken(state: GameState, seat: Seat, params: PostAbilityParams): Result<GameState> {
  const pool = params.pool
  if (!pool) return { ok: false, error: 'R8: name the pool the command token comes from' }
  const player = state.players[seat]
  if (player.tokens[pool] < 1) return { ok: false, error: `R8: no token in the ${pool} pool` }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, tokens: { ...player.tokens, [pool]: player.tokens[pool] - 1 } }
  return { ok: true, value: { ...state, players } }
}

const CHARTER_TRADE_GOODS = 4

function charter(state: GameState, seat: Seat, params: PostAbilityParams): Result<GameState> {
  const returned = returnToken(state, seat, params)
  if (!returned.ok) return returned
  const players = [...returned.value.players] as GameState['players']
  players[seat] = { ...players[seat], tradeGoods: players[seat].tradeGoods + CHARTER_TRADE_GOODS }
  return { ok: true, value: { ...returned.value, players } }
}

/**
 * R8, Sarnex Time Machine Wheel: one victory point. The engine is time-free, so the price is charged by the
 * UI against that seat's chess clock; the point itself is granted here like any other, which is what keeps a
 * replay of the move log reproducing the score without knowing anything about clocks.
 */
function timeTrade(state: GameState, seat: Seat): Result<GameState> {
  return { ok: true, value: addVp(state, seat, 1, 'time trade at the Sarnex Time Machine Wheel') }
}

/** R8, Dromm Heavy Hauler: many for many, as long as the total cost taken is not the larger one. */
function refit(state: GameState, seat: Seat, post: 'west' | 'east', params: PostAbilityParams): Result<GameState> {
  const give = params.give ?? []
  const take = params.take ?? {}
  const taken = (Object.entries(take) as [UnitType, number][]).filter(([, n]) => n > 0)
  if (give.length === 0 || taken.length === 0) return { ok: false, error: 'R8: name the ships returned and the ships taken' }
  const systemId = TRADE_POSTS[post].find(id => give.every(unitId => refitShips(state, seat, id).some(u => u.id === unitId)))
  if (!systemId) return { ok: false, error: `R8: return ships of yours from one system linked to the ${post} post` }
  const player = state.players[seat]
  const stats = statsOf(state, seat)
  for (const [type, n] of taken) {
    if (!REFIT_TYPES.includes(type)) return { ok: false, error: `R8: ${type} is no ship, so it cannot be part of a refit` }
    if (player.reinforcements[type] < n) return { ok: false, error: `R8: not enough ${type} in the reinforcements` }
  }
  const sys = state.systems[systemId]
  const returned = sys.space.filter(u => give.includes(u.id))
  const budget = returned.reduce((sum, u) => sum + refitValue(u.type, stats), 0)
  const price = taken.reduce((sum, [type, n]) => sum + refitValue(type, stats) * n, 0)
  if (price > budget) return { ok: false, error: 'R8: the new ships may not cost more than what you returned' }
  let nextUnitId = state.nextUnitId
  const built: Unit[] = []
  const reinforcements = { ...player.reinforcements }
  for (const [type, n] of taken) {
    reinforcements[type] -= n
    for (let i = 0; i < n; i++) built.push({ id: nextUnitId++, type, owner: seat, damaged: false })
  }
  for (const u of returned) reinforcements[u.type] += 1
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, reinforcements }
  const next: GameState = {
    ...state, players, nextUnitId,
    systems: { ...state.systems, [systemId]: { ...sys, space: [...sys.space.filter(u => !give.includes(u.id)), ...built] } },
  }
  // R4.2: a refit may not leave the system over its capacity or its fleet pool
  const fleet = checkFleet(next, seat, systemId)
  if (!fleet.ok) return fleet
  return { ok: true, value: next }
}

/** R8: one special ability per post, once per round for the whole table. */
export function postAbility(state: GameState, post: 'west' | 'east', params: PostAbilityParams): Result<GameState> {
  const ready = abilityReady(state, post)
  if (!ready.ok) return ready
  const seat = ready.value
  const def = postDef(state, post)
  let done: Result<GameState>
  switch (def.ability) {
    case 'timeTrade': done = timeTrade(state, seat); break
    case 'techExchange': done = techExchange(state, seat, params); break
    case 'clearingHouse': done = clearingHouse(state, seat, params); break
    case 'charter': done = charter(state, seat, params); break
    // R8: the engine is time-free, so the layover only spends the token; the UI adds the three minutes
    case 'layover': done = returnToken(state, seat, params); break
    case 'refit': done = refit(state, seat, post, params); break
  }
  if (!done.ok) return done
  return {
    ok: true,
    value: {
      ...done.value,
      postAbilityUsed: { ...done.value.postAbilityUsed, [post]: true },
      log: [...done.value.log, { t: 'info', text: `seat ${String(seat)} uses ${def.abilityName} at the ${def.name}` }],
    },
  }
}
