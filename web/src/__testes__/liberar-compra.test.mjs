/* Liberar para Compra.
 *
 * Roda com: node web/src/__testes__/liberar-compra.test.mjs
 *
 * A regra (16/09/2026): o executivo decide item a item o que pode ser
 * comprado. Até ele dizer, a linha é ESTIMATIVA — aparece no Plano de
 * Compras e soma, mas não entra na tela de Compras.
 *
 * Duas coisas aqui não podem quebrar nunca:
 *   1. quem já estava no fluxo continua liberado (senão ligar a regra
 *      esvazia a tela de Compras das obras em andamento);
 *   2. item com alerta não libera sem alguém dizer que conferiu.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tudo as fonteDoApp } from "./fonte.mjs";

/* O CSS saiu do App.jsx e virou folha .css — `fonteDoApp` e os dois juntos,

   na ordem do main.jsx. Ver fonte.mjs. */

const src = fonteDoApp;
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const trecho = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate);
  if (i === -1 || f === -1) throw new Error(`não achei o intervalo: ${de} .. ${ate}`);
  return src.slice(i, f);
};

const M = eval(`(function () {
  const padraoDaDescricao = () => null;
  const verbaPorNome = () => null;
  const eapPadrao = () => [];
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  ${bloco("function liberadoParaCompra(")}
  ${src.slice(src.indexOf("const CAMPOS_QUE_DERRUBAM_APROVACAO"), src.indexOf("];", src.indexOf("const CAMPOS_QUE_DERRUBAM_APROVACAO")) + 2)}
  ${bloco("function edicaoDerrubaAprovacao(")}
  ${bloco("function aprovadoPeloCliente(")}
  ${bloco("function pendenciaParaLiberar(")}
  ${bloco("function podeLiberarItem(")}
  ${bloco("function itensParaLiberar(")}
  ${bloco("function produtosMAT(")}
  ${src.slice(src.indexOf("const chaveDescricao ="), src.indexOf("\n", src.indexOf("const chaveDescricao =")) + 1)}
  const alertaConferenciaTecnica = (d) => (/mesa/i.test(d || "") ? { escopo: "item", texto: "Mesa grande: confira a medida." } : null);
  return { edicaoDerrubaAprovacao, liberadoParaCompra, aprovadoPeloCliente, pendenciaParaLiberar, podeLiberarItem, itensParaLiberar, chaveDescricao, produtosMAT };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. Quem já estava no fluxo continua liberado ----
   Sem isto, ligar a regra esvaziaria a tela de Compras: só na obra 2450
   são 156 itens com canal escolhido e 8 já comprados (medido em 16/09). */
conf("item novo não nasce liberado", M.liberadoParaCompra({ desc: "Cuba" }), false);
conf("liberado na mão conta", M.liberadoParaCompra({ liberadoCompra: { em: "x" } }), true);
conf("já comprado continua", M.liberadoParaCompra({ comprado: true }), true);
conf("com canal escolhido continua", M.liberadoParaCompra({ canalCompra: "sienge" }), true);
conf("já solicitado continua", M.liberadoParaCompra({ solicitado: true }), true);
conf("compra avulsa já nasce no fluxo", M.liberadoParaCompra({ avulso: true }), true);
conf("item de aditivo também", M.liberadoParaCompra({ aditivo: "2405/1" }), true);
conf("indefinido não quebra", M.liberadoParaCompra(undefined), false);

/* ---- 2. O alerta trava a liberação ---- */
const comAlerta = { desc: "Mesa de jantar 3,20m" };
const semAlerta = { desc: "Cuba de apoio" };
conf("alerta técnico vira pendência", M.pendenciaParaLiberar(comAlerta).tipo, "tecnica");
conf("sem alerta, sem pendência", M.pendenciaParaLiberar(semAlerta), null);
conf("entrou sem ser vendido também pende", M.pendenciaParaLiberar(semAlerta, { entrou: true }).tipo, "entrou");
conf("item com alerta não libera", M.podeLiberarItem(comAlerta, {}), false);
conf("depois de conferido, libera", M.podeLiberarItem({ ...comAlerta, alertaConferido: { por: "eu" } }, {}), true);
conf("sem alerta libera direto", M.podeLiberarItem(semAlerta, {}), true);
/* Quem já está no fluxo não volta a travar: o item comprado ontem não
   pode sumir da tela de Compras porque hoje surgiu uma regra nova. */
conf("já comprado não trava por alerta", M.podeLiberarItem({ ...comAlerta, comprado: true }, {}), true);

/* ---- 3. O CLIENTE DEIXOU DE BARRAR (decisão dela, 18/09/2026) ----
 *
 * Até aqui a aprovação do cliente era o primeiro elo da corrente: sem ela,
 * nada era liberado para compra e o Plano de Compras ficava fechado. Ela
 * tirou os dois blocos de aprovação da Conf. Executivo e, perguntada sobre o
 * portão, escolheu tirar junto: "o cliente deixa de barrar".
 *
 * Quem segura a compra agora são as duas decisões internas — o executivo
 * conclui a linha, o administrador libera. Os carimbos `aprovadoCliente` que
 * já existem continuam gravados; só não decidem mais nada.
 */
const semAssinatura = {};
const assinada = { clienteAssinouEm: "2026-09-10" };
/* `aprovadoPeloCliente` continua existindo e respondendo a verdade — ela é
   histórico, e o Início ainda a lê. O que mudou é quem a consulta. */
conf("assinatura geral continua sendo lida", M.aprovadoPeloCliente({ desc: "Cuba" }, assinada), true);
conf("sem assinatura, item novo não está aprovado", M.aprovadoPeloCliente({ desc: "Cuba" }, semAssinatura), false);
conf("aprovação parcial no item continua valendo", M.aprovadoPeloCliente({ aprovadoCliente: { em: "x" } }, semAssinatura), true);

/* O QUE MUDOU: a falta do cliente não é mais pendência, e não barra. */
conf("falta do cliente deixou de ser pendência", M.pendenciaParaLiberar(semAlerta, {}), null);
conf("item sem nada pendente libera", M.podeLiberarItem(semAlerta, {}), true);
conf("o alerta técnico continua barrando", M.podeLiberarItem(comAlerta, {}), false);
conf("e o 'conferi' continua resolvendo",
  M.podeLiberarItem({ ...comAlerta, alertaConferido: { por: "eu" } }, {}), true);
/* `semCliente` no contexto não faz mais nada — se alguém reintroduzir a
   chamada antiga, o comportamento não pode voltar sozinho. */
conf("o contexto antigo não ressuscita a regra", M.podeLiberarItem(semAlerta, { semCliente: true }), true);

/* ---- 4. A planilha que vai pra tela ---- */
const obra = {
  categorias: [
    { num: "21", nome: "Móveis Sob Medida", itens: [
      { codigo: "1", desc: "Mesa de jantar 3,20m", totalMaterial: 5000 },
      { codigo: "2", desc: "Cuba de apoio", totalMaterial: 800, liberadoCompra: { em: "x" } },
      { codigo: "3", desc: "Montagem", totalMaterial: 0, totalMO: 900 },
      { codigo: "4", ehTitulo: true, desc: "MARCENARIA" },
    ] },
    { num: "18", nome: "Pintura", itens: [] },
  ],
};
// Obra sem assinatura: o cliente ainda não aprovou nada.
const g = M.itensParaLiberar(obra);
conf("só a verba com item entra", g.length, 1);
conf("mão de obra fica de fora", g[0].itens.length, 2);
conf("título não é produto", g[0].itens.some((x) => x.it.ehTitulo), false);
conf("o total é só material", g[0].total, 5800);
conf("e o liberado, só o que foi liberado", g[0].liberado, 800);
conf("um de dois liberados", g[0].liberados, 1);
conf("a mesa fica travada pelo alerta", g[0].itens[0].pode, false);
conf("a chave é posição, não código", g[0].itens[0].chave, "0-0");

/* A descrição é a ponte com o cruzamento, porque código não serve: a
   obra 2450 tem 198 de 269 itens sem código. */
conf("a chave da descrição ignora acento e caixa",
  M.chaveDescricao("  Cuba  de APOIO ") === M.chaveDescricao("cuba de apoio"), true);
const comEntrou = M.itensParaLiberar(obra, new Set([M.chaveDescricao("Cuba de apoio")]));
conf("entrou não trava quem já está liberado", comEntrou[0].itens[1].pode, true);

/* A obra do teste não tem assinatura — e desde 18/09/2026 isso não trava
   mais nada: o cliente deixou de barrar a liberação. O `aprovados` continua
   sendo contado (é histórico e o Início lê), só não decide. */
conf("sem assinatura, nada está aprovado pelo cliente", g[0].aprovados, 0);
conf("mas a falta dele não trava mais", g[0].itens[1].pendencia, "null");
/* Quem trava agora é só o alerta: a mesa tem um, a cuba não. */
conf("a mesa continua travada pelo alerta", g[0].itens[0].pendencia?.tipo, "tecnica");
conf("e a cuba, sem alerta, pode", g[0].itens[1].pode, true);

const comAssinatura = M.itensParaLiberar({ ...obra, clienteAssinouEm: "2026-09-10" });
conf("com a assinatura, todos aprovados", comAssinatura[0].aprovados, 2);
conf("a cuba já liberada continua liberada", comAssinatura[0].itens[1].liberado, true);
conf("e a mesa trava só pelo alerta", comAssinatura[0].itens[0].pendencia.tipo, "tecnica");

conf("obra vazia não quebra", M.itensParaLiberar({}).length, 0);

/* ---- 5. O bloqueio na tela de Compras ----
   É a tela onde se escolhe canal, pede orçamento e marca comprado. Só
   entra o que foi liberado — o resto continua no Plano, como estimativa. */
const naCompra = M.produtosMAT(obra);
conf("só o liberado chega nas Compras", naCompra.length, 1);
conf("e é a cuba, que foi liberada", naCompra[0].it.desc, "Cuba de apoio");
/* Quem já estava no fluxo entra sem ninguém ter liberado: senão a tela
   esvaziaria nas obras em andamento no dia em que a regra subisse. */
const comHistorico = { categorias: [{ num: "21", nome: "Móveis", itens: [
  { codigo: "9", desc: "Cuba antiga", totalMaterial: 500, canalCompra: "sienge" },
  { codigo: "10", desc: "Bancada nova", totalMaterial: 700 },
] }] };
conf("item com canal escolhido passa", M.produtosMAT(comHistorico).length, 1);
conf("e o sem nada fica de fora", M.produtosMAT(comHistorico)[0].it.desc, "Cuba antiga");

/* ---- 6. Editar um item aprovado o devolve pra fila ----
   Pergunta dela em 16/09/2026: "o executivo pode alterar um item que já
   estava aprovado pelo cliente?". Podia, e os carimbos ficavam — dava pra
   trocar produto e preço de algo aprovado e seguir comprando. */
conf("mudar a descrição derruba", M.edicaoDerrubaAprovacao({ desc: "Outro produto" }), true);
conf("mudar a quantidade derruba", M.edicaoDerrubaAprovacao({ qtdVendida: 4 }), true);
conf("mudar o custo unitário derruba", M.edicaoDerrubaAprovacao({ custoMaterial: 90 }), true);
conf("mudar o total derruba", M.edicaoDerrubaAprovacao({ totalMaterial: 900 }), true);
/* Ambiente, fornecedor e código NÃO derrubam: corrigir isso não muda
   produto nem preço, e mandar o item pra fila por causa de um acento
   ensinaria a equipe a evitar a correção. */
conf("corrigir o ambiente não derruba", M.edicaoDerrubaAprovacao({ ambiente: "Cozinha" }), false);
conf("corrigir o fornecedor não derruba", M.edicaoDerrubaAprovacao({ marca: "Deca" }), false);
conf("corrigir o código não derruba", M.edicaoDerrubaAprovacao({ especificacao: "6299" }), false);
conf("patch vazio não derruba", M.edicaoDerrubaAprovacao({}), false);
conf("indefinido não quebra", M.edicaoDerrubaAprovacao(undefined), false);

/* ---- A tela do cliente quer TUDO, a de liberação não ----
   "nessa tela tem que ter tudo" (17/09/2026). Na 2498 a verba 03 Civil é
   100% mão de obra: ela sumia da Aprovação do Cliente e ninguém tinha como
   aprovar. Mas mão de obra NUNCA pode entrar na liberação de compra — ela
   vai pra Contratos. Então a inclusão é por opção, e o padrão é sem. */
const comCivil = {
  categorias: [{ num: "03", nome: "Civil", itens: [
    { desc: "Demolição de alvenaria", codigo: "03.1", totalMaterial: 0, totalMO: 3000, custo: 3000 },
    { desc: "Contrapiso", codigo: "03.2", totalMaterial: 0, totalMO: 750, custo: 750 },
  ] }, { num: "27", nome: "Louças", itens: [
    { desc: "Cuba de apoio", codigo: "27.1", totalMaterial: 200, totalMO: 100, custo: 300 },
  ] }],
};
const soCompra = M.itensParaLiberar(comCivil);
const tudo = M.itensParaLiberar(comCivil, null, { comMaoDeObra: true });
conf("liberação de compra não vê a verba de mão de obra", soCompra.map((g) => g.num).join(","), "27");
conf("a tela do cliente vê as duas verbas", tudo.map((g) => g.num).join(","), "03,27");
conf("e vê os dois itens da Civil", tudo.find((g) => g.num === "03")?.itens.length, 2);
conf("a linha de mão de obra vem marcada", tudo.find((g) => g.num === "03")?.itens[0].ehMO, true);

/* O valor que o cliente aprova é o do item inteiro. `material` sozinho
   mostraria R$ 0,00 numa linha de mão de obra. */
conf("o valor do item de mão de obra não é zero", tudo.find((g) => g.num === "03")?.itens[0].valor, 3000);
conf("e o material dele continua zero", tudo.find((g) => g.num === "03")?.itens[0].material, 0);
conf("no item misto o valor soma as duas parcelas", tudo.find((g) => g.num === "27")?.itens[0].valor, 300);
conf("o total do grupo pro cliente é o cheio", tudo.find((g) => g.num === "03")?.totalValor, 3750);
conf("o total de material do grupo segue material", tudo.find((g) => g.num === "03")?.total, 0);
/* A tela de liberação não muda de comportamento com a opção desligada. */
conf("sem a opção, o item misto continua igual", soCompra.find((g) => g.num === "27")?.itens[0].material, 200);

/* ---- Um produto, um preço ----
   Item misto é partido em duas linhas pelo app (material + mão de obra, com
   `separadoDe` apontando pro pai). Com a mão de obra à vista, o mesmo
   produto apareceria duas vezes pro cliente aprovar: na 2498 eram 608 linhas
   onde o executivo tem 443. */
const partido = {
  categorias: [{ num: "21", nome: "Móveis Sob Medida", itens: [
    { desc: "Bancada em granito", codigo: "21.1", totalMaterial: 3500, totalMO: 0, custo: 3500, moSeparada: { valor: 1500 } },
    { desc: "Bancada em granito", codigo: "21.1-mo", totalMaterial: 0, totalMO: 1500, custo: 1500, separadoDe: { codigo: "21.1" } },
  ] }],
};
const pro = M.itensParaLiberar(partido, null, { comMaoDeObra: true });
conf("o produto partido aparece uma vez só", pro[0]?.itens.length, 1);
conf("com o preço inteiro, material + mão de obra", pro[0]?.itens[0].valor, 5000);
conf("e o total do grupo não conta em dobro", pro[0]?.totalValor, 5000);
/* Na liberação de compra a linha de mão de obra já saía pela regra de MO, e
   o pai continua valendo só o material. */
conf("na liberação de compra, o pai vale o material", M.itensParaLiberar(partido)[0]?.itens[0].material, 3500);
conf("e a linha de mão de obra não entra", M.itensParaLiberar(partido)[0]?.itens.length, 1);

/* A tela abre mostrando tudo, e não "falta aprovar" — verba com tudo
   aprovado desaparecia da tela. */
conf("a tela do cliente abre em todos", /const \[filtro, setFiltro\] = useState\("todos"\);/.test(src), true);
/* A APROVAÇÃO DO CLIENTE SAIU DE VEZ (18/09/2026). Primeiro a aba, depois os
   dois blocos que a haviam substituído — e, com eles, o portão: "o cliente
   deixa de barrar". O que ficou segurando a compra são as duas decisões
   internas: o executivo conclui, o administrador libera. */
conf("a aba Aprovação do Cliente saiu da esteira",
  /\{ id: "assinatura_cliente", label: "Aprovação do Cliente"/.test(src), false);
conf("o bloco da assinatura saiu da Conf. Executivo",
  src.includes(`titulo="Aprovação da planilha total"`), false);
conf("o da aprovação parcial também", src.includes(`titulo="Aprovação da planilha parcial"`), false);
conf("a falta do cliente não é mais pendência",
  /tipo: "cliente", texto:/.test(src), false);
conf("e o Plano de Compras não espera mais a assinatura",
  src.includes("const semAssinatura = false;"), true);

/* ---- LIBERAR O GRUPO INTEIRO ----
   Pedido dela em 17/09/2026: "colocar opcao para liberar todos para compra
   por grupo". O "Liberar N" já existia, mas só pegava o que podia — e na
   verba onde TODOS os itens estão travados pelo alerta não aparecia botão
   nenhum. Era exatamente a tela que ela estava olhando.

   O segundo botão confere o alerta no nome de quem clicou e libera. O que
   ele NÃO pode fazer nunca é varrer junto o que espera o cliente: aquilo é
   portão com justificativa, linha por linha. */
const verba = M.itensParaLiberar({
  categorias: [{ num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
    { desc: "LED FLEX 10W", codigo: "05.1", totalMaterial: 100, aprovadoCliente: { em: "x" } },
    { desc: "Mesa de apoio", codigo: "05.2", totalMaterial: 200, aprovadoCliente: { em: "x" } },
    { desc: "Mesa de centro", codigo: "05.3", totalMaterial: 300, aprovadoCliente: { em: "x" }, alertaConferido: { em: "x", por: "ana" } },
    { desc: "Fonte 12V", codigo: "05.4", totalMaterial: 400 },
    { desc: "Fita LED", codigo: "05.5", totalMaterial: 500, canalCompra: "sienge" },
  ] }],
})[0];
// O mesmo cálculo que a tela faz no cabeçalho do grupo.
const faltam = verba.itens.filter((x) => !x.liberado && x.pode);
const travadosAqui = verba.itens.filter((x) => !x.liberado && !x.pode && x.pendencia?.tipo !== "cliente");
conf("o grupo tem 5 produtos", verba.nProdutos, 5);
/* Sem o portão do cliente, o 05.4 (que só esperava o cliente) passou a poder
   ser liberado — é a mudança de 18/09/2026 aparecendo na conta. */
conf("o Liberar N pega quem já pode", faltam.map((x) => x.it.codigo).join(","), "05.1,05.3,05.4");
conf("alerta já conferido também entra no Liberar N", faltam.some((x) => x.it.codigo === "05.3"), true);
conf("travado por alerta entra no botão do alerta", travadosAqui.map((x) => x.it.codigo).join(","), "05.2");
conf("quem espera o cliente NÃO é varrido", travadosAqui.some((x) => x.it.codigo === "05.4"), false);
conf("e quem já está liberado fica fora dos dois",
  faltam.concat(travadosAqui).some((x) => x.it.codigo === "05.5"), false);
conf("os dois botões nunca pegam o mesmo item",
  faltam.some((a) => travadosAqui.some((b) => a.chave === b.chave)), false);

/* A tela: o botão existe, e a função que carimba vários chega até ela. */
conf("o botão do grupo está na tela", src.includes("Conferi os alertas · liberar {travadosAqui.length}"), true);
conf("ele confere e libera os mesmos alvos",
  /onConferirVarios\(alvos, true\);\s*\n\s*onLiberar\(alvos, true\);/.test(src), true);
conf("a função de carimbar vários existe", /function conferirAlertasEmVarios\(alvos, marcado\) \{/.test(src), true);
conf("e ela grava por patch, item a item",
  /enfileirarEmVarios\(alvos, \{ alertaConferido: carimbo \}\)/.test(src), true);
conf("o App entrega a função para a tela",
  /onConferirAlertaEmVarios=\{conferirAlertasEmVarios\}/.test(src), true);
conf("a tela repassa para a lista", /onConferirVarios=\{onConferirAlertaEmVarios\}/.test(src), true);

/* O CONTADOR DO GRUPO conta o GRUPO, não o recorte da tela.
   Com o filtro de travados ligado ela leu "13 de 8 liberados": 13 da verba
   inteira, 8 do que sobrou na tela. */
/* ADR-005: a barra do grupo passou a dizer as três contas separadas —
   quantos produtos, quantos liberados, quantos concluídos —, porque agora
   são duas decisões na mesma tela. */
conf("o contador usa os produtos do grupo",
  src.includes("{g.nProdutos ?? g.itens.length} produtos"), true);
/* OS NOMES INTEIROS E NA ORDEM DO FLUXO (pedido dela, 19/09/2026):
   "sempre colocar 'Concluido executivo' e 'Liberado para compra' mesmo aqui
   na barra. e sempre na ordem, primeiro vem o concluido e depois o liberado."
   Antes era "7 de 7 liberados · 7 concluídos": liberado na frente, os dois
   com o nome pela metade, e só um com denominador. */
conf("e diz quantos foram concluídos pelo executivo, com o nome inteiro",
  src.includes("de {compraveisDoGrupo(g).length} concluído executivo"), true);
conf("... e quantos foram liberados para compra, idem",
  src.includes("de {compraveisDoGrupo(g).length} liberado para compra"), true);
/* A ordem é a do fluxo: sem o carimbo do executivo o admin não libera, então
   ler "liberado" antes de "concluído" conta a história de trás pra frente. */
conf("o concluído vem ANTES do liberado na barra",
  src.indexOf("concluído executivo</span>") < src.indexOf("liberado para compra</span>"), true);
/* Os dois olham a MESMA lista — todo item passa pelas duas decisões,
   independente da alocação —, então os dois têm o mesmo denominador e dá
   pra comparar um com o outro de relance. */
conf("os dois contam sobre a mesma base",
  (src.match(/de \{compraveisDoGrupo\(g\)\.length\}/g) || []).length, 2);
/* "tudo que ja consta como aprovado para compra, coloque como concluido
   executivo" (18/09/2026): DEDUZIDO, não carimbado — quem foi aprovado antes
   desta coluna existir não tem como saber QUEM concluiu, e carimbar um nome
   qualquer seria inventar autor. Deduzir ainda mantém os dois totais batendo
   sem migrar dado em obra nenhuma. */
conf("aprovado para compra já conta como concluído",
  src.includes("const estaConcluido = (x) => !!x.it.concluidoExecutivo || !!x.liberado;"), true);
conf("... e a etiqueta diz de onde veio, sem inventar autor",
  src.includes(`: "Concluído porque já está aprovado para compra"`), true);
conf("... e não oferece desfazer no que não tem carimbo",
  src.includes("{podeEditar && onConcluir && x.it.concluidoExecutivo && ("), true);
conf("e o que está na tela vira um segundo número",
  src.includes("{g.itens.length} nesta busca"), true);

/* ---- ITEM SEM VALOR, MAS LIBERADO, SOBE PARA COMPRAS ----
   Decisão dela em 17/09/2026: "pode mudar a regra, item sem valor liberado
   sobe pra compras".

   A verba 33 da 2204 (Automação) mostrou o buraco: 13 itens "a orçar",
   unidade `vb`, sem material e sem MO na planilha. Sem valor,
   `alocacaoDoItem` não tem de onde deduzir o lado e devolve MAT+MO — e a
   linha ficava presa no Plano, mesmo o executivo tendo liberado.

   Duas coisas que não podem quebrar:
     1. mão de obra continua FORA das Compras (vai para Contratos);
     2. a liberação continua sendo o portão: sem valor E sem liberação, nada
        sobe. */
const semValor = {
  categorias: [{ num: "33", nome: "Automação", itens: [
    { desc: "Alexa echodot", codigo: "33.1", un: "vb", liberadoCompra: { em: "x", por: "y" } },
    { desc: "Quadro de automação", codigo: "33.2", un: "vb", canalCompra: "sienge" },
    { desc: "Programação automação", codigo: "33.3", un: "vb", alocacaoManual: "MO", liberadoCompra: { em: "x", por: "y" } },
    { desc: "Tablet iPad", codigo: "33.4", un: "vb" },
    { desc: "Switch TP-Link", codigo: "33.5", un: "vb", alocacaoManual: "MAT", liberadoCompra: { em: "x", por: "y" } },
  ] }],
};
const naCompras = M.produtosMAT(semValor).map((r) => r.it.codigo);
conf("sem valor e liberado sobe (MAT+MO)", naCompras.includes("33.1"), true);
conf("... e com canal escolhido também", naCompras.includes("33.2"), true);
conf("... e marcado como MAT, como antes", naCompras.includes("33.5"), true);
conf("MÃO DE OBRA continua fora, mesmo liberada", naCompras.includes("33.3"), false);
conf("sem liberação não sobe, com valor ou sem", naCompras.includes("33.4"), false);
conf("a verba inteira dá 3 linhas", naCompras.length, 3);
/* O valor continua sendo zero: a tela mostra "a orçar", e não um preço
   inventado. É o que faz essa linha ser justamente a que precisa de cotação. */
conf("e a linha sobe valendo zero", M.produtosMAT(semValor)[0]?.material, 0);

/* O que já tinha valor não mudou de comportamento. */
const comValor = {
  categorias: [{ num: "27", nome: "Louças", itens: [
    { desc: "Cuba", codigo: "27.1", qtdExecutivo: 1, custoMaterial: 300, liberadoCompra: { em: "x", por: "y" } },
    { desc: "Instalação", codigo: "27.2", qtdExecutivo: 1, custoMO: 200, liberadoCompra: { em: "x", por: "y" } },
  ] }],
};
const comV = M.produtosMAT(comValor).map((r) => r.it.codigo);
conf("material com valor continua subindo", comV.includes("27.1"), true);
conf("mão de obra com valor continua fora", comV.includes("27.2"), false);

/* ---- A TELA DE APROVAÇÃO DO CLIENTE (17/09/2026) ----
   Três pedidos dela no mesmo dia: os dois nomes ("Aprovação da planilha
   total" e "parcial"), a seta para abrir e fechar, e desaprovar em massa
   "assim como tem a liberacao em massa do grupo". */
/* Os dois blocos existiram por algumas horas em 18/09/2026, entre a
   aposentadoria da aba e a remoção do portão do cliente. Saíram junto com a
   regra: "retirar essa aprovacao parcial, pois a regra mudou". */
conf("nenhum bloco de aprovação do cliente sobrou",
  src.includes("Aprovação da planilha") , false);
conf("as duas abrem e fecham pela seta", /function SecaoAprovacao\(\{ titulo, sub, selo, aberta, onAlternar, children \}\)/.test(src), true);
conf("a seta troca de lado", /aberta \? <ChevronDown size=\{15\}/.test(src), true);
conf("e a assinatura não é mais registrada aqui", src.includes("assinada em {new Date(obra.clienteAssinouEm"), false);

/* Desaprovar em massa: o contrário exato do "Aprovar N", e só sobre o que
   está aprovado — nunca sobre a verba inteira. */
conf("existe desfazer em massa por grupo", /<X size=\{12\} \/> Desfazer \{aprovados\.length\}/.test(src), true);
conf("ele age só sobre os aprovados",
  src.includes("const aprovados = g.itens.filter((x) => !x.titulo && x.aprovadoCliente);"), true);
conf("... e manda desaprovar, não aprovar",
  /onAprovar\(aprovados\.map\(\(x\) => \(\{ catIdx: x\.catIdx, itemIdx: x\.itemIdx \}\)\), false\)/.test(src), true);
conf("pergunta antes, porque desfazer em massa não tem volta",
  /Desfazer a aprovação do cliente em \$\{aprovados\.length\}/.test(src), true);
conf("e some no modo leitura", src.includes("{podeEditar && aprovados.length > 0 && ("), true);
/* Título não é produto: não entra nem no aprovar nem no desaprovar. */
conf("o aprovar em massa ignora títulos", src.includes("const pendentes = g.itens.filter((x) => !x.titulo && !x.aprovadoCliente);"), true);

/* A LARGURA DA TABELA. Nestas telas a tabela é a própria `.grp-itens` — sem
   div em volta —, então a regra `.grp-itens table` nunca a alcançava e cada
   verba saía com uma largura medida pelo conteúdo. */
conf("a tabela do grupo ocupa a largura inteira", src.includes("table.grp-itens { width: 100%; table-layout: fixed; }"), true);
conf("com as colunas fixas, iguais em toda verba", src.includes("table.grp-itens th.c-qtd { width: 104px; }"), true);
conf("e solta a amarra no celular", /@media \(max-width: 760px\) \{ table\.grp-itens \{ table-layout: auto; \} \}/.test(src), true);

/* ---- ADR-005: A CONF. EXECUTIVO VIROU A PLANILHA INTEIRA (18/09/2026) ----
 *
 * "a ideia é trazer toda planilha do executivo (descricao, código/espec.,
 * fornecedor ambiente e quantidade, custo unit. e total) ... ai vamos colocar
 * uma coluna chamada: concluído executivo, aprovado para compra (somente admin
 * tem permissao para liberar)."
 */
conf("a tela pede a planilha inteira, com mão de obra",
  src.includes("itensParaLiberar(obra, entrouPorDesc, { comMaoDeObra: true })"), true);
conf("as colunas da planilha estão na tabela",
  ["Produto", "Qtd", "Custo unit.", "Total", "Concluído executivo", "Aprovado p/ compra"]
    .every((c) => src.includes(`>${c}</th>`)), true);
conf("espec., fornecedor e ambiente ficam na célula do produto",
  src.includes(`[x.it.especificacao, x.it.marca ? \`Fornecedor: \${nomeDoFornecedor(x.it)}\` : null, x.it.ambiente]`), true);

