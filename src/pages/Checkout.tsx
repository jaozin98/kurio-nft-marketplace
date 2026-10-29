import { Skeleton } from "@/components/ui/skeleton"
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { BackButton } from '@/components/BackButton'
import { WalletFormFields } from '@/components/WalletFormFields'
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
import { formatEth, fromUnits, toUnits } from '@/lib/eth'
import { trapFocus } from '@/lib/focusTrap'
import { editionOf } from '@/lib/nft'
import { queryClient } from '@/lib/queryClient'
import { networkLabels, providerLabels, validateCollector } from '@/lib/validation'
import type { Collector, NetworkId, User, Wallet } from '@/types'

type Saved = { edited: Record<string, string>; walletId: string; useOther: boolean }

const formKey = (userId: string) => `checkout-form:${userId}`

// guarda o formulário para retomar depois de uma sessão expirada
function loadSaved(userId: string): Saved {
  try {
    const saved = sessionStorage.getItem(formKey(userId))
    if (saved) return JSON.parse(saved)
  } catch {
    // usa o valor padrão
  }
  return { edited: {}, walletId: '', useOther: false }
}

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

// valores iniciais: dados da conta e da carteira escolhida
function baseValues(user: User, wallet: Wallet | undefined): Record<string, string> {
  return {
    displayName: wallet?.displayName ?? user.name,
    username: user.username,
    network: wallet?.network ?? '',
    profileName: wallet?.profileName ?? user.username,
    address: wallet?.address ?? '',
    altAddress: wallet?.altAddress ?? '',
    provider: wallet?.provider ?? '',
    referralCode: wallet?.referralCode ?? '',
    email: wallet?.email ?? user.email,
    ens: wallet?.ens ?? user.ens,
    notes: '',
  }
}

export function Checkout() {
  const { data: user } = useSession()

  if (user === undefined) return <Skeleton className="mx-auto mt-8 h-96 max-w-2xl rounded-lg" />
  if (user === null) return <Navigate to="/login" search={{ redirect: '/checkout' }} />

  return <CheckoutFlow user={user} />
}

