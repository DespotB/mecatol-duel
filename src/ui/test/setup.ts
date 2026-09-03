import { afterEach } from 'vitest'

// Runs for every test file. Under node (the engine suite) there is nothing to clean up, so the
// testing-library import stays inside the jsdom branch and never loads react-dom in a DOM-less run.
afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
  window.localStorage.clear()
  window.location.hash = ''
})
