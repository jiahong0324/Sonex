import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  onNeedRefresh() {
    // Show a prompt to user if needed
  },
  onOfflineReady() {
    // Show a prompt to user if needed
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
