import { delay, http, HttpResponse } from 'msw'
import { db, save } from '../db'
import { getUser, unauthorized } from './auth'

// o NFT 13 sempre falha ao favoritar, para exercitar o rollback da interface
const FAILING_ID = '13'

export const favoriteHandlers = [
  http.get('/api/favorites', async ({ request }) => {
    await delay(200)
    const user = getUser(request)
    if (!user) return unauthorized()
    return HttpResponse.json(db.favorites[user.id] ?? [])
  }),

  http.put('/api/favorites/:id', async ({ request, params }) => {
    await delay(300)
    const user = getUser(request)
    if (!user) return unauthorized()

    if (params.id === FAILING_ID) {
      return HttpResponse.json({ message: 'Serviço indisponível' }, { status: 503 })
    }

    const current = new Set(db.favorites[user.id] ?? [])
    current.add(String(params.id))
    db.favorites[user.id] = [...current]
    save()
    return HttpResponse.json(db.favorites[user.id])
  }),

  http.delete('/api/favorites/:id', async ({ request, params }) => {
    await delay(300)
    const user = getUser(request)
    if (!user) return unauthorized()

    db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== params.id)
    save()
    return HttpResponse.json(db.favorites[user.id])
  }),
]
