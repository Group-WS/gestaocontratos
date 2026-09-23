# RN-003 · Cada pessoa tem um perfil de acesso, e só um

**Status:** proposta
**Contexto:** Equipe e acessos
**Aprovada por:** a confirmar · **Desde:** 2026-08-31

## Enunciado

Cada pessoa do time tem um perfil de acesso, e só um. O que ela vê e o que ela pode fazer sai inteiro do perfil, sem ajuste individual por cima.

## Por quê

ADR-001, decisão 1 (31/08/2026): com ajuste fino, dois "GC" poderiam ver coisas diferentes sem ninguém perceber, e a tela de acessos deixaria de responder "quem vê o quê". Perfis vigentes hoje: Admin master, Administrador, Geral, GC, Taylor Made, Mehoo e Canal de compra (o master veio em 15/09/2026; Taylor Made e Canal vieram depois do ADR).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Uma pessoa com perfil GC | o administrador abre a ficha dela | só há um perfil escolhido e nenhuma lista de módulos avulsos para marcar. |
| Duas pessoas com perfil Geral | cada uma abre o app | as duas veem os mesmos módulos e as mesmas obras. |
| Um caso que nenhum perfil cobre | alguém pede um acesso diferente | é preciso criar um perfil novo no sistema, não configurar na tela. |

## Fora do escopo

Permissão por ação dentro da obra (quem libera CMV, por exemplo — SPEC-acessos §7). As colunas antigas `admin`, `modulos`, `obras_regra` e `obras` continuam na tabela como legado e não decidem nada.

## Implementação

- Hoje: `web/src/lib/pessoas.js:214-266` (lista de perfis, tela); `supabase/taylor-made.sql:23-25` (valores aceitos pelo banco); `web/api/_lib/auth.js:86-90` (servidor, só os perfis que editam ou veem obra).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
