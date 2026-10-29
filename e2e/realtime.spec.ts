import { expect, test, type Page } from '@playwright/test'
import { addToCart, login } from './helpers'

// NFT 4: Cosmic Bloom #104, 0.98 ETH, 5 em estoque.

// o mock carrega depois do load da página, então espera ele existir
async function mock<T>(page: Page, fn: string, ...args: unknown[]) {
  await page.waitForFunction(() => (window as any).__mock)
  return page.evaluate(([name, params]) => {
    const m = (window as any).__mock
    return name.split('.').reduce((obj: any, key: string) => obj[key], m)(...(params as unknown[]))
  }, [fn, args] as [string, unknown[]]) as Promise<T>
}

const orderCount = (page: Page) =>
  page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mock-db-v6') ?? '{}').orders ?? {}).length)

async function pendingOrder(page: Page) {
  await addToCart(page, '4')
  await page.goto('/login?redirect=/checkout')
  await login(page)
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/orders\//)
}

test('o cliente conecta no socket simulado', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => mock<number>(page, 'realtime.peerCount')).toBeGreaterThan(0)
})

test('mudança de preço atualiza o detalhe sem recarregar', async ({ page }) => {
  await page.goto('/nft/4')
  await expect(page.getByText('0.98 ETH')).toBeVisible()
  await expect.poll(() => mock<number>(page, 'realtime.peerCount')).toBeGreaterThan(0)

  await mock(page, 'updateNft', '4', { price: '0.50' })
  await expect(page.getByText('0.50 ETH')).toBeVisible()
})

test('carrinho aberto avisa e recalcula o resumo', async ({ page }) => {
  await addToCart(page, '4')
  await page.goto('/cart')
  const summary = page.getByRole('complementary', { name: 'Resumo da carteira' })
  await expect(summary).toContainText('0.98 ETH')
  await expect.poll(() => mock<number>(page, 'realtime.peerCount')).toBeGreaterThan(0)

  await mock(page, 'updateNft', '4', { price: '1.10' })

  await expect(page.getByText('O preço de Cosmic Bloom #104 mudou para 1.10 ETH.')).toBeVisible()
  await expect(summary).toContainText('1.1025 ETH')
})

test('esgotar durante a navegação avisa o carrinho', async ({ page }) => {
  await addToCart(page, '4')
  await page.goto('/cart')
  await expect(page.getByRole('link', { name: 'Cosmic Bloom #104' })).toBeVisible()
  await expect.poll(() => mock<number>(page, 'realtime.peerCount')).toBeGreaterThan(0)

  await mock(page, 'updateNft', '4', { stock: 0 })
  await expect(page.getByText('Cosmic Bloom #104 esgotou na edição 1/10.')).toBeVisible()
})

test('evento duplicado e evento antigo são ignorados', async ({ page }) => {
  await addToCart(page, '4')
  await page.goto('/cart')
  await expect(page.getByRole('link', { name: 'Cosmic Bloom #104' })).toBeVisible()
  await expect.poll(() => mock<number>(page, 'realtime.peerCount')).toBeGreaterThan(0)

  await mock(page, 'updateNft', '4', { price: '2.00' })
  await expect(page.getByText('mudou para 2.00 ETH')).toHaveCount(1)

  // o mesmo evento de novo (mesmo eventId) e um evento de versão mais velha
  const last = await mock<Record<string, unknown>>(page, 'realtime.lastNftEvent')
  await mock(page, 'realtime.resend', 'nft.updated', last)
  await mock(page, 'realtime.resend', 'nft.updated', { ...last, eventId: 'old-1', version: 1, price: '0.10' })

  // dá tempo de o cliente processar, depois confere que nada mudou
  await page.waitForTimeout(500)
  await expect(page.getByText('mudou para 2.00 ETH')).toHaveCount(1)
  await expect(page.getByText('mudou para 0.10 ETH')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Resumo da carteira' })).toContainText('2.0025 ETH')
})

test('resultado do pedido chega pelo socket', async ({ page }) => {
  await pendingOrder(page)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
  expect(await orderCount(page)).toBe(1)
})

test('queda do socket com pedido pendente recupera o estado sem nova compra', async ({ page }) => {
  await pendingOrder(page)

  // fica fora do ar por 4s: o evento de confirmação se perde
  await mock(page, 'realtime.pause', 4000)
  await mock(page, 'realtime.drop')

  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 15000 })
  expect(await orderCount(page)).toBe(1)
})

test('recarregar com pedido pendente retoma o mesmo pedido', async ({ page }) => {
  await pendingOrder(page)
  const url = page.url()
  await page.reload()

  await expect(page).toHaveURL(url)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
  expect(await orderCount(page)).toBe(1)
})

test('evento de pedido de outro usuário não é aplicado', async ({ page }) => {
  await pendingOrder(page)
  const orderId = page.url().split('/').pop()

  await mock(page, 'realtime.resend', 'order.updated', {
    eventId: 'other-user-1',
    orderId,
    userId: 'u2',
    version: 99,
    status: 'declined',
    txHash: null,
    declineReason: 'não deveria aparecer',
  })

  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toHaveCount(0)
})

test('relógio controlado: o pedido pendente confirma quando o tempo avança', async ({ page }) => {
  await page.clock.install()
  await pendingOrder(page)
  await expect(page.getByRole('heading', { name: 'Aguardando confirmação' })).toBeVisible()

  // em vez de esperar os 2s reais da simulação, avança o relógio da página
  await page.clock.fastForward(5000)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 4000 })
  expect(await orderCount(page)).toBe(1)
})
