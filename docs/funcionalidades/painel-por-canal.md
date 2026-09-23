# Painel por canal e Mehoo

**Módulo:** Painel por canal (id `painel_canal`) e Mehoo (id `mehoo`) — grupo **Canais** do menu · **Arquétipos de tela:** dashboard (indicadores + lista de obras que abre e fecha) · **Onde fica:** menu **Canais → Painel por canal** (rota `/painel-canal`) e **Canais → Mehoo** (rota `/mehoo`)

## Objetivo

Mostrar, para **um canal de compra** (Sienge, Mehoo, Automação, Cortinas e Persianas, GC,
Estoque), cada obra que tem item daquele canal: quando a obra entrega, quem é o GC, os cadernos do
executivo para baixar, e o que já foi e o que falta comprar. É a tela de quem atende o canal — em
especial a Mehoo, empresa do grupo que compra parte dos produtos, e as pessoas amarradas a um canal.

Os dois módulos são a mesma tela (`PainelCanalView`): o **Mehoo** é o painel fixo no canal Mehoo;
o **Painel por canal** tem o seletor de canal (ou fica preso ao canal da pessoa).

## Quem usa

| Perfil | O que vê | Onde é conferido |
|---|---|---|
| master, admin, geral, gc, taylor | os dois módulos; no Painel por canal escolhe o canal em abas | tela (`podeVerModulo`) |
| mehoo | só o módulo Mehoo, com todas as obras; não abre obra nem edita | tela (`web/src/lib/pessoas.js:247`); banco: `minhas_obras()` devolve todas as obras para `mehoo` |
| canal ("Canal de compra") | só o Painel por canal, preso ao canal da ficha (sem ficha: o primeiro, Sienge); não abre obra nem edita | tela (`web/src/lib/pessoas.js:256`, `canalPreso` em `web/src/App.jsx:21630`); **no banco o perfil `canal` não enxerga obra nenhuma** (ver riscos) |

Nada é gravado nestes módulos. O canal de cada item é escolhido em Compras de Produtos, dentro da obra.

## Fluxo

1. A pessoa abre o módulo. O painel usa as obras ativas que ela enxerga, com o conteúdo carregado
   pelo mesmo carregamento do Início e da Gestão (`POST /api/obras-resumos` + aditivos). Esse
   carregamento roda ao abrir **Início, Gestão ou Mehoo** (`web/src/App.jsx:21721`) — **não** ao
   abrir o Painel por canal (ver riscos).
2. No Painel por canal (sem canal preso), abas no topo escolhem o canal.
3. Filtro de obras (chips) quando há mais de uma obra com itens do canal.
4. Indicadores: material a comprar no canal, já comprado (com %), obras com itens e itens fora
   do prazo.
5. Lista de obras que têm item do canal, na ordem: com atraso primeiro, depois quem entrega antes,
   sem data por último. Cada linha mostra obra, squad, GC, endereço, data de entrega (e dias),
   total, falta comprar com barra e "N fora do prazo".
6. Abrir a obra mostra os **cadernos do executivo** (ver e baixar, por link temporário) e a tabela
   de itens do canal: verba, item (com verba, ambiente, fornecedor, código do fornecedor),
   quantidade e valor de material; item comprado aparece esmaecido.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente em App.jsx |
|---|---|---|---|
| Painel por canal | dashboard | `/painel-canal` | `PainelCanalView` (`web/src/App.jsx:19974`) com `seletorCanal` (`:25613`) |
| Mehoo | dashboard | `/mehoo` | `PainelCanalView` com `canalId="mehoo"` (`:25636`) |
| Linha da obra | bloco que abre e fecha | — | `ObraDoCanal` (`:19847`) |
| Caderno para baixar | linha com ações | — | `CadernoBaixar` |

## Estados e mensagens

| Estado | O que a tela mostra |
|---|---|
| Carregando | esqueletos no lugar dos indicadores e da lista |
| Erro ao carregar | "Não conseguimos carregar os dados das obras. Tente novamente." |
| Nenhuma obra com item do canal | "Nenhum item de <canal> ainda — Os itens aparecem aqui quando alguém escolhe <canal> como canal em Compras de Produtos, dentro da obra." |
| Caderno sem arquivo / perdido | "sem arquivo" / "arquivo não guardado — a equipe precisa anexar de novo" |

