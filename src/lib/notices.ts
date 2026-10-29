import { useSyncExternalStore } from 'react'

export type Notice = { id: number; text: string }

let notices: Notice[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function pushNotice(text: string) {
  notices = [...notices, { id: nextId++, text }].slice(-3)
  emit()
}

export function dismissNotice(id: number) {
  notices = notices.filter((notice) => notice.id !== id)
  emit()
}

export function clearNotices() {
  notices = []
  emit()
}

export function useNotices() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => notices,
  )
}
