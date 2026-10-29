import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import type { Cart } from '@/types'

export const cartKey = (userId: string | undefined) => ['cart', userId ?? 'guest'] as const

export function useCart(userId: string | undefined) {
  return useQuery({
    queryKey: cartKey(userId),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Cart>('/cart', { signal })
      return data
    },
  })
}

// toda mutation do carrinho devolve o carrinho inteiro já recalculado
function useCartMutation<TVars>(
  userId: string | undefined,
  request: (vars: TVars) => Promise<Cart>,
) {
  return useMutation({
    mutationFn: request,
    onSuccess: (cart) => queryClient.setQueryData(cartKey(userId), cart),
  })
}

export function useAddToCart(userId: string | undefined) {
  return useCartMutation(
    userId,
    async (item: { nftId: string; editionId: string; quantity: number }) => {
      const { data } = await api.post<Cart>('/cart/items', item)
      return data
    },
  )
}

export function useUpdateQuantity(userId: string | undefined) {
  return useCartMutation(
    userId,
    async (v: { nftId: string; editionId: string; quantity: number }) => {
      const { data } = await api.patch<Cart>(`/cart/items/${v.nftId}/${encodeURIComponent(v.editionId)}`, {
        quantity: v.quantity,
      })
      return data
    },
  )
}

export function useRemoveItem(userId: string | undefined) {
  return useCartMutation(userId, async (v: { nftId: string; editionId: string }) => {
    const { data } = await api.delete<Cart>(`/cart/items/${v.nftId}/${encodeURIComponent(v.editionId)}`)
    return data
  })
}

export function useApplyCoupon(userId: string | undefined) {
  return useCartMutation(userId, async (code: string) => {
    const { data } = await api.post<Cart>('/cart/coupon', { code })
    return data
  })
}

export function useRemoveCoupon(userId: string | undefined) {
  return useCartMutation(userId, async () => {
    const { data } = await api.delete<Cart>('/cart/coupon')
    return data
  })
}
