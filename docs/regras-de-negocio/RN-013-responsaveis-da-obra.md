# RN-013 · Os responsáveis da obra saem da lista da equipe

**Status:** proposta
**Contexto:** Acessos · Dashboard da obra · Equipe e acessos
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Os três responsáveis da obra — GC, Taylor Made e Executivo — são escolhidos da lista da equipe e guardados pelo e-mail, cada um no seu campo; quem edita a obra os define, e o Admin master também define o GC pela ficha da pessoa. Uma obra pode ter os três ao mesmo tempo, e nenhum é obrigatório.

## Por quê

`supabase/equipe.sql:7-9` (escolher de uma lista porque e-mail digitado erra) e `web/api/_lib/rotas/obras.js:180-190`; SPEC-acessos §2 ("dois caminhos, gravando o mesmo campo").

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A obra 2450 em edição | o GC escolhe Carla como Taylor Made | Carla passa a ver a 2450. |
| O Admin master na ficha de Bruno (GC) | marca as obras 2450 e 2519 | Bruno vira o GC das duas, e quem era GC delas deixa de ser. |
| Uma pessoa Taylor Made | abre a obra | vê a Equipe da obra, sem poder trocar. |

## Fora do escopo

O nome exibido (sai do e-mail quando a pessoa não está na lista).

## Implementação

- Hoje: Tela `web/src/App.jsx:1468-1476` (Equipe da obra no Dashboard) e `web/src/App.jsx:21694-21707` (`salvarAcessoDaPessoa`); servidor `web/api/_lib/rotas/obras.js:192-214` (`exigirEdicaoDeObra`); banco policy "obra: alterar" (`supabase/rls-reforco.sql:163-165`). O e-mail não é conferido contra a lista da equipe no servidor.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [cadastro-de-obra](../funcionalidades/cadastro-de-obra.md), [dashboard](../funcionalidades/dashboard.md), [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
