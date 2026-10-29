import type { Collector, WalletInput } from '@/types'

const handle = /^[a-zA-Z0-9_]{3,20}$/
const email = /^\S+@\S+\.\S+$/
const address = /^0x[a-fA-F0-9]{40}$/
const ensName = /^[a-zA-Z0-9-]{3,30}$/
const referral = /^[A-Za-z0-9]{4,12}$/

export const networks = ['ethereum', 'polygon', 'arbitrum'] as const
export const providers = ['metamask', 'walletconnect', 'coinbase'] as const

export const providerLabels = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
} as const

export const networkLabels = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
} as const

export const isHandle = (value: string) => handle.test(value)
export const isEmail = (value: string) => email.test(value)

type Errors = Record<string, string>

// campos em comum do formulário de carteira e do pagamento
function walletFields(values: Partial<Collector & WalletInput>, errors: Errors) {
  if ((values.displayName ?? '').trim().length < 2) errors.displayName = 'Informe o nome de exibição'
  if (!(networks as readonly string[]).includes(values.network ?? '')) errors.network = 'Selecione uma rede'
  if (!handle.test(values.profileName ?? '')) errors.profileName = 'Use de 3 a 20 letras, números ou _'
  if (!address.test(values.address ?? '')) {
    errors.address = 'Endereço inválido: use 0x seguido de 40 caracteres'
  }
  const alt = (values.altAddress ?? '').trim()
  if (alt && !address.test(alt) && !/\.eth$/i.test(alt)) {
    errors.altAddress = 'Use um endereço 0x válido ou um nome .eth'
  }
  if (!(providers as readonly string[]).includes(values.provider ?? '')) {
    errors.provider = 'Selecione uma carteira'
  }
  if (!referral.test(values.referralCode ?? '')) errors.referralCode = 'Use de 4 a 12 letras ou números'
  if (!email.test(values.email ?? '')) errors.email = 'Digite um e-mail válido'
  if (!ensName.test(values.ens ?? '')) errors.ens = 'Use de 3 a 30 letras, números ou -'
}

export function validateWallet(values: Partial<WalletInput>): Errors {
  const errors: Errors = {}
  const nickname = (values.nickname ?? '').trim()
  if (nickname.length < 2 || nickname.length > 30) errors.nickname = 'Use de 2 a 30 caracteres'
  walletFields(values, errors)
  return errors
}

export function validateCollector(values: Partial<Collector>): Errors {
  const errors: Errors = {}
  if (!handle.test(values.username ?? '')) errors.username = 'Use de 3 a 20 letras, números ou _'
  if ((values.notes ?? '').length > 280) errors.notes = 'Use até 280 caracteres'
  walletFields(values, errors)
  return errors
}

export function validateProfile(values: {
  name?: string
  username?: string
  email?: string
  ens?: string
  walletNickname?: string
}): Errors {
  const errors: Errors = {}
  if ((values.name ?? '').trim().length < 2) errors.name = 'Informe o nome de exibição'
  if (!handle.test(values.username ?? '')) errors.username = 'Use de 3 a 20 letras, números ou _'
  if (!email.test(values.email ?? '')) errors.email = 'Digite um e-mail válido'
  if (!ensName.test(values.ens ?? '')) errors.ens = 'Use de 3 a 30 letras, números ou -'
  const nickname = (values.walletNickname ?? '').trim()
  if (nickname.length < 2 || nickname.length > 30) errors.walletNickname = 'Use de 2 a 30 caracteres'
  return errors
}
