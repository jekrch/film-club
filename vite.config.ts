import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { liveDataFiles, slimIndex } from './scripts/liveData.ts';

/**
 * The Content Security Policy, injected into the built `index.html` only.
 *
 * What it protects is the editor's Google ID token, which `sessionStore.ts`
 * keeps in `sessionStorage` where any script running on this origin can read
 * it. Pinning `script-src` to this origin and the two third-party scripts the
 * site actually loads is what stops an injection from becoming such a script.
 * Nothing on the site is known to be injectable — `Markdown` escapes raw HTML
 * and the worker validates every stored URL — so this is the second line of
 * defense rather than a patch over a hole.
 *
 * It is a meta tag because GitHub Pages can't set response headers, which also
 * means `frame-ancestors` (header-only) can't be expressed. A meta policy only
 * governs what comes after it, so it goes straight after the charset.
 *
 * Build-only because the dev server injects an inline React Refresh preamble
 * that `script-src` would block. `vite preview` serves the build, and is where
 * a violation shows up in the console.
 *
 * Every origin added below widens what an injected script could reach.
 */
function contentSecurityPolicy(): Plugin {
    let editorOrigin = '';
    return {
        name: 'content-security-policy',
        apply: 'build',
        configResolved(config) {
            // The worker is the one origin that varies by deployment. Unset,
            // editing is off and nothing needs to reach it.
            const url: string | undefined = config.env.VITE_EDITOR_API_URL;
            editorOrigin = url ? new URL(url).origin : '';
        },
        transformIndexHtml(html) {
            const connect = [
                "'self'",
                'https://accounts.google.com',
                'https://analytics.jacobkrch.com',
                editorOrigin,
            ].filter(Boolean);
            const policy = [
                "default-src 'self'",
                // GIS and analytics, nothing else. The JSON-LD block is data, not
                // script, and a policy doesn't apply to it.
                "script-src 'self' https://accounts.google.com/gsi/client https://analytics.jacobkrch.com",
                // 'unsafe-inline' because React and framer-motion set style
                // attributes; injected style is a far smaller problem than script.
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
                "font-src 'self' https://fonts.gstatic.com",
                // Posters and stills come from OMDb, TMDb, and any https URL a
                // member pastes; blob: is the avatar upload's preview.
                "img-src 'self' data: blob: https:",
                `connect-src ${connect.join(' ')}`,
                'frame-src https://accounts.google.com https://www.youtube-nocookie.com',
                "worker-src 'self'",
                "base-uri 'self'",
                "form-action 'self'",
                "object-src 'none'",
            ].join('; ');

            // Fail the build rather than ship a page without its policy.
            const charset = '<meta charset="UTF-8" />';
            if (!html.includes(charset)) {
                throw new Error('content-security-policy: no charset meta in index.html to follow');
            }
            return html.replace(
                charset,
                `${charset}\n        <meta http-equiv="Content-Security-Policy" content="${policy}" />`
            );
        },
    };
}

/**
 * The worker-owned data files, which `src/api/repoData.ts` re-reads at runtime.
 * Every one of them is also imported into the bundle.
 */
const LIVE_DATA_FILES = [
    'overrides.json',
    'lists.json',
    'trophies.json',
    'club.json',
    'responses.json',
];

/**
 * Publishes the files above at `/data/`, next to the app, along with the
 * generated ones that are *not* in the bundle (`scripts/liveData.ts`): every
 * member's watch log, each list film's full summary, and the slim film index.
 *
 * The bundled files are here because a visitor's bundle may be one deploy old.
 * The service worker serves the precached one until its update reloads the page.
 * A fetch from `/data/` reads whatever the latest deploy published. That is
 * the freshness the editors and the reaction threads need, from the site's own
 * origin rather than the repo's.
 *
 * The generated ones are here because this is the only place they are. A
 * watch-log commit doesn't rebuild the site at all: `data-deploy.yml` rewrites
 * just these files on `gh-pages`, using the same generator.
 *
 * In dev the same paths serve the working copies in `src/assets`, regenerated
 * per request so an edit to a log shows up on reload.
 */
