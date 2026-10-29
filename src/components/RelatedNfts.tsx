import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { useNftList } from '@/features/nfts/queries'

// faixa de NFTs sugeridos; `collection` restringe à mesma coleção
export function RelatedNfts({
  title,
  collection,
  excludeIds = [],
}: {
  title: string
  collection?: string
  excludeIds?: string[]
}) {
  const { data, isPending } = useNftList({
    tab: 'all',
    sort: 'recent',
    page: 1,
    collection: collection ? [collection] : undefined,
  })

  const items = data?.items.filter((nft) => !excludeIds.includes(nft.id)).slice(0, 5) ?? []
  if (!isPending && items.length === 0) return null

  return (
    <section aria-labelledby="relacionados-titulo" className="mt-16">
      <h2 id="relacionados-titulo" className="mb-6 border-b border-border pb-2 text-lg font-bold">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))
          : items.map((nft) => (
              <li key={nft.id}>
                <NftCard nft={nft} />
              </li>
            ))}
      </ul>
    </section>
  )
}
