import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    tailwindcss(),
  ],
  publicDir: 'public',
  base: '/',
  server: {
    port: 5173,  
    strictPort: true,  // Fail if port is already in use
    fs: {
      allow: ['..']
    },
    hmr: {
      overlay: true,
      protocol: 'ws',
      host: 'localhost',
      port: 5173,  // Match the server port
      clientPort: 5173,
    },
    watch: {
      usePolling: true,
      interval: 300,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**']
    },
    headers: {
      'Cache-Control': 'public, max-age=31536000',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'font/otf'
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'framer-motion'],
    exclude: []
  },
  build: {
    sourcemap: true
  }
})