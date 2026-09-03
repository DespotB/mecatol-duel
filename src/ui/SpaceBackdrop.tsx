import { planetArtUrl, spriteUrl } from './art'

/**
 * The deep space behind every screen, the lobby's backdrop carried onto the board: a starfield, nebula
 * veils, two galaxies and a planet limb, plus two real planet renders for colour and a few ships crossing
 * far away. It is scenery, never information, so everything in it is held down in opacity.
 */
export function SpaceBackdrop() {
  return (
    <div className="space" aria-hidden="true">
      <div className="base" />
      <div className="stars" />
      <div className="galaxy a" />
      <div className="galaxy b" />
      <div className="veil" />
      <div className="dust" />
      <img className="bigplanet" src={planetArtUrl('sakulag') ?? ''} alt="" />
      <img className="farplanet" src={planetArtUrl('quann') ?? ''} alt="" />
      <div className="drift">
        <img className="d1" src={spriteUrl('grey', 'cruiser')} alt="" />
        <img className="d2" src={spriteUrl('grey', 'destroyer')} alt="" />
        <img className="d3" src={spriteUrl('grey', 'carrier')} alt="" />
      </div>
      <div className="limb" />
      <div className="vig" />
    </div>
  )
}
