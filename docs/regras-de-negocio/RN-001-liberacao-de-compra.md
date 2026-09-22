# RN-001 · Só o administrador libera a compra

**Status:** proposta
**Contexto:** Conferência do Executivo · Plano de compras
**Aprovada por:** a confirmar pelo dev · **Desde:** 2026-09-21 (proposta)

## Enunciado

Um item do executivo só entra no fluxo de compra quando um administrador (perfil Administrador ou
Admin master, ativo) o libera — inclusive a liberação que dispensa a aprovação do cliente. A
liberação fica registrada no item, com quem liberou e quando, e quem liberou é sempre quem está
logado.

Exceção: ao corrigir a alocação de um item de mão de obra para material, quem edita a obra faz o
item entrar já liberado; o registro diz que a liberação veio da correção da alocação.

## Por quê

- ADR-005 (18/09/2026): "concluído executivo, aprovado para compra (somente admin tem permissão
  para liberar)".
- Liberar sem a aprovação do cliente é exceção: pede o motivo e quem autorizou, e é do
  administrador.
- A exceção da alocação é decisão de 17/09/2026: corrigir onde o dinheiro senta não é mudar
  escopo, e o item já estava no plano ("não precisa liberar novamente").
- Até a varredura de segurança de 21/09/2026, a regra só existia na tela: o banco aceitava a
  liberação de qualquer pessoa que edita, e com o nome de outra pessoa no registro.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| GC, na obra dele | libera um item para compra | recusado: só o administrador libera |
| Administrador | libera um item | liberado, com o nome dele e a data |
| Administrador | grava a liberação no nome de outra pessoa | recusado: a liberação sai em nome de quem está logado |
| GC | corrige a alocação de um item de mão de obra para material | o item entra liberado, marcado "via alocação", no nome do GC |
| GC | registra a liberação via alocação no nome de outra pessoa | recusado |
| GC | libera sem a aprovação do cliente | recusado |
| Administrador | libera sem a aprovação do cliente, com motivo e quem autorizou | liberado |
| Quem edita a obra | restaura uma versão anterior que tinha itens liberados | as liberações voltam, com o nome de quem liberou de verdade |
| GC | copia a liberação de um item para outros | recusado (passa do número de itens liberados que a versão tinha) |
| GC | substitui a Planilha Executivo (as liberações vão a zero) | permitido: a regra não impede tirar liberação |
| GC | edita outro campo de um item já liberado | permitido: a liberação continua como estava |

## Fora do escopo

- Desfazer a liberação: a tela só oferece ao administrador, mas o banco não impede que uma
  gravação tire o registro (substituir a planilha zera todas as liberações).
- "Compras liberadas" da obra inteira (`comprasLiberadas`), aprovação do cliente
  (`aprovadoCliente`), conclusão do executivo (`concluidoExecutivo`) e alerta conferido: outras
  regras.
- Quem vê e quem edita a obra: `docs/SPEC-acessos.md`.

## A confirmar (é o que falta para a ficha passar a vigente)

1. **Quem libera:** Administrador e Admin master — e o perfil Geral não? (É o que a tela faz hoje.)
2. **Desfazer:** deve ser só do administrador também no banco?
3. **Quem autorizou**, na liberação sem cliente, continua texto livre (o nome de quem autorizou
   fora do sistema)?
4. **Brecha conhecida da restauração:** uma liberação que já existiu numa versão guardada pode voltar
   pela mão de quem edita a obra (é o que permite restaurar versão). Se o administrador desfez uma
   liberação de propósito, restaurar uma versão anterior a traz de volta — o histórico mostra quem
   fez.

## Implementação

- Regra: `web/src/regras/liberacaoDeCompra.js`
- Teste: `web/src/regras/liberacaoDeCompra.test.mjs`
- Garantia no banco: `supabase/rn-001-liberacao-de-compra.sql` (teste: `supabase/tests/10-rn-001-liberacao.sql`)
- Fluxo que consulta a regra: `web/src/App.jsx` (`podeLiberarCompra`, nas telas da Conferência do Executivo)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-21 | Criação como proposta, a partir da tela (ADR-005, decisão de 17/09) e da varredura de segurança; garantia no banco | pedido do dev (Allysson), enunciado a confirmar | — |