## Dados

Só leitura. Por item: `canalCompra`, `comprado`, `desc`, `ambiente`, `marca`, `codigoFornecedor`,
`qtdExecutivo`/`qtdVendida`, `un`, e o material de `parcelasDoItem`. Item trocado (`troca`) e linha
de título ficam de fora (`itensDoCanal`, `web/src/App.jsx:2633`). Da obra: `dataEntrega`,
`cadernos`, `squad`, `gc`, `endereco`.

O prazo de cada item é o do grupo dele contado da data de entrega; "fora do prazo" é item não
comprado com a data limite vencida (`painelDoCanal`, `:2664`).

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/obras-resumos` | login e membro; o banco (RLS, `minhas_obras()`) filtra as obras | `web/api/_lib/rotas/obraConteudo.js:270` | conteúdo das obras para o painel |
| GET | `/api/aditivos` | login e membro; RLS | `web/api/_lib/rotas/aditivos.js:63` | aditivos (seus itens aparecem no canal escolhido) |
| — | link do caderno (`linkParaArquivo`) | quem vê a obra (RLS do Storage) | `web/src/lib/arquivos.js:71` | ver ou baixar o caderno |

## Integrações

Storage (Supabase) para os cadernos. Nenhuma com o Sienge ou o Monday nesta tela.

## Regras de negócio usadas

- [RN-012](../regras-de-negocio/RN-012-perfis-de-painel-so-consultam.md) — Mehoo e "Canal de compra" veem só o painel do seu canal, com todas as obras, sem editar.
- [RN-050](../regras-de-negocio/RN-050-prazo-de-compra-por-grupo.md) — o prazo de cada item é o do grupo, contado da entrega.
- [RN-059](../regras-de-negocio/RN-059-compra-atrasada-e-perto-do-prazo.md) — "fora do prazo" é data limite vencida com compra pendente.

A Mehoo ver o valor de material é decisão registrada (ADR-001, decisão 5): é empresa do grupo.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| alta | Perfil "Canal de compra" não enxerga nenhuma obra | `minhas_obras()` não tem caso para `canal` (cai em `false`) e a API também não lista `canal` entre quem vê todas as obras: a pessoa entra e o painel fica vazio | `supabase/rls-reforco.sql:92`–`:106` (e a versão anterior em `supabase/taylor-made.sql:62`); `web/api/_lib/auth.js:87` |
| alta | Painel por canal não carrega os dados sozinho | o carregamento só roda em Início, Gestão e Mehoo; abrindo `/painel-canal` direto (ou sendo perfil `canal`, que só vê este módulo), as obras chegam sem itens e a tela diz "Nenhum item de <canal> ainda" | `web/src/App.jsx:21721` |
| baixa | Sem canal na ficha vale o Sienge | a pessoa "Canal de compra" sem canal escolhido cai no painel do Sienge, sem aviso | `web/src/App.jsx:21630` |
| baixa | Obra sem item do canal some | é a intenção (evitar lista de "nenhum item"), mas o filtro de obras também só oferece as que têm item | `web/src/App.jsx:2664` |

## Fora do escopo

- Escolher ou mudar o canal de um item: Compras de Produtos.
- Pedido ao fornecedor do canal (o PDF de pedido sai das Compras).

## Código

- `web/src/App.jsx` — `PainelCanalView`, `ObraDoCanal`, `CadernoBaixar`, `painelDoCanal`, `itensDoCanal`, `CANAIS_COMPRA`; no `App`: `canalPreso`, `canalDoPainel`, carregamento do painel e `obrasDoPainel`, blocos `modulo === "painel_canal"` e `modulo === "mehoo"`
- `web/src/lib/pessoas.js` (perfis `mehoo` e `canal`, `podeVerModulo`), `web/src/lib/arquivos.js`, `web/src/lib/dadosObra.js`
- `web/api/_lib/rotas/obraConteudo.js`, `web/api/_lib/auth.js`
- `supabase/taylor-made.sql` (`minhas_obras()`), `supabase/rls-reforco.sql`
- Decisões: `docs/ADR-001-perfis-de-acesso.md`, `docs/SPEC-acessos.md`
- Testes: `web/src/__testes__/painel-canal.test.mjs`, `painel-por-canal.test.mjs`, `canal-da-pessoa.test.mjs`
