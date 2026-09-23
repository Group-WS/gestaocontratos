# RN-004 · Só conta do domínio da empresa entra no sistema

**Status:** proposta
**Contexto:** Login
**Aprovada por:** a confirmar · **Desde:** 2026-08-31

## Enunciado

Só contas do domínio da empresa (`@groupws.com.br`) podem entrar no sistema; quem tenta com outro domínio é recusado na entrada e não vira pendente.

## Por quê

ADR-001, decisão 6, e SPEC-acessos §8 (31/08/2026): sem o corte, a fila de espera viraria caixa de entrada de desconhecido.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Uma conta `fulano@groupws.com.br` | entra pela Microsoft | entra (e vira pendente, se for a primeira vez). |
| Uma conta `fulano@gmail.com` | tenta entrar | é recusada e nenhuma linha é criada em `pessoa`. |
| Uma conta `x@naogroupws.com.br` | tenta entrar | é recusada (domínio parecido não vale). |

## Fora do escopo

Contas de outro domínio que o negócio decida aceitar no futuro (seria mudar a lista de domínios).

## Implementação

- Hoje: A função existe em `web/src/lib/pessoas.js:345-347` (`dominioPermitido`) mas **não é chamada em lugar nenhum** — só no teste `web/src/__testes__/acessos.test.mjs:140-146`. Na prática o corte hoje é o app do Azure ser de um único diretório (`docs/azure-login.md`), fora do código. O servidor cria a linha pendente para qualquer conta que o Supabase autenticar (`web/api/_lib/rotas/pessoas.js:265`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum da regra em uso. `dominioPermitido` tem teste em `web/src/__testes__/acessos.test.mjs`, mas a função não é chamada em lugar nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
