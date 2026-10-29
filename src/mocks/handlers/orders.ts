import { delay, http, HttpResponse } from 'msw'
import { editionOf } from '@/lib/nft'
import type { NetworkId, Order, OrderRequest } from '@/types'
import { db, save, walletsOf, type OrderRecord } from '../db'
import { emitNftUpdated, emitOrderUpdated } from '../realtime'
import { currentScenario } from '../scenario'
import { getUser, unauthorized } from './auth'
import { buildCart, cartOf, itemKey, networkFees } from './cart'

// a rede arbitrum sempre recusa o pagamento (cenário fixo)
const DECLINING_NETWORK: NetworkId = 'arbitrum'
const CONFIRM_AFTER_MS = 2000

function fail(status: number, code: string, message: string, extra?: object) {
  return HttpResponse.json({ code, message, ...extra }, { status })
}

// confirma ou recusa quando o prazo da simulação passa
function settle(record: OrderRecord) {
  const { order } = record
  if (order.status !== 'pending' || Date.now() < record.resolveAt) return

  if (record.outcome === 'declined') {
    order.status = 'declined'
    order.declineReason = 'Pagamento recusado pela rede'
    order.version += 1
  } else {
    order.status = 'confirmed'
    order.version += 1
    order.txHash = `0x${record.order.id.replace(/\D/g, '').padEnd(64, 'a').slice(0, 64)}`

    const cart = cartOf(record.userId)
    for (const item of order.items) {
      const key = itemKey(item.nftId, item.editionId)
      db.sold[key] = (db.sold[key] ?? 0) + item.quantity

      const nft = db.nfts.find((entry) => entry.id === item.nftId)
      const edition = nft && editionOf(nft, item.editionId)
      if (nft && edition) {
        edition.stock = Math.max(0, edition.stock - item.quantity)
        nft.version += 1
      }

      // tira do carrinho só o que foi comprado
      const left = (cart.items[key] ?? 0) - item.quantity
      if (left > 0) cart.items[key] = left
      else delete cart.items[key]
    }
    if (Object.keys(cart.items).length === 0) cart.coupon = null
  }
  save()

  // avisa o dono do pedido e quem está vendo os NFTs que mudaram de estoque
  emitOrderUpdated(order, record.userId)
  if (order.status === 'confirmed') {
    for (const item of order.items) {
      const nft = db.nfts.find((entry) => entry.id === item.nftId)
      if (nft) emitNftUpdated(nft)
    }
  }
}

// depois de um refresh os timers somem: reagenda os pedidos que ainda estão pendentes
for (const record of Object.values(db.orders)) {
  if (record.order.status === 'pending') {
    setTimeout(() => settle(record), Math.max(0, record.resolveAt - Date.now()))
  }
}

export const orderHandlers = [
  http.post('/api/orders', async ({ request }) => {
    await delay(400)
    const user = getUser(request)
    if (!user) return unauthorized()

    const key = request.headers.get('idempotency-key')
    if (!key) return fail(400, 'missing_key', 'Chave de idempotência obrigatória')

    const body = (await request.json()) as OrderRequest
    const hash = JSON.stringify(body)
    const slot = `${user.id}:${key}`

    // mesma chave: devolve o pedido já criado, ou conflito se o conteúdo mudou
    const previous = db.idempotency[slot]
    if (previous) {
      if (previous.hash !== hash) {
        return fail(409, 'idempotency_conflict', 'Essa chave já foi usada com outro conteúdo')
      }
      const record = db.orders[previous.orderId]
      settle(record)
      return HttpResponse.json(record.order)
    }

    const errors: Record<string, string> = {}
    if (!body.collector?.name?.trim()) errors.name = 'Informe o nome'
    if (!/^\S+@\S+\.\S+$/.test(body.collector?.email ?? '')) errors.email = 'E-mail inválido'
    if (Object.keys(errors).length) {
      return fail(422, 'validation', 'Confira os dados informados', { errors })
    }

    const wallet = walletsOf(user.id).find((item) => item.id === body.walletId)
    if (!wallet) return fail(404, 'wallet_not_found', 'Carteira não encontrada')
    if (db.connections[user.id] !== wallet.id) {
      return fail(409, 'wallet_not_connected', 'Conecte a carteira antes de pagar')
    }
    if (!(body.network in networkFees)) return fail(422, 'validation', 'Rede inválida')

    // revalida estoque e valores no momento da compra
    const cart = buildCart(user.id, body.network)
    if (cart.items.length === 0) return fail(409, 'empty_cart', 'Seu carrinho está vazio')

    const soldOut = cart.items.find(
      ({ nft, editionId, quantity }) => quantity > (editionOf(nft, editionId)?.stock ?? 0),
    )
    if (soldOut) {
      const label = editionOf(soldOut.nft, soldOut.editionId)?.label
      return fail(409, 'unavailable', `${soldOut.nft.name} (${label}) não está mais disponível`, {
        cart,
      })
    }
    if (cart.quote.total !== body.expectedTotal) {
      return fail(409, 'quote_changed', 'Os valores do pedido mudaram', { cart })
    }

    const id = `ord-${Date.now()}-${Object.keys(db.orders).length + 1}`
    const order: Order = {
      id,
      version: 1,
      status: 'pending',
      createdAt: new Date().toISOString(),
      items: cart.items.map(({ nft, editionId, quantity }) => ({
        nftId: nft.id,
        editionId,
        editionLabel: editionOf(nft, editionId)?.label ?? editionId,
        name: nft.name,
        image: nft.image,
        price: nft.price,
        quantity,
      })),
      quote: cart.quote,
      network: body.network,
      wallet: { label: wallet.label, address: wallet.address },
      collector: { name: body.collector.name.trim(), email: body.collector.email },
      txHash: null,
      declineReason: null,
    }

    db.orders[id] = {
      order,
      userId: user.id,
      outcome: body.network === DECLINING_NETWORK ? 'declined' : 'confirmed',
      resolveAt: Date.now() + CONFIRM_AFTER_MS,
    }
    db.idempotency[slot] = { hash, orderId: id }
    save()

    // resolve o pedido no prazo e empurra o resultado pelo socket
    setTimeout(() => settle(db.orders[id]), CONFIRM_AFTER_MS)

    // o pedido já existe, mas a resposta demora mais que o timeout do cliente
    if (currentScenario() === 'order-timeout') await delay(12000)

    return HttpResponse.json(order, { status: 201 })
  }),

  http.get('/api/orders/:id', async ({ request, params }) => {
    await delay(150)
    const user = getUser(request)
    if (!user) return unauthorized()

    const record = db.orders[String(params.id)]
    if (!record) return fail(404, 'not_found', 'Pedido não encontrado')
    if (record.userId !== user.id) return fail(403, 'forbidden', 'Sem permissão para ver este pedido')

    settle(record)
    return HttpResponse.json(record.order)
  }),
]
