# RN-026 · Avanço geral da obra é a média de três frentes

**Status:** proposta
**Contexto:** Visão geral da obra
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O avanço geral de uma obra é a média simples de três frentes: Projetos (quantos dos 4 cadernos — criativo, especificação, marcenaria, projeto — estão anexados), Suprimentos (percentual do valor de material já comprado) e Execução (percentual do valor de mão de obra já contratado).

## Por quê

Comentário de `DashboardObra` ("Projetos": os mesmos marcos do painel geral, recortados para fora do CMV e do "em execução"). Não é medição física. Origem da fórmula não encontrada (a confirmar).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| 2 de 4 cadernos, 60% do material comprado e 30% da mão de obra contratada | se calcula | o avanço é 47% ((50 + 60 + 30) / 3). |
| Uma obra nova sem nada | se calcula | 0%. |
| A mesma obra no Início | se olha a coluna de etapa | lá o percentual é outro: a proporção de passos da esteira (a confirmar qual das duas vale). |

## Fora do escopo

O percentual da esteira no Início e no mapa.

## Implementação

- Hoje: Só na tela (`web/src/App.jsx:1196`–`1200`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [dashboard](../funcionalidades/dashboard.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
