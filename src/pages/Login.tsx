import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useLogin } from '@/features/auth/queries'
import { errorMessage } from '@/lib/api'

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
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-3xl font-bold">Entrar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Teste com ana@greenmint.test / senha123
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className="w-full rounded border border-input bg-card px-3 py-2"
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-sm text-destructive">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="w-full rounded border border-input bg-card px-3 py-2"
          />
          {errors.password && (
            <p id="password-error" className="mt-1 text-sm text-destructive">
              {errors.password}
            </p>
          )}
        </div>

        {login.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(login.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded bg-primary py-2 font-medium text-primary-foreground disabled:opacity-60"
        >
          {login.isPending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Não tem conta?{' '}
        <Link to="/register" search={{ redirect }} className="text-primary underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
