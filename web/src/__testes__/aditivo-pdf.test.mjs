/* O PDF da Proposta de Aditivo (lib/aditivoPdf.js): nasce, diz o que a
 * pré-visualização diz, pagina quando o aditivo é comprido e não derruba a
 * geração com acento, travessão ou o espaço do "R$".
 *
 * Roda com: node web/src/__testes__/aditivo-pdf.test.mjs
 */
import { gerarAditivoPdf } from "../lib/aditivoPdf.js";
import { LOGO_WS, RODAPE_WS } from "../lib/marcaWS.js";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
async function paginas(bytes) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0, disableFontFace: true }).promise;
  const txt = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const c = await (await doc.getPage(i)).getTextContent();
    txt.push(c.items.map((x) => x.str).join(" ").replace(/\s+/g, " "));
  }
  return txt;
}

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${String(o).slice(0, 40).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const item = (g, i, desc) => ({ cod: `${g}.${i}`, desc: [{ texto: desc, forte: false }], amb: "BWC Master",
  qtd: "2,00", un: "un", vu: fmt(4300), vt: fmt(8600) });
const base = {
  titulo: "Proposta de Aditivo 2594/1",
  meta: [["Cliente", "Cond. Vila Rica"], ["Proposta", "2594"], ["Data", "24/09/2026"]],
  saldo: { linhas: [["Total supressão", fmt(22410)], ["Total adição", fmt(14000)]], final: ["Crédito gerado do aditivo", fmt(-8410)], credito: true },
  cond: "Esta proposta é válida por 10 dias.",
  prevalencia: "As alterações deste aditivo substituem e alteram diretamente o que havia sido aprovado anteriormente.",
  topo: LOGO_WS, rodape: RODAPE_WS,
};

// Uma folha: o caso da tela.
const curto = await gerarAditivoPdf({ ...base, secoes: [
  { titulo: "supressão", tema: "vinho", total: fmt(22410), grupos: [
    { num: "1", nome: "Louças, Metais e Equipamentos Especiais", total: fmt(12980), itens: [item(1, 1, "Chuveiro R300 De Teto Docoleden Cromado")] },
  ] },
  { titulo: "adição", tema: "verde", total: fmt(14000), grupos: [
    { num: "1", nome: "Louças e Metais", total: fmt(14000), itens: [item(1, 1, "Vasos inteligêntes — “smart”…")] },
  ] },
] });
const t1 = await paginas(curto);
conf("aditivo curto cabe numa folha", t1.length, 1);
conf("título e cliente", /Proposta de Aditivo 2594\/1/.test(t1[0]) && /Cond\. Vila Rica/.test(t1[0]), true);
conf("as duas seções, com o total de cada uma", /SUPRESSÃO/.test(t1[0]) && /TOTAL ADIÇÃO/.test(t1[0]), true);
conf("grupo em maiúsculas com o total", /LOUÇAS, METAIS E EQUIPAMENTOS ESPECIAIS/.test(t1[0]), true);
conf("acento e travessão viram texto que a fonte tem", /Vasos inteligêntes - "smart"\.\.\./.test(t1[0]), true);
conf("saldo com o rótulo de crédito", /Crédito gerado do aditivo/.test(t1[0]), true);
conf("condições e cláusula de prevalência", /CONDIÇÕES DE PAGAMENTO/.test(t1[0]) && /substituem e alteram/.test(t1[0]), true);
conf("uma folha só não leva número de página", /página 1 de/.test(t1[0]), false);

// Comprido: pagina, e o fecho vai para a última folha.
const muitos = Array.from({ length: 70 }, (_, i) => item(1, i + 1, `Item ${i + 1} com descrição comprida o bastante para quebrar em duas linhas na coluna da tabela`));
const longo = await gerarAditivoPdf({ ...base, secoes: [
  { titulo: "adição", tema: "verde", total: fmt(1), grupos: [{ num: "1", nome: "Louças e Metais", total: fmt(1), itens: muitos }] },
] });
const t2 = await paginas(longo);
conf("aditivo comprido pagina", t2.length > 1, true);
conf("toda folha é numerada", t2.every((t, i) => t.includes(`página ${i + 1} de ${t2.length}`)), true);
conf("folha seguinte diz de que proposta é", /Proposta de Aditivo 2594\/1/.test(t2[1]), true);
conf("tabela continua com o cabeçalho", /ADIÇÃO \(CONTINUAÇÃO\)/.test(t2[1]), true);
conf("nenhum item se perde entre as folhas", muitos.every((it) => t2.join(" ").includes(`Item ${it.cod.split(".")[1]} com`)), true);
conf("o fecho fica na última folha", /CONDIÇÕES DE PAGAMENTO/.test(t2.at(-1)) && !/CONDIÇÕES DE PAGAMENTO/.test(t2[0]), true);

conf("condições não ficam sozinhas: saldo vem junto na mesma folha", /Crédito gerado do aditivo/.test(t2.at(-1)), true);

// Sem nada preenchido: sai o aviso, como na tela.
const vazio = await paginas(await gerarAditivoPdf({ ...base, secoes: [], vazio: "Preencha ao menos um grupo com itens." }));
conf("sem grupos, o aviso da pré-visualização", /Preencha ao menos um grupo/.test(vazio[0]), true);

console.log(f ? `\n${f} falha(s)` : "\ntudo certo");
process.exit(f ? 1 : 0);
