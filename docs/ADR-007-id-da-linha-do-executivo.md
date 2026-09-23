# ADR-007 — A linha do Executivo tem identificador próprio e imutável

Gestão de Obras TKWS · 23/09/2026 · **Decidido pelo dev**

---

## O problema

Na Conferência do executivo da obra 9999, dois de quatro "Painel de embutir ECO 18W" foram
aprovados para compra (Living e Dormitório). No Executivo, os quatro apareceram travados como
aprovados. O banco estava certo; a tela, errada.

A planilha do Executivo (`itensPlanilhaExecutivo`) e a lista de trabalho da verba (`itens`, que a
Conferência, o Plano e as Compras leem) nascem iguais e depois se separam: a mão de obra das
verbas de contrato vira linha própria, entram trocas, saem itens. Uma lista achava a outra **pela
descrição**. Com quatro produtos de mesma descrição, em ambientes diferentes:

- a trava da RN-002 travava os quatro quando um estava aprovado;
- editar uma célula de um painel gravava nos quatro itens da lista de trabalho (defeito que vinha
  da correção de 19/09, que trocou a posição pela descrição).

## As decisões (23/09/2026)

| Pergunta | Resposta |
|---|---|
| Como a linha acha o item | **Identificador próprio** (`idLinha`) |
| Quando o id nasce | Quando a linha entra no Executivo: importação da planilha, "puxar do criativo" ou item adicionado. "A base de tudo é o item no executivo." |
| O id muda | **Nunca.** Nenhuma edição o troca. |
| Linha de mão de obra separada | **Mesmo id do produto** (é o mesmo produto). Trava se qualquer das duas estiver aprovada. |
| Empate (duas linhas iguais em tudo) | **Trava as duas** — lado seguro. |
| O que entra agora | A trava da RN-002 e a edição de célula. Inserir e substituir por posição ficam para depois. |
| Obras que já existem | **Script, com relatório antes**; só grava com o ok do dev. |
| Substituir a planilha inteira | **Linha nova, id novo.** A planilha anterior sai com tudo que vinha dela. |
| Migração: casar só por descrição + ambiente | **Não.** Só com a identidade completa. |
| O banco garante que o id não muda | **Agora não** — a tela garante; fica como pendência. |
| Linha que a migração não casa com certeza | **Fica sem id** e a tela trata pela descrição, travando se houver qualquer aprovado igual. O relatório lista essas linhas. |

## A solução

- `web/src/lib/idDaLinha.js`: gera o id e casa as linhas das obras antigas (só com certeza: uma
  linha do Executivo e um item com a mesma identidade — descrição, ambiente, especificação,
  fornecedor e unidade — únicos na verba).
- **Onde o id nasce:** `importPlanilhaExecutivo`, `puxarDoCriativo`, `adicionarItemExecutivo`. A
  separação da mão de obra copia o item inteiro, então a linha de MO herda o id.
- **Edição (`editarItemExecutivo`):** com id, o alvo é exatamente o item e a linha de MO dele;
  `idLinha` é tirado de qualquer patch. Sem id, a descrição continua valendo, como antes.
- **RN-002 (`linhaDoExecutivoTravada`):** casa pelo id; sem id, pela descrição (lado seguro). O
  gatilho do banco não muda: ele já comparava item a item, e o id não entra na digital.
- **Migração:** `web/scripts/migrar-id-da-linha.mjs`, em dois passos (relatório, depois gravação).
  Cada gravação só vale se a obra não mudou desde a leitura e ninguém está com a edição.

## Consequências

- Descrições repetidas na mesma verba deixam de se misturar na trava e na edição.
- Linhas antigas sem par continuam no comportamento antigo até alguém resolvê-las.
- Pendência: garantir no banco que o id não muda.
- Ordem de entrada: deploy primeiro, migração depois (com a leitura refeita na hora).
- Inserir e substituir no Executivo ainda marcam a lista de trabalho pela posição (fora do escopo
  desta decisão).