/* A COR DIZ O ESTADO: laranja quando falta olhar o alerta técnico, normal
   quando está conferido. */
/* LARANJA É O QUE PEDE CONFERÊNCIA (ajuste dela, 18/09/2026). Alerta
   técnico e "entrou sem ter sido vendido" são os dois que se resolvem com o
   "conferi" — e são eles que travam a liberação. Falta do cliente NÃO pinta:
   ela virou coluna, e repetir em cor o que a coluna diz é barulho. */
conf("linha que pede conferência sai laranja",
  src.includes(`: x.pendencia && x.pendencia.tipo !== "cliente" && !x.it.alertaConferido ? "row-alert"`), true);
conf("o aviso do cliente saiu da linha (virou coluna)",
  src.includes(`{x.pendencia && x.pendencia.tipo !== "cliente" && (`), true);

/* SÓ ADMINISTRADOR LIBERA — a mudança de regra mais sensível do ADR. */
conf("o botão de liberar exige administrador",
  src.includes("disabled={!podeEditar || !souAdmin || !x.pode}"), true);
/* A ORDEM CONTINUA (o executivo vem antes), mas o clique não pede os dois:
   "quando o usuario coloca aprovado para compra, caso o executivo nao esteja
   aprovado, ele coloca como aprovado automaticamente" (18/09/2026). Pedir os
   dois cliques era pedir para a pessoa repetir o que já decidiu. */
