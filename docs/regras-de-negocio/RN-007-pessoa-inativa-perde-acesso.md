# RN-007 · Quem sai é desativado, não apagado, e perde o acesso

**Status:** proposta
**Contexto:** Equipe e acessos
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Quem sai da empresa é desativado, não apagado: a ficha e as obras que a pessoa tocou continuam apontando para ela, mas ela deixa de entrar e vê a tela "Seu acesso está suspenso".

## Por quê

`supabase/equipe.sql:18-20` ("apagar deixaria histórico apontando pro vazio") e SPEC-acessos §6 (pessoa desativada volta para a sala de espera, com texto diferente).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Uma pessoa ativa com perfil Geral | o Admin master a desativa | no próximo carregamento ela vê "Seu acesso está suspenso". |
| Uma pessoa desativada | chama a API | recebe 403, como quem não tem perfil. |
| Uma pessoa desativada que era GC de obras | alguém abre essas obras | o GC continua sendo ela até alguém trocar. |

## Fora do escopo

Excluir a pessoa (tela Equipe permite quando ela não é GC de nenhuma obra).

## Implementação

- Hoje: Tela `web/src/lib/pessoas.js:271-273` e `SalaDeEspera` (`web/src/App.jsx:18850-18885`); servidor `web/api/_lib/auth.js:117` (`ativo !== false`); banco `public.meu_perfil()` só devolve perfil de pessoa ativa (`supabase/rls-reforco.sql:65-71`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
