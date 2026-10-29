import { expect, test } from '@playwright/test'
import { addToCart, login, loginAs, registerUser } from './helpers'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('cadastro e login', () => {
  test('cria a conta, entra e mantém a sessão após refresh', async ({ page }) => {
    await page.goto('/register')
    await registerUser(page, 'Marina Teste', 'marina@exemplo.test')

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: /Marina Teste|Perfil/ })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  })

  test('e-mail já cadastrado vira erro no campo', async ({ page }) => {
    await page.goto('/register')
    await registerUser(page, 'Outra Ana', 'ana@greenmint.test')

    await expect(page.getByText('Este e-mail já está cadastrado')).toBeVisible()
    await expect(page.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
    await expect(page).toHaveURL('/register')
  })

  test('valida os campos antes de enviar', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Nome completo').fill('A')
    await page.getByLabel('E-mail').fill('invalido')
    await page.getByLabel('Senha', { exact: true }).fill('curta')
    await page.getByLabel('Confirmar senha').fill('outra')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByText('Informe seu nome completo')).toBeVisible()
    await expect(page.getByText('Digite um e-mail válido')).toBeVisible()
    await expect(page.getByText('A senha precisa ter ao menos 8 caracteres')).toBeVisible()
    await expect(page.getByText('As senhas não são iguais')).toBeVisible()
  })

  test('itens do visitante vão para a conta nova', async ({ page }) => {
    await addToCart(page, '4')
    await page.goto('/register?redirect=/cart')
    await registerUser(page, 'Marina Teste', 'marina@exemplo.test')

    await expect(page).toHaveURL('/cart')
    await expect(page.getByRole('link', { name: 'Cosmic Bloom #104' })).toBeVisible()
  })

  test('senha errada mostra erro e não entra', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, 'ana@greenmint.test', 'senha-errada')
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos')
    await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0)
  })
})

test.describe('sessão', () => {
  test('troca de usuário não mostra dados privados do anterior', async ({ page }) => {
    await page.goto('/login?redirect=/nft/5')
    await login(page)
    await page.getByRole('button', { name: 'Favoritar', pressed: false }).click()
    await expect(page.getByRole('button', { name: 'Favoritar', pressed: true })).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Favoritar', pressed: false })).toBeVisible()

    await page.goto('/login?redirect=/nft/5')
    await loginAs(page, 'bruno@greenmint.test', 'senha123')
    await expect(page).toHaveURL('/nft/5')
    await expect(page.getByRole('button', { name: 'Favoritar', pressed: false })).toBeVisible()
  })

  test('sessão expirada ao abrir uma tela privada volta ao login', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('token', 'token-expirado'))

    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
  })

  test('sessão expirada no checkout preserva o formulário', async ({ page }) => {
    await addToCart(page, '4')
    await page.goto('/login?redirect=/checkout')
    await login(page)
    await expect(page).toHaveURL('/checkout')

    await page.getByLabel('Nome completo').fill('Maria Retomada')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByText('Conectada')).toBeVisible()

    // a sessão vence antes de revisar
    await page.evaluate(() => localStorage.setItem('token', 'token-expirado'))
    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await page.getByRole('button', { name: 'Confirmar compra' }).click({ timeout: 3000 }).catch(() => {})

    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
    await loginAs(page, 'ana@greenmint.test', 'senha123')

    await expect(page).toHaveURL('/checkout')
    await expect(page.getByLabel('Nome completo')).toHaveValue('Maria Retomada')
  })
})

