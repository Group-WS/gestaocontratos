# RN-021 · Uma pessoa edita a obra por vez

**Status:** proposta
**Contexto:** Gravação da obra · telas de edição
**Aprovada por:** a confirmar · **Desde:** 2026-09-17

## Enunciado

Só uma pessoa edita a obra por vez. A edição é pedida por um clique, vale só na tela em que foi pedida e acaba ao sair dela, ao finalizar ou depois de 5 minutos sem alteração; os outros continuam vendo tudo, em modo leitura.

## Por quê

ADR-004 (17/09/2026): pedidos da Priscila — "sempre que mudar de menu, ele desabilita a edicao automaticamente"; a expiração passou de 30 para 5 minutos. A trava existe porque a gravação é da obra inteira ("duas pessoas em telas diferentes gravariam, cada uma, o documento inteiro").

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Ana editando a 2450 | Bruno clica Habilitar edição | não pega: "Ana está editando desde 9h10". |
| Ana editando a 2450 | ela troca de aba | a tela grava o que falta e devolve a trava. |
| Ana parada há 5 minutos | Bruno clica Habilitar edição | Bruno passa a editar. |
| Ana com gravação falhando | ela sai da tela | a trava fica com ela até gravar. |

## Fora do escopo

Trava por tela (duas pessoas em telas diferentes) — ADR-004 fatia 3; aditivo e apresentação, que não têm trava.

## Implementação

- Hoje: Banco (`UPDATE` condicionado em `web/api/_lib/rotas/obraConteudo.js:186`–`229`; `salvar_obra` e o gatilho `obra_dados_respeita_trava`, `supabase/salvar-obra.sql:185`, `:436`); tela (`habilitarEdicao`, `web/src/App.jsx:22655`; efeitos em `:22512`–`:22634`; `MINUTOS_ATE_TRAVA_EXPIRAR = 5`, `web/src/lib/dadosObra.js:53`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [gravacao-da-obra](../funcionalidades/gravacao-da-obra.md), [obra-documentos](../funcionalidades/obra-documentos.md), [obra-navegacao](../funcionalidades/obra-navegacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
