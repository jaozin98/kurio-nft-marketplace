import { delay, http, HttpResponse } from 'msw'
import { fromUnits, toUnits } from '@/lib/eth'
import { editionOf } from '@/lib/nft'
import type { Cart, NetworkId } from '@/types'
import { coupons } from '../data'
import { db, save, type CartData } from '../db'
import { getUser, unauthorized } from './auth'

export const networkFees: Record<NetworkId, bigint> = {
  ethereum: toUnits('0.0025'),
  polygon: toUnits('0.0005'),
  arbitrum: toUnits('0.001'),
}

// logado usa o id do usuário; visitante usa o id guardado no navegador
function ownerOf(request: Request) {
  const user = getUser(request)
  return user ? user.id : guestOf(request)
}

function guestOf(request: Request) {
  return `guest-${request.headers.get('x-guest-id') ?? 'anon'}`
}

// o item do carrinho é identificado por "nft|edição"
export const itemKey = (nftId: string, editionId: string) => `${nftId}|${editionId}`

export function cartOf(owner: string): CartData {
  return (db.carts[owner] ??= { items: {}, coupon: null })
}

// todos os valores são calculados aqui, com bigint, e o front só exibe
export function buildCart(owner: string, network: NetworkId = 'ethereum'): Cart {
  const data = cartOf(owner)

  const items = Object.entries(data.items).flatMap(([key, quantity]) => {
    const [nftId, editionId] = key.split('|')
    const nft = db.nfts.find((item) => item.id === nftId)
    return nft && editionOf(nft, editionId) ? [{ nft, editionId, quantity }] : []
  })

  const subtotal = items.reduce(
    (sum, { nft, quantity }) => sum + toUnits(nft.price) * BigInt(quantity),
    0n,
  )
  const percent = data.coupon ? (coupons[data.coupon]?.percent ?? 0) : 0
  const discount = (subtotal * BigInt(percent)) / 100n
  const networkFee = items.length ? networkFees[network] : 0n

  return {
    items,
    coupon: data.coupon,
    quote: {
      subtotal: fromUnits(subtotal),
      discount: fromUnits(discount),
      networkFee: fromUnits(networkFee),
      total: fromUnits(subtotal - discount + networkFee),
    },
  }
}

const notFound = (message: string) => HttpResponse.json({ message }, { status: 404 })
const unitsLeft = (stock: number) => `Só há ${stock} unidade(s) disponível(is) nesta edição`
const conflict = (message: string) => HttpResponse.json({ message }, { status: 409 })

export const cartHandlers = [
  http.get('/api/cart', async ({ request }) => {
    await delay(200)
    return HttpResponse.json(buildCart(ownerOf(request)))
  }),

  // cotação para o checkout: mesmo carrinho, taxa da rede escolhida
  http.post('/api/quote', async ({ request }) => {
    await delay(250)
    const user = getUser(request)
    if (!user) return unauthorized()
    const { network } = (await request.json()) as { network: NetworkId }
    if (!(network in networkFees)) {
      return HttpResponse.json({ message: 'Rede inválida' }, { status: 422 })
    }
    return HttpResponse.json(buildCart(user.id, network))
  }),

  http.post('/api/cart/items', async ({ request }) => {
    await delay(300)
    const owner = ownerOf(request)
    const { nftId, editionId, quantity } = (await request.json()) as {
      nftId: string
      editionId: string
      quantity: number
    }

    const nft = db.nfts.find((item) => item.id === nftId)
    if (!nft) return notFound('NFT não encontrado')
    const edition = editionOf(nft, editionId)
    if (!edition) return notFound('Edição não encontrada')
    if (!Number.isInteger(quantity) || quantity < 1) {
      return HttpResponse.json({ message: 'Quantidade inválida' }, { status: 422 })
    }

    const cart = cartOf(owner)
    const key = itemKey(nftId, editionId)
    const total = (cart.items[key] ?? 0) + quantity
    if (total > edition.stock) return conflict(unitsLeft(edition.stock))

    cart.items[key] = total
    save()
    return HttpResponse.json(buildCart(owner))
  }),

  http.patch('/api/cart/items/:nftId/:editionId', async ({ request, params }) => {
    await delay(250)
    const owner = ownerOf(request)
    const key = itemKey(String(params.nftId), String(params.editionId))
    const { quantity } = (await request.json()) as { quantity: number }

    const nft = db.nfts.find((item) => item.id === params.nftId)
    const edition = nft && editionOf(nft, String(params.editionId))
    const cart = cartOf(owner)
    if (!edition || !(key in cart.items)) return notFound('Item não está no carrinho')
    if (!Number.isInteger(quantity) || quantity < 1) {
      return HttpResponse.json({ message: 'Quantidade inválida' }, { status: 422 })
    }
    if (quantity > edition.stock) return conflict(unitsLeft(edition.stock))

    cart.items[key] = quantity
    save()
    return HttpResponse.json(buildCart(owner))
  }),

  http.delete('/api/cart/items/:nftId/:editionId', async ({ request, params }) => {
    await delay(250)
    const owner = ownerOf(request)
    const cart = cartOf(owner)
    delete cart.items[itemKey(String(params.nftId), String(params.editionId))]
    if (Object.keys(cart.items).length === 0) cart.coupon = null
    save()
    return HttpResponse.json(buildCart(owner))
  }),

  http.post('/api/cart/coupon', async ({ request }) => {
    await delay(300)
    const owner = ownerOf(request)
    const { code } = (await request.json()) as { code: string }
    const normalized = code.trim().toUpperCase()
    const coupon = coupons[normalized]

    if (!coupon) return notFound('Cupom inválido')
    if (coupon.expired) return HttpResponse.json({ message: 'Cupom expirado' }, { status: 410 })

    cartOf(owner).coupon = normalized
    save()
    return HttpResponse.json(buildCart(owner))
  }),

  http.delete('/api/cart/coupon', async ({ request }) => {
    await delay(200)
    const owner = ownerOf(request)
    cartOf(owner).coupon = null
    save()
    return HttpResponse.json(buildCart(owner))
  }),

  // chamado logo após o login: traz os itens do visitante para a conta
  http.post('/api/cart/merge', async ({ request }) => {
    await delay(200)
    const user = getUser(request)
    if (!user) return unauthorized()

    const guestId = guestOf(request)
    const guest = db.carts[guestId]
    const mine = cartOf(user.id)

    if (guest) {
      for (const [key, quantity] of Object.entries(guest.items)) {
        const [nftId, editionId] = key.split('|')
        const nft = db.nfts.find((item) => item.id === nftId)
        const edition = nft && editionOf(nft, editionId)
        if (!edition) continue
        mine.items[key] = Math.min(edition.stock, (mine.items[key] ?? 0) + quantity)
      }
      delete db.carts[guestId]
      save()
    }
    return HttpResponse.json(buildCart(user.id))
  }),
]
