export type Rarity = 'comum' | 'raro' | 'lendario'

export type NftNetwork = 'ethereum' | 'polygon' | 'solana'

export type Edition = {
  id: string
  label: string
  stock: number
}

export type Nft = {
  id: string
  name: string
  collection: string
  network: NftNetwork
  rarity: Rarity
  // ETH sempre como string decimal, nunca number
  price: string
  // preço anterior, quando houve desconto
  compareAt: string | null
  editions: Edition[]
  image: string
  gallery: string[]
  description: string
  featured: boolean
  version: number
}

export type NftPage = {
  items: Nft[]
  total: number
  page: number
  pageSize: number
}

export type NftTab = 'all' | 'new' | 'trending'

export type CollectionCount = { name: string; count: number }

export type FilterMeta = {
  collections: CollectionCount[]
  networks: { id: NftNetwork; label: string; count: number }[]
  // limites da faixa de preço, em ETH (string decimal)
  price: { min: string; max: string }
}

export type NftSort = 'recent' | 'price-asc' | 'price-desc' | 'name'

export type NftFilters = {
  q?: string
  tab: NftTab
  collection?: string[]
  rarity?: Rarity
  network?: NftNetwork
  min?: string
  max?: string
  sort: NftSort
  page: number
}

export type ApiError = {
  message: string
}

export type User = {
  id: string
  name: string
  email: string
  avatar: string | null
}

export type LoginResponse = {
  token: string
  user: User
}

export type CartItem = {
  nft: Nft
  editionId: string
  quantity: number
}

export type Quote = {
  subtotal: string
  discount: string
  networkFee: string
  total: string
}

export type Cart = {
  items: CartItem[]
  coupon: string | null
  quote: Quote
}

export type NetworkId = 'ethereum' | 'polygon' | 'arbitrum'

export type Wallet = {
  id: string
  label: string
  address: string
  primary: boolean
}

export type WalletsResponse = {
  wallets: Wallet[]
  connectedId: string | null
}

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export type OrderItem = {
  nftId: string
  editionId: string
  editionLabel: string
  name: string
  image: string
  price: string
  quantity: number
}

export type Order = {
  id: string
  version: number
  status: OrderStatus
  createdAt: string
  items: OrderItem[]
  quote: Quote
  network: NetworkId
  wallet: { label: string; address: string }
  collector: { name: string; email: string }
  txHash: string | null
  declineReason: string | null
}

export type OrderRequest = {
  walletId: string
  network: NetworkId
  expectedTotal: string
  collector: { name: string; email: string }
}
