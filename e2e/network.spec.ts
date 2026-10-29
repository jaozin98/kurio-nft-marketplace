import { expect, test, type Page } from '@playwright/test'
import { addToCart } from './helpers'

// soma os deslocamentos de layout durante o carregamento
async function trackLayoutShift(page: Page) {
  await page.addInitScript(() => {
    ;(window as any).__cls = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) (window as any).__cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
}

// só os cards do catálogo, sem o destaque da barra lateral
const cards = (page: Page) =>
  page.getByRole('region', { name: 'Catálogo' }).getByRole('link', { name: /#\d+ .*ETH/ })

test('carregamento lento mostra skeleton com shimmer e depois o conteúdo, sem pulo de layout', async ({ page }) => {
  await trackLayoutShift(page)
  await page.goto('/?scenario=slow')

  // durante a espera aparecem os esqueletos no lugar dos cards
  await expect(page.locator('.shimmer').first()).toBeVisible()
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByText('Carregando...')).toBeVisible()

  await expect(cards(page).first()).toBeVisible({ timeout: 10000 })
  await expect(page.locator('main .shimmer')).toHaveCount(0)

  const cls = await page.evaluate(() => (window as any).__cls as number)
  expect(cls).toBeLessThan(0.1)
})

for (const scenario of ['list-error', 'network-error']) {
  test(`${scenario}: mostra o erro e recupera ao tentar de novo`, async ({ page }) => {
    await page.goto(`/?scenario=${scenario}`)

    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar os NFTs.' })
    await expect(alert).toBeVisible({ timeout: 15000 })
    await expect(cards(page)).toHaveCount(0)

    await alert.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(cards(page).first()).toBeVisible()
    await expect(alert).toBeHidden()
  })
}

test('resultado vazio mostra a mensagem certa', async ({ page }) => {
  await page.goto('/?scenario=empty')
  await expect(page.getByText('Nenhum NFT encontrado com esses filtros.')).toBeVisible()
  await expect(page.getByText(/^0 resultados$/)).toBeVisible()
})

test('resposta antiga que chega depois não sobrescreve a busca mais nova', async ({ page }) => {
  await page.goto('/?scenario=out-of-order')
  await expect(cards(page).first()).toBeVisible()

  const busca = page.locator('#busca')
  // "e" é lenta (muitos resultados); "Emerald" responde mais rápido e chega primeiro
  await busca.fill('e')
  await page.waitForTimeout(450)
  await busca.fill('Emerald')

  await expect(page.getByText(/^6 resultados$/)).toBeVisible({ timeout: 5000 })
  // espera a resposta lenta da busca antiga terminar e confere que nada mudou
  await page.waitForTimeout(2000)
  await expect(page.getByText(/^6 resultados$/)).toBeVisible()
  expect(await cards(page).count()).toBe(6)
})

test('?reset=1 volta o mock ao estado inicial conhecido', async ({ page }) => {
  await addToCart(page, '4')
  await page.goto('/cart')
  await expect(page.getByRole('button', { name: /^Remover/ })).toBeVisible()

  await page.goto('/?reset=1')
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
})
