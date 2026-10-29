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
| Sessão | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`, `POST /api/auth/logout` (a expiração aparece como 401 em qualquer rota) |
| Perfil | `GET /api/profile`, `PATCH /api/profile`, `PUT` e `DELETE /api/profile/avatar`, `POST /api/profile/password` |
| NFTs | `GET /api/nfts` (`q`, `tab`, `collection`, `rarity`, `network`, `min`, `max`, `sort`, `page`), `GET /api/nfts/featured`, `GET /api/nfts/:id`, `GET /api/filters` |
| Favoritos | `GET /api/favorites`, `GET /api/favorites/nfts` (os NFTs completos, para a Lista de interesse), `PUT` e `DELETE /api/favorites/:id` |
| Carrinho | `GET /api/cart`, `POST /api/cart/items`, `PATCH` e `DELETE /api/cart/items/:nftId/:editionId`, `POST` e `DELETE /api/cart/coupon`, `POST /api/cart/merge` |
| Cotação | `POST /api/quote` com `{ network }` |
| Carteiras | `GET /api/wallets`, `POST /api/wallets`, `PATCH /api/wallets/:id`, `POST /api/wallets/:id/connect`, `POST /api/wallets/disconnect` |
| Pedidos | `POST /api/orders` (cabeçalho `Idempotency-Key`), `GET /api/orders/:id` |
| Boletim | `POST /api/newsletter` (simulado: valida o e-mail e responde 202, sem guardar nada) |

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

Formato dos eventos (servidor para cliente), por socket:

```json
// nft.updated  (público)
{ "eventId": "evt-1730000000000-1", "nftId": "4", "version": 2, "price": "1.10",
  "editions": [{ "id": "1-10", "stock": 2 }, { "id": "open", "stock": 4 }] }

// order.updated  (só para os sockets do dono do pedido)
{ "eventId": "evt-1730000000000-2", "orderId": "ord-1730000000000-1", "userId": "u1",
  "version": 2, "status": "confirmed", "txHash": "0x…", "declineReason": null }
