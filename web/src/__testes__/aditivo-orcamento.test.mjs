/* O aditivo entrando no orçamento da obra.
 *
 * Roda com: node web/src/__testes__/aditivo-orcamento.test.mjs
 *
 * Aqui o documento vira DINHEIRO em três telas ao mesmo tempo: Dashboard,
 * CMV e Plano de Compras. Um erro neste arquivo não aparece como número
 * torto num lugar só — ele aparece como três telas discordando entre si,
 * que é o jeito mais rápido de a pessoa parar de confiar em todas.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const trecho = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate);
  if (i === -1 || f === -1) throw new Error(`não achei o intervalo: ${de} .. ${ate}`);
  return src.slice(i, f);
};
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

const M = eval(`(function () {
  const padraoDaDescricao = () => null;
  // A verba vem do NOME do grupo, como no app — aqui só os que os testes usam.
  const verbaPorNome = (n) => {
    const t = String(n || "").toUpperCase();
    if (t.includes("SOB MEDIDA")) return "21";
    if (t.includes("GESSO")) return "10";
    if (t.includes("ELETRO")) return "28";
    return null;
  };
  const eapPadrao = () => [];
  const parseNumAd = (v) => {
    let s = String(v ?? "").replace(/[^\\d.,-]/g, "").trim();
    if (!s) return 0;
    if (s.includes(",")) s = s.replace(/\\./g, "").replace(",", ".");
    const n = parseFloat(s); return isNaN(n) ? 0 : n;
  };
  const cent = (n) => Math.round(n * 100);
  const totalItem = (i) => cent(parseNumAd(i.qtd) * parseNumAd(i.valor)) / 100;
  const totalGrupo = (g) => (g.itens || []).reduce((a, i) => a + cent(totalItem(i)), 0) / 100;
  // O custo interno: o que a linha vale no Plano de Compras.
  const custoItem = (i) => cent(parseNumAd(i.qtd) * parseNumAd(i.custo)) / 100;
  const temCusto = (i) => parseNumAd(i.custo) > 0;
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  ${bloco("function obraComprasStats(")}
  ${bloco("function indiceRealDoItem(")}
  return { aditivosPorVerba, aditivosSemVerba, itensDeAditivo, categoriasComAditivos,
           resumoAditivos, indiceRealDoItem, obraComprasStats,
           itensParaSupressao, acharNoExecutivo };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const item = (desc, qtd, valor, alocacao = "MAT", custo = "", espec = "") =>
  ({ id: desc, descricao: desc, qtd, valor, unidade: "un", ambiente: "", alocacao, custo, espec });
const grupo = (nome, itens, verba) => ({ id: nome, num: "1", nome, itens, ...(verba ? { verba } : {}) });

const aprovado = {
  id: "a1", numero: "2405/1", status: "aprovado", descricao: "Troca da bancada",
  totalAdicao: 5000, totalSupressao: 2000,
  doc: {
    supressao: [grupo("MOVEIS SOB MEDIDA", [item("Bancada antiga", "1,00", "2.000,00")])],
    adicao: [grupo("MOVEIS SOB MEDIDA", [
      item("Bancada nova", "1,00", "5.000,00", "MAT", "3.000,00", "LACA BRANCA / 6299")])],
  },
};
const rascunho = {
  id: "a2", numero: "2405/2", status: "rascunho", descricao: "Em discussão",
  totalAdicao: 90000, totalSupressao: 0,
  doc: { supressao: [], adicao: [grupo("GESSO E DRYWALL", [item("Forro", "1,00", "90.000,00")])] },
};
const reprovado = {
  id: "a3", numero: "2405/3", status: "reprovado", descricao: "Recusado",
  totalAdicao: 70000, totalSupressao: 0,
  doc: { supressao: [], adicao: [grupo("ELETROELETRÔNICO", [item("Coifa", "1,00", "70.000,00")])] },
};
const todos = [aprovado, rascunho, reprovado];

/* ---- 1. SÓ o aprovado mexe no dinheiro ----
   É a única regra que separa documento em discussão de compromisso
   assumido, e ela precisa valer igual nas três telas. */
