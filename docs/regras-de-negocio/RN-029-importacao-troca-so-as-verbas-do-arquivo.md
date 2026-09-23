# RN-029 · Importar troca só as verbas que vieram no arquivo

**Status:** proposta
**Contexto:** Vendido Planilha · Executivo
**Aprovada por:** a confirmar · **Desde:** 2026-09-23

## Enunciado

Importar um documento (Vendido Planilha, Planilha Executivo) troca só os grupos que vieram no arquivo; os outros ficam como estavam. Antes de aplicar, a pessoa vê o que será trocado e o que fica, e cada importação fica registrada com o arquivo, quem subiu e quando.

## Por quê

Decisão de 23/09/2026, "manter e avisar" (`web/src/lib/importacoes.js`, cabeçalho): manter o dado das verbas ausentes era de propósito; faltavam o aviso e o rastro.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A obra com os grupos 05 e 20 importados | sobe um arquivo só com o 05 | o 05 é trocado e o 20 fica com a importação anterior, e o aviso diz isso. |
| A primeira importação da obra | sobe o arquivo | aplica sem perguntar. |
| Qualquer importação aplicada | o registro é gravado | o autor é o e-mail do login, nunca o que a tela mandar. |
| A pessoa desiste no aviso | cancela | nada muda. |

## Fora do escopo

O que se perde ao trocar o Executivo com item aprovado (ver [RN-002](RN-002-item-aprovado-no-executivo.md)); "Puxar do criativo" (não passa pelo registro).

## Implementação

- Hoje: `web/src/App.jsx:5373` (`aplicarItensNasVerbas`), `web/src/App.jsx:5157` (`confirmarImportacao`), `web/src/lib/importacaoResumo.js`; registro com autor garantido no servidor (`web/api/_lib/rotas/importacoes.js:77`) e no banco (`supabase/obra-importacao.sql`, `with check`). A troca em si é só da tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [executivo](../funcionalidades/executivo.md), [vendido](../funcionalidades/vendido.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
