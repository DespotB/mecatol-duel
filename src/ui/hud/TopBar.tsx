import { FACTIONS } from '../../data/factions'
import { MANDATE, PUBLIC_OBJECTIVES } from '../../data/objectives'
import { cardOwner } from '../../engine'
import { MISC, PORTRAIT, SIGIL, strategyCardUrl, tokenUrl } from '../art'
import { CARD_NAME, formatClock } from '../format'
import type { GameState, Seat, StrategyCardId } from '../../engine/types'

const ALL_CARDS: StrategyCardId[] = ['leadership', 'diplomacy', 'trade', 'warfare', 'technology', 'imperial']

function PlayerBlock({ state, seat, clockMs, clockMaxMs, clockRunning }: { state: GameState; seat: Seat; clockMs: number; clockMaxMs: number; clockRunning: boolean }) {
  const player = state.players[seat]
  const active = state.active === seat && state.winner === null
  const running = active && clockRunning
  return (
    <div className={`pblock${seat === 1 ? ' right' : ''}`} data-testid={`player-${seat}`}>
      <div className="portrait">
        <div className="face" style={{ backgroundImage: `url(${PORTRAIT[player.faction]})` }} />
        <div className="sym"><img src={SIGIL[player.faction]} alt="" /></div>
      </div>
      <div className="pinfo">
        <div className="namerow">
          <span className="pname goldtext">{FACTIONS[player.faction].name}</span>
          {state.speaker === seat ? <img className="speaker" src={MISC.speaker} alt="Speaker" data-testid={`speaker-${seat}`} /> : null}
        </div>
        <div className="pnick">{player.name}</div>
        <div className="clock">
          <span data-testid={`clock-${seat}`}>{formatClock(clockMs)}</span>
          <small>{running ? 'running' : 'paused'}</small>
        </div>
        <div className="runbar"><i style={{ width: `${Math.round(Math.min(1, clockMs / clockMaxMs) * 100)}%` }} /></div>
        <div>
          <span className={`chip ${seat === 0 ? 'blue' : 'red'}`} data-testid={`turn-${seat}`}>{active ? 'Your turn' : 'Waiting'}</span>
        </div>
      </div>
    </div>
  )
}

function StrategyStrip({ state, onPick }: { state: GameState; onPick?: (card: StrategyCardId) => void }) {
  return (
    <div className="strats">
      {ALL_CARDS.map(card => {
        const pool = state.strategyPool.find(c => c.id === card)
        const owner = cardOwner(state, card)
        const entry = owner === null ? undefined : state.players[owner].strategyCards.find(c => c.id === card)
        const bonus = pool?.bonus ?? 0
        const label = pool
          ? bonus > 0 ? `+${bonus} trade good${bonus > 1 ? 's' : ''}` : 'Unpicked'
          : owner === null ? 'Returned' : `${state.players[owner].name}, ${entry?.used ? 'played' : 'ready'}`
        const pickable = pool !== undefined && onPick !== undefined
        return (
          <button
            key={card} type="button" disabled={!pickable}
            className={`sc${owner === null ? '' : ` own-${owner}`}${entry?.used ? ' played' : ''}${pickable ? ' pick' : ''}`}
            data-testid={`strategy-card-${card}`}
            onClick={pickable ? () => onPick(card) : undefined}
          >
            <span className="card"><img src={strategyCardUrl(card)} alt={CARD_NAME[card]} /></span>
            {/* the trade goods on an unpicked card are shown as the tokens themselves, fanned like a real
                stack, rather than as a line of text under the card */}
            <span className="st" data-testid={`strategy-state-${card}`} aria-label={label} title={label}>
              {bonus > 0
                ? (
                  <span className="tgfan" data-testid={`strategy-bonus-${card}`}>
                    {Array.from({ length: bonus }, (_, i) => <img key={i} src={MISC.tradeGood} alt="" width={19} height={19} />)}
                  </span>
                )
                : label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Objectives({ state }: { state: GameState }) {
  return (
    <div className="objs">
      <div><span className="tab">Objectives</span></div>
      <div className="objrow">
        {state.publicObjectives.map(id => {
          const def = PUBLIC_OBJECTIVES.find(o => o.id === id)
          if (!def) return null
          return (
            <div className="obj" key={id} data-testid={`objective-${id}`} style={{ ['--bg' as string]: `url(${MISC.objectiveBack})` }}>
              <div className="tier">Round {def.round}</div>
              <div className="txt">{def.text}</div>
              {([0, 1] as Seat[]).filter(seat => state.players[seat].scoredObjectives.includes(id)).map(seat => (
                <img key={seat} className={`tok s${seat}`} src={tokenUrl(state.players[seat].faction, 'control')} alt="scored"
                  data-testid={`scored-${id}-${seat}`} />
              ))}
            </div>
          )
        })}
        <div className="obj mandate" data-testid="mandate" style={{ ['--bg' as string]: `url(${MISC.mandateBack})` }}>
          <div className="tier">Mandate</div>
          <div className="txt">First Strike</div>
          {([0, 1] as Seat[]).filter(seat => state.players[seat].mandateScored).map(seat => (
            <img key={seat} className={`tok s${seat}`} src={tokenUrl(state.players[seat].faction, 'control')} alt="scored" />
          ))}
        </div>
        <div className="mtext">{MANDATE.text}</div>
      </div>
    </div>
  )
}

export function TopBar(
  { state, clockMs, clockMinutes, clockRunning, onPick }:
  { state: GameState; clockMs: [number, number]; clockMinutes: number; clockRunning: boolean; onPick?: (card: StrategyCardId) => void },
) {
  const clockMaxMs = clockMinutes * 60000
  return (
    <div className="topbar">
      <PlayerBlock state={state} seat={0} clockMs={clockMs[0]} clockMaxMs={clockMaxMs} clockRunning={clockRunning} />
      <StrategyStrip state={state} onPick={onPick} />
      <Objectives state={state} />
      <PlayerBlock state={state} seat={1} clockMs={clockMs[1]} clockMaxMs={clockMaxMs} clockRunning={clockRunning} />
    </div>
  )
}
