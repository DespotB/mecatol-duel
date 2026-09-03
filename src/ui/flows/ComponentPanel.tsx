import { useState } from 'react'
import { TRADE_POSTS } from '../../data/map'
import { POSTS } from '../../data/posts'
import { REFIT_TYPES, commodityLimit, postAbilityOptions, refitValue } from '../../engine'
import { formatClock, planetLabel, systemLabel, techLabel, timeTradeCost, unitLabel } from '../format'
import { inheritanceTechIds, postInReach, shipyardOffers } from '../moveOptions'
import { ProductionPicker } from './ProductionPicker'
import { Stepper } from './Stepper'
import { TechDrawer } from './TechDrawer'
import { useGame } from '../store'
import { useEscape } from '../useEscape'
import type { PostDef } from '../../data/posts'
import type { GameState, PostAbilityParams, Seat, UnitType } from '../../engine/types'

type Post = 'west' | 'east'
const SIDES: readonly Post[] = ['west', 'east']
const POOLS = ['tactic', 'fleet', 'strategy'] as const

/** Half costs are real here, because a fighter is worth half a cost; 4 reads as 4, not as 4.0. */
function money(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function linkedNames(post: Post): string {
  return TRADE_POSTS[post].map(systemLabel).join(' or ')
}

/** Why the ability cannot be taken, in the player's terms; `null` means it can. */
function abilityReason(state: GameState, seat: Seat, post: Post, options: PostAbilityParams[]): string | null {
  if (state.postAbilityUsed[post]) return 'Used this round'
  if (!postInReach(state, seat, post)) return `Hold a planet in ${linkedNames(post)}`
  if (options.length === 0) return 'Nothing to trade for right now'
  return null
}

function saleReason(state: GameState, seat: Seat, post: Post): string | null {
  if (!postInReach(state, seat, post)) return `Hold a planet in ${linkedNames(post)}`
  if (state.players[seat].tradedThisRound[post]) return 'Sold here this round'
  if (state.players[seat].commodities < 1) return 'No commodities left'
  return null
}

interface Draft {
  techId: string | null
  takeTechId: string | null
  planet: string | null
  pay: 'resources' | 'influence'
  pool: 'tactic' | 'fleet' | 'strategy' | null
  give: number[]
  take: Partial<Record<UnitType, number>>
}

const EMPTY: Draft = { techId: null, takeTechId: null, planet: null, pay: 'resources', pool: null, give: [], take: {} }

/** The parameters the open controls add up to, in the shape the engine's move takes. */
function paramsOf(def: PostDef, draft: Draft): PostAbilityParams {
  switch (def.ability) {
    case 'timeTrade': return {}
    case 'techExchange': return { techId: draft.techId ?? undefined, takeTechId: draft.takeTechId ?? undefined }
    case 'clearingHouse': return { planet: draft.planet ?? undefined, pay: draft.pay }
    case 'charter':
    case 'layover': return { pool: draft.pool ?? undefined }
    case 'refit': return { give: draft.give, take: draft.take }
  }
}

export function ComponentPanel({ onClose }: { onClose: () => void }) {
  const { session, legal, apply } = useGame()
  const [techId, setTechId] = useState<string | null>(null)
  const [amount, setAmount] = useState<Partial<Record<Post, number>>>({})
  const [open, setOpen] = useState<Post | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  useEscape(onClose)
  if (!session) return null
  const state = session.state
  const seat = state.active
  const player = state.players[seat]
  const techs = inheritanceTechIds(legal)
  const yards = shipyardOffers(legal)
  const patch = (next: Partial<Draft>) => { setDraft(prev => ({ ...prev, ...next })) }
  const openAbility = (post: Post) => {
    setOpen(prev => prev === post ? null : post)
    setDraft(EMPTY)
  }

  /** The controls one ability needs, built from the state; the engine checks whatever comes back. */
  function controls(post: Post, def: PostDef, options: PostAbilityParams[]) {
    switch (def.ability) {
      case 'timeTrade':
        return <div className="rowline"><span className="sub">{def.abilityText}</span></div>
      case 'techExchange': {
        const gives = [...new Set(options.flatMap(o => o.techId ? [o.techId] : []))]
        const takes = options.flatMap(o => o.techId === draft.techId && o.takeTechId ? [o.takeTechId] : [])
        return (
          <>
            <div className="payrow">
              <span className="lbl">Return</span>
              {gives.map(id => (
                <button key={id} type="button" data-testid={`give-tech-${id}`}
                  className={`pay${draft.techId === id ? ' on' : ''}`}
                  onClick={() => { patch({ techId: id, takeTechId: null }) }}>{techLabel(id)}</button>
              ))}
            </div>
            {draft.techId === null ? null : (
              <TechDrawer state={state} seat={seat} allowed={takes} selected={draft.takeTechId}
                onSelect={id => { patch({ takeTechId: id }) }} />
            )}
          </>
        )
      }
      case 'clearingHouse': {
        const planets = [...new Set(options.flatMap(o => o.planet ? [o.planet] : []))]
        const chosen = planets.includes(draft.planet ?? '') ? draft.planet : null
        const values = (id: string) => Object.values(state.systems)
          .flatMap(sys => sys.planets.filter(p => p.id === id))[0]
        return (
          <>
            <div className="payrow">
              <span className="lbl">Exhaust</span>
              {planets.map(id => (
                <button key={id} type="button" data-testid={`ch-planet-${id}`}
                  className={`pay${chosen === id ? ' on' : ''}`}
                  onClick={() => { patch({ planet: id }) }}>{planetLabel(state, id)}</button>
              ))}
            </div>
            <div className="payrow">
              <span className="lbl">Take</span>
              {(['resources', 'influence'] as const).map(unit => (
                <button key={unit} type="button" data-testid={`ch-pay-${unit}`} disabled={chosen === null}
                  className={`pay${draft.pay === unit ? ' on' : ''}`}
                  onClick={() => { patch({ pay: unit }) }}>
                  {chosen === null ? unit : `${values(chosen)[unit]} for its ${unit}`}
                </button>
              ))}
            </div>
          </>
        )
      }
      case 'charter':
      case 'layover':
        return (
          <div className="payrow">
            <span className="lbl">Return a token from</span>
            {POOLS.map(pool => (
              <button key={pool} type="button" data-testid={`pool-${pool}`} disabled={player.tokens[pool] < 1}
                className={`pay${draft.pool === pool ? ' on' : ''}`}
                onClick={() => { patch({ pool }) }}>{pool} {player.tokens[pool]}</button>
            ))}
          </div>
        )
      case 'refit': {
        const stats = { faction: player.faction, techs: player.techs }
        // R8: a refit happens in one system, so picking a ship settles which of the two linked ones it is
        const chosenSystem = TRADE_POSTS[post]
          .find(id => state.systems[id].space.some(u => draft.give.includes(u.id))) ?? null
        const returned = draft.give.reduce((sum, id) => {
          const ship = Object.values(state.systems).flatMap(sys => sys.space).find(u => u.id === id)
          return sum + (ship ? refitValue(ship.type, stats) : 0)
        }, 0)
        const taking = (Object.entries(draft.take) as [UnitType, number][])
          .reduce((sum, [type, n]) => sum + refitValue(type, stats) * n, 0)
        return (
          <>
            {TRADE_POSTS[post].map(systemId => {
              const ships = state.systems[systemId].space.filter(u => u.owner === seat && REFIT_TYPES.includes(u.type))
              if (ships.length === 0) return null
              return (
                <div className="payrow" key={systemId}>
                  <span className="lbl">{systemLabel(systemId)}</span>
                  {ships.map(ship => (
                    <button key={ship.id} type="button" data-testid={`refit-give-${ship.id}`}
                      disabled={chosenSystem !== null && chosenSystem !== systemId}
                      className={`pay${draft.give.includes(ship.id) ? ' on' : ''}`}
                      onClick={() => {
                        patch({ give: draft.give.includes(ship.id) ? draft.give.filter(id => id !== ship.id) : [...draft.give, ship.id] })
                      }}>
                      {unitLabel(ship.type, player)} {money(refitValue(ship.type, stats))}
                    </button>
                  ))}
                </div>
              )
            })}
            <ProductionPicker state={state} seat={seat} types={REFIT_TYPES} limit={Math.floor(returned * 2)}
              units={draft.take} onUnits={take => { patch({ take }) }} />
            <div className="rowline">
              <span className="sub" data-testid="refit-total">Returned {money(returned)}, taking {money(taking)}</span>
            </div>
          </>
        )
      }
    }
  }

  function confirmLabel(def: PostDef): string {
    if (def.ability === 'timeTrade') return `Pay ${formatClock(timeTradeCost(session?.clockMs[seat] ?? 0))} for 1 victory point`
    return `Use ${def.abilityName}`
  }

  /** Whether the open controls add up to something the engine will take. */
  function ready(def: PostDef, params: PostAbilityParams): boolean {
    const stats = { faction: player.faction, techs: player.techs }
    switch (def.ability) {
      case 'timeTrade': return true
      case 'techExchange': return params.techId !== undefined && params.takeTechId !== undefined
      case 'clearingHouse': return params.planet !== undefined
      case 'charter':
      case 'layover': return params.pool !== undefined
      case 'refit': {
        const give = params.give ?? []
        const take = (Object.entries(params.take ?? {}) as [UnitType, number][]).filter(([, n]) => n > 0)
        if (give.length === 0 || take.length === 0) return false
        const returned = give.reduce((sum, id) => {
          const ship = Object.values(state.systems).flatMap(sys => sys.space).find(u => u.id === id)
          return sum + (ship ? refitValue(ship.type, stats) : 0)
        }, 0)
        return take.reduce((sum, [type, n]) => sum + refitValue(type, stats) * n, 0) <= returned
      }
    }
  }

  return (
    <div className="dialog cut" data-testid="component-panel">
      <div className="in">
        <div className="dhead">
          <span className="tab">Component actions</span>
          <div className="right">
            <button type="button" className="btn quiet" data-testid="btn-component-cancel" onClick={onClose}>Close</button>
          </div>
        </div>
        {SIDES.map(post => {
          const def = POSTS[state.posts[post]]
          const limit = commodityLimit(state, post)
          const most = Math.min(limit, player.commodities)
          const commodities = Math.min(amount[post] ?? most, most)
          const sale = saleReason(state, seat, post)
          const options = postAbilityOptions(state, seat, post)
          const blocked = abilityReason(state, seat, post, options)
          const params = paramsOf(def, draft)
          return (
            <div key={post} data-testid={`post-block-${post}`}>
              <div className="rowline">
                <span className="lbl" data-testid={`post-sale-${post}`}>{def.name}</span>
                <Stepper id={`sale-${post}`} value={commodities} min={Math.min(1, most)} max={most}
                  onChange={n => { setAmount(prev => ({ ...prev, [post]: n })) }} />
                <button type="button" className="btn quiet" data-testid={`btn-tradepost-${post}`} disabled={sale !== null}
                  onClick={() => { apply({ type: 'tradePost', post, commodities }) }}>
                  Sell {commodities} of {limit} commodities
                </button>
                {sale === null ? null : <span className="sub" data-testid={`sale-reason-${post}`}>{sale}</span>}
              </div>
              <div className="rowline">
                <button type="button" className="btn quiet" data-testid={`btn-ability-${post}`} disabled={blocked !== null}
                  onClick={() => { openAbility(post) }}>{def.abilityName}</button>
                <span className="sub">{def.abilityText}</span>
                {blocked === null ? null : <span className="sub" data-testid={`ability-reason-${post}`}>{blocked}</span>}
              </div>
              {open === post && blocked === null ? (
                <>
                  {controls(post, def, options)}
                  <div className="rowline">
                    <button type="button" className="btn gold" data-testid="btn-ability-confirm" disabled={!ready(def, params)}
                      onClick={() => { if (apply({ type: 'postAbility', post, params })) setOpen(null) }}>
                      {confirmLabel(def)}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )
        })}
        <div className="rowline">
          {yards.map(offer => (
            <button key={offer.planetId} type="button" className="btn quiet" data-testid={`btn-shipyard-${offer.planetId}`}
              onClick={() => { if (apply({ type: 'shipyard', planetId: offer.planetId, planets: offer.planets, tradeGoods: offer.tradeGoods })) onClose() }}>
              Emergency shipyard on {planetLabel(state, offer.planetId)}
            </button>
          ))}
        </div>
        {techs.length > 0 ? (
          <>
            <div className="rowline">
              <span className="sub">Inheritance Systems: exhaust the card and spend 2 resources to research one technology, prerequisites ignored.</span>
              <button type="button" className="btn gold" data-testid="btn-inheritance" disabled={techId === null}
                onClick={() => { if (techId && apply({ type: 'research', techId, via: 'inheritance' })) onClose() }}>Research</button>
            </div>
            <TechDrawer state={state} seat={state.active} allowed={techs} selected={techId} onSelect={setTechId} />
          </>
        ) : null}
      </div>
    </div>
  )
}
