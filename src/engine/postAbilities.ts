import { TRADE_POSTS } from '../data/map'
import type { PostDef } from '../data/posts'
import { findTech, type TechDef } from '../data/techs'
import { NON_FIGHTER_SHIPS, unitStats } from '../data/units'
import { checkFleet, destroyUnits, statsOwner } from './board'
import { postDef, postLinked, turnReady } from './componentActions'
import { exhaustPlanets } from './economy'
import type { GameState, PostAbilityParams, Result, Seat, Unit } from './types'

/** R8: the clearing house never pays out more than this, however much is exhausted for it. */
export const CLEARING_HOUSE_MAX = 3
/** R8: what the charter pays for the command token it takes back. */
export const CHARTER_TRADE_GOODS = 4
/** R8: the pools a returned command token may come out of; R3.3 knows no others. */
const POOLS = ['tactic', 'fleet', 'strategy'] as const

/**
 * R8: the preconditions every special ability shares. They are the sale's, plus the two the ability adds:
 * the post in play on that side actually has an ability, and nobody has taken it yet this round. A spent
 * turn (`turnDone`) passes, because an ability is a free move like the sale, not an action.
 */
export function postAbilityReady(state: GameState, post: 'west' | 'east'): Result<{ seat: Seat; def: PostDef }> {
  const ready = turnReady(state)
  if (!ready.ok) return ready
  const seat = ready.value
  const def = postDef(state, post)
  if (def.ability === 'none') return { ok: false, error: `R8: the ${def.name} has no special ability` }
  if (state.postAbilityUsed[post]) return { ok: false, error: `R8: the ${def.name}'s ${def.abilityName} is already used this round` }
  if (!postLinked(state, seat, post)) return { ok: false, error: `R8: no planet controlled in a system linked to the ${post} post` }
  return { ok: true, value: { seat, def } }
}

/** R8: a technology's tier is the number of prerequisites it prints, that is the sum of its colour needs. */
function tier(def: TechDef): number {
  return Object.values(def.prereq).reduce((sum, n) => sum + n, 0)
}

/**
 * R8 Tessik Refinery: return one general technology and take another of the same tier in a different colour.
 * Prerequisites are ignored, so this is deliberately not `canResearch`; unit upgrades and faction
 * technologies are out on both sides of the trade.
 */
function techExchange(state: GameState, seat: Seat, params: PostAbilityParams): Result<GameState> {
  const { techId, takeTechId } = params
  if (techId === undefined || takeTechId === undefined) {
    return { ok: false, error: 'R8: name the technology to return and the one to take' }
  }
  const give = findTech(techId)
  const take = findTech(takeTechId)
  if (!give) return { ok: false, error: `R8: unknown technology ${techId}` }
  if (!take) return { ok: false, error: `R8: unknown technology ${takeTechId}` }
  const player = state.players[seat]
  if (!player.techs.includes(techId)) return { ok: false, error: `R8: ${techId} is not owned` }
  if (player.techs.includes(takeTechId)) return { ok: false, error: `R8: ${takeTechId} is already owned` }
  if (give.kind !== 'general' || take.kind !== 'general') {
    return { ok: false, error: 'R8: both sides must be general technologies, no unit upgrades and no faction technologies' }
  }
  if (give.colour === null || take.colour === null) return { ok: false, error: 'R8: both sides must be a technology with a colour' }
  if (give.colour === take.colour) return { ok: false, error: `R8: ${takeTechId} must be a different colour than ${techId}` }
  if (tier(give) !== tier(take)) return { ok: false, error: `R8: ${takeTechId} must be the same tier as ${techId}` }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, techs: [...player.techs.filter(id => id !== techId), takeTechId] }
  return { ok: true, value: { ...state, players } }
}

/**
 * R8 Orrun Port Authority: exhaust ready planets for one trade good per resource or influence spent, at most
 * three. Each planet appears in one of the two lists and pays that side only; `exhaustPlanets` refuses a
 * planet that is already exhausted, which is also what stops a planet from being named twice.
 */
function clearingHouse(state: GameState, seat: Seat, params: PostAbilityParams): Result<GameState> {
  const byResources = params.planets ?? []
  const byInfluence = params.influencePlanets ?? []
  if (!byResources.length && !byInfluence.length) return { ok: false, error: 'R8: name at least one planet to exhaust' }
  const resources = exhaustPlanets(state, seat, byResources)
  if (!resources.ok) return resources
  const influence = exhaustPlanets(resources.value.state, seat, byInfluence)
  if (!influence.ok) return influence
  const gained = resources.value.resources + influence.value.influence
  if (gained < 1) return { ok: false, error: 'R8: the planets named are worth nothing on the side they pay' }
  if (gained > CLEARING_HOUSE_MAX) return { ok: false, error: `R8: at most ${CLEARING_HOUSE_MAX} trade goods, this pays ${gained}` }
  const next = influence.value.state
  const players = [...next.players] as GameState['players']
  players[seat] = { ...players[seat], tradeGoods: players[seat].tradeGoods + gained }
  return { ok: true, value: { ...next, players } }
}

/**
 * R8 Kesh Line Freighter and Vandel Bulk Tanker: both return one command token from a pool the caller names.
 * The token goes back to the reinforcements, never onto the board, and the engine has no reinforcement
 * counter for tokens, so taking it off the command sheet is the whole of it. The pool is checked against the
 * three that exist, because a bogus key would read as `undefined` and turn the arithmetic into `NaN`.
 */
