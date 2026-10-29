import type { Page } from '@playwright/test'

export async function login(page: Page) {
  await page.getByLabel('E-mail').fill('ana@greenmint.test')
  await page.getByLabel('Senha').fill('senha123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()
}

export async function addToCart(page: Page, nftId: string, quantity = 1) {
  await page.goto(`/nft/${nftId}`)
  for (let i = 1; i < quantity; i++) {
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  }
  await page.getByRole('button', { name: 'COMPRAR' }).click()
  await page.getByText('Adicionado ao carrinho.').waitFor()
}

export async function loginAs(page: Page, email: string, password: string) {
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()
}

export async function registerUser(page: Page, name: string, email: string, password = 'senha-segura-1') {
  await page.getByLabel('Nome completo').fill(name)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByLabel('Confirmar senha').fill(password)
  await page.getByRole('button', { name: 'Criar conta' }).click()
}
