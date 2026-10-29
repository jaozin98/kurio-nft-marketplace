import { useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { clearToken, getToken, setToken } from '@/lib/session'
import type { LoginResponse, User } from '@/types'

export const sessionKey = ['session'] as const

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    staleTime: Infinity,
    queryFn: async () => {
      if (!getToken()) return null
      try {
        const { data } = await api.get<User>('/auth/me')
        return data
      } catch (error) {
        // token vencido ou inválido: volta a ser visitante
        if (isAxiosError(error) && error.response?.status === 401) {
          clearToken()
          return null
        }
        throw error
      }
    },
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data } = await api.post<LoginResponse>('/auth/login', credentials)
      setToken(data.token)
      // leva para a conta o que o visitante já tinha no carrinho
      await api.post('/cart/merge')
      return data
    },
    onSuccess: ({ user }) => {
      queryClient.setQueryData(sessionKey, user)
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

export function logout() {
  // avisa a API (sem esperar); o cabeçalho é montado agora porque o token sai já em seguida
  const token = getToken()
  if (token) {
    api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  }
  clearToken()
  // limpa tudo para não sobrar dado privado do usuário anterior
  queryClient.clear()
  queryClient.setQueryData(sessionKey, null)
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: { name: string; email: string; password: string }) => {
      const { data: response } = await api.post<LoginResponse>('/auth/register', data)
      setToken(response.token)
      // a conta nova também herda o carrinho de visitante
      await api.post('/cart/merge')
      return response
    },
    onSuccess: ({ user }) => {
      queryClient.setQueryData(sessionKey, user)
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
