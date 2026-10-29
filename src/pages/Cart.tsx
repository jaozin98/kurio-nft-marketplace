import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { BackButton } from '@/components/BackButton'
import { TrashIcon } from '@/components/icons'
import { RelatedNfts } from '@/components/RelatedNfts'
import { Stepper } from '@/components/Stepper'
import { useSession } from '@/features/auth/queries'
import {
  useApplyCoupon,
  useCart,
  useRemoveCoupon,
  useRemoveItem,
  useUpdateQuantity,
} from '@/features/cart/queries'
import { errorMessage } from '@/lib/api'
import { formatEth, fromUnits, toUnits } from '@/lib/eth'
import { editionOf } from '@/lib/nft'
import type { CartItem } from '@/types'

const columns = 'md:grid md:grid-cols-[1fr_100px_130px_100px_36px] md:items-center md:gap-3'

export function Cart() {
  const { data: user } = useSession()
  const userId = user?.id
  const { data: cart, isPending, isError, refetch } = useCart(userId)

  const updateQuantity = useUpdateQuantity(userId)
  const removeItem = useRemoveItem(userId)

  if (isError) {
    return (
      <div role="alert" className="py-24 text-center">
        <p>Não foi possível carregar o carrinho.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Tentar de novo
        </button>
      </div>
    )
  }

  if (!isPending && cart.items.length === 0) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">Seu carrinho está vazio</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          Explorar NFTs
        </Link>
      </div>
    )
  }

  const mutationError = updateQuantity.error ?? removeItem.error
  const inCart = cart?.items.map((item) => item.nft.id) ?? []

  return (
    <div className="py-6">
      <nav aria-label="Você está em" className="text-sm max-md:hidden">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>
        <span aria-hidden> / </span>
        <Link to="/" hash="catalogo" className="hover:text-primary">
          Mercado
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Carrinho</span>
      </nav>

      <div className="flex items-center gap-3 md:block">
        <BackButton />
        <h1 className="sr-only max-md:not-sr-only max-md:flex-1 max-md:pr-12 max-md:text-center max-md:text-xl max-md:font-bold">
          Carrinho de NFTs
        </h1>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section aria-label="Itens do carrinho">
          <div aria-hidden className={`${columns} hidden border-b border-border pb-3 text-sm font-bold`}>
            <span>NFTs</span>
            <span>Preço</span>
            <span>Edições</span>
            <span>Total</span>
            <span />
          </div>

          {isPending ? (
            <div aria-busy="true" className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border max-md:space-y-3 max-md:divide-y-0">
              {cart.items.map((item) => (
                <CartRow
                  key={`${item.nft.id}|${item.editionId}`}
                  item={item}
                  busy={updateQuantity.isPending || removeItem.isPending}
                  onQuantity={(quantity) =>
                    updateQuantity.mutate({ nftId: item.nft.id, editionId: item.editionId, quantity })
                  }
                  onRemove={() => removeItem.mutate({ nftId: item.nft.id, editionId: item.editionId })}
                />
              ))}
            </ul>
          )}

          <div aria-live="polite" className="mt-3 text-sm lg:min-h-6">
            {mutationError && (
              <p role="alert" className="text-destructive">
                {errorMessage(mutationError)}
              </p>
            )}
          </div>
        </section>

        <Summary userId={userId} />
      </div>

      <RelatedNfts title="Colecionadores também viram" excludeIds={inCart} />
    </div>
  )
}