const porVerba = M.aditivosPorVerba(todos);
conf("só o aprovado entra", porVerba.size, 1);
conf("e na verba que o nome do grupo aponta", porVerba.has("21"), true);
conf("rascunho não entra", porVerba.has("10"), false);
conf("reprovado não entra", porVerba.has("28"), false);

const v21 = porVerba.get("21");
conf("adição do grupo", v21.adicao, 5000);
conf("supressão do grupo", v21.supressao, 2000);
conf("saldo é adição menos supressão", v21.saldo, 3000);
conf("e sabe de qual aditivo veio", [...v21.numeros].join(), "2405/1");

/* Adição e supressão ficam SEPARADAS de propósito. Elas não são a mesma
   coisa com o sinal trocado: o que foi adicionado precisa ser comprado, e
   o que foi suprimido some do escopo. */
conf("as duas parcelas continuam visíveis", `${v21.adicao}/${v21.supressao}`, "5000/2000");

/* ---- 2. Verba explícita ganha do palpite ---- */
const comVerba = { ...aprovado, id: "a9", doc: {
  supressao: [], adicao: [grupo("MOVEIS SOB MEDIDA", [item("x", "1,00", "100,00")], "10")] } };
conf("verba escolhida à mão manda", [...M.aditivosPorVerba([comVerba]).keys()].join(), "10");

/* ---- 3. Grupo sem verba não some calado ----
   Ele tem dinheiro dentro e ficaria invisível no CMV e no Plano de
   Compras — o tipo de silêncio que faz o total não fechar sem ninguém
   saber por quê. */
const semNome = { ...aprovado, id: "a8", doc: {
  supressao: [], adicao: [grupo("COISA QUE NÃO EXISTE NA EAP", [item("y", "1,00", "800,00")])] } };
conf("grupo sem verba não entra na soma", M.aditivosPorVerba([semNome]).size, 0);
const soltos = M.aditivosSemVerba([semNome]);
conf("mas é denunciado", soltos.length, 1);
conf("com o valor dele", soltos[0].valor, 800);

/* ---- 4. Só ADIÇÃO vira item comprável ----
   Supressão é escopo que saiu: ela reduz o valor da verba, mas não vira
   linha. Linha de compra negativa não existe no mundo, e alguém tentaria
   comprar. */
const itens = M.itensDeAditivo(todos);
conf("um item, e é o da adição", itens.length, 1);
conf("na verba certa", itens[0].catNum, "21");
conf("com a descrição da primeira linha", itens[0].item.desc, "Bancada nova");
/* A linha leva o CUSTO, não o preço de venda (pedido de 15/09/2026):
   comprar pelo valor do cliente faria a obra parecer gastar a margem
   inteira, e o Plano de Compras existe pra dizer o gasto. */
conf("leva o custo, não o preço de venda", itens[0].item.custo, 3000);
conf("e o material é o custo", itens[0].item.totalMaterial, 3000);
/* A especificação de compra cai no mesmo campo da planilha: é ele que a
   linha das Compras mostra, que o descritivo do Sienge lê e que o PDF por
   insumo imprime. */
conf("a especificação de compra vem junto", itens[0].item.especificacao, "LACA BRANCA / 6299");
conf("marcado com o número do aditivo", itens[0].item.aditivo, "2405/1");
// Sem código a tabela do plano repetiria a mesma chave em toda linha.
conf("tem código próprio", /^AD 2405\/1/.test(itens[0].item.codigo), true);

/* Sem custo preenchido a linha entra SEM valor, e a tabela a mostra como
   "a orçar". Repetir o preço de venda como estimativa somaria no total da
   obra um número que ninguém conferiu — e ninguém veria que era chute. */
const semCusto = [{ ...aprovado, id: "aSC", doc: { supressao: [], adicao: [
  grupo("MOVEIS SOB MEDIDA", [item("Bancada nova", "1,00", "5.000,00")])] } }];
const linhaSC = M.itensDeAditivo(semCusto)[0].item;
conf("linha sem custo entra sem valor", linhaSC.custo, null);
conf("e sem parcela nenhuma", `${linhaSC.totalMaterial}/${linhaSC.totalMO}`, "null/null");

