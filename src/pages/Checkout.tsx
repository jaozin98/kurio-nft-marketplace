import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Field } from '@/components/Field'
import { useSession } from '@/features/auth/queries'
import { useCart } from '@/features/cart/queries'
import {
  orderError,
  pendingAttempt,
  quoteKey,
  quoteOptions,
  useCreateOrder,
  useQuote,
} from '@/features/orders/queries'
import {
  useConnectWallet,
  useDisconnectWallet,
  useWallets,
} from '@/features/wallets/queries'
import { errorMessage } from '@/lib/api'
import { formatEth } from '@/lib/eth'
import { editionOf } from '@/lib/nft'
import { queryClient } from '@/lib/queryClient'
import type { NetworkId } from '@/types'

const networks: { id: NetworkId; label: string }[] = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'arbitrum', label: 'Arbitrum' },
]

type Form = {
  name: string
  username: string
  email: string
  notes: string
  walletId: string
  network: NetworkId
}

const formKey = (userId: string) => `checkout-form:${userId}`

// guarda o formulário para retomar depois de uma sessão expirada
function loadForm(userId: string): Form {
  try {
    const saved = sessionStorage.getItem(formKey(userId))
    if (saved) return JSON.parse(saved)
  } catch {
    // usa o valor padrão
  }
  return { name: '', username: '', email: '', notes: '', walletId: '', network: 'ethereum' }
}

export function Checkout() {
  const { data: user } = useSession()

  if (user === undefined) return <div className="shimmer mx-auto mt-8 h-96 max-w-2xl rounded-lg" />
  if (user === null) return <Navigate to="/login" search={{ redirect: '/checkout' }} />

  return <CheckoutFlow userId={user.id} userName={user.name} userEmail={user.email} />
}

