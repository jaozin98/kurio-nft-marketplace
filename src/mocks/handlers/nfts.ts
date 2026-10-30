import { delay, http, HttpResponse } from 'msw'
import { fromUnits, toUnits } from '@/lib/eth'
import type { FilterMeta, Nft, NftNetwork, NftPage, NftSort, NftTab } from '@/types'
import { collections, networkLabels } from '../data'
import { db } from '../db'
import { consumeFailure, currentScenario, listLatency } from '../scenario'

const PAGE_SIZE = 9

// buscas já respondidas, na ordem; os testes usam para saber quando uma resposta lenta saiu
export const servedSearches: (string | null)[] = []

const sorters: Record<NftSort, (a: Nft, b: Nft) => number> = {
  recent: (a, b) => Number(b.id) - Number(a.id),
  name: (a, b) => a.name.localeCompare(b.name),
  'price-asc': (a, b) => Number(toUnits(a.price) - toUnits(b.price)),
  'price-desc': (a, b) => Number(toUnits(b.price) - toUnits(a.price)),
}

export const nftHandlers = [
  http.get('/api/filters', async () => {
    await delay(150)
    const prices = db.nfts.map((nft) => toUnits(nft.price)).sort((a, b) => Number(a - b))
    const body: FilterMeta = {
      collections: collections.map((name) => ({
        name,
        count: db.nfts.filter((nft) => nft.collection === name).length,
      })),
      networks: (Object.keys(networkLabels) as NftNetwork[]).map((id) => ({
        id,
        label: networkLabels[id],
        count: db.nfts.filter((nft) => nft.network === id).length,
      })),
      price: { min: fromUnits(prices[0]), max: fromUnits(prices[prices.length - 1]) },
    }
    return HttpResponse.json(body)
  }),

  // precisa vir antes de /api/nfts/:id
  http.get('/api/nfts/featured', async () => {
    await delay(150)
    return HttpResponse.json(db.nfts.find((nft) => nft.featured) ?? db.nfts[0])
  }),

  http.get('/api/nfts', async ({ request }) => {
    const params = new URL(request.url).searchParams
    await delay(listLatency(params.get('q')))
    servedSearches.push(params.get('q'))

    // cenários de falha: as duas primeiras listagens falham, depois o serviço volta
    const scenario = currentScenario()
    if (scenario === 'list-error' && consumeFailure()) {
      return HttpResponse.json({ message: 'Serviço indisponível' }, { status: 500 })
    }
    if (scenario === 'network-error' && consumeFailure()) return HttpResponse.error()

    const q = params.get('q')?.toLowerCase()
    const collection = params.get('collection')?.split(',').filter(Boolean)
    const rarity = params.get('rarity')
    const network = params.get('network')
    const min = params.get('min')
    const max = params.get('max')
    const tab = (params.get('tab') as NftTab) || 'all'
    const sort = (params.get('sort') as NftSort) || 'recent'
    const page = Math.max(1, Number(params.get('page')) || 1)

    const result = db.nfts
      .filter((nft) => {
        // abas: "novos" são os 12 últimos cadastrados; "em alta" é uma regra fixa de fixture
        if (tab === 'new' && Number(nft.id) <= db.nfts.length - 12) return false
        if (tab === 'trending' && Number(nft.id) % 3 !== 0) return false
        if (q && !nft.name.toLowerCase().includes(q)) return false
        if (collection?.length && !collection.includes(nft.collection)) return false
        if (rarity && nft.rarity !== rarity) return false
        if (network && nft.network !== network) return false
        if (min && toUnits(nft.price) < toUnits(min)) return false
        if (max && toUnits(nft.price) > toUnits(max)) return false
        return true
      })
      .sort(sorters[sort] ?? sorters.recent)

    if (scenario === 'empty') result.length = 0

    const body: NftPage = {
      items: result.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: result.length,
      page,
      pageSize: PAGE_SIZE,
    }
    return HttpResponse.json(body)
  }),

  http.get('/api/nfts/:id', async ({ params }) => {
    await delay(200)
    const nft = db.nfts.find((item) => item.id === params.id)
    if (!nft) {
      return HttpResponse.json({ message: 'NFT não encontrado' }, { status: 404 })
    }
    return HttpResponse.json(nft)
  }),
]
