import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { logout, useSession } from '@/features/auth/queries'
import { useCart } from '@/features/cart/queries'
import { CartIcon, LoginIcon, SearchIcon } from './icons'
import { LiveNotices } from './LiveNotices'
import { RealtimeSync } from './RealtimeSync'

const pageTitles: Record<string, string> = {
  '/': 'Marketplace de NFTs',
  '/cart': 'Carrinho',
  '/checkout': 'Pagamento',
  '/login': 'Entrar',
  '/register': 'Criar conta',
  '/profile': 'Perfil do colecionador',
  '/wallets': 'Carteiras',
}

const navLink = 'pb-1 text-base font-medium text-foreground transition-colors hover:text-primary'

export function Layout({ children }: { children: ReactNode }) {
  const { data: user } = useSession()
  const { data: cart } = useCart(user?.id)
  const { pathname, hash } = useRouterState({ select: (state) => state.location })
  // "Mercado" fica ativo no catálogo e nas telas de compra (produto, carrinho, pagamento, pedido)
  const inMarket =
    (pathname === '/' && hash === 'catalogo') || /^\/(nft|cart|checkout|orders)/.test(pathname)
  // o detalhe do NFT e o pedido definem o próprio título
  useEffect(() => {
    if (/^\/(nft|orders)\//.test(pathname)) return
    document.title = `${pageTitles[pathname] ?? 'Página não encontrada'} | Kurio`
  }, [pathname])

  const count = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  return (
    <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 md:px-12 xl:px-[120px]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:font-bold focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border py-5 lg:flex-nowrap">
        <Link to="/" className="text-base font-bold tracking-[0.15em]">
          KURIO
        </Link>

        <nav aria-label="Principal" className="order-last flex w-full gap-6 overflow-x-auto lg:order-none lg:w-auto lg:gap-8">
          <Link
            to="/"
            activeOptions={{ exact: true, includeHash: true, includeSearch: false }}
            activeProps={{ className: 'border-b-2 border-primary font-bold text-primary' }}
            className={navLink}
          >
            Início
          </Link>
          <Link
            to="/"
            hash="catalogo"
            aria-current={inMarket ? 'page' : undefined}
            className={inMarket ? `${navLink} border-b-2 border-primary font-bold text-primary` : navLink}
          >
            Mercado
          </Link>
          {/* páginas editoriais estão fora do escopo da entrega */}
          {['Criadores', 'Aprenda'].map((label) => (
            <span
              key={label}
              aria-disabled="true"
              title="Em breve"
              className="cursor-not-allowed pb-1 text-base font-medium text-foreground/50"
            >
              {label}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-4 text-sm">
          <Link to="/" hash="busca" aria-label="Buscar NFTs" className="p-1 hover:text-primary">
            <SearchIcon />
          </Link>

          <Link
            to="/cart"
            aria-label={count > 0 ? `Carrinho, ${count} itens` : 'Carrinho'}
            className="relative p-1 hover:text-primary"
          >
            <CartIcon />
            {count > 0 && (
              <span
                aria-hidden
                className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground"
              >
                {count}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/wallets" className="hidden hover:text-primary sm:inline">
                Carteiras
              </Link>
              <Link to="/profile" className="flex items-center gap-2 hover:text-primary">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="size-7 rounded-full object-cover" />
                ) : null}
                <span className="hidden sm:inline">{user.name}</span>
                <span className="sm:hidden">Perfil</span>
              </Link>
              <button onClick={logout} className="rounded border border-border px-3 py-2">
                Sair
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              search={{}}
              className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-base font-bold text-primary-foreground"
            >
              <LoginIcon />
              Entrar
            </Link>
          )}
        </div>
      </header>

      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <RealtimeSync />
      <LiveNotices />

      <footer className="mt-24 border-t border-border py-10 text-sm">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-base font-bold tracking-[0.15em]">KURIO</p>
            <p className="mt-3 text-muted-foreground">
              Marketplace de NFTs para colecionadores e criadores.
            </p>
          </div>
          <nav aria-label="Minha conta">
            <h2 className="mb-3 font-bold">Minha conta</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link to="/profile" className="hover:text-primary">Meu perfil</Link></li>
              <li><Link to="/wallets" className="hover:text-primary">Carteiras</Link></li>
              <li><Link to="/cart" className="hover:text-primary">Carrinho</Link></li>
            </ul>
          </nav>
          <nav aria-label="Coleções">
            <h2 className="mb-3 font-bold">Coleções</h2>
            <ul className="space-y-2 text-muted-foreground">
              {['Arte digital', 'Fotografia', 'Música', 'Arte 3D'].map((name) => (
                <li key={name}>
                  <Link to="/" search={{ collection: [name] }} hash="catalogo" className="hover:text-primary">
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="mb-3 font-bold">Ajuda</h2>
            <p className="text-muted-foreground">Suporte e páginas institucionais ficam fora desta entrega.</p>
          </div>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          © 2026 Kurio. Projeto de teste com dados simulados.
        </p>
      </footer>
    </div>
  )
}
