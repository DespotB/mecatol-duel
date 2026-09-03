import { useState } from 'react'
import { FACTIONS } from '../../data/factions'
import { cardOwner, productionCost, secondaryTokenCost } from '../../engine'
import { BADGE, MISC, spriteUrl, strategyCardUrl, techArtUrl, tokenUrl } from '../art'
import { CARD_NAME, ownedPlanets, techLabel, unitLabel } from '../format'
import { secondaryOffer } from '../moveOptions'
import { PayRow } from './PayRow'
import { Rewards } from './Rewards'
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
    <div className={card === 'technology' ? 'drawer full cut' : 'dialog cut'} data-testid="secondary-panel">
      <div className="in">
        <div className="dhead">
          <span className="tab">{CARD_NAME[card]}, secondary</span>
          <span className="sub">
            {owner === null ? 'Your opponent' : state.players[owner].name} played {CARD_NAME[card]}.
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
            <Rewards items={[
              { icon: tokenUrl(player.faction, 'command'), alt: 'Command token', count: gained, label: 'Command tokens' },
            ]} note={`Costs you ${secondaryTokenCost(card)} strategy token.`} />
            <PayRow state={state} seat={seat} unit="influence" needed={0} planets={pay} onPlanets={ids => { setPlanets(ids); setTokens(null) }}
              tradeGoods={tradeGoods} onTradeGoods={n => { setTradeGoods(n); setTokens(null) }} />
            <TokenSheet current={player.tokens} gained={gained} value={sheet} onChange={setTokens} />
          </>
        ) : null}
        {card === 'diplomacy' ? (
          <>
            <Rewards items={[
              { icon: BADGE.influenceReady, alt: 'Ready planet', count: pay.length > 0 ? pay.length : 2, label: 'Ready planet' },
            ]} note={`Costs you ${secondaryTokenCost(card)} strategy token.`} />
            <div className="rowline">
              {ownedPlanets(state, seat).filter(p => p.exhausted).map(planet => (
                <button key={planet.id} type="button" className={`pay${pay.includes(planet.id) ? ' on' : ''}`} data-testid={`ready-${planet.id}`}
                  disabled={!pay.includes(planet.id) && pay.length >= 2}
                  onClick={() => setPlanets(pay.includes(planet.id) ? pay.filter(id => id !== planet.id) : [...pay, planet.id])}>
                  Ready {planet.name}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {card === 'technology' ? (
          <>
            <Rewards items={[
              {
                icon: (techId ?? template.techId) ? techArtUrl(techId ?? template.techId ?? '') : strategyCardUrl('technology'),
                alt: (techId ?? template.techId) ? techLabel(techId ?? template.techId ?? '') : 'Technology',
                count: 1,
                label: (techId ?? template.techId) ? techLabel(techId ?? template.techId ?? '') : 'Technology',
              },
            ]} note={`Costs you ${secondaryTokenCost(card)} strategy token.`} />
            <PayRow state={state} seat={seat} needed={needed} planets={pay} onPlanets={setPlanets} tradeGoods={tradeGoods} onTradeGoods={setTradeGoods} />
            <TechDrawer state={state} seat={seat} allowed={techOptions} selected={techId ?? template.techId ?? null} onSelect={setTechId} />
          </>
        ) : null}
        {card === 'warfare' ? (
          <>
            <div className="sub" data-testid="secondary-units">Produce at your home system.</div>
            <Rewards items={(Object.entries(units) as [UnitType, number][]).map(([type, n]) => (
              { icon: spriteUrl(player.color, type), alt: unitLabel(type, player), count: n, label: unitLabel(type, player) }
            ))} note={`Costs you ${secondaryTokenCost(card)} strategy token.`} />
            <PayRow state={state} seat={seat} needed={warfareNeeded} planets={pay} onPlanets={setPlanets} tradeGoods={tradeGoods} onTradeGoods={setTradeGoods} />
          </>
        ) : null}
        {card === 'trade' ? (
          <>
            <div className="sub">Your commodities come back.</div>
            <Rewards items={[
              { icon: MISC.commodity, alt: 'Commodity', count: Math.max(0, FACTIONS[player.faction].commodityValue - player.commodities), label: 'Commodities' },
            ]} note={`Costs you ${secondaryTokenCost(card)} strategy token.`} />
          </>
        ) : null}
        {card === 'imperial' ? (
          <>
            <div className="sub">You get trade goods.</div>
            <Rewards items={[
              { icon: MISC.tradeGood, alt: 'Trade good', count: 2, label: 'Trade goods' },
            ]} note={`Costs you ${secondaryTokenCost(card)} strategy token.`} />
          </>
        ) : null}
      </div>
    </div>
  )
}
