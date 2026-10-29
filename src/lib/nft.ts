import type { Nft } from '@/types'

export const totalStock = (nft: Nft) => nft.editions.reduce((sum, edition) => sum + edition.stock, 0)

export const editionOf = (nft: Nft, editionId: string) =>
  nft.editions.find((edition) => edition.id === editionId)

// edição que a tela seleciona de início: a primeira com estoque
export const firstAvailable = (nft: Nft) =>
  (nft.editions.find((edition) => edition.stock > 0) ?? nft.editions[0]).id
