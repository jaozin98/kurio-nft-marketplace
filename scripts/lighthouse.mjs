// Auditoria Lighthouse: início e detalhe, perfis mobile e desktop, 3 medições cada, mediana por categoria.
// Uso: npm run lighthouse   (precisa do build em dist/ e usa `vite preview` na porta 4173)
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'

const PORT = 4173
const BASE = `http://localhost:${PORT}`
const RUNS = 3
// fileURLToPath decodifica espaços do caminho (ex.: "jungle gaming")
const OUT = fileURLToPath(new URL('../lighthouse/', import.meta.url))
const pages = [
  { name: 'inicio', path: '/' },
  { name: 'detalhe', path: '/nft/4' },
]
const profiles = {
  mobile: undefined, // padrão do Lighthouse: emulação de celular e rede 4G lenta
  desktop: {
    formFactor: 'desktop',
    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
  },
}
const categories = ['performance', 'accessibility', 'best-practices', 'seo']

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

mkdirSync(`${OUT}reports`, { recursive: true })

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const stop = () => preview.kill()
process.on('exit', stop)

// espera o servidor subir
for (let i = 0; i < 40; i++) {
  try {
    if ((await fetch(BASE)).ok) break
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}

const results = []

for (const [profile, overrides] of Object.entries(profiles)) {
  for (const page of pages) {
    const runs = []
    for (let run = 1; run <= RUNS; run++) {
      const chrome = await chromeLauncher.launch({
        chromePath: chromium.executablePath(),
        chromeFlags: ['--headless=new', '--no-sandbox'],
      })
      const { lhr, report } = await lighthouse(
        BASE + page.path,
        { port: chrome.port, output: ['html', 'json'], onlyCategories: categories, logLevel: 'error' },
        overrides ? { extends: 'lighthouse:default', settings: overrides } : undefined,
      ).then((r) => ({ lhr: r.lhr, report: r.report }))
      await chrome.kill()

      const base = `${OUT}reports/${page.name}-${profile}-${run}`
      writeFileSync(`${base}.html`, report[0])
      writeFileSync(`${base}.json`, report[1])

      runs.push({
        scores: Object.fromEntries(categories.map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
        lcp: lhr.audits['largest-contentful-paint'].numericValue,
        cls: lhr.audits['cumulative-layout-shift'].numericValue,
        tbt: lhr.audits['total-blocking-time'].numericValue,
      })
      console.log(`${page.name} ${profile} #${run}`, JSON.stringify(runs.at(-1).scores))
    }

    results.push({
      page: page.name,
      profile,
      runs,
      median: {
        ...Object.fromEntries(categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
        lcpMs: Math.round(median(runs.map((r) => r.lcp))),
        cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
        tbtMs: Math.round(median(runs.map((r) => r.tbt))),
      },
    })
  }
}

stop()

const meta = {
  lighthouse: JSON.parse(readFileSync(new URL('../node_modules/lighthouse/package.json', import.meta.url))).version,
  chromium: chromium.executablePath().split('/').slice(-4)[0],
  node: process.version,
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  cpus: os.cpus().length,
  build: 'vite build + vite preview, mocks MSW ativos (cenário padrão)',
  runsPerPage: RUNS,
  date: new Date().toISOString(),
}
writeFileSync(`${OUT}summary.json`, JSON.stringify({ meta, results }, null, 2))

const rows = results.map(
  (r) =>
    `| ${r.page} | ${r.profile} | ${r.median.performance} | ${r.median.accessibility} | ${r.median['best-practices']} | ${r.median.seo} | ${r.median.lcpMs} ms | ${r.median.cls} | ${r.median.tbtMs} ms |`,
)
writeFileSync(
  `${OUT}summary.md`,
  `# Lighthouse (mediana de ${RUNS} medições)\n\n| Página | Perfil | Perf. | A11y | Boas práticas | SEO | LCP | CLS | TBT |\n|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\nAmbiente: ${JSON.stringify(meta)}\n`,
)
console.log('\n' + readFileSync(`${OUT}summary.md`, 'utf8'))
