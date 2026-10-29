import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { Nft, Order } from '@/types'
import { users } from './data'

// O binding responde ao handshake do Engine.IO, mas não manda ping.
// Sem ping o cliente derruba a conexão em ~30s, então mandamos um a cada 20s.
const PING_EVERY_MS = 20000

type Peer = {
  userId: string | null
  send: (event: string, payload: unknown) => void
  close: () => void
}

const peers = new Set<Peer>()
let counter = 0
let pausedUntil = 0
let lastNftEvent: unknown = null

const nextEventId = () => `evt-${Date.now()}-${++counter}`

// O MSW tira o prefixo "/socket.io/" da URL antes de comparar, então o padrão
// é só a origem. O HMR do Vite fica em outro caminho (ver vite.config.ts)
// para não ser capturado por este handler.
const socketLink = ws.link(window.location.origin.replace(/^http/, 'ws'))

export const socketHandlers = [
  socketLink.addEventListener('connection', (connection) => {
    // durante uma pausa de teste, recusa a conexão para simular a rede fora
    if (Date.now() < pausedUntil) {
      connection.client.close()
      return
    }

    const io = toSocketIo(connection)

    const peer: Peer = {
      userId: null,
      send: (event, payload) => io.client.emit(event, payload),
      close: () => connection.client.close(),
    }
    peers.add(peer)

    // o cliente se identifica depois de conectar
    io.client.on('authenticate', (_event, token) => {
      peer.userId = users.find((user) => `token-${user.id}` === token)?.id ?? null
    })

    const ping = setInterval(() => connection.client.send('2'), PING_EVERY_MS)
    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      peers.delete(peer)
    })
  }),
]

export function emitNftUpdated(nft: Nft) {
  const payload = {
    eventId: nextEventId(),
    nftId: nft.id,
    version: nft.version,
    price: nft.price,
    editions: nft.editions.map(({ id, stock }) => ({ id, stock })),
  }
  lastNftEvent = payload
  for (const peer of peers) peer.send('nft.updated', payload)
}

// pedidos são privados: só os sockets do dono recebem
export function emitOrderUpdated(order: Order, userId: string) {
  const payload = {
    eventId: nextEventId(),
    orderId: order.id,
    userId,
    version: order.version,
    status: order.status,
    txHash: order.txHash,
    declineReason: order.declineReason,
  }
  for (const peer of peers) {
    if (peer.userId === userId) peer.send('order.updated', payload)
  }
}

// usados pelos testes: reenviar um evento qualquer e derrubar as conexões
export const realtimeControls = {
  peerCount: () => peers.size,
  lastNftEvent: () => lastNftEvent,
  resend: (event: string, payload: unknown) => {
    for (const peer of peers) peer.send(event, payload)
  },
  pause: (ms: number) => {
    pausedUntil = Date.now() + ms
  },
  drop: () => {
    for (const peer of [...peers]) peer.close()
  },
}
