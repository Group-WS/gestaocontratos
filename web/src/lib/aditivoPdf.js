import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { seguro, quebrar } from "./relatorioPdf.js";

/**
 * A Proposta de Aditivo como PDF de verdade.
 *
 * Antes o botão PDF abria o window.print() e a pessoa tinha que achar
 * "Salvar como PDF" — e o resultado mudava com o navegador, a margem e a
 * escala de cada um. Pedido de 24/09/2026: clicar em PDF e baixar o
 * arquivo, fiel à pré-visualização. Aqui ele nasce pronto, com texto de
 * verdade (dá pra copiar e buscar no PDF que vai ao cliente).
 *
 * Fiel à pré-visualização: as medidas, cores e corpos de letra são os do
 * bloco ".ad-page" do App.jsx, e o conteúdo chega já montado pela tela
 * (modeloDoAditivoPdf), com os mesmos filtros e o mesmo dinheiro formatado.
 * A fonte é a Helvetica: a Century Gothic do modelo não pode ser embutida.
 */

const MM = 72 / 25.4;
const LARGURA = 595.28;          // A4, em pontos
const ALTURA = 841.89;
const MARGEM = 12 * MM;          // .ad-inner: 12 mm dos lados
const AREA = LARGURA - 2 * MARGEM;

/* A paleta do papel — a mesma de estilos/papel.css (--casa-*). O pdf-lib
   desenha em RGB e não conhece os tokens do tema: o PDF é papel. */
// gate-allow DS-03: conversor do hex das cores do papel (--casa-*) para o RGB do pdf-lib
const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const VERDE = hex("#0E5F6B");         // gate-allow DS-03: --casa-verde no papel do PDF, fora do tema
const TINTA = hex("#1c2426");         // gate-allow DS-03: --casa-tinta no papel do PDF, fora do tema
const CINZA = hex("#6b7b7f");         // gate-allow DS-03: --casa-cinza no papel do PDF, fora do tema
const CINZA_CLARO = hex("#9aa7aa");   // gate-allow DS-03: --casa-cinza-claro no papel do PDF, fora do tema
const TRACO = hex("#dfe7e9");         // gate-allow DS-03: --casa-traco no papel do PDF, fora do tema
const CREDITO = hex("#1f7a54");       // gate-allow DS-03: --casa-credito no papel do PDF, fora do tema
const BRANCO = rgb(1, 1, 1);          // gate-allow DS-03: branco do papel e do texto sobre as faixas do PDF

/* Supressão sai em vinho e adição em verde, como na pré-visualização. */
const TEMAS = {
  verde: { forte: VERDE, fundo: hex("#e9f2f4"), traco: hex("#b9ccd0") },  // gate-allow DS-03: --casa-grupo-fundo/-traco no papel do PDF
  vinho: { forte: hex("#7d4038"), fundo: hex("#f4ebe9"), traco: hex("#dcc4bf") }, // gate-allow DS-03: --casa-vinho* no papel do PDF
};

// Os corpos de letra do CSS do documento, em pt.
const T = { titulo: 14, meta: 8.4, secao: 10.5, cab: 7.2, corpo: 8.4, grupo: 8, total: 9, saldo: 8.6, saldoFinal: 10, cond: 8.4, prevalencia: 6.6, pagina: 7 };
const ENTRELINHA = 1.35;
const PX = 2 * MM;
const PY = 1.6 * MM;
const MAIUSCULA = 0.72;          // Helvetica: a altura da maiúscula em relação ao corpo

/* As colunas da tabela, em mm, as mesmas de .ad-page .c-*; a descrição fica com o resto. */
const COLUNAS = [
  { rot: "Item", mm: 12 },
  { rot: "Descrição", mm: 0 },
  { rot: "Ambiente", mm: 24 },
  { rot: "Qtd", mm: 14, alinha: "dir" },
  { rot: "Un.", mm: 9, alinha: "meio" },
  { rot: "V. unit.", mm: 24, alinha: "dir" },
  { rot: "Total", mm: 27, alinha: "dir" },
];

const largura = (fonte, tam, t) => fonte.widthOfTextAtSize(seguro(t), tam);

function corpoQueCabe(fonte, tam, texto, max, minimo = 6) {
  let t = tam;
  while (t > minimo && largura(fonte, t, texto) > max) t -= 0.25;
  return t;
}

