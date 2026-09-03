import { FACTIONS } from '../data/factions'
import { MECATOL_ID, SYSTEM_IDS } from '../data/map'
import { otherSeat, passTurn } from './actionPhase'
import { distributeTokens, exhaustPlanets } from './economy'
import { canResearch } from './research'
import type { GameState, Result, Seat, StrategicParams, StrategyCardId } from './types'

/** The seat holding the card, used or not. */
export function cardOwner(state: GameState, card: StrategyCardId): Seat | null {
  for (const seat of [0, 1] as Seat[]) if (state.players[seat].strategyCards.some(c => c.id === card)) return seat
  return null
}

export function unusedCards(state: GameState, seat: Seat): StrategyCardId[] {
  return state.players[seat].strategyCards.filter(c => !c.used).map(c => c.id)
}

/** R3.2: every secondary but Leadership costs one token from the strategy pool. */
export function secondaryTokenCost(card: StrategyCardId): number {
  return card === 'leadership' ? 0 : 1
}

function spendStrategyTokens(state: GameState, seat: Seat, cost: number): Result<GameState> {
  if (cost === 0) return { ok: true, value: state }
  const player = state.players[seat]
  if (player.tokens.strategy < cost) return { ok: false, error: 'R3.2: no token in the strategy pool' }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, tokens: { ...player.tokens, strategy: player.tokens.strategy - cost } }
  return { ok: true, value: { ...state, players } }
}

/** R6 Diplomacy: every system but Mecatol Rex in which the seat controls a planet. */
export function diplomacySystems(state: GameState, seat: Seat): string[] {
  return SYSTEM_IDS.filter(id => id !== MECATOL_ID && state.systems[id].planets.some(p => p.owner === seat))
}

/** R6 Warfare: every system that holds a command token of the seat. */
export function warfareTokenSystems(state: GameState, seat: Seat): string[] {
  return SYSTEM_IDS.filter(id => state.systems[id].activatedBy.includes(seat))
}

/** R6 Diplomacy: readies up to `max` exhausted planets the seat controls. */
export function readyPlanets(state: GameState, seat: Seat, planets: string[], max: number): Result<GameState> {
  if (planets.length > max) return { ok: false, error: `R6: at most ${max} planets` }
  let systems = state.systems
  for (const planetId of planets) {
    const sysId = Object.keys(systems).find(id => systems[id].planets.some(p => p.id === planetId))
    if (!sysId) return { ok: false, error: `unknown planet ${planetId}` }
    const sys = systems[sysId]
    const planet = sys.planets.find(p => p.id === planetId)
    if (!planet || planet.owner !== seat) return { ok: false, error: `planet ${planetId} not controlled` }
    if (!planet.exhausted) return { ok: false, error: `planet ${planetId} is not exhausted` }
    systems = { ...systems, [sysId]: { ...sys, planets: sys.planets.map(p => p.id === planetId ? { ...p, exhausted: false } : p) } }
  }
  return { ok: true, value: { ...state, systems } }
}

/** R5: adds the technology after the prerequisite check; Inheritance Systems ignores the prerequisites. */
export function grantTech(state: GameState, seat: Seat, techId: string, ignorePrereqs: boolean): Result<GameState> {
  const player = state.players[seat]
  if (!canResearch(player, techId, ignorePrereqs)) return { ok: false, error: `R5: ${techId} cannot be researched` }
  const players = [...state.players] as GameState['players']
  players[seat] = { ...player, techs: [...player.techs, techId] }
  return { ok: true, value: { ...state, players, log: [...state.log, { t: 'info', text: `seat ${seat} researches ${techId}` }] } }
}

function replenish(state: GameState, seat: Seat): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], commodities: FACTIONS[players[seat].faction].commodityValue }
  return { ...state, players }
}

function addTradeGoods(state: GameState, seat: Seat, n: number): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], tradeGoods: players[seat].tradeGoods + n }
  return { ...state, players }
}

/** R6 Leadership: `base` command tokens plus one for every 3 influence exhausted. */
function leadership(state: GameState, seat: Seat, params: StrategicParams, base: number): Result<GameState> {
  const spent = exhaustPlanets(state, seat, params.planets ?? [])
  if (!spent.ok) return spent
  return distributeTokens(spent.value.state, seat, params.tokens, base + Math.floor(spent.value.influence / 3))
}