conf("aprovar para compra conclui o executivo junto",
  src.includes("if (faltaConcluir.length) concluirItensExecutivo(faltaConcluir, true);"), true);
conf("... só em quem ainda não tinha o carimbo",
  src.includes("?.concluidoExecutivo)") , true);
conf("... e a dica avisa que os dois saem juntos",
  src.includes(`: "Liberar para compra — marca o executivo como concluído junto"`), true);
/* Quem não pode agir vê o estado; quem pode vê o botão. */
conf("sem poder agir, a célula diz 'não aprovado'",
  src.includes("{!x.liberado && (!podeEditar || !souAdmin) ? ("), true);
conf("... e diz o motivo quando não é", src.includes(`: !souAdmin ? "Só um administrador libera a compra"`), true);
conf("o liberar em massa só aparece para admin", src.includes("{podeEditar && souAdmin && faltam.length > 0 && ("), true);
/* Os botões da verba dizem a decisão inteira, não o verbo solto (18/09/2026). */
conf("o botão da verba diz 'Liberar para compra'", src.includes("Liberar para compra {faltam.length}"), true);
conf("o 'conferi os alertas e libera' também", src.includes("{podeEditar && souAdmin && onConferirVarios && travadosAqui.length > 0 && ("), true);
conf("desfazer a liberação também", src.includes("{podeEditar && souAdmin && x.it.liberadoCompra && !x.it.comprado && ("), true);
/* Concluir NÃO é de admin: é de quem trabalha a linha. */
conf("concluir não exige admin", src.includes("{podeEditar && onConcluir && aConcluir.length > 0 && ("), true);

