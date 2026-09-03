import { TRADE_POSTS } from '../../data/map'
import { POSTS } from '../../data/posts'
import { systemLabel } from '../format'
import { MAP_H, MAP_W, POST_ART_H, POST_ART_W, POST_H, POST_POS, POST_W, lanePath, postAnchor } from '../layout'
import type { GameState, Seat } from '../../engine/types'

/** R8: the sale needs a planet of yours in one of the two systems the post serves. */
export function postInReach(state: GameState, seat: Seat, post: 'west' | 'east'): boolean {
  return TRADE_POSTS[post].some(id => state.systems[id].planets.some(p => p.owner === seat))
}

/**
 * R8: the hyperlanes, one per link, drawn as a layer behind the tiles so each lane runs out of its post and
 * disappears under the hexagon it plugs into. A lane whose system the acting seat holds a planet in is lit,
 * which is what makes the rule readable without opening a panel: those are the posts you can trade at.
 */
export function TradeLanes({ state, seat }: { state: GameState; seat: Seat }) {
  return (
    <svg className="lanes" viewBox={`0 0 ${String(MAP_W)} ${String(MAP_H)}`} aria-hidden="true" data-testid="trade-lanes">
      {(['west', 'east'] as const).flatMap(post => {
        const anchor = postAnchor(post)
        return TRADE_POSTS[post].map(systemId => {
          const lit = state.systems[systemId].planets.some(p => p.owner === seat)
          const d = lanePath(post, systemId)
          return (
            <g key={`${post}-${systemId}`} className={`lane${lit ? ' lit' : ''}`} data-testid={`lane-${post}-${systemId}`}>
              <path className="glow" d={d} />
              <path className="line" d={d} />
              <circle cx={anchor.left} cy={anchor.top} r={3} />
            </g>
          )
        })
      })}
    </svg>
  )
}

function stateLine(state: GameState, seat: Seat, post: 'west' | 'east'): string {
  if (!postInReach(state, seat, post)) return `Hold a planet in ${TRADE_POSTS[post].map(systemLabel).join(' or ')}`
  return state.players[seat].tradedThisRound[post] ? 'Sale used this round' : 'Sale open'
}

/**
 * R8: two neutral posts outside the map. They are not systems, so they are not hexes: the rendered model
 * floats free the way a ship on a tile does, and a small card sits under it with what can be traded there.
 * The pair turns over every round, so everything below is read straight off `state.posts`, and the block is
 * keyed on the post's id so a new arrival remounts and plays its entry animation instead of swapping its
 * picture in place.
 */
export function TradePosts({ state, seat }: { state: GameState; seat: Seat }) {
  return (
    <>
      {(['west', 'east'] as const).map(post => {
        const def = POSTS[state.posts[post]]
        const used = state.postAbilityUsed[post]
        const reachable = postInReach(state, seat, post)
        return (
          <div
            key={`${post}-${def.id}`} className={`post ${post}`} style={{ ...POST_POS[post], width: POST_W, height: POST_H }}
            data-testid={`post-${post}`}
          >
            <div className="model">
              <img src={def.art} alt={def.name} data-testid={`post-art-${post}`} width={POST_ART_W} height={POST_ART_H} />
              {/* the pair is redrawn every round, so the stamp is the board saying that out loud */}
              <span className="stamp" data-testid={`post-new-${post}`}>New this round</span>
            </div>
            <div className={`postcard cut${used ? ' spent' : ''}`}>
              <div className="in">
                <span className="nm">{def.name}</span>
                <div className="trade">{def.commodityLimit} commodities for {def.commodityLimit} trade goods</div>
                <div className="ability">
                  <b data-testid={`post-ability-${post}`}>{def.abilityName === '' ? 'No special ability' : def.abilityName}</b>
                  {def.ability === 'none' ? null : <span className="txt">{def.abilityText}</span>}
                </div>
                {used ? <span className="usedline" data-testid={`post-used-${post}`}>Ability used this round</span> : null}
                <span className={`chip ${reachable ? 'gold' : 'lock'}`} data-testid={`post-state-${post}`}>
                  {stateLine(state, seat, post)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
