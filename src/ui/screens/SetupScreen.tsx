import { Fragment, useState } from 'react'
import { FACTIONS } from '../../data/factions'
import { SYSTEMS, systemDef } from '../../data/map'
import { techDef } from '../../data/techs'
import { relativeTime } from '../format'
import { MAX_GAMES, deleteGame, listGames } from '../persist'
import { gamePath, navigate, seedFromRoute, useHashRoute } from '../route'
import { spriteUrl, techIconUrl } from '../art'
import { spriteSize } from '../sprites'
import { MODEL_STYLES, useModelStyle } from '../modelStyle'
import type { ModelStyle } from '../modelStyle'
import { useGame } from '../store'
import { useFitScale } from '../useViewportScale'
import '../setup.css'
import type { CSSProperties, ReactElement } from 'react'
import type { Color, FactionId, Seat, UnitType } from '../../engine/types'
import { SpaceBackdrop } from '../SpaceBackdrop'
import { MusicButton } from '../music'

const COLOURS: Color[] = ['red', 'blue', 'green', 'yellow', 'purple', 'black', 'orange', 'pink']
const COLOUR_NAMES: Record<Color, string> = {
  red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow',
  purple: 'Purple', black: 'Black', orange: 'Orange', pink: 'Pink',
}
/** The swatch colours, the tint the seat's copy is set in, and the glow behind its unit sprites. */
const COLOUR_INK: Record<Color, { accent: string; tint: string; glow: string }> = {
  red: { accent: '#d63b3b', tint: '#f09a9a', glow: 'rgba(214,59,59,.16)' },
  blue: { accent: '#3d7be8', tint: '#8fb4ff', glow: 'rgba(61,123,232,.16)' },
  green: { accent: '#3aa655', tint: '#84d69d', glow: 'rgba(58,166,85,.16)' },
  yellow: { accent: '#e5c531', tint: '#f0dc86', glow: 'rgba(229,197,49,.16)' },
  purple: { accent: '#8a47c9', tint: '#c39bf0', glow: 'rgba(138,71,201,.16)' },
  black: { accent: '#7d8494', tint: '#b9bfcc', glow: 'rgba(125,132,148,.16)' },
  orange: { accent: '#e8842a', tint: '#f2ac6f', glow: 'rgba(232,132,42,.16)' },
  pink: { accent: '#e067b0', tint: '#f3a3d0', glow: 'rgba(224,103,176,.16)' },
}
const POSITION: [string, string] = ['North', 'South']

/** The mode picker's two options. Hot-seat is first: it is the one a single browser can finish on its own. */
const MODES: { id: 'hotseat' | 'online'; title: string; sub: string }[] = [
  { id: 'hotseat', title: 'Play hot-seat', sub: 'Both seats, one device' },
  { id: 'online', title: 'Play online', sub: 'One seat, send the link' },
]

// Display order for the fleet row; only the types a starting fleet can actually contain matter here.
const FLEET_ORDER: UnitType[] = ['dreadnought', 'warsun', 'flagship', 'carrier', 'cruiser', 'destroyer', 'fighter', 'infantry', 'pds', 'spacedock']
const UNIT_LABEL: Record<UnitType, string> = {
  dreadnought: 'Dreadnought', warsun: 'War Sun', flagship: 'Flagship', carrier: 'Carrier', cruiser: 'Cruiser',
  destroyer: 'Destroyer', fighter: 'Fighter', infantry: 'Infantry', pds: 'PDS', spacedock: 'Space Dock',
}
const UNIT_PLURAL: Record<UnitType, string> = {
  dreadnought: 'Dreadnoughts', warsun: 'War Suns', flagship: 'Flagships', carrier: 'Carriers', cruiser: 'Cruisers',
  destroyer: 'Destroyers', fighter: 'Fighters', infantry: 'Infantry', pds: 'PDS', spacedock: 'Space Docks',
}
// Fighters and infantry get a count badge instead of one sprite per unit; every other type is capped at one
// in v1's two starting fleets, so a badge would just always read "1".
const BADGE_TYPES: readonly UnitType[] = ['fighter', 'infantry']
// The row's sprites are sized proportionally to the actual ships via src/ui/sprites.ts, the shared copy of
// public/assets/sprites/manifest.json's world scale.
const FLEET_SPRITE_SCALE = 14

