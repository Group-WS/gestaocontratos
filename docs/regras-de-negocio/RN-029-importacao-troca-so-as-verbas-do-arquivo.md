# RN-029 · Importar troca só as verbas que vieram no arquivo

**Status:** proposta
**Contexto:** Vendido Contrato · Vendido Planilha · Executivo
**Aprovada por:** a confirmar · **Desde:** 2026-09-23

## Enunciado

Importar um documento (Vendido Contrato, Vendido Planilha, Planilha Executivo) troca, por padrão, só os grupos que vieram no arquivo; os outros ficam como estavam. Na mesma pergunta, a pessoa pode escolher substituir o documento inteiro — aí os grupos que não vieram no arquivo são apagados. Antes de aplicar, ela vê o que será trocado e o que fica (ou o que será apagado), e cada importação fica registrada com o arquivo, quem subiu e quando.

## Por quê

Decisão de 23/09/2026, "manter e avisar" (`web/src/lib/importacoes.js`, cabeçalho): manter o dado das verbas ausentes era de propósito; faltavam o aviso e o rastro.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A obra com os grupos 05 e 20 importados | sobe um arquivo só com o 05 | o 05 é trocado e o 20 fica com a importação anterior, e o aviso diz isso. |
| A primeira importação da obra | sobe o arquivo | aplica sem perguntar. |
| Qualquer importação aplicada | o registro é gravado | o autor é o e-mail do login, nunca o que a tela mandar. |
| A obra com os grupos 05 e 20 importados | sobe um arquivo só com o 05 e marca "substituir tudo" | o 05 é trocado e o 20 fica sem itens deste documento, e o aviso diz isso antes. |
| "Substituir tudo" marcado | a verba tem itens de outro documento | só o documento importado é apagado nela; os outros continuam. |
| A pessoa desiste no aviso | cancela | nada muda. |

## Fora do escopo

O que se perde ao trocar o Executivo com item aprovado (ver [RN-002](RN-002-item-aprovado-no-executivo.md)); "Puxar do criativo" (não passa pelo registro).

## Implementação

- Hoje: `web/src/App.jsx:5373` (`aplicarItensNasVerbas`), `web/src/App.jsx:5157` (`confirmarImportacao`), `web/src/lib/importacaoResumo.js`; registro com autor garantido no servidor (`web/api/_lib/rotas/importacoes.js:77`) e no banco (`supabase/obra-importacao.sql`, `with check`). A troca em si é só da tela.
- Escolha de substituir tudo: `web/src/lib/importacaoResumo.js` (texto e rótulo) e `web/src/lib/confirmar.jsx` (`opcao` do diálogo); o registro grava as apagadas como trocadas.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: `web/src/__testes__/importacao-resumo.test.mjs` (texto do aviso nos dois modos).
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [executivo](../funcionalidades/executivo.md), [vendido](../funcionalidades/vendido.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
| 2026-09-23 | Opção de substituir o documento inteiro na própria pergunta | Allysson Pereira | — |
