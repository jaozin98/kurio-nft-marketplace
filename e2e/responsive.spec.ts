import { expect, test } from '@playwright/test'
import { addToCart, login } from './helpers'

// larguras avaliadas pelo desafio: celular, tablet e desktop
// 320 px equivale a 400% de zoom em 1280 px (reflow do WCAG)
const widths = [320, 390, 768, 1440]

for (const width of widths) {
  test.describe(`largura ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    const noHorizontalScroll = async (page: import('@playwright/test').Page) => {
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }))
      expect(scroll, `scrollWidth ${scroll} > largura ${inner}`).toBeLessThanOrEqual(inner)
    }

    for (const path of ['/', '/nft/4', '/login', '/register']) {
      test(`${path} sem rolagem horizontal`, async ({ page }) => {
        await page.goto(path)
        await page.getByRole('heading', { level: 1 }).waitFor()
        await page.evaluate(() => document.fonts.ready)
        await page.waitForFunction(() => [...document.images].every((image) => image.loading === 'lazy' || image.complete))
        await noHorizontalScroll(page)
      })
    }

    test('carrinho e pagamento sem rolagem horizontal', async ({ page }) => {
      await addToCart(page, '4')
      await page.goto('/cart')
      await page.getByRole('button', { name: /^Remover/ }).waitFor()
      await noHorizontalScroll(page)

      await page.goto('/login?redirect=/checkout')
      await login(page)
      await page.getByRole('heading', { name: 'Pagamento' }).waitFor()
      await noHorizontalScroll(page)
    })

    test('o conteúdo principal continua acessível: menu e catálogo', async ({ page }) => {
      await page.goto('/')
      // abaixo de 768 px o menu vira a barra inferior (Figma); a partir daí fica no cabeçalho
      await expect(
        page.getByRole('navigation', { name: width < 768 ? 'Navegação inferior' : 'Principal' }),
      ).toBeVisible()
      await expect(
        page.getByRole('region', { name: 'Catálogo' }).getByRole('link', { name: /#\d+ .*ETH/ }).first(),
      ).toBeVisible()
    })
  })
}
