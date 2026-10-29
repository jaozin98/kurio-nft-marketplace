# Arquitetura, decisões e limitações

## Camadas

- **Telas** (`src/pages`) montam a interface e só falam com os hooks de `src/features`.
- **Features** (`src/features/*/queries.ts`) concentram o TanStack Query: chaves, consultas e mutations. Toda chamada REST passa pelo cliente Axios de `src/lib/api.ts`.
- **Mocks** (`src/mocks`) ficam só na camada de rede. Nenhum componente, hook ou o cliente Axios tem resposta fictícia ou caminho alternativo de negócio. Desligar os mocks (`VITE_USE_MOCKS=false`) não muda nenhuma linha fora de `src/mocks`.
- **Tempo real** (`src/lib/realtime.ts`) conecta o `socket.io-client` e aplica os eventos no cache.

## Contratos REST

Erros usam sempre `{ code?, message, errors? }`, onde `errors` mapeia campo para mensagem. O front lê `errors` e mostra cada mensagem no campo certo.

| Recurso | Rotas |
|---|---|
| Sessão | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| Perfil | `PATCH /api/profile`, `PUT` e `DELETE /api/profile/avatar`, `POST /api/profile/password` |
| NFTs | `GET /api/nfts` (`q`, `tab`, `collection`, `rarity`, `network`, `min`, `max`, `sort`, `page`), `GET /api/nfts/featured`, `GET /api/nfts/:id`, `GET /api/filters` |
| Favoritos | `GET /api/favorites`, `PUT` e `DELETE /api/favorites/:id` |
| Carrinho | `GET /api/cart`, `POST /api/cart/items`, `PATCH` e `DELETE /api/cart/items/:nftId/:editionId`, `POST` e `DELETE /api/cart/coupon`, `POST /api/cart/merge` |
| Cotação | `POST /api/quote` com `{ network }` |
| Carteiras | `GET /api/wallets`, `POST /api/wallets`, `PATCH /api/wallets/:id`, `POST /api/wallets/:id/connect`, `POST /api/wallets/disconnect` |
| Pedidos | `POST /api/orders` (cabeçalho `Idempotency-Key`), `GET /api/orders/:id` |

Respostas de erro cobertas: 401 (sessão inválida), 403 (sem permissão, ou recusa da carteira), 404, 409 (conflito: e-mail, edição esgotada, cotação mudou, chave de idempotência), 410 (cupom expirado), 413 (avatar grande), 422 (validação) e 5xx (falha transitória).

Valores em ETH trafegam como string decimal (`"0.9825"`) e as contas usam `BigInt` com 18 casas (`src/lib/eth.ts`). Quantidades são inteiros. O servidor calcula subtotal, desconto, taxa de rede e total, e o front só exibe.

Os valores de linha do carrinho (preço × quantidade) são calculados no cliente a partir dos preços da API, só para exibição. O total que vale é sempre o da API.

## Pedidos e idempotência

`POST /api/orders` exige `Idempotency-Key`. A mesma chave com o mesmo corpo devolve o mesmo pedido; com corpo diferente, 409. O cliente guarda a chave junto com o conteúdo em `localStorage`: repetir o mesmo pedido (timeout, refresh) reaproveita a chave, e mudar qualquer dado gera outra.

Antes de criar o pedido, o servidor revalida carteira conectada, estoque por edição e o total esperado (`expectedTotal`). Se algo mudou, devolve 409 com a cotação nova e o cliente exige uma nova confirmação do usuário.

O pedido nasce `pending` e passa para `confirmed` ou `declined` depois de 2 s. O estado é calculado por horário, então sobrevive ao refresh. `confirmed` e `declined` são terminais. A confirmação baixa o estoque só da edição comprada e tira do carrinho só o que foi comprado. O recibo é um snapshot do pedido e não muda se o catálogo mudar depois.

Se a resposta da criação se perder, o carrinho pode já ter sido esvaziado pelo servidor. O checkout então mostra "Há um pedido em andamento" com o botão "Recuperar pedido", que reenvia com a mesma chave e devolve o mesmo pedido.

## Sessão

- O token fica em `localStorage` (`token`). Ao carregar, `GET /api/auth/me` valida a sessão.
- Um interceptor do Axios trata 401: limpa o token e zera a sessão no cache. As telas privadas (`Private`) e o checkout redirecionam para `/login?redirect=...` e voltam ao ponto de origem depois.
- As rotas privadas também têm `beforeLoad` do TanStack Router, que redireciona na hora se não houver token.
- O formulário do checkout é guardado em `sessionStorage`, então uma sessão que expira no meio não perde o que foi digitado.
- Logout limpa todo o cache do TanStack Query, os avisos e o socket da sessão anterior. Os caches de favoritos, carrinho, carteiras e cotação já têm o id do usuário na chave.
- Senhas: o mock guarda só o hash SHA-256. O token do mock é `token-<id>`, suficiente para simular, **não** é um modelo de segurança real.

## Carrinho

O carrinho vive no "servidor" (mock), por dono: o id do usuário, ou um id de visitante enviado no cabeçalho `x-guest-id`. Cada item é identificado por NFT + edição. Ao fazer login ou cadastro, `POST /api/cart/merge` junta os itens do visitante na conta, limitados ao estoque de cada edição. Toda mutation devolve o carrinho inteiro já recalculado, e o cliente grava essa resposta no cache.

## Política de cache

| Dado | Regra |
|---|---|
| Padrão | `staleTime` 30 s, 1 nova tentativa |
| Listagem | `keepPreviousData` (sem piscar ao filtrar); a chave inclui todos os filtros; o `signal` do Axios cancela a requisição velha |
| Metadados de filtro | `staleTime` 5 min |
| Cotação do checkout | `staleTime` 0, buscada de novo ao revisar o pedido |
| Sessão | `staleTime` infinito; só muda por login, logout ou 401 |
| Pedido | consulta única; só faz polling a cada 1,5 s se o socket estiver desconectado |

