/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Swiper ships side-effect CSS entry points without type declarations.
// Declaring them here lets us import the stylesheets without `@ts-ignore`.
declare module 'swiper/css';
declare module 'swiper/css/*';
