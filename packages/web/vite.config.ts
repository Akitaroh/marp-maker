import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { apiPlugin } from './api'

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
