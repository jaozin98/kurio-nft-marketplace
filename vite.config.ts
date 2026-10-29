import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // o socket simulado ocupa a origem inteira; o HMR sai do caminho padrão
    hmr: { path: '/__vite_hmr' },
  },
  resolve: {
    // permite importar com "@/components/..." em vez de caminhos relativos
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
})
