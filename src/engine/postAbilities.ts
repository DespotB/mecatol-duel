import type { PostDef } from '../data/posts'
import { findTech, type TechDef } from '../data/techs'
import { postDef, postLinked, turnReady } from './componentActions'
import { exhaustPlanets } from './economy'
import type { GameState, PostAbilityParams, Result, Seat } from './types'

/** R8: the clearing house never pays out more than this, however much is exhausted for it. */
export const CLEARING_HOUSE_MAX = 3

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
  const resolved = resolveAbility(state, seat, def, params)
  if (!resolved.ok) return resolved
  return { ok: true, value: spend(resolved.value, seat, post, def) }
}

function resolveAbility(state: GameState, seat: Seat, def: PostDef, params: PostAbilityParams): Result<GameState> {
  switch (def.ability) {
    case 'techExchange': return techExchange(state, seat, params)
    case 'clearingHouse': return clearingHouse(state, seat, params)
    // `postAbilityReady` has already refused a post without an ability, so this is unreachable
    case 'none': return { ok: false, error: `R8: the ${def.name} has no special ability` }
    default: return { ok: false, error: `R8: ${def.ability} is not implemented`, internal: true }
  }
}
