import { useState } from 'react'
import { PUBLIC_OBJECTIVES } from '../../data/objectives'
import { CARD_NAME, ownedPlanets, planetLabel, systemLabel } from '../format'
import { strategicVariants } from '../moveOptions'
import { PayRow } from './PayRow'
import { TechDrawer } from './TechDrawer'
import { TokenSheet } from './TokenSheet'
import { useGame } from '../store'
import { useEscape } from '../useEscape'
import type { Player, StrategicParams, StrategyCardId } from '../../engine/types'

export interface StrategicDialogProps {
  card: StrategyCardId
  onClose: () => void
}

export function StrategicDialog({ card, onClose }: StrategicDialogProps) {
  const { session, legal, apply } = useGame()
  const [planets, setPlanets] = useState<string[]>([])
  const [tradeGoods, setTradeGoods] = useState(0)
  const [systemId, setSystemId] = useState<string | null>(null)
  const [techId, setTechId] = useState<string | null>(null)
  const [objectiveId, setObjectiveId] = useState<string | null>(null)
  const [share, setShare] = useState(false)
  const [tokens, setTokens] = useState<Player['tokens'] | null>(null)
  useEscape(onClose)
  if (!session) return null
  const state = session.state
  const seat = state.active
  const player = state.players[seat]
  const variants = strategicVariants(legal, card)
  const systems = [...new Set(variants.flatMap(v => v.systemId ? [v.systemId] : []))]
  const techOptions = variants.flatMap(v => v.techId ? [v.techId] : [])
  const objectives = variants.flatMap(v => v.objectiveId ? [v.objectiveId] : [])
  const influence = planets.reduce((sum, id) => {
    const planet = ownedPlanets(state, seat).find(p => p.id === id)
    return sum + (planet ? planet.influence : 0)
  }, 0) + tradeGoods
  const gained = card === 'leadership' ? 3 + Math.floor(influence / 3) : card === 'warfare' ? (systemId ? 1 : 0) : 0
  const sheet = tokens ?? { ...player.tokens, tactic: player.tokens.tactic + gained }

  function params(): StrategicParams {
    switch (card) {
      case 'leadership': return { planets, tradeGoods, tokens: sheet }
      case 'diplomacy': return systemId ? { systemId, planets } : { planets }
      case 'trade': return share ? { shareWithOpponent: true } : {}
      case 'warfare': return systemId ? { systemId, tokens: sheet } : { tokens: sheet }
      case 'technology': return techId ? { techId } : {}
      case 'imperial': return objectiveId ? { objectiveId } : {}
    }
  }

  // A parameter is required exactly when the enumerator offers values for it: Technology needs a
  // technology, Imperial a fulfilled objective, Diplomacy and Warfare a system. Confirming without one
  // is a move the engine rejects, so the button stays dead until the choice is made.
  const missing =
    card === 'technology' ? techOptions.length > 0 && techId === null
      : card === 'imperial' ? objectives.length > 0 && objectiveId === null
        : (card === 'diplomacy' || card === 'warfare') ? systems.length > 0 && systemId === null
          : false

  return (
    <div className={card === 'technology' ? 'drawer full cut' : 'dialog cut'} data-testid="strategic-dialog">
      <div className="in">
        <div className="dhead">
          <span className="tab">{CARD_NAME[card]}, primary</span>
          <div className="right">
            <button type="button" className="btn gold" data-testid="btn-strategic-confirm" disabled={missing}
              onClick={() => { if (apply({ type: 'strategic', card, params: params() })) onClose() }}>Play the card</button>
            <button type="button" className="btn quiet" data-testid="btn-strategic-cancel" onClick={onClose}>Cancel</button>
          </div>
        </div>

        {card === 'leadership' ? (
          <>
            <div className="sub">Three command tokens, and one more for every 3 influence you spend.</div>
            <PayRow state={state} seat={seat} unit="influence" needed={0} planets={planets} onPlanets={ids => { setPlanets(ids); setTokens(null) }}
              tradeGoods={tradeGoods} onTradeGoods={n => { setTradeGoods(n); setTokens(null) }} />
            <TokenSheet current={player.tokens} gained={gained} value={sheet} onChange={setTokens} />
          </>
        ) : null}

        {card === 'diplomacy' ? (
          <>
            <div className="sub">Your opponent places a command token in the chosen system. Then ready up to two of your planets.</div>
            <div className="rowline">
              {systems.map(id => (
                <button key={id} type="button" className={`pay${systemId === id ? ' on' : ''}`} data-testid={`system-pick-${id}`} onClick={() => setSystemId(id)}>
                  {systemLabel(id)}
                </button>
              ))}
            </div>
            <div className="rowline">
              {ownedPlanets(state, seat).filter(p => p.exhausted).map(planet => (
                <button key={planet.id} type="button" className={`pay${planets.includes(planet.id) ? ' on' : ''}`}
                  data-testid={`ready-${planet.id}`} disabled={!planets.includes(planet.id) && planets.length >= 2}
                  onClick={() => setPlanets(planets.includes(planet.id) ? planets.filter(id => id !== planet.id) : [...planets, planet.id])}>
                  Ready {planet.name}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {card === 'trade' ? (
          <div className="rowline">
            <span className="sub">Three trade goods and your commodities back.</span>
            <label className="pay">
              <input type="checkbox" data-testid="share-toggle" checked={share} onChange={e => setShare(e.target.checked)} />
              Let {state.players[seat === 0 ? 1 : 0].name} replenish too
            </label>
          </div>
        ) : null}

        {card === 'warfare' ? (
          <>
            <div className="sub">Take one command token off the board, gain one, then rearrange your sheet.</div>
            <div className="rowline">
              {systems.map(id => (
                <button key={id} type="button" className={`pay${systemId === id ? ' on' : ''}`} data-testid={`system-pick-${id}`}
                  onClick={() => { setSystemId(id); setTokens(null) }}>
                  Token from {systemLabel(id)}
                </button>
              ))}
            </div>
            <TokenSheet current={player.tokens} gained={gained} redistribute value={sheet} onChange={setTokens} />
          </>
        ) : null}

        {card === 'technology' ? (
          <>
            <div className="sub">Research one technology.</div>
            <TechDrawer state={state} seat={seat} allowed={techOptions} selected={techId} onSelect={setTechId} />
          </>
        ) : null}

        {card === 'imperial' ? (
          <>
            <div className="sub">Score one fulfilled public objective, plus a victory point if you hold Mecatol Rex.</div>
            <div className="rowline">
              {objectives.map(id => (
                <button key={id} type="button" className={`pay${objectiveId === id ? ' on' : ''}`} data-testid={`objective-pick-${id}`} onClick={() => setObjectiveId(id)}>
                  {PUBLIC_OBJECTIVES.find(o => o.id === id)?.text ?? id}
                </button>
              ))}
              {objectives.length === 0 ? <span className="sub">No objective is fulfilled right now.</span> : null}
            </div>
          </>
        ) : null}

        {card === 'diplomacy' && systems.length === 0 ? <div className="sub">You control no planet outside {planetLabel(state, 'mecatol-rex')}.</div> : null}
      </div>
    </div>
  )
}
