import { setupWorker } from 'msw/browser'
import { updateNft } from './admin'
import { db, resetDb, save } from './db'
import { handlers } from './handlers'
import { servedSearches } from './handlers/nfts'
import { realtimeControls } from './realtime'
import { scenarios, setScenario, type Scenario } from './scenario'

// ?scenario=slow escolhe o cenário; ?reset=1 volta tudo ao estado inicial conhecido
const params = new URLSearchParams(window.location.search)
const requested = params.get('scenario') as Scenario | null
if (requested && scenarios.includes(requested)) setScenario(requested)
if (params.get('reset') === '1') resetDb()

export const worker = setupWorker(...handlers)

// permite aos testes E2E e à demonstração alterar o estado simulado
Object.assign(window, { __mock: { db, resetDb, save, updateNft, setScenario, realtime: realtimeControls, servedSearches } })
