import { delay, http, HttpResponse } from 'msw'
import { save } from '../db'
import { sha256 } from '../hash'
import {
  conflict,
  emailPattern,
  emailTaken,
  getUser,
  invalid,
  publicUser,
  unauthorized,
} from './auth'

const MAX_AVATAR_BYTES = 150_000
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export const profileHandlers = [
  http.get('/api/profile', async ({ request }) => {
    await delay(150)
    const account = getUser(request)
    if (!account) return unauthorized()
    return HttpResponse.json(publicUser(account))
  }),

  http.patch('/api/profile', async ({ request }) => {
    await delay(300)
    const account = getUser(request)
    if (!account) return unauthorized()

    const body = (await request.json()) as { name: string; email: string }
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim()

    const errors: Record<string, string> = {}
    if (name.length < 2) errors.name = 'Informe seu nome completo'
    if (!emailPattern.test(email)) errors.email = 'Digite um e-mail válido'
    if (Object.keys(errors).length) return invalid(errors)

    if (emailTaken(email, account.id)) return conflict('email', 'Este e-mail já está em uso')

    account.name = name
    account.email = email
    save()
    return HttpResponse.json(publicUser(account))
  }),

  // a imagem chega como data URL já validada de forma simples pelo tipo e tamanho
  http.put('/api/profile/avatar', async ({ request }) => {
    await delay(400)
    const account = getUser(request)
    if (!account) return unauthorized()

    const { image } = (await request.json()) as { image: string }
    const type = /^data:([\w/+.-]+);base64,/.exec(image ?? '')?.[1]

    if (!type || !AVATAR_TYPES.includes(type)) {
      return invalid({ avatar: 'Use uma imagem PNG, JPG ou WebP' })
    }
    // 4 caracteres base64 carregam 3 bytes
    if (Math.ceil((image.length * 3) / 4) > MAX_AVATAR_BYTES) {
      return HttpResponse.json(
        { code: 'too_large', message: 'A imagem passa de 150 KB', errors: { avatar: 'A imagem passa de 150 KB' } },
        { status: 413 },
      )
    }

    account.avatar = image
    save()
    return HttpResponse.json(publicUser(account))
  }),

  http.delete('/api/profile/avatar', async ({ request }) => {
    await delay(250)
    const account = getUser(request)
    if (!account) return unauthorized()

    account.avatar = null
    save()
    return HttpResponse.json(publicUser(account))
  }),

  http.post('/api/profile/password', async ({ request }) => {
    await delay(400)
    const account = getUser(request)
    if (!account) return unauthorized()

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword: string
      newPassword: string
    }

    if (account.passwordHash !== (await sha256(String(currentPassword ?? '')))) {
      return HttpResponse.json(
        {
          code: 'wrong_password',
          message: 'Senha atual incorreta',
          errors: { currentPassword: 'Senha atual incorreta' },
        },
        { status: 403 },
      )
    }
    if (String(newPassword ?? '').length < 8) {
      return invalid({ newPassword: 'A nova senha precisa ter ao menos 8 caracteres' })
    }

    account.passwordHash = await sha256(newPassword)
    save()
    return HttpResponse.json({ ok: true })
  }),
]
