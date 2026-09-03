// Own copy of the PayRow control (also defined by the parallel tactical-flows branch as
// src/ui/flows/PayRow.tsx) so the two worktrees do not both create the same new file path.
import { MISC } from '../art'
import { ownedPlanets } from '../format'
import { Stepper } from './StepperStrategic'
import type { GameState, Seat } from '../../engine/types'

export interface PayRowProps {
  state: GameState
  seat: Seat
  unit?: 'resources' | 'influence'
  needed: number
  planets: string[]
  onPlanets: (planets: string[]) => void
  tradeGoods: number
  onTradeGoods: (n: number) => void
}

/** R4.4 and R5: exhaust ready planets and spend trade goods; overpay is lost, which the line spells out. */
export function PayRow({ state, seat, unit = 'resources', needed, planets, onPlanets, tradeGoods, onTradeGoods }: PayRowProps) {
  const owned = ownedPlanets(state, seat)
  const value = (planetId: string) => {
    const planet = owned.find(p => p.id === planetId)
    if (!planet) return 0
    return unit === 'resources' ? planet.resources : planet.influence
  }
  const paid = planets.reduce((sum, id) => sum + value(id), 0) + tradeGoods
  return (
    <div className="payrow" data-testid="payrow">
      <span className="lbl">Pay with</span>
      {owned.map(planet => (
        <button
          key={planet.id} type="button" disabled={planet.exhausted}
          className={`pay${planets.includes(planet.id) ? ' on' : ''}`} data-testid={`pay-${planet.id}`}
          onClick={() => onPlanets(planets.includes(planet.id) ? planets.filter(id => id !== planet.id) : [...planets, planet.id])}
        >
          {planet.name} {unit === 'resources' ? planet.resources : planet.influence}
        </button>
      ))}
      <span className="pay">
        <img src={MISC.tradeGood} alt="" width={16} height={16} />
        <Stepper id="pay-tradegoods" value={tradeGoods} max={state.players[seat].tradeGoods} onChange={onTradeGoods} />
      </span>
      <span className="sub" data-testid="pay-total">{paid} of {needed}</span>
    </div>
  )
}
