const round =
  'grid size-7 place-items-center rounded-full bg-primary text-base font-bold leading-none text-primary-foreground disabled:opacity-40'

type StepperProps = {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label?: string
  disabled?: boolean
}

// controle de quantidade com os botões redondos do Figma
export function Stepper({ value, min = 1, max, onChange, label = 'Quantidade', disabled }: StepperProps) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <button
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="Diminuir quantidade"
        className={round}
      >
        −
      </button>
      <output aria-live="polite" className="min-w-4 text-center text-base">
        {value}
      </output>
      <button
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="Aumentar quantidade"
        className={round}
      >
        +
      </button>
    </div>
  )
}
