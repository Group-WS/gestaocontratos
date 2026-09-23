# RN-019 · Só o administrador corrige o endereço da obra

**Status:** proposta
**Contexto:** Cadastro de obra · Cabeçalho da obra
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

Só o Administrador e o Admin master corrigem o endereço da obra. Endereço em branco volta a valer o do cadastro do Sienge.

## Por quê

Comentário de `EnderecoDaObra`: "Administrador e admin master corrigem no lápis quando precisa (pedido de 15/09/2026); o resto do time só vê."

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um Administrador | corrige o endereço da 2450 | a obra passa a mostrar o novo endereço. |
| Um GC | olha o topo da obra | não vê o lápis. |
| Um Administrador | apaga o endereço e salva | a obra volta a mostrar o endereço do Sienge. |
| Um GC | chama a rota de endereço | hoje o servidor aceita (a regra está só na tela). |

## Fora do escopo

O endereço do cadastro do Sienge (espelho importado por SQL).

## Implementação

- Hoje: Só na tela (`podeEditar={souAdmin}`, `web/src/App.jsx:25738`); o servidor exige só a edição da obra (`web/api/_lib/rotas/obras.js:219`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [cadastro-de-obra](../funcionalidades/cadastro-de-obra.md), [dashboard](../funcionalidades/dashboard.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
