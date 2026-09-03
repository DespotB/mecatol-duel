import { useState } from 'react'
import { bombardTargets, landTargets } from '../moveOptions'
import { planetLabel } from '../format'
import { Stepper } from './Stepper'
import { useGame } from '../store'

export function InvasionPanel() {
  const { session, legal, apply } = useGame()
  const [counts, setCounts] = useState<Record<string, number>>({})
  if (!session) return null
  const state = session.state
  const landings = landTargets(legal)
  const bombards = bombardTargets(legal)
  const countOf = (planetId: string, max: number) => counts[planetId] ?? max
  return (
    <div className="drawer bottom cut" data-testid="invasion-panel">
      <div className="in">
        <div className="dhead">
          <span className="tab">Invasion</span>
          <span className="sub">Bombard, then land your infantry and fight it out.</span>
          <div className="right">
            {legal.some(m => m.type === 'groundCombatRound') ? (
              <button type="button" className="btn gold" data-testid="btn-ground-round" onClick={() => apply({ type: 'groundCombatRound' })}>
                Ground combat round
              </button>
            ) : null}
            <button type="button" className="btn quiet" data-testid="btn-end-invasion"
              disabled={!legal.some(m => m.type === 'endInvasion')} onClick={() => apply({ type: 'endInvasion' })}>Done invading</button>
          </div>
        </div>
        <div className="rowline">
          {bombards.map(planetId => (
            <button key={planetId} type="button" className="btn quiet" data-testid={`btn-bombard-${planetId}`} onClick={() => apply({ type: 'bombard', planetId })}>
              Bombard {planetLabel(state, planetId)}
            </button>
          ))}
        </div>
        {landings.map(({ planetId, infantryIds }) => {
          const count = countOf(planetId, infantryIds.length)
          return (
            <div className="rowline" key={planetId}>
              <span className="lbl">{planetLabel(state, planetId)}</span>
              <Stepper id={`land-count-${planetId}`} value={count} min={1} max={infantryIds.length}
                onChange={n => setCounts({ ...counts, [planetId]: n })} />
              <button type="button" className="btn gold" data-testid={`btn-land-${planetId}`}
                onClick={() => apply({ type: 'land', planetId, infantryIds: infantryIds.slice(0, count) })}>
                Land {count} infantry
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
