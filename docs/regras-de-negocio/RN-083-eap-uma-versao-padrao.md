# RN-083 · Uma única versão padrão da EAP

**Status:** proposta
**Contexto:** EAP Sienge · Compras
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

Existe uma única versão padrão da EAP do Sienge por vez, escolhida por uma pessoa; é ela que a solicitação de compra usa para apropriar.

## Por quê

ADR-002, decisão 2 ("alguém precisa dizer qual é a padrão; é uma escolha explícita na tela"); duas padrão deixariam a tela escolher por sorte (`supabase/sienge_eap.sql:39-41`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A versão A padrão | alguém torna a B padrão | a A deixa de ser. |
| Uma versão recém-importada | ninguém a torna padrão | a solicitação continua usando a anterior. |
| Nenhuma versão padrão | a solicitação abre | usa a mais recente (comportamento de hoje, não regra). |

## Fora do escopo

Unidade construtiva (vem da obra no envio).

## Implementação

- Hoje: Banco `sienge_eap_versao_uma_padrao` (`supabase/sienge_eap.sql:40-41`); `web/api/_lib/rotas/eap.js:231-242`; uso `web/src/App.jsx:12776-12777`.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [eap-sienge](../funcionalidades/eap-sienge.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
