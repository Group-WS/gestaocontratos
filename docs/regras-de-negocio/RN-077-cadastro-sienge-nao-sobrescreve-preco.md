# RN-077 · O cadastro do Sienge não sobrescreve o preço pago

**Status:** proposta
**Contexto:** Banco de Preços
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Importar o cadastro de insumos do Sienge só acrescenta ao Banco de Preços os insumos que ainda não estão lá; nunca troca o preço pago por preço de tabela. Nenhum preço é apagado por essa importação.

## Por quê

O cadastro traz preço de tabela, a maioria zerado — escrever por cima trocaria o preço pago por zero (`web/src/lib/insumos.js:106-112`; `web/src/App.jsx:20571-20577`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um insumo com preço pago R$ 350 | o cadastro traz o mesmo com preço de tabela 0 | continua R$ 350. |
| Um insumo ativo que nunca foi comprado | o cadastro é importado | entra na base com o preço de tabela (ou zero). |
| Um insumo que saiu do cadastro | o cadastro é importado | o preço pago dele continua na base. |

## Fora do escopo

A lista de ativos (outra regra).

## Implementação

- Hoje: `web/src/lib/insumos.js:113` (`soOsNovos`); `web/src/App.jsx:20578-20626`; só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [banco-de-precos](../funcionalidades/banco-de-precos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
