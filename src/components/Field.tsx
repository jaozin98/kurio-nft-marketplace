import { Check, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const listId = `${id}-lista`
  const selected = options.find((option) => option.value === value)

  // fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function openList() {
    const index = options.findIndex((option) => option.value === value)
    setActive(index >= 0 ? index : 0)
    setOpen(true)
  }

  function choose(index: number) {
    onChange(options[index].value)
    setOpen(false)
    button.current?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }
    if (event.key === 'ArrowDown') setActive((index) => Math.min(index + 1, options.length - 1))
    else if (event.key === 'ArrowUp') setActive((index) => Math.max(index - 1, 0))
    else if (event.key === 'Home') setActive(0)
    else if (event.key === 'End') setActive(options.length - 1)
    else if (event.key === 'Enter' || event.key === ' ') choose(active)
    else if (event.key === 'Escape') setOpen(false)
    else if (event.key === 'Tab') setOpen(false)
    else if (event.key.length === 1) {
      // digitar a inicial vai para a primeira opção que começa com ela
      const found = options.findIndex((option) => option.label.toLowerCase().startsWith(event.key.toLowerCase()))
      if (found >= 0) setActive(found)
      return
    } else return
    event.preventDefault()
    // dentro de um <dialog>, o Esc fecharia o modal junto com a lista
    if (event.key === 'Escape') event.stopPropagation()
  }

  return (
    <div ref={root} className="relative">
      <Label id={id} required={required}>
        {label}
      </Label>
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${id}-opcao-${active}` : undefined}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={error ? `${id}-erro` : undefined}
        data-value={value}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`${control} flex items-center justify-between text-left ${
          selected ? '' : 'text-muted-foreground/70'
        }`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-auto rounded border border-border bg-card py-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-opcao-${index}`}
              role="option"
              aria-selected={option.value === value}
              data-value={option.value}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
              onPointerMove={() => setActive(index)}
              className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                index === active ? 'bg-secondary text-primary' : ''
              } ${option.value === value ? 'font-bold' : ''}`}
            >
              {option.label}
              {option.value === value && <Check aria-hidden className="size-4" />}
            </li>
          ))}
        </ul>
      )}
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
