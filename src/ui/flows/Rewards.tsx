import './rewards.css'
import type { JSX } from 'react'

/** One thing a strategy-card action hands the player: an icon, its accessible alt text, an optional
 * count (a badge; omitted for exactly 1, since "you get a trade good" reads fine without a "1"), and
 * the small-caps label shown beside it. */
export interface Reward { icon: string; alt: string; count?: number; label: string }

/** Replaces the old prose walls in the strategy-card dialogs with a short sentence (elsewhere) plus this
 * icon row of the actual live values. `items: []` renders nothing; an item whose count is 0 is dropped
 * (e.g. a commodity refill of 0 because the player is already full). */
export function Rewards({ items, note }: { items: Reward[]; note?: string }): JSX.Element | null {
  if (items.length === 0) return null
  const visible = items.filter(item => item.count !== 0)
  return (
    <>
      {note ? <div className="sub">{note}</div> : null}
      <div className="rewards" data-testid="rewards">
        {visible.map((item, key) => (
          <span className="rw" key={key} data-testid={`reward-${key}`}>
            <img className="ic" src={item.icon} alt={item.alt} />
            {item.count !== undefined && item.count !== 1 ? <b className="n">{item.count}</b> : null}
            <span className="t">{item.label}</span>
          </span>
        ))}
      </div>
    </>
  )
}
