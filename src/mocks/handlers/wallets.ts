import { delay, http, HttpResponse } from 'msw'
import type { Wallet, WalletsResponse } from '@/types'
import { db, save, walletsOf } from '../db'
import { conflict, getUser, invalid, unauthorized } from './auth'

function view(userId: string): WalletsResponse {
  return { wallets: walletsOf(userId), connectedId: db.connections[userId] ?? null }
}

const addressPattern = /^0x[a-fA-F0-9]{40}$/

function validate(label: string, address: string) {
  const errors: Record<string, string> = {}
  if (label.length < 2 || label.length > 30) errors.label = 'Use de 2 a 30 caracteres'
  if (!addressPattern.test(address)) errors.address = 'Endereço inválido: use 0x seguido de 40 caracteres'
  return errors
}

export const walletHandlers = [
  // cada conta tem no máximo uma carteira principal e uma secundária
  http.post('/api/wallets', async ({ request }) => {
    await delay(350)
    const user = getUser(request)
    if (!user) return unauthorized()

    const body = (await request.json()) as { label: string; address: string; primary: boolean }
    const label = String(body.label ?? '').trim()
    const address = String(body.address ?? '').trim()
    const errors = validate(label, address)
    if (Object.keys(errors).length) return invalid(errors)

    const wallets = walletsOf(user.id)
    if (wallets.some((item) => item.primary === !!body.primary)) {
      return conflict('label', `Já existe uma carteira ${body.primary ? 'principal' : 'secundária'}`)
    }
    if (wallets.some((item) => item.address.toLowerCase() === address.toLowerCase())) {
      return conflict('address', 'Este endereço já está cadastrado')
    }

    const wallet: Wallet = {
      id: `${user.id}-${body.primary ? 'w1' : 'w2'}`,
      label,
      address,
      primary: !!body.primary,
    }
    wallets.push(wallet)
    save()
    return HttpResponse.json(view(user.id), { status: 201 })
  }),

  http.patch('/api/wallets/:id', async ({ request, params }) => {
    await delay(350)
    const user = getUser(request)
    if (!user) return unauthorized()

    const wallets = walletsOf(user.id)
    const wallet = wallets.find((item) => item.id === params.id)
    if (!wallet) return HttpResponse.json({ code: 'not_found', message: 'Carteira não encontrada' }, { status: 404 })

    const body = (await request.json()) as { label: string; address: string }
    const label = String(body.label ?? '').trim()
    const address = String(body.address ?? '').trim()
    const errors = validate(label, address)
    if (Object.keys(errors).length) return invalid(errors)

    if (wallets.some((item) => item.id !== wallet.id && item.address.toLowerCase() === address.toLowerCase())) {
      return conflict('address', 'Este endereço já está cadastrado')
    }

    // trocar o endereço invalida a conexão que estava aberta
    if (wallet.address.toLowerCase() !== address.toLowerCase() && db.connections[user.id] === wallet.id) {
      db.connections[user.id] = null
    }
    wallet.label = label
    wallet.address = address
    save()
    return HttpResponse.json(view(user.id))
  }),

  http.get('/api/wallets', async ({ request }) => {
    await delay(200)
    const user = getUser(request)
    if (!user) return unauthorized()
    return HttpResponse.json(view(user.id))
  }),

  // simula a extensão da carteira pedindo aprovação
  http.post('/api/wallets/:id/connect', async ({ request, params }) => {
    await delay(700)
    const user = getUser(request)
    if (!user) return unauthorized()

    const wallet = walletsOf(user.id).find((item) => item.id === params.id)
    if (!wallet) {
      return HttpResponse.json({ message: 'Carteira não encontrada' }, { status: 404 })
    }
    if (wallet.address.toLowerCase().endsWith('dead')) {
      return HttpResponse.json({ message: 'A carteira recusou a conexão' }, { status: 403 })
    }

    db.connections[user.id] = wallet.id
    save()
    return HttpResponse.json(view(user.id))
  }),

  http.post('/api/wallets/disconnect', async ({ request }) => {
    await delay(200)
    const user = getUser(request)
    if (!user) return unauthorized()

    db.connections[user.id] = null
    save()
    return HttpResponse.json(view(user.id))
  }),
]