/* ---- 5. As categorias derivadas ---- */
const categorias = [
  { num: "21", nome: "Móveis Sob Medida", itens: [{ codigo: "1", desc: "Armário", totalMaterial: 10000 }] },
  { num: "10", nome: "Gesso e Drywall", itens: [] },
];
const derivadas = M.categoriasComAditivos(categorias, todos);
conf("o item de aditivo entra no grupo dele", derivadas[0].itens.length, 2);
conf("depois dos da planilha", derivadas[0].itens[1].aditivo, "2405/1");
conf("grupo sem aditivo fica intacto", derivadas[1].itens.length, 0);
/* Derivado, NUNCA gravado: se isso entrasse em `categorias` o próximo
   salvamento gravaria o aditivo dentro da planilha, e na leitura seguinte
   ele apareceria duas vezes. */
conf("a original não é tocada", categorias[0].itens.length, 1);
conf("sem aditivo devolve a mesma lista", M.categoriasComAditivos(categorias, []) === categorias, true);

/* ---- 6. A trava que impede escrever numa linha de aditivo ----
   Os itens de aditivo entram DEPOIS dos da planilha. Um índice além do
   fim da lista real é aditivo — e ele não mora em `categorias`. */
const obraCrua = { categorias };
conf("índice da planilha passa", JSON.stringify(M.indiceRealDoItem(obraCrua, "21", 0)), '{"cat":0,"item":0}');
conf("índice do aditivo é barrado", M.indiceRealDoItem(obraCrua, "21", 1), null);
conf("verba inexistente é barrada", M.indiceRealDoItem(obraCrua, "99", 0), null);
conf("índice negativo é barrado", M.indiceRealDoItem(obraCrua, "21", -1), null);

/* ---- 7. Uma verdade só entre Plano e Dashboard ----
   O que o Plano LISTA e o que o Dashboard CONTA têm que ser a mesma
   coisa: duas telas somando bases diferentes é como a pessoa descobre
   que não pode confiar em nenhuma das duas. */
const stats = M.obraComprasStats({ categorias, aditivos: todos });
conf("o material do aditivo conta nas compras", stats.totalProdutos, 13000);
// 10.000 da planilha + 3.000 de CUSTO do aditivo — e não os 5.000 vendidos.
conf("e conta o custo, não a venda", stats.totalProdutos - 10000, 3000);
conf("linha sem custo não infla o total",
  M.obraComprasStats({ categorias, aditivos: semCusto }).totalProdutos, 10000);
conf("a verba diz quantas faltam orçar", M.aditivosPorVerba(semCusto).get("21").semCusto, 1);
conf("com custo, nada falta orçar", porVerba.get("21").semCusto, 0);

/* Item marcado como mão de obra vai pra Contratos, não pra compra. Sem o
   campo de alocação TODO item de aditivo caía em mão de obra calado, e o
   material do aditivo nunca aparecia pra comprar. */
const soMO = [{ ...aprovado, id: "aMO", doc: { supressao: [], adicao: [
  grupo("MOVEIS SOB MEDIDA", [item("Montagem", "1,00", "5.000,00", "MO", "3.000,00")])] } }];
conf("item de MO não conta nas compras", M.obraComprasStats({ categorias, aditivos: soMO }).totalProdutos, 10000);
conf("mas vira item na lista do grupo", M.categoriasComAditivos(categorias, soMO)[0].itens.length, 2);
conf("sem aditivo aprovado, só a planilha", M.obraComprasStats({ categorias, aditivos: [rascunho] }).totalProdutos, 10000);

/* ---- 8. O resumo do Dashboard ---- */
const r = M.resumoAditivos(todos);
conf("um aprovado", r.aprovados.length, 1);
conf("um em rascunho", r.pendentes.length, 1);
conf("saldo dos aprovados", r.saldo, 3000);
conf("lista vazia não quebra", M.resumoAditivos([]).saldo, 0);
conf("indefinido não quebra", M.resumoAditivos(undefined).aprovados.length, 0);

