import { useRef, useState } from 'react'
import { FACTIONS } from '../../data/factions'
import { navigate, seedFromRoute, useHashRoute } from '../route'
import { spriteSize } from '../sprites'
import { useGame } from '../store'
import type { Color, FactionId, Seat, UnitType } from '../../engine/types'

const COLOURS: Color[] = ['red', 'blue', 'green', 'yellow', 'purple', 'black', 'orange', 'pink']
const COLOUR_NAMES: Record<Color, string> = {
  red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow',
  purple: 'Purple', black: 'Black', orange: 'Orange', pink: 'Pink',
}
const POSITION: [string, string] = ['North', 'South']

// Display order for the fleet row; only the types a starting fleet can actually contain matter here.
const FLEET_ORDER: UnitType[] = ['dreadnought', 'warsun', 'flagship', 'carrier', 'cruiser', 'destroyer', 'fighter', 'infantry', 'pds', 'spacedock']
const UNIT_LABEL: Record<UnitType, string> = {
  dreadnought: 'Dreadnought', warsun: 'War Sun', flagship: 'Flagship', carrier: 'Carrier', cruiser: 'Cruiser',
  destroyer: 'Destroyer', fighter: 'Fighter', infantry: 'Infantry', pds: 'PDS', spacedock: 'Space Dock',
}
// Fighters and infantry get a count badge instead of one sprite per unit; every other type is capped at one
// in v1's two starting fleets, so a badge would just always read "1".
const BADGE_TYPES: readonly UnitType[] = ['fighter', 'infantry']

// The row's sprites are sized proportionally to the actual ships via src/ui/sprites.ts, the shared copy of
// public/assets/sprites/manifest.json's world scale.
const FLEET_SPRITE_SCALE = 14

function fleetUnits(factionId: FactionId): { type: UnitType; count: number }[] {
  const totals = new Map<UnitType, number>()
  for (const su of FACTIONS[factionId].startingUnits) totals.set(su.type, (totals.get(su.type) ?? 0) + su.count)
  return FLEET_ORDER.filter(type => totals.has(type)).map(type => ({ type, count: totals.get(type) ?? 0 }))
}

function spriteWidth(type: UnitType): number {
  return spriteSize(type, FLEET_SPRITE_SCALE).width
}

