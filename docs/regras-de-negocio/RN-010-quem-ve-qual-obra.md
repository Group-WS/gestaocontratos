# RN-010 · Quem vê qual obra

**Status:** proposta
**Contexto:** Acessos · todas as telas de obra
**Aprovada por:** a confirmar · **Desde:** 2026-08-31

## Enunciado

Admin master, Administrador, Geral e Mehoo veem todas as obras. GC e Taylor Made veem as obras em que respondem como GC, Taylor Made ou Executivo, e também as obras que ainda não têm GC. Os demais perfis não veem obra nenhuma.

## Por quê

SPEC-acessos §2 (31/08/2026): "as minhas" se atualiza sozinha quando a obra troca de GC; "obra sem GC continua visível para o GC" para nenhuma obra viva sumir da tela de todos enquanto os vínculos não estão feitos. Os três papéis contam desde o `supabase/taylor-made.sql`; a Mehoo passou a ver todas em 14/09/2026.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A obra 2450 com GC Ana | o GC Bruno abre a lista | a 2450 não aparece para ele. |
| A obra 2519 sem GC | qualquer GC abre a lista | a 2519 aparece. |
| A obra 2519 com GC Ana e Taylor Made Carla | Carla (perfil Taylor Made) abre a lista | vê a 2519. |
| Uma pessoa com perfil Geral | abre a lista | vê todas as obras. |

## Fora do escopo

O que cada um pode MUDAR na obra (ver [RN-011](RN-011-quem-edita-e-cria-obra.md)); a Mehoo vê as obras só dentro do painel dela.

## Implementação

- Hoje: Tela `web/src/lib/pessoas.js:321-339` (`obrasPermitidas`); servidor `web/api/_lib/auth.js:150-188` (`podeAcessarObra`); banco `public.minhas_obras()` em `supabase/rls-reforco.sql:87-107` (usada por todas as policies de obra). As três camadas conferem.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [cadastro-de-obra](../funcionalidades/cadastro-de-obra.md), [dashboard](../funcionalidades/dashboard.md), [inicio](../funcionalidades/inicio.md), [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
