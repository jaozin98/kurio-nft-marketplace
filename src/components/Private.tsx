import { Navigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useSession } from '@/features/auth/queries'
import type { User } from '@/types'

// protege uma tela: sem sessão, vai para o login e volta para `to` depois
export function Private({ to, children }: { to: string; children: (user: User) => ReactNode }) {
  const { data: user } = useSession()

  if (user === undefined) {
    return <div aria-busy="true" className="shimmer mx-auto mt-8 h-96 max-w-2xl rounded-lg" />
  }
  if (user === null) return <Navigate to="/login" search={{ redirect: to }} />

  return <>{children(user)}</>
}