function CheckoutFlow({
  userId,
  userName,
  userEmail,
}: {
  userId: string
  userName: string
  userEmail: string
}) {
  const navigate = useNavigate()
  const { data: cart, isPending: cartPending } = useCart(userId)
  const { data: walletData } = useWallets(userId)
  const connect = useConnectWallet(userId)
  const disconnect = useDisconnectWallet(userId)
  const createOrder = useCreateOrder(userId)

  const [form, setForm] = useState<Form>(() => {
    const saved = loadForm(userId)
    return {
      ...saved,
      name: saved.name || userName,
      email: saved.email || userEmail,
      // sugestão de usuário a partir do e-mail; dá para editar
      username: saved.username || userEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20),
      notes: saved.notes ?? '',
    }
  })
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [errors, setErrors] = useState<Record<string, string>>({})
  // total que o usuário viu e aceitou; se a cotação mudar, precisa confirmar de novo
  const [reviewed, setReviewed] = useState<string | null>(null)
  const sending = useRef(false)

  const wallets = walletData?.wallets ?? []
  const connectedId = walletData?.connectedId ?? null
  const walletId = form.walletId || wallets.find((item) => item.primary)?.id || ''
  const connected = !!walletId && connectedId === walletId

  const quote = useQuote(userId, form.network, step === 'review')

  const currentTotal = quote.data?.quote.total ?? null
  // se um item perdeu estoque (evento em tempo real), a compra fica bloqueada até ajustar o carrinho
  const unavailable = quote.data?.items.find(
    ({ nft, editionId, quantity }) => quantity > (editionOf(nft, editionId)?.stock ?? 0),
  )
  const stale = reviewed !== null && currentTotal !== null && currentTotal !== reviewed

  useEffect(() => {
    sessionStorage.setItem(formKey(userId), JSON.stringify(form))
  }, [form, userId])

  function set<K extends keyof Form>(field: K, value: Form[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function goToReview() {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Informe o nome completo'
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) next.username = 'Use de 3 a 20 letras, números ou _'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Digite um e-mail válido'
    if (form.notes.length > 280) next.notes = 'Use até 280 caracteres'
    if (!connected) next.wallet = 'Conecte a carteira escolhida para continuar'
    setErrors(next)
    if (Object.keys(next).length) return
    createOrder.reset()
    // o total que o usuário vai ver é o da cotação buscada agora, não um valor antigo em cache
    try {
      const fresh = await queryClient.fetchQuery(quoteOptions(userId, form.network))
      setReviewed(fresh.quote.total)
    } catch {
      setReviewed(null)
    }
    setStep('review')
  }

  function confirm() {
    // evita pedido duplicado em cliques repetidos
    if (sending.current || !quote.data || stale || unavailable) return
    sending.current = true

    createOrder.mutate(
      {
        walletId,
        network: form.network,
        expectedTotal: quote.data.quote.total,
        collector: {
          name: form.name.trim(),
          username: form.username,
          email: form.email,
          notes: form.notes.trim(),
        },
      },
      {
        onSuccess: (order) => {
          sessionStorage.removeItem(formKey(userId))
          navigate({ to: '/orders/$id', params: { id: order.id } })
        },
        onError: (error) => {
          const info = orderError(error)
          if (info?.code === 'quote_changed' && info.cart) {
            // o total novo deixa a cotação "desatualizada" e pede nova confirmação
            queryClient.setQueryData(quoteKey(userId, form.network), info.cart)
          }
          if (info?.code === 'validation' && info.errors) {
            setErrors(info.errors)
            setStep('form')
          }
        },
        onSettled: () => {
          sending.current = false
        },
      },
    )
  }

  if (cartPending) return <div className="shimmer mx-auto mt-8 h-96 max-w-2xl rounded-lg" />

  if (!cart || cart.items.length === 0) {
    // o carrinho esvaziou depois do envio: o pedido pode ter sido criado e a resposta perdida
    const attempt = pendingAttempt(userId)
    if (attempt) {
      return (
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="text-2xl font-semibold">Há um pedido em andamento</h1>
          <p className="mt-3 text-muted-foreground">
            Não recebemos a resposta do último envio. Recupere o pedido: ele não será cobrado
            duas vezes.
          </p>
          {createOrder.isError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Não foi possível recuperar agora. Tente de novo.
            </p>
          )}
          <button
            onClick={() =>
              createOrder.mutate(attempt, {
                onSuccess: (order) => navigate({ to: '/orders/$id', params: { id: order.id } }),
              })
            }
            disabled={createOrder.isPending}
            className="mt-6 rounded bg-primary px-5 py-3 font-medium text-primary-foreground disabled:opacity-50"
          >
            {createOrder.isPending ? 'Recuperando…' : 'Recuperar pedido'}
          </button>
        </div>
      )
    }

    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-semibold">Não há itens para pagar</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          Explorar NFTs
        </Link>
      </div>
    )
  }

  const failure = createOrder.isError ? orderError(createOrder.error) : null
  const noResponse = createOrder.isError && !failure

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-bold">Pagamento</h1>

      {step === 'form' ? (
        <div className="mt-8 space-y-8">
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">Dados do colecionador</legend>
            <Field
              id="nome"
              label="Nome completo"
              value={form.name}
              error={errors.name}
              onChange={(value) => set('name', value)}
              autoComplete="name"
            />
            <Field
              id="usuario"
              label="Nome de usuário"
              value={form.username}
              error={errors.username}
              onChange={(value) => set('username', value)}
              autoComplete="username"
            />
            <Field
              id="email"
              label="E-mail"
              type="email"
              value={form.email}
              error={errors.email}
              onChange={(value) => set('email', value)}
              autoComplete="email"
            />
            <div>
              <label htmlFor="observacao" className="mb-1 block text-sm">
                Observação do colecionador (opcional)
              </label>
              <textarea
                id="observacao"
                rows={3}
                maxLength={300}
                value={form.notes}
                onChange={(event) => set('notes', event.target.value)}
                aria-invalid={!!errors.notes}
                aria-describedby={errors.notes ? 'observacao-erro' : 'observacao-ajuda'}
                className="w-full rounded border border-input bg-card px-3 py-2 text-sm"
              />
              <p id="observacao-ajuda" className="mt-1 text-xs text-muted-foreground">
                {form.notes.length}/280 caracteres
              </p>
              {errors.notes && (
                <p id="observacao-erro" className="mt-1 text-sm text-destructive">
                  {errors.notes}
                </p>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-lg font-semibold">Carteira</legend>
            {walletData && wallets.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Você ainda não cadastrou nenhuma carteira.{' '}
                <Link to="/wallets" className="text-primary underline">
                  Cadastrar carteira
                </Link>
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {wallets.map((wallet) => (
                <li key={wallet.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded border border-border p-3">
                    <input
                      type="radio"
                      name="carteira"
                      checked={walletId === wallet.id}
                      onChange={() => set('walletId', wallet.id)}
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">
                        {wallet.label}{' '}
                        <span className="font-normal text-muted-foreground">
                          ({wallet.primary ? 'principal' : 'secundária'})
                        </span>
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}
                      </span>
                    </span>
                    {connectedId === wallet.id && (
                      <span className="text-xs text-primary">Conectada</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center gap-3">
              {connected ? (
                <button
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                  className="rounded border border-border px-4 py-2 text-sm"
                >
                  Desconectar
                </button>
              ) : (
                <button
                  onClick={() => connect.mutate(walletId)}
                  disabled={!walletId || connect.isPending}
                  className="rounded border border-primary px-4 py-2 text-sm text-primary disabled:opacity-50"
                >
                  {connect.isPending ? 'Conectando…' : 'Conectar carteira'}
                </button>
              )}
              <div aria-live="polite" className="text-sm text-destructive">
                {connect.isError && <p role="alert">{errorMessage(connect.error)}</p>}
                {errors.wallet && !connect.isError && <p role="alert">{errors.wallet}</p>}
              </div>
            </div>
          </fieldset>

          <div>
            <label htmlFor="rede" className="mb-1 block text-lg font-semibold">
              Rede
            </label>
            <select
              id="rede"
              value={form.network}
              onChange={(event) => set('network', event.target.value as NetworkId)}
              className="w-full rounded border border-input bg-card px-3 py-2"
            >
              {networks.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={goToReview}
            className="w-full rounded bg-primary py-3 font-medium text-primary-foreground"
          >
            Revisar pedido
          </button>
        </div>
      ) : (
        <section aria-label="Revisão do pedido" className="mt-8 space-y-6">
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 text-sm">
            <dt className="text-muted-foreground">Colecionador</dt>
            <dd>
              {form.name} (@{form.username}) · {form.email}
            </dd>
            {form.notes.trim() && (
              <>
                <dt className="text-muted-foreground">Observação</dt>
                <dd className="break-words">{form.notes.trim()}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Carteira</dt>
            <dd>{wallets.find((item) => item.id === walletId)?.label}</dd>
            <dt className="text-muted-foreground">Rede</dt>
            <dd>{networks.find((item) => item.id === form.network)?.label}</dd>
          </dl>

          {quote.isPending ? (
            <div aria-busy="true" className="shimmer h-40 rounded-lg" />
          ) : quote.isError ? (
            <p role="alert" className="text-destructive">
              Não foi possível calcular o pedido.{' '}
              <button onClick={() => quote.refetch()} className="underline">
                Tentar de novo
              </button>
            </p>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4">
              <ul className="space-y-2 text-sm">
                {quote.data.items.map(({ nft, editionId, quantity }) => (
                  <li key={`${nft.id}|${editionId}`} className="flex justify-between">
                    <span>
                      {quantity} × {nft.name} ({editionOf(nft, editionId)?.label})
                    </span>
                    <span className="font-mono">{formatEth(nft.price)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                <Row label="Subtotal" value={quote.data.quote.subtotal} />
                <Row label="Desconto" value={quote.data.quote.discount} />
                <Row label="Taxa de rede" value={quote.data.quote.networkFee} />
                <div className="flex justify-between pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="font-mono">{formatEth(quote.data.quote.total)}</dd>
                </div>
              </dl>
            </div>
          )}

          <div aria-live="polite" className="space-y-2 text-sm">
            {unavailable && (
              <p role="alert" className="rounded border border-destructive p-3 text-destructive">
                {unavailable.nft.name} ({editionOf(unavailable.nft, unavailable.editionId)?.label})
                não está mais disponível na quantidade escolhida.{' '}
                <Link to="/cart" className="underline">
                  Ajustar carrinho
                </Link>
              </p>
            )}
            {stale && currentTotal && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded border border-primary p-3">
                <p className="flex-1">
                  Os valores mudaram. O novo total é <strong>{formatEth(currentTotal)}</strong>.
                  Confira e confirme novamente.
                </p>
                <button
                  onClick={() => setReviewed(currentTotal)}
                  className="rounded border border-primary px-3 py-1 text-primary"
                >
                  Aceitar novo valor
                </button>
              </div>
            )}
            {failure && failure.code !== 'quote_changed' && (
              <p role="alert" className="text-destructive">
                {failure.message}{' '}
                {failure.code === 'unavailable' && (
                  <Link to="/cart" className="underline">
                    Ajustar carrinho
                  </Link>
                )}
              </p>
            )}
            {noResponse && (
              <p role="alert" className="text-destructive">
                Não recebemos resposta do servidor. Seu pedido pode ter sido criado; ao tentar de
                novo, ele não será duplicado.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('form')}
              disabled={createOrder.isPending}
              className="rounded border border-border px-5 py-3"
            >
              Voltar
            </button>
            <button
              onClick={confirm}
              disabled={createOrder.isPending || !quote.data || stale || !!unavailable}
              className="flex-1 rounded bg-primary py-3 font-medium text-primary-foreground disabled:opacity-50"
            >
              {createOrder.isPending
                ? 'Enviando pedido…'
                : noResponse
                  ? 'Tentar de novo'
                  : 'Confirmar compra'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono">{formatEth(value)}</dd>
    </div>
  )
}
