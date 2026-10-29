// Cenários de rede e falha, escolhidos por `?scenario=nome` na URL (fica salvo no navegador)
// ou direto: localStorage.setItem('mock-scenario', 'slow')
export const scenarios = [
  'default', // tudo funciona, latência curta
  'slow', // todas as respostas de catálogo demoram 3s
  'list-error', // as 2 primeiras listagens falham com HTTP 500; depois voltam
  'network-error', // as 2 primeiras listagens falham sem resposta (conexão); depois voltam
  'empty', // a listagem volta vazia
  'out-of-order', // buscas mais curtas respondem mais devagar, então a resposta velha chega depois
  'order-timeout', // o pedido é criado, mas a resposta demora mais que o timeout do cliente
  'price-change', // na primeira tentativa de compra o preço do item sobe e a cotação é recusada
  'sold-out', // na primeira tentativa de compra a edição esgota
  'session-expired', // a primeira tentativa de compra volta 401 (sessão expirou no checkout)
  'payment-declined', // o pagamento é sempre recusado, em qualquer rede
] as const

export type Scenario = (typeof scenarios)[number]

const KEY = 'mock-scenario'

export function currentScenario(): Scenario {
  try {
    const value = localStorage.getItem(KEY) as Scenario | null
    return value && scenarios.includes(value) ? value : 'default'
  } catch {
    return 'default'
  }
}

export function setScenario(name: Scenario) {
  localStorage.setItem(KEY, name)
  failuresLeft = 2
  used.clear()
}

// cenários que acontecem uma vez só por carga da página
const used = new Set<string>()

export function consumeOnce(name: Scenario): boolean {
  if (currentScenario() !== name || used.has(name)) return false
  used.add(name)
  return true
}

// quantas falhas ainda faltam no cenário atual (reinicia a cada carga da página)
let failuresLeft = 2

export function consumeFailure(): boolean {
  if (failuresLeft <= 0) return false
  failuresLeft -= 1
  return true
}

// latência da listagem, em ms, conforme o cenário
export function listLatency(query: string | null | undefined): number {
  switch (currentScenario()) {
    case 'slow':
      return 3000
    case 'out-of-order':
      return Math.max(100, 1500 - (query?.length ?? 0) * 350)
    default:
      return 300
  }
}
