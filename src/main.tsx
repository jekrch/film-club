import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import '@jekrch/react-viewport-lightbox/styles.css'
import App from './App.tsx'

// Register through the virtual module rather than the plugin's injected
// `registerSW.js`, which only registers and never reloads. In `autoUpdate`
// mode this attaches an `activated` listener that reloads the page once the
// new service worker takes over, so a deploy shows up on the current load
// instead of requiring a manual refresh (or several, while the new SW is
// still precaching).
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
