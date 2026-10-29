import { useEffect } from 'react'
import { useSession } from '@/features/auth/queries'
import { clearNotices } from '@/lib/notices'
import { connectRealtime } from '@/lib/realtime'
import { getToken } from '@/lib/session'

// um socket por sessão: ao trocar de usuário o anterior é encerrado
export function RealtimeSync() {
  const { data: user, isSuccess } = useSession()
  const userId = user?.id ?? null

  useEffect(() => {
    if (!isSuccess) return
    const close = connectRealtime(userId ? getToken() : null, userId)
    return () => {
      close()
      clearNotices()
    }
  }, [isSuccess, userId])

  return null
}
