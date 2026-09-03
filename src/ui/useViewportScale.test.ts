// src/ui/useViewportScale.test.ts
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useViewportScale, viewportScale } from './useViewportScale'

const round3 = (value: number) => Math.round(value * 1000) / 1000

function resizeTo(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

afterEach(() => { resizeTo(1024, 768) })

describe('viewportScale', () => {
  it('is the identity at the 1440x900 design size', () => {
    expect(viewportScale(1440, 900)).toEqual({ k: 1, s: 1 })
  })

  it('keeps the bars and columns at their designed size and shrinks only the board', () => {
    // the heads-up display is not what zooms out: the window is smaller, so the camera moves away from the map
    const { k, s } = viewportScale(1280, 720)
    expect(k).toBe(1)
    expect(s).toBe(round3(Math.min((1280 - 500) / 940, (720 - 202) / 698)))
    expect(s).toBeLessThan(1)
  })

  it('never grows the bars, only the board', () => {
    const { k, s } = viewportScale(2560, 1440)
    expect(k).toBe(1)
    // min((2560-500)/940, (1440-202)/698) = min(2.191, 1.774)
    expect(s).toBeCloseTo(1.774, 2)
  })

  it('gives the chrome up only once the stage would fall below its minimum', () => {
    // 1060x582 is the last size that still leaves a 560x380 stage at full size
    expect(viewportScale(1060, 582).k).toBe(1)
    expect(viewportScale(900, 582).k).toBeLessThan(1)
    expect(viewportScale(1060, 480).k).toBeLessThan(1)
  })

  it('never shrinks the bars below 0.55', () => {
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
    expect(result.current).toEqual({ k: 1, s: 1 })
  })

  it('follows a resize', () => {
    resizeTo(1440, 900)
    const { result } = renderHook(() => useViewportScale())
    expect(result.current.k).toBe(1)
    act(() => {
      resizeTo(800, 520)
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.k).toBeLessThan(1)
  })
})