test.describe('perfil', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login?redirect=/profile')
    await login(page)
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  })

  test('edita os dados e eles persistem após refresh', async ({ page }) => {
    await page.getByLabel('Nome completo').fill('Ana Maria Souza')
    await page.getByRole('button', { name: 'Salvar dados' }).click()
    await expect(page.getByText('Dados salvos.')).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Nome completo')).toHaveValue('Ana Maria Souza')
  })

  test('e-mail em uso mostra o erro da API e desfaz o nome otimista', async ({ page }) => {
    await page.getByLabel('Nome completo').fill('Nome Que Não Vale')
    await page.getByLabel('E-mail').fill('bruno@greenmint.test')
    await page.getByRole('button', { name: 'Salvar dados' }).click()

    await expect(page.getByText('Este e-mail já está em uso')).toBeVisible()
    await expect(page.getByRole('banner').getByText('Nome Que Não Vale')).toHaveCount(0)
  })

  test('valida e-mail e nome antes de enviar', async ({ page }) => {
    await page.getByLabel('Nome completo').fill('')
    await page.getByLabel('E-mail').fill('invalido')
    await page.getByRole('button', { name: 'Salvar dados' }).click()
    await expect(page.getByText('Informe seu nome completo')).toBeVisible()
    await expect(page.getByText('Digite um e-mail válido')).toBeVisible()
  })

  test('envia o avatar e ele persiste', async ({ page }) => {
    await page.locator('input[type=file]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('img', { name: 'Avatar de Ana Souza' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('img', { name: 'Avatar de Ana Souza' })).toBeVisible()

    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByRole('img', { name: 'Avatar de Ana Souza' })).toHaveCount(0)
  })

  test('recusa arquivo que não é imagem', async ({ page }) => {
    await page.locator('input[type=file]').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(page.getByRole('alert')).toContainText('Use uma imagem PNG, JPG ou WebP')
  })

  test('altera a senha e entra com a nova', async ({ page }) => {
    await page.getByLabel('Senha atual').fill('errada123')
    await page.getByLabel('Nova senha', { exact: true }).fill('novasenha1')
    await page.getByLabel('Confirmar nova senha').fill('novasenha1')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha atual incorreta')).toBeVisible()

    await page.getByLabel('Senha atual').fill('senha123')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha alterada.')).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await page.goto('/login')
    await loginAs(page, 'ana@greenmint.test', 'senha123')
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos')

    await loginAs(page, 'ana@greenmint.test', 'novasenha1')
    await expect(page).toHaveURL('/')
  })

  test('confirmação diferente da nova senha é recusada no cliente', async ({ page }) => {
    await page.getByLabel('Senha atual').fill('senha123')
    await page.getByLabel('Nova senha', { exact: true }).fill('novasenha1')
    await page.getByLabel('Confirmar nova senha').fill('diferente1')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('As senhas não são iguais')).toBeVisible()
  })
})

test.describe('carteiras', () => {
  test('edita a carteira principal e persiste', async ({ page }) => {
    await page.goto('/login?redirect=/wallets')
    await login(page)

    const principal = page.getByRole('form', { name: 'Carteira principal' })
    await expect(principal.getByLabel('Nome da carteira')).toHaveValue('Carteira principal')

    await principal.getByLabel('Nome da carteira').fill('Minha principal')
    await principal.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(principal.getByText('Carteira salva.')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira principal' }).getByLabel('Nome da carteira')).toHaveValue('Minha principal')
  })

  test('endereço inválido mostra erro', async ({ page }) => {
    await page.goto('/login?redirect=/wallets')
    await login(page)

    const principal = page.getByRole('form', { name: 'Carteira principal' })
    await principal.getByLabel('Endereço').fill('0x123')
    await principal.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(principal.getByText(/Endereço inválido/)).toBeVisible()
  })

  test('conta nova cadastra as duas carteiras e recusa endereço repetido', async ({ page }) => {
    await page.goto('/register?redirect=/wallets')
    await registerUser(page, 'Marina Teste', 'marina@exemplo.test')
    await expect(page).toHaveURL('/wallets')

    const principal = page.getByRole('form', { name: 'Carteira principal' })
    const secundaria = page.getByRole('form', { name: 'Carteira secundária' })
    const address = '0x1111111111111111111111111111111111111111'

    await principal.getByLabel('Nome da carteira').fill('Principal')
    await principal.getByLabel('Endereço').fill(address)
    await principal.getByRole('button', { name: 'Cadastrar carteira' }).click()
    await expect(principal.getByText('Carteira cadastrada.')).toBeVisible()

    await secundaria.getByLabel('Nome da carteira').fill('Secundária')
    await secundaria.getByLabel('Endereço').fill(address)
    await secundaria.getByRole('button', { name: 'Cadastrar carteira' }).click()
    await expect(secundaria.getByText('Este endereço já está cadastrado')).toBeVisible()
  })

  test('tela de carteiras exige login', async ({ page }) => {
    await page.goto('/wallets')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fwallets/)
  })
})
