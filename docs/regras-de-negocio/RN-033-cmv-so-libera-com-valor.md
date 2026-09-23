# RN-033 · Só se libera CMV maior que zero

**Status:** proposta
**Contexto:** CMV
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Só se libera um CMV maior que zero; sem custo na Vendido Planilha não há teto, e o Executivo não abre.

## Por quê

Comentário em `DeparaContratoPlanilhaView`: "CMV zerado não é teto… Liberar assim abriria a obra pra comprar contra um valor inexistente."

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A Vendido Planilha sem coluna de custo (CMV = 0) | a pessoa tenta liberar | o botão fica desabilitado com "CMV ainda não apurado". |
| CMV de R$ 800 mil | quem edita confirma | o CMV é liberado. |

## Fora do escopo

Obra sem Vendido nenhum (ver [RN-035](RN-035-executivo-exige-cmv-liberado.md)).

## Implementação

- Hoje: `web/src/App.jsx:7312` — só na tela (o banco aceita `depara_aprovado` com CMV nulo ou zero).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [cmv](../funcionalidades/cmv.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