export function SetupScreen() {
  const { start, session } = useGame()
  const route = useHashRoute()
  const [names, setNames] = useState<[string, string]>(['Player 1', 'Player 2'])
  const [factions, setFactions] = useState<[FactionId, FactionId]>(['l1z1x', 'letnev'])
  const [colours, setColours] = useState<[Color, Color]>(['blue', 'red'])
  const [minutes, setMinutes] = useState(15)
  const seatConfigRef = useRef<HTMLDivElement | null>(null)

  function setName(seat: Seat, value: string) {
    setNames(seat === 0 ? [value, names[1]] : [names[0], value])
  }
  function setColour(seat: Seat, value: Color) {
    setColours(seat === 0 ? [value, colours[1]] : [colours[0], value])
  }
  function onStart() {
    const seed = seedFromRoute(route, Math.floor(Math.random() * 0x7fffffff))
    start({
      players: [
        { faction: factions[0], color: colours[0], name: names[0].trim() || 'Player 1' },
        { faction: factions[1], color: colours[1], name: names[1].trim() || 'Player 2' },
      ],
      speaker: 0,
    }, seed, minutes)
    navigate('#/play')
  }
  function goToSeats() {
    const node = seatConfigRef.current
    if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="setup" data-testid="setup-screen">
      <div className="space"><div className="stars" /><div className="neb" /><div className="limb" /><div className="dust" /></div>
      <header className="hero">
        <h1 className="title goldtext">Mecatol Duel</h1>
        <p className="tagline">Twilight Imperium for two players, thirty minutes</p>
        {session ? (
          <button type="button" className="btn quiet" data-testid="btn-resume" onClick={() => navigate('#/play')}>Resume the saved game</button>
        ) : null}
      </header>

      <section className="menu" aria-label="Game mode">
        <div className="box" data-testid="landing-hotseat">
          <div className="cut panel">
            <div className="lead"><p className="line"><span className="lbl">Hot-seat</span>Pass the device, chess clock below.</p></div>
            <div className="foot">
              <button type="button" className="btn ghost" data-testid="btn-play-device" onClick={goToSeats}>Play on this device</button>
              <span className="note">No account, no network</span>
            </div>
          </div>
          <div className="tab">Play on this device</div>
        </div>
        <div className="box primary" data-testid="landing-online">
          <div className="cut panel">
            <div className="lead"><p className="line"><span className="lbl">Online</span>Invite a friend with a link, play from any browser.</p></div>
            <div className="foot">
              <button type="button" className="btn gold" data-testid="btn-create-online" disabled>Create lobby</button>
              <span className="note">coming with online play</span>
            </div>
          </div>
          <div className="tab">Create online lobby</div>
        </div>
        <div className="box" data-testid="landing-join">
          <div className="cut panel">
            <div className="lead"><p className="line"><span className="lbl">Code</span>Enter the code your opponent shared.</p></div>
            <div className="foot">
              <button type="button" className="btn gold" data-testid="btn-join-code" disabled>Join</button>
              <span className="note">coming with online play</span>
            </div>
          </div>
          <div className="tab">Join with a code</div>
        </div>
      </section>

      <div className="seats" id="seat-config" ref={seatConfigRef}>
        {([0, 1] as Seat[]).map(seat => (
          <div className="cut seat" key={seat}>
            <div className="in">
              <div className="seat-top">
                <span className="lbl">Seat {seat + 1}</span>
                <span className="lbl dim" data-testid={`seat-position-${seat}`}>{POSITION[seat]}</span>
              </div>
              <input
                className="field" data-testid={`seat-name-${seat}`} value={names[seat]}
                aria-label={`Name of seat ${seat + 1}`} onChange={e => setName(seat, e.target.value)}
              />
              <div className="faction goldtext" data-testid={`seat-faction-${seat}`}>{FACTIONS[factions[seat]].name}</div>
              <div className="row colour">
                <span className="lbl">Colour</span>
                <div className="swatches">
                  {COLOURS.map(colour => (
                    <button
                      key={colour} type="button"
                      className={`sw ${colour}${colours[seat] === colour ? ' sel' : ''}`}
                      data-testid={`colour-${seat}-${colour}`}
                      title={COLOUR_NAMES[colour]}
                      disabled={colours[seat === 0 ? 1 : 0] === colour}
                      onClick={() => setColour(seat, colour)}
                    />
                  ))}
                </div>
                <span className="chosen" data-testid={`chosen-colour-${seat}`}>{COLOUR_NAMES[colours[seat]]}</span>
              </div>
              <div className="row fleet">
                <span className="lbl">Starting fleet</span>
                <div className="units" data-testid={`seat-${seat}-fleet`}>
                  {fleetUnits(factions[seat]).map(({ type, count }) => (
                    <div className="unit" key={type} data-testid={`seat-${seat}-fleet-${type}`} title={`${count} ${UNIT_LABEL[type]}`}>
                      <img src={`/assets/sprites/${colours[seat]}_${type}.png`} width={spriteWidth(type)} alt="" />
                      {BADGE_TYPES.includes(type) && (
                        <span className="cnt" data-testid={`seat-${seat}-fleet-${type}-count`}>{count}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="row">
                <span className="lbl">Starting techs</span>
                <span>{FACTIONS[factions[seat]].startingTechs.map(id => id.replace(/_/g, ' ')).join(', ')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="setup-foot">
        <button type="button" className="btn quiet" data-testid="btn-swap-factions" onClick={() => setFactions([factions[1], factions[0]])}>
          Swap factions
        </button>
        <label className="clockfield">
          <span className="lbl">Minutes each</span>
          <input
            type="number" min={1} max={60} className="field small" data-testid="minutes"
            value={minutes} onChange={e => setMinutes(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
          />
        </label>
        <button type="button" className="btn gold" data-testid="btn-start" onClick={onStart}>Play hot-seat</button>
      </div>
    </div>
  )
}
