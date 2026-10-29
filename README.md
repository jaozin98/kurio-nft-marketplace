# Kurio, marketplace de NFTs

- **Aplicação publicada:** https://kurio-nft-marketplace-mbwl.vercel.app
- **Repositório:** https://github.com/jaozin98/kurio-nft-marketplace

Solução do desafio de frontend: marketplace de NFTs em React e TypeScript, com a API, o login, as carteiras e os pagamentos simulados por MSW. Decisões de arquitetura, contratos e limitações estão em [ARCHITECTURE.md](./ARCHITECTURE.md).

## O que tem

Início (Hero, busca, filtros, abas, ordenação e paginação na URL, faixas de promoção e Diário da Cunhagem), detalhe do NFT com edições, carrinho com cupom, pagamento com carteira e rede (revisão em modal), confirmação do pedido, login e cadastro (modais), perfil (dados, avatar e senha), carteiras principal e secundária e lista de interesse. Preços e disponibilidade mudam em tempo real por Socket.IO. No mobile o app usa uma barra de navegação inferior, como no Figma.

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
| `LIVE_URL=<url> npm run test:e2e:live` | a mesma suíte contra um site já publicado, sem servidor local |
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

Você também pode criar contas em `/register` (nome de usuário de 3 a 20 letras, números ou `_`). As senhas nunca ficam em claro: o mock guarda só o hash SHA-256. As duas contas de teste já têm a carteira principal (`Principal`, MetaMask, Ethereum) e a secundária (`Reserva`, Coinbase Wallet, Polygon), e o código de indicação delas é `KURIO2026`. Contas novas começam sem carteira.

Cupons: `GREEN10` (10%), `GREEN25` (25%) e `OLD20` (expirado). Qualquer outro código é inválido.

## Cenários e reset

O estado do mock fica no `localStorage` (chave `mock-db-v6`), então sobrevive ao refresh.

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
| `price-change` | na primeira tentativa de compra o preço do item sobe (e o evento chega pelo socket) |
| `sold-out` | na primeira tentativa de compra a edição do item esgota |
| `session-expired` | a primeira tentativa de compra volta 401, como se a sessão tivesse vencido |
| `payment-declined` | o pagamento é recusado em qualquer rede |

As falhas de `list-error` e `network-error` são 2 porque o TanStack Query tenta de novo uma vez; assim o erro aparece para o usuário e o botão "Tentar de novo" recupera.

## Como reproduzir as falhas

| Situação | Como provocar |
|---|---|
| Resultado vazio | `/?scenario=empty` ou uma busca sem resultado |
| Erro HTTP 5xx e recuperação | `/?scenario=list-error` e clicar em "Tentar de novo" |
| Falha de conexão | `/?scenario=network-error` |
| Lentidão e skeleton | `/?scenario=slow` |
| Resposta fora de ordem | `/?scenario=out-of-order` e digitar na busca |
| Sessão expirada ao navegar | no console: `localStorage.setItem('token', 'x')` e abrir `/profile` |
| Sessão expirada no checkout | `/?scenario=session-expired` e confirmar uma compra; depois de entrar de novo o formulário volta preenchido |
| Cadastro com e-mail já existente | cadastrar `ana@greenmint.test` |
| Erro de validação de formulário | enviar perfil, senha, carteira ou cadastro com dados inválidos |
| Cupom inválido ou expirado | aplicar `QUALQUER` ou `OLD20` |
| Preço alterado durante a compra | `/?scenario=price-change` e confirmar uma compra (ou `__mock.updateNft('4', { price: '1.10' })` com o NFT 4 no carrinho) |
| Edição esgotada durante a compra | `/?scenario=sold-out` e confirmar uma compra (ou `__mock.updateNft('4', { stock: 0 })`) |
| Favoritar com falha (rollback) | favoritar o NFT 13 (a API responde 503) |
| Conexão da carteira recusada | escolher a carteira `Reserva` das contas de teste (endereço terminado em `dead`) e clicar em "Conectar carteira" |
| Pagamento recusado | escolher a rede Arbitrum no pagamento, ou `/?scenario=payment-declined` |
| Timeout depois de criar o pedido | `/?scenario=order-timeout` e confirmar uma compra; use "Recuperar pedido" |
| Evento duplicado ou antigo | `__mock.realtime.resend('nft.updated', evento)` |
| Queda do socket | `__mock.realtime.pause(4000)` e `__mock.realtime.drop()` |

Outras regras fixas dos dados: os NFTs de número múltiplo de 7 estão esgotados em todas as edições; cada NFT tem as edições `1/1`, `1/10`, `1/50` e `ABERTA` com estoque próprio.

## Testes

306 testes Playwright (153 por projeto: desktop 1440 px e mobile 390 px), cada um em contexto isolado:

