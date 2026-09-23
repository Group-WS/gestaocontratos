# CMV (liberação do teto de custo)

**Módulo:** Obras › Planejamento · **Arquétipos de tela:** detalhe (resumo por grupo + ação de liberar) · **Onde fica:** obra › Planejamento › **CMV** (`/obra/:codigo/cmv`; id interno `vendido_conferencia`)

> Linhas de código conferidas no commit `468c554` (branch `docs/documentacao-sistema`). No código a
> tela ainda se chama "Depara" (`DeparaContratoPlanilhaView`, `deparaAprovado`): a comparação
> contrato × planilha saiu com a etapa do contrato, e sobrou só a apuração e a liberação do CMV.

## Objetivo

Apurar o **CMV** — o custo da Vendido Planilha somado por grupo e no total — e **liberá-lo** como
teto de custo da obra. Liberar o CMV é o ato que abre o Executivo e a Conf. Executivo. O valor
liberado fica congelado e é contra ele que o Executivo mede o quanto ainda cabe, e o Plano de Compras
decide se a liberação das compras precisa de justificativa de estouro.

Valor de venda e margem **não** aparecem aqui: a tela é usada pela equipe de obra, e o valor de venda
não é divulgado para ela (comentário em `web/src/App.jsx:7155`).

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| master, admin, geral, gc (quem edita obra), com a edição habilitada | liberar o CMV | só na tela (`podeLiberar = cmvApurado && podeEditar`, `web/src/App.jsx:7312`). O servidor só exige editar a obra; o banco não confere quem libera nem o valor |
| quem enxerga a obra | ver o CMV por grupo | tela + RLS de leitura |
| quem edita, em obra sem Vendido nenhum | "Começar direto pelo Executivo, sem CMV" | só na tela (`edicao.minha && obra.semDetalhe`, `web/src/App.jsx:25796`) |

Não existe exigência de administrador para liberar o CMV.

## Fluxo

1. Com a Vendido Planilha importada (ver `vendido.md`), a pessoa abre **Planejamento › CMV**.
2. A tela cruza os itens (`conferirObra`) e soma o custo da planilha por grupo
   (`calcularCMV`, `web/src/App.jsx:7162`):
   - soma o `custo` de cada linha da Vendido Planilha que entra na conferência;
   - soma também as verbas que **não se conferem item a item** — 01, 02 e Móveis Sob Medida
     (`NAO_ANALISADAS_CODIGO`, `web/src/App.jsx:7116`, resolvidas pelo **nome** do grupo) — direto da
     planilha: "não conferimos" não é "não custa";
   - soma os grupos **fora da EAP** padrão, marcados "fora do padrão da EAP".
3. O quadro mostra o CMV total e o CMV por grupo com a participação de cada um (`ResumoCMV`,
   `web/src/App.jsx:7241`).
4. Se o total for zero (planilha sem coluna de custo), o cartão diz "CMV ainda não apurado" e o botão
   **Liberar CMV** fica desabilitado.