/* MÃO DE OBRA aparece na planilha, mas não se compra. */
/* "ta aparecendo a alocação de recurso ali (mao de obra) nao faz sentido":
   a coluna fala de compra, não de alocação — e a célula ficou vazia junto com
   o resto do que ainda não é a vez. */
conf("mão de obra não escreve alocação na coluna de compra",
  /title="Mão de obra vai para Contratos/.test(src), false);
conf("e o estilo que sobrou dela foi embora junto", src.includes(".pill-neutro {"), false);

/* UMA REGRA SÓ para "o que se compra": o cartão dizia 0/444 e o placar
   0 de 315 — dois números para a mesma pergunta na mesma tela. */
/* "todos os itens da planilha do executivo vao passar pela aprovacao
   independente da alocacao de recurso" (18/09/2026): a alocação MAT/MO deixou
   de decidir quem passa pela aprovação — só a linha de TÍTULO fica de fora.
   Mão de obra é concluída e aprovada como o resto; o que ela não faz é virar
   compra de produto, e isso é outra pergunta (`produtosMAT`). */
conf("a regra do que passa pela aprovação mora num lugar só",
  src.includes("const compraveisDoGrupo = (g) => (g.itens || []).filter((x) => !x.titulo);"), true);
conf("mão de obra também é aprovada", src.includes("falta_liberar: (x) => !x.titulo && !x.liberado,"), true);
conf("e o dinheiro passa a ser o do item inteiro",
  src.includes("compraveis(g).reduce((t, x) => t + x.valor, 0)"), true);
conf("o cartão de cima usa essa regra",
  src.includes("contador: `${gruposParaLiberar.reduce((a, g) => a + compraveisDoGrupo(g).filter((x) => x.liberado).length, 0)}"), true);
conf("e o placar da lista também", src.includes("const compraveis = compraveisDoGrupo;"), true);

/* A justificativa da remoção aparece na linha (a gravação dela é a fatia 3). */
conf("a linha removida mostra a justificativa", src.includes("Removido do executivo"), true);
conf("... e diz quando não tem", src.includes("sem justificativa registrada"), true);

/* "quando eu clico em conf executivo quero ver a listagem geral como esta
   nessa tela": a planilha é o trabalho; o depara lado a lado virou consulta. */
/* Em 19/09/2026 entrou um atalho da Visão geral que abre esta tela já
   filtrada em "falta aprovar p/ compra". Ele é EXPLÍCITO e vale uma vez: sem
   pedido, a tela continua abrindo em "todos", que é o que ela pediu. */
conf("a tela abre na listagem geral quando ninguém pede outra coisa",
  src.includes(`const [filtro, setFiltro] = useState(() => filtroInicial || telaExtra?.id || "todos");`), true);
conf("... e o padrão continua sendo 'todos'", /useState\(\(\) => [^)]*\|\| "todos"\);/.test(src), true);

