// src/ui/useViewportScale.test.ts
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fitScale, useViewportScale, viewportScale } from './useViewportScale'

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
    expect(viewportScale(400, 300).k).toBe(0.55)
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

describe('fitScale', () => {
  it('fills the width of the window, which is the size the lobby was drawn for', () => {
    expect(fitScale(1440)).toBe(1)
    expect(fitScale(1512)).toBe(1.05)
    expect(fitScale(1280)).toBe(round3(1280 / 1440))
  })

  it('stops growing on a very wide monitor and never cuts a narrow one off', () => {
    expect(fitScale(2560)).toBe(1.25)
    expect(fitScale(1920)).toBe(1.25)
    expect(fitScale(600)).toBeCloseTo(0.5, 2)
  })

  it('ignores the height, so a lobby taller than the fold scrolls instead of shrinking', () => {
    expect(fitScale(1440)).toBe(fitScale(1440))
  })
})
