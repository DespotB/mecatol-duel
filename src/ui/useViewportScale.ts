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
const MIN_STAGE_W = 560
const MIN_STAGE_H = 380
const S_MIN = 0.5
const S_MAX = 2

/**
 * The two default sizes, calibrated by playing rather than by arithmetic: the board reads best at what a
 * browser shows at 125 percent and the lobby at what it shows at 80, so those are what the page renders at
 * 100. A browser zoom multiplies on top of this, which is what the player expects it to do.
 */
export const BOARD_ZOOM = 1.25
export const LOBBY_MAX = 1.25

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Three decimals is finer than a pixel at these sizes and keeps the CSS variable short. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function viewportScale(width: number, height: number): ViewportScale {
  // the chrome renders at its calibrated size, full stop. It gives way only on a window too small to carry
  // it over a usable stage, and a browser zoom is left to the browser: it magnifies everything, as it should
  const k = round3(clamp(K_MIN, Math.min(width / (GUTTERS + MIN_STAGE_W), height / (BARS + MIN_STAGE_H)), BOARD_ZOOM))
  // the stage's own size in design pixels, i.e. after `k` has been applied to the regions around it
  const stageW = width / k - GUTTERS
  const stageH = height / k - BARS
  const s = round3(clamp(S_MIN, Math.min(stageW / MAP_W, stageH / MAP_H), S_MAX))
  return { k, s }
}

/** the lobby page's own design frame */
const PAGE_W = 1440

const FIT_MIN = 0.5

/**
 * The lobby is one block in the same 1440x900 frame and fills the width of the window: that is the size it
 * was drawn for, and it is what the player was reaching for by zooming to about 140 percent. The height is
 * allowed to run past the fold, because a lobby may scroll and a cramped one may not. Above 1.25 it stops
 * growing, so a very wide monitor gets margins rather than a poster, and a narrow window scales the frame
 * down rather than cutting it off. A browser zoom multiplies on top, as the browser does everywhere else.
 */
export function fitScale(width: number): number {
  return round3(clamp(FIT_MIN, width / PAGE_W, LOBBY_MAX))
}

export function useFitScale(): number {
  const [fit, setFit] = useState(
    () => typeof window === 'undefined' ? 1 : fitScale(window.innerWidth),
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      const next = fitScale(window.innerWidth)
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
