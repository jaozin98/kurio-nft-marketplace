import './index.css'

async function start() {
  if (import.meta.env.VITE_USE_MOCKS !== 'false') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }

  // O app só é carregado depois do worker: o socket.io-client guarda o
  // WebSocket nativo quando é importado, e o MSW precisa trocá-lo antes disso.
  await import('./bootstrap')
}

start()
