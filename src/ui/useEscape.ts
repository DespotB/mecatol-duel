import { useEffect } from 'react'

/**
 * Escape closes a dialog or drawer. Only wire it where a cancel already exists: Escape must never
 * abandon a flow the engine has already started (a running combat, an open invasion), because there
 * is no move that would take it back.
 */
export function useEscape(onEscape: (() => void) | undefined): void {
  useEffect(() => {
    if (!onEscape) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !onEscape) return
      event.preventDefault()
      onEscape()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onEscape])
}
