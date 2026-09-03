import { useState } from 'react'
import { isPaidObjective, objectiveCost, objectiveDef } from '../../data/objectives'
import { freeScoreable, paidScoreable, tokensGained } from '../../engine'
import { PayRow } from './PayRow'
import { TokenSheet } from './TokenSheet'
import { formatClock, ownedPlanets, timeCost } from '../format'
import { useGame } from '../store'
import type { GameState, Player, ScoreRequest, Seat } from '../../engine/types'

interface Payment { planets: string[]; tradeGoods: number }

export function StatusDialog() {
  const { session, apply, canAct } = useGame()
  const [tokens, setTokens] = useState<Player['tokens'] | null>(null)
  // R7: an entry here is an objective the player has chosen to buy; no entry means they are letting it go
  const [payments, setPayments] = useState<Record<string, Payment>>({})
  if (!session) return null
  const state = session.state
  const seat = state.active
  const player = state.players[seat]
  const gained = tokensGained(state, seat)
  // the new tokens start unplaced: the player adds them pool by pool
  const sheet = tokens ?? { ...player.tokens }
  const scoring = freeScoreable(state, seat)
  // R7: every revealed paid objective is listed, the ones this seat cannot cover greyed out, so the dialog
  // says why a point is out of reach instead of quietly dropping it
  const buyable = paidScoreable(state, seat)
  const offered = state.publicObjectives.filter(id => isPaidObjective(id) && !player.scoredObjectives.includes(id))
  const owned = ownedPlanets(state, seat)
  const covered = (id: string, payment: Payment): boolean => {
    const cost = objectiveCost(id)
    if (cost?.kind !== 'resources') return true
    const planets = payment.planets.reduce((sum, p) => sum + (owned.find(o => o.id === p)?.resources ?? 0), 0)
    return planets + payment.tradeGoods >= cost.amount
  }
  const setPayment = (id: string, next: Payment | null) => {
    setPayments(prev => {
      const out = { ...prev }
      if (next) out[id] = next
      else delete out[id]
      return out
    })
  }
  const requests: ScoreRequest[] = offered.flatMap((id): ScoreRequest[] => {
    const payment = payments[id]
    if (!payment) return []
    // the time objective is settled off the clock by the store, so it must not carry planets or trade goods
    return objectiveCost(id)?.kind === 'resources' ? [{ objectiveId: id, ...payment }] : [{ objectiveId: id }]
  })
  const short = offered.some(id => payments[id] !== undefined && !covered(id, payments[id]))
  // Mirrors TokenSheet's own target/placed math: the confirm move needs the sheet to land on exactly
  // `target`, so block the click while it doesn't rather than let distributeTokens reject it after the fact.
  const target = player.tokens.tactic + player.tokens.fleet + player.tokens.strategy + gained
  const placed = sheet.tactic + sheet.fleet + sheet.strategy
  return (
    <div className="dialog cut" data-testid="status-dialog">
      <div className="in">
        <div className="dhead">
          <span className="tab">Status phase, {player.name}</span>
          <span className="sub">You gain {gained} command tokens.</span>
          <div className="right">
            <button type="button" className="btn gold" data-testid="btn-status-confirm" disabled={!canAct || placed !== target || short}
              onClick={() => {
                apply({ type: 'status', params: { tokens: sheet, ...(requests.length ? { score: requests } : {}) } })
                setTokens(null)
                setPayments({})
              }}>Confirm</button>
          </div>
        </div>
        <div className="rowline" data-testid="status-scoring">
          <span className="lbl">Scoring</span>
          {scoring.length === 0 ? <span className="sub">Nothing to score.</span> : null}
          {scoring.map(id => (
            <span className="chip gold" key={id}>{objectiveDef(id)?.text ?? id}</span>
          ))}
        </div>
        {offered.length ? (
          <div data-testid="status-paid">
            <div className="rowline">
              <span className="lbl">Pay to score</span>
              <span className="sub">These score only if you pay. Skip one and you keep what it costs, but not the point.</span>
            </div>
            {offered.map(id => (
              <PaidObjective
                key={id} objectiveId={id} state={state} seat={seat} clockMs={session.clockMs[seat]}
                enabled={buyable.includes(id)} payment={payments[id]} onPayment={next => { setPayment(id, next) }}
              />
            ))}
          </div>
        ) : null}
        <TokenSheet current={player.tokens} gained={gained} value={sheet} onChange={setTokens} />
      </div>
    </div>
  )
}

interface PaidObjectiveProps {
  objectiveId: string
  state: GameState
  seat: Seat
  clockMs: number
  enabled: boolean
  payment: Payment | undefined
  onPayment: (payment: Payment | null) => void
}

/** R7: one paid objective, its price in real numbers, and the control that buys it. */
function PaidObjective({ objectiveId, state, seat, clockMs, enabled, payment, onPayment }: PaidObjectiveProps) {
  const def = objectiveDef(objectiveId)
  const cost = objectiveCost(objectiveId)
  if (!def || !cost) return null
  const price = cost.kind === 'resources'
    ? `Pay ${String(cost.amount)} resources`
    : `Pay ${formatClock(timeCost(clockMs, cost.fraction))} of your ${formatClock(clockMs)}`
  return (
    <div data-testid={`status-paid-${objectiveId}`}>
      <div className="rowline">
        <span className={`chip ${enabled ? 'gold' : 'lock'}`}>{def.text}</span>
        <button
          type="button" className={`btn small${payment ? ' gold' : ' quiet'}`} disabled={!enabled}
          data-testid={`btn-pay-${objectiveId}`}
          onClick={() => { onPayment(payment ? null : { planets: [], tradeGoods: 0 }) }}
        >{payment ? 'Scoring it, tap to drop' : price}</button>
        {enabled ? null : <span className="sub">You cannot cover this right now.</span>}
      </div>
      {payment && cost.kind === 'resources' ? (
        <PayRow
          state={state} seat={seat} needed={cost.amount}
          planets={payment.planets} onPlanets={planets => { onPayment({ ...payment, planets }) }}
          tradeGoods={payment.tradeGoods} onTradeGoods={tradeGoods => { onPayment({ ...payment, tradeGoods }) }}
        />
      ) : null}
    </div>
  )
}
