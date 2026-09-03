import { useEffect, useState } from 'react'

/**
 * The HUD is authored in a 1440x900 coordinate system: a 118px top bar, an 84px bottom bar, two 234px
 * side columns and a 940x698 map box at left 250 / top 118. Rather than centring that block on the page
 * (which left it floating in empty space as soon as the window grew), every region is docked to a
 * viewport edge and its *contents* are scaled with the CSS `zoom` property.
 *
 * - `k` scales the bars and columns. A zoomed fixed region still resolves `left/right/top/bottom`
 *   against the viewport, so `left:0;right:0` keeps spanning the whole width while the 118px design
 *   height renders as 118*k real pixels.
 * - `s` is the extra zoom for the map inside the stage (the gap between the bars and the columns).
 *   The stage is `1440/k - 500` by `900/k - 202` design pixels wide once `k` is applied, so `s` grows
 *   the 940x698 board until it fills whichever of the two is tighter.
 *
 * At exactly 1440x900 both factors are 1 and the layout is pixel-identical to the authored design.
 */
export interface ViewportScale {
  /** zoom for the docked regions (top bar, bottom bar, side columns, stage) */
  k: number
  /** additional zoom for the 940x698 map inside the stage */
  s: number
}

const DESIGN_W = 1440
const DESIGN_H = 900
const MAP_W = 940
const MAP_H = 698
/** the two 250px gutters the side columns live in */
const GUTTERS = 500
/** the 118px top bar plus the 84px bottom bar */
const BARS = 202

const K_MIN = 0.55
const K_MAX = 1.25
const S_MIN = 0.5
const S_MAX = 2

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Three decimals is finer than a pixel at these sizes and keeps the CSS variable short. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function viewportScale(width: number, height: number): ViewportScale {
  const k = round3(clamp(K_MIN, Math.min(width / DESIGN_W, height / DESIGN_H), K_MAX))
  // the stage's own size in design pixels, i.e. after `k` has been applied to the regions around it
  const stageW = width / k - GUTTERS
  const stageH = height / k - BARS
  const s = round3(clamp(S_MIN, Math.min(stageW / MAP_W, stageH / MAP_H), S_MAX))
  return { k, s }
}

const FIT_MIN = 0.5
const FIT_MAX = 2

/**
 * The lobby page is authored in the same 1440x900 frame but is one block rather than docked regions, so
 * it simply scales until it fills the shorter of the two axes: the credits line then sits just above the
 * bottom edge, which is what the design was drawn for.
 */
export function fitScale(width: number, height: number): number {
  return round3(clamp(FIT_MIN, Math.min(width / DESIGN_W, height / DESIGN_H), FIT_MAX))
}

export function useFitScale(): number {
  const [fit, setFit] = useState(() => typeof window === 'undefined' ? 1 : fitScale(window.innerWidth, window.innerHeight))
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      const next = fitScale(window.innerWidth, window.innerHeight)
      setFit(prev => prev === next ? prev : next)
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => { window.removeEventListener('resize', onResize) }
  }, [])
  return fit
}

const FALLBACK: ViewportScale = { k: 1, s: 1 }

export function useViewportScale(): ViewportScale {
  const [scale, setScale] = useState<ViewportScale>(
    () => typeof window === 'undefined' ? FALLBACK : viewportScale(window.innerWidth, window.innerHeight),
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      const next = viewportScale(window.innerWidth, window.innerHeight)
      setScale(prev => prev.k === next.k && prev.s === next.s ? prev : next)
    }
    window.addEventListener('resize', onResize)
    // the first paint may predate a resize that happened between render and effect
    onResize()
    return () => { window.removeEventListener('resize', onResize) }
  }, [])
  return scale
}