/* ---- 9. Puxar do executivo pra suprimir ----
   Supressão é remoção do que já existe. Redigitar a descrição da planilha
   abre duas portas pro erro: escrever diferente — e aí ninguém casa a
   supressão com a linha que ela tira — e errar o valor unitário. */
const doExec = [{
  num: "21", nome: "Móveis Sob Medida", itens: [
    { codigo: "1", desc: "Bancada em U com 2 gavetões", ambiente: "Cozinha",
      qtdExecutivo: 2, un: "un", totalMaterial: 9000, totalMO: 1000 },
    { codigo: "2", desc: "Painel fixado na parede", qtdExecutivo: 0, un: "vb", totalMaterial: 3000 },
    { codigo: "3", ehTitulo: true, desc: "MARCENARIA" },
    { codigo: "4", desc: "Linha zerada", qtdExecutivo: 1, totalMaterial: 0, totalMO: 0 },
  ],
}];
const achatados = M.itensParaSupressao(doExec);
conf("título de bloco não vira item", achatados.some((x) => x.desc === "MARCENARIA"), false);
conf("linha zerada não vira item", achatados.some((x) => x.desc === "Linha zerada"), false);
conf("sobram os dois com valor", achatados.length, 2);

const bancada = achatados[0];
// O valor é UNITÁRIO, que é o que a linha do aditivo pede: 10.000 / 2.
conf("valor unitário, não total", bancada.valorUnit, 5000);
conf("quantidade vem junto", bancada.qtd, 2);
conf("unidade vem junto", bancada.un, "un");
conf("ambiente vem junto", bancada.ambiente, "Cozinha");
conf("verba vem junto", bancada.catNum, "21");

/* Sem quantidade, o total É o unitário. Dividir por zero devolveria
   Infinity e a linha nasceria com valor absurdo no documento do cliente. */
const painel = achatados[1];
conf("quantidade zero não vira Infinity", painel.valorUnit, 3000);
conf("e a quantidade vira 1", painel.qtd, 1);

/* Busca sem acento e sem caixa: quem procura "bancada" tem que achar
   "BANCADA EM U" e "Bancada ilha". */
conf("acha por pedaço", M.acharNoExecutivo(achatados, "bancada").length, 1);
conf("acha sem acento", M.acharNoExecutivo(achatados, "gavetoes").length, 1);
conf("acha por duas palavras soltas", M.acharNoExecutivo(achatados, "bancada cozinha").length, 1);
conf("acha pelo ambiente", M.acharNoExecutivo(achatados, "cozinha").length, 1);
// Uma letra acharia meia planilha e a lista viraria ruído.
conf("uma letra não busca", M.acharNoExecutivo(achatados, "b").length, 0);
conf("termo vazio não busca", M.acharNoExecutivo(achatados, "").length, 0);
conf("sem executivo não quebra", M.acharNoExecutivo(undefined, "bancada").length, 0);
conf("nada casa devolve vazio", M.acharNoExecutivo(achatados, "geladeira").length, 0);

/* ---- 10. Aguardando cliente ----
   É o aditivo que já foi enviado e espera resposta. Espera não é
   compromisso: ele NÃO mexe no dinheiro, igual ao rascunho. Se contasse,
   o Dashboard passaria a somar proposta que o cliente ainda pode
   recusar. */
const aguardando = { ...aprovado, id: "a4", numero: "2405/4", status: "aguardando" };
conf("aguardando não entra na verba", M.aditivosPorVerba([aguardando]).size, 0);
conf("nem vira item comprável", M.itensDeAditivo([aguardando]).length, 0);
conf("nem mexe no total das compras",
  M.obraComprasStats({ categorias, aditivos: [aguardando] }).totalProdutos, 10000);
conf("não conta como aprovado", M.resumoAditivos([aguardando]).aprovados.length, 0);
/* Mas ele precisa APARECER: é o que está esperando resposta, e sumir do
   painel é o jeito de esquecer dele. */
conf("aparece como em aberto", M.resumoAditivos([aguardando]).pendentes.length, 1);
conf("junto com o rascunho", M.resumoAditivos([aguardando, rascunho]).pendentes.length, 2);
conf("e o reprovado continua fora", M.resumoAditivos([reprovado]).pendentes.length, 0);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
