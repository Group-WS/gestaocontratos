# Obras finalizadas (concluir e reabrir obra)

**Módulo:** Finalizadas (`id: arquivo`) · **Arquétipos de tela:** listagem (cartões) · **Onde fica:** painel de obras → **Finalizadas**, no pé da lista (rota `/arquivo`); **Concluir obra** no cabeçalho da obra, grupo Visão geral

## Objetivo

Tirar do dia a dia a obra que terminou, sem apagá-la. Concluída, a obra sai da lista de obras e do
Início e vai para **Finalizadas**, guardada para consulta. Quem concluiu sem querer reabre por ali.

O nome da tela é "Finalizadas" (pedido de 19/09/2026: "arquivo" é palavra de sistema); o `id` e o
endereço continuam `arquivo` para não quebrar link salvo (`web/src/App.jsx:10483`–`10488`).

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| Admin master, Administrador, Geral | Concluir e reabrir qualquer obra | servidor (`exigirEdicaoDeObra`, `web/api/_lib/rotas/obras.js:165`) e banco (policy `obra: alterar`, `supabase/rls-reforco.sql:163`) |
| GC | Concluir e reabrir as obras em que responde por um papel e as obras sem GC | servidor e banco (os mesmos) |
| Taylor Made | Vê os dois botões, mas o servidor recusa | servidor (a tela não esconde) |
| Mehoo, Canal de compra | Não veem | tela |

A tela **não** confere perfil nem modo de edição para mostrar **Concluir obra** e **Reabrir**:
quem decide é o servidor.

## Fluxo

### Concluir a obra

1. Na obra, grupo **Visão geral**, a pessoa clica **Concluir obra** no cabeçalho
   (`web/src/App.jsx:25784`). Não é preciso habilitar a edição.
2. A tela pede confirmação (`marcarConcluida`, `web/src/App.jsx:22039`): "Concluir a obra
   "<nome>"? Ela sai da lista de obras ativas e vai para o Arquivo, em modo consulta — ninguém do
   time consegue mais alterar nada nela. Dá para reabrir depois, pelo Arquivo."
3. `concluirObra` (`web/src/lib/obras.js:83`) faz `PATCH /api/obras/:codigo/situacao` com
   `concluida`. O servidor grava `situacao = 'concluida'` e `concluida_em = agora`
   (`web/api/_lib/rotas/obras.js:162`).
4. A obra sai da lista de ativas e do Início; a tela solta a obra aberta.

### Consultar e reabrir

1. **Finalizadas** lista as obras concluídas em cartões com nome, código, squad e endereço
   (`ArquivoView`, `web/src/App.jsx:21049`).
2. **Reabrir** pede confirmação: "Reabrir a obra "<nome>"? Ela sai do Arquivo e volta para a lista
   de obras ativas, liberada para o time alterar. Dá para concluir de novo depois."
3. `marcarAtiva` (`web/src/App.jsx:22063`) faz o mesmo `PATCH` com `ativa`; o servidor limpa
   `concluida_em`. A obra volta para a lista e abre na tela.

Os cartões não abrem a obra: a única ação é **Reabrir**.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Finalizadas | listagem (cartões) | `/arquivo` | `ArquivoView` (`web/src/App.jsx:21049`), `ObraCard` (`web/src/App.jsx:20767`) |
| Concluir obra | ação no cabeçalho da obra | `/obra/:codigo` (Visão geral) | `web/src/App.jsx:25783`–`25787` |
| Entrada | navegação | pé do painel de obras, com a contagem | `Sidebar` (`web/src/App.jsx:10885`) |

## Estados e mensagens

| Estado | O que a tela diz |
|---|---|
| Nenhuma concluída | "Arquivo vazio — Nenhuma obra foi concluída ainda." |
| Concluindo / reabrindo | "Concluindo…" / "Reabrindo…" no botão |
| Falha ao concluir | aviso no topo "Não foi possível concluir "<obra>": <motivo>" |
| Falha ao reabrir | aviso no topo "Não foi possível reabrir "<obra>": <motivo>" |
| Sem permissão (Taylor Made, obra de outro GC) | "Obra não encontrada." — a barreira de obra responde 404 para não confirmar que a obra existe |

