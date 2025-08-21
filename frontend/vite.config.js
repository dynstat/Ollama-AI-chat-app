import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Proxy API routes to the backend service when running via docker-compose
      '/chat': {
        target: 'http://backend:3001',
        changeOrigin: true
      },
      '/health': {
        target: 'http://backend:3001',
        changeOrigin: true
      }
    }
  }
})
