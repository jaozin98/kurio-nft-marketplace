import { expect, test, type Page } from '@playwright/test'
import { addToCart, login } from './helpers'

// As imagens do catálogo são geradas no código, então os dados são estáveis.
// Baselines em e2e/__screenshots__/<projeto>/; atualize com: npm run test:visual:update
const options = { fullPage: true, maxDiffPixelRatio: 0.01 }

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.locator('.shimmer').first().waitFor({ state: 'detached' }).catch(() => {})
  await page.waitForTimeout(300)
}

test('início', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /#\d+ .*ETH/ }).first().waitFor()
  await settle(page)
  await expect(page).toHaveScreenshot('inicio.png', options)
})

test('detalhe do NFT', async ({ page }) => {
  await page.goto('/nft/4')
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.getByRole('link', { name: /#\d+ .*ETH/ }).first().waitFor()
  await settle(page)
  await expect(page).toHaveScreenshot('detalhe.png', options)
})

test('carrinho', async ({ page }) => {
  await addToCart(page, '4')
  await page.goto('/cart')
  await page.getByRole('button', { name: /^Remover/ }).waitFor()
  await page.getByRole('link', { name: /#\d+ .*ETH/ }).first().waitFor()
  await settle(page)
  await expect(page).toHaveScreenshot('carrinho.png', options)
})

test('pagamento', async ({ page }) => {
  await addToCart(page, '4')
  await page.goto('/login?redirect=/checkout')
  await login(page)
  await page.getByRole('heading', { name: 'Pagamento' }).waitFor()
  await page.getByText('Carteira principal').waitFor()
  await settle(page)
  await expect(page).toHaveScreenshot('pagamento.png', options)
})
