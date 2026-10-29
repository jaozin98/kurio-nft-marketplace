import { useState, type FormEvent } from 'react'
import { Field } from '@/components/Field'
import { Private } from '@/components/Private'
import {
  useCreateWallet,
  useUpdateWallet,
  useWallets,
} from '@/features/wallets/queries'
import { errorMessage, fieldErrors } from '@/lib/api'
import type { Wallet } from '@/types'

export function Wallets() {
  return (
    <Private to="/wallets">{(user) => <WalletsView userId={user.id} />}</Private>
  )
}

function WalletsView({ userId }: { userId: string }) {
  const { data, isPending, isError, refetch } = useWallets(userId)

  if (isError) {
    return (
      <div role="alert" className="py-24 text-center">
        <p>Não foi possível carregar as carteiras.</p>
        <button onClick={() => refetch()} className="mt-4 rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
          Tentar de novo
        </button>
      </div>
    )
  }

  const primary = data?.wallets.find((wallet) => wallet.primary)
  const secondary = data?.wallets.find((wallet) => !wallet.primary)

  return (
    <div className="mx-auto max-w-xl space-y-10 py-8">
      <h1 className="text-3xl font-bold">Carteiras</h1>
      {isPending ? (
        <div aria-busy="true" className="space-y-4">
          <div className="shimmer h-52 rounded-lg" />
          <div className="shimmer h-52 rounded-lg" />
        </div>
      ) : (
        <>
          <WalletCard userId={userId} title="Carteira principal" primary wallet={primary} />
          <WalletCard userId={userId} title="Carteira secundária" primary={false} wallet={secondary} />
        </>
      )}
    </div>
  )
}

function WalletCard({
  userId,
  title,
  primary,
  wallet,
}: {
  userId: string
  title: string
  primary: boolean
  wallet?: Wallet
}) {
  const create = useCreateWallet(userId)
  const update = useUpdateWallet(userId)
  const mutation = wallet ? update : create
  // a mensagem fica no cartão: ao cadastrar, `wallet` passa a existir e troca a mutation usada
  const [saved, setSaved] = useState<string | null>(null)

  const [form, setForm] = useState({ label: wallet?.label ?? '', address: wallet?.address ?? '' })
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  const errors = { ...fieldErrors(mutation.error), ...clientErrors }
  const slot = primary ? 'principal' : 'secundaria'

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    const label = form.label.trim()
    const address = form.address.trim()
    if (label.length < 2 || label.length > 30) next.label = 'Use de 2 a 30 caracteres'
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      next.address = 'Endereço inválido: use 0x seguido de 40 caracteres'
    }
    setClientErrors(next)
    if (Object.keys(next).length) return

    setSaved(null)
    if (wallet) {
      update.mutate({ id: wallet.id, label, address }, { onSuccess: () => setSaved('Carteira salva.') })
    } else {
      create.mutate({ label, address, primary }, { onSuccess: () => setSaved('Carteira cadastrada.') })
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby={`${slot}-titulo`} className="space-y-4 rounded-lg border border-border bg-card p-5">
      <h2 id={`${slot}-titulo`} className="text-lg font-semibold">
        {title}
      </h2>
      <Field id={`${slot}-nome`} label="Nome da carteira" value={form.label} error={errors.label} onChange={(v) => setForm({ ...form, label: v })} />
      <Field id={`${slot}-endereco`} label="Endereço" value={form.address} error={errors.address} onChange={(v) => setForm({ ...form, address: v })} />

      <div aria-live="polite" className="min-h-5 text-sm">
        {saved && <p className="text-primary">{saved}</p>}
        {mutation.isError && Object.keys(fieldErrors(mutation.error)).length === 0 && (
          <p role="alert" className="text-destructive">{errorMessage(mutation.error)}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded bg-primary px-5 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        {mutation.isPending ? 'Salvando…' : wallet ? 'Salvar carteira' : 'Cadastrar carteira'}
      </button>
    </form>
  )
}