async function embutirImagem(pdf, dataUri) {
  const [cab, b64] = String(dataUri || "").split(",");
  if (!b64) return null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return /image\/png/i.test(cab) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

/* Quebra um texto de várias linhas ("\n" da descrição) respeitando a
   largura; cada linha lógica pode vir em negrito (os "chefes" do modelo). */
function quebrarParagrafos(fontes, tam, linhas, max) {
  const out = [];
  (linhas || []).forEach(({ texto, forte }) => {
    const fonte = forte ? fontes.forte : fontes.regular;
    if (!String(texto || "").trim()) { out.push({ t: "", fonte }); return; }
    quebrar(fonte, tam, texto, max).forEach((t) => out.push({ t, fonte }));
  });
  return out.length ? out : [{ t: "", fonte: fontes.regular }];
}

/**
 * @param titulo      "Proposta de Aditivo 2594/1"
 * @param meta        [["Cliente", "Cond. Vila Rica"], ["Proposta", "2594"], ["Data", "24/09/2026"]]
 * @param secoes      [{ titulo: "supressão", tema: "vinho"|"verde", total,
 *                       grupos: [{ num, nome, total, itens: [{ cod, desc: [{ texto, forte }], amb, qtd, un, vu, vt }] }] }]
 * @param vazio       o aviso quando não há seção nenhuma
 * @param saldo       { linhas: [[rótulo, valor]], final: [rótulo, valor], credito }
 * @param cond        condições de pagamento (texto livre, pode ter "\n")
 * @param prevalencia a cláusula fixa do rodapé do documento
 * @param topo        data URI da faixa da marca
 * @param rodape      data URI do rodapé
 * @returns           os bytes do PDF (Uint8Array)
 */
export async function gerarAditivoPdf({
  titulo = "", meta = [], secoes = [], vazio = "", saldo = null,
  cond = "", prevalencia = "", topo = null, rodape = null,
} = {}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(seguro(titulo));
  pdf.setCreator("Gestao de Obras TKWS");
  pdf.setProducer("Gestao de Obras TKWS");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const forte = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontes = { regular, forte };
  const faixa = await embutirImagem(pdf, topo);
  const pe = await embutirImagem(pdf, rodape);

  const hFaixa = faixa ? LARGURA * (faixa.height / faixa.width) : 0;
  const hPe = pe ? AREA * (pe.height / pe.width) : 0;
  const TOPO_1 = ALTURA - hFaixa - 7 * MM;   // 7 mm abaixo da faixa, como .ad-inner
  const TOPO_N = ALTURA - 10 * MM;           // da segunda folha em diante, a margem do papel
  /* O rodapé da marca vai no pé de TODA folha, como papel timbrado. Até
     24/09/2026 ele descia junto com as condições pro pé da última folha — e
     quando o fecho não cabia na primeira, a segunda saía em branco com só
     "Condições de pagamento" lá embaixo. */
  const BASE_PE = 10 * MM;
  const FUNDO = BASE_PE + hPe + (pe ? 8 * MM : 0);   // o conteúdo para antes do rodapé

  const larg = COLUNAS.map((c) => c.mm * MM);
  larg[1] = AREA - larg.reduce((a, b) => a + b, 0);
  const xCol = [];
  larg.reduce((x, w, i) => { xCol[i] = x; return x + w; }, MARGEM);
  const miolo = (i) => larg[i] - 2 * PX;

  const paginas = [];
  let pag = null;
  let y = 0;
  const escrever = (t, x, base, { fonte = regular, tam = T.corpo, cor = TINTA } = {}) => {
    pag.drawText(seguro(t), { x, y: base, size: tam, font: fonte, color: cor });
  };
  const direita = (t, xFim, base, o = {}) => escrever(t, xFim - largura(o.fonte || regular, o.tam || T.corpo, t), base, o);
  const noMeio = (topoCaixa, h, tam) => topoCaixa - h + (h - tam * MAIUSCULA) / 2;
  const cabe = (h) => y - h >= FUNDO;

  function novaPagina() {
    pag = pdf.addPage([LARGURA, ALTURA]);
    paginas.push(pag);
    if (pe) pag.drawImage(pe, { x: MARGEM, y: BASE_PE, width: AREA, height: hPe });
    if (paginas.length === 1) {
      if (faixa) pag.drawImage(faixa, { x: 0, y: ALTURA - hFaixa, width: LARGURA, height: hFaixa });
      y = TOPO_1;
    } else {
      // Da segunda folha em diante, uma linha diz de que proposta ela é.
      escrever(titulo, MARGEM, TOPO_N - T.pagina, { tam: T.pagina, cor: CINZA });
      y = TOPO_N - T.pagina - 4 * MM;
    }
  }

  // ---------- o cabeçalho: título à esquerda, os dados à direita, a régua verde ----------
  novaPagina();
  const ENTRE_META = T.meta + 1.2 * MM;
  const hMeta = meta.length ? (meta.length - 1) * ENTRE_META + T.meta : 0;
  const baseFim = y - Math.max(hMeta, T.titulo);        // alinhados pelo pé (align-items: flex-end)
  escrever(titulo, MARGEM, baseFim, { fonte: forte, tam: T.titulo, cor: VERDE });
  meta.forEach(([rot, val], i) => {
    const base = baseFim + (meta.length - 1 - i) * ENTRE_META;
    const v = seguro(val || "—");
    const r = seguro(`${rot}: `);
    const xV = MARGEM + AREA - largura(regular, T.meta, v);
    escrever(v, xV, base, { tam: T.meta });
    escrever(r, xV - largura(regular, T.meta, r), base, { tam: T.meta, cor: CINZA });
  });
  const yRegua = baseFim - 3 * MM;
  pag.drawLine({ start: { x: MARGEM, y: yRegua }, end: { x: MARGEM + AREA, y: yRegua }, thickness: 1.5, color: VERDE });
  y = yRegua - 5 * MM;

  // ---------- as seções: supressão e adição ----------
  const H_TITULO = T.secao + 2 * MM;
  const H_CAB = T.cab + 2 * 1.8 * MM;
  const H_GRUPO = T.grupo + 2 * PY;
  const H_TOTAL = T.total + 2 * PY;

  function tituloDaSecao(s, tema, continua) {
    const base = y - T.secao;
    const t = seguro(`${s.titulo}${continua ? " (continuação)" : ""}`.toUpperCase());
    escrever(t, MARGEM, base, { fonte: forte, tam: T.secao, cor: tema.forte });
    const x = MARGEM + largura(forte, T.secao, t) + 3 * MM;
    const meio = base + T.secao * 0.33;
    pag.drawLine({ start: { x, y: meio }, end: { x: MARGEM + AREA, y: meio }, thickness: 1.4, color: tema.forte, opacity: 0.25 });
    y -= H_TITULO + 2 * MM;
  }

  function cabecalhoDaTabela(tema) {
    pag.drawRectangle({ x: MARGEM, y: y - H_CAB, width: AREA, height: H_CAB, color: tema.forte });
    const base = noMeio(y, H_CAB, T.cab);
    COLUNAS.forEach((c, i) => {
      const rot = seguro(c.rot.toUpperCase());
      const w = largura(forte, T.cab, rot);
      const x = c.alinha === "dir" ? xCol[i] + larg[i] - PX - w
        : c.alinha === "meio" ? xCol[i] + (larg[i] - w) / 2 : xCol[i] + PX;
      escrever(rot, x, base, { fonte: forte, tam: T.cab, cor: BRANCO });
      if (i < COLUNAS.length - 1) {
        pag.drawLine({ start: { x: xCol[i] + larg[i], y: y - H_CAB }, end: { x: xCol[i] + larg[i], y },
          thickness: 0.6, color: BRANCO, opacity: 0.25 });
      }
    });
    y -= H_CAB;
  }

  function linhaDeGrupo(g, tema) {
    pag.drawRectangle({ x: MARGEM, y: y - H_GRUPO, width: AREA, height: H_GRUPO, color: tema.fundo });
    pag.drawLine({ start: { x: MARGEM, y }, end: { x: MARGEM + AREA, y }, thickness: 0.85, color: tema.traco });
    pag.drawLine({ start: { x: MARGEM, y: y - H_GRUPO }, end: { x: MARGEM + AREA, y: y - H_GRUPO }, thickness: 0.85, color: tema.traco });
    const base = noMeio(y, H_GRUPO, T.grupo);
    const o = { fonte: forte, tam: T.grupo };
    escrever(g.num, xCol[0] + PX, base, o);
    const v = seguro(g.total);
    const maxNome = xCol[6] + larg[6] - PX - largura(forte, T.grupo, v) - 4 * MM - (xCol[1] + PX);
    escrever(quebrar(forte, T.grupo, String(g.nome || "").toUpperCase(), maxNome)[0], xCol[1] + PX, base, o);
    direita(v, xCol[6] + larg[6] - PX, base, o);
    y -= H_GRUPO;
  }

  function medir(it) {
    const desc = quebrarParagrafos(fontes, T.corpo, it.desc, miolo(1));
    const amb = quebrar(regular, T.corpo, it.amb, miolo(2));
    const h = Math.max(desc.length, amb.length, 1) * T.corpo * ENTRELINHA + 2 * PY;
    return { desc, amb, h };
  }

  function linhaDeItem(it, m) {
    const topoL = y;
    const primeira = topoL - PY - T.corpo * 0.85;
    const passo = T.corpo * ENTRELINHA;
    escrever(it.cod, xCol[0] + PX, primeira);
    m.desc.forEach((l, k) => escrever(l.t, xCol[1] + PX, primeira - k * passo, { fonte: l.fonte }));
    m.amb.forEach((t, k) => escrever(t, xCol[2] + PX, primeira - k * passo));
    [["qtd", 3], ["un", 4], ["vu", 5], ["vt", 6]].forEach(([chave, i]) => {
      const t = seguro(it[chave]);
      const tam = corpoQueCabe(regular, T.corpo, t, miolo(i));
      const w = largura(regular, tam, t);
      const x = COLUNAS[i].alinha === "meio" ? xCol[i] + (larg[i] - w) / 2 : xCol[i] + larg[i] - PX - w;
      pag.drawText(t, { x, y: primeira, size: tam, font: regular, color: TINTA });
    });
    pag.drawLine({ start: { x: MARGEM, y: topoL - m.h }, end: { x: MARGEM + AREA, y: topoL - m.h }, thickness: 0.85, color: TRACO });
    y -= m.h;
  }

  function linhaDeTotal(s, tema) {
    pag.drawRectangle({ x: MARGEM, y: y - H_TOTAL, width: AREA, height: H_TOTAL, color: tema.forte });
    const base = noMeio(y, H_TOTAL, T.total);
    const o = { fonte: forte, tam: T.total, cor: BRANCO };
    escrever(`TOTAL ${String(s.titulo).toUpperCase()}`, MARGEM + PX, base, o);
    direita(s.total, MARGEM + AREA - PX, base, o);
    y -= H_TOTAL;
  }

  if (!secoes.length && vazio) {
    const linhas = quebrar(regular, 9, vazio, AREA - 16 * MM);
    const h = linhas.length * 9 * ENTRELINHA + 16 * MM;
    pag.drawRectangle({ x: MARGEM, y: y - h, width: AREA, height: h, borderColor: TEMAS.verde.traco, borderWidth: 0.8, borderDashArray: [3, 2] });
    linhas.forEach((l, k) => {
      const w = largura(regular, 9, l);
      escrever(l, MARGEM + (AREA - w) / 2, y - 8 * MM - 9 * 0.85 - k * 9 * ENTRELINHA, { tam: 9, cor: CINZA });
    });
    y -= h + 5 * MM;
  }

  secoes.forEach((s) => {
    const tema = TEMAS[s.tema] || TEMAS.verde;
    const continuar = () => { novaPagina(); tituloDaSecao(s, tema, true); cabecalhoDaTabela(tema); };
    const primeiro = s.grupos[0];
    const m0 = primeiro?.itens[0] ? medir(primeiro.itens[0]).h : 0;
    // O título não fica sozinho no pé da folha: vai junto com o cabeçalho, o primeiro grupo e o primeiro item.
    if (!cabe(H_TITULO + 2 * MM + H_CAB + H_GRUPO + m0)) novaPagina();
    tituloDaSecao(s, tema, false);
    cabecalhoDaTabela(tema);
    s.grupos.forEach((g, gi) => {
      const medidas = g.itens.map(medir);
      // O grupo não fica sozinho no pé da folha: desce com o primeiro item.
      if (!cabe(H_GRUPO + (medidas[0]?.h || 0))) continuar();
      linhaDeGrupo(g, tema);
      medidas.forEach((m, k) => {
        // O último item da seção não se separa do total.
        const ultimo = gi === s.grupos.length - 1 && k === medidas.length - 1;
        if (!cabe(m.h + (ultimo ? H_TOTAL : 0))) continuar();
        linhaDeItem(g.itens[k], m);
      });
    });
    if (!cabe(H_TOTAL)) continuar();
    linhaDeTotal(s, tema);
    y -= 5 * MM;
  });

  // ---------- o saldo: a caixa de 92 mm à direita ----------
  if (saldo) {
    const L = 92 * MM;
    const x0 = MARGEM + AREA - L;
    const hL = T.saldo + 2 * 1.8 * MM;
    const hF = T.saldoFinal + 2 * 2.6 * MM;
    const h = saldo.linhas.length * hL + hF;
    if (!cabe(h + 2 * MM)) novaPagina();
    y -= 2 * MM;
    const topoCaixa = y;
    saldo.linhas.forEach(([rot, val]) => {
      const base = noMeio(y, hL, T.saldo);
      escrever(rot, x0 + 3 * MM, base, { tam: T.saldo });
      direita(val, x0 + L - 3 * MM, base, { fonte: forte, tam: T.saldo });
      pag.drawLine({ start: { x: x0, y: y - hL }, end: { x: x0 + L, y: y - hL }, thickness: 0.85, color: TRACO });
      y -= hL;
    });
    pag.drawRectangle({ x: x0, y: y - hF, width: L, height: hF, color: saldo.credito ? CREDITO : VERDE });
    const [rotF, valF] = saldo.final;
    const baseF = noMeio(y, hF, T.saldoFinal);
    const o = { fonte: forte, tam: T.saldoFinal, cor: BRANCO };
    escrever(rotF, x0 + 3 * MM, baseF, o);
    direita(valF, x0 + L - 3 * MM, baseF, o);
    y -= hF;
    pag.drawRectangle({ x: x0, y, width: L, height: topoCaixa - y, borderColor: VERDE, borderWidth: 1.1 });
  }

  // ---------- o fecho: condições e cláusula, logo depois do saldo, sem se partir ----------
  const condLinhas = String(cond || "").trim()
    ? String(cond).split("\n").flatMap((l) => (l.trim() ? quebrar(regular, T.cond, l, AREA) : [""]))
    : [];
  const prevLinhas = prevalencia ? quebrar(regular, T.prevalencia, prevalencia, AREA) : [];
  const hCond = condLinhas.length ? T.cond + 1.5 * MM + condLinhas.length * T.cond * ENTRELINHA : 0;
  const passoPrev = T.prevalencia * 1.45;
  const hPrev = prevLinhas.length ? (condLinhas.length ? 6 * MM : 0) + prevLinhas.length * passoPrev : 0;
  const hFecho = hCond + hPrev;
  if (hFecho) {
    if (!cabe(hFecho + 7 * MM)) novaPagina();
    else y -= 7 * MM;            // .ad-cond: 7 mm depois do saldo
  }

  if (condLinhas.length) {
    escrever("CONDIÇÕES DE PAGAMENTO:", MARGEM, y - T.cond * 0.85, { fonte: forte, tam: T.cond, cor: VERDE });
    y -= T.cond + 1.5 * MM;
    condLinhas.forEach((l) => { escrever(l, MARGEM, y - T.cond * 0.85, { tam: T.cond }); y -= T.cond * ENTRELINHA; });
  }
  if (prevLinhas.length) {
    if (condLinhas.length) y -= 6 * MM;
    prevLinhas.forEach((l) => { escrever(l, MARGEM, y - T.prevalencia * 0.85, { tam: T.prevalencia, cor: CINZA_CLARO }); y -= passoPrev; });
  }

  // ---------- o número da folha, só quando há mais de uma ----------
  if (paginas.length > 1) {
    paginas.forEach((p, i) => {
      const t = `página ${i + 1} de ${paginas.length}`;
      p.drawText(t, { x: MARGEM + AREA - largura(regular, T.pagina, t), y: BASE_PE + hPe + 3 * MM, size: T.pagina, font: regular, color: CINZA });
    });
  }

  return pdf.save();
}
