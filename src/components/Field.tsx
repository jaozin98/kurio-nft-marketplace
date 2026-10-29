export function Field({
  id,
  label,
  value,
  error,
  onChange,
  type = 'text',
  autoComplete,
}: {
  id: string
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-erro` : undefined}
        className="w-full rounded border border-input bg-card px-3 py-2"
      />
      {error && (
        <p id={`${id}-erro`} className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
