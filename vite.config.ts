import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // the sprite renderers under tools/render are standalone pages that import three from a CDN; without this
  // the dev server's dependency scan follows them, fails to resolve three and serves a broken page
  optimizeDeps: { entries: ['index.html'] },
  test: {
    // the engine suite runs in node; UI test files opt into jsdom with a `@vitest-environment` docblock
    environment: 'node',
    /*
     * The suite never talks to a server. Blanking the two Supabase variables gives every test the same
     * build a visitor without a configured server gets: no transport, hot-seat only, nothing over the
     * wire. A test that wants the online paths builds its own transport double and passes it in.
     */
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/ui/test/setup.ts'],
    // the ten seeded full games in fullGame.test.ts sit right at the five second default on a loaded machine
    testTimeout: 30000,
  },
})
