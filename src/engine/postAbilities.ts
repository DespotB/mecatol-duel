import { TRADE_POSTS } from '../data/map'
import { POSTS } from '../data/posts'
import { TECHS, findTech } from '../data/techs'
import { unitStats } from '../data/units'
import { checkFleet } from './board'
import { turnReady } from './componentActions'
import { exhaustPlanets } from './economy'
import type { PostDef } from '../data/posts'
import type { TechDef } from '../data/techs'
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
 * plus the two that are the ability's own: the post has one, and nobody at the table has taken it this round.
 */
function abilityReady(state: GameState, post: 'west' | 'east'): Result<Seat> {
  const ready = turnReady(state)
  if (!ready.ok) return ready
  const seat = ready.value
  const def = postDef(state, post)
  if (def.ability === 'none') return { ok: false, error: `R8: the ${def.name} has no special ability` }
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

function ships(state: GameState, seat: Seat, systemId: string): Unit[] {
  return state.systems[systemId].space.filter(u => u.owner === seat && u.type !== 'fighter' && u.type !== 'infantry')
}

const REFIT_TAKES: readonly UnitType[] = ['destroyer', 'cruiser', 'carrier', 'dreadnought', 'flagship', 'warsun']

/**
 * R8: what the seat could legally do at that post right now, in the shape the UI needs. It is an offer list,
 * not an enumeration of every combination: the clearing house and the refit take a set of planets or ships,
 * and the panel builds those from the state, so one playable representative per choice is enough.
 */
export function postAbilityOptions(state: GameState, seat: Seat, post: 'west' | 'east'): PostAbilityParams[] {
  const ready = abilityReady(state, post)
  if (!ready.ok || ready.value !== seat) return []
  const player = state.players[seat]
  const out: PostAbilityParams[] = []
  switch (postDef(state, post).ability) {
    case 'techExchange':
      for (const techId of player.techs) {
        for (const takeTechId of exchangeTargets(state, seat, techId)) out.push({ techId, takeTechId })
      }
      return out
    case 'clearingHouse':
      for (const sys of Object.values(state.systems)) {
        for (const p of sys.planets) {
          if (p.owner !== seat || p.exhausted) continue
          if (p.resources >= 1 && p.resources <= 3) out.push({ planets: [p.id], influencePlanets: [] })
          if (p.influence >= 1 && p.influence <= 3) out.push({ planets: [], influencePlanets: [p.id] })
        }
      }
      return out
    case 'charter':
    case 'layover':
      return (['tactic', 'fleet', 'strategy'] as const).filter(pool => player.tokens[pool] >= 1).map(pool => ({ pool }))
    case 'refit': {
      const stats = { faction: player.faction, techs: player.techs }
      for (const systemId of TRADE_POSTS[post]) {
        for (const ship of ships(state, seat, systemId)) {
          const budget = unitStats(ship.type, stats).cost
          for (const take of REFIT_TAKES) {
            if (player.reinforcements[take] < 1) continue
            if (unitStats(take, stats).cost > budget) continue
            out.push({ give: [ship.id], take })
          }
        }
      }
      return out
    }
    default:
      return []
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

const CLEARING_HOUSE_CAP = 3

function clearingHouse(state: GameState, seat: Seat, params: PostAbilityParams): Result<GameState> {
  const forResources = params.planets ?? []
  const forInfluence = params.influencePlanets ?? []
  if (forResources.some(id => forInfluence.includes(id))) {
    return { ok: false, error: 'R8: a planet pays either its resources or its influence, never both' }
  }
  const both = [...forResources, ...forInfluence]
  if (both.length === 0) return { ok: false, error: 'R8: exhaust at least one ready planet' }
  const exhausted = exhaustPlanets(state, seat, both)
  if (!exhausted.ok) return exhausted
  let gained = 0
  for (const sys of Object.values(state.systems)) {
    for (const p of sys.planets) {
      if (forResources.includes(p.id)) gained += p.resources
      if (forInfluence.includes(p.id)) gained += p.influence
    }
  }
  if (gained < 1) return { ok: false, error: 'R8: that pays nothing' }
  if (gained > CLEARING_HOUSE_CAP) return { ok: false, error: `R8: at most ${String(CLEARING_HOUSE_CAP)} trade goods` }
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

function refit(state: GameState, seat: Seat, post: 'west' | 'east', params: PostAbilityParams): Result<GameState> {
  const give = params.give ?? []
  const take = params.take
  if (give.length === 0 || !take) return { ok: false, error: 'R8: name the ships returned and the ship taken' }
  if (!REFIT_TAKES.includes(take)) return { ok: false, error: 'R8: fighters and infantry cannot be part of a refit' }
  const systemId = TRADE_POSTS[post].find(id => give.every(unitId => ships(state, seat, id).some(u => u.id === unitId)))
  if (!systemId) return { ok: false, error: `R8: return ships of yours from one system linked to the ${post} post` }
  const player = state.players[seat]
  const stats = { faction: player.faction, techs: player.techs }
  const sys = state.systems[systemId]
  const returned = sys.space.filter(u => give.includes(u.id))
  const budget = returned.reduce((sum, u) => sum + unitStats(u.type, stats).cost, 0)
  if (unitStats(take, stats).cost > budget) return { ok: false, error: 'R8: the new ship may not cost more than what you returned' }
  if (player.reinforcements[take] < 1) return { ok: false, error: `R8: no ${take} in the reinforcements` }
  const built: Unit = { id: state.nextUnitId, type: take, owner: seat, damaged: false }
  const players = [...state.players] as GameState['players']
  const reinforcements = { ...player.reinforcements, [take]: player.reinforcements[take] - 1 }
  for (const u of returned) reinforcements[u.type] += 1
  players[seat] = { ...player, reinforcements }
  const next: GameState = {
    ...state, players, nextUnitId: state.nextUnitId + 1,
    systems: { ...state.systems, [systemId]: { ...sys, space: [...sys.space.filter(u => !give.includes(u.id)), built] } },
  }
  // R4.2: the refit may not put more non-fighter ships into the system than the fleet pool allows
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
    case 'techExchange': done = techExchange(state, seat, params); break
    case 'clearingHouse': done = clearingHouse(state, seat, params); break
    case 'charter': done = charter(state, seat, params); break
    // R8: the engine is time-free, so the layover only spends the token; the UI adds the three minutes
    case 'layover': done = returnToken(state, seat, params); break
    case 'refit': done = refit(state, seat, post, params); break
    default: return { ok: false, error: `R8: the ${def.name} has no special ability` }
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
