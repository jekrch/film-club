import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  publicDir: 'public',
  base: '/',
  server: {
    port: 3000, 
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..']
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost', 
      port: 3000
    },
    headers: {
      // Set MIME types for font files
      'Cache-Control': 'public, max-age=31536000',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'font/otf'
    }
  }
})