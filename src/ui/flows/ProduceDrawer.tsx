import { useState } from 'react'
import { unitStats } from '../../data/units'
import { PRODUCIBLE, productionCost, productionLimit } from '../../engine'
import { unitCardUrl } from '../art'
import { systemLabel, unitLabel } from '../format'
import { PayRow } from './PayRow'
import { Stepper } from './Stepper'
import { useGame } from '../store'
import type { UnitType } from '../../engine/types'

const DISPLAY_ORDER: UnitType[] = ['dreadnought', 'carrier', 'cruiser', 'destroyer', 'fighter', 'infantry', 'warsun', 'flagship']

export function ProduceDrawer() {
  const { session, legal, apply } = useGame()
  const [units, setUnits] = useState<Partial<Record<UnitType, number>>>({})
  const [planets, setPlanets] = useState<string[]>([])
  const [tradeGoods, setTradeGoods] = useState(0)
  if (!session) return null
  const state = session.state
  const seat = state.active
  const player = state.players[seat]
  const stats = { faction: player.faction, techs: player.techs }
  const systemId = state.tactical?.systemId ?? ''
  const limit = productionLimit(state, seat, systemId)
  const total = DISPLAY_ORDER.reduce((sum, type) => sum + (units[type] ?? 0), 0)
  const cost = productionCost(units, stats, player.techs.includes('sarween_tools'))
  const paid = planets.reduce((sum, id) => {
    const planet = Object.values(state.systems).flatMap(s => s.planets).find(p => p.id === id)
    return sum + (planet ? planet.resources : 0)
  }, 0) + tradeGoods
  const order = DISPLAY_ORDER.filter(type => PRODUCIBLE.includes(type))
  return (
    <div className="drawer bottom cut" data-testid="produce-drawer">
      <div className="in">
        <div className="dhead">
          <span className="tab">Production at {systemLabel(systemId)}</span>
          <span className="sub">
            Production <b data-testid="produce-limit">{limit}</b>, used <b>{total}</b>, cost <b data-testid="produce-cost">{cost}</b>
          </span>
          <div className="right">
            <button type="button" className="btn gold" data-testid="btn-produce"
              disabled={total === 0 || total > limit || paid < cost}
              onClick={() => { if (apply({ type: 'produce', units, planets, tradeGoods })) { setUnits({}); setPlanets([]); setTradeGoods(0) } }}>
              Confirm production
            </button>
            <button type="button" className="btn quiet" data-testid="btn-end-tactical"
              disabled={!legal.some(m => m.type === 'endTactical')} onClick={() => apply({ type: 'endTactical' })}>End turn</button>
          </div>
        </div>
        <div className="ucards">
          {order.map(type => {
            const printed = unitStats(type, stats)
            const count = units[type] ?? 0
            const room = Math.min(limit - total + count, player.reinforcements[type])
            return (
              <div className={`uc${room === 0 ? ' off' : ''}`} key={type}>
                <img src={unitCardUrl(type, player.faction)} alt="" />
                <div className="n">{unitLabel(type, player)}</div>
                <div className="s">Cost {printed.producedPerCost > 1 ? `${printed.cost} for ${printed.producedPerCost}` : printed.cost}</div>
                <Stepper id={`step-${type}`} value={count} max={Math.max(count, room)}
                  onChange={n => setUnits({ ...units, [type]: n })} />
              </div>
            )
          })}
        </div>
        <PayRow state={state} seat={seat} needed={cost} planets={planets} onPlanets={setPlanets}
          tradeGoods={tradeGoods} onTradeGoods={setTradeGoods} />
      </div>
    </div>
  )
}