function liveData(): Plugin {
    let assets = '';
    const read = (file: string) => readFileSync(resolve(assets, file));
    return {
        name: 'live-data',
        configResolved(config) {
            assets = resolve(config.root, 'src/assets');
        },
        configureServer(server) {
            server.middlewares.use('/data', (req, res, next) => {
                const file = (req.url ?? '').split('?')[0].replace(/^\//, '');
                const body = LIVE_DATA_FILES.includes(file)
                    ? read(file)
                    : liveDataFiles(assets).get(file);
                if (body === undefined) return next();
                res.setHeader('Content-Type', 'application/json');
                res.end(body);
            });
        },
        generateBundle() {
            for (const file of LIVE_DATA_FILES) {
                this.emitFile({ type: 'asset', fileName: `data/${file}`, source: read(file) });
            }
            for (const [file, source] of liveDataFiles(assets)) {
                this.emitFile({ type: 'asset', fileName: `data/${file}`, source });
            }
        },
    };
}

/**
 * Bundles `listFilms.json` as its slim index rather than the whole cache.
 *
 * `src/types/list.ts` imports the file as usual, and this cuts it down on the
 * way in to the fields a collapsed row draws (`slimSummary` in
 * `scripts/liveData.ts`). The rest of each summary is fetched from
 * `data/films/<id>.json` when a row's panel opens (`src/api/filmSummaries.ts`).
 * Tests import the full file, which is a superset, so they are unaffected.
 *
 * `enforce: 'pre'` so this sees the raw JSON before Vite's own JSON plugin
 * turns it into a module.
 */
function slimListFilms(): Plugin {
    return {
        name: 'slim-list-films',
        enforce: 'pre',
        transform(code, id) {
            if (!id.split('?')[0].endsWith('/src/assets/listFilms.json')) return null;
            return { code: JSON.stringify(slimIndex(JSON.parse(code))), map: null };
        },
    };
}

export default defineConfig({
    plugins: [
        react({
            jsxRuntime: 'automatic',
        }),
        tailwindcss(),
        contentSecurityPolicy(),
        slimListFilms(),
        liveData(),
        VitePWA({
            registerType: 'autoUpdate', // Automatically update the SW when new content is available
            // `null`, not 'auto': src/main.tsx registers via `virtual:pwa-register`,
            // which is the only path that reloads the page on update. Leaving this on
            // 'auto' risks falling back to the inject-a-script behavior, which registers
            // the SW but leaves the stale page rendered.
            injectRegister: null,
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2,ttf,eot,otf}'], // Files to precache
                // Not the live data files (see `liveData`). A precached copy is
                // exactly the stale one they are fetched to get past.
                globIgnores: ['**/node_modules/**/*', 'data/**'],
                // The bundled data (films.json + persons.json) makes individual chunks
                // exceed Workbox's 2 MiB default. Raise the ceiling so they still precache
                // for offline use; headroom left for the dataset growing over time.
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                runtimeCaching: [
                    {
                        // Cache JSON data files (films.json, club.json)
                        // Strategy: StaleWhileRevalidate - serve from cache if available, then update in background.
                        // This ensures users get data fast, and it gets updated when they are online.
                        //
                        // Not `/data/`. `src/api/repoData.ts` reads the live data files
                        // from there precisely to get something newer than the bundle,
                        // and stale-while-revalidate would hand it the copy from the
                        // previous visit instead.
                        urlPattern: ({ url }) =>
                            !url.pathname.startsWith('/data/') && url.pathname.endsWith('.json'),
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
                        // Cache the Google Fonts stylesheet and files that index.html loads.
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
                    },
                ],
            },
            manifest: {
                name: 'Criterion Club',
                short_name: 'FilmClub',
                description:
                    '4-5 friends who watch Criterion Channel films and rate them on a 9-point scale. Is this a podcast?',
                // The page colour, matching index.html's theme-color and the
                // field the icons are drawn on.
                theme_color: '#0f172b',
                background_color: '#0f172b',
                icons: [
                    {
                        src: '/pillar-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/pillar-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '/pillar-maskable-512x512.png', // A maskable icon
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            devOptions: {
                // Keep the service worker OFF during `vite dev` so local edits show up
                // without a hard refresh. The real SW still runs in `vite build` +
                // `vite preview`, which is where you should test PWA/caching behavior.
                enabled: false,
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
            allow: ['..'],
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
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        },
    },
    optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', 'framer-motion'],
        exclude: [],
    },
    build: {
        sourcemap: true,
        rollupOptions: {
            output: {
                // Keep the large bundled data in their own chunks so they cache-bust
                // independently of the app/vendor code (films.json + persons.json change
                // on every daily sync), and so no single chunk balloons the app shell.
                manualChunks(id) {
                    if (id.includes('src/assets/persons.json')) return 'persons-data';
                    if (id.includes('src/assets/films.json')) return 'films-data';
                    if (id.includes('node_modules')) return 'vendor';
                },
            },
        },
    },
});