- `catalog.spec.ts`: busca, filtros combinados, ordenação, paginação, abas, restauração pelo histórico (voltar e avançar) e refresh.
- `detail.spec.ts`: detalhe, edições, favoritos (com rollback) e compra.
- `cart.spec.ts`: quantidades, remoção, cupom, persistência e login com carrinho de visitante.
- `checkout.spec.ts`: compra completa (inclusive a partir do catálogo, sem atalhos), campos do pagamento, recusas, clique repetido, os cenários `price-change`, `sold-out`, `session-expired` e `payment-declined`, disponibilidade alterada pelo socket e timeout com recuperação.
- `realtime.spec.ts`: eventos pelo Socket.IO, duplicados e antigos, queda e retomada, isolamento por usuário e relógio controlado (`page.clock`).
- `security.spec.ts`: um usuário não abre o pedido de outro (403), pedido e rota inexistentes (404) e acesso direto a cada tela.
- `account.spec.ts`: cadastro e login em modal, sessão, troca de usuário, perfil (um só Salvar para dados e senha), avatar, carteiras principal e secundária e o menu lateral da conta.
- `network.spec.ts`: skeleton, falha com nova tentativa, vazio, fora de ordem e reset.
- `a11y.spec.ts`: teclado, foco, gaveta de filtros, erros ligados por aria, movimento reduzido e o axe.
- `visual.spec.ts`: início, detalhe, carrinho e pagamento (baselines versionadas em `e2e/__screenshots__/`).
- `responsive.spec.ts`: sem rolagem horizontal em 320 (reflow com zoom), 390, 768 e 1440 px nas telas principais.

Os testes de REST passam pelos handlers do MSW, e os de tempo real passam pelo `socket.io-client`.

## Lighthouse

Rodado em `vite build` + `vite preview` com os mocks no cenário padrão, 3 medições por página e perfil (mediana). Os relatórios HTML e JSON de cada medição estão em `lighthouse/reports/`, e o resumo em `lighthouse/summary.md`. O script `scripts/lighthouse.mjs` contém a configuração.

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | 95 | 99 | 100 | 100 | 2725 ms | 0.001 | 121 ms |
| Detalhe | mobile | 97 | 100 | 100 | 100 | 2475 ms | 0 | 106 ms |
| Início | desktop | 100 | 100 | 100 | 100 | 707 ms | 0.022 | 0 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 623 ms | 0.056 | 0 ms |

Medido na versão final da interface (rodapé completo, seções da Home, fotos novas e mobile), em 29/10/2026.

Ambiente: Lighthouse 13.6.0, Chromium 156.0.8078.4 (o do Playwright), Node 22, macOS arm64 com 8 núcleos. Todas as metas foram atingidas. O LCP no mobile (cerca de 2,5 s, com a rede 4G lenta simulada pelo Lighthouse) é o maior valor: o elemento é a foto principal do NFT. As imagens têm tamanho fixo e prioridade de carregamento, e o CLS fica em 0 no mobile. Não otimizei o peso das imagens além disso.

## Deploy

Publicado na Vercel, a partir do repositório do GitHub (cada push na `main` gera um novo deploy de produção):

- Aplicação: https://kurio-nft-marketplace-mbwl.vercel.app
- Repositório: https://github.com/jaozin98/kurio-nft-marketplace

O `vercel.json` tem o fallback de SPA, então o acesso direto e o refresh funcionam em qualquer rota (por exemplo `/nft/4`, `/cart` e `/profile`). O build publicado usa os mocks do MSW e o Socket.IO simulado, sem backend e sem variáveis de ambiente.

Para publicar outra cópia: `npm i -g vercel && vercel --prod`, ou importe o repositório pela Vercel (build `npm run build`, saída `dist`).

**Verificação do ambiente publicado:** 176 testes E2E (segurança e acesso direto, checkout, tempo real, catálogo e conta) passaram contra a URL acima, nos viewports desktop e mobile. Para repetir: `LIVE_URL=https://kurio-nft-marketplace-mbwl.vercel.app npm run test:e2e:live -- e2e/security.spec.ts e2e/checkout.spec.ts e2e/realtime.spec.ts`.

## Arte dos NFTs

As fotos dos NFTs (4 personagens, em `public/nfts/`, 3 variantes de cada) foram recortadas de capturas de tela do Figma que o autor forneceu, porque o arquivo do Figma é só de visualização e não permite exportar os assets. Por isso a resolução original é limitada (cerca de 234 a 434 px de lado); as imagens foram ampliadas para 768 px com reamostragem Lanczos e nitidez leve, o que melhora a definição sem inventar detalhe. Com os arquivos originais, basta trocar os JPGs de `public/nfts/` mantendo os nomes. Como há só 4 personagens, os 48 NFTs do catálogo repetem a arte, como no próprio Figma.

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
