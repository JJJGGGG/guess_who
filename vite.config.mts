import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The client lives in client/ and is built into dist/, which Express serves in
// production. In dev, Vite runs inside Express as middleware (server/client.js).
export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
