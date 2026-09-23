# Gravação da obra

**Módulo:** Obras (todas as telas de edição da obra) · **Arquétipos de tela:** detalhe (barra da obra), avisos globais · **Onde fica:** barra do cabeçalho da obra (`/obra/:codigo`) e faixa de avisos no topo de qualquer tela

## Objetivo

Tudo o que a pessoa digita numa obra chega ao banco — ou a tela diz, com clareza, que não chegou
e o que fazer. Nenhuma gravação apaga o trabalho de outra pessoa em silêncio.

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| Admin master, Administrador, Geral | Gravar em qualquer obra, com a edição habilitada | tela (`perfilEdita`), servidor (`exigirEdicaoDeObra`, `web/api/_lib/auth.js:212`) e banco (trava e versão em `salvar_obra`; RLS `obra_dados: alterar`) |
| GC | Gravar nas obras em que responde por um papel e nas obras sem GC | os mesmos três lugares; o RLS limita às `minhas_obras()` |
| Taylor Made, Mehoo | Não gravam nada | tela (a edição nunca fica "minha") e servidor (`PERFIS_QUE_EDITAM`, `web/api/_lib/auth.js:86`) |
| Restaurar uma versão do histórico | Na tela, só quem cuida da Equipe (Admin master) | tela (`podeRestaurar`, `web/src/App.jsx:25874`); o servidor aceita qualquer perfil que edita — ver Riscos |

## Fluxo

1. A pessoa abre a obra em **modo leitura**. A obra vem do banco junto com a sua `versao`
   (`aplicarDadosDoBanco`, `web/src/App.jsx:22221`).
2. **Habilitar edição** pega a trava e, no mesmo pedido, traz a obra como está no banco *agora*.
   É essa que a pessoa passa a editar — a cópia que estava aberta pode ser de antes da última
   gravação de outra pessoa (`habilitarEdicao`, `web/src/App.jsx:22655`). Ver
   [obra-navegacao.md](obra-navegacao.md).
3. Cada alteração entra na **fila de gravação** da obra (`filaDaObra`, `web/src/App.jsx:22409`;
   `web/src/lib/filaDeGravacao.js`): a gravação sai 1,2 s depois da última alteração, uma por vez,
   sempre com o estado mais recente da tela. Só entra na fila a alteração feita com a edição
   habilitada (`web/src/App.jsx:22429`).
4. Quando tudo o que mudou é estado de compra ou uma marca da obra (etapas concluídas, compras
   liberadas, assinatura do cliente…), vai **só a mudança** (`POST /api/obras/:codigo/patch`,
   ADR-004 fatias 1 e 2). Qualquer outra mudança, ou patch recusado porque a posição do item não
   bate mais, grava **a obra inteira** (`POST /api/obras/:codigo/gravar`, comprimida)
   (`gravarUmaVez`, `web/src/App.jsx:22352`).
5. O banco (`salvar_obra`, `supabase/salvar-obra.sql:185`) só grava se a trava for de quem grava
   **e** a versão for a que a tela leu. Gravou: a versão sobe e a barra mostra "salvo".
6. **Finalizar edição**, trocar de tela ou ficar 5 minutos sem mexer: a tela grava o que falta e
   só então devolve a trava. Se a gravação falhar, a trava fica com a tela até gravar
   (`web/src/App.jsx:22536`).
7. Uma alteração avulsa por fora da tela (o Catálogo mandando produtos, a Apresentação guardando
   o PDF) segue o mesmo caminho: pega a trava, lê a obra atual e grava com a versão lida — ou,
   com a obra em edição na mesma aba, entra pela tela e vai pela fila dela (`alterarObra`,
   `web/src/lib/dadosObra.js:197`).
8. Esconder a aba grava na hora; a rede voltar tenta de novo na hora (`web/src/App.jsx:22450`).

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Barra da obra (situação da gravação, habilitar/finalizar) | detalhe | `/obra/:codigo` | `BarraEtapa` (`web/src/App.jsx:21104`), `SituacaoDaGravacao` (`web/src/lib/gravacaoUi.jsx`) |
| Avisos da gravação (qualquer tela) | aviso global | — | `AvisosDeGravacao` (`web/src/lib/gravacaoUi.jsx`), montado em `web/src/App.jsx:25570` |
| Versões guardadas (restaurar) | detalhe (lista) | pé da página da obra | `VersoesDaObra` (`web/src/App.jsx:3248`) |

## Estados e mensagens

| Estado | Onde aparece | O que a tela diz | Saída |
|---|---|---|---|
| pendente | barra | "alterações por gravar…" | — |
| salvando | barra | "salvando…" | — |
| salvo | barra | "salvo" | — |
| erro (temporário: rede, servidor) | barra e aviso | "não salvo — nova tentativa em N s" | nova tentativa sozinha (2 s, 5 s, 10 s, 20 s, 30 s, até 1 min), e **Tentar agora** |
| recusado (o servidor disse não a este conteúdo, ex.: RN-001) | aviso | a mensagem do servidor | desfazer a alteração, ou **Tentar agora** |
| conflito — versão | aviso | a obra foi alterada no banco por outra pessoa depois que a tela a leu; nada foi gravado por cima | **Recarregar a obra** (com confirmação, descarta o que não gravou) |
| conflito — trava | aviso | a edição está com outra pessoa | **Recarregar a obra** |
| conflito — vazia | aviso | a tela está sem os itens, e o banco tem itens | **Recarregar a obra** |