Invalidações: após qualquer evento que muda um NFT no carrinho, invalidam-se `cart` e `quote`; após um pedido confirmado, `cart` e `nfts`. Ao reconectar o socket, `invalidateQueries()` busca de novo tudo o que está ativo.

Atualizações otimistas (com rollback em erro): favoritar (`useToggleFavorite`) e o nome no perfil (`useUpdateProfile`).

## Tempo real e reconciliação com o REST

Eventos (`nft.updated`, `order.updated`) carregam `eventId` (identidade estável), o recurso afetado e `version`. O cliente:

1. Descarta `eventId` repetido (janela dos últimos 200).
2. Só aplica o evento se `version` for maior que a do cache. Evento antigo nunca regride um estado mais novo.
3. Ignora `order.updated` cujo `userId` não seja o da sessão atual.
4. Atualiza detalhe, listagens e carrinho, avisa o usuário numa região `aria-live` e recalcula o resumo pela API.
5. Ao reconectar, busca os recursos ativos pelo REST, porque eventos podem ter se perdido.

O checkout bloqueia a confirmação enquanto a cotação estiver diferente da que o usuário viu, e o servidor também recusa uma cotação velha. Há um socket por sessão, encerrado ao sair ou trocar de usuário.

### Transporte nos mocks e limitações

O Socket.IO é simulado com `ws.link` do MSW e `@mswjs/socket.io-binding`; o cliente é o `socket.io-client` real, só com transporte WebSocket. Limitações encontradas:

- O MSW remove o prefixo `/socket.io/` da URL antes de comparar, então o handler usa só a origem. Por isso o HMR do Vite foi movido para `/__vite_hmr` (`vite.config.ts`).
- O `socket.io-client` guarda o `WebSocket` nativo na hora do import. O app só é carregado depois do `worker.start()` (`src/main.tsx` e `src/bootstrap.tsx`); sem isso o MSW não intercepta o socket.
- O binding responde ao handshake, mas não manda ping; o mock manda um a cada 20 s, senão o cliente cai em cerca de 30 s.
- O binding só cobre eventos simples: sem salas, namespaces ou broadcast. O broadcast é feito percorrendo os sockets abertos.
- O estado do mock vive em cada aba. Duas abas não se enxergam em tempo real.
- Mudanças de preço feitas por `updateNft` não persistem após recarregar; o estoque vendido persiste.

## Acessibilidade

Skip link, foco visível global, `<main>` focável, labels e mensagens de erro ligadas por `aria-describedby` e `aria-invalid`, controles de grupo (`radiogroup` das edições, `group` da quantidade), regiões `aria-live` para mutations e eventos em tempo real, e `prefers-reduced-motion` desliga o shimmer. A gaveta de filtros usa `<dialog>` modal com ciclo de foco próprio, `Esc` para fechar e retorno do foco ao botão. O axe não encontra violações sérias ou críticas em início, detalhe, carrinho, login, cadastro e pagamento.

## Decisões de UX

- Os filtros, a aba, a ordenação e a página ficam na URL e entram no histórico. Mudar um filtro volta para a página 1.
- A edição esgotada fica desabilitada e riscada; a edição inicial é a primeira com estoque.
- O botão COMPRAR (como no Figma) adiciona ao carrinho e mostra a confirmação com o link para ele, sem ir direto ao checkout.
- Páginas e ações fora do escopo ("Criadores", "Aprenda", ajuda) aparecem desabilitadas, para não parecerem funcionar.

## Desvios em relação ao Figma e limitações

- **Imagens:** os macacos do arquivo não puderam ser exportados (arquivo só de visualização). As obras são ilustrações geradas em código (SVG), com as mesmas proporções.
- **Fonte:** o arquivo usa uma variável de fonte que não consegui ler. Identifiquei **Roboto Mono** pelo desenho das letras. Tamanhos, pesos e alturas de linha de título, corpo, rótulo, menu e botão vieram do painel de propriedades.
- **Cores:** fundo `#140D0A`, texto `#F5F1EB`, laranja `#E89B55` e texto secundário `#CFB28C` foram lidos do Figma. O fundo dos painéis (`#1D1410`) e a cor das bordas (`#3A2A20`) são estimados pelo screenshot.
- **Telas ajustadas ao Figma:** Início, detalhe e carrinho. Pagamento, confirmação, login, cadastro, perfil e carteiras usam os mesmos tokens, mas **não foram comparados tela a tela**. No Figma, login e cadastro são modais sobre a Home; aqui são páginas. Os frames mobile do Figma não foram comparados. O layout é responsivo: as larguras 390, 768 e 1440 px têm teste de ausência de rolagem horizontal, e 390 e 1440 px têm baselines visuais.
- **Home:** faltam as faixas de promoção e o "Diário da Cunhagem", e o indicador de três pontos do hero (seria um carrossel sem função). O rodapé foi simplificado.
- **Detalhe:** sem estrelas e "avaliações de colecionadores", aba de avaliações e ícones de compartilhar (exigiriam dados e funções fora do escopo).
- **Preço por edição:** é o mesmo para todas as edições de um NFT.
- **Largura de 768 px:** é testada só quanto à rolagem horizontal; não há baseline visual dedicada.
- **Baselines visuais:** foram geradas no macOS. Em outro sistema a renderização de fonte pode diferir um pouco e exigir `npm run test:visual:update`.
- **Deploy:** não foi publicado (ver README).
