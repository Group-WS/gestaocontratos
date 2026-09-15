/* O PDF da Gestão de compras (lib/relatorioPdf.js): nasce, pagina e diz o
 * que a tela diz — com acento, travessão e o espaço do "R$" sem derrubar
 * a geração.
 *
 * Roda com: node web/src/__testes__/relatorio-pdf.test.mjs
 */
import { PDFDocument, StandardFonts } from "pdf-lib";
import { gerarRelatorioPdf, seguro, quebrar } from "../lib/relatorioPdf.js";
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
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).slice(0, 40).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

conf("travessão, aspas e espaço do R$ viram texto que a fonte tem",
  seguro("R$ 1.234,56 — “ok”…"), 'R$ 1.234,56 - "ok"...');
const fonte = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
const partes = quebrar(fonte, 8, "https://www.mercadolivre.com.br/produto-com-um-link-enorme-sem-espaco", 60);
conf("palavra maior que a coluna é cortada, não vaza", partes.every((l) => fonte.widthOfTextAtSize(l, 8) <= 60), true);

const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const linha = (i) => ({ cod: `27.${i}`, desc: `Cuba de apoio em louça — item ${i} com descrição comprida o bastante pra quebrar em duas linhas`,
  extra: "Docol · Chroma", amb: "Banheiro suíte", qtd: "2", un: "un", vu: fmt(617.25), vt: fmt(1234.5) });
const secoes = ["#2450 · Ed. Wall Street, 602", "#2506 · Salt Praia Brava, 1401"].map((titulo) => ({
  titulo, nota: "entrega 18/12/2026", linhas: Array.from({ length: 22 }, (_, i) => linha(i + 1)), total: fmt(27159) }));
const bytes = await gerarRelatorioPdf({
  titulo: "Material a comprar", subtitulo: "27 · Louças, Metais e Equipamentos Especiais",
  meta: [[["Data", "15/09/2026"]], [["Obras", "2"], ["Itens", "44"]], [["Recorte", "todas as obras, sem recorte de prazo"]]],
  secoes, resumo: { linhas: secoes.map((s) => [s.titulo, s.total]), final: ["Total a comprar", fmt(54318)] },
  topo: LOGO_WS, rodape: RODAPE_WS,
});
conf("é um PDF", String.fromCharCode(...bytes.slice(0, 5)), "%PDF-");
const txt = await paginas(bytes);
const tudo = txt.join(" ");
conf("44 itens em mais de uma folha", txt.length > 1, true);
conf("toda folha diz o número dela", txt.every((t, i) => t.includes(`página ${i + 1} de ${txt.length}`)), true);
conf("o título e a verba estão lá", tudo.includes("Material a comprar") && tudo.includes("27 · Louças, Metais"), true);
conf("a obra que continua na outra folha avisa", tudo.includes("(CONTINUAÇÃO)"), true);
conf("cada obra fecha com o total", (tudo.match(/TOTAL DA OBRA/g) || []).length, 2);
conf("o resumo fecha com o total geral", tudo.includes("Total a comprar") && tudo.includes("R$ 54.318,00"), true);
conf("o travessão da descrição virou hífen", tudo.includes("louça - item 1"), true);

const vazio = await paginas(await gerarRelatorioPdf({ titulo: "Material a comprar", vazio: "Nada nesta verba com esse recorte." }));
conf("sem obra nenhuma: uma folha, com o aviso", vazio.length === 1 && vazio[0].includes("Nada nesta verba com esse recorte."), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