Em conflito, a tela volta ao modo leitura e esconde **Habilitar edição** até a pessoa decidir
(`web/src/App.jsx:22439`). Se a trava saiu da tela sem ninguém assumir (venceu parada), a
gravação assume de novo e tenta uma vez, sempre conferindo a versão (`gravarObraAgora`,
`web/src/App.jsx:22393`).

Com qualquer coisa por gravar, **fechar ou recarregar a aba** faz o navegador perguntar antes, e
**Sair** da conta tenta gravar primeiro (até 8 s) e, se não der, pergunta "Descartar alterações?"
(`sairDaConta`, `web/src/App.jsx:21959`). Nenhuma mensagem manda dar F5: recarregar a página é
justamente o jeito de perder o que falta gravar.

Obra que não carregou: a edição fica fechada, e a barra oferece **Tentar de novo** (sem
recarregar a página).

## Dados

Tabela `obra_dados` (uma linha por obra):

| Campo | Significado |
|---|---|
| `versao` | sobe sozinha a cada mudança de **conteúdo** (gatilho); pegar e soltar a trava não mexem nela |
| `editando_por`, `editando_desde` | a trava; viva por 5 minutos desde a última gravação |
| `atualizado_por`, `atualizado_em` | quem gravou por último e quando (do login) |
| `categorias` | verbas e itens (JSONB grande — passa de 1 MB em obra grande) |
| `cadernos`, `arquivos`, `aprovacoes`, `etapas_concluidas`, `depara_aprovado`, `executivo_liberado_direto`, `compras_liberadas`, `cliente_*`, `compra_sem_assinatura_*`, `cmv_liberado*`, `data_entrega`, `escopos` | as outras colunas de conteúdo; lista completa em `COLUNAS_DA_OBRA` (`web/api/_lib/rotas/obraConteudo.js:45`) |

