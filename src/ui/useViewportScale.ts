import { useEffect, useState } from 'react'
// the map box is declared once, in the layout the board is drawn from, so the two cannot drift apart
import { MAP_H, MAP_W } from './layout'

/**
 * The HUD is authored in a 1440x900 coordinate system: a 118px top bar, an 84px bottom bar, two 234px
 * side columns and a 940x698 map box at left 250 / top 118. Rather than centring that block on the page
 * (which left it floating in empty space as soon as the window grew), every region is docked to a
 * viewport edge and its *contents* are scaled with the CSS `zoom` property.
 *
 * - `k` scales the bars and columns and is 1 in every window that has room for them: the heads-up display
 *   keeps the size it was drawn at. A zoomed fixed region still resolves `left/right/top/bottom` against
 *   the viewport, so `left:0;right:0` keeps spanning the whole width. Only a window too small for the
 *   chrome plus a minimum stage pushes `k` below 1.
 * - `s` is the zoom of the map inside the stage (the gap between the bars and the columns), and it is the
 *   factor that actually answers a resize: the board grows or shrinks until it fills whichever of the two
 *   axes is tighter, which is what moving the camera away from a map looks like.
 */
export interface ViewportScale {
  /** zoom for the docked regions (top bar, bottom bar, side columns, stage) */
  k: number
  /** additional zoom for the 940x698 map inside the stage */
  s: number
}

/** the two 250px gutters the side columns live in */
const GUTTERS = 500
/** the 118px top bar plus the 84px bottom bar */
const BARS = 202

const K_MIN = 0.55
/**
 * The chrome never grows and never shrinks while there is room for it: zooming out has to move the camera
 * away from the board, not shrink the heads-up display with it. Only once the stage would fall below the
 * minimum below does the chrome start giving way, so a small window still shows a usable map.
 */
const K_MAX = 1
const MIN_STAGE_W = 560
const MIN_STAGE_H = 380
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
  const k = round3(clamp(K_MIN, Math.min(width / (GUTTERS + MIN_STAGE_W), height / (BARS + MIN_STAGE_H)), K_MAX))
  // the stage's own size in design pixels, i.e. after `k` has been applied to the regions around it
  const stageW = width / k - GUTTERS
  const stageH = height / k - BARS
  const s = round3(clamp(S_MIN, Math.min(stageW / MAP_W, stageH / MAP_H), S_MAX))
  return { k, s }
}

/** the lobby page's own design frame */
const PAGE_W = 1440
const PAGE_H = 900

const FIT_MIN = 0.5
const FIT_MAX = 2

/**
 * The lobby page is authored in the same 1440x900 frame but is one block rather than docked regions, so
 * it simply scales until it fills the shorter of the two axes: the credits line then sits just above the
 * bottom edge, which is what the design was drawn for.
 */
export function fitScale(width: number, height: number): number {
  return round3(clamp(FIT_MIN, Math.min(width / PAGE_W, height / PAGE_H), FIT_MAX))
}

/**
 * A browser zoom reports exactly what a smaller window reports: `innerWidth` and `innerHeight` shrink by
 * the zoom factor. A page that scales itself to those numbers therefore cancels the zoom out precisely,
 * and the player sees nothing move until the clamp below stops the fit from following any further.
 *
 * `devicePixelRatio` is what separates the two cases: it moves with the zoom and stays put when the window
 * is dragged to another size. Measured against the ratio the page first painted at, it turns the viewport
 * back into the size it would have had unzoomed, which leaves the fit where it was and lets the zoom
 * through to the player, while a real resize still answers as before.
 *
 * Dragging the window onto a display with a different pixel ratio reads as a zoom under this rule. That is
 * the one case it gets wrong, a reload corrects it, and it is the right trade: a player reaches for the
 * zoom on purpose, a second monitor is not a request to resize the lobby.
 */
export function fitScaleAt(width: number, height: number, dpr: number, baseDpr: number): number {
  const zoom = dpr > 0 && baseDpr > 0 ? dpr / baseDpr : 1
  return fitScale(width * zoom, height * zoom)
}

function currentDpr(): number {
  return typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
}

export function useFitScale(): number {
  // the ratio of the first paint is the zero point: whatever zoom the page was opened at is the size it fits
  const [baseDpr] = useState(currentDpr)
  const [fit, setFit] = useState(
    () => typeof window === 'undefined' ? 1 : fitScaleAt(window.innerWidth, window.innerHeight, currentDpr(), baseDpr),
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    // a browser zoom fires `resize` like any other change to the viewport, so one listener covers both
    const onResize = () => {
      const next = fitScaleAt(window.innerWidth, window.innerHeight, currentDpr(), baseDpr)
      setFit(prev => prev === next ? prev : next)
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => { window.removeEventListener('resize', onResize) }
  }, [baseDpr])
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