```

O cliente também envia `authenticate` com o token logo depois de conectar; é assim que o servidor sabe a quem pertencem os eventos de pedido.

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

## Campos de carteira, perfil e pagamento

Os formulários de **Carteiras** e **Pagamento** têm o mesmo conjunto de campos do Figma, na mesma ordem e com o mesmo componente (`WalletFormFields`): nome de exibição, apelido da carteira (em Carteiras) ou nome de usuário (no Pagamento), rede, nome do perfil, endereço da carteira, "ENS ou carteira secundária (opcional)", tipo de carteira (MetaMask, WalletConnect ou Coinbase Wallet), código de indicação, e-mail e nome ENS (sufixo `.eth`). Todos têm asterisco de obrigatório, como no Figma, menos o ENS ou carteira secundária. O **Perfil** tem nome de exibição, nome de usuário, e-mail, nome ENS, apelido da carteira e avatar, e um único botão "Salvar" que também troca a senha quando os campos de senha são preenchidos.

A validação é uma só (`src/lib/validation.ts`) e roda no cliente e no mock, então cliente e servidor nunca discordam; os erros da API voltam por campo. Regras principais: nome de usuário e nome do perfil com 3 a 20 letras, números ou `_`; nome ENS com 3 a 30 letras, números ou `-` (por isso `marina_teste` vira `marina-teste` por padrão); endereço `0x` com 40 caracteres hexadecimais; código de indicação com 4 a 12 letras ou números; observação até 280 caracteres.

No pagamento os campos vêm preenchidos pela conta e pela carteira escolhida (o endereço fica travado, porque é o da carteira cadastrada). "Usar outra carteira?" torna obrigatório o campo "ENS ou carteira secundária", que é gravado no pedido. A revisão antes do envio é um modal ("Revise seu pedido") com foco preso, e o servidor confere que o endereço enviado é o da carteira escolhida.

## Ajustes de acessibilidade em relação ao layout

- Link "Pular para o conteúdo" e contorno de foco visível em tudo que recebe foco (não existem no Figma).
- O botão Favoritar usa o texto visível como nome acessível e o estado vai em `aria-pressed`, para o nome acessível conter o texto visível.
- O asterisco de campo obrigatório fica fora do `<label>`, então o nome acessível do campo é só o texto ("Rede", e não "Rede*"); o asterisco é decorativo (`aria-hidden`) e o campo leva `aria-required`.
- As telas de produto e carrinho marcam "Mercado" como página atual, como no Figma, com sublinhado além da cor.
- Itens que levam a páginas fora do escopo (menu, rodapé, menu lateral da conta, "Esqueceu a senha?", login com Google e Facebook, redes sociais) ficam esmaecidos e desabilitados, com `aria-disabled` ou `disabled`, para não parecerem funcionar.
- Login, Cadastro, a gaveta de filtros e a revisão do pedido usam `<dialog>` modal, com foco preso (ciclo de Tab), `Esc` para fechar e retorno do foco; o foco inicial vai para o primeiro campo.
- Botão de mostrar e ocultar senha com `aria-pressed`.
- Seleção do navegador, cursor, rádios, controles deslizantes e barras de rolagem usam a cor de destaque.
- Controles de quantidade, abas e paginação ganharam nomes acessíveis e ícones desenhados em SVG, no lugar de símbolos de texto.
- Os ícones da barra inferior do mobile têm `aria-label`, e a barra tem o nome "Navegação inferior".

## Decisões de UX

- Os filtros, a aba, a ordenação e a página ficam na URL e entram no histórico. Mudar um filtro volta para a página 1.
- A edição esgotada fica desabilitada e riscada; a edição inicial é a primeira com estoque.
- O botão COMPRAR ("Comprar NFT" no mobile, como no Figma) adiciona ao carrinho e mostra a confirmação com o link para ele, sem ir direto ao checkout.
- No mobile (abaixo de 768 px) o menu e os ícones do cabeçalho viram uma barra inferior (Início, Lista de interesse, busca, carrinho e perfil); a busca ganha o botão de filtros ao lado, que abre a gaveta; o Hero vira um cartão com gradiente e os botões principais viram pílulas com gradiente. No Pagamento mobile a carteira e o resumo vêm antes do formulário.
- Login e Cadastro são modais sobre a Home no desktop e tela cheia no mobile; fechar volta ao catálogo.
- A confirmação do pedido é um cartão centralizado (como o modal do Figma), com o botão "Ver no Etherscan" levando a uma página de explorador simulada (`/tx/:hash`), porque a transação não existe em rede real.
- Páginas e ações fora do escopo ("Criadores", "Aprenda", ajuda) aparecem desabilitadas, para não parecerem funcionar.

## Desvios em relação ao Figma e limitações

- **Imagens:** o arquivo do Figma é só de visualização e não exporta assets. A arte dos 4 personagens vem de capturas de tela fornecidas pelo autor, recortadas em baixa resolução (234 a 434 px de lado), ampliadas para 768 px com reamostragem Lanczos e nitidez leve. Isso melhora a definição, mas não cria detalhe que a captura não tem; os 48 NFTs repetem os 4 personagens, como o Figma. Exportar os originais do Figma e trocar os arquivos de `public/nfts/` resolve, sem mudar código.
- **Fonte:** o arquivo usa uma variável de fonte que não consegui ler. Identifiquei **Roboto Mono** pelo desenho das letras. Tamanhos, pesos e alturas de linha de título, corpo, rótulo, menu e botão vieram do painel de propriedades.
- **Cores:** fundo `#140D0A`, texto `#F5F1EB`, laranja `#E89B55` e texto secundário `#CFB28C` foram lidos do Figma. O fundo dos painéis (`#1D1410`), a barra da marca no rodapé (`#2B1B10`) e a cor das bordas (`#3A2A20`) são estimados pelos screenshots.
- **Telas conferidas contra o Figma:** Início, Detalhe, Carrinho, Pagamento, Confirmação, Login, Cadastro, Perfil e Carteiras (desktop), e Início, Detalhe, Carrinho, Pagamento, Login e Cadastro (mobile). Perfil, Carteiras e Confirmação no mobile não têm frame no Figma e seguem o layout responsivo.
- **Mobile, o que ficou de fora:** o coração sobre a imagem e a pílula de nota do Detalhe; no Pagamento, a lista de carteiras por tipo (WalletConnect, MetaMask, Coinbase) como opções à parte, porque aqui o tipo da carteira vem da carteira cadastrada; os pontos do carrossel do Hero (seria um carrossel sem função); e a busca fica abaixo do Hero em vez de acima.
- **Desktop, o que ficou de fora:** os ícones de carrinho, favorito e busca que aparecem sobre o card ao passar o mouse (controles aninhados dentro de um link, o que não é acessível), as estrelas e avaliações do Detalhe, a aba de avaliações e os ícones de compartilhar (exigiriam dados e funções fora do escopo).
- **Ícones dos diferenciais do rodapé:** o Figma mostra as letras W, C e D dentro dos círculos (parecem marcadores sem ícone); usei ícones desenhados.
- **Login com Google e Facebook, "Esqueceu a senha?", redes sociais e artigos do blog:** aparecem como no Figma, mas desabilitados, porque levam a funções e páginas fora do escopo.
- **Código de indicação:** é obrigatório porque o Figma o marca com asterisco, embora o nome sugira o contrário.
- **Cenários de teste:** `price-change`, `sold-out` e `session-expired` ocorrem uma vez por carga da página, na primeira tentativa de compra, para os testes serem determinísticos.
- **Preço por edição:** é o mesmo para todas as edições de um NFT.
- **Largura de 768 px:** é testada só quanto à rolagem horizontal; não há baseline visual dedicada.
- **Baselines visuais:** foram geradas no macOS. Em outro sistema a renderização de fonte pode diferir um pouco e exigir `npm run test:visual:update`.
- **Lighthouse:** os números do README foram medidos antes das últimas mudanças de interface (rodapé, novas seções da Home, fotos novas e mobile). `npm run lighthouse` repete a auditoria.
