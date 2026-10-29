import { Skeleton } from '@/components/ui/skeleton'
import { useState } from 'react'
import type { FilterMeta, NftFilters } from '@/types'

const field = 'rounded border border-input bg-background px-3 py-2 text-sm'

type Props = {
  // evita ids repetidos quando o painel aparece na barra lateral e na gaveta
  idPrefix: string
  meta?: FilterMeta
  filters: NftFilters
  onChange: (next: Partial<NftFilters>) => void
}

export function FiltersPanel({ idPrefix, meta, filters, onChange }: Props) {
  function toggleCollection(name: string) {
    const current = filters.collection ?? []
    const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    onChange({ collection: next.length ? next : undefined })
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-lg font-bold">Coleções</legend>
        <ul>
          {meta?.collections.map(({ name, count }) => (
            <li key={name}>
              <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-muted-foreground hover:bg-secondary has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={filters.collection?.includes(name) ?? false}
                  onChange={() => toggleCollection(name)}
                />
                <span
                  aria-hidden
                  className="grid size-3.5 place-items-center rounded-sm border border-current text-[10px] leading-none text-primary-foreground peer-checked:bg-primary peer-checked:before:content-['✓']"
                />
                <span className="flex-1 peer-checked:font-bold">{name}</span>
                <span className="font-bold text-primary">({count})</span>
              </label>
            </li>
          ))}
          {!meta &&
            Array.from({ length: 6 }, (_, i) => (
              <Skeleton as="li" key={i} aria-hidden className="my-2 h-5 rounded" />
            ))}
        </ul>
      </fieldset>

      {meta && (
        // remonta quando o filtro muda pela URL (voltar do histórico, por exemplo)
        <PriceFilter
          key={`${filters.min}|${filters.max}`}
          idPrefix={idPrefix}
          bounds={meta.price}
          min={filters.min}
          max={filters.max}
          onApply={onChange}
        />
      )}

      <fieldset>
        <legend className="mb-3 text-lg font-bold">Rede</legend>
        <ul>
          {[{ id: undefined, label: 'Todas', count: undefined }, ...(meta?.networks ?? [])].map(
            (network) => (
              <li key={network.id ?? 'todas'}>
                <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-muted-foreground hover:bg-secondary has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
                  <input
                    type="radio"
                    name={`${idPrefix}-rede`}
                    className="peer sr-only"
                    checked={filters.network === network.id}
                    onChange={() => onChange({ network: network.id })}
                  />
                  <span
                    aria-hidden
                    className="size-3.5 rounded-full border border-current peer-checked:border-4 peer-checked:border-primary"
                  />
                  <span className="flex-1 peer-checked:font-bold">{network.label}</span>
                  {network.count !== undefined && (
                    <span className="font-bold text-primary">({network.count})</span>
                  )}
                </label>
              </li>
            ),
          )}
        </ul>
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-raridade`} className="mb-2 block text-lg font-bold">
          Raridade
        </label>
        <select
          id={`${idPrefix}-raridade`}
          value={filters.rarity ?? ''}
          onChange={(event) =>
            onChange({ rarity: (event.target.value || undefined) as NftFilters['rarity'] })
          }
          className={`${field} w-full`}
        >
          <option value="">Todas</option>
          <option value="comum">Comum</option>
          <option value="raro">Raro</option>
          <option value="lendario">Lendário</option>
        </select>
      </div>
    </div>
  )
}

function PriceFilter({
  idPrefix,
  bounds,
  min,
  max,
  onApply,
}: {
  idPrefix: string
  bounds: { min: string; max: string }
  min?: string
  max?: string
  onApply: (next: Partial<NftFilters>) => void
}) {
  const [low, setLow] = useState(min ?? bounds.min)
  const [high, setHigh] = useState(max ?? bounds.max)

  // os dois controles nunca se cruzam
  const changeLow = (value: string) => setLow(Number(value) > Number(high) ? high : value)
  const changeHigh = (value: string) => setHigh(Number(value) < Number(low) ? low : value)

  return (
    <fieldset>
      <legend className="mb-3 text-lg font-bold">Faixa de preço</legend>
      <div className="space-y-2">
        <input
          id={`${idPrefix}-preco-min`}
          type="range"
          aria-label="Preço mínimo"
          min={bounds.min}
          max={bounds.max}
          step="0.01"
          value={low}
          onChange={(event) => changeLow(event.target.value)}
          className="w-full accent-primary"
        />
        <input
          id={`${idPrefix}-preco-max`}
          type="range"
          aria-label="Preço máximo"
          min={bounds.min}
          max={bounds.max}
          step="0.01"
          value={high}
          onChange={(event) => changeHigh(event.target.value)}
          className="w-full accent-primary"
        />
      </div>
      <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">
        Preço: {Number(low).toFixed(2)} - {Number(high).toFixed(2)} ETH
      </p>
      <button
        onClick={() =>
          onApply({
            min: low === bounds.min ? undefined : Number(low).toFixed(2),
            max: high === bounds.max ? undefined : Number(high).toFixed(2),
          })
        }
        className="mt-3 rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
      >
        Aplicar
      </button>
    </fieldset>
  )
}