function CartRow({
  item,
  busy,
  onQuantity,
  onRemove,
}: {
  item: CartItem
  busy: boolean
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  const { nft, editionId, quantity } = item
  const edition = editionOf(nft, editionId)
  const lineTotal = fromUnits(toUnits(nft.price) * BigInt(quantity))

  return (
    <li className={`${columns} flex flex-wrap items-center gap-x-4 gap-y-3 py-4 max-md:rounded-2xl max-md:bg-card max-md:p-3`}>
      <div className="flex min-w-0 basis-full items-center gap-3 md:basis-auto">
        <img src={nft.image} alt="" width={56} height={56} className="size-14 shrink-0 rounded-lg object-cover max-md:size-20 max-md:rounded-xl" />
        <div className="min-w-0">
          <Link to="/nft/$id" params={{ id: nft.id }} className="block truncate font-bold hover:underline">
            {nft.name}
          </Link>
          <p className="text-xs text-muted-foreground">
            ID do token: #{nft.id.padStart(4, '0')} · Edição {edition?.label}
          </p>
          <p className="text-xs text-muted-foreground md:hidden">{formatEth(nft.price)} por unidade</p>
        </div>
      </div>

      <p className="hidden text-sm md:block">
        <span className="sr-only">Preço </span>
        {formatEth(nft.price)}
      </p>

      <Stepper
        value={quantity}
        max={edition?.stock ?? 0}
        onChange={onQuantity}
        disabled={busy}
        label={`Quantidade de ${nft.name} (${edition?.label})`}
      />

      <p className="ml-auto text-sm font-bold text-primary md:ml-0">
        <span className="sr-only">Total </span>
        {formatEth(lineTotal)}
      </p>

      <button
        onClick={onRemove}
        disabled={busy}
        aria-label={`Remover ${nft.name} (${edition?.label})`}
        className="grid size-9 place-items-center rounded text-muted-foreground hover:text-destructive disabled:opacity-40"
      >
        <TrashIcon className="size-4" />
      </button>
    </li>
  )
}

function Summary({ userId }: { userId: string | undefined }) {
  const { data: cart } = useCart(userId)
  const applyCoupon = useApplyCoupon(userId)
  const removeCoupon = useRemoveCoupon(userId)
  const [code, setCode] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!code.trim()) return
    applyCoupon.mutate(code, { onSuccess: () => setCode('') })
  }

  const quote = cart?.quote

  return (
    <aside aria-label="Resumo da carteira" className="h-fit rounded-lg bg-card p-5 max-md:rounded-3xl">
      <h2 className="text-lg font-bold">Resumo da carteira</h2>

      {cart?.coupon ? (
        <div className="mt-4 flex items-center justify-between rounded bg-muted px-3 py-2 text-sm">
          <span>
            Cupom <strong>{cart.coupon}</strong>
          </span>
          <button
            onClick={() => removeCoupon.mutate()}
            disabled={removeCoupon.isPending}
            className="text-muted-foreground underline"
          >
            Remover
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4">
          <label htmlFor="cupom" className="mb-1 block text-xs text-muted-foreground">
            Código promocional
          </label>
          <div className="flex gap-2">
            <input
              id="cupom"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Digite o código…"
              aria-invalid={applyCoupon.isError}
              aria-describedby={applyCoupon.isError ? 'cupom-erro' : undefined}
              className="w-full min-w-0 rounded border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={applyCoupon.isPending}
              className="cta rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
          {applyCoupon.isError && (
            <p id="cupom-erro" role="alert" className="mt-1 text-sm text-destructive">
              {errorMessage(applyCoupon.error)}
            </p>
          )}
        </form>
      )}

      <dl className="mt-5 space-y-2 text-sm">
        <Line label="Subtotal" value={quote?.subtotal} />
        <Line label="Desconto do lançamento" value={quote?.discount} negative />
        <Line label="Taxa de rede" value={quote?.networkFee} hint="Taxa estimada" />
        <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
          <dt>Total</dt>
          <dd className="text-primary">{quote ? formatEth(quote.total) : <Placeholder />}</dd>
        </div>
      </dl>

      <Link
        to="/checkout"
        className="cta mt-5 block w-full rounded bg-primary py-3 text-center font-bold text-primary-foreground"
      >
        Conectar e finalizar
      </Link>
      <Link to="/" className="mt-3 block text-center text-sm text-muted-foreground underline">
        Continuar explorando
      </Link>
    </aside>
  )
}

function Line({
  label,
  value,
  negative,
  hint,
}: {
  label: string
  value?: string
  negative?: boolean
  hint?: string
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        {value === undefined ? (
          <Placeholder />
        ) : negative && value !== '0' ? (
          `− ${formatEth(value)}`
        ) : (
          formatEth(value)
        )}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  )
}

// mantém a largura do valor enquanto carrega, sem pular o layout
function Placeholder() {
  return <Skeleton as="span" className="inline-block h-4 w-20 rounded align-middle" />
}
