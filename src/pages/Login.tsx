import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AuthField, AuthModal } from '@/components/AuthModal'
import { useLogin } from '@/features/auth/queries'
import { errorMessage } from '@/lib/api'
import { Hero } from './Home'

export function Login() {
  const { redirect } = useSearch({ from: '/login' })
  const router = useRouter()
  const login = useLogin()

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email')).trim()
    const password = String(form.get('password'))

    const next: typeof errors = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Digite um e-mail válido'
    if (password.length < 6) next.password = 'A senha precisa ter ao menos 6 caracteres'
    setErrors(next)
    if (next.email || next.password) return

    login.mutate(
      { email, password },
      { onSuccess: () => router.history.push(redirect ?? '/') },
    )
  }

  return (
    <>
      {/* o fundo é a Home, como no Figma; fica inerte enquanto o modal está aberto */}
      <div aria-hidden inert className="pointer-events-none select-none opacity-40">
        <Hero />
      </div>

      <AuthModal
        mode="login"
        redirect={redirect}
        description="Entre para gerenciar sua carteira, coleção e perfil de criador."
      >
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <AuthField
            id="email"
            name="email"
            type="email"
            label="E-mail"
            placeholder="contato@email.com"
            autoComplete="email"
            error={errors.email}
          />
          <AuthField
            id="password"
            name="password"
            label="Senha"
            placeholder="Senha"
            autoComplete="current-password"
            password
            error={errors.password}
          />

          <p className="text-right text-xs">
            <span aria-disabled="true" title="Em breve" className="cursor-not-allowed text-primary opacity-70">
              Esqueceu a senha?
            </span>
          </p>

          {login.isError && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(login.error)}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded bg-primary py-3 font-bold text-primary-foreground disabled:opacity-60"
          >
            {login.isPending ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Conta de teste: ana@greenmint.test / senha123
          </p>
          <p className="text-center text-sm md:hidden">
            Novo na Kurio?{' '}
            <Link to="/register" search={{ redirect }} className="text-primary underline">
              Criar conta
            </Link>
          </p>
        </form>
      </AuthModal>
    </>
  )
}
