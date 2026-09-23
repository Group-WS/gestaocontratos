# RN-022 · Só o Admin master restaura versão da obra

**Status:** proposta
**Contexto:** Histórico da obra
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Só o Admin master (quem cuida da Equipe) restaura uma versão guardada da obra. Restaurar também vira versão, e dá para voltar atrás.

## Por quê

A tela diz "Só o admin master restaura." (`web/src/App.jsx:3373`). Origem da decisão não encontrada no código (a confirmar).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| O Admin master | restaura a versão das 9h da 2450 | a obra volta a ela e a restauração vira uma versão nova. |
| Um GC | abre o histórico | não vê o botão Restaurar. |
| Um GC | chama a rota de restaurar | hoje o servidor aceita (a regra está só na tela). |
| Outra pessoa com a trava viva | alguém restaura | é recusado. |

## Fora do escopo

O que o histórico guarda e por quanto tempo (poda de 24 + marcos + quedas de 30 dias).

## Implementação

- Hoje: Só na tela (`podeRestaurar={podeGerenciarPessoas(...)}`, `web/src/App.jsx:25874`); o servidor exige só a edição da obra (`web/api/_lib/rotas/obraDados.js:143`); o banco confere só a trava (`supabase/salvar-obra.sql:371`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [gravacao-da-obra](../funcionalidades/gravacao-da-obra.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