/* "apresentar a linha mais fina": com 443 linhas, cada pixel custa rolagem.
   Medido na 2498 depois do ajuste: 54 px sem alerta, 71 px com (era 102). */
conf("a linha da conferência é fina", src.includes("table.tab-conf td { padding: 5px 10px;"), true);
conf("a descrição corta em duas linhas", src.includes("-webkit-line-clamp: 2"), true);
conf("... com o texto inteiro no title", src.includes(`<div className="item-desc" title={x.it.desc}>`), true);
/* "esse texto deve aparecer inteiro e nao sumir, botao de conferido no final"
   (18/09/2026): eu tinha cortado a frase com reticências para ganhar altura,
   mas ela é a razão da linha existir — diz o que conferir. Quem cede é a
   altura. */
conf("o alerta aparece inteiro", src.includes("table.tab-conf .lib-alerta > span:first-of-type { white-space: normal; overflow: visible; }"), true);
conf("... e o conferi vem no fim", src.includes("table.tab-conf .lib-alerta { margin-top: 3px; font-size: 10.5px; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;"), true);

/* ---- A CORREÇÃO DELA: DUAS COLUNAS, E SÓ (18/09/2026) ----
   "o fluxo correto é: Concuído Executivo / Aprovado para Compra / e só. o
   aprovado para compra só libera se o concluido executivo estiver aprovado."
   Eu tinha colocado três, com "Cliente" — era leitura minha, não pedido dela. */
