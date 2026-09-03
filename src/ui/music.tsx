import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * The soundtrack: three tracks played in rotation, endlessly. It is off until the player asks for it, both
 * out of manners and because a browser refuses to start audio before someone has clicked something. The
 * choice is remembered per browser, like the model style.
 *
 * Music by Kevin MacLeod (incompetech.com), licensed CC BY 4.0. The credit line the licence asks for is in
 * the lobby footer and in public/audio/CREDITS.md.
 */
export interface Track { file: string; title: string }

export const TRACKS: Track[] = [
  { file: '/audio/lightless-dawn.mp3', title: 'Lightless Dawn' },
  { file: '/audio/interloper.mp3', title: 'Interloper' },
  { file: '/audio/impact-andante.mp3', title: 'Impact Andante' },
]

export const VOLUME = 0.32
const KEY = 'md:music'

/** Round robin, so the rotation never stalls on the last track. */
export function nextTrack(index: number): number {
  return (index + 1) % TRACKS.length
}

function readOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

interface MusicStore { on: boolean; toggle: () => void; title: string }
const MusicContext = createContext<MusicStore>({ on: false, toggle: () => undefined, title: TRACKS[0].title })

export function MusicProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState<boolean>(() => typeof window === 'undefined' ? false : readOn())
  // a different track each visit, so the same one is not always the first thing you hear
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TRACKS.length))
  const audio = useRef<HTMLAudioElement | null>(null)

  // The updater stays pure: the side effects hang off the state instead. An earlier version toggled and
  // played inside the updater, which left the button and the stored setting disagreeing with each other.
  const toggle = useCallback(() => {
    const element = audio.current
    setOn(prev => !prev)
    // still inside the click, which is the moment a browser is willing to start audio
    if (element && element.paused) {
      element.volume = VOLUME
      void element.play().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* the session still knows */ }
  }, [on])

  useEffect(() => {
    const element = audio.current
    if (!element) return
    element.volume = VOLUME
    if (!on) {
      element.pause()
      return
    }
    const start = () => { void element.play().catch(() => undefined) }
    void element.play().catch(() => {
      // remembered from an earlier visit: the browser waits for this page to be touched at all
      window.addEventListener('pointerdown', start, { once: true })
      window.addEventListener('keydown', start, { once: true })
    })
    return () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
    }
  }, [on, index])

  return (
    <MusicContext.Provider value={{ on, toggle, title: TRACKS[index].title }}>
      <audio
        ref={audio} src={TRACKS[index].file} preload="none" data-testid="music"
        onEnded={() => { setIndex(nextTrack(index)) }}
      />
      {children}
    </MusicContext.Provider>
  )
}

export function useMusic(): MusicStore {
  return useContext(MusicContext)
}

/** The one control: on or off, with the track it is playing as its title. */
export function MusicButton({ className = 'btn quiet small' }: { className?: string }) {
  const { on, toggle, title } = useMusic()
  return (
    <button
      type="button" className={className} data-testid="btn-music" aria-pressed={on}
      title={on ? `Music on, ${title}` : 'Music off'} onClick={toggle}
    >
      {on ? 'Music on' : 'Music off'}
    </button>
  )
}
