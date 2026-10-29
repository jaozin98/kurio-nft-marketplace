import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Field } from '@/components/Field'
import { useRegister } from '@/features/auth/queries'
import { errorMessage, fieldErrors } from '@/lib/api'

export function Register() {
  const { redirect } = useSearch({ from: '/register' })
  const router = useRouter()
  const register = useRegister()

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  // erros do cliente têm prioridade; depois valem os devolvidos pela API
  const errors = { ...fieldErrors(register.error), ...clientErrors }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Informe seu nome completo'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Digite um e-mail válido'
    if (form.password.length < 8) next.password = 'A senha precisa ter ao menos 8 caracteres'
    if (form.confirm !== form.password) next.confirm = 'As senhas não são iguais'
    setClientErrors(next)
    if (Object.keys(next).length) return

    register.mutate(
      { name: form.name.trim(), email: form.email.trim(), password: form.password },
      { onSuccess: () => router.history.push(redirect ?? '/') },
    )
  }

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-3xl font-bold">Criar conta</h1>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        <Field id="nome" label="Nome completo" value={form.name} error={errors.name} onChange={set('name')} autoComplete="name" />
        <Field id="email" label="E-mail" type="email" value={form.email} error={errors.email} onChange={set('email')} autoComplete="email" />
        <Field id="senha" label="Senha" type="password" value={form.password} error={errors.password} onChange={set('password')} autoComplete="new-password" />
        <Field id="confirmar" label="Confirmar senha" type="password" value={form.confirm} error={errors.confirm} onChange={set('confirm')} autoComplete="new-password" />

        {register.isError && Object.keys(fieldErrors(register.error)).length === 0 && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(register.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={register.isPending}
          className="w-full rounded bg-primary py-2 font-medium text-primary-foreground disabled:opacity-60"
        >
          {register.isPending ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link to="/login" search={{ redirect }} className="text-primary underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
