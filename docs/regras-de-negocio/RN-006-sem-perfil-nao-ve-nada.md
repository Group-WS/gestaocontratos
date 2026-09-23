# RN-006 · Quem não tem perfil não vê nenhum dado

**Status:** proposta
**Contexto:** Login e sala de espera
**Aprovada por:** a confirmar · **Desde:** 2026-08-31

## Enunciado

Quem entrou e ainda não tem perfil fica numa sala de espera e não vê nenhum dado da empresa — nem nome de obra, nem contagem, nem valor. Só o aviso e o botão de sair.

## Por quê

ADR-001, decisão 2 (31/08/2026): com o link de login enviado para pessoas e a Mehoo entrando no sistema, "quem não está cadastrado vê tudo" virou acesso concedido por omissão.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Uma pessoa que acabou de entrar pela primeira vez | o app abre | aparece "Seu acesso está em análise" e nada mais. |
| Uma pessoa sem perfil | ela chama a API direto com o próprio token | toda rota de dados responde "Você não tem acesso a esta área." (403). |
| Uma pessoa sem perfil | ela consulta o banco direto com a chave pública | as tabelas da obra e de referência não devolvem linha nenhuma. |

## Fora do escopo

A linha da própria pessoa (ela lê a si mesma, é o que decide se entra) e a gravação da própria entrada na fila.

## Implementação

- Hoje: Tela `web/src/App.jsx:23797-23800` e `SalaDeEspera` (`web/src/App.jsx:18850`); servidor `web/api/_lib/auth.js:117-130` (`exigirMembro`, montado em `web/api/_lib/mondayApp.js:79`); banco `public.meu_perfil()` e as policies "leio referencia" / `minhas_obras()` (`supabase/rls-perfis.sql`, `supabase/rls-perfis-complemento.sql`, `supabase/rls-reforco.sql`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
