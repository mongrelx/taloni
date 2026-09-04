import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Palvellaan tuotannossa samasta Node-palvelimesta kuin REST-API (issue #32) — ei erillistä
// hostausta tai CORS-konfigurointia tarvita, koska UI ja API jakavat aina saman originin.
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // Kehityksessä (npm run dev tässä hakemistossa) välitetään /api ja /health erilliseen
    // `taloni serve`-prosessiin porttiin 3000.
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
