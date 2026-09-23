# RN-015 · Comprador do grupo e diária da mão de obra são do administrador

**Status:** proposta
**Contexto:** Acessos · Gestão de compras · Mão de obra própria
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Cada grupo de compra (verba da EAP, pelo nome) tem no máximo um comprador responsável. Quem compra cada grupo e a diária de cada função da mão de obra própria só são definidos, trocados ou tirados pelo Administrador ou pelo Admin master; o resto do time só consulta.

## Por quê

- `supabase/compradores.sql` e `supabase/mao-de-obra-propria.sql` (policies "admin atribui/troca/tira"); `docs/SPEC-acessos` não trata; perfil Administrador descrito como "edita tudo, inclusive o contrato da obra e os compradores" (`web/src/lib/pessoas.js:225`).
- `supabase/compradores.sql` (políticas "admin atribui/troca/tira comprador"); a tela passa `podeEditarCompradores={souAdmin}`.

Esta ficha junta candidatas levantadas separadamente na documentação (`comprador-e-diaria-so-administrador`, `comprador-por-grupo-so-admin`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um Geral | tenta trocar o comprador do grupo "Louças/metais" | o banco recusa. |
| Um Administrador | cadastra a diária de "Pintura · Pintor" | grava. |
| Uma pessoa na sala de espera | tenta ler os compradores | não recebe nada. |
| GC | abre a aba Compradores | vê a lista sem poder mudar. |
| Administrador | escolhe Fulana para "Móveis Soltos" | o filtro por comprador da Gestão passa a trazer os itens desse grupo para Fulana. |

## Fora do escopo

A alocação padrão por descrição (quem edita obra pode mudar).

## Implementação

- Hoje:
  - Banco `supabase/compradores.sql:41-50`, `supabase/mao-de-obra-propria.sql:46-55`, leitura só com perfil `supabase/rls-reforco.sql:374-380`; servidor não confere (`web/api/_lib/rotas/cadastros.js`, só login e ser do time).
  - `web/src/App.jsx:16991` (`CompradoresView`), `web/api/_lib/rotas/cadastros.js:131`, banco `supabase/compradores.sql:41`. Tela e banco.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [gestao-compras-contratacoes](../funcionalidades/gestao-compras-contratacoes.md), [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
