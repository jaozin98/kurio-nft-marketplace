import { Skeleton } from "@/components/ui/skeleton"
import { useState, type FormEvent } from 'react'
import { AccountLayout } from '@/components/AccountLayout'
import { Private } from '@/components/Private'
import { WalletFormFields, type WalletFormValues } from '@/components/WalletFormFields'
import { useCreateWallet, useUpdateWallet, useWallets } from '@/features/wallets/queries'
import { errorMessage, fieldErrors } from '@/lib/api'
import { validateWallet } from '@/lib/validation'
import type { User, Wallet, WalletInput } from '@/types'

export function Wallets() {
  return (
    <Private to="/wallets">
      {(user) => (
        <AccountLayout active="wallets">
          <WalletsView user={user} />
        </AccountLayout>
      )}
    </Private>
  )
}

const fieldNames = [
  'nickname',
  'displayName',
  'profileName',
  'network',
  'address',
  'altAddress',
  'provider',
  'referralCode',
  'email',
  'ens',
] as const

function toValues(wallet: Wallet | undefined, user: User): WalletFormValues {
  return {
    nickname: wallet?.nickname ?? '',
    displayName: wallet?.displayName ?? user.name,
    profileName: wallet?.profileName ?? user.username,
    network: wallet?.network ?? '',
    address: wallet?.address ?? '',
    altAddress: wallet?.altAddress ?? '',
    provider: wallet?.provider ?? '',
    referralCode: wallet?.referralCode ?? '',
    email: wallet?.email ?? user.email,
    ens: wallet?.ens ?? user.ens,
  }
}

function WalletsView({ user }: { user: User }) {
  const { data, isPending, isError, refetch } = useWallets(user.id)

  if (isError) {
    return (
      <div role="alert" className="py-24 text-center">
        <p>Não foi possível carregar as carteiras.</p>
        <button onClick={() => refetch()} className="mt-4 rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Tentar de novo
        </button>
      </div>
    )
  }

  const primary = data?.wallets.find((wallet) => wallet.primary)
  const secondary = data?.wallets.find((wallet) => !wallet.primary)

  return (
    <div className="space-y-12">
      <h1 className="sr-only">Carteiras</h1>
      {isPending ? (
        <div aria-busy="true" className="space-y-4">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      ) : (
        <>
          <WalletSection
            key="principal"
            userId={user.id}
            user={user}
            title="Carteira principal"
            primary
            wallet={primary}
            description="Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados."
          />
          <WalletSection
            key="secundaria"
            userId={user.id}
            user={user}
            title="Carteira secundária"
            primary={false}
            wallet={secondary}
            principalWallet={primary}
          />
        </>
      )}
    </div>
  )
}

function WalletSection({
  userId,
  user,
  title,
  primary,
  wallet,
  description,
  principalWallet,
}: {
  userId: string
  user: User
  title: string
  primary: boolean
  wallet?: Wallet
  description?: string
  principalWallet?: Wallet
}) {
  const create = useCreateWallet(userId)
  const update = useUpdateWallet(userId)
  const mutation = wallet ? update : create

  const slot = primary ? 'principal' : 'secundaria'
  // a principal sempre mostra o formulário; a secundária só depois de "Adicionar"
  const [open, setOpen] = useState(primary || !!wallet)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const [values, setValues] = useState(() => toValues(wallet, user))
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)

  const errors: Record<string, string | undefined> = { ...fieldErrors(mutation.error), ...clientErrors }

  function change(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  function copyFromPrincipal(checked: boolean) {
    setSameAsPrimary(checked)
    if (checked && principalWallet) {
      // mantém o apelido e o endereço próprios: só copia os dados do colecionador
      setValues((current) => ({ ...toValues(principalWallet, user), nickname: current.nickname, address: '' }))
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaved(null)
    const input = Object.fromEntries(fieldNames.map((name) => [name, values[name]?.trim() ?? ''])) as WalletInput
    const next = validateWallet(input)
    setClientErrors(next)
    if (Object.keys(next).length) return

    if (wallet) {
      update.mutate({ id: wallet.id, ...input }, { onSuccess: () => setSaved('Carteira salva.') })
    } else {
      create.mutate({ ...input, primary }, { onSuccess: () => setSaved('Carteira cadastrada.') })
    }
  }

  return (
    <section aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${slot}-titulo`} className="text-xl font-bold">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : (
            !open && (
              <p className="mt-1 text-xs text-muted-foreground">
                Você ainda não adicionou uma carteira secundária.
              </p>
            )
          )}
        </div>

        {!primary && !wallet && (
          <div className="flex items-center gap-4 text-xs">
            {principalWallet && (
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={sameAsPrimary}
                  onChange={(event) => copyFromPrincipal(event.target.checked)}
                />
                Igual à carteira principal
              </label>
            )}
            {!open && (
              <button type="button" onClick={() => setOpen(true)} className="font-bold text-primary">
                Adicionar
              </button>
            )}
          </div>
        )}
      </div>

      {open && (
        <form onSubmit={onSubmit} noValidate aria-labelledby={`${slot}-titulo`} className="mt-6 space-y-6">
          <WalletFormFields idPrefix={slot} variant="wallet" values={values} errors={errors} onChange={change} />

          <div aria-live="polite" className="min-h-5 text-sm">
            {saved && <p className="text-primary">{saved}</p>}
            {mutation.isError && Object.keys(fieldErrors(mutation.error)).length === 0 && (
              <p role="alert" className="text-destructive">
                {errorMessage(mutation.error)}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {mutation.isPending ? 'Salvando…' : 'Salvar carteira'}
          </button>
        </form>
      )}
    </section>
  )
}
