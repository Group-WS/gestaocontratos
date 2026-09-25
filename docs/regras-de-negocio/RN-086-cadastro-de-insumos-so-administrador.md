# RN-086 · Só o administrador mantém o cadastro de insumos

**Status:** vigente
**Contexto:** Configurações · Cadastro de Insumos
**Aprovada por:** Allysson Pereira · **Desde:** 2026-09-23

## Enunciado

Criar, editar, ativar, desativar, apagar e importar insumos no Cadastro de Insumos é do
administrador (Administrador ou Admin master, ativo). O resto do time pode consultar o cadastro e a
tabela de preços ativa, mas não muda nada; quem está na fila, sem perfil, não vê nada.

## Por quê

Pedido de 22/09/2026 ("colocar para o admin em configurações uma forma dele conseguir subir os
insumos") e decisões dos itens 6 e 8 da `docs/ADR-008-cadastro-de-insumos.md`: a tela é só de quem
administra; no banco, o time lê e só o administrador escreve, como nos outros cadastros da empresa.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um Administrador | cria, edita ou apaga um insumo | grava |
| Um Admin master | importa o relatório de Insumos do Sienge | grava |
| Um Geral, um GC ou a Mehoo | tenta criar, editar, apagar ou importar | recusado |
| Um GC | consulta o cadastro | vê a lista |
| Um Administrador desativado | tenta editar | recusado |
| Quem está na fila (sem perfil) | tenta ler o cadastro | não recebe nada |
| Qualquer pessoa que não administra | tenta trocar a tabela ativa | recusado |

## Fora do escopo

- Quem mantém o `insumo_sienge` antigo (Banco de Preços): continua como está.
- Quem pode usar o cadastro nas telas de compra: o cadastro ainda não alimenta o Associar insumos.

## Implementação

- Regra: `web/src/regras/cadastroDeInsumos.js` (`podeManterCadastroDeInsumos`)
- Teste: `web/src/regras/cadastroDeInsumos.test.mjs`
- Garantia no banco: `supabase/insumo-cadastro.sql` (policies de escrita com `sou_admin()`)
- Onde é chamada: `web/api/_lib/rotas/insumoCadastro.js` (rota) e `web/src/lib/pessoas.js` (menu)
- Teste do banco: `supabase/tests/17-insumo-cadastro.sql`

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Criação, já vigente (decidida item a item na ADR-008) | Allysson Pereira | — |
