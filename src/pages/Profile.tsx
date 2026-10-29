import { useRef, useState, type FormEvent } from 'react'
import { AccountLayout } from '@/components/AccountLayout'
import { Field, PasswordField } from '@/components/Field'
import { Private } from '@/components/Private'
import {
  useChangePassword,
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from '@/features/profile/queries'
import { errorMessage, fieldErrors } from '@/lib/api'
import { validateProfile } from '@/lib/validation'
import type { User } from '@/types'

export function Profile() {
  return (
    <Private to="/profile">
      {(user) => (
        <AccountLayout active="profile">
          <ProfileForm user={user} />
        </AccountLayout>
      )}
    </Private>
  )
}

const MAX_AVATAR_BYTES = 150_000
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const changePassword = useChangePassword()
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const picker = useRef<HTMLInputElement>(null)

  const [values, setValues] = useState({
    name: user.name,
    username: user.username,
    email: user.email,
    ens: user.ens,
    walletNickname: user.walletNickname,
  })
  const empty = { current: '', next: '', confirm: '' }
  const [password, setPassword] = useState(empty)
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[]>([])

  const apiErrors = { ...fieldErrors(update.error), ...fieldErrors(changePassword.error) }
  const errors: Record<string, string | undefined> = { ...apiErrors, ...clientErrors }

  const set = (field: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }))

  function pickAvatar(file: File | undefined) {
    setAvatarError(null)
    if (!file) return
    if (!AVATAR_TYPES.includes(file.type)) return setAvatarError('Use uma imagem PNG, JPG ou WebP')
    if (file.size > MAX_AVATAR_BYTES) return setAvatarError('A imagem passa de 150 KB')

    const reader = new FileReader()
    reader.onload = () => upload.mutate(String(reader.result))
    reader.readAsDataURL(file)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaved([])

    const next = validateProfile(values)
    const wantsPassword = !!(password.current || password.next || password.confirm)
    if (wantsPassword) {
      if (!password.current) next.currentPassword = 'Informe a senha atual'
      if (password.next.length < 8) next.newPassword = 'A nova senha precisa ter ao menos 8 caracteres'
      if (password.confirm !== password.next) next.confirm = 'As senhas não são iguais'
    }
    setClientErrors(next)
    if (Object.keys(next).length) return

    update.mutate(values, {
      onSuccess: () => {
        setSaved((list) => [...list, 'Dados salvos.'])
        if (!wantsPassword) return
        changePassword.mutate(
          { currentPassword: password.current, newPassword: password.next },
          {
            onSuccess: () => {
              setPassword(empty)
              setSaved((list) => [...list, 'Senha alterada.'])
            },
          },
        )
      },
    })
  }

  const avatarMessage =
    avatarError ?? fieldErrors(upload.error).avatar ?? (upload.isError ? errorMessage(upload.error) : null)
  const generalError = [update.error, changePassword.error].find(
    (error) => error && Object.keys(fieldErrors(error)).length === 0,
  )
  const busy = update.isPending || changePassword.isPending

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="perfil-titulo" className="space-y-8">
      <h1 id="perfil-titulo" className="text-xl font-bold">
        Perfil do colecionador
      </h1>

      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field id="perfil-nome" label="Nome de exibição" required value={values.name} error={errors.name} onChange={set('name')} autoComplete="name" />
        <Field id="perfil-usuario" label="Nome de usuário" required value={values.username} error={errors.username} onChange={set('username')} autoComplete="username" />
        <Field id="perfil-email" label="E-mail" required type="email" value={values.email} error={errors.email} onChange={set('email')} autoComplete="email" />
        <Field id="perfil-ens" label="Nome ENS" required prefix=".eth" value={values.ens} error={errors.ens} onChange={set('ens')} />
        <Field id="perfil-apelido" label="Apelido da carteira" required value={values.walletNickname} error={errors.walletNickname} onChange={set('walletNickname')} />

        <div>
          <p id="avatar-rotulo" className="mb-1.5 text-sm">
            Avatar
          </p>
          <div aria-labelledby="avatar-rotulo" className="flex items-center gap-4">
            {user.avatar ? (
              <img src={user.avatar} alt={`Avatar de ${user.name}`} className="size-14 rounded-full object-cover" />
            ) : (
              <div aria-hidden className="grid size-14 place-items-center rounded-full bg-card text-xl text-primary">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <input
              ref={picker}
              type="file"
              accept={AVATAR_TYPES.join(',')}
              aria-label="Arquivo do avatar"
              onChange={(event) => pickAvatar(event.target.files?.[0])}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => picker.current?.click()}
              disabled={upload.isPending}
              className="rounded bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {upload.isPending ? 'Enviando…' : 'Alterar'}
            </button>
            {user.avatar && (
              <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="text-sm underline">
                Remover
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">PNG, JPG ou WebP, até 150 KB.</p>
          <div aria-live="polite" className="text-sm">
            {avatarMessage && (
              <p role="alert" className="text-destructive">
                {avatarMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      <fieldset className="space-y-5">
        <legend className="mb-4 text-lg font-bold">Alterar senha</legend>
        <div className="grid max-w-md gap-5">
          <PasswordField id="senha-atual" label="Senha atual" autoComplete="current-password" value={password.current} onChange={(v) => setPassword({ ...password, current: v })} error={errors.currentPassword} />
          <PasswordField id="senha-nova" label="Nova senha" autoComplete="new-password" value={password.next} onChange={(v) => setPassword({ ...password, next: v })} error={errors.newPassword} />
          <PasswordField id="senha-confirmar" label="Confirmar nova senha" autoComplete="new-password" value={password.confirm} onChange={(v) => setPassword({ ...password, confirm: v })} error={errors.confirm} />
        </div>
      </fieldset>

      <div aria-live="polite" className="space-y-1 text-sm">
        {saved.map((message) => (
          <p key={message} className="text-primary">
            {message}
          </p>
        ))}
        {generalError && (
          <p role="alert" className="text-destructive">
            {errorMessage(generalError)}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-primary px-8 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {busy ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  )
}
