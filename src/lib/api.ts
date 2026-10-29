import axios, { isAxiosError } from 'axios'
import type { ApiError } from '@/types'
import { queryClient } from './queryClient'
import { clearToken, getGuestId, getToken } from './session'

export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['x-guest-id'] = getGuestId()
  return config
})

// sessão vencida: limpa o token e as telas privadas redirecionam para o login
api.interceptors.response.use(undefined, (error) => {
  const url: string = error.config?.url ?? ''
  if (error.response?.status === 401 && !url.includes('/auth/login') && getToken()) {
    clearToken()
    queryClient.setQueryData(['session'], null)
  }
  return Promise.reject(error)
})

export function errorMessage(error: unknown, fallback = 'Algo deu errado. Tente de novo.') {
  if (isAxiosError<ApiError>(error)) {
    return error.response?.data?.message ?? fallback
  }
  return fallback
}

// erros de validação da API, por campo: { email: 'Este e-mail já está cadastrado' }
export function fieldErrors(error: unknown): Record<string, string> {
  if (isAxiosError<{ errors?: Record<string, string> }>(error)) {
    return error.response?.data?.errors ?? {}
  }
  return {}
}
