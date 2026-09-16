# ADR-003 — Solicitação de compra: o primeiro consumo da API do Sienge

Gestão de Obras TKWS · 15/09/2026 · **Aceito**

---

## Contexto

O canal Sienge das *Compras de Produtos* terminava em arquivo. O time
selecionava as linhas, baixava o "Resumo p/ cadastro" ou o Template
Sienge, e **redigitava a solicitação dentro do Sienge**. Tudo que este app
sabia do ERP entrava por planilha (`lib/sienge.js`, `lib/siengePedido.js`,
`sienge_obra`), e nada saía daqui direto para lá.

A solicitação de compra é a primeira coisa que o GC **escreve** no Sienge.
Isso muda a natureza do erro: até aqui, um dado torto era um dado torto na
tela; agora é um registro no ERP que alguém vai ter que cancelar.

Existe precedente na casa: o `agendadefretesws` já fala com a mesma API em
produção (`lib/sienge-platform/client/client.ts`).

## Decisões

### 1. Credencial só no servidor, com o cliente portado do agendadefretesws

A chamada sai de uma rota serverless (`POST /api/sienge/solicitacao`), e o
cliente (`web/api/_lib/sienge.js`) é o do `agendadefretesws` traduzido
para CommonJS: **mesmos nomes de variável** (`SIENGE_BASE_URL`,
`SIENGE_SUBDOMAIN`, `SIENGE_USERNAME`, `SIENGE_PASSWORD`), mesmo caminho
base, mesmo timeout de 30s, mesmo backoff de 429 (4 tentativas), mesmos
códigos de erro.

**Por quê.** O frontend roda no navegador: qualquer prefixo `VITE_` vai
para o bundle, e credencial no bundle é credencial publicada — é o mesmo
motivo pelo qual o token do Monday já vive no servidor. E porque duas
credenciais diferentes para o mesmo ERP seriam o começo de dois jeitos de
falar com ele: a cota de rate limit é **compartilhada** entre os dois
apps, então o backoff precisa ser o mesmo.

**Custo aceito.** Uma tradução manual de TypeScript para CommonJS que
pode divergir do original com o tempo. Menor que o custo de um segundo
contrato de integração.

**Divergência deliberada do original:** lá, erro HTTP vira
`Sienge HTTP 422` e o corpo é descartado. Aqui o corpo é lido e o
`clientMessage` sobe inteiro (decisão 6).

### 2. Um POST por item, em sequência

Depois de criar o cabeçalho, cada item vai numa chamada própria a
`/purchase-requests/{id}/items`.

**Por quê.** Mandar o array inteiro é mais rápido e é exatamente o que não
serve: um insumo repetido devolve 422 e **derrubaria o lote**, inclusive
os itens que estavam certos. Item a item, cada recusa é sobre o seu item,
e a pessoa vê o que entrou e o que faltou em vez de "deu erro".

**Custo aceito.** N requisições por envio, e mais lento. Em sequência, e
não em paralelo, pela cota compartilhada da decisão 1.

### 3. Itens iguais somam antes de sair

Mesmo `productId` + mesmo detalhe + mesma apropriação viram uma linha, com
as quantidades somadas — a mesma regra do `resumoCadastroSienge`.

**Por quê.** Não é economia de requisição: é o que evita o 422 "não é
possível cadastrar mais de um insumo de mesmo código, obra, detalhe e
marca". Dois ambientes que pedem a mesma luminária são uma linha de duas
unidades, como seria se alguém digitasse no Sienge.

### 4. O insumo mãe é o que barra — o detalhe, não

Vai quem tem **insumo mãe associado** (é ele o `productId`), quantidade
maior que zero, unidade que exista no cadastro do Sienge, verba ligada a
uma folha da EAP (ADR-002), alguma descrição para a observação, e que
ainda não foi solicitado.

**Revisão de 15/09/2026.** A primeira versão exigia também detalhe casado
(`status === "exato"`), com o argumento de que "uma solicitação de compra
não cadastra insumo". O argumento é verdadeiro e não vinha ao caso: o que
o Sienge exige é o **insumo**, e o detalhe é opcional — item sem detalhe
casado entra igual, descrito em `notes`. A regra não protegia nada e
barrava boa parte de cada seleção.

