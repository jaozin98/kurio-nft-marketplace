import { delay, http, HttpResponse } from 'msw'
import { emailPattern } from './auth'

// a inscrição é simulada: valida o e-mail e responde, sem guardar nem enviar nada
export const newsletterHandlers = [
  http.post('/api/newsletter', async ({ request }) => {
    await delay(300)
    const { email } = (await request.json()) as { email: string }
    if (!emailPattern.test(String(email ?? '').trim())) {
      return HttpResponse.json(
        { code: 'validation', message: 'Digite um e-mail válido', errors: { email: 'Digite um e-mail válido' } },
        { status: 422 },
      )
    }
    return HttpResponse.json({ ok: true }, { status: 202 })
  }),
]
