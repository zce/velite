import path from 'node:path'
import velite from '@velite/plugin-vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), velite()],
  resolve: {
    alias: {
      '#velite': path.resolve(__dirname, '.velite')
    }
  }
})
