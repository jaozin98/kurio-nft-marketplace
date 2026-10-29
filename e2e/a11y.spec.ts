import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { addToCart, login } from './helpers'

const pageReady = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => (window as any).__mock)

test.describe('teclado e foco', () => {
  test('o primeiro Tab leva ao link de pular conteúdo e ele funciona', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { level: 1 }).waitFor()
    await page.keyboard.press('Tab')

    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeFocused()
  })

  test('elementos focados mostram um contorno visível', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { level: 1 }).waitFor()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element)
      return { width: parseFloat(style.outlineWidth), style: style.outlineStyle }
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).toBeGreaterThanOrEqual(2)
  })

  test('filtros funcionam só com o teclado e entram na URL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const musica = page.getByRole('checkbox', { name: /Música/ }).first()
    await musica.focus()
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(/collection=/)
    await expect(page.getByText(/^\d+ resultados$/)).toBeVisible()
  })

  test('gaveta de filtros prende o foco, fecha com Esc e devolve o foco', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByRole('heading', { level: 1 }).waitFor()

    const trigger = page.getByRole('button', { name: 'Filtros', exact: true })
    await trigger.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Filtros' })
    await expect(dialog).toBeVisible()

    // o foco fica dentro da gaveta mesmo depois de muitos Tab
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      // o Base UI devolve o foco do elemento-guarda para dentro do diálogo logo após o Tab
      await expect
        .poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))
        .toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('erros de formulário ficam ligados ao campo por aria', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()

    const email = page.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy}`)).toContainText('e-mail válido')
  })

  test('com movimento reduzido o shimmer não anima', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?scenario=slow')
    const shimmer = page.locator('.shimmer').first()
    await expect(shimmer).toBeVisible()
    expect(await shimmer.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
  })
})

test.describe('axe: sem violações sérias', () => {
  const serious = (violations: { impact?: string | null }[]) =>
    violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')

  test('início', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /#\d+/ }).first().waitFor()
    await pageReady(page)
    const result = await new AxeBuilder({ page }).analyze()
    expect(serious(result.violations), JSON.stringify(serious(result.violations), null, 1)).toEqual([])
  })

  test('detalhe', async ({ page }) => {
    await page.goto('/nft/4')
    await page.getByRole('heading', { level: 1 }).waitFor()
    const result = await new AxeBuilder({ page }).analyze()
    expect(serious(result.violations), JSON.stringify(serious(result.violations), null, 1)).toEqual([])
  })

  test('carrinho', async ({ page }) => {
    await addToCart(page, '4')
    await page.goto('/cart')
    await page.getByRole('button', { name: /^Remover/ }).waitFor()
    const result = await new AxeBuilder({ page }).analyze()
    expect(serious(result.violations), JSON.stringify(serious(result.violations), null, 1)).toEqual([])
  })

  test('login e cadastro', async ({ page }) => {
    for (const path of ['/login', '/register']) {
      await page.goto(path)
      await page.getByRole('heading', { level: 1 }).waitFor()
      const result = await new AxeBuilder({ page }).analyze()
      expect(serious(result.violations), `${path}: ${JSON.stringify(serious(result.violations), null, 1)}`).toEqual([])
    }
  })

  test('pagamento', async ({ page }) => {
    await addToCart(page, '4')
    await page.goto('/login?redirect=/checkout')
    await login(page)
    await page.getByRole('heading', { name: 'Pagamento' }).waitFor()
    const result = await new AxeBuilder({ page }).analyze()
    expect(serious(result.violations), JSON.stringify(serious(result.violations), null, 1)).toEqual([])
  })
})
