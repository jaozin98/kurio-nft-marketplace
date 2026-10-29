import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('abre o detalhe direto pela URL', async ({ page }) => {
  await page.goto('/nft/5')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Rusty Ape')
  await expect(page.getByText('0.45 ETH')).toBeVisible()
})

test('mostra erro para NFT inexistente', async ({ page }) => {
  await page.goto('/nft/999')
  await expect(page.getByRole('alert')).toContainText('NFT não encontrado')
})

test('edição esgotada desabilita a compra', async ({ page }) => {
  await page.goto('/nft/7')
  await expect(page.getByRole('button', { name: 'Edição esgotada' })).toBeDisabled()
})

test('quantidade respeita o estoque da edição escolhida', async ({ page }) => {
  await page.goto('/nft/5')
  // o NFT 5 abre na edição 1/1, que tem 1 unidade
  await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()

  await page.goto('/nft/4')
  // a edição ABERTA do NFT 4 tem 4 unidades
  await page.getByRole('radio', { name: 'ABERTA' }).click()
  const plus = page.getByRole('button', { name: 'Aumentar quantidade' })
  for (let i = 0; i < 3; i++) await plus.click()
  await expect(page.getByRole('group', { name: 'Quantidade' }).locator('output')).toHaveText('4')
  await expect(plus).toBeDisabled()
})

test('edição esgotada não pode ser escolhida', async ({ page }) => {
  await page.goto('/nft/4')
  // a edição 1/1 do NFT 4 está esgotada; abre numa edição com estoque
  await expect(page.getByRole('radio', { name: '1/1 (esgotada)', exact: true })).toBeDisabled()
  await expect(page.getByRole('radio', { name: '1/10' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('2 disponíveis nesta edição.')).toBeVisible()
})

test('trocar de edição muda o limite e zera a quantidade', async ({ page }) => {
  await page.goto('/nft/4')
  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await expect(page.getByRole('group', { name: 'Quantidade' }).locator('output')).toHaveText('2')

  await page.getByRole('radio', { name: 'ABERTA' }).click()
  await expect(page.getByRole('group', { name: 'Quantidade' }).locator('output')).toHaveText('1')
  await expect(page.getByText('4 disponíveis nesta edição.')).toBeVisible()
})

test('favoritar sem login leva ao login e volta ao NFT', async ({ page }) => {
  await page.goto('/nft/5')
  await page.getByRole('button', { name: 'Favoritar', pressed: false }).click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fnft%2F5/)

  await login(page)
  await expect(page).toHaveURL('/nft/5')

  await page.getByRole('button', { name: 'Favoritar', pressed: false }).click()
  await expect(page.getByRole('button', { name: 'Favoritar', pressed: true })).toBeVisible()
})

test('favorito persiste após refresh', async ({ page }) => {
  await page.goto('/login?redirect=/nft/5')
  await login(page)

  const saved = page.waitForResponse((res) => res.url().includes('/api/favorites/5'))
  await page.getByRole('button', { name: 'Favoritar', pressed: false }).click()
  await saved
  await expect(page.getByRole('button', { name: 'Favoritar', pressed: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Favoritar', pressed: true })).toBeVisible()
})

test('falha ao favoritar desfaz a mudança', async ({ page }) => {
  await page.goto('/login?redirect=/nft/13')
  await login(page)

  await page.getByRole('button', { name: 'Favoritar', pressed: false }).click()
  await expect(page.getByRole('alert')).toContainText('Serviço indisponível')
  await expect(page.getByRole('button', { name: 'Favoritar', pressed: false })).toBeVisible()
})

test('adiciona ao carrinho', async ({ page }) => {
  await page.goto('/nft/4')
  await page.getByRole('button', { name: 'COMPRAR' }).click()
  await expect(page.getByText('Adicionado ao carrinho.')).toBeVisible()
})
