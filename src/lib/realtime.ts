import { io } from 'socket.io-client'
import { useSyncExternalStore } from 'react'
import { nftKeys } from '@/features/nfts/queries'
import type { Cart, Nft, NftPage, Order } from '@/types'
import { editionOf } from './nft'
import { formatEth } from './eth'
import { pushNotice } from './notices'
import { queryClient } from './queryClient'

type NftEvent = {
  eventId: string
  nftId: string
  version: number
  price: string
  editions: { id: string; stock: number }[]
}
type OrderEvent = {
  eventId: string
  orderId: string
  userId: string
  version: number
  status: Order['status']
  txHash: string | null
  declineReason: string | null
}

// ids de eventos já aplicados; compartilhado entre sockets (StrictMode abre dois)
const seen: string[] = []

function isDuplicate(id: string) {
  if (seen.includes(id)) return true
  seen.push(id)
  if (seen.length > 200) seen.shift()
  return false
}

// status da conexão, usado para decidir se vale consultar o pedido por polling
let connected = false
const listeners = new Set<() => void>()

function setConnected(value: boolean) {
  connected = value
  for (const listener of listeners) listener()
}

export function useSocketConnected() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => connected,
  )
}

function applyNft(event: NftEvent) {
  const newer = (current: Nft) => event.version > current.version
  const patch = (current: Nft): Nft => ({
    ...current,
    price: event.price,
    version: event.version,
    editions: current.editions.map((edition) => ({
      ...edition,
      stock: event.editions.find((item) => item.id === edition.id)?.stock ?? edition.stock,
    })),
  })

  queryClient.setQueryData<Nft>(nftKeys.detail(event.nftId), (current) =>
    current && newer(current) ? patch(current) : current,
  )

  queryClient.setQueriesData<NftPage>({ queryKey: ['nfts', 'list'] }, (page) =>
    page && {
      ...page,
      items: page.items.map((item) =>
        item.id === event.nftId && newer(item) ? patch(item) : item,
      ),
    },
  )

  // carrinhos em cache: avisa o que mudou e recalcula os valores pela API
  let touchedCart = false
  for (const [, cart] of queryClient.getQueriesData<Cart>({ queryKey: ['cart'] })) {
    for (const item of cart?.items ?? []) {
      if (item.nft.id !== event.nftId || !newer(item.nft)) continue

      touchedCart = true
      if (item.nft.price !== event.price) {
        pushNotice(`O preço de ${item.nft.name} mudou para ${formatEth(event.price)}.`)
      }

      const label = editionOf(item.nft, item.editionId)?.label
      const before = editionOf(item.nft, item.editionId)?.stock
      const now = event.editions.find((edition) => edition.id === item.editionId)?.stock
      if (now !== undefined && before !== now) {
        pushNotice(
          now === 0
            ? `${item.nft.name} esgotou na edição ${label}.`
            : `A disponibilidade de ${item.nft.name} (${label}) mudou: restam ${now}.`,
        )
      }
    }
  }

  if (touchedCart) {
    // grava a versão nova no cache já, para um evento mais velho não passar por novo
    queryClient.setQueriesData<Cart>({ queryKey: ['cart'] }, (cart) =>
      cart && {
        ...cart,
        items: cart.items.map((entry) =>
          entry.nft.id === event.nftId && newer(entry.nft)
            ? { ...entry, nft: patch(entry.nft) }
            : entry,
        ),
      },
    )
    queryClient.invalidateQueries({ queryKey: ['cart'] })
    queryClient.invalidateQueries({ queryKey: ['quote'] })
  }
}

function applyOrder(event: OrderEvent) {
  // o evento chegou antes de o pedido estar no cache: não há o que atualizar, então busca o estado atual
  if (!queryClient.getQueryData(['order', event.orderId])) {
    queryClient.invalidateQueries({ queryKey: ['order', event.orderId] })
  }

  queryClient.setQueryData<Order>(['order', event.orderId], (current) =>
    current && event.version > current.version
      ? {
          ...current,
          version: event.version,
          status: event.status,
          txHash: event.txHash,
          declineReason: event.declineReason,
        }
      : current,
  )

  if (event.status === 'confirmed') {
    queryClient.invalidateQueries({ queryKey: ['cart'] })
    queryClient.invalidateQueries({ queryKey: ['nfts'] })
  }
}

// Abre o socket de uma sessão. Devolve a função que encerra tudo.
// Visitantes também conectam, mas só recebem eventos públicos (nft.updated).
export function connectRealtime(token: string | null, userId: string | null) {
  const socket = io(window.location.origin, {
    transports: ['websocket'],
    reconnectionDelay: 300,
    reconnectionDelayMax: 1500,
  })

  let firstConnection = true

  socket.on('connect', () => {
    if (token) socket.emit('authenticate', token)
    setConnected(true)

    // eventos podem ter se perdido enquanto estava fora: busca o estado pelo REST
    if (!firstConnection) queryClient.invalidateQueries()
    firstConnection = false
  })

  socket.on('disconnect', () => setConnected(false))

  socket.on('nft.updated', (event: NftEvent) => {
    if (!isDuplicate(event.eventId)) applyNft(event)
  })

  socket.on('order.updated', (event: OrderEvent) => {
    // pedido de outro usuário nunca é aplicado
    if (event.userId !== userId) return
    if (!isDuplicate(event.eventId)) applyOrder(event)
  })

  return () => {
    socket.off()
    socket.disconnect()
    setConnected(false)
  }
}
