// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa' // Import the plugin

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    tailwindcss(),
    VitePWA({ 
      registerType: 'autoUpdate', // Automatically update the SW when new content is available
      injectRegister: 'auto', 
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2,ttf,eot,otf}'], // Files to precache
        runtimeCaching: [
          {
            // Cache JSON data files (films.json, club.json)
            // Strategy: StaleWhileRevalidate - serve from cache if available, then update in background.
            // This ensures users get data fast, and it gets updated when they are online.
            urlPattern: ({ url }) => url.pathname.endsWith('.json'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'json-data-cache',
              expiration: {
                maxEntries: 20, // Max number of JSON files to cache
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 Days
              },
              cacheableResponse: {
                statuses: [0, 200], // Cache opaque responses and successful responses
              },
            },
          },
          {
            // Cache images (posters, profile pictures)
            // Strategy: CacheFirst - if image is in cache, serve it. Otherwise, fetch from network and then cache.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 200, // Adjust based on expected number of images
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache Google Fonts (if you were fetching them from Google's CDN directly via CSS)
            // Your current setup uses local fonts in `src/fonts.css` which will be covered by globPatterns.
            // This is an example if you had external font requests.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache', // Can use the same cache name
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          }
        ],
      },
      manifest: {
        name: 'Criterion Club',
        short_name: 'FilmClub',
        description: 'A web application for tracking films watched and reviewed by the Criterion Club.',
        theme_color: '#1e293b', 
        background_color: '#0f172a', 
        // icons: [
        //   {
        //     src: '/film-192x192.png', // Create these icons and place them in your `public` folder
        //     sizes: '192x192',
        //     type: 'image/png',
        //   },
        //   {
        //     src: '/film-512x512.png',
        //     sizes: '512x512',
        //     type: 'image/png',
        //   },
        //   {
        //     src: '/film-maskable-512x512.png', // A maskable icon
        //     sizes: '512x512',
        //     type: 'image/png',
        //     purpose: 'maskable'
        //   }
        // ],
      },
      devOptions: {
        enabled: true, // Enable PWA in development for testing
        type: 'module',
      },
    }),
  ],
  publicDir: 'public',
  base: '/',
  server: {
    port: 5173,  
    strictPort: true,
    fs: {
      allow: ['..']
    },
    hmr: {
      overlay: true,
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
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