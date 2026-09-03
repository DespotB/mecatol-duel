import { useState } from 'react'
import type { CSSProperties } from 'react'
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
// strategic, component and status flows (Task 4b)
import { ComponentPanel } from '../flows/ComponentPanel'
import { SecondaryPanel } from '../flows/SecondaryPanel'
import { StatusDialog } from '../flows/StatusDialog'
import { StrategicDialog } from '../flows/StrategicDialog'
import { CARD_NAME } from '../format'
import { strategicCards } from '../moveOptions'
import { HandoffOverlay } from '../HandoffOverlay'
import { LogPanel } from '../LogPanel'
import { useViewportScale } from '../useViewportScale'

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
  // the bars, columns and stage are docked to the viewport edges and scale their contents with these
  const { k, s } = useViewportScale()
  const [mode, setMode] = useState<ActionMode>(null)
  // `?panel=log` is a dev-only manual/visual QA hook (see App.tsx's demo bootstrap) so a headless
  // screenshot can land on the open log panel without a click.
  const [showLog, setShowLog] = useState(() => import.meta.env.DEV
    && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('panel') === 'log')
  const [card, setCard] = useState<StrategyCardId | null>(null)
  if (!session) return null
  const state = session.state
  const drafting = state.phase === 'strategy'
  const onPick = drafting ? (card: StrategyCardId) => { apply({ type: 'pickStrategyCard', card }) } : undefined
  const selectable = mode === 'tactical'
    ? legal.flatMap(m => m.type === 'startTactical' ? [m.systemId] : [])
    : []
  const hint = drafting ? HINTS.strategy : state.phase === 'status' ? HINTS.status : HINTS[mode ?? 'idle']
  return (
    <>
      <div
        className="app" data-testid="board-screen" inert={session.handoff !== null}
        style={{ '--k': k, '--s': s } as CSSProperties}
      >
        <div className="space"><div className="stars" /><div className="neb" /><div className="swirl" /><div className="limb" /><div className="dust" /></div>
        <TopBar state={state} clockMs={session.clockMs} clockMinutes={session.minutes} handoff={session.handoff} onPick={onPick} />
        <SidePanel state={state} seat={0} />
        <SidePanel state={state} seat={1} />
        {/* the board and everything that overlays it, docked between the bars and the two columns */}
        <div className="stage" data-testid="stage">
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
          {/* strategic, component and status flows (Task 4b) */}
          <div className="flows-4b">
            {mode === 'strategic' && card === null ? (
              <div className="dialog cut" data-testid="strategic-picker">
                <div className="in">
                  <div className="dhead"><span className="tab">Strategic action</span></div>
                  <div className="rowline">
                    {strategicCards(legal).map(id => (
                      <button key={id} type="button" className="btn" data-testid={`strategic-pick-${id}`} onClick={() => setCard(id)}>{CARD_NAME[id]}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {mode === 'strategic' && card !== null ? <StrategicDialog card={card} onClose={() => { setCard(null); setMode(null) }} /> : null}
            {mode === 'component' ? <ComponentPanel onClose={() => setMode(null)} /> : null}
            {state.pendingSecondary !== null ? <SecondaryPanel /> : null}
            {state.phase === 'status' ? <StatusDialog /> : null}
          </div>
          {showLog ? <LogPanel state={state} onClose={() => setShowLog(false)} /> : null}
        </div>
        <ActionBar mode={mode} onMode={setMode} hint={hint} onLog={() => setShowLog(!showLog)} />
      </div>
      <HandoffOverlay />
    </>
  )
}
