import type { Order, User, Wallet } from '@/types'
import { createNfts, users } from './data'

const KEY = 'mock-db-v6'

export type Account = User & { passwordHash: string }

export type CartData = { items: Record<string, number>; coupon: string | null }

export type OrderRecord = {
  order: Order
  userId: string
  outcome: 'confirmed' | 'declined'
  resolveAt: number
}

type Saved = {
  accounts: Record<string, Account>
  favorites: Record<string, string[]>
  carts: Record<string, CartData>
  wallets: Record<string, Wallet[]>
  connections: Record<string, string | null>
  orders: Record<string, OrderRecord>
  idempotency: Record<string, { hash: string; orderId: string }>
  sold: Record<string, number>
}

const empty = (): Saved => ({
  accounts: {},
  favorites: {},
  carts: {},
  wallets: {},
  connections: {},
  orders: {},
  idempotency: {},
  sold: {},
})

function load(): Saved {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? '') }
  } catch {
    return empty()
  }
}

// o estoque vendido é guardado à parte, por "nft|edição", para sobreviver ao refresh
function freshNfts(sold: Record<string, number>) {
  return createNfts().map((nft) => ({
    ...nft,
    editions: nft.editions.map((edition) => ({
      ...edition,
      stock: Math.max(0, edition.stock - (sold[`${nft.id}|${edition.id}`] ?? 0)),
    })),
    version: nft.version + (Object.keys(sold).some((key) => key.startsWith(`${nft.id}|`)) ? 1 : 0),
  }))
}

// as contas de teste sempre existem; contas criadas no cadastro ficam junto
function withSeeds(saved: Saved): Saved {
  for (const seed of users) saved.accounts[seed.id] ??= { ...seed, avatar: null }
  return saved
}

const saved = withSeeds(load())

export const db = { ...saved, nfts: freshNfts(saved.sold) }

export function save() {
  const { nfts: _nfts, ...rest } = db
  localStorage.setItem(KEY, JSON.stringify(rest))
}

export function resetDb() {
  Object.assign(db, withSeeds(empty()), { nfts: freshNfts({}) })
  save()
}

// as contas de teste começam com carteira principal e secundária; contas novas, sem nenhuma
// a secundária termina em "dead" e recusa a conexão (cenário fixo)
export function walletsOf(userId: string): Wallet[] {
  const account = db.accounts[userId]
  if (!users.some((seed) => seed.id === userId) || !account) return (db.wallets[userId] ??= [])

  const base = {
    displayName: account.name,
    profileName: account.username,
    altAddress: '',
    referralCode: 'KURIO2026',
    email: account.email,
    ens: account.ens,
  }

  return (db.wallets[userId] ??= [
    {
      ...base,
      id: `${userId}-w1`,
      primary: true,
      nickname: 'Principal',
      network: 'ethereum',
      address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      provider: 'metamask',
    },
    {
      ...base,
      id: `${userId}-w2`,
      primary: false,
      nickname: 'Reserva',
      network: 'polygon',
      address: '0x9d3a5C1f0e22aD7e55Bb8d01C6F7e8B2A1c0dead',
      provider: 'coinbase',
    },
  ])
}
