import type { Edition, Nft, Rarity } from '@/types'

const names = [
  'Emerald Ape',
  'Dapper Ape',
  'Neon Ape',
  'Cosmic Bloom',
  'Rusty Ape',
  'Violet Hood',
  'Golden Fur',
  'Captain Ape',
]

export const collections = [
  'Arte digital',
  'Fotografia',
  'Música',
  'Arte 3D',
  'Colecionáveis',
  'Generativa',
  'Jogos',
  'Assinaturas',
  'Utilidade',
]

export const networkLabels = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' } as const
const networkIds = ['ethereum', 'polygon', 'solana'] as const

const rarities: Rarity[] = ['comum', 'raro', 'lendario']

// placeholder enquanto as imagens do Figma não estão disponíveis
function artwork(n: number, hue: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="hsl(${hue} 30% 20%)"/>
<circle cx="200" cy="160" r="95" fill="hsl(${hue} 45% 62%)"/>
<rect x="105" y="250" width="190" height="170" rx="70" fill="hsl(${hue} 40% 42%)"/>
<text x="200" y="380" text-anchor="middle" font-size="26" fill="#fff" font-family="monospace">#${n}</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const editionList: [string, string][] = [
  ['1-1', '1/1'],
  ['1-10', '1/10'],
  ['1-50', '1/50'],
  ['open', 'ABERTA'],
]

// cada NFT tem quatro edições com estoque próprio; múltiplos de 7 esgotam em todas
function createEditions(n: number): Edition[] {
  const soldOut = n % 7 === 0
  const stocks = [n % 4 === 0 ? 0 : 1, 1 + (n % 3), n % 5 === 0 ? 0 : 2 + (n % 4), 3 + (n % 3)]
  return editionList.map(([id, label], index) => ({
    id,
    label,
    stock: soldOut ? 0 : stocks[index],
  }))
}

export function createNfts(): Nft[] {
  return Array.from({ length: 48 }, (_, i) => {
    const n = i + 1
    return {
      id: String(n),
      name: `${names[i % names.length]} #${100 + n}`,
      collection: collections[i % collections.length],
      network: networkIds[n % 3],
      rarity: rarities[(n * 7) % 3],
      price: (0.4 + ((n * 37) % 90) / 100).toFixed(2),
      editions: createEditions(n),
      image: artwork(n, (n * 47) % 360),
      gallery: [0, 40, 80].map((shift) => artwork(n, ((n * 47) + shift) % 360)),
      description: `Obra digital da coleção ${collections[i % collections.length]}, com ${editionList.length} edições numeradas e certificado de autenticidade.`,
      // a cada três NFTs, um aparece com o preço anterior riscado, como no Figma
      compareAt: n % 3 === 0 ? (0.4 + ((n * 37) % 90) / 100 + 0.3).toFixed(2) : null,
      featured: n === 5,
      version: 1,
    }
  })
}

// credenciais de teste: as duas contas usam a senha "senha123" (guardada só como hash)
const TEST_PASSWORD_HASH = '55a5e9e78207b4df8699d60886fa070079463547b095d1a05bc719bb4e6cd251'

export const users = [
  { id: 'u1', name: 'Ana Souza', email: 'ana@greenmint.test', passwordHash: TEST_PASSWORD_HASH },
  { id: 'u2', name: 'Bruno Lima', email: 'bruno@greenmint.test', passwordHash: TEST_PASSWORD_HASH },
]

export const coupons: Record<string, { percent: number; expired?: boolean }> = {
  GREEN10: { percent: 10 },
  GREEN25: { percent: 25 },
  OLD20: { percent: 20, expired: true },
}
