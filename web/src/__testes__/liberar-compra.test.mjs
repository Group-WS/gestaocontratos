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

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
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

/* ---- 3. O cliente, que vem antes do executivo ----
   A corrente: o cliente aprova o item, o executivo libera, o item entra
   nas Compras. */
const semAssinatura = {};
const assinada = { clienteAssinouEm: "2026-09-10" };
/* A assinatura geral aprova TUDO (decisão dela, 16/09): sem isso, ligar a
   regra travaria toda obra que já assinou. */
conf("assinatura geral aprova qualquer item", M.aprovadoPeloCliente({ desc: "Cuba" }, assinada), true);
conf("sem assinatura, item novo não está aprovado", M.aprovadoPeloCliente({ desc: "Cuba" }, semAssinatura), false);
conf("aprovação parcial no item vale", M.aprovadoPeloCliente({ aprovadoCliente: { em: "x" } }, semAssinatura), true);
conf("a exceção justificada também", M.aprovadoPeloCliente({ liberadoSemCliente: { motivo: "por e-mail" } }, semAssinatura), true);

const semCliente = { semCliente: true };
conf("falta do cliente é a pendência", M.pendenciaParaLiberar(semAlerta, semCliente).tipo, "cliente");
/* O cliente ganha do alerta técnico na ordem: sem ele, conferir medida
   não adianta — o produto não pode ser comprado de jeito nenhum. */
conf("o cliente vem antes do alerta técnico", M.pendenciaParaLiberar(comAlerta, semCliente).tipo, "cliente");
conf("sem cliente não libera", M.podeLiberarItem(semAlerta, semCliente), false);
/* E marcar "conferi" NÃO resolve a falta do cliente: são coisas
   diferentes, de gente diferente. */
conf("conferir o alerta não substitui o cliente",
  M.podeLiberarItem({ ...comAlerta, alertaConferido: { por: "eu" } }, semCliente), false);
conf("com o cliente e o alerta conferido, libera",
  M.podeLiberarItem({ ...comAlerta, alertaConferido: { por: "eu" } }, { entrou: false }), true);

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

/* A obra do teste não tem assinatura, então tudo espera o cliente — e é
   isso que trava a liberação, antes mesmo do alerta. */
conf("sem assinatura, nada está aprovado pelo cliente", g[0].aprovados, 0);
/* "pode" olha quem AINDA NAO foi liberado: a cuba já liberada continua
   podendo, porque ela já está no fluxo de compras. */
conf("nada que falta liberar consegue passar", g[0].itens.filter((x) => !x.liberado && x.pode).length, 0);
conf("a pendência da cuba é o cliente", g[0].itens[1].pendencia.tipo, "cliente");

const comAssinatura = M.itensParaLiberar({ ...obra, clienteAssinouEm: "2026-09-10" });
conf("com a assinatura, todos aprovados", comAssinatura[0].aprovados, 2);
conf("a cuba já liberada continua liberada", comAssinatura[0].itens[1].liberado, true);
conf("e a mesa volta a travar só pelo alerta", comAssinatura[0].itens[0].pendencia.tipo, "tecnica");

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

/* A tela abre mostrando tudo, e não "falta aprovar" — verba com tudo
   aprovado desaparecia da tela. */
conf("a tela do cliente abre em todos", /const \[filtro, setFiltro\] = useState\("todos"\);/.test(src), true);
conf("e pede a lista com mão de obra", /itensParaLiberar\(obraComAditivos, null, \{ comMaoDeObra: true \}\)/.test(src), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
