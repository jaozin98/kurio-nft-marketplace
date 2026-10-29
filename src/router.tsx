import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { z } from 'zod'
import { getToken } from '@/lib/session'
import { Layout } from '@/components/Layout'
import { Cart } from '@/pages/Cart'
import { Checkout } from '@/pages/Checkout'
import { Explorer } from '@/pages/Explorer'
import { Favorites } from '@/pages/Favorites'
import { Home } from '@/pages/Home'
import { Login } from '@/pages/Login'
import { Profile } from '@/pages/Profile'
import { Register } from '@/pages/Register'
import { Wallets } from '@/pages/Wallets'
import { NftDetail } from '@/pages/NftDetail'
import { OrderPage } from '@/pages/OrderPage'

const homeSearch = z.object({
  q: z.string().optional(),
  tab: z.enum(['all', 'new', 'trending']).catch('all').default('all'),
  collection: z.array(z.string()).optional(),
  rarity: z.enum(['comum', 'raro', 'lendario']).optional().catch(undefined),
  network: z.enum(['ethereum', 'polygon', 'solana']).optional().catch(undefined),
  min: z.string().optional(),
  max: z.string().optional(),
  sort: z
    .enum(['recent', 'price-asc', 'price-desc', 'name'])
    .catch('recent')
    .default('recent'),
  page: z.coerce.number().int().min(1).catch(1).default(1),
})

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
  notFoundComponent: () => (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Voltar para o início
      </Link>
    </div>
  ),
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: homeSearch,
  component: Home,
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$id',
  component: NftDetail,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: Login,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: Register,
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: Cart,
})

// sem token nem tenta abrir a tela, manda direto para o login
function requireLogin(to: string) {
  if (!getToken()) throw redirect({ to: '/login', search: { redirect: to } })
}

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  beforeLoad: () => requireLogin('/checkout'),
  component: Checkout,
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$id',
  beforeLoad: ({ params }) => requireLogin(`/orders/${params.id}`),
  component: OrderPage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  beforeLoad: () => requireLogin('/profile'),
  component: Profile,
})

const explorerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tx/$hash',
  component: Explorer,
})

const favoritesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/favorites',
  beforeLoad: () => requireLogin('/favorites'),
  component: Favorites,
})

const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wallets',
  beforeLoad: () => requireLogin('/wallets'),
  component: Wallets,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  loginRoute,
  registerRoute,
  profileRoute,
  walletsRoute,
  favoritesRoute,
  explorerRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
