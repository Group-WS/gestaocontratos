# RN-017 · Quem vê a obra comenta; só o autor ou o administrador apaga

**Status:** proposta
**Contexto:** Acessos · Compras de Produtos (observações)
**Aprovada por:** a confirmar · **Desde:** 2026-09-19

## Enunciado

Todo mundo que vê a obra pode deixar uma observação nela, sem precisar da edição; a observação não se edita, e só quem a escreveu ou um administrador pode apagá-la.

## Por quê

Decisão de 19/09/2026 citada em `web/api/_lib/rotas/comentarios.js:24-28` ("TODO mundo que entra no app comenta"); "recado alterado depois de lido confunde mais do que ajuda" (`:124-126`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A Mehoo vendo a obra 2450 | escreve "falta comprar divisor de talher" | a observação é gravada em nome dela. |
| Ana, autora de uma observação | a apaga | some. |
| Bruno (GC), que não é o autor | tenta apagar a observação de Ana | o banco recusa (a tela não recebe erro, ver riscos da referência da API). |

## Fora do escopo

Onde a observação aparece (tela de Compras de Produtos).

## Implementação

- Hoje: Servidor `web/api/_lib/rotas/comentarios.js:65-130` (ler e escrever exigem ver a obra; apagar não confere nada); banco `supabase/rls-reforco.sql:366-372` e `supabase/obra-comentario.sql:77` (apagar: autor ou `admin_do_time()`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [login-e-acessos](../funcionalidades/login-e-acessos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
