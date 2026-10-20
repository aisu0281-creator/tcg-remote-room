
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/tcg-remote-room/',
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
