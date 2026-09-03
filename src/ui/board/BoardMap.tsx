import { SYSTEMS } from '../../data/map'
import { Tile } from './Tile'
import { TradePosts } from './TradePosts'
import type { GameState } from '../../engine/types'

export interface BoardMapProps {
  state: GameState
  activeSystemId?: string | null
  selectable?: string[]
  onSelect?: (systemId: string) => void
}

export function BoardMap({ state, activeSystemId = null, selectable = [], onSelect }: BoardMapProps) {
  return (
    <div className="map" data-testid="board-map">
      {SYSTEMS.map(def => (
        <Tile
          key={def.id} state={state} system={state.systems[def.id]}
          active={activeSystemId === def.id} selectable={selectable.includes(def.id)} onSelect={onSelect}
        />
      ))}
      <TradePosts state={state} seat={state.active} />
    </div>
  )
}