const MAP_NAME = 'Bereg Standoff'
/** The flower layout of src/data/map.ts, drawn as a 76x80 hex preview: home north, Mecatol in the middle. */
const MINIMAP: { id: string; left: number; top: number }[] = [
  { id: 'home-n', left: 23, top: 0 },
  { id: 'sakulag', left: 0, top: 13 },
  { id: 'bereg', left: 46, top: 13 },
  { id: 'mecatol', left: 23, top: 26 },
  { id: 'starpoint', left: 0, top: 39 },
  { id: 'quann', left: 46, top: 39 },
  { id: 'home-s', left: 23, top: 52 },
]

function fleetUnits(factionId: FactionId): { type: UnitType; count: number }[] {
  const totals = new Map<UnitType, number>()
  for (const su of FACTIONS[factionId].startingUnits) totals.set(su.type, (totals.get(su.type) ?? 0) + su.count)
  return FLEET_ORDER.filter(type => totals.has(type)).map(type => ({ type, count: totals.get(type) ?? 0 }))
}

/** R5's naming, without a player: the L1Z1X start with the Super-Dreadnought instead of a dreadnought. */
function unitName(factionId: FactionId, type: UnitType, count: number): string {
  if (type === 'dreadnought' && factionId === 'l1z1x') return count > 1 ? `${count} Super-Dreadnoughts I` : 'Super-Dreadnought I'
  return count > 1 ? `${count} ${UNIT_PLURAL[type]}` : UNIT_LABEL[type]
}

function fleetCaption(factionId: FactionId): string {
  return fleetUnits(factionId).map(({ type, count }) => unitName(factionId, type, count)).join(', ')
}

function spriteWidth(type: UnitType, style: ModelStyle): number {
  return spriteSize(type, FLEET_SPRITE_SCALE, style).width
}

/** "L1Z1X Mindnet": the digits are set in the condensed face, as in the mockup. */
function factionTitle(name: string): (string | ReactElement)[] {
  return name.split(/(\d)/).map((part, i) => (/\d/.test(part) ? <i className="dg" key={`${String(i)}${part}`}>{part}</i> : part))
}

