# RN-009 · A Equipe nunca fica sem quem cuide dela

**Status:** proposta
**Contexto:** Equipe e acessos
**Aprovada por:** a confirmar · **Desde:** 2026-08-31

## Enunciado

Nunca pode ficar sem ninguém para cuidar da Equipe. A última pessoa que cuida dela (o último Admin master; ou, sem master, o último Administrador) não pode perder esse perfil, ser desativada nem excluída até outra pessoa receber o mesmo perfil.

## Por quê

SPEC-acessos §2 e §6 ("sem admin, ninguém mais entra, e a saída seria mexer no banco à mão").

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Priscila como única Admin master | ela tenta mudar o próprio perfil para Geral | a tela avisa e não deixa salvar. |
| Priscila como única Admin master | alguém tenta desativá-la ou excluí-la | a tela recusa com o motivo. |
| Dois Admin master | um deles vira Administrador | é permitido. |

## Fora do escopo

Correções feitas direto no banco pelo SQL Editor.

## Implementação

- Hoje: Só na tela: `web/src/lib/pessoas.js:376-381` (`ehOUltimoGestor`) usada em `web/src/App.jsx` (`AcessoDaPessoa`, a partir de 19179, e `EquipeView`, a partir de 19311). **Nem o servidor nem o banco conferem**: `PUT` e `DELETE /api/pessoas` gravam o que o Admin master mandar.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