Tabela `obra_versao`: cópia da linha **antes** de cada gravação inteira, de cada queda (menos itens
ou menos itens liberados) e um marco por hora. Ficam as 24 mais novas, os 24 marcos mais novos e
toda queda dos últimos 30 dias (`supabase/salvar-obra.sql:482`).

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/obras/:codigo/gravar` | login + membro + editar a obra; banco: trava de quem grava + versão lida + "vazia não grava por cima" | `web/api/_lib/rotas/obraDados.js:105` | grava a obra inteira (`{ versao, gzip }`, até o limite de conteúdo); 409 com o motivo quando não bate |
| POST | `/api/obras/:codigo/patch` | idem (a API exige a versão) | `web/api/_lib/rotas/obraDados.js:129` | grava só as mudanças (até 5000 patches); devolve aplicados e recusados |
| POST | `/api/obras/:codigo/versoes/:id/restaurar` | login + membro + editar a obra | `web/api/_lib/rotas/obraDados.js:143` | restaura uma versão guardada; o banco recusa só se outra pessoa estiver com a trava viva (não confere versão — restaurar é gravar por cima de propósito) (`supabase/salvar-obra.sql:371`) |
| GET | `/api/obras/:codigo/versoes` | login + membro + ver a obra | `web/api/_lib/rotas/obraConteudo.js:296` | lista as versões (sem o conteúdo) |
| POST | `/api/obras/:codigo/edicao` | login + membro + editar a obra | `web/api/_lib/rotas/obraConteudo.js:186` | pega a trava e devolve a obra atual |
| DELETE | `/api/obras/:codigo/edicao` | login + membro + editar a obra | `web/api/_lib/rotas/obraConteudo.js:231` | devolve a trava (só a própria) |
| GET | `/api/obras/:codigo/conteudo` | login + membro + ver a obra | `web/api/_lib/rotas/obraConteudo.js:135` | lê a obra com a versão |

Respostas de recusa (`responder`, `web/api/_lib/rotas/obraDados.js:49`): 409 `trava` (com quem e
desde quando), 409 `versao` (com quem gravou e quando), 409 `vazia`, 503 quando falta rodar
`supabase/salvar-obra.sql`, 413 quando passa do limite, 400 para formato inválido.

## Integrações

Nenhuma externa. A gravação passa pela função da Vercel, que corta o corpo em 4,5 MB — por isso o
conteúdo vai comprimido (gzip + base64) nos dois sentidos.

## Regras de negócio usadas

- RN-001 — Só o administrador libera a compra (a gravação protegida continua passando pelo
  gatilho da regra; uma recusa dela aparece como "recusado").
- [RN-021](../regras-de-negocio/RN-021-uma-pessoa-edita-a-obra-por-vez.md) — só uma pessoa edita a obra por vez; a trava vence em 5 minutos sem gravação.
- Gravação conferida pela versão (garantia técnica da gravação, sem ficha de regra; ver ADR-004) — uma gravação só entra se a tela leu a versão que está no banco; senão nada é gravado e a tela avisa.
- Obra vazia não grava por cima (garantia técnica da gravação, sem ficha de regra) — uma obra sem itens nunca é gravada por cima de uma obra com itens.
- [RN-022](../regras-de-negocio/RN-022-restaurar-versao-so-admin-master.md) — só o admin master restaura uma versão guardada da obra.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| alta | Conflito falso depois de uma resposta perdida | a gravação chega ao banco, mas a resposta se perde (queda de rede, tempo esgotado da Vercel). A tela fica com a versão velha, tenta de novo e recebe 409 `versao` — de si mesma. A saída oferecida é **Recarregar a obra**, que descarta o que foi digitado depois | `web/src/App.jsx:22352`–`22389`; `web/src/lib/dadosObra.js:114` |
| média | Alteração feita sem a edição habilitada some sem aviso | a fila só recebe mudança com `edicao.minha`; qualquer caminho que altere a obra na memória fora do modo de edição é marcado como "visto" e nunca grava | `web/src/App.jsx:22429` |
| média | Catálogo e Apresentação gravam por fora da fila | `alterarObra` grava direto com a versão que acabou de ler. Com a mesma pessoa editando a obra em outra aba, a outra aba cai em conflito de versão na próxima gravação | `web/src/lib/dadosObra.js:197`; `web/src/Catalogo.jsx:781`; `web/src/Apresentacao.jsx:635` |
| média | Caminhos antigos ainda abertos no banco | `aplicar_patch_obra` sem versão segue a regra antiga (só recusa trava viva de outra pessoa), e o `UPDATE` direto em `obra_dados` passa quando não há trava viva — nos dois casos sem conferir versão. A API não usa esses caminhos, mas o papel `authenticated` alcança os dois | `supabase/salvar-obra.sql:255`–`300`; `supabase/salvar-obra-contrair.sql:22`–`28` |
| média | Restaurar versão: tela diz "só o admin master", servidor aceita qualquer editor | a rota exige só a edição da obra; um GC restaura pela API | `web/src/App.jsx:25874`; `web/api/_lib/rotas/obraDados.js:143` |
| média | Banco vazio não limpa a tela | ao ler a obra, se `categorias` vier vazia do banco, a tela mantém as categorias que já tinha na memória — o que se vê pode não ser o que está gravado | `web/src/App.jsx:22235`–`22237` |
| baixa | Histórico copia a obra inteira a cada gravação inteira | cada autosave inteiro guarda uma cópia (centenas de KB); as 24 mais novas se renovam em minutos de trabalho, e o que sobra de mais antigo são os marcos de hora em hora e as quedas | `supabase/salvar-obra.sql:482`–`540` |

## Fora do escopo

- Duas pessoas editando a mesma obra ao mesmo tempo (trava por tela): ver ADR-004.
- Guardar rascunho no navegador: o navegador só guarda sessão e cache (regra 04); o que não
  gravou fica na memória da aba, e a aba avisa antes de fechar.
- Aditivo e Apresentação: gravação própria, sem trava — ver
  [aditivo-e-apresentacao.md](aditivo-e-apresentacao.md).

## Código

- Banco: `supabase/salvar-obra.sql` (coluna `versao`, `salvar_obra`, `aplicar_patch_obra` com
  versão, `restaurar_versao_obra`, gatilho que recusa gravar por cima da trava viva de outra
  pessoa, histórico com uma cópia a cada gravação inteira). Depois do deploy do app,
  `supabase/salvar-obra-contrair.sql` fecha a gravação direta enquanto houver trava viva.
- API: `web/api/_lib/rotas/obraDados.js` (`/api/obras/:codigo/gravar`, `/patch`,
  `/versoes/:id/restaurar`) e `web/api/_lib/rotas/obraConteudo.js` (leitura, trava, versões). O
  conteúdo vai comprimido (gzip + base64).
- Tela: `web/src/lib/filaDeGravacao.js` (a fila), `web/src/lib/gravacaoObra.js` (formato e
  mensagens), `web/src/lib/gravacaoUi.jsx` (barra e avisos), `web/src/lib/dadosObra.js`
  (`salvarDadosObra`, `aplicarPatchObra`, `alterarObra`, `pegarEdicao`), `web/src/App.jsx`
  (`gravarUmaVez`, `filaDaObra`, efeitos da trava, `recarregarObra`).
- Testes: `supabase/tests/12-salvar-obra.sql`, `web/api/_lib/__testes__/gravacao-obra.test.cjs`,
  `web/src/__testes__/fila-de-gravacao.test.mjs`, `gravacao-obra.test.mjs`,
  `gravacao-na-tela.test.mjs`, `obra-vazia-nao-grava.test.mjs`, `e2e/duas-sessoes.spec.mjs`.
