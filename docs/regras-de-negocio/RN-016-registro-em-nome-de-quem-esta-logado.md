# RN-016 · Todo registro assinado leva quem está logado

**Status:** proposta
**Contexto:** Acessos (transversal)
**Aprovada por:** a confirmar · **Desde:** 2026-09-21

## Enunciado

Todo registro assinado — quem cadastrou, liberou, comentou, importou, anexou, enviou ao Sienge, criou ou alterou um aditivo ou a apresentação — leva o e-mail de quem está logado, nunca um nome escolhido na tela.

## Por quê

Regra SEG-13 do padrão de qualidade, aplicada na varredura de 21/09/2026 (`supabase/rls-reforco.sql:22-25`): `criado_por` do aditivo decide quem pode apagá-lo e vinha do navegador.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Ana logada | registra uma observação mandando "autor: Bruno" | a observação fica em nome de Ana. |
| Ana logada | dá perfil a Bruno | "liberado por" fica Ana. |
| Ana logada | grava direto no banco um comentário assinado por Bruno | o banco recusa. |

## Fora do escopo

Gravações feitas pelo SQL Editor (fora do papel do app).

## Implementação

- Hoje: Servidor em cada rota (`req.usuario.email`, ex. `web/api/_lib/rotas/pessoas.js:210` e `221`, `comentarios.js:99`, `importacoes.js:94`); banco nos `with check` (`autor = e-mail do login`) e nos gatilhos de autoria (`supabase/rls-reforco.sql:210-230`, `supabase/salvar-aditivo-apresentacao.sql:95-120`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
