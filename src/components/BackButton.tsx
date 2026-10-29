import { useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'

// botão de voltar das telas mobile (no desktop o caminho é o breadcrumb)
export function BackButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.history.back()}
      aria-label="Voltar"
      className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-primary md:hidden"
    >
      <ChevronLeft aria-hidden className="size-5" />
    </button>
  )
}
