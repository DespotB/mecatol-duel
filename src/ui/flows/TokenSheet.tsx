import { fleetPoolLoss } from '../../engine'
import { systemLabel } from '../format'
import type { GameState, Player, Seat } from '../../engine/types'

const POOLS = ['tactic', 'fleet', 'strategy'] as const

export interface TokenSheetProps {
  state: GameState
  seat: Seat
  current: Player['tokens']
  gained: number
  redistribute?: boolean
  value: Player['tokens']
  onChange: (next: Player['tokens']) => void
}

/**
 * R4.4: what the sheet on screen would cost in ships, in the engine's own words. The numbers come from
 * `fleetPoolLoss` and from nothing the interface worked out for itself, so the warning always names exactly
 * what the confirmed move goes on to destroy.
 */
function lossText(state: GameState, seat: Seat, tokens: Player['tokens']): string | null {
  const loss = fleetPoolLoss(state, seat, tokens)
  if (!loss.length) return null
  const total = loss.reduce((sum, entry) => sum + entry.units.length, 0)
  const where = loss.map(entry => `${entry.units.length} in ${systemLabel(entry.systemId)}`).join(', ')
  return `This gives up ${total} ${total === 1 ? 'ship' : 'ships'} (${where}). The cheapest ships go first.`
}

/**
 * Edits the resulting command sheet, exactly as economy.distributeTokens reads it. New tokens start
 * unplaced, so the player adds each one where they want it instead of taking it back out of the tactic
 * pool the engine would otherwise have guessed. A sheet that takes a token out of the fleet pool is a legal
 * move whose price is ships, so it is warned about and never blocked.
 */
export function TokenSheet({ state, seat, current, gained, redistribute = false, value, onChange }: TokenSheetProps) {
  const target = current.tactic + current.fleet + current.strategy + gained
  const placed = value.tactic + value.fleet + value.strategy
  const loss = lossText(state, seat, value)
  return (
    <>
      <div className="rowline" data-testid="token-sheet">
        <span className="lbl">Command tokens</span>
        {POOLS.map(pool => (
          <span className="pay" key={pool}>
            {pool}
            <button type="button" data-testid={`token-${pool}-minus`}
              disabled={value[pool] <= (redistribute ? 0 : current[pool])}
              onClick={() => onChange({ ...value, [pool]: value[pool] - 1 })}>-</button>
            <b data-testid={`token-${pool}`}>{value[pool]}</b>
            <button type="button" data-testid={`token-${pool}-plus`}
              disabled={placed >= target}
              onClick={() => onChange({ ...value, [pool]: value[pool] + 1 })}>+</button>
          </span>
        ))}
        <span className="sub" data-testid="token-total">
          {target - placed > 0 ? `${target - placed} of ${gained} still to place` : `all ${gained} placed`}
        </span>
      </div>
      {loss ? <div className="warn" data-testid="fleet-pool-warning">{loss}</div> : null}
    </>
  )
}
