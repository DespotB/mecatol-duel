import { useState } from 'react'
import { cardOwner, productionCost, secondaryTokenCost } from '../../engine'
import { CARD_NAME, ownedPlanets, unitLabel } from '../format'
import { secondaryOffer } from '../moveOptions'
import { PayRow } from './PayRow'
import { TechDrawer } from './TechDrawer'
import { TokenSheet } from './TokenSheet'
import { useGame } from '../store'
import type { Player, StrategicParams, UnitType } from '../../engine/types'

export function SecondaryPanel() {
  const { session, legal, apply } = useGame()
  const [planets, setPlanets] = useState<string[] | null>(null)
  const [tradeGoods, setTradeGoods] = useState(0)
  const [techId, setTechId] = useState<string | null>(null)
  const [tokens, setTokens] = useState<Player['tokens'] | null>(null)
  if (!session) return null
  const state = session.state
  const card = state.pendingSecondary
  if (card === null) return null
  const seat = state.active
  const player = state.players[seat]
  const owner = cardOwner(state, card)
  const offer = secondaryOffer(legal)
  const template: StrategicParams = offer.accept ?? {}
  const pay = planets ?? template.planets ?? []
  const influence = pay.reduce((sum, id) => {
    const planet = ownedPlanets(state, seat).find(p => p.id === id)
    return sum + (planet ? planet.influence : 0)
  }, 0) + tradeGoods
  const gained = card === 'leadership' ? Math.floor(influence / 3) : 0
  const sheet = tokens ?? { ...player.tokens, tactic: player.tokens.tactic + gained }
  const techOptions = legal.flatMap(m => m.type === 'secondary' && m.accept && m.params?.techId ? [m.params.techId] : [])

  function params(): StrategicParams {
    switch (card) {
      case 'leadership': return { planets: pay, tradeGoods, tokens: sheet }
      case 'diplomacy': return { planets: pay }
      case 'technology': return { techId: techId ?? template.techId, planets: pay, tradeGoods }
      case 'warfare': return { units: template.units, planets: pay, tradeGoods }
      default: return {}
    }
  }

  const needed = card === 'technology' ? 4 : 0
  const units = template.units ?? {}
  // R6 warfare secondary: the enumerator already worked out the true production cost (and picked planets
  // covering it, empty with Sarween Tools), so read it back off the payload rather than assume 1. Fall back
  // to recomputing it only when no accept payload was carried at all (nothing to accept).
  const warfareNeeded = template.planets
    ? template.planets.reduce((sum, id) => sum + (ownedPlanets(state, seat).find(p => p.id === id)?.resources ?? 0), 0) + (template.tradeGoods ?? 0)
    : productionCost({ infantry: 1 }, { faction: player.faction, techs: player.techs }, player.techs.includes('sarween_tools'))
  return (
    <div className="dialog cut" data-testid="secondary-panel">
      <div className="in">
        <div className="dhead">
          <span className="tab">{CARD_NAME[card]}, secondary</span>
          <span className="sub">
            {owner === null ? 'Your opponent' : state.players[owner].name} played {CARD_NAME[card]}.
            It costs you {secondaryTokenCost(card)} strategy token.
          </span>
          <div className="right">
            <button type="button" className="btn gold" data-testid="btn-secondary-accept" disabled={offer.accept === null}
              onClick={() => apply({ type: 'secondary', card, accept: true, params: params() })}>Use the secondary</button>
            <button type="button" className="btn quiet" data-testid="btn-secondary-decline"
              onClick={() => apply({ type: 'secondary', card, accept: false })}>Decline</button>
          </div>
        </div>
        {card === 'leadership' ? (
          <>
            <PayRow state={state} seat={seat} unit="influence" needed={0} planets={pay} onPlanets={ids => { setPlanets(ids); setTokens(null) }}
              tradeGoods={tradeGoods} onTradeGoods={n => { setTradeGoods(n); setTokens(null) }} />
            <TokenSheet current={player.tokens} gained={gained} value={sheet} onChange={setTokens} />
          </>
        ) : null}
        {card === 'diplomacy' ? (
          <div className="rowline">
            {ownedPlanets(state, seat).filter(p => p.exhausted).map(planet => (
              <button key={planet.id} type="button" className={`pay${pay.includes(planet.id) ? ' on' : ''}`} data-testid={`ready-${planet.id}`}
                disabled={!pay.includes(planet.id) && pay.length >= 2}
                onClick={() => setPlanets(pay.includes(planet.id) ? pay.filter(id => id !== planet.id) : [...pay, planet.id])}>
                Ready {planet.name}
              </button>
            ))}
          </div>
        ) : null}
        {card === 'technology' ? (
          <>
            <PayRow state={state} seat={seat} needed={needed} planets={pay} onPlanets={setPlanets} tradeGoods={tradeGoods} onTradeGoods={setTradeGoods} />
            <TechDrawer state={state} seat={seat} allowed={techOptions} selected={techId ?? template.techId ?? null} onSelect={setTechId} />
          </>
        ) : null}
        {card === 'warfare' ? (
          <>
            <div className="sub" data-testid="secondary-units">
              Produce {(Object.entries(units) as [UnitType, number][]).map(([type, n]) => `${n} ${unitLabel(type, player)}`).join(', ')} at your home system.
            </div>
            <PayRow state={state} seat={seat} needed={warfareNeeded} planets={pay} onPlanets={setPlanets} tradeGoods={tradeGoods} onTradeGoods={setTradeGoods} />
          </>
        ) : null}
        {card === 'trade' ? <div className="sub">Replenish your commodities.</div> : null}
        {card === 'imperial' ? <div className="sub">Gain two trade goods.</div> : null}
      </div>
    </div>
  )
}
