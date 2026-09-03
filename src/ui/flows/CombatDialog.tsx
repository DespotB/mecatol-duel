import { useState } from 'react'
import { lastRolls } from '../history'
import { munitionsOptions, retreatTargetsOf } from '../moveOptions'
import { systemLabel } from '../format'
import { useGame } from '../store'
import type { Owner } from '../../engine/types'

export function CombatDialog() {
  const { session, legal, apply } = useGame()
  const [attacker, setAttacker] = useState(false)
  const [defender, setDefender] = useState(false)
  if (!session) return null
  const state = session.state
  const combat = state.tactical?.combat
  if (!combat) return null
  const allowed = munitionsOptions(legal)
  const retreats = retreatTargetsOf(legal)
  const name = (owner: Owner) => owner === 'guardian' ? 'Guardian fleet' : state.players[owner].name
  const munitions = (attacker && allowed.attacker) || (defender && allowed.defender)
    ? { attacker: attacker && allowed.attacker, defender: defender && allowed.defender }
    : undefined
  return (
    <div className="dialog cut" data-testid="combat-dialog">
      <div className="in">
        <div className="dhead">
          <span className="tab">Space combat in {systemLabel(state.tactical?.systemId ?? '')}</span>
          <span className="sub" data-testid="combat-round">Round {combat.round}</span>
          <div className="right">
            <button type="button" className="btn gold" data-testid="btn-combat-round"
              disabled={!legal.some(m => m.type === 'combatRound')}
              onClick={() => { apply({ type: 'combatRound', munitions }); setAttacker(false); setDefender(false) }}>
              {combat.round === 0 ? 'Open fire' : `Fight round ${combat.round}`}
            </button>
          </div>
        </div>
        <div className="rowline">
          <span className="lbl">{name(combat.attacker)} attacks {name(combat.defender)}</span>
          {allowed.attacker ? (
            <label className="pay">
              <input type="checkbox" data-testid="munitions-attacker" checked={attacker} onChange={e => setAttacker(e.target.checked)} />
              Munitions Reserves, attacker
            </label>
          ) : null}
          {allowed.defender ? (
            <label className="pay">
              <input type="checkbox" data-testid="munitions-defender" checked={defender} onChange={e => setDefender(e.target.checked)} />
              Munitions Reserves, defender
            </label>
          ) : null}
        </div>
        {lastRolls(state).map((entry, i) => (
          <div className="logline roll" key={i} data-testid={`combat-rolls-${i}`}>
            {name(entry.owner)}: {entry.rolls.map(r => `${r.value}${r.hit ? ' hit' : ''}`).join(', ') || 'no dice'} ({entry.context})
          </div>
        ))}
        {combat.retreating !== null ? (
          <div className="rowline" data-testid="retreat-announced">Retreat announced to {systemLabel(combat.retreatTo ?? '')}</div>
        ) : (
          <div className="rowline">
            {retreats.map(to => (
              <button key={to} type="button" className="btn quiet" data-testid={`btn-retreat-${to}`} onClick={() => apply({ type: 'retreat', to })}>
                Retreat to {systemLabel(to)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
