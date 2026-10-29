import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// A mesma suíte contra um site já publicado, sem subir servidor local:
//   LIVE_URL=https://seu-site.vercel.app npm run test:e2e:live
const baseURL = process.env.LIVE_URL
if (!baseURL) throw new Error('Defina LIVE_URL com o endereço publicado.')

export default defineConfig({
  ...base,
  reporter: [['dot']],
  // contra o site publicado, vários workers deixam os testes sensíveis a tempo instáveis
  workers: 1,
  use: { ...base.use, baseURL },
  webServer: undefined,
})