5. Com o total > 0 e a edição habilitada, **Liberar CMV** pede confirmação ("Este vira o teto de custo
   da obra…"). Confirmado, `aprovarDepara` (`web/src/App.jsx:22913`) grava `deparaAprovado = true`,
   `cmvLiberado` (o total visto), `cmvLiberadoEm` e `cmvLiberadoPor` (o usuário logado, vindo da
   tela), pela gravação inteira da obra.
6. A etapa aparece como concluída ("CMV liberado — Executivo e etapas seguintes abertos.", com quem e
   quando). Não há botão de concluir nem de reabrir: a etapa conclui pelo próprio ato
   (`etapaConcluida`, `web/src/App.jsx:11183`).
7. A partir daí o Executivo e a Conf. Executivo deixam de mostrar o bloqueio "Aguardando a liberação
   do CMV" (`FaseBloqueada`, `web/src/App.jsx:8641`).

### Começar sem o CMV

Para obra que só tem o cadastro do Monday (sem Vendido nenhum, `semDetalhe`), o bloqueio do Executivo
oferece **Começar direto pelo Executivo, sem CMV por enquanto** (confirmação obrigatória).
`comecarExecutivoSemDepara` (`web/src/App.jsx:22926`) grava só `executivoLiberadoDireto = true`: o
Executivo abre **sem teto**, e a etapa CMV continua pendente. A Conf. Executivo **não** abre por esse
caminho — ela exige `deparaAprovado` (`web/src/App.jsx:25798`).

### Como o teto é usado depois

- **Executivo**: `cmvDaObra` (`web/src/App.jsx:7226`) devolve o valor gravado. O painel do alto
  (`SaldoExecutivo`, `web/src/App.jsx:9154`) compara com o CMV puro; o fechamento no rodapé da
  planilha soma ao teto o saldo dos aditivos **aprovados** (`resumoAditivos`, em `ExecutivoView`).
- **Plano de Compras**: `LiberacaoCompra` (`web/src/App.jsx:4114`) compara o total do executivo com o
  CMV puro (sem aditivos); acima do teto, liberar as compras exige justificativa e o nome de quem
  autorizou (fora do escopo desta ficha).
- Obra liberada numa versão antiga do app, com `deparaAprovado` mas sem `cmvLiberado` gravado: o CMV
  é **recalculado** das categorias atuais e marcado "recalculado".

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente em App.jsx |
|---|---|---|---|
| CMV total e por grupo | detalhe | `/obra/:codigo/cmv` | `ResumoCMV` (`web/src/App.jsx:7241`) dentro de `DeparaContratoPlanilhaView` (`web/src/App.jsx:7283`) |
| Cartão "Liberar CMV" | ação do detalhe | mesma | `DeparaContratoPlanilhaView` |
| Bloqueio do Executivo / Conf. Executivo | página de sistema (estado vazio) | `/obra/:codigo/executivo`, `/obra/:codigo/conferencia` | `FaseBloqueada` (`web/src/App.jsx:8641`) |

## Estados e mensagens

| Estado | O que a tela mostra |
|---|---|
| Sem Vendido Planilha | "CMV ainda sem base — Importe a Vendido Planilha desta obra…" |
| CMV = 0 | cadeado + "CMV ainda não apurado. O Executivo abre quando a Vendido Planilha trouxer valor…"; botão desabilitado |
| Modo leitura | botão desabilitado |
| Confirmação | "Liberar o CMV de R$ X?" / "Este vira o teto de custo da obra, e o Executivo e as etapas seguintes abrem para a equipe." |
| Liberado | cartão some; estado da etapa: "Etapa concluída · por … · data e hora · CMV liberado — Executivo e etapas seguintes abertos." |
| Executivo/Conf. sem CMV | "Aguardando a liberação do CMV" + **Ir para o Depara** (e, em obra sem Vendido, o atalho de começar sem CMV) |

## Dados

| Onde | Campo | Significado |
|---|---|---|
| `obra_dados` | `depara_aprovado` (`deparaAprovado`) | CMV liberado; abre Executivo e Conf. Executivo; conclui a etapa |
| `obra_dados` | `cmv_liberado` (`cmvLiberado`) | o teto congelado no momento da liberação |
| `obra_dados` | `cmv_liberado_em`, `cmv_liberado_por` | quando e quem liberou (texto; vem da tela) |
| `obra_dados` | `executivo_liberado_direto` (`executivoLiberadoDireto`) | Executivo aberto sem CMV (obra sem Vendido) |

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/obras/:codigo/gravar` | login, membro, editar a obra; banco confere trava e versão; formato de cada coluna (`conteudoDaObra`, `web/api/_lib/validacao.js:142`) | `web/api/_lib/rotas/obraDados.js:105` | grava a obra, inclusive as marcas do CMV |
| POST | `/api/obras/:codigo/patch` | idem; aceita as marcas `depara_aprovado`, `cmv_liberado*`, `executivo_liberado_direto` como coluna | `web/api/_lib/rotas/obraDados.js:129` | o app hoje não usa patch para o CMV, mas a rota aceita |

## Regras de negócio usadas

- [RN-032](../regras-de-negocio/RN-032-cmv-soma-o-custo-do-vendido.md) — o CMV é o custo da Vendido Planilha somado por grupo,
  incluindo os grupos que não se conferem item a item e os fora da EAP.
- [RN-033](../regras-de-negocio/RN-033-cmv-so-libera-com-valor.md) — só se libera CMV maior que zero.
- [RN-034](../regras-de-negocio/RN-034-cmv-congelado.md) — o CMV liberado é um teto fixo; mudanças posteriores na planilha
  não o movem.
- [RN-035](../regras-de-negocio/RN-035-executivo-exige-cmv-liberado.md) — o Executivo e a Conf. Executivo só abrem com o CMV liberado;
  a obra sem Vendido pode começar o Executivo sem teto.
- [RN-047](../regras-de-negocio/RN-047-acima-do-cmv-exige-justificativa.md) — liberar as compras acima do CMV exige
  justificativa e o nome de quem autorizou (usada pelo Plano de Compras).
- [RN-030](../regras-de-negocio/RN-030-grupo-fora-da-eap-vai-para-o-fim.md) — grupo fora da EAP também conta no CMV.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | CMV > 0 é exigido só na tela | Uma gravação pela API com `depara_aprovado = true` e `cmv_liberado` nulo ou zero abre o Executivo e a Conf. Executivo sem teto; o banco só confere o tipo da coluna | `web/src/App.jsx:7312`; `supabase/salvar-obra.sql` (validação de formato) |
| média | Autoria do CMV não é garantida | `cmv_liberado_por` é texto que vem da tela; o banco aceita qualquer nome. Qualquer perfil que edita (inclusive GC) libera | `aprovarDepara` (`web/src/App.jsx:22913`) |
| média | Teto congelado não acompanha a planilha | Reimportar a Vendido Planilha (com mais ou menos custo) não muda o teto do Executivo nem do Plano; a aba CMV passa a mostrar o valor novo recalculado, diferente do teto em uso | `cmvDaObra` (`web/src/App.jsx:7226`), `ResumoCMV` (`web/src/App.jsx:7241`) |
| média | Não há como desfazer a liberação pela tela | Nenhum caminho volta `deparaAprovado` para falso nem troca o `cmvLiberado`; um CMV liberado com a planilha errada só se corrige no banco (ou restaurando versão, se houver uma anterior) | busca por `deparaAprovado: false` sem resultado em `web/src/App.jsx` |
| média | "Começar sem o CMV" deixa a obra sem teto e sem Conf. Executivo | O Executivo roda sem "Acima do CMV"; a Conf. Executivo continua bloqueada (exige `deparaAprovado`), então nada é liberado para compra até alguém liberar um CMV. A API aceita `executivo_liberado_direto` em qualquer obra, não só na sem Vendido | `comecarExecutivoSemDepara` (`web/src/App.jsx:22926`), `web/src/App.jsx:25794-25798` |
| média | Dois tetos diferentes | O fechamento do Executivo soma o saldo dos aditivos aprovados ao teto; o painel do alto do Executivo e o Plano de Compras comparam com o CMV puro. A mesma obra pode estar "ainda cabe" no rodapé do Executivo e pedir justificativa de estouro no Plano (ou o contrário, com supressão) | `ExecutivoView` (`web/src/App.jsx:9425`), `SaldoExecutivo` (`web/src/App.jsx:9154`), `LiberacaoCompra` (`web/src/App.jsx:4114`) |
| baixa | CMV "recuperado" não é o do dia da aprovação | Quando `cmvLiberado` falta, o valor é recalculado das categorias **atuais**; se a planilha mudou desde a aprovação, o número difere do aprovado (o comentário do código supõe que é o mesmo) | `cmvDaObra` (`web/src/App.jsx:7226`) |

## Fora do escopo

- Importar a Vendido Planilha: `vendido.md`.
- O painel de saldo do Executivo: `executivo.md`.
- A liberação do Plano de Compras e a justificativa de estouro: ficha do Plano de Compras.

## Código

- `web/src/App.jsx` — `DeparaContratoPlanilhaView`, `ResumoCMV`, `calcularCMV`, `cmvDaObra`,
  `NAO_ANALISADAS_CODIGO`, `aprovarDepara`, `comecarExecutivoSemDepara`, `FaseBloqueada`,
  `SaldoExecutivo`, `etapaConcluida`
- `web/api/_lib/rotas/obraDados.js`, `web/api/_lib/validacao.js` — gravação e formato
- `supabase/schema.sql` (colunas `cmv_liberado*`, `depara_aprovado`), `supabase/salvar-obra.sql`
- Testes: `web/src/__testes__/cmv-fora-do-padrao.test.mjs`
