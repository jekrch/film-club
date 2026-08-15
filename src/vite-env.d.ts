/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Swiper ships side-effect CSS entry points without type declarations.
// Declaring them here lets us import the stylesheets without `@ts-ignore`.
declare module 'swiper/css';
declare module 'swiper/css/*';

/**
 * Editing configuration, both optional: without them the site builds and runs
 * exactly as it does today, minus the editing surfaces. `clubApi.isEditorConfigured`
 * is what every editor entry point checks before offering itself.
 */
interface ImportMetaEnv {
    /**
     * OAuth *web client* ID from the Google Cloud console. Public by design in
     * the GIS ID-token flow — the browser must send it, and the worker checks
     * every token's `aud` against the same value.
     */
    readonly VITE_GOOGLE_CLIENT_ID?: string;
    /** Base URL of the editing worker, e.g. `https://film-club-editor.example.workers.dev`. */
    readonly VITE_EDITOR_API_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