export function SetupScreen() {
  const { start } = useGame()
  const { style: modelStyle, setStyle: setModelStyle } = useModelStyle()
  const route = useHashRoute()
  // the page is drawn for a 1440x900 frame; scale it until it fills the viewport (credits line at the foot)
  const fit = useFitScale()
  // the games this browser holds, read once per visit to the lobby
  const [saved, setSaved] = useState(() => ({ games: listGames(), now: Date.now() }))
  const [names, setNames] = useState<[string, string]>(['Player 1', 'Player 2'])
  const [factions, setFactions] = useState<[FactionId, FactionId]>(['l1z1x', 'letnev'])
  const [colours, setColours] = useState<[Color, Color]>(['blue', 'red'])
  const [minutes, setMinutes] = useState(15)
  /**
   * The question the game is opened with, asked here rather than on the first screen of the game: hot-seat
   * keeps both seats on this device, online keeps one and sends the link on. It is the first control on the
   * page because it decides what everything under it means, down to who the second name belongs to.
   */
  const [mode, setMode] = useState<'hotseat' | 'online'>('hotseat')
  const [hostSeat, setHostSeat] = useState<Seat>(0)

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
    }, seed, minutes, mode === 'hotseat' ? [0, 1] : [hostSeat])
  }
  function forget(code: string) {
    deleteGame(code)
    setSaved({ games: listGames(), now: Date.now() })
  }
  /*
   * The lobby is drawn in a 1440x900 frame and `useFitScale` scales that frame to the viewport, nothing
   * else: every slot below is drawn whether it holds a game or not, so the page is the same height on
   * every visit and the screen no longer resizes as games come and go.
   */
  const slots = Array.from({ length: MAX_GAMES }, (_, i) => saved.games[i] ?? null)
  const full = saved.games.length >= MAX_GAMES
  const zoom = fit

  return (
    <div className="setup lobbyui" data-testid="setup-screen" style={{ zoom }}>
      <SpaceBackdrop />

      <header className="hero">
        <h1 className="title goldtext">Mecatol Duel</h1>
        <div className="rule"><span /><i className="dia" /><span /></div>
        <p className="tagline">Twilight Imperium for two players, thirty minutes</p>
      </header>

      {/*
        * The two questions a player opens the lobby with, side by side and above everything else: how this
        * game is played, and which of the games already on this browser to go back to. The mode picker is
        * first because the answer changes what the seats below mean, and the games block holds a fixed
        * three slots so the page cannot change height between visits.
        */}
      <section className="top" aria-label="Start a game">
        <div className="box mode" data-testid="mode-picker">
          <div className="frame panel">
            <div className="modepick" role="group" aria-label="How to play">
              {MODES.map(option => (
                <button
                  key={option.id} type="button"
                  className={`modeopt${option.id === mode ? ' on' : ''}`}
                  data-testid={`mode-${option.id}`} aria-pressed={option.id === mode}
                  onClick={() => { setMode(option.id) }}
                >
                  <span className="mt">{option.title}</span>
                  <span className="ms">{option.sub}</span>
                </button>
              ))}
            </div>

            <p className="modeline" data-testid="mode-line">
              {mode === 'hotseat'
                ? `Both players on this device. It is passed between turns, ${String(minutes)} minutes each on the chess clock.`
                : `One seat is yours, the link carries the other. Your opponent opens it in any browser, ${String(minutes)} minutes each.`}
            </p>

            {/* the seat picker shares the foot with the button, so both modes leave the box the same height */}
            <div className="go">
              {mode === 'online' ? (
                <div className="pickseat" data-testid="pick-seat">
                  <span className="lbl">You play</span>
                  {([0, 1] as Seat[]).map(seat => (
                    <button
                      key={seat} type="button"
                      className={`seatopt${seat === hostSeat ? ' on' : ''}`}
                      data-testid={`host-seat-${String(seat)}`} aria-pressed={seat === hostSeat}
                      onClick={() => { setHostSeat(seat) }}
                    >
                      <img src={`/assets/factions/${factions[seat]}.png`} alt="" />
                      <span>{names[seat].trim() || `Player ${String(seat + 1)}`}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button" className="btn gold big" data-testid="btn-start" disabled={full} onClick={onStart}
              >
                {mode === 'hotseat' ? 'Start hot-seat game' : 'Create the game'}
              </button>
              {full || mode === 'hotseat' ? (
                <span className="note" data-testid="start-note">
                  {full ? 'Three games is the limit. Delete one to start another.' : 'No account, no network'}
                </span>
              ) : null}
            </div>
          </div>
          <div className="tab"><b>Mode</b>&nbsp; {mode === 'hotseat' ? 'This device' : 'Two devices'}</div>
        </div>

        <div className="box games" data-testid="game-slots">
          <div className="frame panel">
            <div className="glist">
              {slots.map((game, i) => (
                game
                  ? (
                    <div className="gamerow" key={game.code} data-testid={`saved-game-${game.code}`}>
                      <span className="gcode">{game.code}</span>
                      <span className="gwho">{game.names[0]}<i className="vs">vs</i>{game.names[1]}</span>
                      <span className="gmeta">
                        Round {game.round}<span className="sep" />{relativeTime(game.updatedAt, saved.now)}
                      </span>
                      <div className="gacts">
                        <button
                          type="button" className="btn ghost sm" data-testid={`btn-resume-${game.code}`}
                          onClick={() => { navigate(gamePath(game.code)) }}
                        >
                          Resume
                        </button>
                        <button
                          type="button" className="btn plain sm" data-testid={`btn-delete-${game.code}`}
                          onClick={() => { forget(game.code) }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    )
                  : (
                    <div className="gamerow empty" key={`empty-${String(i)}`} data-testid={`game-slot-empty-${String(i)}`}>
                      <span className="gcode">&mdash;</span>
                      <span className="gwho">Empty slot</span>
                    </div>
                    )
              ))}
            </div>
          </div>
          <div className="tab" data-testid="games-tab">
            <b>Your games</b>&nbsp; {saved.games.length} of {MAX_GAMES}, on this device
          </div>
        </div>
      </section>

      <section className="box lobby">
        <div className="frame panel">
          <div className="lobby-head">
            <div className="mode">
              <span className="lbl">Mode</span>
              <div className="linkbox" data-testid="lobby-mode">
                {mode === 'hotseat'
                  ? <span>This device, <b>pass it between turns</b></span>
                  : <span>Two devices, <b>you take {POSITION[hostSeat].toLowerCase()}</b></span>}
              </div>
              <button type="button" className="btn ghost sm" data-testid="btn-swap-factions" onClick={() => setFactions([factions[1], factions[0]])}>
                Swap factions
              </button>
            </div>
            <div className="status" data-testid="lobby-status">
              <i className="pulse" />
              {mode === 'hotseat'
                ? <>Both seats on this device<span className="sep" />2 of 2 seats taken</>
                : <>One seat is yours<span className="sep" />1 of 2 seats taken</>}
            </div>
          </div>

          <div className="seats" id="seat-config">
            {([0, 1] as Seat[]).map(seat => {
              const factionId = factions[seat]
              const faction = FACTIONS[factionId]
              const ink = COLOUR_INK[colours[seat]]
              const style = { '--accent': ink.accent, '--tint': ink.tint, '--glow': ink.glow } as CSSProperties
              return (
                <div className="frame seat" key={seat} style={style}>
                  <div className="pcol">
                    <div className="portrait">
                      <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
                      <div className={`crop ${factionId}`}>
                        <img src={`/assets/factions/leader_${factionId}_commander.png`} alt={`${faction.name} portrait`} />
                      </div>
                    </div>
                    <img className="fsym" src={`/assets/factions/${factionId}.png`} alt="" data-testid={`seat-symbol-${seat}`} />
                  </div>

                  <div className="seat-body">
                    <div className="seat-top">
                      <span className="lbl">Seat {seat + 1}</span>
                      <span className="chip pos" data-testid={`seat-position-${seat}`}>{POSITION[seat]}</span>
                      <span className="chip ok">Faction chosen</span>
                    </div>
                    <input
                      className="namefield" data-testid={`seat-name-${seat}`} value={names[seat]}
                      aria-label={`Name of seat ${seat + 1}`} onChange={e => setName(seat, e.target.value)}
                    />
                    <div className="faction goldtext" data-testid={`seat-faction-${seat}`}>{factionTitle(faction.name)}</div>

                    <div className="row colour">
                      <span className="lbl">Colour</span>
                      <div className="swatches">
                        {COLOURS.map(colour => (
                          <button
                            key={colour} type="button"
                            className={`sw ${colour}${colours[seat] === colour ? ' sel' : ''}`}
                            data-testid={`colour-${seat}-${colour}`}
                            title={COLOUR_NAMES[colour]}
                            aria-label={COLOUR_NAMES[colour]}
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
                        {fleetUnits(factionId).map(({ type, count }) => (
                          <div className="unit" key={type} data-testid={`seat-${seat}-fleet-${type}`} title={unitName(factionId, type, count)}>
                            <img src={spriteUrl(colours[seat], type, modelStyle)} width={spriteWidth(type, modelStyle)} alt="" />
                            {BADGE_TYPES.includes(type) && (
                              <span className="cnt" data-testid={`seat-${seat}-fleet-${type}-count`}>{count}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="fleet-caption" data-testid={`seat-${seat}-fleet-caption`}>{fleetCaption(factionId)}</div>

                    <div className="row techs">
                      <span className="lbl">Starting techs</span>
                      <span className="techlist" data-testid={`seat-${seat}-techs`}>
                        {faction.startingTechs.map(techDef).map((tech, i) => (
                          <Fragment key={tech.id}>
                            {i > 0 ? <span className="sep">{', '}</span> : null}
                            <span className="ti">
                              <img src={techIconUrl(tech.colour ?? 'blue')} alt="" />
                            </span>
                            {tech.name}
                          </Fragment>
                        ))}
                      </span>
                    </div>
                  </div>

                  <img className="sigil" src={`/assets/factions/${factionId}.png`} alt="" />
                </div>
              )
            })}
          </div>

          <div className="settings">
            <div className="cell" data-testid="setup-map">
              <div className="minimap" aria-hidden="true">
                {MINIMAP.map(({ id, left, top }) => (
                  <img key={id} className={id === 'mecatol' ? 'mr' : undefined} src={`/assets/tiles/${systemDef(id).tile}.png`} style={{ left, top }} alt="" />
                ))}
              </div>
              <div>
                <div className="lbl"><i className="dia" />Map</div>
                <div className="val">{MAP_NAME}</div>
                <div className="sub">{SYSTEMS.length} systems, Mecatol Rex in the centre, home systems north and south</div>
              </div>
            </div>
            <div className="cell" data-testid="setup-clock">
              <div>
                <div className="lbl"><i className="dia" />Clock</div>
                <label className="val clockfield">
                  <input
                    type="number" min={1} max={60} className="minfield" data-testid="minutes"
                    value={minutes} onChange={e => setMinutes(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                  />
                  minutes per player
                </label>
                <div className="sub">Chess clock, runs whenever it is your turn to decide</div>
              </div>
            </div>
            <div className="cell" data-testid="setup-models">
              <div>
                <div className="lbl"><i className="dia" />Models</div>
                <div className="stylepick">
                  {MODEL_STYLES.map(option => (
                    <button
                      key={option.id} type="button" title={option.note}
                      className={`styleopt${option.id === modelStyle ? ' on' : ''}`}
                      data-testid={`style-${option.id}`} aria-pressed={option.id === modelStyle}
                      onClick={() => { setModelStyle(option.id) }}
                    >
                      <img src={spriteUrl(colours[0], 'dreadnought', option.id)} alt="" height={30} />
                      <span>{option.name}</span>
                    </button>
                  ))}
                </div>
                <div className="sub">Your own view, this browser only. Online, each player picks their own.</div>
                <div className="stylepick"><MusicButton className="btn ghost sm" /></div>
              </div>
            </div>
            <div className="cell" data-testid="setup-target">
              <div>
                <div className="lbl"><i className="dia" />Target</div>
                <div className="val">7 victory points or 6 rounds</div>
                <div className="sub">Most points after round 6 wins the duel</div>
              </div>
            </div>
            <div className="cell" data-testid="setup-rules">
              <div>
                <div className="lbl"><i className="dia" />Rules</div>
                <button type="button" className="btn ghost rules" data-testid="btn-rules" onClick={() => navigate('#/rules')}>
                  What&apos;s different from Twilight Imperium
                </button>
                <div className="sub">Six strategy cards, no agenda phase, open objectives</div>
              </div>
            </div>
          </div>
        </div>
        <div className="tab" data-testid="lobby-tab"><b>Lobby</b>&nbsp; {mode === 'hotseat' ? 'Hot-seat' : 'Online'}</div>
      </section>

      <p className="legal" data-testid="setup-legal">
        Fan project. Twilight Imperium and its artwork belong to Fantasy Flight Games. Unit, tile and card images via AsyncTI4.
        {' '}Music by Kevin MacLeod (incompetech.com), licensed under Creative Commons By Attribution 4.0, re-encoded for the web.
      </p>
    </div>
  )
}
