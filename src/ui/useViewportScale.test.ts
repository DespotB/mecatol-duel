// src/ui/useViewportScale.test.ts
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useViewportScale, viewportScale } from './useViewportScale'

function resizeTo(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

afterEach(() => { resizeTo(1024, 768) })

describe('viewportScale', () => {
  it('is the identity at the 1440x900 design size', () => {
    expect(viewportScale(1440, 900)).toEqual({ k: 1, s: 1 })
  })

  it('shrinks by the tighter of the two axes', () => {
    // min(1280/1440, 720/900) = min(0.889, 0.8)
    const { k, s } = viewportScale(1280, 720)
    expect(k).toBe(0.8)
    // the stage is then 1600-500 wide and 900-202 tall in design pixels, so the board still fits 1:1
    expect(s).toBe(1)
  })

  it('caps the bar scale at 1.25 and grows the board into the free stage', () => {
    const { k, s } = viewportScale(2560, 1440)
    expect(k).toBe(1.25)
    // min((2048-500)/940, (1152-202)/698) = min(1.647, 1.361)
    expect(s).toBeCloseTo(1.361, 2)
  })

  it('never shrinks the bars below 0.55', () => {
    expect(viewportScale(640, 400).k).toBe(0.55)
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
      resizeTo(1280, 720)
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.k).toBe(0.8)
  })
})
