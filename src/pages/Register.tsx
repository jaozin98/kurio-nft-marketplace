import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AuthField, AuthModal } from '@/components/AuthModal'
import { useRegister } from '@/features/auth/queries'
import { errorMessage, fieldErrors } from '@/lib/api'
import { Hero } from './Home'

export function Register() {
  const { redirect } = useSearch({ from: '/register' })
  const router = useRouter()
  const register = useRegister()

  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})

  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }))

  // o servidor fala em "name"; na tela, esse campo é o nome de usuário
  const api = fieldErrors(register.error)
  const errors: Record<string, string | undefined> = { ...api, username: api.name, ...clientErrors }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) {
      next.username = 'Use de 3 a 20 letras, números ou _'
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Digite um e-mail válido'
    if (form.password.length < 8) next.password = 'A senha precisa ter ao menos 8 caracteres'
    if (form.confirm !== form.password) next.confirm = 'As senhas não são iguais'
    setClientErrors(next)
    if (Object.keys(next).length) return

    register.mutate(
      { name: form.username, email: form.email.trim(), password: form.password },
      { onSuccess: () => router.history.push(redirect ?? '/') },
    )
  }

  return (
    <>
      <div aria-hidden inert className="pointer-events-none select-none opacity-40">
        <Hero />
      </div>

      <AuthModal
        mode="register"
        redirect={redirect}
        description="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
      >
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <AuthField
            id="usuario"
            label="Nome de usuário"
            placeholder="Nome de usuário"
            autoComplete="username"
            value={form.username}
            onChange={set('username')}
            error={errors.username}
          />
          <AuthField
            id="email"
            type="email"
            label="E-mail"
            placeholder="Digite seu e-mail"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
          />
          <AuthField
            id="senha"
            label="Senha"
            placeholder="Senha"
            autoComplete="new-password"
            password
            value={form.password}
            onChange={set('password')}
            error={errors.password}
          />
          <AuthField
            id="confirmar"
            label="Confirmar senha"
            placeholder="Confirmar senha"
            autoComplete="new-password"
            password
            value={form.confirm}
            onChange={set('confirm')}
            error={errors.confirm}
          />

          {register.isError && Object.keys(api).length === 0 && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(register.error)}
            </p>
          )}

          <button
            type="submit"
            disabled={register.isPending}
            className="cta w-full rounded bg-primary py-3 font-bold text-primary-foreground disabled:opacity-60"
          >
            {register.isPending ? 'Criando conta...' : 'Criar conta'}
          </button>

          <p className="text-center text-sm md:hidden">
            Já tem conta?{' '}
            <Link to="/login" search={{ redirect }} className="text-primary underline">
              Entrar
            </Link>
          </p>
        </form>
      </AuthModal>
    </>
  )
}
