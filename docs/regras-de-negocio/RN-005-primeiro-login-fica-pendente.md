# RN-005 · O primeiro login entra na fila, sem perfil

**Status:** proposta
**Contexto:** Login e sala de espera
**Aprovada por:** a confirmar · **Desde:** 2026-08-31

## Enunciado

O primeiro login de alguém cria a ficha dessa pessoa como pendente (sem perfil), com a data de entrada. Ninguém consegue se dar perfil sozinho: só entra na fila.

## Por quê

SPEC-acessos §3 e §4: é o que faz a pessoa aparecer para o administrador sem ninguém digitar o e-mail dela; a policy "entro na fila" existe para permitir entrar na fila sem permitir entrar liberado.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Alguém que nunca entrou | faz o primeiro login | nasce a linha dela com perfil vazio e "entrou em" preenchido, e ela aparece em "Aguardando liberação". |
| Alguém que já tem perfil | entra de novo | a ficha dela não é reescrita (o perfil continua o mesmo). |
| Alguém tentando criar a própria linha já com perfil | grava direto no banco | o banco recusa. |

## Fora do escopo

Cadastro manual de uma pessoa pelo Admin master (tela Equipe), que pode criar a ficha antes do primeiro login.

## Implementação

- Hoje: Servidor `web/api/_lib/rotas/pessoas.js:265-289` (e-mail e nome saem do login); banco policy "entro na fila" `supabase/rls-perfis.sql:107-108`; tela `web/src/lib/pessoas.js:367-371` chamada em `web/src/App.jsx:21580-21585`.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
