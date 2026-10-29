import { expect, test } from '@playwright/test'
import { addToCart, login } from './helpers'

// NFT 4: 0.98 ETH, 5 em estoque. NFT 5: 0.45 ETH, 1 em estoque.

test('carrinho vazio mostra mensagem e link para o catálogo', async ({ page }) => {
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
})

test('altera a quantidade e recalcula o resumo', async ({ page }) => {
  await addToCart(page, '4')
  await page.goto('/cart')

  const summary = page.getByRole('complementary', { name: 'Resumo da carteira' })
  await expect(summary).toContainText('0.98 ETH')

  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await expect(summary).toContainText('1.96 ETH')
})

test('não deixa passar do estoque', async ({ page }) => {
  await addToCart(page, '5')
  await page.goto('/cart')
  await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
})

test('remove o item e volta ao estado vazio', async ({ page }) => {
  await addToCart(page, '4')
  await page.goto('/cart')
  await page.getByRole('button', { name: /^Remover Cosmic Bloom/ }).click()
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
})

test('aplica e remove cupom válido', async ({ page }) => {
  await addToCart(page, '4')
  await page.goto('/cart')

  await page.getByLabel('Código promocional').fill('green10')
  await page.getByRole('button', { name: 'Aplicar' }).click()

  const summary = page.getByRole('complementary', { name: 'Resumo da carteira' })
  await expect(summary).toContainText('− 0.098 ETH')
  await expect(summary).toContainText('0.0025 ETH')
  await expect(summary).toContainText('0.8845 ETH')

  await summary.getByRole('button', { name: 'Remover' }).click()
  await expect(summary).toContainText('0.9825 ETH')
})

test('mostra erro para cupom inválido e expirado', async ({ page }) => {
  await addToCart(page, '4')
  await page.goto('/cart')

  await page.getByLabel('Código promocional').fill('NAOEXISTE')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert')).toContainText('Cupom inválido')

  await page.getByLabel('Código promocional').fill('OLD20')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert')).toContainText('Cupom expirado')
})

test('carrinho persiste após refresh', async ({ page }) => {
  await addToCart(page, '4', 2)
  await page.goto('/cart')
  await page.reload()
  await expect(page.locator('output').first()).toHaveText('2')
})

test('itens do visitante são mantidos ao fazer login', async ({ page }) => {
  await addToCart(page, '4')

  await page.goto('/login?redirect=/cart')
  await login(page)

  await expect(page).toHaveURL('/cart')
  await expect(page.getByRole('link', { name: 'Cosmic Bloom #104' })).toBeVisible()
})

test('a mesma obra em edições diferentes vira linhas separadas', async ({ page }) => {
  await page.goto('/nft/4')
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await page.getByText('Adicionado ao carrinho.').waitFor()

  await page.getByRole('radio', { name: 'ABERTA' }).click()
  const added = page.waitForResponse((res) => res.url().endsWith('/api/cart/items') && res.ok())
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await added

  await page.goto('/cart')
  await expect(page.getByRole('button', { name: /^Remover Cosmic Bloom #104 \(1\/10\)/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Remover Cosmic Bloom #104 \(ABERTA\)/ })).toBeVisible()

  // cada linha respeita o estoque da própria edição
  await page.getByRole('button', { name: /^Remover Cosmic Bloom #104 \(1\/10\)/ }).click()
  await expect(page.getByRole('button', { name: /^Remover Cosmic Bloom #104 \(1\/10\)/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Remover Cosmic Bloom #104 \(ABERTA\)/ })).toBeVisible()
})