function CheckoutFlow({ user }: { user: User }) {
  const userId = user.id
  const navigate = useNavigate()
  const { data: cart, isPending: cartPending } = useCart(userId)
  const { data: walletData } = useWallets(userId)
  const connect = useConnectWallet(userId)
  const disconnect = useDisconnectWallet(userId)
  const createOrder = useCreateOrder(userId)

  const [saved] = useState(() => loadSaved(userId))
  const [edited, setEdited] = useState(saved.edited)
  const [walletChoice, setWalletChoice] = useState(saved.walletId)
  const [useOther, setUseOther] = useState(saved.useOther)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [reviewOpen, setReviewOpen] = useState(false)
  // total que o usuário viu e aceitou; se a cotação mudar, precisa confirmar de novo
  const [reviewed, setReviewed] = useState<string | null>(null)
  const sending = useRef(false)

  const wallets = walletData?.wallets ?? []
  const connectedId = walletData?.connectedId ?? null
  const walletId = walletChoice || wallets.find((item) => item.primary)?.id || ''
  const wallet = wallets.find((item) => item.id === walletId)
  const connected = !!walletId && connectedId === walletId

  const values = { ...baseValues(user, wallet), ...edited }
  const network = (values.network || 'ethereum') as NetworkId

  // a cotação do resumo acompanha a rede escolhida
  const quote = useQuote(userId, network, true)
  const currentTotal = quote.data?.quote.total ?? null

  // se um item perdeu estoque (evento em tempo real), a compra fica bloqueada até ajustar o carrinho
  const unavailable = quote.data?.items.find(
    ({ nft, editionId, quantity }) => quantity > (editionOf(nft, editionId)?.stock ?? 0),
  )
  const stale = reviewed !== null && currentTotal !== null && currentTotal !== reviewed

  useEffect(() => {
    sessionStorage.setItem(formKey(userId), JSON.stringify({ edited, walletId: walletChoice, useOther }))
  }, [edited, walletChoice, useOther, userId])

  function change(name: string, value: string) {
    setEdited((current) => ({ ...current, [name]: value }))
  }

  function chooseWallet(id: string) {
    setWalletChoice(id)
    // os dados da carteira nova substituem os da anterior; usuário e observação ficam
    setEdited((current) => {
      const keep: Record<string, string> = {}
      if (current.username) keep.username = current.username
      if (current.notes) keep.notes = current.notes
      return keep
    })
  }

  async function goToReview() {
    const next: Record<string, string | undefined> = validateCollector(values as Partial<Collector>)
    if (!connected) next.wallet = 'Conecte a carteira escolhida para continuar'
    if (useOther && !values.altAddress.trim()) {
      next.altAddress = 'Informe o ENS ou a carteira secundária'
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    createOrder.reset()
    // o total que o usuário vai ver é o da cotação buscada agora, não um valor antigo em cache
    try {
      const fresh = await queryClient.fetchQuery(quoteOptions(userId, network))
      setReviewed(fresh.quote.total)
    } catch {
      setReviewed(null)
    }
    setReviewOpen(true)
  }

  function confirm() {
    // evita pedido duplicado em cliques repetidos
    if (sending.current || !quote.data || stale || unavailable) return
    sending.current = true

    createOrder.mutate(
      {
        walletId,
        network,
        expectedTotal: quote.data.quote.total,
        collector: {
          displayName: values.displayName.trim(),
          username: values.username,
          network,
          profileName: values.profileName,
          address: values.address,
          altAddress: useOther ? values.altAddress.trim() : '',
          provider: values.provider as Collector['provider'],
          referralCode: values.referralCode,
          email: values.email,
          ens: values.ens,
          notes: values.notes.trim(),
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
            queryClient.setQueryData(quoteKey(userId, network), info.cart)
          }
          if (info?.code === 'validation' && info.errors) {
            setErrors(info.errors)
            setReviewOpen(false)
          }
        },
        onSettled: () => {
          sending.current = false
        },
      },
    )
  }

  if (cartPending) return <Skeleton className="mx-auto mt-8 h-96 max-w-2xl rounded-lg" />

  if (!cart || cart.items.length === 0) {
    // o carrinho esvaziou depois do envio: o pedido pode ter sido criado e a resposta perdida
    const attempt = pendingAttempt(userId)
    if (attempt) {
      return (
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="text-2xl font-bold">Há um pedido em andamento</h1>
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
            className="mt-6 rounded bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
          >
            {createOrder.isPending ? 'Recuperando…' : 'Recuperar pedido'}
          </button>
        </div>
      )
    }

    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">Não há itens para pagar</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          Explorar NFTs
        </Link>
      </div>
    )
  }

  const failure = createOrder.isError ? orderError(createOrder.error) : null
  const noResponse = createOrder.isError && !failure

  return (
    <div className="py-6">
      <nav aria-label="Você está em" className="text-sm max-md:hidden">
        <Link to="/" className="hover:text-primary">Início</Link>
        <span aria-hidden> / </span>
        <Link to="/" hash="catalogo" className="hover:text-primary">Mercado</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Pagamento</span>
      </nav>

      <div className="flex items-center gap-3 md:block">
        <BackButton />
        <h1 className="sr-only max-md:not-sr-only max-md:flex-1 max-md:pr-12 max-md:text-center max-md:text-xl max-md:font-bold">
          Pagamento<span className="md:sr-only"> com carteira</span>
        </h1>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <form
          id="pagamento"
          noValidate
          aria-labelledby="perfil-colecionador"
          onSubmit={(event) => {
            event.preventDefault()
            void goToReview()
          }}
          className="space-y-6"
        >
          <h2 id="perfil-colecionador" className="text-lg font-bold">
            Perfil do colecionador
          </h2>

          {/* no mobile o Figma mostra os provedores como lista antes do formulário */}
          <div role="radiogroup" aria-label="Provedor da carteira" className="grid gap-2 md:hidden">
            {Object.entries(providerLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={values.provider === key}
                onClick={() => change('provider', key)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm ${
                  values.provider === key ? 'border-primary font-bold text-primary' : 'border-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <WalletFormFields
            idPrefix="pgto"
            variant="checkout"
            values={values}
            errors={errors}
            onChange={change}
            lockAddress
          />

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={useOther} onChange={(event) => setUseOther(event.target.checked)} />
            Usar outra carteira?
          </label>

          <div>
            <label htmlFor="observacao" className="mb-1.5 block text-sm">
              Observação do colecionador (opcional)
            </label>
            <textarea
              id="observacao"
              rows={5}
              maxLength={300}
              value={values.notes}
              onChange={(event) => change('notes', event.target.value)}
              aria-invalid={!!errors.notes}
              aria-describedby={errors.notes ? 'observacao-erro' : 'observacao-ajuda'}
              className="w-full rounded border border-input bg-card px-3 py-2 text-sm"
            />
            <p id="observacao-ajuda" className="mt-1 text-xs text-muted-foreground">
              {values.notes.length}/280 caracteres
            </p>
            {errors.notes && (
              <p id="observacao-erro" className="mt-1 text-sm text-destructive">
                {errors.notes}
              </p>
            )}
          </div>
        </form>

        <aside aria-label="Resumo do pedido" className="h-fit space-y-6 max-lg:order-first">
          <section aria-labelledby="seus-nfts">
            <h2 id="seus-nfts" className="text-lg font-bold">
              Seus NFTs
            </h2>
            <div className="mt-2 flex justify-between border-b border-border pb-2 text-sm font-bold">
              <span>NFTs</span>
              <span>Subtotal</span>
            </div>
            <ul className="mt-2 space-y-2">
              {quote.isPending
                ? [0, 1].map((i) => <Skeleton as="li" key={i} aria-hidden className="h-14 rounded" />)
                : quote.data?.items.map(({ nft, editionId, quantity }) => (
                    <li key={`${nft.id}|${editionId}`} className="flex items-center gap-3 rounded bg-card p-2">
                      <img src={nft.image} alt="" width={44} height={44} className="size-11 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{nft.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ID do token: #{nft.id.padStart(4, '0')} · Edição {editionOf(nft, editionId)?.label}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">(x {quantity})</span>
                      <span className="text-sm font-bold text-primary">
                        {formatEth(fromUnits(toUnits(nft.price) * BigInt(quantity)))}
                      </span>
                    </li>
                  ))}
            </ul>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Tem um código promocional?{' '}
              <Link to="/cart" className="text-primary underline">
                Aplique aqui
              </Link>
            </p>

            {quote.data && (
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Subtotal" value={formatEth(quote.data.quote.subtotal)} />
                <Row label="Desconto do lançamento" value={`(-) ${quote.data.quote.discount === '0' ? '0.00' : formatEth(quote.data.quote.discount)}`} />
                <Row label="Taxa de rede" value={formatEth(quote.data.quote.networkFee)} hint="Taxa estimada" />
                <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
                  <dt>Total</dt>
                  <dd className="text-primary">{formatEth(quote.data.quote.total)}</dd>
                </div>
              </dl>
            )}
          </section>

          <fieldset>
            <legend className="mb-3 text-lg font-bold">Carteira e rede</legend>
            {walletData && wallets.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Você ainda não cadastrou nenhuma carteira.{' '}
                <Link to="/wallets" className="text-primary underline">
                  Cadastrar carteira
                </Link>
              </p>
            )}
            <ul className="space-y-2">
              {wallets.map((item) => (
                <li key={item.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded border p-3 max-md:rounded-2xl ${
                      walletId === item.id ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="carteira"
                      checked={walletId === item.id}
                      onChange={() => chooseWallet(item.id)}
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-bold">
                        {item.nickname}{' '}
                        <span className="font-normal text-muted-foreground">
                          ({item.primary ? 'principal' : 'secundária'})
                        </span>
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {shortAddress(item.address)} · {providerLabels[item.provider]} · Rede{' '}
                        {networkLabels[item.network]}
                      </span>
                    </span>
                    {connectedId === item.id && <span className="text-xs text-primary">Conectada</span>}
                  </label>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {connected ? (
                <button
                  type="button"
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                  className="rounded border border-border px-4 py-2 text-sm"
                >
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
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

          <button
            type="submit"
            form="pagamento"
            className="cta w-full rounded bg-primary py-3 font-bold text-primary-foreground"
          >
            Revisar pedido
          </button>
        </aside>
      </div>

      <ReviewDialog
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onConfirm={confirm}
        values={values}
        wallet={wallet}
        network={network}
        quote={quote.data}
        pending={createOrder.isPending}
        stale={stale}
        unavailable={unavailable}
        currentTotal={currentTotal}
        onAccept={() => setReviewed(currentTotal)}
        failure={failure}
        noResponse={noResponse}
      />
    </div>
  )
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        {value}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  )
}

type ReviewProps = {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  values: Record<string, string>
  wallet?: Wallet
  network: NetworkId
  quote?: ReturnType<typeof useQuote>['data']
  pending: boolean
  stale: boolean
  unavailable?: { nft: { name: string }; editionId: string }
  currentTotal: string | null
  onAccept: () => void
  failure: ReturnType<typeof orderError>
  noResponse: boolean
}

// revisão antes do envio, num modal (foco preso, Esc volta ao formulário)
function ReviewDialog(props: ReviewProps) {
  const { open, onCancel, onConfirm, values, wallet, network, quote, pending, stale, unavailable } = props
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="revisao-titulo"
      onClose={onCancel}
      onKeyDown={trapFocus}
      className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-md border border-border bg-card p-0 text-foreground backdrop:bg-black/70 max-md:m-0 max-md:ml-auto max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none"
    >
      <div className="space-y-5 p-6">
        <h2 id="revisao-titulo" className="text-xl font-bold">
          Revise seu pedido
        </h2>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded bg-secondary p-4 text-sm">
          <dt className="text-muted-foreground">Colecionador</dt>
          <dd>
            {values.displayName} (@{values.username}) · {values.email}
          </dd>
          <dt className="text-muted-foreground">Carteira</dt>
          <dd>
            {wallet?.nickname} · {providerLabels[(values.provider || 'metamask') as keyof typeof providerLabels]}
          </dd>
          <dt className="text-muted-foreground">Rede</dt>
          <dd>{networkLabels[network]}</dd>
          {values.notes.trim() && (
            <>
              <dt className="text-muted-foreground">Observação</dt>
              <dd className="break-words">{values.notes.trim()}</dd>
            </>
          )}
        </dl>

        {!quote ? (
          <Skeleton aria-busy="true" className="h-32 rounded" />
        ) : (
          <div>
            <ul className="space-y-1 text-sm">
              {quote.items.map(({ nft, editionId, quantity }) => (
                <li key={`${nft.id}|${editionId}`} className="flex justify-between">
                  <span>
                    {quantity} × {nft.name} ({editionOf(nft, editionId)?.label})
                  </span>
                  <span>{formatEth(nft.price)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <Row label="Subtotal" value={formatEth(quote.quote.subtotal)} />
              <Row label="Desconto" value={formatEth(quote.quote.discount)} />
              <Row label="Taxa de rede" value={formatEth(quote.quote.networkFee)} />
              <div className="flex justify-between pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="text-primary">{formatEth(quote.quote.total)}</dd>
              </div>
            </dl>
          </div>
        )}

        <div aria-live="polite" className="space-y-2 text-sm">
          {unavailable && (
            <p role="alert" className="rounded border border-destructive p-3 text-destructive">
              {unavailable.nft.name} não está mais disponível na quantidade escolhida.{' '}
              <Link to="/cart" className="underline">
                Ajustar carrinho
              </Link>
            </p>
          )}
          {stale && props.currentTotal && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded border border-primary p-3">
              <p className="flex-1">
                Os valores mudaram. O novo total é <strong>{formatEth(props.currentTotal)}</strong>.
                Confira e confirme novamente.
              </p>
              <button
                type="button"
                onClick={props.onAccept}
                className="rounded border border-primary px-3 py-1 text-primary"
              >
                Aceitar novo valor
              </button>
            </div>
          )}
          {props.failure && props.failure.code !== 'quote_changed' && (
            <p role="alert" className="text-destructive">
              {props.failure.message}{' '}
              {props.failure.code === 'unavailable' && (
                <Link to="/cart" className="underline">
                  Ajustar carrinho
                </Link>
              )}
            </p>
          )}
          {props.noResponse && (
            <p role="alert" className="text-destructive">
              Não recebemos resposta do servidor. Seu pedido pode ter sido criado; ao tentar de
              novo, ele não será duplicado.
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            disabled={pending}
            className="rounded border border-border px-5 py-3"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending || !quote || stale || !!unavailable}
            className="cta flex-1 rounded bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Enviando pedido…' : props.noResponse ? 'Tentar de novo' : 'Confirmar compra'}
          </button>
        </div>
      </div>
      <div aria-hidden className="h-1.5 bg-primary" />
    </dialog>
  )
}
