# RN-020 · Obra concluída fica só para consulta

**Status:** proposta
**Contexto:** Obras finalizadas
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Obra concluída sai da operação (lista de obras e Início) e fica guardada só para consulta: ninguém altera nada nela. Quem edita pode reabri-la, e ela volta ativa.

## Por quê

`supabase/schema.sql:15` ("concluida — sai da sidebar, fica no Arquivo, so leitura") e a confirmação da tela: "ninguém do time consegue mais alterar nada nela. Dá para reabrir depois". Reabrir existe "pra quando alguém concluir sem querer" (`web/src/lib/obras.js:88`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A obra 2450 ativa | alguém a conclui | ela some da lista e do Início e aparece em Finalizadas. |
| A 2450 concluída | alguém tenta gravar nela | deveria recusar — hoje o servidor e o banco aceitam (só a tela impede). |
| A 2450 concluída | alguém clica Reabrir e confirma | ela volta ativa e abre na tela. |

## Fora do escopo

Apagar obra (não existe); encerrar no Monday ou no Sienge.

## Implementação

- Hoje: Só na tela (a obra concluída não entra em `obrasAtivas`, `web/src/App.jsx:21690`); a situação é gravada em `web/api/_lib/rotas/obras.js:162`; nenhuma função de gravação confere `situacao` (`supabase/salvar-obra.sql:185`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [obras-finalizadas](../funcionalidades/obras-finalizadas.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
