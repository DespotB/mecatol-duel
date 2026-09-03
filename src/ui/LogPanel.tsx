import { describeEntry } from './logText'
import type { GameState } from '../engine/types'

export function LogPanel({ state, onClose }: { state: GameState; onClose?: () => void }) {
  return (
    <div className="logpanel cut" data-testid="log-panel">
      <div className="in">
        <div className="dhead">
          <span className="tab">Game log</span>
          {onClose ? <div className="right"><button type="button" className="btn quiet" data-testid="btn-log-close" onClick={onClose}>Close</button></div> : null}
        </div>
        {state.log.map((entry, i) => {
          const line = describeEntry(state, entry)
          return <div className={`logline ${line.kind}`} key={i} data-testid={`log-entry-${i}`}>{line.text}</div>
        })}
      </div>
    </div>
  )
}
