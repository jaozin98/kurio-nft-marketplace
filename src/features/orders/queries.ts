import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import { useSocketConnected } from '@/lib/realtime'
import { queryClient } from '@/lib/queryClient'
import type { Cart, NetworkId, Order, OrderRequest } from '@/types'

export type OrderError = {
  code: string
  message: string
  errors?: Record<string, string>
  cart?: Cart
}

export const quoteKey = (userId: string, network: NetworkId) =>
  ['quote', userId, network] as const

export const quoteOptions = (userId: string, network: NetworkId) =>
  queryOptions({
    queryKey: quoteKey(userId, network),
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const { data } = await api.post<Cart>('/quote', { network }, { signal })
      return data
    },
  })

export function useQuote(userId: string, network: NetworkId, enabled: boolean) {
  return useQuery({ ...quoteOptions(userId, network), enabled })
}

// a chave fica guardada junto com o conteúdo: repetir o mesmo pedido (timeout,
// refresh) reaproveita a chave, e mudar qualquer dado gera uma nova
const keyStore = (userId: string) => `order-key:${userId}`

function keyFor(userId: string, body: OrderRequest) {
  const json = JSON.stringify(body)
  try {
    const saved = JSON.parse(localStorage.getItem(keyStore(userId)) ?? 'null')
    if (saved?.body === json) return saved.key as string
  } catch {
    // ignora valor corrompido e gera outro
  }
  const key = crypto.randomUUID()
  localStorage.setItem(keyStore(userId), JSON.stringify({ key, body: json }))
  return key
}

// pedido enviado cuja resposta pode ter se perdido; serve para recuperá-lo depois
export function pendingAttempt(userId: string): OrderRequest | null {
  try {
    const saved = JSON.parse(localStorage.getItem(keyStore(userId)) ?? 'null')
    return saved ? (JSON.parse(saved.body) as OrderRequest) : null
  } catch {
    return null
  }
}

export function useCreateOrder(userId: string) {
  return useMutation({
    mutationFn: async (body: OrderRequest) => {
      const { data } = await api.post<Order>('/orders', body, {
        headers: { 'Idempotency-Key': keyFor(userId, body) },
      })
      return data
    },
    onSuccess: () => {
      localStorage.removeItem(keyStore(userId))
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

export function orderError(error: unknown): OrderError | null {
  if (isAxiosError<OrderError>(error) && error.response?.data?.code) {
    return error.response.data
  }
  return null
}

export function useOrder(id: string) {
  const socketConnected = useSocketConnected()

  return useQuery<Order>({
    queryKey: ['order', id],
    retry: false,
    // o resultado chega pelo socket; só consulta por polling se ele estiver fora
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' && !socketConnected ? 1500 : false,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Order>(`/orders/${id}`, { signal })
      return data
    },
  })
}
