# RN-012 · Mehoo e Canal de compra só veem o próprio painel

**Status:** proposta
**Contexto:** Acessos · Mehoo · Painel por canal
**Aprovada por:** a confirmar · **Desde:** 2026-09-14

## Enunciado

A Mehoo vê só o painel da Mehoo, e o Canal de compra só o painel do canal dele (o canal sai da ficha da pessoa), os dois com as informações de todas as obras; nenhum dos dois abre obra, vê os outros módulos ou altera qualquer coisa.

## Por quê

- SPEC-acessos §2 (Mehoo: decisão de 14/09/2026 de ver todas as obras; é empresa do grupo, por isso vê valores — ADR-001 decisão 5). O perfil Canal de compra é "irmão do Mehoo" para não criar um perfil por canal (`web/src/lib/pessoas.js:255-263`).
- `docs/SPEC-acessos.md` (Mehoo, decisão de 14/09/2026) e ADR-001; o perfil "Canal de compra" foi criado em 19/09/2026 ("assim como a gente criou uma tela separada para Mehoo, queria criar uma para cada canal").

Esta ficha junta candidatas levantadas separadamente na documentação (`perfis-de-painel-so-consultam`, `perfil-canal-ve-so-o-proprio-canal`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Uma pessoa Mehoo | entra | cai direto no painel Mehoo, sem lista de obras na barra. |
| Uma pessoa Canal de compra com o canal "Mehoo" na ficha | entra | vê só o Painel por canal, travado nesse canal. |
| Uma pessoa Canal de compra sem canal escolhido | entra | vê o primeiro canal da lista. |
| Perfil Mehoo | entra | cai direto no painel Mehoo, sem lista de obras. |
| Perfil "Canal de compra" com canal Automação | entra | vê só o Painel por canal de Automação, sem o seletor de canal. |
| Perfil "Canal de compra" sem canal na ficha | entra | vale o primeiro canal da lista (Sienge). |

## Fora do escopo

O conteúdo dos painéis (fichas das telas de painel).

## Implementação

- Hoje:
  - Tela `web/src/lib/pessoas.js:246-263` e `web/src/App.jsx:21630-21631`; servidor e banco reconhecem a Mehoo (`web/api/_lib/auth.js:87`, `supabase/rls-reforco.sql:104`) mas **não reconhecem o perfil Canal de compra** — para o servidor e para o banco ele não vê obra nenhuma (ver riscos da ficha).
  - `web/src/lib/pessoas.js:245`–`:263` (perfis), `web/src/App.jsx:21630` (`canalPreso`). Na tela; no banco o perfil `canal` não enxerga obra nenhuma (ver risco na ficha do painel).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [login-e-acessos](../funcionalidades/login-e-acessos.md), [painel-por-canal](../funcionalidades/painel-por-canal.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
