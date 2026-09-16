# ADR-002 — A EAP do Sienge como cadastro versionado

Gestão de Obras TKWS · 15/09/2026 · **Aceito**

---

## Contexto

Toda solicitação de compra enviada ao Sienge precisa dizer **onde** o
produto é apropriado no orçamento: uma referência de item
(`costEstimationItemReference`, ex. `04.001.001.001`) e uma unidade
construtiva (`buildingUnitId`). Sem os dois, a API recusa o item.

Nenhum dos dois existia no GC. A planilha da obra trabalha com a **EAP da
casa** — as 35 verbas de `eap_grupo`, "20 Climatização / Exaustão" —, que
tem numeração própria e nomes próprios. A EAP do Sienge, exportada do
relatório de orçamento, tem quatro níveis e 53 itens apropriáveis, e
chama a mesma coisa de "04.001.001.001 Climatização, ventilação e
exaustão [MAT]".

São duas estruturas paralelas descrevendo a mesma obra. Enquanto as
compras saíam daqui em planilha para alguém redigitar no Sienge, essa
distância era problema de quem digitava. Ligando os dois sistemas, ela
vira uma decisão de software.

## Decisões

### 1. A EAP mora no GC, importada por planilha

O cadastro é alimentado pelo **Relatório de Orçamento em Excel**,
exportado do Sienge e subido no módulo *EAP Sienge*.

**Por quê.** A apropriação precisa estar resolvida **antes** de o botão
"Solicitar Compra" existir na tela — é ela que decide quais itens podem
ser enviados. Dado que chega junto com o envio não pode ser conferido por
ninguém antes do envio.

**Custo aceito.** A EAP envelhece em relação ao Sienge, e reimportar é
manual. Aceito: ela muda uma ou duas vezes por ano, e o relatório traz a
versão do orçamento, então dá para saber de quando é o que está valendo.

**Descartado:** ler o orçamento da obra ao vivo pela API a cada envio.
Acopla o envio a uma segunda chamada que pode falhar sozinha, e deixaria
a tela sem como mostrar a apropriação antes de enviar.

### 2. Importar cria versão nova; nada é sobrescrito

Cada importação é uma linha em `sienge_eap_versao`, com seus itens e seu
mapa. A anterior fica.

**Por quê.** Uma solicitação enviada mês passado foi apropriada pela EAP
que valia naquele dia. Sobrescrever apagaria a explicação de um envio que
já aconteceu — e o log de envios (ADR-003) ficaria apontando para códigos
que não existem mais.

**Custo aceito.** O cadastro acumula versões e alguém precisa dizer qual
é a padrão. É uma escolha explícita na tela, não um efeito colateral.

### 3. O mapa verba → folha é cadastro, não cálculo

Cada verba da casa aponta para uma folha da EAP do Sienge, gravado em
`sienge_eap_mapa`. A tela **sugere** por semelhança de nome
(`sugerirFolha`, reusando o `semelhanca` de `lib/sienge.js`), mas quem
confirma é a pessoa.

**Por quê.** Medimos: contra a EAP real, a sugestão automática acerta 19
das 33 verbas e **não erra nenhuma** — nas outras 14 ela simplesmente não
tem confiança suficiente e não sugere nada. Ou seja, ela é boa como atalho
e insuficiente como decisão. Apropriar na conta errada é um erro que o
Sienge **aceita calado**, porque o código existe — só não é aquele. Não
existe validação depois que pegue isso; só a conta fechando errado no fim
do mês.

**Custo aceito.** Verba sem folha **bloqueia o envio** dos itens dela. De
propósito: parar é melhor que apropriar errado.

**Descartado:** derivar o código por regra a partir do número da verba
(as numerações não têm relação); e escolher a folha no momento do envio,
sem cadastro (jogaria a decisão para quem está com pressa, toda vez).

### 4. A folha [MAT] é o default

Muitas famílias do Sienge separam material de mão de obra
(`04.001.001.001 [MAT]` × `04.001.001.002 [MO]`). Em empate de
semelhança, a sugestão fica com a [MAT].

**Por quê.** Esta tela serve *Compras de Produtos*: por ali só passa
material. Mão de obra entra por outro caminho.

### 5. O cadastro nasce preenchido

`supabase/sienge_eap_seed.sql` planta a versão `EAP INICIAL - TKWS
INTERIORES` (unidade construtiva 9), seus 127 itens e o mapa inicial. O
arquivo é **gerado** por `web/scripts/gerar-seed-eap.mjs`, que chama o
mesmo parser da tela.

**Por quê.** Um cadastro vazio no primeiro dia empurra a configuração
para o momento em que alguém quer usar a funcionalidade — e quem quer
solicitar uma compra não quer, naquele instante, ligar 33 verbas.

**Custo aceito.** O seed tem um mapa escrito à mão no script. Três verbas
ficaram **de fora de propósito**, por ambiguidade real: `02 Serviços
Complementares` (a família 01 do Sienge tem 7 folhas), `13 Piso Vinílico e
Carpete` (o Sienge separa em duas) e `29 Adega Climatizada` (cabe em
eletroeletrônicos ou em climatização). Elas aparecem destacadas na tela.

## Consequências

- Módulo novo **EAP Sienge**, visível a todos os perfis menos Mehoo.
- Tabelas `sienge_eap_versao`, `sienge_eap_item` e `sienge_eap_mapa`
  (`supabase/sienge_eap.sql`), com a chave estrangeira composta que
  impede uma verba de apontar para código de outra versão.
- `lib/eapSienge.js` (leitura pura, testada em
  `src/__testes__/eap-sienge.test.mjs`) e `lib/eapApropriacao.js`
  (banco). **Cuidado com o nome:** `lib/eap.js` continua sendo a EAP da
  casa — são coisas diferentes.
- O envio ao Sienge (ADR-003) passa a depender deste cadastro: sem a EAP
  padrão definida, nenhum item é enviável.
