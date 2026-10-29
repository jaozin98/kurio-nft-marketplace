import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FilterMeta, Nft, NftFilters, NftPage } from '@/types'

export const nftKeys = {
  all: ['nfts'] as const,
  list: (filters: NftFilters) => ['nfts', 'list', filters] as const,
  detail: (id: string) => ['nfts', 'detail', id] as const,
  featured: ['nfts', 'featured'] as const,
  filters: ['nfts', 'filters'] as const,
}

export function nftListOptions(filters: NftFilters) {
  return queryOptions({
    queryKey: nftKeys.list(filters),
    // o signal cancela a requisição quando os filtros mudam
    queryFn: async ({ signal }) => {
      const { collection, ...rest } = filters
      const { data } = await api.get<NftPage>('/nfts', {
        params: { ...rest, collection: collection?.join(',') },
        signal,
      })
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function useNftList(filters: NftFilters) {
  return useQuery(nftListOptions(filters))
}

export function useNft(id: string) {
  return useQuery({
    queryKey: nftKeys.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Nft>(`/nfts/${id}`, { signal })
      return data
    },
    retry: false,
  })
}

export function useFilterMeta() {
  return useQuery({
    queryKey: nftKeys.filters,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<FilterMeta>('/filters', { signal })
      return data
    },
  })
}

export function useFeaturedNft() {
  return useQuery({
    queryKey: nftKeys.featured,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Nft>('/nfts/featured', { signal })
      return data
    },
  })
}
