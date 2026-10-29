import { Skeleton } from '@/components/ui/skeleton'
import { Link, useNavigate, useRouterState, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { FiltersPanel } from '@/components/FiltersPanel'
import { ArrowRight, SlidersHorizontal } from 'lucide-react'
import { ChevronRightIcon, CloseIcon, SearchIcon } from '@/components/icons'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { useFeaturedNft, useFilterMeta, useNftList } from '@/features/nfts/queries'
import { formatEth } from '@/lib/eth'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
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
  const [drawerOpen, setDrawerOpen] = useState(false)

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
          <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogContent
              showCloseButton={false}
              className="inset-y-0 left-auto right-0 top-0 h-dvh w-[min(360px,92vw)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-l border-border bg-card p-4 text-foreground ring-0 sm:max-w-none"
            >
              <div className="mb-4 flex items-center justify-between">
                <DialogTitle className="text-xl font-bold">Filtros</DialogTitle>
                <DialogClose
                  aria-label="Fechar filtros"
                  className="grid size-9 place-items-center rounded border border-border"
                >
                  <CloseIcon className="size-4" />
                </DialogClose>
              </div>
              <FiltersPanel idPrefix="gaveta" meta={meta} filters={filters} onChange={update} />
              <DialogClose className="mt-6 w-full rounded bg-primary py-3 font-bold text-primary-foreground">
                Ver {data ? `${data.total} resultados` : 'resultados'}
              </DialogClose>
            </DialogContent>
          </Dialog>

          <div className="mb-6 flex gap-2">
            <div className="relative flex-1">
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
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Filtros"
              className="cta grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground lg:hidden"
            >
              <SlidersHorizontal aria-hidden className="size-5" />
            </button>
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div role="group" aria-label="Visualização" className="flex flex-wrap gap-x-4 gap-y-2 md:gap-x-6">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => update({ tab: tab.value })}
                  aria-pressed={search.tab === tab.value}
                  className={`border-b-2 pb-1 text-sm md:text-base ${
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
            <ul className="grid grid-cols-2 gap-4 max-md:[&>li:nth-child(even)]:mt-10 md:grid-cols-3">
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
                className="grid size-9 place-items-center rounded border border-border hover:border-primary disabled:opacity-40"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </nav>
          )}
        </section>
      </div>

      <Promos />
      <Journal />
    </div>
  )
}

export function Hero() {
  const { data: featured, isPending } = useFeaturedNft()

  return (
    <>
    <section
      aria-labelledby="hero-titulo-m"
      className="mt-2 overflow-hidden rounded-3xl bg-gradient-to-br from-[#3b2314] via-[#6a4122] to-[#a8672d] p-5 md:hidden"
    >
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="space-y-2 pr-2">
          <p className="text-xs font-medium tracking-[0.08em]">Bem-vindo à Kurio</p>
          <h1 id="hero-titulo-m" className="text-xl font-bold leading-snug">
            SEJA DONO DA CULTURA DIGITAL
          </h1>
          <p className="text-xs leading-5 text-[#e4cfb2]">
            Descubra NFTs selecionados de criadores do mundo todo.
          </p>
          <Link
            to="/"
            hash="catalogo"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary"
          >
            EXPLORAR
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>

        <div className="relative size-32">
          {featured ? (
            <Link to="/nft/$id" params={{ id: featured.id }} className="block size-full">
              <img
                src={featured.image}
                alt={`NFT em destaque: ${featured.name}`}
                width={128}
                height={128}
                fetchPriority="high"
                className="size-full rounded-2xl object-cover"
              />
            </Link>
          ) : (
            <Skeleton aria-hidden className="size-full rounded-2xl" />
          )}
          <img
            src="/nfts/gorilla-a-sm.jpg"
            alt=""
            width={56}
            height={56}
            className="absolute -bottom-3 -left-3 size-12 rounded-xl border-4 border-[#5a3719] object-cover"
          />
        </div>
      </div>
      {/* indicador do Figma: o destaque é um só, então os pontos são só visuais */}
      <div aria-hidden className="mt-4 flex justify-center gap-1.5">
        <span className="h-1.5 w-5 rounded-full bg-primary" />
        <span className="size-1.5 rounded-full bg-primary/40" />
        <span className="size-1.5 rounded-full bg-primary/40" />
      </div>
    </section>

    <section
      aria-labelledby="hero-titulo"
      className="hidden items-center gap-8 py-8 md:grid md:grid-cols-[1fr_300px] md:py-12 lg:grid-cols-[1fr_368px]"
    >
      <div className="space-y-5">
        <p className="text-sm font-medium tracking-[0.1em]">Bem-vindo à Kurio</p>
        <h1 id="hero-titulo" className="max-w-[600px] text-balance text-3xl font-bold md:text-4xl md:leading-[1.3] lg:text-[43px] lg:leading-[70px]">
          SEJA DONO DO FUTURO <br className="hidden lg:inline" />
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
        <Skeleton aria-hidden className="aspect-[4/3] w-full rounded-lg md:aspect-square md:justify-self-end" />
      ) : featured ? (
        <Link
          to="/nft/$id"
          params={{ id: featured.id }}
          className="block aspect-[4/3] w-full overflow-hidden rounded-lg md:aspect-square md:justify-self-end"
        >
          <img
            src={featured.image}
            alt={`NFT em destaque: ${featured.name}`}
            width={368}
            height={368}
            fetchPriority="high"
            className="size-full object-cover object-top"
          />
        </Link>
      ) : null}
    </section>
    </>
  )
}

function FeaturedBanner() {
  const { data: featured } = useFeaturedNft()
  if (!featured) return <Skeleton aria-hidden className="h-80 rounded-lg" />

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

const promos = [
  {
    image: '/nfts/monkey-a.jpg',
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    search: { tab: 'new' as const },
  },
  {
    image: '/nfts/chimp-a.jpg',
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura da internet.',
    search: { collection: ['Arte digital'] },
  },
]

function Promos() {
  return (
    <section aria-label="Destaques" className="mt-20 grid gap-6 md:grid-cols-2">
      {promos.map((promo) => (
        <article key={promo.title} className="flex overflow-hidden rounded-lg bg-card">
          <img src={promo.image} alt="" width={230} height={230} loading="lazy" className="w-2/5 object-cover" />
          <div className="flex flex-1 flex-col items-end justify-between gap-4 p-5 text-right">
            <div>
              <h2 className="text-lg font-bold leading-tight">{promo.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{promo.text}</p>
            </div>
            <Link
              to="/"
              search={promo.search}
              hash="catalogo"
              className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Explorar
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

// os artigos levam a páginas editoriais, que estão fora do escopo: ficam sem link
const articles = [
  { image: '/nfts/chimp-b.jpg', date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs' },
  { image: '/nfts/monkey-b.jpg', date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar' },
  { image: '/nfts/gorilla-b.jpg', date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência' },
  { image: '/nfts/orange-b.jpg', date: '15 de setembro', read: 2, title: 'Como proteger sua carteira' },
]

function Journal() {
  return (
    <section aria-labelledby="diario-titulo" className="mt-20">
      <h2 id="diario-titulo" className="text-center text-3xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {articles.map((article) => (
          <li key={article.title} className="overflow-hidden rounded-lg bg-card">
            <img src={article.image} alt="" width={300} height={220} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <div className="space-y-2 p-4">
              <p className="text-xs text-muted-foreground">
                {article.date} <span aria-hidden>|</span> Leitura de {article.read} min
              </p>
              <h3 className="font-bold leading-snug">{article.title}</h3>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
