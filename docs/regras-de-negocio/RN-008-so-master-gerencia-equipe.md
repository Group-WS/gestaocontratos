# RN-008 · Só o Admin master cuida da Equipe

**Status:** proposta
**Contexto:** Equipe e acessos
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

Só o Admin master abre "Equipe e acessos": é ele quem cadastra pessoas, dá, muda e tira perfil, ativa e desativa. Enquanto não existir nenhum Admin master ativo, o Administrador cuida da Equipe.

## Por quê

SPEC-acessos §2 (só o Administrador abria a Equipe, 31/08/2026) e pedido de 15/09/2026 (`supabase/admin-master.sql:8-13`): a Equipe passou a ser só do Admin master. A exceção do Administrador sem master existe para "senão ninguém cuidaria" (`web/src/lib/pessoas.js:296-306`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um Administrador num time que tem Admin master | procura o módulo Equipe | ele não aparece no menu. |
| Um Geral | tenta gravar uma pessoa pela API | o banco recusa ("Você não tem permissão para esta ação."). |
| Nenhum Admin master ativo | o Administrador abre o app | vê o módulo Equipe (só na tela; o banco continua exigindo master para gravar). |

## Fora do escopo

A própria foto (cada pessoa troca a sua) e o registro de último acesso (cada pessoa marca o seu).

## Implementação

- Hoje: Tela `web/src/lib/pessoas.js:280-306` e `web/src/App.jsx:21633` / `25604`; servidor: **não confere** (rotas de pessoa só exigem login, `web/api/_lib/rotas/pessoas.js:188`); banco policy "master escreve todas" (`supabase/rls-perfis.sql:102-103`) e "admin le todas" (`:100-101`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
