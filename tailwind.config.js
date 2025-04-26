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
        fontFamily: {
          serif: ['Merriweather', 'serif'],
          sans: ['Inter', 'sans-serif'],
        },
      },
    },
    plugins: [],
  }