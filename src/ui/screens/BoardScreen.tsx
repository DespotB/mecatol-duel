import { useState } from 'react'
import { BoardMap } from '../board/BoardMap'
import { ActionBar } from '../hud/ActionBar'
import type { ActionMode } from '../hud/ActionBar'
import { SidePanel } from '../hud/SidePanel'
import { TopBar } from '../hud/TopBar'
import { useGame } from '../store'
import type { StrategyCardId } from '../../engine/types'
// tactical flows (Task 4a)
import { CombatDialog } from '../flows/CombatDialog'
import { InvasionPanel } from '../flows/InvasionPanel'
import { MovementPanel } from '../flows/MovementPanel'
import { ProduceDrawer } from '../flows/ProduceDrawer'

const HINTS: Record<string, string> = {
  tactical: 'Tactical action. Choose a system to activate.',
  strategic: 'Strategic action. Choose one of your ready strategy cards.',
  component: 'Component action. Choose one of the offered actions.',
  strategy: 'Strategy phase. Choose a strategy card.',
  status: 'Status phase. Distribute your new command tokens.',
  idle: 'Choose an action.',
}

export function BoardScreen() {
  const { session, legal, apply } = useGame()
  const [mode, setMode] = useState<ActionMode>(null)
  const [showLog, setShowLog] = useState(false)
  if (!session) return null
  const state = session.state
  const drafting = state.phase === 'strategy'
  const onPick = drafting ? (card: StrategyCardId) => { apply({ type: 'pickStrategyCard', card }) } : undefined
  const selectable = mode === 'tactical'
    ? legal.flatMap(m => m.type === 'startTactical' ? [m.systemId] : [])
    : []
  const hint = drafting ? HINTS.strategy : state.phase === 'status' ? HINTS.status : HINTS[mode ?? 'idle']
  return (
    <div className="app" data-testid="board-screen">
      <div className="space"><div className="stars" /><div className="neb" /><div className="swirl" /><div className="limb" /><div className="dust" /></div>
      <TopBar state={state} clockMs={session.clockMs} onPick={onPick} />
      <SidePanel state={state} seat={0} />
      <SidePanel state={state} seat={1} />
      <BoardMap
        state={state}
        activeSystemId={state.tactical?.systemId ?? null}
        selectable={selectable}
        onSelect={systemId => { if (apply({ type: 'startTactical', systemId })) setMode(null) }}
      />
      {/* tactical flows (Task 4a) */}
      <>
        {state.tactical?.step === 'movement' ? <MovementPanel /> : null}
        {state.tactical?.step === 'spaceCombat' ? <CombatDialog /> : null}
        {state.tactical?.step === 'invasion' ? <InvasionPanel /> : null}
        {state.tactical && (state.tactical.step === 'production' || state.tactical.step === 'done') ? <ProduceDrawer /> : null}
      </>
      <ActionBar mode={mode} onMode={setMode} hint={hint} onLog={() => setShowLog(!showLog)} />
    </div>
  )
}
