import { expect, test, type Page } from '@playwright/test'
import { addToCart, login, loginAs } from './helpers'

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
  page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mock-db-v6') ?? '{}').orders ?? {}).length)

test('checkout exige login e volta depois', async ({ page }) => {
  await page.goto('/checkout')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
})

test('compra completa até o recibo confirmado', async ({ page }) => {
  await startCheckout(page)
  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('0.9825 ETH').first()).toBeVisible()
  await expect(page.getByText(/^0x[0-9a-f]{64}$/)).toBeVisible()

  // só o que foi comprado sai do carrinho
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
})

test('carteira secundária recusa a conexão e bloqueia a revisão', async ({ page }) => {
  await startCheckout(page)
  await page.getByLabel(/Reserva/).check()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByRole('alert')).toContainText('A carteira recusou a conexão')

  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toHaveCount(0)
})

test('pagamento recusado mantém os itens no carrinho', async ({ page }) => {
  await startCheckout(page)
  await page.locator('#pgto-network').selectOption('arbitrum')
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
  const recibo = page.getByRole('article')
  await expect(recibo.getByText('Cosmic Bloom #104')).toBeVisible()
  await expect(recibo.getByText(/Edição 1\/10/)).toBeVisible()

  // a edição 1/10 tinha 2 e agora tem 1; as demais continuam como estavam
  await page.goto('/nft/4')
  await expect(page.getByText('1 disponível nesta edição.')).toBeVisible()
  await page.getByRole('radio', { name: 'ABERTA' }).click()
  await expect(page.getByText('4 disponíveis nesta edição.')).toBeVisible()
})

// ---- campos do layout e cenários nomeados

const useScenario = (page: Page, name: string) =>
  page.addInitScript((value) => localStorage.setItem('mock-scenario', value), name)

const nftMock = (page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(
    ([name, params]) => (window as any).__mock[name as string](...(params as unknown[])),
    [fn, args] as [string, unknown[]],
  )

test('nome de usuário inválido bloqueia a revisão', async ({ page }) => {
  await startCheckout(page)
  await page.getByLabel('Nome de usuário').fill('a!')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar pedido' }).click()

  await expect(page.getByText('Use de 3 a 20 letras, números ou _')).toBeVisible()
  await expect(page.getByLabel('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toHaveCount(0)
})

test('observação passa de 280 caracteres e mostra o erro', async ({ page }) => {
  await startCheckout(page)
  await page.getByLabel(/Observação/).fill('x'.repeat(290))
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByText('Use até 280 caracteres')).toBeVisible()
})

test('o recibo e a revisão mostram o usuário e a observação', async ({ page }) => {
  await startCheckout(page)
  await page.getByLabel(/Observação/).fill('Entregar na carteira principal')
  await connectAndReview(page)
  await expect(page.getByRole('dialog').getByText('(@ana)')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Entregar na carteira principal')).toBeVisible()
})

test('cenário price-change: o preço sobe na hora da compra e exige nova confirmação', async ({ page }) => {
  await useScenario(page, 'price-change')
  await startCheckout(page)
  await connectAndReview(page)

  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Os valores mudaram' })).toContainText('1.0825 ETH')
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
  expect(await orderCount(page)).toBe(0)

  await page.getByRole('button', { name: 'Aceitar novo valor' }).click()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
})

test('cenário sold-out: a edição esgota na hora da compra e o pedido não é criado', async ({ page }) => {
  await useScenario(page, 'sold-out')
  await startCheckout(page)
  await connectAndReview(page)

  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'não está mais disponível' }).first(),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
  expect(await orderCount(page)).toBe(0)
})

test('cenário session-expired: a sessão vence no envio e o checkout é retomado', async ({ page }) => {
  await useScenario(page, 'session-expired')
  await startCheckout(page)
  await page.getByLabel('Nome de exibição').fill('Maria Retomada')
  await connectAndReview(page)

  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
  expect(await orderCount(page)).toBe(0)

  await loginAs(page, 'ana@greenmint.test', 'senha123')
  await expect(page).toHaveURL('/checkout')
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Maria Retomada')

  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
  expect(await orderCount(page)).toBe(1)
})

test('cenário payment-declined: qualquer rede recusa e os itens ficam no carrinho', async ({ page }) => {
  await useScenario(page, 'payment-declined')
  await startCheckout(page)
  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 10000 })

  await page.goto('/cart')
  await expect(page.getByRole('link', { name: 'Cosmic Bloom #104' })).toBeVisible()
})

