import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // com vários testes em paralelo a máquina fica mais lenta; 10s evita falhas por demora
  expect: { timeout: 10_000 },
  // poucos workers: com mais, a máquina fica sob carga e testes caem por tempo ou por perda de artefatos
  workers: 2,
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // animações desligadas deixam as capturas estáveis
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  // os testes rodam contra o build de produção: o servidor de desenvolvimento compila sob
  // demanda e deixa as primeiras cargas lentas e instáveis
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
