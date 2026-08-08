/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    safelist: [
      'bg-emerald-300',
      'bg-indigo-300',
      'bg-rose-300',
      'bg-rose-300',
      'bg-sky-300',
    ],
    theme: {
      extend: {
        colors: {
          // Flat card surface: a touch lighter than slate-800. Cards fill with
          // this opaque color rather than an alpha gradient so every card reads
          // as the same shade regardless of its size or what sits behind it.
          slate: {
            825: '#222d41',
          },
        },
        fontFamily: {
          serif: ['Merriweather', 'serif'],
          sans: ['Inter', 'sans-serif'],
        },
      },
    },
    plugins: [
      require('tailwind-scrollbar'),
    ],
  }