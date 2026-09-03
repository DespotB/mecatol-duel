import { planetArtUrl } from './art'

/**
 * The deep space behind every screen, the lobby's backdrop carried onto the board: a starfield, nebula
 * veils, two galaxies and a planet limb, plus two real planet renders for colour. It is scenery, never
 * information, so everything in it is held down in opacity. `dim` pulls the middle down further, which is
 * what the board wants behind it; the lobby and the end screen keep the brighter sky.
 */
export function SpaceBackdrop({ dim = false }: { dim?: boolean } = {}) {
  return (
    <div className={`space${dim ? ' dim' : ''}`} aria-hidden="true">
      <div className="base" />
      <div className="stars" />
      <div className="galaxy a" />
      <div className="galaxy b" />
      <div className="veil" />
      <div className="dust" />
      <img className="bigplanet" src={planetArtUrl('sakulag') ?? ''} alt="" />
      <img className="farplanet" src={planetArtUrl('quann') ?? ''} alt="" />
      <div className="limb" />
      <div className="vig" />
    </div>
  )
}