/**
 * R6 Diplomacy, errata text: the opponent places a command token, then up to 2 of your planets ready.
 * R3.2: a card must always be playable, so with no eligible system only the readying half resolves.
 */
function diplomacyPrimary(state: GameState, seat: Seat, params: StrategicParams): Result<GameState> {
  const systemId = params.systemId
  if (systemId === undefined) {
    if (diplomacySystems(state, seat).length > 0) return { ok: false, error: 'R6: Diplomacy needs a system' }
    return readyPlanets(state, seat, params.planets ?? [], 2)
  }
  const sys = state.systems[systemId]
  if (!sys) return { ok: false, error: `unknown system ${systemId}` }
  if (systemId === MECATOL_ID) return { ok: false, error: 'R6: not the Mecatol Rex system' }
  if (!sys.planets.some(p => p.owner === seat)) return { ok: false, error: `R6: you control no planet in ${systemId}` }
  const other = otherSeat(seat)
  const systems = sys.activatedBy.includes(other)
    ? state.systems
    : { ...state.systems, [systemId]: { ...sys, activatedBy: [...sys.activatedBy, other] } }
  return readyPlanets({ ...state, systems }, seat, params.planets ?? [], 2)
}

function primary(state: GameState, seat: Seat, card: StrategyCardId, params: StrategicParams): Result<GameState> {
  switch (card) {
    case 'leadership':
      return leadership(state, seat, params, 3)
    case 'diplomacy':
      return diplomacyPrimary(state, seat, params)
    case 'trade': {
      let next = replenish(addTradeGoods(state, seat, 3), seat)
      if (params.shareWithOpponent) next = replenish(next, otherSeat(seat))
      return { ok: true, value: next }
    }
    default:
      return { ok: false, error: `no primary implemented for ${card}` }
  }
}

function secondaryEffect(state: GameState, seat: Seat, card: StrategyCardId, params: StrategicParams): Result<GameState> {
  switch (card) {
    case 'leadership':
      return leadership(state, seat, params, 0)
    case 'diplomacy':
      return readyPlanets(state, seat, params.planets ?? [], 2)
    case 'trade':
      return { ok: true, value: replenish(state, seat) }
    default:
      return { ok: false, error: `no secondary implemented for ${card}` }
  }
}

export function strategic(state: GameState, card: StrategyCardId, params: StrategicParams | undefined): Result<GameState> {
  if (state.phase !== 'action') return { ok: false, error: 'not in the action phase' }
  if (state.tactical) return { ok: false, error: 'finish the tactical action first' }
  if (state.pendingSecondary) return { ok: false, error: 'R3.2: the opponent still has to answer the last strategy card' }
  const seat = state.active
  if (state.players[seat].passed) return { ok: false, error: 'this player has passed' }
  const entry = state.players[seat].strategyCards.find(c => c.id === card)
  if (!entry) return { ok: false, error: `R3.2: seat ${seat} does not hold ${card}` }
  if (entry.used) return { ok: false, error: `R3.2: ${card} is already used` }
  const played = primary(state, seat, card, params ?? {})
  if (!played.ok) return played
  const players = [...played.value.players] as GameState['players']
  players[seat] = { ...players[seat], strategyCards: players[seat].strategyCards.map(c => c.id === card ? { ...c, used: true } : c) }
  return { ok: true, value: { ...played.value, players, pendingSecondary: card, active: otherSeat(seat) } }
}

export function secondary(state: GameState, card: StrategyCardId, accept: boolean, params: StrategicParams | undefined): Result<GameState> {
  if (state.phase !== 'action') return { ok: false, error: 'not in the action phase' }
  if (state.pendingSecondary !== card) return { ok: false, error: `R3.2: no secondary window for ${card}` }
  const seat = state.active
  const owner = cardOwner(state, card)
  if (owner === null || owner === seat) return { ok: false, error: 'R3.2: the card holder does not answer their own card' }
  let next = state
  if (accept) {
    const paid = spendStrategyTokens(state, seat, secondaryTokenCost(card))
    if (!paid.ok) return paid
    const used = secondaryEffect(paid.value, seat, card, params ?? {})
    if (!used.ok) return used
    next = used.value
  }
  // R3.2: the turn passes on from the card holder, so the answering seat keeps it unless it has passed.
  return { ok: true, value: passTurn({ ...next, pendingSecondary: null, active: owner }) }
}
