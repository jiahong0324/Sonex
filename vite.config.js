import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      workbox: {
        globIgnores: ['**/ffmpeg-core.wasm', '**/font.ttf', '**/ffmpeg-core.js']
      },
      manifest: {
        name: 'Sonex Caption Master',
        short_name: 'Sonex',
        description: 'Generate, customize & clean up video speech captions instantaneously using AI',
        theme_color: '#09090b', // zinc-950
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