conf("a tabela tem duas colunas de decisão", src.includes(`<th className="center c-dec">Concluído executivo</th>`), true);
conf("a coluna Cliente saiu", /<th className="center c-dec">Cliente<\/th>/.test(src), false);
/* O cliente saiu do fluxo de vez em 18/09/2026 — inclusive da dica do botão,
   que não tem mais por que citá-lo. */
conf("o cliente não aparece mais nem na dica",
  /O cliente ainda não aprovou este produto/.test(src), false);
/* Primeiro ela pediu a célula vazia ("se n ta aprovado, deixa sem nada
   preenchido"); vendo na tela, o vazio ficou demais: "aparecer nao aprovado
   clarinho". Mão de obra segue vazia — ela não é "não aprovada", ela não se
   compra. */
/* "todo campo em branco nao preenchido deve constar como nao aprovado", e
   "na mesma fonte do concluir": é etiqueta igual às outras, só que apagada. */
conf("nenhuma célula fica em branco",
  src.includes(`<span className="pill pill-nao">não aprovado</span>`), true);
conf("... e é uma etiqueta, como as vizinhas", src.includes(".pill-nao {"), true);
conf("nenhum texto avulso de espera sobrou", /aguarda o (executivo|cliente)/.test(src), false);

/* Os dois filtros do que FALTA, ao lado do "Todos" (pedido dela, 18/09/2026). */
conf("existe o filtro do que falta concluir", src.includes(`label: "Falta concluir executivo",`), true);
conf("e o botão da verba diz o mesmo", src.includes("Concluir executivo {aConcluir.length}"), true);
conf("e o do que falta aprovar para compra", src.includes(`label: "Falta aprovar p/ compra",`), true);
conf("eles usam o mesmo filtro dos cartões", src.includes("{(telaExtra?.filtros || []).map((ff) => ("), true);

