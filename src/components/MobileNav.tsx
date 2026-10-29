import { Link } from '@tanstack/react-router'
import { Heart, Home, Search, ShoppingCart, User } from 'lucide-react'

type Props = { cartCount: number; loggedIn: boolean }

const item =
  'relative grid size-11 place-items-center rounded-full text-muted-foreground transition-colors'
const active = { className: `${item} text-primary` }

// navegação do mobile: no Figma os ícones ficam numa barra arredondada na base da tela
export function MobileNav({ cartCount, loggedIn }: Props) {
  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-3xl bg-card px-5 py-2 shadow-[0_-8px_28px_rgba(0,0,0,0.55)] md:hidden"
    >
      <Link
        to="/"
        aria-label="Início"
        activeOptions={{ exact: true, includeSearch: false, includeHash: true }}
        activeProps={active}
        className={item}
      >
        <Home aria-hidden className="size-5" />
      </Link>

      <Link to="/favorites" aria-label="Lista de interesse" activeProps={active} className={item}>
        <Heart aria-hidden className="size-5" />
      </Link>

      <Link
        to="/"
        hash="busca"
        aria-label="Buscar NFTs"
        className="cta -mt-9 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
      >
        <Search aria-hidden className="size-6" />
      </Link>

      <Link
        to="/cart"
        aria-label={cartCount > 0 ? `Carrinho, ${cartCount} itens` : 'Carrinho'}
        activeProps={active}
        className={item}
      >
        <ShoppingCart aria-hidden className="size-5" />
        {cartCount > 0 && (
          <span
            aria-hidden
            className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground"
          >
            {cartCount}
          </span>
        )}
      </Link>

      {loggedIn ? (
        <Link to="/profile" aria-label="Perfil" activeProps={active} className={item}>
          <User aria-hidden className="size-5" />
        </Link>
      ) : (
        <Link to="/login" search={{}} aria-label="Entrar" activeProps={active} className={item}>
          <User aria-hidden className="size-5" />
        </Link>
      )}
    </nav>
  )
}
