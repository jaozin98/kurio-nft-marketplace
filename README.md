# Kurio, marketplace de NFTs

Solução do desafio de frontend: marketplace de NFTs em React e TypeScript, com a API, o login, as carteiras e os pagamentos simulados por MSW. Decisões de arquitetura, contratos e limitações estão em [ARCHITECTURE.md](./ARCHITECTURE.md).

## O que tem

Início (busca, filtros, abas, ordenação e paginação na URL), detalhe do NFT com edições, carrinho com cupom, pagamento com carteira e rede, confirmação de pedido, login, cadastro, perfil (dados, avatar e senha) e carteiras. Preços e disponibilidade mudam em tempo real por Socket.IO.

Stack: React 19, TypeScript, TanStack Router, TanStack Query, Axios, Socket.IO (cliente), Tailwind CSS, shadcn/ui, MSW (REST e Socket.IO), Playwright e Lighthouse. O build é feito com Vite.

## Como rodar

Requisitos: Node 22 ou mais novo.

```bash
npm install
npx playwright install chromium   # só para os testes e a auditoria
npm run dev                       # http://localhost:5173 com os mocks ativos
```

| Comando | O que faz |
|---|---|
| `npm run dev` | desenvolvimento com mocks |
| `npm run build` | verificação de tipos e build de produção |
| `npm run preview` | serve o build (porta 4173), com os mocks ativos |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run test:e2e` | todos os testes Playwright (desktop 1440 px e mobile 390 px) |
| `npm run test:visual` | só a regressão visual |
| `npm run test:visual:update` | regrava as baselines (`e2e/__screenshots__/`) |
| `npm run lighthouse` | auditoria Lighthouse (precisa de `npm run build` antes) |

Os testes sobem o servidor sozinhos (`reuseExistingServer`). O relatório HTML fica em `playwright-report/` e os traces das falhas em `test-results/`.

## Variáveis de ambiente

| Variável | Padrão | Efeito |
|---|---|---|
| `VITE_USE_MOCKS` | `true` | `false` desliga o MSW e o app passa a chamar `/api` de verdade |

O arquivo `.env.example` mostra o valor padrão. O build de demonstração publicado usa os mocks.

## Credenciais fictícias

| E-mail | Senha |
|---|---|
| `ana@greenmint.test` | `senha123` |
| `bruno@greenmint.test` | `senha123` |

Você também pode criar contas em `/register`. As senhas nunca ficam em claro: o mock guarda só o hash SHA-256.

Cupons: `GREEN10` (10%), `GREEN25` (25%) e `OLD20` (expirado). Qualquer outro código é inválido.

## Cenários e reset

O estado do mock fica no `localStorage` (chave `mock-db-v5`), então sobrevive ao refresh.

- Escolher um cenário: abra qualquer página com `?scenario=nome`, por exemplo `/?scenario=slow`. A escolha fica salva no navegador. `?scenario=default` volta ao normal.
- Reset total: `/?reset=1` apaga carrinhos, favoritos, pedidos, carteiras, contas criadas e estoque vendido. Também funciona no console: `__mock.resetDb()`.

| Cenário | O que acontece |
|---|---|
| `default` | tudo funciona, latência curta |
| `slow` | as listagens demoram 3 s (para ver os skeletons) |
| `list-error` | as 2 primeiras listagens falham com HTTP 500 e depois voltam |
| `network-error` | as 2 primeiras listagens falham sem resposta (conexão) e depois voltam |
| `empty` | a listagem volta vazia |
| `out-of-order` | buscas curtas respondem mais devagar, então respostas velhas chegam depois |
| `order-timeout` | o pedido é criado, mas a resposta demora mais que o timeout do cliente |

Os falhos de `list-error` e `network-error` são 2 porque o TanStack Query tenta de novo uma vez; assim o erro aparece para o usuário e o botão "Tentar de novo" recupera.

## Como reproduzir as falhas

| Situação | Como provocar |
|---|---|
| Resultado vazio | `/?scenario=empty` ou uma busca sem resultado |
| Erro HTTP 5xx e recuperação | `/?scenario=list-error` e clicar em "Tentar de novo" |
| Falha de conexão | `/?scenario=network-error` |
| Lentidão e skeleton | `/?scenario=slow` |
| Resposta fora de ordem | `/?scenario=out-of-order` e digitar na busca |
| Sessão expirada | no console: `localStorage.setItem('token', 'x')` e abrir `/profile` ou continuar o checkout |
| Cadastro com e-mail já existente | cadastrar `ana@greenmint.test` |
| Erro de validação de formulário | enviar perfil, senha, carteira ou cadastro com dados inválidos |
| Cupom inválido ou expirado | aplicar `QUALQUER` ou `OLD20` |
| Preço alterado durante a compra | `__mock.updateNft('4', { price: '1.10' })` com o NFT 4 no carrinho |
| Edição esgotada durante a compra | `__mock.updateNft('4', { stock: 0 })` |
| Favoritar com falha (rollback) | favoritar o NFT 13 (a API responde 503) |
| Conexão da carteira recusada | usar a carteira secundária das contas de teste (endereço terminado em `dead`) |
| Pagamento recusado | escolher a rede Arbitrum no pagamento |
| Timeout depois de criar o pedido | `/?scenario=order-timeout` e confirmar uma compra; use "Recuperar pedido" |
| Evento duplicado ou antigo | `__mock.realtime.resend('nft.updated', evento)` |
| Queda do socket | `__mock.realtime.pause(4000)` e `__mock.realtime.drop()` |

Outras regras fixas dos dados: os NFTs de número múltiplo de 7 estão esgotados em todas as edições; cada NFT tem as edições `1/1`, `1/10`, `1/50` e `ABERTA` com estoque próprio.

## Testes

192 testes Playwright (96 por projeto, desktop 1440 px e mobile 390 px), cada um em contexto isolado:

- `detail.spec.ts`: detalhe, edições, favoritos (com rollback) e compra.
- `cart.spec.ts`: quantidades, remoção, cupom, persistência e login com carrinho de visitante.
- `checkout.spec.ts`: compra completa, recusas, clique repetido, preço e estoque alterados, timeout com recuperação.
- `realtime.spec.ts`: eventos pelo Socket.IO, duplicados e antigos, queda e retomada, isolamento por usuário.
- `account.spec.ts`: cadastro, login, sessão, troca de usuário, perfil, avatar, senha e carteiras.
- `network.spec.ts`: skeleton, falha com nova tentativa, vazio, fora de ordem e reset.
- `a11y.spec.ts`: teclado, foco, gaveta de filtros, erros ligados por aria, movimento reduzido e o axe.
- `visual.spec.ts`: início, detalhe, carrinho e pagamento (baselines versionadas em `e2e/__screenshots__/`).
- `responsive.spec.ts`: sem rolagem horizontal em 390, 768 e 1440 px nas telas principais.

Os testes de REST passam pelos handlers do MSW, e os de tempo real passam pelo `socket.io-client`.

## Lighthouse

Rodado em `vite build` + `vite preview` com os mocks no cenário padrão, 3 medições por página e perfil (mediana). Os relatórios HTML e JSON de cada medição estão em `lighthouse/reports/`, e o resumo em `lighthouse/summary.md`. O script `scripts/lighthouse.mjs` contém a configuração.

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | 99 | 99 | 100 | 100 | 780 ms | 0 | 128 ms |
| Detalhe | mobile | 97 | 100 | 100 | 100 | 2442 ms | 0 | 101 ms |
| Início | desktop | 100 | 100 | 100 | 100 | 258 ms | 0.022 | 0 ms |
| Detalhe | desktop | 100 | 100 | 100 | 100 | 543 ms | 0.056 | 0 ms |

Ambiente: Lighthouse 13.6.0, Chromium do Playwright (Chrome for Testing), Node 22, macOS arm64 com 8 núcleos. Todas as metas foram atingidas. O LCP do detalhe no mobile (2,4 s) é o mais alto: o elemento é a imagem grande do NFT, gerada no código como SVG embutido. Não investiguei a fundo o que pesa nele.

## Deploy

O `vercel.json` já tem o fallback de SPA, para acesso direto e refresh funcionarem em qualquer rota. Para publicar:

```bash
npm i -g vercel
vercel --prod
```

ou conecte o repositório pela Vercel (build `npm run build`, saída `dist`). O build publicado usa os mocks e o Socket.IO simulado, sem backend. **Esta entrega ainda não foi publicada**: o deploy depende de uma conta, então fica para quem for publicar. Depois de publicar, confira o acesso direto a `/nft/4` e o refresh em `/cart`.

## Estrutura

```
src/
  pages/        telas
  components/   componentes de interface, filtros, diálogo e avisos
  features/     queries do TanStack Query por área (nfts, cart, orders...)
  lib/          cliente Axios, sessão, tempo real, ETH, cache
  mocks/        MSW: handlers REST, socket, fixtures, cenários e banco local
e2e/            testes Playwright e baselines visuais
scripts/        auditoria Lighthouse
lighthouse/     relatórios e resumo
```
