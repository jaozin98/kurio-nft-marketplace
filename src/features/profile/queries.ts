import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { sessionKey } from '@/features/auth/queries'
import type { User } from '@/types'

const saveSession = (user: User) => queryClient.setQueryData(sessionKey, user)

// o nome aparece no cabeçalho na hora; se a API recusar, volta ao que estava
export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const { data: user } = await api.patch<User>('/profile', data)
      return user
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: sessionKey })
      const previous = queryClient.getQueryData<User>(sessionKey)
      if (previous) saveSession({ ...previous, name: data.name.trim() || previous.name })
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) saveSession(context.previous)
    },
    onSuccess: saveSession,
  })
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: async (image: string) => {
      const { data } = await api.put<User>('/profile/avatar', { image })
      return data
    },
    onSuccess: saveSession,
  })
}

export function useRemoveAvatar() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<User>('/profile/avatar')
      return data
    },
    onSuccess: saveSession,
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      await api.post('/profile/password', data)
    },
  })
}
