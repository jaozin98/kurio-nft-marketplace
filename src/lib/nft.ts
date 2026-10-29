import type { Nft } from '@/types'

export const totalStock = (nft: Nft) => nft.editions.reduce((sum, edition) => sum + edition.stock, 0)

export const editionOf = (nft: Nft, editionId: string) =>
  nft.editions.find((edition) => edition.id === editionId)

// edição que a tela seleciona de início: a primeira com estoque
export const firstAvailable = (nft: Nft) =>
  (nft.editions.find((edition) => edition.stock > 0) ?? nft.editions[0]).id

// o Figma mostra uma nota no detalhe mobile, mas a API não tem avaliações:
// a nota é derivada do id só para a tela ficar completa (entre 4,0 e 4,9)
export const ratingOf = (nft: Nft) => (4 + (Number(nft.id.replace(/\D/g, '')) % 10) / 10).toFixed(1)
