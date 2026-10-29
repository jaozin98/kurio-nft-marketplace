import { Link, useRouter } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CloseIcon } from './icons'

type AuthModalProps = {
  mode: 'login' | 'register'
  redirect?: string
  description: string
  children: ReactNode
}

// Login e cadastro são um modal sobre a Home no desktop e uma tela cheia no mobile (Figma)
export function AuthModal({ mode, redirect, description, children }: AuthModalProps) {
  const popup = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const tab = 'text-xl font-medium'
  const other = mode === 'login' ? '/register' : '/login'

  return (
    // fechar (× ou Esc) volta ao catálogo; o destino de volta só vale depois de entrar
    <Dialog open onOpenChange={(open) => !open && router.history.push('/')}>
      <DialogContent
        ref={popup}
        showCloseButton={false}
        // o foco começa no primeiro campo, não no botão de fechar
        initialFocus={() => popup.current?.querySelector('input') ?? true}
        className="w-[min(500px,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden rounded-md border border-border bg-card p-0 text-foreground ring-0 sm:max-w-none max-md:left-0 max-md:top-0 max-md:h-dvh max-md:w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0"
      >
      <div className="relative flex min-h-full flex-col px-8 pb-10 pt-8 max-md:px-6 max-md:pt-6">
        <DialogClose
          aria-label="Fechar"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded text-primary"
        >
          <CloseIcon className="size-4" />
        </DialogClose>

        <p
          aria-hidden
          className="mb-8 hidden h-36 place-items-center rounded border border-dashed border-border text-5xl font-bold tracking-[0.2em] max-md:grid"
        >
          KURIO
        </p>

        <div className="flex items-center justify-center gap-3">
          {mode === 'login' ? (
            <>
              <DialogTitle render={<h1 />} className={`${tab} text-primary`}>
                Entrar
              </DialogTitle>
              <span aria-hidden className="h-5 w-px bg-primary" />
              <Link to={other} search={{ redirect }} className={tab}>
                Criar conta
              </Link>
            </>
          ) : (
            <>
              <Link to={other} search={{ redirect }} className={tab}>
                Entrar
              </Link>
              <span aria-hidden className="h-5 w-px bg-primary" />
              <DialogTitle render={<h1 />} className={`${tab} text-primary`}>
                Criar conta
              </DialogTitle>
            </>
          )}
        </div>

        <p className="mx-auto mt-6 max-w-xs text-center text-xs leading-5">{description}</p>

        <div className="mt-6">{children}</div>

        <div className="mt-8 space-y-3">
          <p className="relative text-center text-xs before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-border">
            <span className="relative bg-card px-3">Ou continue com</span>
          </p>
          {[
            ['Google', 'G', 'text-[#ea4335]'],
            ['Facebook', 'f', 'text-[#4267b2]'],
          ].map(([name, glyph, color]) => (
            <button
              key={name}
              type="button"
              disabled
              title="Indisponível nesta simulação"
              className="flex w-full items-center justify-center gap-3 rounded border border-input py-2 text-xs text-muted-foreground opacity-70"
            >
              <span aria-hidden className={`text-base font-bold ${color}`}>
                {glyph}
              </span>
              Continuar com {name}
            </button>
          ))}
        </div>
      </div>
      <div aria-hidden className="h-1.5 bg-primary" />
      </DialogContent>
    </Dialog>
  )
}

// campo do modal: o rótulo é lido por leitores de tela, na tela só aparece o placeholder (Figma)
export function AuthField({
  id,
  label,
  error,
  password,
  ...props
}: {
  id: string
  label: string
  error?: string
  password?: boolean
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false)

  return (
    <div>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={password ? (shown ? 'text' : 'password') : (props.type ?? 'text')}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-erro` : undefined}
          className="bg-background px-4 py-3 pr-11"
          {...props}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShown((value) => !value)}
            aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={shown}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-primary"
          >
            {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-erro`} className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
