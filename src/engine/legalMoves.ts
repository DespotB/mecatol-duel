import { activatableSystems, canPass } from './actionPhase'
import { canMunitions, retreatTargets } from './combat'
import { productionLimit } from './economy'
import { bombardablePlanets, groundCombatPending, landablePlanets } from './invasion'
import { movableShips } from './movement'
import type { GameState, Move, Result } from './types'

/** Kinds whose parameters the UI fills in; the enumerator only offers a template. */
export const TEMPLATE_KINDS: readonly Move['type'][] = ['moveShips', 'produce', 'land']

function tacticalMoves(state: GameState): Move[] {
  const tac = state.tactical
  if (!tac) return []
  const seat = state.active
  switch (tac.step) {
    case 'movement': {
      const out: Move[] = []
      if (movableShips(state, seat).length) out.push({ type: 'moveShips', moves: [] })
      out.push({ type: 'endMovement' })
      return out
    }
    case 'spaceCombat': {
      const out: Move[] = [{ type: 'combatRound' }]
      const combat = tac.combat
      if (!combat) return out
      if (canMunitions(state, combat.attacker)) out.push({ type: 'combatRound', munitions: { attacker: true } })
      if (canMunitions(state, combat.defender)) out.push({ type: 'combatRound', munitions: { defender: true } })
      if (combat.round >= 2 && seat === combat.attacker && combat.retreating === null) {
        for (const to of retreatTargets(state, seat)) out.push({ type: 'retreat', to })   // one announcement per combat
      }
      return out
    }
    case 'invasion': {
      const out: Move[] = []
      for (const planetId of bombardablePlanets(state)) out.push({ type: 'bombard', planetId })
      for (const { planetId, infantryIds } of landablePlanets(state)) out.push({ type: 'land', planetId, infantryIds })
      if (groundCombatPending(state)) out.push({ type: 'groundCombatRound' })
      else out.push({ type: 'endInvasion' })
      return out
    }
    case 'production': {
      const out: Move[] = []
      if (productionLimit(state, seat, tac.systemId) > 0) out.push({ type: 'produce', units: {}, planets: [], tradeGoods: 0 })
      out.push({ type: 'endTactical' })
      return out
    }
    case 'done':
      return [{ type: 'endTactical' }]
  }
}

export function legalMoves(state: GameState): Move[] {
  if (state.winner !== null) return []
  if (state.phase === 'strategy') {
    const seat = state.draft[0]
    if (seat === undefined || seat !== state.active) return []
    return state.strategyPool.map(c => ({ type: 'pickStrategyCard', card: c.id }))
  }
  if (state.phase !== 'action') return []
  const seat = state.active
  if (state.players[seat].passed) return []
  if (state.tactical) return tacticalMoves(state)
  const out: Move[] = activatableSystems(state, seat).map(id => ({ type: 'startTactical', systemId: id }))
  if (canPass(state, seat)) out.push({ type: 'pass' })
  return out
}

export function validateMove(state: GameState, move: Move): Result<true> {
  const moves = legalMoves(state)
  const ok = TEMPLATE_KINDS.includes(move.type)
    ? moves.some(m => m.type === move.type)
    : moves.some(m => JSON.stringify(m) === JSON.stringify(move))
  return ok ? { ok: true, value: true } : { ok: false, error: `illegal move ${move.type}` }
}
