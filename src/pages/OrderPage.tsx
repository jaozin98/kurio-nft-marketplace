import { Link, Navigate, useParams } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { MailCheck } from 'lucide-react'
import { useEffect } from 'react'
import { CloseIcon } from '@/components/icons'
import { useSession } from '@/features/auth/queries'
import { useOrder } from '@/features/orders/queries'
import { formatEth, fromUnits, toUnits } from '@/lib/eth'
import { queryClient } from '@/lib/queryClient'
import { networkLabels, providerLabels } from '@/lib/validation'

export function OrderPage() {
  const { id } = useParams({ from: '/orders/$id' })
  const { data: user } = useSession()
  const { data: order, isPending, error } = useOrder(id)

  const status = order?.status

  useEffect(() => {
    document.title = 'Pedido | Kurio'
  }, [])

  // quando o pedido termina, o carrinho e o catálogo mudaram no servidor
  useEffect(() => {
    if (status === 'confirmed') {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['nfts'] })
    }
  }, [status])

  if (user === null) return <Navigate to="/login" search={{ redirect: `/orders/${id}` }} />

  if (isPending) return <div aria-busy="true" className="shimmer mx-auto mt-8 h-96 max-w-xl rounded-lg" />

  if (error) {
    const code = isAxiosError(error) ? error.response?.status : undefined
    return (
      <div role="alert" className="py-24 text-center">
        <h1 className="text-2xl font-bold">
          {code === 404
            ? 'Pedido não encontrado'
            : code === 403
              ? 'Você não tem acesso a este pedido'
              : 'Erro ao carregar o pedido'}
        </h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          Voltar para o início
        </Link>
      </div>
    )
  }

  if (order.status === 'pending') {
    return (
      <div role="status" className="mx-auto max-w-xl py-24 text-center">
        <h1 className="text-2xl font-bold">Aguardando confirmação</h1>
        <p className="mt-3 text-muted-foreground">
          Seu pedido foi enviado e está sendo processado pela rede. Você pode recarregar esta
          página sem criar outra compra.
        </p>
      </div>
    )
  }

  if (order.status === 'declined') {
    return (
      <div role="alert" className="mx-auto max-w-xl py-24 text-center">
        <h1 className="text-2xl font-bold">Pagamento recusado</h1>
        <p className="mt-3 text-muted-foreground">{order.declineReason}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus itens continuam no carrinho. Nenhum valor foi cobrado.
        </p>
        <Link
          to="/checkout"
          className="mt-6 inline-block rounded bg-primary px-5 py-3 font-bold text-primary-foreground"
        >
          Tentar novamente
        </Link>
      </div>
    )
  }

  const hash = order.txHash ?? ''
  const date = new Date(order.createdAt)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/\./g, '')

  // confirmação como no Figma: um cartão centralizado com o resumo da transação
  return (
    <div className="py-8">
      <h1 className="sr-only">Pedido confirmado</h1>

      <article className="relative mx-auto w-[min(578px,100%)] overflow-hidden rounded-md border border-border bg-card">
        <Link
          to="/"
          aria-label="Fechar e voltar ao início"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded text-primary"
        >
          <CloseIcon className="size-4" />
        </Link>

        <div className="flex flex-col items-center gap-3 px-8 pb-6 pt-8 text-center">
          <MailCheck aria-hidden className="size-14 text-primary" strokeWidth={1.25} />
          <p className="text-sm text-muted-foreground">Seus NFTs agora estão na sua carteira</p>
        </div>

        <dl className="grid grid-cols-2 gap-4 border-y border-border px-8 py-3 text-xs sm:grid-cols-4">
          <Info label="ID da transação" value={`${hash.slice(0, 6)}…${hash.slice(-4)}`} />
          <Info label="Data" value={date} />
          <Info label="Total" value={formatEth(order.quote.total)} />
          <Info label="Carteira" value={providerLabels[order.wallet.provider]} />
        </dl>

        <section aria-labelledby="detalhes-transacao" className="px-8 py-5">
          <h2 id="detalhes-transacao" className="text-sm font-bold">
            Detalhes da transação
          </h2>

          <div aria-hidden className="mt-3 grid grid-cols-[1fr_56px_96px] gap-3 border-b border-border pb-2 text-xs font-bold">
            <span>NFTs</span>
            <span>Edições</span>
            <span className="text-right">Subtotal</span>
          </div>

          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={`${item.nftId}|${item.editionId}`} className="grid grid-cols-[1fr_56px_96px] items-center gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={item.image} alt="" width={36} height={36} className="size-9 rounded object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID do token: #{item.nftId.padStart(4, '0')} · Edição {item.editionLabel}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">(x {item.quantity})</span>
                <span className="text-right text-sm font-bold text-primary">
                  {formatEth(fromUnits(toUnits(item.price) * BigInt(item.quantity)))}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-2 space-y-1 text-right text-sm">
            <div className="flex justify-end gap-8">
              <dt className="text-muted-foreground">Desconto</dt>
              <dd className="w-24">{formatEth(order.quote.discount)}</dd>
            </div>
            <div className="flex justify-end gap-8">
              <dt className="text-muted-foreground">Taxa de rede</dt>
              <dd className="w-24">{formatEth(order.quote.networkFee)}</dd>
            </div>
            <div className="flex justify-end gap-8 font-bold">
              <dt>Total</dt>
              <dd className="w-24 text-primary">{formatEth(order.quote.total)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-4 px-8 pb-8 text-center">
          <p className="text-xs leading-5 text-muted-foreground">
            Transação confirmada na {networkLabels[order.wallet.network]}. A propriedade foi
            transferida para sua carteira conectada e registrada na rede.
          </p>
          <p className="break-all font-mono text-[10px] text-muted-foreground">{hash}</p>
          <Link
            to="/tx/$hash"
            params={{ hash }}
            className="inline-block rounded bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
          >
            Ver no Etherscan
          </Link>
        </div>
        <div aria-hidden className="h-1.5 bg-primary" />
      </article>

      <p className="mt-6 text-center text-sm">
        <Link to="/" className="text-primary underline">
          Continuar explorando
        </Link>
      </p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-bold">{value}</dd>
    </div>
  )
}
