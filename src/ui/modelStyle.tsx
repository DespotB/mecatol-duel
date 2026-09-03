import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Which set of unit art the board draws. It is a viewer's setting, not part of the game: it lives in this
 * browser only, so in an online game each player looks at the pieces they prefer, the way a chess client
 * lets each side pick its own piece set. In a hot-seat game there is one screen, so there is one choice.
 */
export type ModelStyle = 'models' | 'topdown' | 'counters'

export const MODEL_STYLES: { id: ModelStyle; name: string; note: string }[] = [
  { id: 'models', name: 'Miniatures', note: 'The models at a three quarter angle, as on a table' },
  { id: 'topdown', name: 'Top down', note: 'The same models seen straight from above, like counters' },
  { id: 'counters', name: 'Async counters', note: 'The flat counter art the Async bot uses' },
]

const KEY = 'md:style'

function read(): ModelStyle {
  try {
    const saved = window.localStorage.getItem(KEY)
    return MODEL_STYLES.some(s => s.id === saved) ? saved as ModelStyle : 'models'
  } catch {
    return 'models'
  }
}

const StyleContext = createContext<{ style: ModelStyle; setStyle: (style: ModelStyle) => void }>({
  style: 'models', setStyle: () => undefined,
})

export function ModelStyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<ModelStyle>(() => typeof window === 'undefined' ? 'models' : read())
  // a second tab of the same browser is the same viewer, so it follows the choice
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === KEY) setStyleState(read()) }
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener('storage', onStorage) }
  }, [])
  const setStyle = useCallback((next: ModelStyle) => {
    setStyleState(next)
    try { window.localStorage.setItem(KEY, next) } catch { /* a blocked storage still switches for this session */ }
  }, [])
  return <StyleContext.Provider value={{ style, setStyle }}>{children}</StyleContext.Provider>
}

export function useModelStyle(): { style: ModelStyle; setStyle: (style: ModelStyle) => void } {
  return useContext(StyleContext)
}
