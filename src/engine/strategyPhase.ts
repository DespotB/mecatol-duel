import type { GameState, Result, Seat, StrategyCardId } from './types'

export const INITIATIVE: Record<StrategyCardId, number> = { leadership: 1, diplomacy: 2, trade: 5, warfare: 6, technology: 7, imperial: 8 }

export function initiativeOrder(state: GameState): [Seat, Seat] {
  const lowest = (seat: Seat) => {
    const cards = state.players[seat].strategyCards
    if (cards.length === 0) return Infinity   // no card played: goes last
    return Math.min(...cards.map(c => INITIATIVE[c.id]))
  }
  return lowest(0) <= lowest(1) ? [0, 1] : [1, 0]
}

export function pickStrategyCard(state: GameState, card: StrategyCardId): Result<GameState> {
  if (state.phase !== 'strategy') return { ok: false, error: 'not in the strategy phase' }
  const seat = state.draft[0]
  if (seat === undefined || seat !== state.active) return { ok: false, error: 'not this player\'s pick' }
  const entry = state.strategyPool.find(c => c.id === card)
  if (!entry) return { ok: false, error: `card ${card} is not available` }
  const players = [...state.players] as GameState['players']
  const player = players[seat]
  players[seat] = { ...player, strategyCards: [...player.strategyCards, { id: card, used: false }], tradeGoods: player.tradeGoods + entry.bonus }
  const draft = state.draft.slice(1)
  let strategyPool = state.strategyPool.filter(c => c.id !== card)
  let next: GameState = { ...state, players, draft, strategyPool, active: draft[0] ?? state.active }
  if (draft.length === 0) {
    strategyPool = strategyPool.map(c => ({ ...c, bonus: c.bonus + 1 }))
    const order = initiativeOrder(next)
    next = { ...next, strategyPool, phase: 'action', active: order[0], players: [{ ...next.players[0], passed: false }, { ...next.players[1], passed: false }] }
  }
  return { ok: true, value: next }
}
