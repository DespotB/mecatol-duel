// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MusicButton, MusicProvider, TRACKS, nextTrack } from './music'

describe('the soundtrack', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // jsdom has no media stack, so playback is stubbed; the component must not care either way
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  })

  it('rotates through the three tracks and wraps around', () => {
    expect(TRACKS).toHaveLength(3)
    expect(nextTrack(0)).toBe(1)
    expect(nextTrack(1)).toBe(2)
    expect(nextTrack(2)).toBe(0)
  })

  it('is off until it is asked for, and remembers that it was', () => {
    const view = render(<MusicProvider><MusicButton /></MusicProvider>)
    expect(screen.getByTestId('btn-music').textContent).toBe('Music off')
    fireEvent.click(screen.getByTestId('btn-music'))
    expect(screen.getByTestId('btn-music').textContent).toBe('Music on')
    expect(window.localStorage.getItem('md:music')).toBe('on')
    view.unmount()
    render(<MusicProvider><MusicButton /></MusicProvider>)
    expect(screen.getByTestId('btn-music').textContent).toBe('Music on')
  })

  it('plays one of the three tracks and steps on when it ends', () => {
    render(<MusicProvider><MusicButton /></MusicProvider>)
    const audio = screen.getByTestId('music')
    const first = audio.getAttribute('src') ?? ''
    expect(TRACKS.map(t => t.file)).toContain(first)
    fireEvent.ended(audio)
    const second = screen.getByTestId('music').getAttribute('src') ?? ''
    expect(second).not.toBe(first)
    expect(TRACKS.map(t => t.file)).toContain(second)
  })
})
