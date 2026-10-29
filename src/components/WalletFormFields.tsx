import { networkLabels, providerLabels } from '@/lib/validation'
import { Field, SelectField } from './Field'

export type WalletFormValues = Record<string, string>

type Props = {
  // evita ids repetidos quando há mais de um formulário na página
  idPrefix: string
  // "wallet": segunda coluna da 1ª linha é o apelido; "checkout": é o nome de usuário
  variant: 'wallet' | 'checkout'
  values: WalletFormValues
  errors: Record<string, string | undefined>
  onChange: (name: string, value: string) => void
  // no pagamento o endereço vem da carteira escolhida
  lockAddress?: boolean
}

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }))

// os mesmos campos do Figma em Carteiras e em Pagamento, na mesma ordem
export function WalletFormFields({ idPrefix, variant, values, errors, onChange, lockAddress }: Props) {
  const id = (name: string) => `${idPrefix}-${name}`
  const bind = (name: string) => ({
    id: id(name),
    value: values[name] ?? '',
    error: errors[name],
    onChange: (value: string) => onChange(name, value),
  })

  return (
    <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
      <Field {...bind('displayName')} label="Nome de exibição" required autoComplete="name" />
      {variant === 'wallet' ? (
        <Field {...bind('nickname')} label="Apelido da carteira" required />
      ) : (
        <Field {...bind('username')} label="Nome de usuário" required autoComplete="username" />
      )}

      <SelectField
        {...bind('network')}
        label="Rede"
        required
        placeholder="Selecione uma rede"
        options={toOptions(networkLabels)}
      />
      <Field {...bind('profileName')} label="Nome do perfil" required />

      <Field
        {...bind('address')}
        label="Endereço da carteira"
        required
        placeholder="Endereço 0x da carteira"
        disabled={lockAddress}
      />
      <Field
        {...bind('altAddress')}
        label="ENS ou carteira secundária (opcional)"
        hiddenLabel
        placeholder="ENS ou carteira secundária (opcional)"
      />

      <SelectField
        {...bind('provider')}
        label="Tipo de carteira"
        required
        placeholder="Selecione uma carteira"
        options={toOptions(providerLabels)}
      />
      <Field {...bind('referralCode')} label="Código de indicação" required />

      <Field {...bind('email')} label="E-mail" required type="email" autoComplete="email" />
      <Field {...bind('ens')} label="Nome ENS" required prefix=".eth" />
    </div>
  )
}
