# Gravação da obra

**Módulo:** Obras (todas as telas de edição da obra) · **Arquétipos de tela:** detalhe (barra da obra), avisos globais

## Objetivo

Tudo o que a pessoa digita numa obra chega ao banco — ou a tela diz, com clareza, que não chegou
e o que fazer. Nenhuma gravação apaga o trabalho de outra pessoa em silêncio.

## Quem usa

Quem edita obra (perfis master, admin, geral e GC). Quem só consulta (Mehoo) não grava nada.

## Fluxo

1. A pessoa abre a obra em **modo leitura**. A obra vem do banco junto com a sua `versao`.
2. **Habilitar edição** pega a trava e, no mesmo pedido, traz a obra como está no banco *agora*.
   É essa que a pessoa passa a editar — a cópia que estava aberta pode ser de antes da última
   gravação de outra pessoa.
3. Cada alteração entra na **fila de gravação** da obra: a gravação sai 1,2 s depois da última
   alteração, uma por vez, sempre com o estado mais recente da tela.
4. O banco (`salvar_obra`) só grava se a trava for de quem grava **e** a versão for a que a tela
   leu. Gravou: a versão sobe e a barra mostra "salvo".
5. **Finalizar edição**, trocar de tela ou ficar 5 minutos sem mexer: a tela grava o que falta e
   só então devolve a trava. Se a gravação falhar, a trava fica com a tela até gravar.
6. Uma alteração avulsa por fora da tela (o Catálogo mandando produtos, a Apresentação guardando
   o PDF) segue o mesmo caminho: pega a trava, lê a obra atual e grava com a versão lida — ou,
   com a obra em edição na mesma aba, entra pela tela e vai pela fila dela.

## Telas

| Tela | Arquétipo | Rota |
|---|---|---|
| Barra da obra (situação da gravação, habilitar/finalizar) | detalhe | `/obra/:codigo` |
| Avisos da gravação (qualquer tela) | aviso global | — |

## Estados e mensagens

| Estado | Onde aparece | O que a tela diz | Saída |
|---|---|---|---|
| pendente | barra | "alterações por gravar…" | — |
| salvando | barra | "salvando…" | — |
| salvo | barra | "salvo" | — |
| erro (temporário: rede, servidor) | barra e aviso | "não salvo — nova tentativa em N s" | nova tentativa sozinha (2 s, 5 s, 10 s… até 1 min), e **Tentar agora** |
| recusado (o servidor disse não a este conteúdo, ex.: RN-001) | aviso | a mensagem do servidor | desfazer a alteração, ou **Tentar agora** |
| conflito — versão | aviso | a obra foi alterada no banco por outra pessoa depois que a tela a leu; nada foi gravado por cima | **Recarregar a obra** (com confirmação, descarta o que não gravou) |
| conflito — trava | aviso | a edição está com outra pessoa | **Recarregar a obra** |
| conflito — vazia | aviso | a tela está sem os itens, e o banco tem itens | **Recarregar a obra** |

Com qualquer coisa por gravar, **fechar ou recarregar a aba** faz o navegador perguntar antes, e
**Sair** da conta tenta gravar primeiro e, se não der, pergunta "Descartar alterações?". Nenhuma
mensagem manda dar F5: recarregar a página é justamente o jeito de perder o que falta gravar.

Obra que não carregou: a edição fica fechada, e a barra oferece **Tentar de novo** (sem
recarregar a página).

## Regras de negócio usadas

- RN-001 — Só o administrador libera a compra (a gravação protegida continua passando pelo
  gatilho da regra; uma recusa dela aparece como "recusado").

## Por dentro

- Banco: `supabase/salvar-obra.sql` (coluna `versao`, `salvar_obra`, `aplicar_patch_obra` com
  versão, `restaurar_versao_obra`, gatilho que recusa gravar por cima da trava viva de outra
  pessoa, histórico com uma cópia a cada gravação inteira). Depois do deploy do app,
  `supabase/salvar-obra-contrair.sql` fecha a gravação direta enquanto houver trava viva.
- API: `web/api/_lib/rotas/obraDados.js` (`/api/obras/:codigo/gravar`, `/patch`,
  `/versoes/:id/restaurar`). O conteúdo vai comprimido (gzip + base64).
- Tela: `web/src/lib/filaDeGravacao.js` (a fila), `web/src/lib/gravacaoObra.js` (formato e
  mensagens), `web/src/lib/gravacaoUi.jsx` (barra e avisos), `web/src/App.jsx`.
- Testes: `supabase/tests/12-salvar-obra.sql`, `web/api/_lib/__testes__/gravacao-obra.test.cjs`,
  `web/src/__testes__/fila-de-gravacao.test.mjs`, `gravacao-obra.test.mjs`,
  `gravacao-na-tela.test.mjs`, `e2e/duas-sessoes.spec.mjs`.

## Fora do escopo

- Duas pessoas editando a mesma obra ao mesmo tempo (trava por tela): ver ADR-004.
- Guardar rascunho no navegador: o navegador só guarda sessão e cache (regra 04); o que não
  gravou fica na memória da aba, e a aba avisa antes de fechar.