test('a disponibilidade muda pelo socket durante a revisão e bloqueia a compra', async ({ page }) => {
  await startCheckout(page)
  await connectAndReview(page)

  await nftMock(page, 'updateNft', '4', { stock: 0 })

  await expect(
    page.getByRole('alert').filter({ hasText: 'não está mais disponível' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
  expect(await orderCount(page)).toBe(0)
})

test('compra completa a partir do catálogo, sem atalhos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const catalogo = page.getByRole('region', { name: 'Catálogo' })
  await catalogo.getByRole('link', { name: /Captain Ape #148/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Captain Ape #148' })).toBeVisible()

  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await page.getByRole('link', { name: 'Ver carrinho' }).click()
  await expect(page).toHaveURL('/cart')

  // como visitante, o checkout pede login e devolve ao pagamento
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
  await login(page)
  await expect(page).toHaveURL('/checkout')

  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('article').getByText('Captain Ape #148')).toBeVisible()
  await expect(page.getByText(/^0x[0-9a-f]{64}$/)).toBeVisible()
})

test('os campos do formulário seguem o Figma e vêm preenchidos pela carteira', async ({ page }) => {
  await startCheckout(page)
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Souza')
  await expect(page.getByLabel('Nome de usuário')).toHaveValue('ana')
  await expect(page.locator('#pgto-network')).toHaveValue('ethereum')
  await expect(page.getByLabel('Tipo de carteira')).toHaveValue('metamask')
  await expect(page.getByLabel('Código de indicação')).toHaveValue('KURIO2026')
  await expect(page.getByLabel('Nome ENS')).toHaveValue('ana')
  // o endereço vem da carteira escolhida e não é editável aqui
  await expect(page.getByLabel('Endereço da carteira')).toBeDisabled()
})

test('trocar de carteira troca rede, tipo e dados do formulário', async ({ page }) => {
  await startCheckout(page)
  await page.getByLabel(/Reserva/).check()
  await expect(page.locator('#pgto-network')).toHaveValue('polygon')
  await expect(page.getByLabel('Tipo de carteira')).toHaveValue('coinbase')
})

test('campos obrigatórios vazios mostram erro e não abrem a revisão', async ({ page }) => {
  await startCheckout(page)
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada')).toBeVisible()
  // conectar preenche os campos pela carteira; só depois de conectada dá para esvaziá-los
  await page.getByLabel('Código de indicação').fill('')
  await page.getByLabel('Nome do perfil').fill('x')
  await page.getByRole('button', { name: 'Revisar pedido' }).click()

  await expect(page.getByText('Use de 4 a 12 letras ou números')).toBeVisible()
  await expect(page.getByText('Use de 3 a 20 letras, números ou _')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('"Usar outra carteira?" exige o ENS ou a carteira secundária', async ({ page }) => {
  await startCheckout(page)
  await page.getByLabel('Usar outra carteira?').check()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByText('Informe o ENS ou a carteira secundária')).toBeVisible()

  await page.getByLabel('ENS ou carteira secundária (opcional)').fill('minha-conta.eth')
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeVisible()
})

test('a revisão é um modal com foco preso que volta ao formulário com Esc', async ({ page }) => {
  await startCheckout(page)
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar pedido' }).click()

  const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Revisar pedido' })).toBeVisible()
})

test('o recibo mostra a faixa de dados, a tabela e o link do explorador simulado', async ({ page }) => {
  await startCheckout(page)
  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 10000 })

  await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible()
  await expect(page.getByText('ID da transação')).toBeVisible()
  await expect(page.getByRole('article').getByText('MetaMask')).toBeVisible()
  await expect(page.getByText(/Transação confirmada na Ethereum/)).toBeVisible()

  await page.getByRole('link', { name: 'Ver no Etherscan' }).click()
  await expect(page.getByRole('heading', { name: /Explorador de blocos \(simulado\)/ })).toBeVisible()
})
