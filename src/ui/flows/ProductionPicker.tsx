import { unitStats } from '../../data/units'
import { PRODUCIBLE, productionCost } from '../../engine'
import { unitCardUrl } from '../art'
import { unitLabel } from '../format'
import { Stepper } from './Stepper'
import type { GameState, Seat, UnitType } from '../../engine/types'

const DISPLAY_ORDER: UnitType[] = ['dreadnought', 'carrier', 'cruiser', 'destroyer', 'fighter', 'infantry', 'warsun', 'flagship']

export function unitTotal(units: Partial<Record<UnitType, number>>): number {
  return DISPLAY_ORDER.reduce((sum, type) => sum + (units[type] ?? 0), 0)
}

export function costOf(state: GameState, seat: Seat, units: Partial<Record<UnitType, number>>): number {
  const player = state.players[seat]
  return productionCost(units, { faction: player.faction, techs: player.techs }, player.techs.includes('sarween_tools'))
}

export interface ProductionPickerProps {
  state: GameState
  seat: Seat
  /** How many units the space dock may still make; the steppers cap themselves on it. */
  limit: number
  units: Partial<Record<UnitType, number>>
  onUnits: (units: Partial<Record<UnitType, number>>) => void
  /** Which unit kinds to offer; production offers all of them, R8's refit only the ships. */
  types?: readonly UnitType[]
}

/** R4.4: the unit reference cards with a count under each, shared by the tactical production and Warfare. */
export function ProductionPicker({ state, seat, limit, units, onUnits, types = PRODUCIBLE }: ProductionPickerProps) {
  const player = state.players[seat]
  const stats = { faction: player.faction, techs: player.techs }
  const total = unitTotal(units)
  return (
    <div className="ucards" data-testid="production-picker">
      {DISPLAY_ORDER.filter(type => types.includes(type)).map(type => {
        const printed = unitStats(type, stats)
        const count = units[type] ?? 0
        const room = Math.min(limit - total + count, player.reinforcements[type])
        return (
          <div className={`uc${room === 0 ? ' off' : ''}`} key={type}>
            <img src={unitCardUrl(type, player.faction)} alt="" />
            <div className="n">{unitLabel(type, player)}</div>
            <div className="s">Cost {printed.producedPerCost > 1 ? `${printed.cost} for ${printed.producedPerCost}` : printed.cost}</div>
            <Stepper id={`step-${type}`} value={count} max={Math.max(count, room)} onChange={n => onUnits({ ...units, [type]: n })} />
          </div>
        )
      })}
    </div>
  )
}
