/// <reference types="vite/client" />

// Swiper ships side-effect CSS entry points without type declarations.
// Declaring them here lets us import the stylesheets without `@ts-ignore`.
declare module 'swiper/css';
declare module 'swiper/css/*';