Isso continua valendo depois da decisão 9, que passou a mandar `detailId`
quando existe: ele **enriquece** o item, não é condição para ele sair.

O que distingue os dois é a descrição, e ela segue a mesma regra do
"Resumo p/ cadastro": quem escolheu uma variante manda **a variante**;
quem marcou *cadastrar como detalhe novo* manda **o descritivo do quadro,
já com a edição à mão**, se houve. Mandar o texto gerado para quem
escolheu variante descreveria outra coisa.

**Custo aceito.** A solicitação pode citar um detalhe que ainda não existe
no cadastro do Sienge. O item vai marcado no modal como "detalhe ainda não
cadastrado", e o Template Sienge do grupo continua sendo o caminho para
criá-lo.

**Continua valendo:** item que não pode ir **não some**. Ele aparece no
modal com o motivo e segue selecionado — e o modal presta contas da conta
inteira ("4 linhas selecionadas → 3 itens vão (1 somada) · 1 não vai"),
porque agregação sem essa conta parece sumiço.

### 5. A apropriação é conferível — e corrigível — na hora do envio

O modal mostra a folha da EAP de cada verba alcançada pela seleção, e
deixa trocá-la ali. A troca **grava no cadastro** (`sienge_eap_mapa`), e o
pedido é remontado.

**Por quê.** Quem descobre que a apropriação está errada é quem está
enviando, olhando os itens. Mandá-lo ao módulo EAP só para voltar seria o
caminho mais longo até a mesma correção — e, no meio dele, a tentação de
enviar assim mesmo. A unidade construtiva segue a mesma ideia: a da EAP
padrão é o ponto de partida, editável no envio (a obra 2307 apropria na 1,
a obra modelo na 9), mas essa não é gravada no cadastro, porque varia por
obra.

**Custo aceito.** Uma correção feita com pressa vale para todas as obras,
já que o mapa é global. Aceito porque a alternativa — cada obra com o seu
mapa — multiplicaria por dezenas o trabalho de configuração que a ADR-002
existe para evitar.

**Consequência boa:** remontar (em vez de remendar o pedido já montado)
faz a troca **desbloquear** itens que estavam barrados por falta de folha,
sem fechar e reabrir o modal.

### 6. O erro do Sienge vai cru para a tela

O `clientMessage` sobe inteiro: *"Não é possível cadastrar mais de um
insumo de mesmo código, obra, detalhe e marca. O insumo 275 - AR
CONDICIONADO já existe na solicitação 23488."*

**Por quê.** Essa mensagem é melhor que qualquer coisa que escreveríamos
por cima: diz o que houve, com qual item e onde olhar. O
`developerMessage` fica de fora — é chave de i18n
(`adc.message.solicitacao.insumo.ja.existe`), não serve para quem compra.

### 7. `VALENTINA` assina as solicitações

`requesterUser` e `createdBy` são fixos.

**Por quê.** Decisão do negócio, registrada aqui para não virar uma
constante órfã no código. No Sienge, é este nome que aparece como
solicitante de tudo que sai do GC — quem apertou o botão fica no log
(decisão 8), não no ERP.

### 8. O registro nasce ANTES do envio — revisto em 15/09/2026

`sienge_solicitacao` guarda o payload, a resposta item a item, quem enviou
e quando. A linha é criada com `status='enviando'` **antes da primeira
chamada**, e fechada quando a resposta volta.

**O que mudou.** A primeira versão gravava depois — "registro o que
aconteceu" —, e tinha um buraco que só aparece no pior momento: se o
navegador fecha, a aba trava ou a resposta se perde na volta, a
solicitação existe no Sienge e não existe aqui. Ninguém sabe, alguém
reenvia, e agora são duas.

**Por quê antes.** Um envio sem rastro é indistinguível de um envio que
nunca houve. Gravando antes, o que sobra de uma falha é uma **pergunta
registrada** ("este ficou sem resposta"), e não silêncio.

**Custo aceito.** Se o registro falhar, o envio é **interrompido** e nada
é mandado — inclusive quando o banco está desatualizado. Parar é melhor
que mandar às cegas.

