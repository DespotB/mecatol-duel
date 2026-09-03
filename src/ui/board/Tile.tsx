import { systemDef } from '../../data/map'
import { BADGE, MISC, SIGIL, ownerKey, planetArtUrl, planetTrait, tileUrl, tokenUrl } from '../art'
import {
  ACTIVATION_SIZE, ACTIVATION_SPOT, FLEET_ANCHOR, PLANET_SPOTS, SIGIL_SIZE, SIGIL_SPOT,
  TILE_H, TILE_POS, TILE_W, WORMHOLE_SIZE, WORMHOLE_SPOTS,
} from '../layout'
import { UnitStack, groupUnits } from './UnitStack'
import type { Color, GameState, Owner, Planet, System } from '../../engine/types'

const HEX = '58,1 174,1 231,100.5 174,200 58,200 1,100.5'

function colourOf(state: GameState, owner: Owner): Color | 'grey' {
  return owner === 'guardian' ? 'grey' : state.players[owner].color
}

function PlanetMarkers({ state, planet }: { state: GameState; planet: Planet }) {
  const spot = PLANET_SPOTS[planet.id]
  const art = planetArtUrl(planet.id)
  const ground = groupUnits(planet.ground)
  const structures = groupUnits(planet.structures)
  return (
    <>
      {art && spot.art ? (
        <img className="planet" src={art} alt={planet.name} data-testid={`planet-art-${planet.id}`}
          style={{ left: spot.art.left, top: spot.art.top, width: spot.art.width, height: spot.art.height }} />
      ) : null}
      {spot.plate ? (
        <span className={`plate ${planetTrait(planet.id)}${planet.exhausted ? ' exh' : ''}`} data-testid={`plate-${planet.id}`}
          style={{ left: spot.plate.left, top: spot.plate.top }}>
          <span className="vals">
            <span className="badge res" style={{ backgroundImage: `url(${planet.exhausted ? BADGE.resourceExhausted : BADGE.resourceReady})` }}>{planet.resources}</span>
            <span className="badge inf" style={{ backgroundImage: `url(${planet.exhausted ? BADGE.influenceExhausted : BADGE.influenceReady})` }}>{planet.influence}</span>
          </span>
          <span className="nm">{planet.name}</span>
        </span>
      ) : null}
      <span className="row-ground" style={{ left: spot.ground.left, top: spot.ground.top }}>
        {planet.owner !== null ? (
          <img className="ctl" src={tokenUrl(state.players[planet.owner].faction, 'control')} alt="control"
            data-testid={`control-${planet.id}`} width={26} />
        ) : null}
        {ground.map(group => (
          <span key={`${ownerKey(group.owner)}-${group.type}`} data-testid={`ground-${planet.id}-${ownerKey(group.owner)}-${group.type}`}>
            <UnitStack group={group} colour={colourOf(state, group.owner)}
              testId={`${planet.id}-${ownerKey(group.owner)}-${group.type}`} alwaysCount />
          </span>
        ))}
      </span>
      <span className="row-structures" style={{ left: spot.structures.left, top: spot.structures.top }}>
        {structures.map(group => (
          <span key={`${ownerKey(group.owner)}-${group.type}`} data-testid={`structure-${planet.id}-${ownerKey(group.owner)}-${group.type}`}>
            <UnitStack group={group} colour={colourOf(state, group.owner)}
              testId={`s-${planet.id}-${ownerKey(group.owner)}-${group.type}`} />
          </span>
        ))}
      </span>
    </>
  )
}

export interface TileProps {
  state: GameState
  system: System
  active: boolean
  selectable: boolean
  /** Selectable, but no ship can move in; the outline goes cold and the tile says so. */
  outOfReach?: boolean
  onSelect?: (systemId: string) => void
}

export function Tile({ state, system, active, selectable, outOfReach = false, onSelect }: TileProps) {
  const def = systemDef(system.id)
  const pos = TILE_POS[system.id]
  const anchor = FLEET_ANCHOR[system.id]
  const home = def.home === null ? '' : def.home === 0 ? ' home-0' : ' home-1'
  const classes = `tile${home}${active ? ' active' : ''}${selectable ? ' selectable' : ''}${selectable && outOfReach ? ' outofreach' : ''}`
  const guardians = system.space.some(u => u.owner === 'guardian')
  // a selectable tile is a control, so it takes focus and answers to Enter and Space like a button
  const activate = selectable && onSelect ? () => onSelect(system.id) : undefined
  return (
    <div
      className={classes} data-testid={`tile-${system.id}`}
      style={{ left: pos.left, top: pos.top, width: TILE_W, height: TILE_H }}
      role={activate ? 'button' : undefined}
      tabIndex={activate ? 0 : undefined}
      aria-label={activate ? `Activate ${system.name}${outOfReach ? ', no ship in range' : ''}` : undefined}
      onClick={activate}
      onKeyDown={activate
        ? event => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          activate()
        }
        : undefined}
    >
      <img className="hex" src={tileUrl(system.id)} alt={system.name} width={TILE_W} height={TILE_H} data-testid={`hex-${system.id}`} />
      <svg className="line" viewBox={`0 0 ${TILE_W} ${TILE_H}`}><polygon points={HEX} /></svg>
      {system.planets.map(planet => <PlanetMarkers key={planet.id} state={state} planet={planet} />)}
      <span className="fleet" style={{ left: anchor.left, top: anchor.top }} data-testid={`fleet-${system.id}`}>
        {groupUnits(system.space).map(group => (
          <UnitStack key={`${ownerKey(group.owner)}-${group.type}`} group={group} colour={colourOf(state, group.owner)}
            testId={`${system.id}-${ownerKey(group.owner)}-${group.type}`} />
        ))}
      </span>
      {system.activatedBy.length > 0 ? (
        <span className="acts" style={{ left: ACTIVATION_SPOT.left, top: ACTIVATION_SPOT.top }}>
          {system.activatedBy.map(seat => (
            <img key={seat} className="act" src={tokenUrl(state.players[seat].faction, 'command')} width={ACTIVATION_SIZE}
              alt={`${state.players[seat].name} command token`} data-testid={`activation-${system.id}-${seat}`} />
          ))}
        </span>
      ) : null}
      {def.wormhole ? (
        <img className="wh" src={def.wormhole === 'alpha' ? MISC.alpha : MISC.beta} alt={`${def.wormhole} wormhole`}
          data-testid={`wormhole-${system.id}`} style={WORMHOLE_SPOTS[system.id]} width={WORMHOLE_SIZE} height={WORMHOLE_SIZE} />
      ) : null}
      {def.home !== null ? (
        <img className="sigil" src={SIGIL[state.players[def.home].faction]} alt="" data-testid={`sigil-${system.id}`}
          style={{ left: SIGIL_SPOT.left, top: SIGIL_SPOT.top }} width={SIGIL_SIZE} height={SIGIL_SIZE} />
      ) : null}
      {guardians ? <span className="guard" data-testid="guardian-label">Guardian fleet, worth 8</span> : null}
      {selectable && outOfReach ? (
        <span className="noreach" data-testid={`noreach-${system.id}`}>No ship in range</span>
      ) : null}
    </div>
  )
}
