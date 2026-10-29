import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import type { WalletsResponse } from '@/types'

const walletsKey = (userId: string) => ['wallets', userId] as const

export function useWallets(userId: string) {
  return useQuery({
    queryKey: walletsKey(userId),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<WalletsResponse>('/wallets', { signal })
      return data
    },
  })
}

export function useConnectWallet(userId: string) {
  return useMutation({
    mutationFn: async (walletId: string) => {
      const { data } = await api.post<WalletsResponse>(`/wallets/${walletId}/connect`)
      return data
    },
    onSuccess: (data) => queryClient.setQueryData(walletsKey(userId), data),
  })
}

export function useDisconnectWallet(userId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<WalletsResponse>('/wallets/disconnect')
      return data
    },
    onSuccess: (data) => queryClient.setQueryData(walletsKey(userId), data),
  })
}

export function useCreateWallet(userId: string) {
  return useMutation({
    mutationFn: async (wallet: { label: string; address: string; primary: boolean }) => {
      const { data } = await api.post<WalletsResponse>('/wallets', wallet)
      return data
    },
    onSuccess: (data) => queryClient.setQueryData(walletsKey(userId), data),
  })
}

export function useUpdateWallet(userId: string) {
  return useMutation({
    mutationFn: async (v: { id: string; label: string; address: string }) => {
      const { data } = await api.patch<WalletsResponse>(`/wallets/${v.id}`, {
        label: v.label,
        address: v.address,
      })
      return data
    },
    onSuccess: (data) => queryClient.setQueryData(walletsKey(userId), data),
  })
}
