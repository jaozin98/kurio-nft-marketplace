import { delay, http, HttpResponse } from 'msw'
import type { User } from '@/types'
import { db, save, type Account } from '../db'
import { sha256 } from '../hash'

// o token é só "token-<id>", suficiente para o mock
export function getUser(request: Request): Account | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  return Object.values(db.accounts).find((account) => `token-${account.id}` === token) ?? null
}

export function publicUser(account: Account): User {
  const { passwordHash: _hash, ...user } = account
  return user
}

export const unauthorized = () =>
  HttpResponse.json(
    { code: 'unauthorized', message: 'Sessão inválida ou expirada' },
    { status: 401 },
  )

export const invalid = (errors: Record<string, string>) =>
  HttpResponse.json(
    { code: 'validation', message: 'Confira os dados informados', errors },
    { status: 422 },
  )

export const conflict = (field: string, message: string) =>
  HttpResponse.json({ code: 'conflict', message, errors: { [field]: message } }, { status: 409 })

export const emailPattern = /^\S+@\S+\.\S+$/

export function emailTaken(email: string, exceptId?: string) {
  return Object.values(db.accounts).some(
    (account) => account.id !== exceptId && account.email.toLowerCase() === email.toLowerCase(),
  )
}

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(400)
    const { email, password } = (await request.json()) as { email: string; password: string }
    const account = Object.values(db.accounts).find(
      (item) => item.email.toLowerCase() === String(email).toLowerCase(),
    )

    if (!account || account.passwordHash !== (await sha256(String(password)))) {
      return HttpResponse.json(
        { code: 'invalid_credentials', message: 'E-mail ou senha incorretos' },
        { status: 401 },
      )
    }
    return HttpResponse.json({ token: `token-${account.id}`, user: publicUser(account) })
  }),

  http.post('/api/auth/register', async ({ request }) => {
    await delay(500)
    const body = (await request.json()) as { name: string; email: string; password: string }
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')

    const errors: Record<string, string> = {}
    if (name.length < 2) errors.name = 'Informe seu nome completo'
    if (!emailPattern.test(email)) errors.email = 'Digite um e-mail válido'
    if (password.length < 8) errors.password = 'A senha precisa ter ao menos 8 caracteres'
    if (Object.keys(errors).length) return invalid(errors)

    if (emailTaken(email)) return conflict('email', 'Este e-mail já está cadastrado')

    const id = `u${Object.keys(db.accounts).length + 1}`
    const account: Account = {
      id,
      name,
      email,
      avatar: null,
      passwordHash: await sha256(password),
    }
    db.accounts[id] = account
    save()

    return HttpResponse.json({ token: `token-${id}`, user: publicUser(account) }, { status: 201 })
  }),

  // o token do mock é sem estado, então sair só confirma; o cliente descarta o token
  http.post('/api/auth/logout', async () => {
    await delay(100)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/auth/me', async ({ request }) => {
    await delay(150)
    const account = getUser(request)
    if (!account) return unauthorized()
    return HttpResponse.json(publicUser(account))
  }),
]