## Dados

| Campo (tabela `obra`) | Significado |
|---|---|
| `situacao` | `ativa` ou `concluida` (`check` em `supabase/schema.sql:26`) |
| `concluida_em` | quando foi concluída; nulo ao reabrir |

Concluir **não** mexe em `obra_dados`: o conteúdo, a trava e o histórico ficam como estavam. Não
há registro de quem concluiu nem de quem reabriu.

No mapa do Início, a obra concluída no app aparece como "concluída" quando não tem marcação manual
no espelho do Sienge (`statusSienge`, `web/src/App.jsx:18930`).

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| PATCH | `/api/obras/:codigo/situacao` | login + membro + editar a obra (perfil que edita e obra que a pessoa vê); RLS `obra: alterar` | `web/api/_lib/rotas/obras.js:162` | `concluida` grava a data; `ativa` limpa a data |
| GET | `/api/obras` | login + membro; RLS | `web/api/_lib/rotas/obras.js:102` | traz a `situacao` que separa ativas de finalizadas |

## Integrações

Nenhuma. Concluir no app não muda nada no Monday nem no Sienge.

## Regras de negócio usadas

- [RN-020](../regras-de-negocio/RN-020-obra-concluida-so-leitura.md) — obra concluída sai da operação e fica só para consulta; pode ser reaberta.
- [RN-011](../regras-de-negocio/RN-011-quem-edita-e-cria-obra.md) — concluir e reabrir é de quem edita a obra (master, admin, geral, GC), nas obras que vê.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | "Ninguém consegue mais alterar" é só da tela | o servidor e o banco não conferem a situação: gravação, patch, trava, arquivos e papéis continuam aceitos numa obra concluída. Quem chega nela por um endereço `/obra/NNNN` pode conseguir editar (suposição: não reproduzido) | `supabase/salvar-obra.sql:185`; `web/api/_lib/rotas/obraConteudo.js:186`; `web/src/App.jsx:10448` |
| média | Concluir com outra pessoa editando | o botão não olha a trava; a obra some da lista de quem concluiu, enquanto quem estava editando continua gravando nela | `web/src/App.jsx:25784`, `web/src/App.jsx:22039` |
| média | Sem trilha de quem concluiu ou reabriu | só `concluida_em` é gravado, e é apagado ao reabrir | `web/api/_lib/rotas/obras.js:167`–`169` |
| baixa | "Mantidas para consulta", mas sem como consultar | o cartão não abre a obra; para ver o conteúdo é preciso reabrir | `web/src/App.jsx:21049`–`21081` |
| baixa | Concluir não pede a edição | qualquer um que abre a obra vê **Concluir obra**, inclusive em modo leitura e a Taylor Made (que recebe "Obra não encontrada.") | `web/src/App.jsx:25783` |
| baixa | Textos ainda dizem "Arquivo" | a confirmação e o vazio falam em "Arquivo" e "Arquivo vazio", e a tela se chama "Finalizadas" | `web/src/App.jsx:22045`, `web/src/App.jsx:21057` |

## Fora do escopo

- Apagar obra.
- Encerrar a obra no Monday ou no Sienge.
- Marcar obra do Sienge como finalizada no mapa (é o `status_manual` do espelho, que hoje não tem
  tela).

## Código

- `web/src/App.jsx` — `ArquivoView` (`21049`), `marcarConcluida` (`22039`), `marcarAtiva` (`22063`), botão no cabeçalho (`25783`), `obrasConcluidas` (`21782`)
- `web/src/lib/obras.js` — `concluirObra`, `reabrirObra`
- `web/api/_lib/rotas/obras.js`, `web/api/_lib/auth.js`
- `supabase/schema.sql`, `supabase/rls-reforco.sql`
