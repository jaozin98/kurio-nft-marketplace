import { dismissNotice, useNotices } from '@/lib/notices'

// região de status: leitores de tela anunciam as mudanças recebidas em tempo real
export function LiveNotices() {
  const notices = useNotices()

  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 w-80 space-y-2">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="flex items-start gap-3 rounded border border-primary bg-card p-3 text-sm shadow-lg"
        >
          <p className="flex-1">{notice.text}</p>
          <button
            onClick={() => dismissNotice(notice.id)}
            aria-label="Fechar aviso"
            className="text-muted-foreground"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
