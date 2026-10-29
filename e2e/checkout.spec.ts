import { expect, test, type Page } from '@playwright/test'
import { addToCart, login } from './helpers'

// NFT 4: 0.98 ETH, 5 em estoque. Taxas: ethereum 0.0025, arbitrum 0.001.

async function startCheckout(page: Page) {
  await addToCart(page, '4')
  await page.goto('/login?redirect=/checkout')
  await login(page)
  await expect(page).toHaveURL('/checkout')
}

async function connectAndReview(page: Page) {
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
}

const orderCount = (page: Page) =>
  page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mock-db-v5') ?? '{}').orders ?? {}).length)

test('checkout exige login e volta depois', async ({ page }) => {
  await page.goto('/checkout')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
})

test('compra completa até o recibo confirmado', async ({ page }) => {
  await startCheckout(page)
  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('0.9825 ETH')).toBeVisible()
  await expect(page.getByText(/^0x[0-9a-f]{64}$/)).toBeVisible()

  // só o que foi comprado sai do carrinho
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
})

test('carteira secundária recusa a conexão e bloqueia a revisão', async ({ page }) => {
  await startCheckout(page)
  await page.getByLabel(/Carteira secundária/).check()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByRole('alert')).toContainText('A carteira recusou a conexão')

  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toHaveCount(0)
})

test('pagamento recusado mantém os itens no carrinho', async ({ page }) => {
  await startCheckout(page)
  await page.getByLabel('Rede').selectOption('arbitrum')
  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 10000 })
  await page.goto('/cart')
  await expect(page.getByRole('link', { name: 'Cosmic Bloom #104' })).toBeVisible()
})

test('clique repetido não duplica o pedido', async ({ page }) => {
  await startCheckout(page)
  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).dblclick()

  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
  expect(await orderCount(page)).toBe(1)
})

test('preço alterado exige nova confirmação', async ({ page }) => {
  await startCheckout(page)
  await connectAndReview(page)

  // muda o preço no mock sem passar pela interface; o aviso chega pelo socket
  await page.evaluate(() => (window as any).__mock.updateNft('4', { price: '1.10' }))

  await expect(page.getByRole('alert')).toContainText('Os valores mudaram')
  await expect(page.getByRole('alert')).toContainText('1.1025 ETH')
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
  expect(await orderCount(page)).toBe(0)

  await page.getByRole('button', { name: 'Aceitar novo valor' }).click()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
})

test('servidor também recusa cotação velha se o socket não avisou', async ({ page }) => {
  await startCheckout(page)
  await connectAndReview(page)

  // altera o preço direto no estado, sem emitir evento
  await page.evaluate(() => {
    const mock = (window as any).__mock
    mock.db.nfts.find((nft: { id: string }) => nft.id === '4').price = '1.10'
  })

  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('alert')).toContainText('Os valores mudaram')
  expect(await orderCount(page)).toBe(0)
})

test('edição esgotada durante a compra impede o pedido', async ({ page }) => {
  await startCheckout(page)
  await connectAndReview(page)

  await page.evaluate(() => {
    const mock = (window as any).__mock
    const nft = mock.db.nfts.find((item: { id: string }) => item.id === '4')
    nft.editions.forEach((edition: { stock: number }) => (edition.stock = 0))
  })

  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('alert')).toContainText('não está mais disponível')
  expect(await orderCount(page)).toBe(0)
})

test('timeout depois de criar o pedido recupera o mesmo pedido', async ({ page }) => {
  test.setTimeout(60000)
  await page.addInitScript(() => localStorage.setItem('mock-scenario', 'order-timeout'))
  await startCheckout(page)
  await connectAndReview(page)

  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  // o pedido é criado e confirmado no servidor, mas a resposta nunca chega;
  // o carrinho esvazia e o checkout oferece recuperar o pedido
  await expect(page.getByRole('heading', { name: 'Há um pedido em andamento' })).toBeVisible({ timeout: 15000 })
  expect(await orderCount(page)).toBe(1)

  await page.getByRole('button', { name: 'Recuperar pedido' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 15000 })
  expect(await orderCount(page)).toBe(1)
})

test('a compra baixa só o estoque da edição comprada', async ({ page }) => {
  await startCheckout(page)
  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('1 × Cosmic Bloom #104 (1/10)')).toBeVisible()

  // a edição 1/10 tinha 2 e agora tem 1; as demais continuam como estavam
  await page.goto('/nft/4')
  await expect(page.getByText('1 disponível nesta edição.')).toBeVisible()
  await page.getByRole('radio', { name: 'ABERTA' }).click()
  await expect(page.getByText('4 disponíveis nesta edição.')).toBeVisible()
})