**As duas metades da idempotência:** a *chave* identifica a tentativa
(uuid com índice único: duplo clique e F5 esbarram nela) e a *assinatura*
identifica o conteúdo (obra + insumos + quantidades + apropriação),
reconhecendo o mesmo lote numa tentativa nova. Preço e observação ficam
fora da assinatura: corrigir um custo não faz do pedido outro pedido.

**Falha não presume nada.** Erro de rede ou 5xx **mantém** o registro em
`enviando`, porque a chamada pode ter chegado e só a resposta ter se
perdido; só 400 e 503, onde o servidor garante que nada saiu, marcam
`falhou`. A dúvida é resolvida perguntando ao Sienge
(`GET /api/sienge/solicitacao/:id`), não supondo.

**Fechar o registro é o passo que pode falhar com o Sienge já tendo
recebido** — e aí a orientação na tela é o oposto: *não* reenviar.

### 9. O detalhe do insumo vai junto — revisto em 15/09/2026

A solicitação manda `detailId` quando o insumo tem detalhes cadastrados
na obra.

**O que mudou.** A primeira versão não mandava, porque eu não havia
encontrado de onde tirar o código do detalhe: a base local
(`insumo_preco`) guarda a mãe e a descrição concatenada, e os itens de
pedido só devolvem o detalhe de um pedido que já existe. A conclusão
estava errada — o catálogo existe em
**`GET /building-cost-estimations/{obra}/resources`**, onde cada insumo
vem com `details[]` e `trademarks[]`:

```
275  AR CONDICIONADO
      3  LG / SPLIT DUAL INVERTER 12.000 BTUS QUENTE E FRIO / BRANCO
      4  LG / SPLIT DUAL INVERTER 18.000 BTUS QUENTE E FRIO / BRANCO
      5  LG / SPLIT DUAL INVERTER 24.000 BTUS QUENTE E FRIO / BRANCO
```

**Por quê importa.** O insumo é a categoria; o detalhe é o produto.
Solicitação só com o insumo pede "ar-condicionado" — quem vai cotar não
sabe se é o split de 12.000 ou o cassete de 18.000.

**O casamento sugere, não decide.** Descrição igual (ignorando caixa,
acento e pontuação) marca o detalhe direto; abaixo disso, vale o mais
parecido **apenas com 70% das palavras em comum**, e a tela mostra esse
caso destacado, como "parecido, confira". Sem semelhança, nenhum detalhe
é escolhido: chutar aqui é pedir o produto errado, e a solicitação sai
igualmente válida sem o campo.

**Custo aceito.** O endpoint não filtra por insumo, então a varredura é a
obra inteira (~14 páginas, ~5s na 2045). Daí o cache de 30 minutos no
servidor — curto o bastante para um detalhe recém-cadastrado aparecer.
Falhar em ler o catálogo **não impede o envio**: a solicitação sai sem
`detailId`, com o aviso na tela.

## Consequências

- Rota `POST /api/sienge/solicitacao` e cliente `api/_lib/sienge.js`.
  Três variáveis novas de ambiente, documentadas em `web/.env.example` e
  que precisam existir na Vercel — sem elas a rota responde 503 e o botão
  não aparece.
- Ação **"Solicitar Compra no Sienge"** na barra de seleção, só na etapa
  `SG - Sienge` e só com a EAP cadastrada.
- `lib/siengeSolicitacao.js` (montagem e elegibilidade, testada em
  `src/__testes__/sienge-solicitacao.test.mjs`) e `simboloSienge` em
  `lib/sienge.js`, que traduz a unidade da casa ("und", "M²", "pç") para o
  símbolo do cadastro do Sienge. Unidade sem equivalente (`cj`) barra o
  item na tela, em vez de deixar o Sienge escolher.
- Item aceito ganha `solicitacaoSienge: { id, em, por }` no JSONB, além do
  `solicitado` que já existia — o que mantém funcionando a regra de que
  item do Sienge só vira "comprado" depois de solicitado.
- Depende do ADR-002: sem EAP padrão e sem o mapa das verbas, nenhum item
  é enviável.
- Rota `GET /api/sienge/insumos/:buildingId?ids=…` (catálogo de detalhes,
  com cache) e `GET /api/sienge/solicitacao/:id` (o que o Sienge de fato
  tem, usada na reconciliação de envio sem resposta).
