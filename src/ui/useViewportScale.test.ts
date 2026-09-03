// src/ui/useViewportScale.test.ts
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fitScaleAt, useViewportScale, viewportScale } from './useViewportScale'

const round3 = (value: number) => Math.round(value * 1000) / 1000

function resizeTo(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

afterEach(() => { resizeTo(1024, 768) })

describe('viewportScale', () => {
  it('renders the board at the size a 125 percent zoom used to give it', () => {
    // the chrome is 1.25 at the design size, and the stage is what a 1152x720 viewport leaves for the map
    const { k, s } = viewportScale(1440, 900)
    expect(k).toBe(1.25)
    expect(s).toBe(round3(Math.min((1440 / 1.25 - 500) / 940, (900 / 1.25 - 202) / 698)))
  })

  it('keeps the bars and columns at their designed size and shrinks only the board', () => {
    // the heads-up display is not what zooms out: the window is smaller, so the camera moves away from the map
    const { k, s } = viewportScale(1600, 900)
    expect(k).toBe(1.25)
    expect(s).toBe(round3(Math.min((1600 / 1.25 - 500) / 940, (900 / 1.25 - 202) / 698)))
    expect(s).toBeLessThan(1)
  })

  it('gives the chrome up on a window too small to carry it at full size', () => {
    // 1280x720 leaves 1024x576 design pixels, under the 1060x582 the chrome needs
    expect(viewportScale(1280, 720).k).toBeLessThan(1.25)
  })

  it('never grows the bars, only the board', () => {
    const { k, s } = viewportScale(2560, 1440)
    expect(k).toBe(1.25)
    // the stage is what is left of a 2048x1152 viewport once the chrome has taken its 500 by 202
    expect(s).toBeCloseTo(round3(Math.min((2560 / 1.25 - 500) / 940, (1440 / 1.25 - 202) / 698)), 2)
  })

  it('gives the chrome up only once the stage would fall below its minimum', () => {
    // 1060x582 design pixels is the last size that still leaves a 560x380 stage, so 1.25 times that
    expect(viewportScale(1060 * 1.25, 582 * 1.25).k).toBe(1.25)
    expect(viewportScale(900, 582 * 1.25).k).toBeLessThan(1.25)
    expect(viewportScale(1060 * 1.25, 480).k).toBeLessThan(1.25)
  })

  it('never shrinks the bars below the floor', () => {
    expect(viewportScale(400, 300).k).toBe(round3(0.55 * 1.25))
  })

  it('rounds both factors to three decimals', () => {
    const { k, s } = viewportScale(1111, 777)
    expect(k).toBe(Math.round(k * 1000) / 1000)
    expect(s).toBe(Math.round(s * 1000) / 1000)
  })
})

describe('useViewportScale', () => {
  it('reads the current viewport', () => {
    resizeTo(1440, 900)
    const { result } = renderHook(() => useViewportScale())
    expect(result.current).toEqual(viewportScale(1440, 900))
  })

  it('follows a resize', () => {
    resizeTo(1440, 900)
    const { result } = renderHook(() => useViewportScale())
    expect(result.current.k).toBe(1.25)
    act(() => {
      resizeTo(800, 520)
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.k).toBeLessThan(1.25)
  })
})

describe('fitScaleAt', () => {
  it('renders the lobby at the size an 80 percent zoom used to give it', () => {
    expect(fitScaleAt(1440, 900, 2, 2)).toBe(0.8)
  })

  it('shrinks with the window', () => {
    // no zoom: the ratio has not moved, so a smaller window is simply a smaller window
    expect(fitScaleAt(1152, 720, 2, 2)).toBe(round3(0.8 * 0.8))
  })

  /**
   * A browser zoom reports the same `innerWidth` a smaller window does. Scaling to it would cancel the
   * zoom exactly, which is the bug: the player zooms and nothing on screen changes size.
   */
  it('leaves the fit alone when the viewport shrank because the player zoomed in', () => {
    // 125% zoom of a 1440x900 window: 1152x720 css pixels at 2.5 device pixels each
    expect(fitScaleAt(1152, 720, 2.5, 2)).toBe(0.8)
  })

  it('leaves the fit alone when the player zoomed out', () => {
    // 80% zoom of the same window
    expect(fitScaleAt(1800, 1125, 1.6, 2)).toBe(0.8)
  })

  it('answers a resize that happens while zoomed', () => {
    // still at 125%, but the window itself is now half as wide
    expect(fitScaleAt(576, 720, 2.5, 2)).toBe(0.5)   // clamped at the floor
  })

  it('falls back to the plain fit when the ratio is unusable', () => {
    expect(fitScaleAt(1152, 720, 0, 0)).toBe(round3(0.8 * 0.8))
  })
})
