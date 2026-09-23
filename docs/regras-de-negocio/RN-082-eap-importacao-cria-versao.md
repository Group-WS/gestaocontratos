# RN-082 · Importar a EAP cria versão nova

**Status:** proposta
**Contexto:** EAP Sienge
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

Importar a EAP do Sienge sempre cria uma versão nova; nenhuma versão anterior é sobrescrita. O mapa verba → item da versão anterior é herdado pelos códigos que continuam existindo, e as verbas que perderam o código são avisadas.

## Por quê

ADR-002 (15/09/2026), decisão 2: uma solicitação enviada mês passado precisa continuar explicável pela EAP que valia naquele dia; herdar evita refazer as 35 ligações (`web/src/lib/eapApropriacao.js:14-20`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A versão padrão com 33 verbas ligadas | alguém importa um orçamento novo | nasce outra versão, e a antiga continua na lista. |
| Que o código de uma verba não existe na versão nova | importa | a tela avisa "verba 20 → 04.001.001.001" para refazer. |
| Todos os códigos presentes | importa | o mapa é herdado inteiro. |

## Fora do escopo

Qual versão vale (regra da versão padrão).

## Implementação

- Hoje: `web/src/lib/eapApropriacao.js:61-89`; `web/api/_lib/rotas/eap.js:134-221`; tela e servidor (sem transação).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [eap-sienge](../funcionalidades/eap-sienge.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
