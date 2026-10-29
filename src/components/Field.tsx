import { Eye, EyeOff } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label as LabelPrimitive } from '@/components/ui/label'

const control =
  'w-full rounded border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground/70 disabled:opacity-60'

// o asterisco fica fora do <label>: o nome acessível do campo é só o texto ("Rede", não "Rede*")
function Label({ id, children, required, hidden }: { id: string; children: ReactNode; required?: boolean; hidden?: boolean }) {
  if (hidden) {
    return (
      <LabelPrimitive htmlFor={id} className="sr-only">
        {children}
      </LabelPrimitive>
    )
  }
  return (
    <div className="mb-1.5 flex items-baseline gap-1 text-sm">
      <LabelPrimitive htmlFor={id}>{children}</LabelPrimitive>
      {required && (
        <span aria-hidden className="text-primary">
          *
        </span>
      )}
    </div>
  )
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  if (!error) return null
  return (
    <p id={`${id}-erro`} className="mt-1 text-sm text-destructive">
      {error}
    </p>
  )
}

type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
  autoComplete?: string
  placeholder?: string
  required?: boolean
  // esconde o rótulo na tela mas mantém para leitores de tela (o Figma mostra só o placeholder)
  hiddenLabel?: boolean
  // texto fixo antes do campo, como o ".eth" do nome ENS
  prefix?: string
  disabled?: boolean
  maxLength?: number
}

export function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  placeholder,
  required,
  hiddenLabel,
  prefix,
  disabled,
  maxLength,
}: FieldProps) {
  const input = (
    <Input
      id={id}
      type={type}
      value={value}
      autoComplete={autoComplete}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={!!error}
      aria-required={required}
      aria-describedby={error ? `${id}-erro` : undefined}
      className={prefix ? 'rounded-l-none' : undefined}
    />
  )

  return (
    <div>
      <Label id={id} required={required} hidden={hiddenLabel}>
        {label}
      </Label>
      {prefix ? (
        <div className="flex">
          <span
            aria-hidden
            className="grid place-items-center rounded-l border border-r-0 border-input bg-card px-3 text-sm text-muted-foreground"
          >
            {prefix}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
      <ErrorText id={id} error={error} />
    </div>
  )
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  required,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder: string
  required?: boolean
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <Label id={id} required={required}>
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={error ? `${id}-erro` : undefined}
        className={`${control} ${value ? '' : 'text-muted-foreground/70'}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ErrorText id={id} error={error} />
    </div>
  )
}

export function PasswordField(props: Omit<FieldProps, 'type' | 'prefix'>) {
  const [shown, setShown] = useState(false)

  return (
    <div>
      <Label id={props.id} required={props.required}>
        {props.label}
      </Label>
      <div className="relative">
        <Input
          id={props.id}
          type={shown ? 'text' : 'password'}
          value={props.value}
          autoComplete={props.autoComplete}
          onChange={(event) => props.onChange(event.target.value)}
          aria-invalid={!!props.error}
          aria-describedby={props.error ? `${props.id}-erro` : undefined}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={shown}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-primary"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <ErrorText id={props.id} error={props.error} />
    </div>
  )
}
