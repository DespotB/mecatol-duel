import { systemDef } from '../../data/map'
import { BADGE, MISC, ownerKey, planetArtUrl, tileUrl, tokenUrl } from '../art'
import { ANOMALY_SPOT, FLEET_ANCHOR, PLANET_SPOTS, TILE_H, TILE_POS, TILE_W, WORMHOLE_SPOTS } from '../layout'
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
        <span className="plate" data-testid={`plate-${planet.id}`} style={{ left: spot.plate.left, top: spot.plate.top }}>
          <span className="badge res" style={{ backgroundImage: `url(${planet.exhausted ? BADGE.resourceExhausted : BADGE.resourceReady})` }}>{planet.resources}</span>
          <span className="badge inf" style={{ backgroundImage: `url(${planet.exhausted ? BADGE.influenceExhausted : BADGE.influenceReady})` }}>{planet.influence}</span>
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
  onSelect?: (systemId: string) => void
}

export function Tile({ state, system, active, selectable, onSelect }: TileProps) {
  const def = systemDef(system.id)
  const pos = TILE_POS[system.id]
  const anchor = FLEET_ANCHOR[system.id]
  const home = def.home === null ? '' : def.home === 0 ? ' home-0' : ' home-1'
  const classes = `tile${home}${active ? ' active' : ''}${selectable ? ' selectable' : ''}`
  const guardians = system.space.some(u => u.owner === 'guardian')
  return (
    <div
      className={classes} data-testid={`tile-${system.id}`}
      style={{ left: pos.left, top: pos.top, width: TILE_W, height: TILE_H }}
      onClick={selectable && onSelect ? () => onSelect(system.id) : undefined}
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
      {def.wormhole ? (
        <img className="wh" src={def.wormhole === 'alpha' ? MISC.alpha : MISC.beta} alt={`${def.wormhole} wormhole`}
          data-testid={`wormhole-${system.id}`} style={WORMHOLE_SPOTS[system.id]} width={26} height={26} />
      ) : null}
      {def.anomaly === 'asteroid' ? (
        <img className="chev" src={MISC.anomaly} alt="asteroid field" data-testid={`anomaly-${system.id}`} style={ANOMALY_SPOT} width={64} />
      ) : null}
      {guardians ? <span className="guard" data-testid="guardian-label">Guardian fleet, worth 8</span> : null}
    </div>
  )
}
