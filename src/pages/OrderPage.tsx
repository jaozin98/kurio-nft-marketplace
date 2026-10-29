import { Link, Navigate, useParams } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { useEffect } from 'react'
import { useSession } from '@/features/auth/queries'
import { useOrder } from '@/features/orders/queries'
import { formatEth } from '@/lib/eth'
import { queryClient } from '@/lib/queryClient'

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

  if (isPending) return <div aria-busy="true" className="shimmer mx-auto mt-8 h-72 max-w-xl rounded-lg" />

  if (error) {
    const code = isAxiosError(error) ? error.response?.status : undefined
    return (
      <div role="alert" className="py-24 text-center">
        <h1 className="text-2xl font-semibold">
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
        <h1 className="text-2xl font-semibold">Aguardando confirmação</h1>
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
        <h1 className="text-2xl font-semibold">Pagamento recusado</h1>
        <p className="mt-3 text-muted-foreground">{order.declineReason}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus itens continuam no carrinho. Nenhum valor foi cobrado.
        </p>
        <Link
          to="/checkout"
          className="mt-6 inline-block rounded bg-primary px-5 py-3 font-medium text-primary-foreground"
        >
          Tentar novamente
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl py-8">
      <h1 className="text-3xl font-bold">Pedido confirmado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pedido {order.id} · {new Date(order.createdAt).toLocaleString('pt-BR')}
      </p>

      <div className="mt-6 space-y-4 rounded-lg border border-border bg-card p-5">
        <ul className="space-y-3">
          {order.items.map((item) => (
            <li key={`${item.nftId}|${item.editionId}`} className="flex items-center gap-3">
              <img src={item.image} alt="" width={48} height={48} className="size-12 rounded object-cover" />
              <span className="flex-1 text-sm">
                {item.quantity} × {item.name} ({item.editionLabel})
              </span>
              <span className="font-mono text-sm">{formatEth(item.price)}</span>
            </li>
          ))}
        </ul>

        <dl className="space-y-1 border-t border-border pt-3 text-sm">
          <Row label="Subtotal" value={order.quote.subtotal} />
          <Row label="Desconto" value={order.quote.discount} />
          <Row label="Taxa de rede" value={order.quote.networkFee} />
          <div className="flex justify-between pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="font-mono">{formatEth(order.quote.total)}</dd>
          </div>
        </dl>

        <dl className="space-y-1 border-t border-border pt-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Transação (simulada)</dt>
            <dd className="break-all font-mono text-xs">{order.txHash}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">
              Explorador de blocos indisponível: a transação é simulada.
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Carteira</dt>
            <dd>
              {order.wallet.label} · {order.network}
            </dd>
          </div>
        </dl>
      </div>

      <Link to="/" className="mt-6 inline-block text-primary underline">
        Continuar explorando
      </Link>
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
