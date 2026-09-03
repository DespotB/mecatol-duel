import type { Player } from '../../engine/types'

const POOLS = ['tactic', 'fleet', 'strategy'] as const

export interface TokenSheetProps {
  current: Player['tokens']
  gained: number
  redistribute?: boolean
  value: Player['tokens']
  onChange: (next: Player['tokens']) => void
}

/** Edits the resulting command sheet, exactly as economy.distributeTokens reads it. */
export function TokenSheet({ current, gained, redistribute = false, value, onChange }: TokenSheetProps) {
  const target = current.tactic + current.fleet + current.strategy + gained
  const placed = value.tactic + value.fleet + value.strategy
  return (
    <div className="rowline" data-testid="token-sheet">
      <span className="lbl">Command tokens, {gained} new</span>
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
      <span className="sub" data-testid="token-total">{placed} of {target}</span>
    </div>
  )
}
