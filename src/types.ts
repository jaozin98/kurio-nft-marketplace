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
  name: string // nome de exibição
  username: string
  email: string
  ens: string // nome ENS, sem o sufixo .eth
  walletNickname: string
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

export type Provider = 'metamask' | 'walletconnect' | 'coinbase'

// os campos do formulário de carteira do Figma (os mesmos no pagamento e em Carteiras)
export type WalletFields = {
  displayName: string
  profileName: string
  network: NetworkId
  address: string
  altAddress: string // ENS ou carteira secundária (opcional)
  provider: Provider
  referralCode: string
  email: string
  ens: string
}

export type WalletInput = WalletFields & { nickname: string }

export type Wallet = WalletInput & {
  id: string
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
  wallet: { nickname: string; address: string; provider: Provider; network: NetworkId }
  collector: Collector
  txHash: string | null
  declineReason: string | null
}

// campos do formulário de pagamento do Figma
export type Collector = WalletFields & {
  username: string
  notes: string
}

export type OrderRequest = {
  walletId: string
  network: NetworkId
  expectedTotal: string
  collector: Collector
}
