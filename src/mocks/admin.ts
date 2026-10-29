import type { Nft } from '@/types'
import { db } from './db'
import { emitNftUpdated } from './realtime'

type Patch = {
  price?: string
  // estoque novo; vale para `editionId` ou, sem ela, para todas as edições
  stock?: number
  editionId?: string
}

// simula o catálogo mudando por fora: sobe a versão e avisa pelo socket
export function updateNft(id: string, patch: Patch): Nft {
  const nft = db.nfts.find((item) => item.id === id)
  if (!nft) throw new Error(`NFT ${id} não existe`)

  if (patch.price !== undefined) nft.price = patch.price
  if (patch.stock !== undefined) {
    for (const edition of nft.editions) {
      if (!patch.editionId || edition.id === patch.editionId) edition.stock = patch.stock
    }
  }
  nft.version += 1
  emitNftUpdated(nft)
  return nft
}
