import { useState } from 'react'
import { PUBLIC_OBJECTIVES } from '../../data/objectives'
import { scoreable, tokensGained } from '../../engine'
import { statusTemplate } from '../moveOptions'
import { TokenSheet } from './TokenSheet'
import { useGame } from '../store'
import type { Player } from '../../engine/types'

export function StatusDialog() {
  const { session, legal, apply } = useGame()
  const [tokens, setTokens] = useState<Player['tokens'] | null>(null)
  if (!session) return null
  const state = session.state
  const seat = state.active
  const player = state.players[seat]
  const template = statusTemplate(legal)
  const gained = tokensGained(state, seat)
  const sheet = tokens ?? template?.tokens ?? { ...player.tokens, tactic: player.tokens.tactic + gained }
  const scoring = scoreable(state, seat)
  return (
    <div className="dialog cut" data-testid="status-dialog">
      <div className="in">
        <div className="dhead">
          <span className="tab">Status phase, {player.name}</span>
          <span className="sub">You gain {gained} command tokens.</span>
          <div className="right">
            <button type="button" className="btn gold" data-testid="btn-status-confirm"
              onClick={() => { apply({ type: 'status', params: { tokens: sheet } }); setTokens(null) }}>Confirm</button>
          </div>
        </div>
        <div className="rowline" data-testid="status-scoring">
          <span className="lbl">Scoring</span>
          {scoring.length === 0 ? <span className="sub">Nothing to score.</span> : null}
          {scoring.map(id => (
            <span className="chip gold" key={id}>{PUBLIC_OBJECTIVES.find(o => o.id === id)?.text ?? 'Mandate, First Strike'}</span>
          ))}
        </div>
        <TokenSheet current={player.tokens} gained={gained} value={sheet} onChange={setTokens} />
      </div>
    </div>
  )
}
