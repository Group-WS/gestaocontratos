# RN-084 · Só a folha da EAP recebe apropriação

**Status:** proposta
**Contexto:** EAP Sienge
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

Só o item de nível 4 da EAP do Sienge (a folha) aceita apropriação de compra, e uma verba da casa só pode apontar para uma folha da mesma versão da EAP.

## Por quê

`web/src/lib/eapSienge.js:8-10` ("só a FOLHA (nível 4) é apropriável"); a chave estrangeira composta impede apontar para código de outra versão (ADR-002, Consequências; `supabase/sienge_eap.sql:71-72`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| O código 04.001 (nível 2) | alguém tenta ligar a verba 20 a ele | a tela não oferece. |
| A versão B | alguém grava o mapa com um código que só existe na versão A | o banco recusa. |
| Uma planilha sem nenhum nível 4 | é importada | a gravação não é permitida. |

## Fora do escopo

Se a folha é [MAT] ou [MO].

## Implementação

- Hoje: `web/src/lib/eapSienge.js:100`, `:155`; tela (a lista só traz folhas); banco (FK em `sienge_eap_mapa`); `importarEap` recusa sem folha (`eapApropriacao.js:64`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [eap-sienge](../funcionalidades/eap-sienge.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
