import { SpaceBackdrop } from '../SpaceBackdrop'
import { useFitScale } from '../useViewportScale'
import '../setup.css'
import type { Seat } from '../../engine/types'

export interface ModeScreenProps {
  code: string
  names: [string, string]
  /** The seats no other browser holds. Empty means this visitor arrived at a game that is already full. */
  free: Seat[]
  onClaim: (seats: Seat[]) => void
}

/**
 * The first screen of a game this browser has no claim for, and it asks the one question that matters:
 * play both seats on this device, or take one seat and send the link on. The answer is written as the
 * claim and never asked again for this game. A visitor to a game both of whose seats belong to other
 * browsers is left with the honest third answer: watch.
 */
export function ModeScreen({ code, names, free, onClaim }: ModeScreenProps) {
  const fit = useFitScale()
  const sharing = free.length === 2
  const full = free.length === 0
  return (
    <div className="setup lobbyui" data-testid="mode-question" style={{ zoom: fit }}>
      <SpaceBackdrop />

      <header className="hero">
        <h1 className="title goldtext">Mecatol Duel</h1>
        <div className="rule"><span /><i className="dia" /><span /></div>
        <p className="tagline">{names[0]} against {names[1]}</p>
      </header>

      <section className="modeq" aria-label="How to play this game">
        <div className="box" data-testid="mode-device">
          <div className="frame panel">
            <div className="lead">
              <div className="ico">
                <img src="/assets/tokens/l1z1x_command.png" alt="" />
                <img src="/assets/tokens/letnev_command.png" alt="" />
              </div>
              <p className="line">
                <span className="lbl">Both seats</span>
                Play {names[0]} and {names[1]} yourself and pass the device between turns.
              </p>
            </div>
            <div className="foot">
              <button
                type="button" className="btn gold" data-testid="btn-mode-hotseat"
                disabled={!sharing} onClick={() => { onClaim([0, 1]) }}
              >
                Play both seats
              </button>
              <span className="note">{sharing ? 'No account, no network' : 'A seat is taken elsewhere'}</span>
            </div>
          </div>
          <div className="tab">Play on this device</div>
        </div>

        <div className="box primary" data-testid="mode-seat">
          <div className="frame panel">
            <div className="lead">
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="#c9a24d" strokeWidth="1.2" aria-hidden="true">
                <circle cx="15" cy="15" r="3" fill="#c9a24d" stroke="none" />
                <circle cx="15" cy="15" r="8" /><circle cx="15" cy="15" r="13" strokeOpacity=".55" />
                <path d="M3 15h5M22 15h5M15 3v5M15 22v5" strokeOpacity=".8" />
              </svg>
              <p className="line">
                <span className="lbl">One seat</span>
                Take a seat and send this link on. Whoever opens it takes the other one.
              </p>
            </div>
            <div className="seatpick">
              {([0, 1] as Seat[]).map(seat => (
                <button
                  key={seat} type="button" className={`btn${free.includes(seat) ? ' gold' : ' ghost'}`}
                  data-testid={`btn-take-seat-${seat}`} disabled={!free.includes(seat)}
                  onClick={() => { onClaim([seat]) }}
                >
                  {free.includes(seat) ? `Play ${names[seat]}` : `${names[seat]} is taken`}
                </button>
              ))}
            </div>
            <div className="foot">
              {full ? (
                <>
                  <button type="button" className="btn ghost" data-testid="btn-watch" onClick={() => { onClaim([]) }}>
                    Watch this game
                  </button>
                  <span className="note">Both seats are taken</span>
                </>
              ) : (
                <span className="note">The link is this page, code and all</span>
              )}
            </div>
          </div>
          <div className="tab"><b>Code</b>&nbsp; {code}</div>
        </div>
      </section>
    </div>
  )
}
