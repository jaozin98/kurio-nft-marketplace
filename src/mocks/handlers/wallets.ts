import { delay, http, HttpResponse } from 'msw'
import { validateWallet } from '@/lib/validation'
import type { Wallet, WalletInput, WalletsResponse } from '@/types'
import { db, save, walletsOf } from '../db'
import { conflict, getUser, invalid, unauthorized } from './auth'

function view(userId: string): WalletsResponse {
  return { wallets: walletsOf(userId), connectedId: db.connections[userId] ?? null }
}

// só os campos da carteira; o resto da requisição é ignorado
function pick(body: Partial<WalletInput>): WalletInput {
  return {
    nickname: String(body.nickname ?? '').trim(),
    displayName: String(body.displayName ?? '').trim(),
    profileName: String(body.profileName ?? '').trim(),
    network: body.network as WalletInput['network'],
    address: String(body.address ?? '').trim(),
    altAddress: String(body.altAddress ?? '').trim(),
    provider: body.provider as WalletInput['provider'],
    referralCode: String(body.referralCode ?? '').trim(),
    email: String(body.email ?? '').trim(),
    ens: String(body.ens ?? '').trim(),
  }
}

export const walletHandlers = [
  // cada conta tem no máximo uma carteira principal e uma secundária
  http.post('/api/wallets', async ({ request }) => {
    await delay(350)
    const user = getUser(request)
    if (!user) return unauthorized()

    const body = (await request.json()) as Partial<WalletInput> & { primary: boolean }
    const input = pick(body)
    const errors = validateWallet(input)
    if (Object.keys(errors).length) return invalid(errors)

    const wallets = walletsOf(user.id)
    if (wallets.some((item) => item.primary === !!body.primary)) {
      return conflict('nickname', `Já existe uma carteira ${body.primary ? 'principal' : 'secundária'}`)
    }
    if (wallets.some((item) => item.address.toLowerCase() === input.address.toLowerCase())) {
      return conflict('address', 'Este endereço já está cadastrado')
    }

    const wallet: Wallet = {
      ...input,
      id: `${user.id}-${body.primary ? 'w1' : 'w2'}`,
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

    const input = pick((await request.json()) as Partial<WalletInput>)
    const errors = validateWallet(input)
    if (Object.keys(errors).length) return invalid(errors)

    if (wallets.some((item) => item.id !== wallet.id && item.address.toLowerCase() === input.address.toLowerCase())) {
      return conflict('address', 'Este endereço já está cadastrado')
    }

    // trocar o endereço invalida a conexão que estava aberta
    if (wallet.address.toLowerCase() !== input.address.toLowerCase() && db.connections[user.id] === wallet.id) {
      db.connections[user.id] = null
    }
    Object.assign(wallet, input)
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