/* ---- TUDO NA MESMA TELA (18/09/2026) ----
   "ai clicar no filtro conferencia tecnica, ele filtra tudo que falta
   conferencia, mas tudo na mesma tela." */
conf("o cartão peneira a planilha, não troca de lista",
  src.includes("const FILTRO_DA_PLANILHA = {"), true);
/* UMA RÉGUA SÓ (pergunta dela, 18/09/2026: "esse total que espera conferencia
   ta vindo da onde? ... devem ser a mesma regra"). Eram duas: a barra da etapa
   contava as linhas do cruzamento com alerta técnico (7 na 2498) e a lista
   contava o que trava a liberação (32). Agora as três — barra, cartão e aviso
   — saem de `precisaConferir`. */
conf("a régua de 'falta conferir' mora num lugar só",
  src.includes(`const precisaConferir = (x) => !!x.pendencia && x.pendencia.tipo !== "cliente" && !x.it.alertaConferido;`), true);
conf("o cartão conta por ela", src.includes("x.titulo && precisaConferir(x)).length, 0)}`,"), true);
/* O aviso em forma de parágrafo saiu em 18/09/2026: "retirar essa frase pois
   ja tem um filtro em cima". O cartão "Falta conferir" conta o mesmo e leva ao
   mesmo lugar — duas portas para a mesma sala, uma delas em prosa. */