function returnToken(state: GameState, seat: Seat, params: PostAbilityParams): Result<GameState> {
  const pool = params.pool
  if (pool === undefined || !POOLS.includes(pool)) return { ok: false, error: 'R8: name the pool the command token comes from' }
  const player = state.players[seat]
  if (player.tokens[pool] < 1) return { ok: false, error: `R8: no command token in the ${pool} pool` }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, tokens: { ...player.tokens, [pool]: player.tokens[pool] - 1 } }
  return { ok: true, value: { ...state, players } }
}

/** R8 Kesh Line Freighter: one command token from any pool for 4 trade goods. */
function charter(state: GameState, seat: Seat, params: PostAbilityParams): Result<GameState> {
  const spent = returnToken(state, seat, params)
  if (!spent.ok) return spent
  const players = [...spent.value.players] as GameState['players']
  players[seat] = { ...players[seat], tradeGoods: players[seat].tradeGoods + CHARTER_TRADE_GOODS }
  return { ok: true, value: { ...spent.value, players } }
}

/**
 * R8 Dromm Heavy Hauler: return ships from one system this post serves and take one ship of no greater cost
 * into the same system. Fighters and infantry are out on both sides, any difference in cost is lost, and the
 * fleet that comes out of it has to hold up to `checkFleet`, so a swap that strands cargo is refused.
 */
function refit(state: GameState, seat: Seat, post: 'west' | 'east', params: PostAbilityParams): Result<GameState> {
  const give = params.give ?? []
  const take = params.take
  if (!give.length) return { ok: false, error: 'R8: name the ships to return' }
  if (new Set(give).size !== give.length) return { ok: false, error: 'R8: a ship can only be returned once' }
  if (take === undefined) return { ok: false, error: 'R8: name the ship to take' }
  if (take === 'fighter' || take === 'infantry') return { ok: false, error: 'R8: fighters and infantry cannot be part of a refit' }
  if (!NON_FIGHTER_SHIPS.includes(take)) return { ok: false, error: `R8: ${take} is not a ship` }
  const systemId = TRADE_POSTS[post].find(id => state.systems[id].space.some(u => u.id === give[0]))
  if (systemId === undefined) return { ok: false, error: `R8: the ships must be in one system linked to the ${post} post` }
  const units: Unit[] = []
  for (const id of give) {
    const unit = state.systems[systemId].space.find(u => u.id === id)
    if (!unit) return { ok: false, error: `R8: the ships returned must be all in the same system, ${id} is not in ${systemId}` }
    if (unit.owner !== seat) return { ok: false, error: `R8: ship ${id} in ${systemId} is not yours` }
    if (!NON_FIGHTER_SHIPS.includes(unit.type)) return { ok: false, error: 'R8: fighters and infantry cannot be part of a refit' }
    units.push(unit)
  }
  // the returned ships are in the reinforcements before the new one is drawn, so a hull may be recast as its
  // own kind; the difference in cost is simply lost, as the spec says
  let next = destroyUnits(state, systemId, units)
  const me = next.players[seat]
  if (me.reinforcements[take] < 1) return { ok: false, error: `R8: no ${take} in the reinforcements` }
  const stats = statsOwner(state, seat)
  const returned = units.reduce((sum, u) => sum + unitStats(u.type, stats).cost, 0)
  const cost = unitStats(take, stats).cost
  if (cost > returned) return { ok: false, error: `R8: ${take} costs ${cost}, the ships returned are worth ${returned}` }
  const players = [...next.players] as GameState['players']
  players[seat] = { ...me, reinforcements: { ...me.reinforcements, [take]: me.reinforcements[take] - 1 } }
  const built: Unit = { id: next.nextUnitId, type: take, owner: seat, damaged: false }
  const sys = next.systems[systemId]
  next = {
    ...next, players, nextUnitId: next.nextUnitId + 1,
    systems: { ...next.systems, [systemId]: { ...sys, space: [...sys.space, built] } },
  }
  const fleet = checkFleet(next, seat, systemId)
  if (!fleet.ok) return fleet
  return { ok: true, value: next }
}

/** R8: every use of an ability is once per round for the table, and says in the log who took what where. */
function spend(state: GameState, seat: Seat, post: 'west' | 'east', def: PostDef): GameState {
  return {
    ...state,
    postAbilityUsed: { ...state.postAbilityUsed, [post]: true },
    log: [...state.log, { t: 'info', text: `seat ${seat} uses ${def.abilityName} at the ${post} post, the ${def.name}` }],
  }
}

/**
 * R8: the special ability of the post in play on that side. Which ability that is comes from the post, never
 * from the parameters, so a caller cannot pick an ability by filling in its fields.
 */
export function postAbility(state: GameState, post: 'west' | 'east', params: PostAbilityParams): Result<GameState> {
  const ready = postAbilityReady(state, post)
  if (!ready.ok) return ready
  const { seat, def } = ready.value
  const resolved = resolveAbility(state, seat, post, def, params)
  if (!resolved.ok) return resolved
  return { ok: true, value: spend(resolved.value, seat, post, def) }
}

function resolveAbility(state: GameState, seat: Seat, post: 'west' | 'east', def: PostDef, params: PostAbilityParams): Result<GameState> {
  switch (def.ability) {
    case 'techExchange': return techExchange(state, seat, params)
    case 'clearingHouse': return clearingHouse(state, seat, params)
    case 'charter': return charter(state, seat, params)
    // R8: the tanker buys time, which the engine does not have; the move is recorded and the interface adds
    // the three minutes to that seat's clock when it applies it
    case 'layover': return returnToken(state, seat, params)
    case 'refit': return refit(state, seat, post, params)
    // `postAbilityReady` has already refused a post without an ability, so this is unreachable
    case 'none': return { ok: false, error: `R8: the ${def.name} has no special ability` }
  }
}
