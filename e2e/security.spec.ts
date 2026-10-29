import { expect, test } from '@playwright/test'
import { addToCart, login, loginAs } from './helpers'

test('um usuário não vê o pedido de outro (403)', async ({ page }) => {
  // Ana compra
  await addToCart(page, '4')
  await page.goto('/login?redirect=/checkout')
  await login(page)
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/orders\//)
  const orderUrl = page.url()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })

  // Bruno tenta abrir o mesmo pedido
  await page.getByRole('banner').getByRole('button', { name: 'Sair' }).click()
  await page.goto('/login')
  await loginAs(page, 'bruno@greenmint.test', 'senha123')
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sair' })).toBeVisible()
  await page.goto(orderUrl)

  await expect(page.getByRole('alert')).toContainText('Você não tem acesso a este pedido')
  await expect(page.getByText('Cosmic Bloom #104')).toHaveCount(0)
})

test('pedido inexistente mostra erro 404', async ({ page }) => {
  await page.goto('/login?redirect=/orders/ord-nao-existe')
  await login(page)
  await expect(page.getByRole('alert')).toContainText('Pedido não encontrado')
})

test('rota inexistente mostra a página de não encontrado', async ({ page }) => {
  await page.goto('/isso-nao-existe')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar para o início' }).click()
  await expect(page).toHaveURL(/\/($|\?)/)
})

test.describe('acesso direto a cada tela prevista', () => {
  const publicPages: [string, string | RegExp][] = [
    ['/', /SEJA DONO D[AO]/],
    ['/nft/4', 'Cosmic Bloom #104'],
    ['/cart', /Seu carrinho está vazio|Carrinho/],
    ['/login', 'Entrar'],
    ['/register', 'Criar conta'],
  ]
  for (const [path, text] of publicPages) {
    test(`${path} abre direto`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('main')).toContainText(text)
    })
  }

  for (const path of ['/profile', '/wallets', '/checkout', '/orders/ord-1']) {
    test(`${path} sem login vai para o login e guarda o destino`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`/login\\?redirect=${encodeURIComponent(path).replace(/\./g, '\\.')}`))
    })
  }

  for (const [path, heading] of [
    ['/profile', 'Perfil do colecionador'],
    ['/wallets', 'Carteiras'],
    ['/checkout', 'Pagamento'],
  ] as const) {
    test(`${path} logado abre direto, inclusive após refresh`, async ({ page }) => {
      await addToCart(page, '4')
      await page.goto(`/login?redirect=${path}`)
      await login(page)
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await page.reload()
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    })
  }
})
