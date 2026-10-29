import { Skeleton } from "@/components/ui/skeleton"
import { Link } from '@tanstack/react-router'
import { CartIcon, HeartIcon } from '@/components/icons'
import { formatEth } from '@/lib/eth'
import { totalStock } from '@/lib/nft'
import type { Nft } from '@/types'

export function NftCard({ nft }: { nft: Nft }) {
  const soldOut = totalStock(nft) === 0

  return (
    <Link
      to="/nft/$id"
      params={{ id: nft.id }}
      className="group block rounded-lg bg-card p-1 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring max-md:bg-transparent max-md:p-0 max-md:hover:bg-transparent"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted max-md:rounded-3xl max-md:border-[8px] max-md:border-card">
        {nft.rarity !== 'comum' && (
          <span className="absolute left-0 top-0 z-10 bg-primary px-3 py-1 text-sm font-medium uppercase text-primary-foreground">
            {nft.rarity === 'raro' ? 'Raro' : 'Lendário'}
          </span>
        )}
        {/* só visuais: o card inteiro leva ao detalhe, onde ficam favoritar e comprar */}
        <span
          aria-hidden
          className="absolute right-2 top-2 z-10 hidden gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:flex"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-background/80 text-primary">
            <HeartIcon className="size-4" />
          </span>
          <span className="flex size-8 items-center justify-center rounded-full bg-background/80 text-primary">
            <CartIcon className="size-4" />
          </span>
        </span>
        <img
          src={nft.image}
          alt={nft.name}
          loading="lazy"
          width={400}
          height={400}
          className="size-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="px-2 pb-3 pt-3 max-md:px-1">
        <h3 title={nft.name} className="truncate text-sm md:text-base">
          {nft.name}
        </h3>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-bold text-primary">{formatEth(nft.price)}</span>
          {nft.compareAt && (
            <span className="text-muted-foreground line-through">
              <span className="sr-only">Preço anterior </span>
              {formatEth(nft.compareAt)}
            </span>
          )}
          {soldOut && <span className="ml-auto text-muted-foreground">Esgotado</span>}
        </p>
      </div>
    </Link>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="rounded-lg bg-card p-1" aria-hidden>
      <Skeleton className="aspect-square rounded-lg" />
      <div className="space-y-2 px-2 pb-3 pt-3">
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/3 rounded" />
      </div>
    </div>
  )
}
