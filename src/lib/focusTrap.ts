import type { KeyboardEvent } from 'react'

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// mantém o Tab dentro do diálogo: do último elemento volta ao primeiro, e vice-versa
export function trapFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return

  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(focusable)].filter(
    (element) => element.offsetParent !== null,
  )
  if (items.length === 0) return

  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement

  if (event.shiftKey && (active === first || !event.currentTarget.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !event.currentTarget.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}
