import { TECHS } from '../../data/techs'
import { techArtUrl } from '../art'
import { TechColourIcon, TechIcon } from '../TechIcon'
import type { GameState, Seat, TechColor } from '../../engine/types'

const COLOURS: TechColor[] = ['blue', 'red', 'green', 'yellow']
const COLUMN_NAME: Record<TechColor, string> = { blue: 'Propulsion', red: 'Warfare', green: 'Biotic', yellow: 'Cybernetic' }

function tier(prereq: Partial<Record<TechColor, number>>): number {
  return Object.values(prereq).reduce((sum, n) => sum + (n ?? 0), 0)
}

export interface TechDrawerProps {
  state: GameState
  seat: Seat
  allowed: string[]
  selected: string | null
  onSelect: (techId: string) => void
}

/** R5 and R8 of the mockup: four colour columns in tier order plus unit upgrades and faction technologies. */
export function TechDrawer({ state, seat, allowed, selected, onSelect }: TechDrawerProps) {
  const owned = state.players[seat].techs
  const columns = COLOURS.map(colour => ({
    colour,
    techs: TECHS.filter(t => t.kind === 'general' && t.colour === colour).sort((a, b) => tier(a.prereq) - tier(b.prereq)),
  }))
  const extras = TECHS.filter(t => t.kind !== 'general' && (t.faction === undefined || t.faction === state.players[seat].faction))
  const card = (techId: string, name: string) => {
    const isOwned = owned.includes(techId)
    const open = allowed.includes(techId)
    const state2 = isOwned ? 'owned' : selected === techId ? 'sel' : open ? 'now' : 'dim'
    return (
      <button key={techId} type="button" className={`tc ${state2}`} data-testid={`tech-card-${techId}`}
        disabled={!open} onClick={() => onSelect(techId)}>
        <img className="art" src={techArtUrl(techId)} alt="" />
        <span className="cap">
          <TechIcon techId={techId} colour={state.players[seat].color} size={14} />
          {name}{isOwned ? ', owned' : open ? '' : ', needs prerequisites'}
        </span>
      </button>
    )
  }
  return (
    <div className="tcols" data-testid="tech-drawer">
      {columns.map(column => (
        <div className="tcol" key={column.colour}>
          <h4><TechColourIcon colour={column.colour} />{COLUMN_NAME[column.colour]}</h4>
          {column.techs.map(t => card(t.id, t.name))}
        </div>
      ))}
      <div className="tcol units">
        <h4>Unit upgrades and faction</h4>
        {extras.map(t => card(t.id, t.name))}
      </div>
    </div>
  )
}
