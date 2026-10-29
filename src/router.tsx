import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { z } from 'zod'
import { getToken } from '@/lib/session'
import { Layout } from '@/components/Layout'
import { Home } from '@/pages/Home'
import { NftDetail } from '@/pages/NftDetail'

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
  component: lazyRouteComponent(() => import('@/pages/Login'), 'Login'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: lazyRouteComponent(() => import('@/pages/Register'), 'Register'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: lazyRouteComponent(() => import('@/pages/Cart'), 'Cart'),
})

// sem token nem tenta abrir a tela, manda direto para o login
function requireLogin(to: string) {
  if (!getToken()) throw redirect({ to: '/login', search: { redirect: to } })
}

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  beforeLoad: () => requireLogin('/checkout'),
  component: lazyRouteComponent(() => import('@/pages/Checkout'), 'Checkout'),
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$id',
  beforeLoad: ({ params }) => requireLogin(`/orders/${params.id}`),
  component: lazyRouteComponent(() => import('@/pages/OrderPage'), 'OrderPage'),
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  beforeLoad: () => requireLogin('/profile'),
  component: lazyRouteComponent(() => import('@/pages/Profile'), 'Profile'),
})

const explorerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tx/$hash',
  component: lazyRouteComponent(() => import('@/pages/Explorer'), 'Explorer'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/favorites',
  beforeLoad: () => requireLogin('/favorites'),
  component: lazyRouteComponent(() => import('@/pages/Favorites'), 'Favorites'),
})

const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wallets',
  beforeLoad: () => requireLogin('/wallets'),
  component: lazyRouteComponent(() => import('@/pages/Wallets'), 'Wallets'),
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

// Início e detalhe ficam no pacote principal (são as telas de entrada); as demais carregam sob demanda
export const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
