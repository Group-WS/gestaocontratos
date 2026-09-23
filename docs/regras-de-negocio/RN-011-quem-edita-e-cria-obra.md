# RN-011 · Só Admin master, Administrador, Geral e GC alteram e criam obra

**Status:** proposta
**Contexto:** Acessos · todas as telas de obra · Cadastro de obra
**Aprovada por:** a confirmar · **Desde:** 2026-08-31

## Enunciado

Só Admin master, Administrador, Geral e GC alteram uma obra, e cada um só nas obras que enxerga; e só eles criam obra (dar start numa obra do Monday ou cadastrar uma obra nova). Taylor Made, Mehoo e Canal de compra só consultam e não criam obra.

## Por quê

- ADR-001 decisão 4 ("Geral edita a obra, não mexe em gente") e SPEC-acessos §2 (GC edita, restrito às obras dele; Mehoo não edita nada). Taylor Made: "acompanha o andamento e cobra quem executa" (`web/src/lib/pessoas.js:240-244`).
- Comentário da rota `POST /api/obras`: "Quem pode criar e' quem edita (master, admin, geral, gc), e o `with check` das obras no banco continua sendo a ultima palavra." Mesmo recorte de ADR-001 (decisão 4).

Esta ficha junta candidatas levantadas separadamente na documentação (`quem-edita-a-obra`, `so-quem-edita-cria-obra`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um GC na obra dele | habilita a edição | consegue editar. |
| Uma pessoa Taylor Made numa obra em que é a Taylor | abre a obra | vê tudo e não há botão de habilitar edição; se chamar a API de gravação, recebe "Obra não encontrada." (404). |
| A Mehoo | tenta criar solicitação de compra no Sienge pela API | é recusada. |
| Um GC | tenta gravar na obra de outro GC | a API responde 404 e o banco recusa. |
| Um GC | clica Dar start numa obra do Monday | a obra é criada, ativa. |
| Uma Taylor Made | clica Dar start | o servidor recusa ("Você não tem acesso a esta área."). |
| Um GC | cria uma obra e escolhe outro GC como responsável | hoje a obra é criada e some da tela dele (a regra não diz se o GC pode criar para outro — a confirmar). |

## Fora do escopo

A trava de edição (quem está editando agora — ver docs/funcionalidades/gravacao-da-obra.md); atos reservados ao administrador, como a RN-001.

## Implementação

- Hoje:
  - Tela `web/src/lib/pessoas.js:295` (`podeEditar`) usada em `web/src/App.jsx:22630`; servidor `web/api/_lib/auth.js:86` e `195-199` (`exigirEdicaoDeObra`); banco `with check` das policies de `obra`, `obra_dados`, `aditivo`, `apresentacao`, `sienge_solicitacao` e do Storage (`supabase/rls-reforco.sql`).
  - Tela (`abrirNovaObra`, `web/src/App.jsx:22653` — o botão **Dar start** não é escondido de quem não edita); servidor (`exigirPerfilDeEdicao`, `web/api/_lib/rotas/obras.js:124`; `web/api/_lib/auth.js:133`); banco (policy `obra: criar`, `supabase/rls-reforco.sql:161`–`162`, só o perfil).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [cadastro-de-obra](../funcionalidades/cadastro-de-obra.md), [login-e-acessos](../funcionalidades/login-e-acessos.md), [obra-navegacao](../funcionalidades/obra-navegacao.md), [obras-finalizadas](../funcionalidades/obras-finalizadas.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
