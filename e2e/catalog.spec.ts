import { expect, test, type Page } from '@playwright/test'

// o catálogo é testado na largura de desktop, onde a barra de filtros fica visível
test.use({ viewport: { width: 1440, height: 900 } })

const region = (page: Page) => page.getByRole('region', { name: 'Catálogo' })
const cards = (page: Page) => region(page).getByRole('link', { name: /#\d+ .*ETH/ })
const total = (page: Page) => page.getByText(/^\d+ resultados$/)

// preço atual de cada card, na ordem da tela
async function prices(page: Page) {
  const texts = await cards(page).allInnerTexts()
  return texts.map((text) => Number(/(\d+\.\d+) ETH/.exec(text)![1]))
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(cards(page).first()).toBeVisible()
})

test('busca por nome entra na URL e filtra a lista', async ({ page }) => {
  await page.locator('#busca').fill('Emerald')
  await expect(page).toHaveURL(/q=Emerald/)
  await expect(total(page)).toHaveText('6 resultados')
  for (const text of await cards(page).allInnerTexts()) expect(text).toContain('Emerald')
})

test('busca sem resultado mostra a mensagem de vazio', async ({ page }) => {
  await page.locator('#busca').fill('zzzzzz')
  await expect(page.getByText('Nenhum NFT encontrado com esses filtros.')).toBeVisible()
  await expect(total(page)).toHaveText('0 resultados')
})

test('filtros combinados e ordenação refletem na URL e nos resultados', async ({ page }) => {
  await page.getByRole('checkbox', { name: /Arte 3D/ }).check({ force: true })
  await page.getByLabel('Ordenar por:').selectOption('price-asc')
  await expect(page).toHaveURL(/collection=/)
  await expect(page).toHaveURL(/sort=price-asc/)
  await expect(total(page)).toHaveText('5 resultados')

  const list = await prices(page)
  expect(list).toEqual([...list].sort((a, b) => a - b))

  // um segundo filtro reduz ainda mais a lista (rede Solana)
  await page.getByRole('radio', { name: /Solana/ }).check({ force: true })
  await expect(page).toHaveURL(/network=solana/)
  const count = Number((await total(page).innerText()).split(' ')[0])
  expect(count).toBeLessThan(5)
})

test('mudar um filtro volta para a página 1', async ({ page }) => {
  await page.getByRole('button', { name: 'Página 3' }).click()
  await expect(page).toHaveURL(/page=3/)

  await page.getByRole('checkbox', { name: /Música/ }).check({ force: true })
  await expect(page).toHaveURL(/page=1/)
  await expect(page.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
})

test('paginação troca os itens e entra na URL', async ({ page }) => {
  const first = (await cards(page).first().innerText()).split('\n')[0]
  await page.getByRole('button', { name: 'Página 2' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(cards(page).first()).not.toContainText(first)

  await page.getByRole('button', { name: 'Próxima página' }).click()
  await expect(page).toHaveURL(/page=3/)
})

test('as abas "Novos lançamentos" e "Em alta" mudam a lista', async ({ page }) => {
  await page.getByRole('button', { name: 'Novos lançamentos' }).click()
  await expect(page).toHaveURL(/tab=new/)
  await expect(total(page)).toHaveText('12 resultados')

  await page.getByRole('button', { name: 'Em alta' }).click()
  await expect(page).toHaveURL(/tab=trending/)
  await expect(total(page)).toHaveText('16 resultados')
})

test('voltar e avançar no histórico restauram os filtros', async ({ page }) => {
  await page.getByRole('checkbox', { name: /Música/ }).check({ force: true })
  await expect(page).toHaveURL(/collection=/)
  await page.getByLabel('Ordenar por:').selectOption('price-desc')
  await expect(page).toHaveURL(/sort=price-desc/)

  await page.goBack()
  await expect(page).not.toHaveURL(/sort=price-desc/)
  await expect(page).toHaveURL(/collection=/)
  await expect(page.getByRole('checkbox', { name: /Música/ })).toBeChecked()

  await page.goBack()
  await expect(page).not.toHaveURL(/collection=/)
  await expect(page.getByRole('checkbox', { name: /Música/ })).not.toBeChecked()

  await page.goForward()
  await expect(page).toHaveURL(/collection=/)
})

test('refresh mantém busca, filtros, ordenação e página', async ({ page }) => {
  await page.getByRole('checkbox', { name: /Jogos/ }).check({ force: true })
  await page.getByLabel('Ordenar por:').selectOption('name')
  await expect(page).toHaveURL(/sort=name/)

  await page.reload()
  await expect(cards(page).first()).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Jogos/ })).toBeChecked()
  await expect(page.getByLabel('Ordenar por:')).toHaveValue('name')
  await expect(total(page)).toHaveText('5 resultados')
})

test('clicar em um card leva ao detalhe daquele NFT', async ({ page }) => {
  await cards(page).first().click()
  await expect(page).toHaveURL(/\/nft\/\d+/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('#')
})

test('a Home tem as faixas de promoção e o Diário da Cunhagem', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Diário da Cunhagem' })).toBeVisible()
  await expect(page.getByText('Como funciona a propriedade de NFTs')).toBeVisible()
  await expect(page.getByText('12 de setembro')).toBeVisible()

  // os artigos levam a páginas fora do escopo e por isso não são links
  await expect(page.getByRole('link', { name: /Como funciona a propriedade de NFTs/ })).toHaveCount(0)

  const promo = page.getByRole('region', { name: 'Destaques' })
  await expect(promo.getByText('Lançamentos gênesis de edição limitada')).toBeVisible()
  await promo.getByRole('link', { name: 'Explorar' }).first().click()
  await expect(page).toHaveURL(/tab=new/)
})

test('os cards raros e lendários mostram o selo', async ({ page }) => {
  // só dentro dos cards (o filtro de raridade também tem as palavras, em <option>)
  await expect(region(page).getByRole('link').getByText(/^(Raro|Lendário)$/).first()).toBeVisible()
})

test('o boletim do rodapé valida o e-mail e diz que a inscrição é simulada', async ({ page }) => {
  const campo = page.getByLabel('Receber novidades')
  await campo.fill('invalido')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'e-mail válido' })).toBeVisible()

  await campo.fill('leitor@exemplo.test')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText('Inscrição simulada: nenhum e-mail será enviado.')).toBeVisible()
})

test('o rodapé deixa desabilitado o que está fora do escopo e liga o que existe', async ({ page }) => {
  const footer = page.getByRole('contentinfo')
  await expect(footer.getByText('Como comprar NFTs')).toHaveAttribute('aria-disabled', 'true')
  await expect(footer.getByRole('link', { name: 'Lista de interesse' })).toHaveAttribute('href', '/favorites')
  await expect(footer.getByText('© 2026 Kurio. Propriedade digital para todos.')).toBeVisible()
})
