import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'

// a chave inclui o usuário para nunca misturar favoritos entre contas
const favoritesKey = (userId: string) => ['favorites', userId] as const

export function useFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: favoritesKey(userId ?? ''),
    enabled: !!userId,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<string[]>('/favorites', { signal })
      return data
    },
  })
}

export function useToggleFavorite(userId: string) {
  const key = favoritesKey(userId)

  return useMutation({
    mutationFn: async ({ nftId, active }: { nftId: string; active: boolean }) => {
      if (active) await api.put(`/favorites/${nftId}`)
      else await api.delete(`/favorites/${nftId}`)
    },
    onMutate: async ({ nftId, active }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<string[]>(key) ?? []
      const next = active
        ? [...new Set([...previous, nftId])]
        : previous.filter((id) => id !== nftId)
      queryClient.setQueryData(key, next)
      return { previous }
    },
    // se a API falhar, volta para o que estava antes
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
