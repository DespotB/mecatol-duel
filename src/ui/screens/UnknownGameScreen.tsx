import { navigate } from '../route'
import { useFitScale } from '../useViewportScale'
import '../setup.css'

export interface UnknownGameScreenProps {
  code: string
  /** The server has not answered yet, so whether this game exists is still an open question. */
  looking?: boolean
  /** The server was asked and could not answer; the code may well be fine. */
  error?: string
}

/**
 * `#/g/<code>` for a game neither this browser nor the server holds. A game started without a server is
 * saved in the browser it was started in and nowhere else, so for those the honest answer is that it is
 * elsewhere. While the server is still being asked, this screen says that instead of accusing the code.
 */
export function UnknownGameScreen({ code, looking = false, error }: UnknownGameScreenProps) {
  const fit = useFitScale()
  return (
    <div className="setup lobbyui" data-testid="unknown-game" style={{ zoom: fit }}>
      <div className="space">
        <div className="base" /><div className="stars" /><div className="galaxy a" /><div className="galaxy b" />
        <div className="veil" /><div className="dust" /><div className="limb" /><div className="vig" />
      </div>

      <header className="hero">
        <h1 className="title goldtext">Mecatol Duel</h1>
        <div className="rule"><span /><i className="dia" /><span /></div>
      </header>

      <section className="box notfound">
        <div className="frame panel">
          <h2 className="nf-head goldtext" data-testid="unknown-head">
            {looking ? 'Looking for this game' : error ? 'The server could not be reached' : 'No game carries this code'}
          </h2>
          <p className="line" data-testid="unknown-line">
            {looking
              ? 'Asking the server whether this game is there.'
              : error
                ? `${error}. The code may be fine; try again in a moment.`
                : 'A game started on one device without a link is saved in that browser alone. Ask for the device that started it, or start a new game.'}
          </p>
          <div className="foot">
            <button type="button" className="btn gold" data-testid="btn-lobby" onClick={() => { navigate('#/') }}>
              Back to the lobby
            </button>
            <span className="note">{looking ? 'One moment' : 'A shared link opens the game on any device'}</span>
          </div>
        </div>
        <div className="tab"><b>Code</b>&nbsp; {code}</div>
      </section>
    </div>
  )
}
