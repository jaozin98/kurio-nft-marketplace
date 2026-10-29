import { useRef, useState, type FormEvent } from 'react'
import { Field } from '@/components/Field'
import { Private } from '@/components/Private'
import {
  useChangePassword,
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from '@/features/profile/queries'
import { errorMessage, fieldErrors } from '@/lib/api'
import type { User } from '@/types'

export function Profile() {
  return (
    <Private to="/profile">
      {(user) => (
        <div className="mx-auto max-w-xl space-y-12 py-8">
          <h1 className="text-3xl font-bold">Perfil do colecionador</h1>
          <AvatarSection user={user} />
          <DataSection user={user} />
          <PasswordSection />
        </div>
      )}
    </Private>
  )
}

const MAX_AVATAR_BYTES = 150_000
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function AvatarSection({ user }: { user: User }) {
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const input = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  function onPick(file: File | undefined) {
    setLocalError(null)
    if (!file) return
    if (!AVATAR_TYPES.includes(file.type)) return setLocalError('Use uma imagem PNG, JPG ou WebP')
    if (file.size > MAX_AVATAR_BYTES) return setLocalError('A imagem passa de 150 KB')

    const reader = new FileReader()
    reader.onload = () => upload.mutate(String(reader.result))
    reader.readAsDataURL(file)
  }

  const apiError = fieldErrors(upload.error).avatar
  const error = localError ?? apiError ?? (upload.isError ? errorMessage(upload.error) : null)

  return (
    <section aria-labelledby="avatar-titulo">
      <h2 id="avatar-titulo" className="text-lg font-semibold">
        Avatar
      </h2>
      <div className="mt-4 flex items-center gap-4">
        {user.avatar ? (
          <img src={user.avatar} alt={`Avatar de ${user.name}`} className="size-20 rounded-full object-cover" />
        ) : (
          <div aria-hidden className="grid size-20 place-items-center rounded-full bg-muted text-2xl">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="space-y-2">
          <input
            ref={input}
            id="avatar"
            type="file"
            accept={AVATAR_TYPES.join(',')}
            onChange={(event) => onPick(event.target.files?.[0])}
            className="sr-only"
          />
          <label
            htmlFor="avatar"
            className="inline-block cursor-pointer rounded border border-primary px-4 py-2 text-sm text-primary focus-within:outline-2"
          >
            {upload.isPending ? 'Enviando…' : 'Escolher imagem'}
          </label>
          {user.avatar && (
            <button
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="ml-3 text-sm text-muted-foreground underline"
            >
              Remover
            </button>
          )}
          <p className="text-xs text-muted-foreground">PNG, JPG ou WebP, até 150 KB.</p>
        </div>
      </div>
      <div aria-live="polite" className="mt-2 min-h-5 text-sm">
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
    </section>
  )
}

function DataSection({ user }: { user: User }) {
  const update = useUpdateProfile()
  const [form, setForm] = useState({ name: user.name, email: user.email })
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  const errors = { ...fieldErrors(update.error), ...clientErrors }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Informe seu nome completo'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Digite um e-mail válido'
    setClientErrors(next)
    if (Object.keys(next).length) return
    update.mutate(form)
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="dados-titulo" className="space-y-4">
      <h2 id="dados-titulo" className="text-lg font-semibold">
        Dados pessoais
      </h2>
      <Field id="perfil-nome" label="Nome completo" value={form.name} error={errors.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" />
      <Field id="perfil-email" label="E-mail" type="email" value={form.email} error={errors.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" />

      <div aria-live="polite" className="min-h-5 text-sm">
        {update.isSuccess && <p className="text-primary">Dados salvos.</p>}
        {update.isError && Object.keys(errors).length === 0 && (
          <p role="alert" className="text-destructive">{errorMessage(update.error)}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={update.isPending}
        className="rounded bg-primary px-5 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        {update.isPending ? 'Salvando…' : 'Salvar dados'}
      </button>
    </form>
  )
}

function PasswordSection() {
  const change = useChangePassword()
  const empty = { current: '', next: '', confirm: '' }
  const [form, setForm] = useState(empty)
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  const api = fieldErrors(change.error)
  const errors = {
    currentPassword: api.currentPassword,
    newPassword: api.newPassword,
    ...clientErrors,
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!form.current) next.currentPassword = 'Informe a senha atual'
    if (form.next.length < 8) next.newPassword = 'A nova senha precisa ter ao menos 8 caracteres'
    if (form.confirm !== form.next) next.confirm = 'As senhas não são iguais'
    setClientErrors(next)
    if (Object.keys(next).length) return

    change.mutate(
      { currentPassword: form.current, newPassword: form.next },
      { onSuccess: () => setForm(empty) },
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="senha-titulo" className="space-y-4">
      <h2 id="senha-titulo" className="text-lg font-semibold">
        Alterar senha
      </h2>
      <Field id="senha-atual" label="Senha atual" type="password" value={form.current} error={errors.currentPassword} onChange={(v) => setForm({ ...form, current: v })} autoComplete="current-password" />
      <Field id="senha-nova" label="Nova senha" type="password" value={form.next} error={errors.newPassword} onChange={(v) => setForm({ ...form, next: v })} autoComplete="new-password" />
      <Field id="senha-confirmar" label="Confirmar nova senha" type="password" value={form.confirm} error={clientErrors.confirm} onChange={(v) => setForm({ ...form, confirm: v })} autoComplete="new-password" />

      <div aria-live="polite" className="min-h-5 text-sm">
        {change.isSuccess && <p className="text-primary">Senha alterada.</p>}
      </div>

      <button
        type="submit"
        disabled={change.isPending}
        className="rounded border border-primary px-5 py-2 font-medium text-primary disabled:opacity-60"
      >
        {change.isPending ? 'Alterando…' : 'Alterar senha'}
      </button>
    </form>
  )
}