conf("o aviso em parágrafo saiu da lista", /produtos esperam a conferência do alerta/.test(src), false);
conf("e o filtro que ele ligava saiu junto", src.includes("soTravados"), false);
conf("e a trava da etapa também", src.includes("if (!x.titulo && precisaConferir(x)) tecnica += 1;"), true);
conf("o filtro do cartão usa a mesma", src.includes("conferencia_tecnica: (x) => precisaConferir(x),"), true);
conf("e o filtro chega na planilha", src.includes("render: (busca, filtro) => ("), true);
/* O "Entrou, saiu ou mudou" é o único que abre painel próprio: ele fala de
   itens que nem estão na planilha do executivo (os que saíram). */
conf("o entrou/saiu mantém o painel dele", src.includes("{mostrarResumo ? <ResumoEntrouSaiu resumo={resumoEntrouSaiu} />"), true);

/* O aviso fala de conferência, então conta só conferência: ele dizia "283
   produtos esperam a conferência" numa obra onde a maioria esperava o
   cliente. Medido na 2498 depois: 32. */
/* Os cartões que ela pediu: "0 / total de itens : aprovado para compra; 0/
   total de itens: concluido executivo; o total que precisam de conferencia
   tecnica". E "aquele total conferido pode retirar, n faz sentido". */
conf("o cartão de concluído existe", src.includes(`label: "Concluído executivo",`), true);
conf("o de aprovado para compra também", src.includes(`label: "Aprovado para compra",`), true);
conf("e o de falta conferir", src.includes(`label: "Falta conferir",`), true);
conf("o cartão 'Conferido' saiu da barra", src.includes(`st !== "ok" && !m.semCartao`), true);
conf("e o placar parou de repetir os cartões", src.includes("de {fmtBRL(total)} liberados para compra"), true);

/* ---- O CÓDIGO NA FRENTE (18/09/2026) ----
   "pode trazer os códigos dos itens, pode ajudar o usuário a filtrar." */
/* "o codigo do item tem que vir antes, ali na esquerda do item, como esta na
   planilha do executivo" (18/09/2026): coluna própria, não mais dentro da
   célula do produto, onde ele se perdia entre especificação e fornecedor. */
conf("o código tem coluna própria, na esquerda", src.includes(`<th className="c-cod">Cód.</th>`), true);
conf("... e a célula vem antes do produto",
  src.includes(`<td className="mono dim c-cod">{codigoVisivel(x.it) || "—"}</td>`), true);

/* ---- SELECIONAR PARA CONCLUIR EM MASSA (18/09/2026) ---- */
conf("existe seleção por linha", src.includes(`aria-label="Selecionar linha"`), true);
conf("e pela verba inteira", src.includes(`aria-label="Selecionar a verba"`), true);
conf("a barra conclui o que está selecionado", /<Check size=\{12\} \/> Concluir \{sel\.size\}/.test(src), true);
conf("... e diz quantas ficaram fora da tela", src.includes("fora do que está na tela"), true);
conf("a seleção some no modo leitura", src.includes("{podeEditar && onConcluir && (\n                            <input type=\"checkbox\"") || src.includes(`{podeEditar && onConcluir && (`), true);
/* Título de trecho não é produto: não entra na seleção nem na conclusão. */
conf("título não entra na conclusão em massa", src.includes(".filter((x) => sel.has(x.chave) && !x.titulo)"), true);

/* O cabeçalho quebra em duas linhas: "Concluído executivo" em 104 px saía por
   cima do vizinho. */
conf("o cabeçalho da conferência pode quebrar", src.includes("table.tab-conf th { padding: 6px 10px; white-space: normal;"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
