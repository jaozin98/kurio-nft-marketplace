import { Link, useNavigate, useRouterState, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { FiltersPanel } from '@/components/FiltersPanel'
import { SearchIcon } from '@/components/icons'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { useFeaturedNft, useFilterMeta, useNftList } from '@/features/nfts/queries'
import { formatEth } from '@/lib/eth'
import { trapFocus } from '@/lib/focusTrap'
import type { NftFilters, NftSort, NftTab } from '@/types'

const sortOptions: { value: NftSort; label: string }[] = [
  { value: 'recent', label: 'Listados recentemente' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'name', label: 'Nome' },
]

const tabs: { value: NftTab; label: string }[] = [
  { value: 'all', label: 'Todos os NFTs' },
  { value: 'new', label: 'Novos lançamentos' },
  { value: 'trending', label: 'Em alta' },
]

const field = 'rounded border border-input bg-background px-3 py-2 text-sm'

export function Home() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const { data, isPending, isError, isFetching, refetch } = useNftList(search as NftFilters)
  const { data: meta } = useFilterMeta()
  const filters = search as NftFilters
  const drawer = useRef<HTMLDialogElement>(null)

  const [text, setText] = useState(search.q ?? '')
  const searchInput = useRef<HTMLInputElement>(null)
  const hash = useRouterState({ select: (state) => state.location.hash })

  // o ícone de lupa do cabeçalho leva até aqui
  useEffect(() => {
    if (hash === 'busca') searchInput.current?.focus()
  }, [hash])

  // espera o usuário parar de digitar antes de buscar
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((search.q ?? '') !== text) update({ q: text || undefined })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  useEffect(() => {
    setText(search.q ?? '')
  }, [search.q])

  function update(next: Partial<NftFilters>) {
    // qualquer filtro novo volta para a página 1
    navigate({ search: (prev) => ({ ...prev, page: 1, ...next }) })
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div>
      <Hero />

      <div id="catalogo" className="mt-8 grid scroll-mt-6 gap-8 lg:grid-cols-[275px_1fr]">
        <aside aria-label="Filtros" className="hidden h-fit space-y-6 lg:block">
          <div className="rounded-lg bg-card p-4">
            <FiltersPanel idPrefix="barra" meta={meta} filters={filters} onChange={update} />
          </div>
          <FeaturedBanner />
        </aside>

        <section aria-label="Catálogo">
          <button
            onClick={() => drawer.current?.showModal()}
            className="mb-4 w-full rounded border border-primary px-4 py-2 text-sm font-bold text-primary lg:hidden"
          >
            Filtros
          </button>
          <dialog
            ref={drawer}
            aria-labelledby="filtros-titulo"
            onClick={(event) => event.target === drawer.current && drawer.current?.close()}
            onKeyDown={trapFocus}
            className="fixed inset-y-0 right-0 m-0 h-dvh max-h-none w-[min(360px,92vw)] overflow-y-auto border-l border-border bg-card p-4 text-foreground backdrop:bg-black/70"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="filtros-titulo" className="text-xl font-bold">
                Filtros
              </h2>
              <button
                onClick={() => drawer.current?.close()}
                aria-label="Fechar filtros"
                className="size-9 rounded border border-border"
              >
                ✕
              </button>
            </div>
            <FiltersPanel idPrefix="gaveta" meta={meta} filters={filters} onChange={update} />
            <button
              onClick={() => drawer.current?.close()}
              className="mt-6 w-full rounded bg-primary py-3 font-bold text-primary-foreground"
            >
              Ver {data ? `${data.total} resultados` : 'resultados'}
            </button>
          </dialog>

          <div className="relative mb-6">
            <label htmlFor="busca" className="sr-only">
              Buscar NFT
            </label>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="busca"
              ref={searchInput}
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Buscar NFT pelo nome"
              className={`${field} w-full pl-9`}
            />
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div role="group" aria-label="Visualização" className="flex flex-wrap gap-x-6 gap-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => update({ tab: tab.value })}
                  aria-pressed={search.tab === tab.value}
                  className={`border-b-2 pb-1 text-base ${
                    search.tab === tab.value
                      ? 'border-primary font-bold text-primary'
                      : 'border-transparent hover:text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="ordem" className="text-muted-foreground">
                Ordenar por:
              </label>
              <select
                id="ordem"
                value={search.sort}
                onChange={(event) => update({ sort: event.target.value as NftSort })}
                className="rounded border-0 bg-transparent py-1 pr-1 text-foreground"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {data ? `${data.total} resultados` : 'Carregando...'}
            {isFetching && !isPending && ' (atualizando)'}
          </p>

          {isError ? (
            <div role="alert" className="rounded-lg border border-border p-8 text-center">
              <p>Não foi possível carregar os NFTs.</p>
              <button
                onClick={() => refetch()}
                className="mt-4 rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                Tentar de novo
              </button>
            </div>
          ) : isPending ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 9 }, (_, i) => (
                <NftCardSkeleton key={i} />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <p className="rounded-lg border border-border p-8 text-center text-muted-foreground">
              Nenhum NFT encontrado com esses filtros.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {data.items.map((nft) => (
                <li key={nft.id}>
                  <NftCard nft={nft} />
                </li>
              ))}
            </ul>
          )}

          {data && totalPages > 1 && (
            <nav aria-label="Paginação" className="mt-8 flex justify-end gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                <button
                  key={number}
                  onClick={() => navigate({ search: (prev) => ({ ...prev, page: number }) })}
                  aria-current={number === search.page ? 'page' : undefined}
                  aria-label={`Página ${number}`}
                  className={`size-9 rounded border text-sm ${
                    number === search.page
                      ? 'border-primary bg-primary font-bold text-primary-foreground'
                      : 'border-border hover:border-primary'
                  }`}
                >
                  {number}
                </button>
              ))}
              <button
                onClick={() =>
                  navigate({ search: (prev) => ({ ...prev, page: Math.min(totalPages, search.page + 1) }) })
                }
                disabled={search.page >= totalPages}
                aria-label="Próxima página"
                className="size-9 rounded border border-border text-sm hover:border-primary disabled:opacity-40"
              >
                ›
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  )
}

function Hero() {
  const { data: featured, isPending } = useFeaturedNft()

  return (
    <section
      aria-labelledby="hero-titulo"
      className="grid items-center gap-8 py-8 md:grid-cols-[1fr_368px] md:py-12"
    >
      <div className="space-y-5">
        <p className="text-sm font-medium tracking-[0.1em]">Bem-vindo à Kurio</p>
        <h1 id="hero-titulo" className="max-w-[600px] text-3xl font-bold md:text-[43px] md:leading-[70px]">
          SEJA DONO DO FUTURO <br className="hidden md:inline" />
          DA ARTE DIGITAL
        </h1>
        <p className="max-w-[557px] text-sm leading-6 text-muted-foreground">
          Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital
          rara, apoie artistas e tenha uma parte da cultura da internet.
        </p>
        <Link
          to="/"
          hash="catalogo"
          className="inline-block rounded bg-primary px-6 py-2 text-base font-bold text-primary-foreground"
        >
          EXPLORAR
        </Link>
      </div>

      {isPending ? (
        <div aria-hidden className="shimmer aspect-square w-full rounded-lg md:justify-self-end" />
      ) : featured ? (
        <Link
          to="/nft/$id"
          params={{ id: featured.id }}
          className="block aspect-square w-full overflow-hidden rounded-lg md:justify-self-end"
        >
          <img
            src={featured.image}
            alt={`NFT em destaque: ${featured.name}`}
            width={368}
            height={368}
            className="size-full object-cover"
          />
        </Link>
      ) : null}
    </section>
  )
}

function FeaturedBanner() {
  const { data: featured } = useFeaturedNft()
  if (!featured) return <div aria-hidden className="shimmer h-80 rounded-lg" />

  return (
    <section aria-labelledby="destaque-titulo" className="rounded-lg bg-card p-4">
      <h2 id="destaque-titulo" className="text-xl font-bold leading-tight text-primary">
        NFT EM DESTAQUE
      </h2>
      <p className="mb-3 text-center text-base font-bold">OFERTA LIMITADA</p>
      <Link to="/nft/$id" params={{ id: featured.id }} className="block">
        <img
          src={featured.image}
          alt={featured.name}
          width={240}
          height={300}
          loading="lazy"
          className="aspect-[4/5] w-full rounded-lg object-cover"
        />
        <p className="mt-3 text-base">{featured.name}</p>
        <p className="font-bold text-primary">{formatEth(featured.price)}</p>
      </Link>
    </section>
  )
}
