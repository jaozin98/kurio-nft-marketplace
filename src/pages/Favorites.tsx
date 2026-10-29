import { Link } from '@tanstack/react-router'
import { AccountLayout } from '@/components/AccountLayout'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { Private } from '@/components/Private'
import { useFavoriteNfts } from '@/features/favorites/queries'

export function Favorites() {
  return <Private to="/favorites">{(user) => <FavoritesView userId={user.id} />}</Private>
}

function FavoritesView({ userId }: { userId: string }) {
  const { data, isPending, isError, refetch } = useFavoriteNfts(userId)

  return (
    <AccountLayout active="favorites">
      <h1 className="text-xl font-bold">Lista de interesse</h1>
      <p className="mt-2 text-sm text-muted-foreground">Os NFTs que você marcou como favoritos.</p>

      <div className="mt-8">
        {isError ? (
          <div role="alert" className="rounded-lg border border-border p-8 text-center">
            <p>Não foi possível carregar seus favoritos.</p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Tentar de novo
            </button>
          </div>
        ) : isPending ? (
          <ul aria-busy="true" className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))}
          </ul>
        ) : data.length === 0 ? (
          <div className="rounded-lg border border-border p-10 text-center">
            <p className="text-muted-foreground">Você ainda não favoritou nenhum NFT.</p>
            <Link to="/" hash="catalogo" className="mt-4 inline-block text-primary underline">
              Explorar o catálogo
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {data.map((nft) => (
              <li key={nft.id}>
                <NftCard nft={nft} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AccountLayout>
  )
}
