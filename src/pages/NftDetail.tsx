import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { BackButton } from '@/components/BackButton'
import { HeartIcon } from '@/components/icons'
import { RelatedNfts } from '@/components/RelatedNfts'
import { Stepper } from '@/components/Stepper'
import { useSession } from '@/features/auth/queries'
import { useAddToCart } from '@/features/cart/queries'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'
import { useNft } from '@/features/nfts/queries'
import { errorMessage } from '@/lib/api'
import { formatEth } from '@/lib/eth'
import { editionOf, firstAvailable, totalStock } from '@/lib/nft'
import type { Nft, Rarity } from '@/types'

const rarityLabel: Record<Rarity, string> = {
  comum: 'Comum',
  raro: 'Raro',
  lendario: 'Lendário',
}

export function NftDetail() {
  const { id } = useParams({ from: '/nft/$id' })
  const { data: nft, isPending, error } = useNft(id)

  if (isPending) {
    // mesmas proporções da página carregada, para o layout não pular
    return (
      <div className="grid gap-8 py-8 md:grid-cols-2" aria-busy="true">
        <div className="shimmer aspect-square rounded-lg" />
        <div className="space-y-4">
          <div className="shimmer h-8 w-2/3 rounded" />
          <div className="shimmer h-6 w-1/4 rounded" />
          <div className="shimmer h-24 w-full rounded" />
          <div className="shimmer h-10 w-1/2 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    const notFound = isAxiosError(error) && error.response?.status === 404
    return (
      <div role="alert" className="py-24 text-center">
        <h1 className="text-2xl font-bold">
          {notFound ? 'NFT não encontrado' : 'Erro ao carregar o NFT'}
        </h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          Voltar para o catálogo
        </Link>
      </div>
    )
  }

  // key faz o estado interno (imagem e quantidade) reiniciar ao trocar de NFT
  return <NftView key={nft.id} nft={nft} />
}

function NftView({ nft }: { nft: Nft }) {
  const navigate = useNavigate()
  const { data: user } = useSession()
  const { data: favorites = [] } = useFavorites(user?.id)
  const toggleFavorite = useToggleFavorite(user?.id ?? '')
  const addToCart = useAddToCart(user?.id)

  useEffect(() => {
    document.title = `${nft.name} | Kurio`
  }, [nft.name])

  const [selected, setSelected] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [editionId, setEditionId] = useState(() => firstAvailable(nft))

  // as edições têm estoque próprio: o limite da quantidade é o da edição escolhida
  const edition = editionOf(nft, editionId) ?? nft.editions[0]
  const stock = edition.stock
  const soldOut = totalStock(nft) === 0
  const isFavorite = favorites.includes(nft.id)
  const tokenId = `#${nft.id.padStart(4, '0')}`

  function onFavorite() {
    if (!user) {
      navigate({ to: '/login', search: { redirect: `/nft/${nft.id}` } })
      return
    }
    toggleFavorite.mutate({ nftId: nft.id, active: !isFavorite })
  }

  return (
    <article className="py-6">
      <div className="md:hidden">
        <BackButton />
      </div>

      <nav aria-label="Você está em" className="text-sm max-md:hidden">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>
        <span aria-hidden> / </span>
        <Link to="/" hash="catalogo" className="hover:text-primary">
          Mercado
        </Link>
      </nav>

      <div className="mt-4 grid grid-cols-1 items-start gap-8 md:grid-cols-2">
        <div className="flex flex-col-reverse gap-4 xl:flex-row">
          <ul className="flex shrink-0 gap-3 xl:w-[88px] xl:flex-col">
            {nft.gallery.map((src, index) => (
              <li key={index}>
                <button
                  onClick={() => setSelected(index)}
                  aria-label={`Ver imagem ${index + 1}`}
                  aria-pressed={index === selected}
                  className={`block overflow-hidden rounded-lg border-2 ${
                    index === selected ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={src} alt="" width={88} height={88} className="size-[72px] object-cover xl:size-[88px]" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex-1 rounded-lg bg-card p-4 max-md:bg-transparent max-md:p-0">
            <img
              src={nft.gallery[selected]}
              alt={`${nft.name}, imagem ${selected + 1} de ${nft.gallery.length}`}
              width={600}
              height={600}
              fetchPriority="high"
              className="aspect-square w-full rounded-xl object-cover"
            />
          </div>
        </div>

        <div className="space-y-4 max-md:relative max-md:-mt-8 max-md:rounded-3xl max-md:bg-card max-md:p-5">
          <h1 className="text-[28px] font-bold leading-none">{nft.name}</h1>
          <p className="flex items-baseline gap-3">
            <span className="text-[22px] font-bold text-primary">{formatEth(nft.price)}</span>
            {nft.compareAt && (
              <span className="text-muted-foreground line-through">
                <span className="sr-only">Preço anterior </span>
                {formatEth(nft.compareAt)}
              </span>
            )}
          </p>

          <hr className="border-border" />

          <div className="space-y-2">
            <h2 className="text-[15px] font-bold">Sobre este NFT:</h2>
            <p className="text-sm leading-6 text-muted-foreground">{nft.description}</p>
          </div>

          <div role="radiogroup" aria-labelledby="edicao-titulo" className="space-y-2">
            <h2 id="edicao-titulo" className="text-[15px] font-bold">
              Edição:
            </h2>
            <div className="flex flex-wrap gap-2">
              {nft.editions.map((item) => (
                <button
                  key={item.id}
                  role="radio"
                  aria-checked={item.id === editionId}
                  disabled={item.stock === 0}
                  onClick={() => {
                    setEditionId(item.id)
                    setQuantity(1)
                  }}
                  className={`rounded-full border px-4 py-1 text-sm disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${
                    item.id === editionId
                      ? 'border-primary font-bold text-primary'
                      : 'border-border hover:border-primary'
                  }`}
                >
                  {item.label}
                  {item.stock === 0 && <span className="sr-only"> (esgotada)</span>}
                </button>
              ))}
            </div>
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {soldOut
                ? 'Todas as edições esgotaram.'
                : stock === 0
                  ? 'Esta edição esgotou.'
                  : `${stock} ${stock === 1 ? 'disponível' : 'disponíveis'} nesta edição.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Stepper
              value={stock === 0 ? 0 : quantity}
              max={stock}
              onChange={setQuantity}
              disabled={stock === 0}
            />

            <div className="flex w-full flex-wrap gap-3 sm:ml-auto sm:w-auto sm:flex-nowrap">
              <button
                onClick={() => addToCart.mutate({ nftId: nft.id, editionId, quantity })}
                disabled={stock === 0 || addToCart.isPending}
                className="cta flex-1 rounded bg-primary px-6 py-2 text-base font-bold text-primary-foreground disabled:opacity-50 sm:flex-none"
              >
                {stock === 0 ? (
                  'Edição esgotada'
                ) : addToCart.isPending ? (
                  'Adicionando…'
                ) : (
                  <>
                    {/* o Figma usa "Comprar NFT" no mobile e "COMPRAR" no desktop */}
                    <span className="md:hidden">Comprar NFT</span>
                    <span className="hidden md:inline">COMPRAR</span>
                  </>
                )}
              </button>

              <button
                onClick={onFavorite}
                aria-pressed={isFavorite}
                className="flex flex-1 items-center justify-center gap-2 rounded border border-primary px-4 py-2 text-base text-primary sm:flex-none"
              >
                <HeartIcon filled={isFavorite} className="size-4" />
                Favoritar
              </button>
            </div>
          </div>

          {stock > 0 && quantity >= stock && (
            <p className="text-sm text-muted-foreground">
              {stock === 1
                ? 'Resta apenas 1 unidade desta edição.'
                : `Limite de ${stock} unidades por compra.`}
            </p>
          )}

          <div aria-live="polite" className="min-h-6 text-sm">
            {addToCart.isSuccess && (
              <p className="text-primary">
                Adicionado ao carrinho.{' '}
                <Link to="/cart" className="underline">
                  Ver carrinho
                </Link>
              </p>
            )}
            {addToCart.isError && (
              <p role="alert" className="text-destructive">
                {errorMessage(addToCart.error)}
              </p>
            )}
            {toggleFavorite.isError && (
              <p role="alert" className="text-destructive">
                {errorMessage(toggleFavorite.error, 'Não foi possível atualizar os favoritos.')}
              </p>
            )}
          </div>

          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              <span className="text-foreground">ID do token:</span> {tokenId}
            </li>
            <li>
              <span className="text-foreground">Coleção:</span> {nft.collection}
            </li>
            <li>
              <span className="text-foreground">Atributos:</span> {rarityLabel[nft.rarity]}
            </li>
          </ul>
        </div>
      </div>

      <section aria-labelledby="detalhes-titulo" className="mt-12">
        <h2
          id="detalhes-titulo"
          className="inline-block border-b-2 border-primary pb-1 text-lg font-bold text-primary"
        >
          Detalhes do NFT
        </h2>
        <div className="border-t border-border pt-4">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {nft.name} é uma obra digital da coleção {nft.collection}, finalizada à mão e emitida
            em {nft.editions.length} edições numeradas. {nft.description}
          </p>
        </div>
      </section>

      <RelatedNfts
        title="Mais desta coleção"
        collection={nft.collection}
        excludeIds={[nft.id]}
      />
    </article>
  )
}
