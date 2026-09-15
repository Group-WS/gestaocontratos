import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * O relatório da Gestão de compras como PDF de verdade.
 *
 * Antes era o window.print(): abria a caixa de impressão e a pessoa ainda
 * tinha que achar "Salvar como PDF" (pedido de 15/09/2026: ver o PDF e já
 * baixar o arquivo). Aqui o arquivo nasce pronto, com texto de verdade (dá
 * pra copiar e buscar), no papel dos relatórios: a faixa da marca no topo,
 * uma tabela por obra, o resumo no fim e o rodapé, em A4.
 *
 * Recebe tudo já em texto: dinheiro e data a tela já sabe formatar, e o PDF
 * tem que dizer o mesmo que ela. Aqui é só papel.
 */

const MM = 72 / 25.4;
const LARGURA = 595.28;          // A4, em pontos
const ALTURA = 841.89;
const MARGEM = 12 * MM;          // a mesma margem do relatório na tela
const AREA = LARGURA - 2 * MARGEM;

const VERDE = rgb(14 / 255, 95 / 255, 107 / 255);     // #0E5F6B, o verde dos relatórios
const TINTA = rgb(28 / 255, 36 / 255, 38 / 255);      // #1c2426
const CINZA = rgb(107 / 255, 123 / 255, 127 / 255);   // #6b7b7f
const TRACO = rgb(223 / 255, 231 / 255, 233 / 255);   // #dfe7e9
const BRANCO = rgb(1, 1, 1);
const AVISO = rgb(249 / 255, 243 / 255, 230 / 255);
const AVISO_BORDA = rgb(230 / 255, 204 / 255, 153 / 255);

const T = { titulo: 15, sub: 10.5, meta: 8, secao: 9.5, cab: 6.8, corpo: 8, cod: 7.4, extra: 7, total: 8.5, resumo: 8.6, final: 10, pagina: 7 };
const ENTRELINHA = 1.25;
const PX = 2 * MM;               // o respiro das células, como na tela
const PY = 1.6 * MM;
const MAIUSCULA = 0.72;          // Helvetica: a altura da maiúscula em relação ao corpo

/* As colunas da tabela, em mm, as mesmas da tela; a descrição fica com o resto. */
const COLUNAS = [
  { chave: "cod", rot: "Cód.", mm: 12 },
  { chave: "desc", rot: "Descrição", mm: 0 },
  { chave: "amb", rot: "Ambiente", mm: 24 },
  { chave: "qtd", rot: "Qtd.", mm: 14, alinha: "dir" },
  { chave: "un", rot: "Un.", mm: 9, alinha: "meio" },
  { chave: "vu", rot: "Valor unit.", mm: 24, alinha: "dir" },
  { chave: "vt", rot: "Valor total", mm: 27, alinha: "dir" },
];

/* A fonte padrão do pdf-lib (WinAnsi) não tem todo caractere que o
   português escreve: travessão, aspas curvas e o espaço fino do "R$"
   derrubam a geração inteira com "cannot encode". A mesma troca do PDF da
   apresentação. */
export function seguro(t) {
  return String(t == null ? "" : t)
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[    ]/g, " ")
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, "");
}

const largura = (fonte, tam, t) => fonte.widthOfTextAtSize(t, tam);

/* Quebra em linhas que cabem na largura. Palavra maior que a linha (código
   comprido, link) é cortada no meio em vez de vazar pra coluna do lado. */
export function quebrar(fonte, tam, texto, max) {
  const linhas = [];
  let atual = "";
  seguro(texto).split(/\s+/).filter(Boolean).forEach((palavra) => {
    let p = palavra;
    while (p.length > 1 && largura(fonte, tam, p) > max) {
      let k = p.length - 1;
      while (k > 1 && largura(fonte, tam, p.slice(0, k)) > max) k -= 1;
      if (atual) { linhas.push(atual); atual = ""; }
      linhas.push(p.slice(0, k));
      p = p.slice(k);
    }
    const junto = atual ? `${atual} ${p}` : p;
    if (largura(fonte, tam, junto) <= max) atual = junto;
    else { if (atual) linhas.push(atual); atual = p; }
  });
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [""];
}

function truncar(fonte, tam, texto, max) {
  const t = seguro(texto);
  if (largura(fonte, tam, t) <= max) return t;
  let c = t;
  while (c.length > 1 && largura(fonte, tam, `${c}...`) > max) c = c.slice(0, -1);
  return `${c.trimEnd()}...`;
}

// Número que não cabe encolhe um pouco, em vez de invadir a coluna do lado.
function corpoQueCabe(fonte, tam, texto, max, minimo = 6) {
  let t = tam;
  while (t > minimo && largura(fonte, t, texto) > max) t -= 0.25;
  return t;
}

/* A marca chega como data URI (lib/marcaWS.js): a faixa do topo em JPEG e o
   rodapé em PNG. Sem ela o relatório sai do mesmo jeito. */
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

/**
 * @param titulo     "Material a comprar"
 * @param subtitulo  "27 · Louças, Metais e Equipamentos Especiais"
 * @param meta       as linhas do canto direito, cada uma com pares [rótulo, valor]:
 *                   [[["Data", "15/09/2026"]], [["Obras", "3"], ["Itens", "45"]], [["Recorte", "..."]]]
 * @param secoes     [{ titulo, nota, linhas: [{ cod, desc, extra, amb, qtd, un, vu, vt }], total, rotuloTotal }]
 * @param resumo     { linhas: [[rótulo, valor]], final: [rótulo, valor] }
 * @param vazio      o aviso quando não há seção nenhuma
 * @param topo       data URI da faixa da marca
 * @param rodape     data URI do rodapé
 * @returns          os bytes do PDF (Uint8Array)
 */
export async function gerarRelatorioPdf({
  titulo = "", subtitulo = "", meta = [], secoes = [], resumo = null,
  vazio = "Nada neste recorte.", topo = null, rodape = null,
} = {}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(seguro([titulo, subtitulo].filter(Boolean).join(" - ")));
  pdf.setCreator("Gestao de Obras TKWS");
  pdf.setProducer("Gestao de Obras TKWS");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const forte = await pdf.embedFont(StandardFonts.HelveticaBold);
  const faixa = await embutirImagem(pdf, topo);
  const pe = await embutirImagem(pdf, rodape);

  const hFaixa = faixa ? LARGURA * (faixa.height / faixa.width) : 0;
  const hPe = pe ? AREA * (pe.height / pe.width) : 0;
  const BASE_PE = 8 * MM;
  const TOPO = ALTURA - hFaixa - 7 * MM;      // 7 mm abaixo da faixa, como na tela
  const FUNDO = BASE_PE + hPe + 9 * MM;      // o conteúdo para antes do número da página e do rodapé

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
  const noMeio = (topoCaixa, h, tam) => topoCaixa - h + (h - tam * MAIUSCULA) / 2;
  const cabe = (h) => y - h >= FUNDO;

  function novaPagina() {
    pag = pdf.addPage([LARGURA, ALTURA]);
    paginas.push(pag);
    if (faixa) pag.drawImage(faixa, { x: 0, y: ALTURA - hFaixa, width: LARGURA, height: hFaixa });
    if (pe) pag.drawImage(pe, { x: MARGEM, y: BASE_PE, width: AREA, height: hPe });
    y = TOPO;
    // Da segunda folha em diante, uma linha diz de que relatório ela é.
    if (paginas.length > 1) {
      escrever(truncar(regular, T.meta, [titulo, subtitulo].filter(Boolean).join(" · "), AREA), MARGEM, y - T.meta, { tam: T.meta, cor: CINZA });
      y -= T.meta + 4 * MM;
    }
  }

  // ---------- o cabeçalho: título à esquerda, os dados à direita, a régua verde ----------
  novaPagina();
  const largMeta = Math.min(92 * MM, AREA * 0.5);
  const largTitulo = AREA - largMeta - 8 * MM;
  let yT = y - T.titulo;
  let fundoTitulo = yT;
  quebrar(forte, T.titulo, titulo, largTitulo).forEach((l) => {
    escrever(l, MARGEM, yT, { fonte: forte, tam: T.titulo, cor: VERDE });
    fundoTitulo = yT; yT -= T.titulo * 1.15;
  });
  if (subtitulo) {
    yT = fundoTitulo - T.sub * 1.6;
    quebrar(forte, T.sub, subtitulo, largTitulo).forEach((l) => {
      escrever(l, MARGEM, yT, { fonte: forte, tam: T.sub });
      fundoTitulo = yT; yT -= T.sub * 1.3;
    });
  }

  const SEP = "  ·  ";
  const ENTRE_META = T.meta * 1.55;
  let yM = y - T.meta;
  let fundoMeta = yM;
  meta.forEach((pares) => {
    const partes = (pares || []).map(([rot, val]) => ({ rot: seguro(`${rot}: `), val: seguro(val) }));
    const total = partes.reduce((a, p, k) => a + largura(regular, T.meta, p.rot) + largura(regular, T.meta, p.val)
      + (k ? largura(regular, T.meta, SEP) : 0), 0);
    if (partes.length === 1 && total > largMeta) {
      // Valor comprido (o recorte): quebra embaixo, alinhado à direita, com o rótulo na primeira linha.
      const { rot, val } = partes[0];
      quebrar(regular, T.meta, val, largMeta - largura(regular, T.meta, rot)).forEach((l, i) => {
        const x = MARGEM + AREA - largura(regular, T.meta, l);
        if (i === 0) escrever(rot, x - largura(regular, T.meta, rot), yM, { tam: T.meta, cor: CINZA });
        escrever(l, x, yM, { tam: T.meta });
        fundoMeta = yM; yM -= ENTRE_META;
      });
      return;
    }
    let x = MARGEM + AREA - total;
    partes.forEach((p, k) => {
      if (k) { escrever(SEP, x, yM, { tam: T.meta, cor: CINZA }); x += largura(regular, T.meta, SEP); }
      escrever(p.rot, x, yM, { tam: T.meta, cor: CINZA }); x += largura(regular, T.meta, p.rot);
      escrever(p.val, x, yM, { tam: T.meta }); x += largura(regular, T.meta, p.val);
    });
    fundoMeta = yM; yM -= ENTRE_META;
  });
  const yRegua = Math.min(fundoTitulo, fundoMeta) - 3.2 * MM;
  pag.drawLine({ start: { x: MARGEM, y: yRegua }, end: { x: MARGEM + AREA, y: yRegua }, thickness: 1.5, color: VERDE });
  y = yRegua - 5 * MM;

  // ---------- uma seção por obra ----------
  const H_TITULO = T.secao + 3 * MM;
  const H_CAB = T.cab + 2 * 1.8 * MM;
  const H_TOTAL = T.total + 2 * 2 * MM;

  function tituloDaSecao(s, continua) {
    const base = y - T.secao;
    const t = truncar(forte, T.secao, `${s.titulo || ""}${continua ? " (continuação)" : ""}`.toUpperCase(), AREA * 0.72);
    escrever(t, MARGEM, base, { fonte: forte, tam: T.secao, cor: VERDE });
    let x = MARGEM + largura(forte, T.secao, t) + 2 * MM;
    if (s.nota && !continua) {
      const n = seguro(s.nota);
      escrever(n, x, base, { tam: T.extra, cor: CINZA });
      x += largura(regular, T.extra, n) + 2 * MM;
    }
    const meio = base + T.secao * 0.33;
    if (x < MARGEM + AREA) {
      pag.drawLine({ start: { x, y: meio }, end: { x: MARGEM + AREA, y: meio }, thickness: 1.4, color: VERDE, opacity: 0.25 });
    }
    y -= H_TITULO;
  }

  function cabecalhoDaTabela() {
    pag.drawRectangle({ x: MARGEM, y: y - H_CAB, width: AREA, height: H_CAB, color: VERDE });
    const base = noMeio(y, H_CAB, T.cab);
    COLUNAS.forEach((c, i) => {
      const rot = seguro(c.rot.toUpperCase());
      const w = largura(forte, T.cab, rot);
      const x = c.alinha === "dir" ? xCol[i] + larg[i] - PX - w
        : c.alinha === "meio" ? xCol[i] + (larg[i] - w) / 2 : xCol[i] + PX;
      escrever(rot, x, base, { fonte: forte, tam: T.cab, cor: BRANCO });
      if (i < COLUNAS.length - 1) {
        pag.drawLine({ start: { x: xCol[i] + larg[i], y: y - H_CAB }, end: { x: xCol[i] + larg[i], y },
          thickness: 0.6, color: BRANCO, opacity: 0.3 });
      }
    });
    y -= H_CAB;
  }

  function medir(l) {
    const cod = quebrar(regular, T.cod, l.cod, miolo(0));
    const desc = quebrar(regular, T.corpo, l.desc, miolo(1));
    const extra = l.extra ? quebrar(regular, T.extra, l.extra, miolo(1)) : [];
    const amb = quebrar(regular, T.corpo, l.amb, miolo(2));
    const hDesc = desc.length * T.corpo * ENTRELINHA + (extra.length ? 1.2 + extra.length * T.extra * ENTRELINHA : 0);
    const h = Math.max(hDesc, amb.length * T.corpo * ENTRELINHA, cod.length * T.cod * ENTRELINHA) + 2 * PY;
    return { cod, desc, extra, amb, h };
  }

  function linhaDaTabela(l, m) {
    const topo = y;
    const primeira = topo - PY - T.corpo * 0.85;   // a linha de base do primeiro texto
    m.cod.forEach((t, k) => escrever(t, xCol[0] + PX, primeira - k * T.cod * ENTRELINHA, { tam: T.cod }));
    m.desc.forEach((t, k) => escrever(t, xCol[1] + PX, primeira - k * T.corpo * ENTRELINHA));
    const yExtra = primeira - m.desc.length * T.corpo * ENTRELINHA - 0.6;
    m.extra.forEach((t, k) => escrever(t, xCol[1] + PX, yExtra - k * T.extra * ENTRELINHA, { tam: T.extra, cor: CINZA }));
    m.amb.forEach((t, k) => escrever(t, xCol[2] + PX, primeira - k * T.corpo * ENTRELINHA));
    [3, 4, 5, 6].forEach((i) => {
      const t = seguro(l[COLUNAS[i].chave]);
      const tam = corpoQueCabe(regular, T.corpo, t, miolo(i));
      const w = largura(regular, tam, t);
      const x = COLUNAS[i].alinha === "meio" ? xCol[i] + (larg[i] - w) / 2 : xCol[i] + larg[i] - PX - w;
      pag.drawText(t, { x, y: primeira, size: tam, font: regular, color: TINTA });
    });
    pag.drawLine({ start: { x: MARGEM, y: topo - m.h }, end: { x: MARGEM + AREA, y: topo - m.h }, thickness: 0.85, color: TRACO });
    y -= m.h;
  }

  function linhaDeTotal(rot, valor) {
    pag.drawRectangle({ x: MARGEM, y: y - H_TOTAL, width: AREA, height: H_TOTAL, color: VERDE });
    const base = noMeio(y, H_TOTAL, T.total);
    escrever(seguro(rot).toUpperCase(), MARGEM + PX, base, { fonte: forte, tam: T.total, cor: BRANCO });
    const v = seguro(valor);
    escrever(v, MARGEM + AREA - PX - largura(forte, T.total, v), base, { fonte: forte, tam: T.total, cor: BRANCO });
    y -= H_TOTAL;
  }

  if (!secoes.length) {
    const linhas = quebrar(regular, T.corpo, vazio, AREA - 8 * MM);
    const h = linhas.length * T.corpo * ENTRELINHA + 6 * MM;
    pag.drawRectangle({ x: MARGEM, y: y - h, width: AREA, height: h, color: AVISO, borderColor: AVISO_BORDA, borderWidth: 0.8 });
    linhas.forEach((l, k) => escrever(l, MARGEM + 4 * MM, y - 3 * MM - T.corpo * 0.85 - k * T.corpo * ENTRELINHA));
    y -= h + 5 * MM;
  }

  secoes.forEach((s) => {
    const medidas = (s.linhas || []).map(medir);
    // O título não fica sozinho no pé da folha: vai junto com o cabeçalho e a primeira linha.
    const inicio = H_TITULO + H_CAB + (medidas[0]?.h || 0) + (medidas.length <= 1 ? H_TOTAL : 0);
    if (!cabe(inicio)) novaPagina();
    tituloDaSecao(s, false);
    cabecalhoDaTabela();
    medidas.forEach((m, k) => {
      // A última linha não se separa do total da obra.
      const ultima = k === medidas.length - 1;
      if (!cabe(m.h + (ultima ? H_TOTAL : 0))) { novaPagina(); tituloDaSecao(s, true); cabecalhoDaTabela(); }
      linhaDaTabela(s.linhas[k], m);
    });
    if (!cabe(H_TOTAL)) { novaPagina(); tituloDaSecao(s, true); cabecalhoDaTabela(); }
    linhaDeTotal(s.rotuloTotal || "Total da obra", s.total);
    y -= 5 * MM;
  });

  // ---------- o resumo: cada obra e o total, na caixa verde à direita ----------
  if (resumo && secoes.length) {
    const L = 120 * MM;
    const x0 = MARGEM + AREA - L;
    const hL = T.resumo + 2 * 1.8 * MM;
    const hF = T.final + 2 * 2.6 * MM;
    const h = (resumo.linhas || []).length * hL + hF;
    if (!cabe(h + 2 * MM)) novaPagina();
    y -= 2 * MM;
    const topoCaixa = y;
    (resumo.linhas || []).forEach(([rot, val]) => {
      const base = noMeio(y, hL, T.resumo);
      const v = seguro(val);
      const wv = largura(forte, T.resumo, v);
      escrever(truncar(regular, T.resumo, rot, L - 6 * MM - wv - 4 * MM), x0 + 3 * MM, base, { tam: T.resumo });
      escrever(v, x0 + L - 3 * MM - wv, base, { fonte: forte, tam: T.resumo });
      pag.drawLine({ start: { x: x0, y: y - hL }, end: { x: x0 + L, y: y - hL }, thickness: 0.85, color: TRACO });
      y -= hL;
    });
    pag.drawRectangle({ x: x0, y: y - hF, width: L, height: hF, color: VERDE });
    const [rotF, valF] = resumo.final || ["Total", ""];
    const baseF = noMeio(y, hF, T.final);
    const vF = seguro(valF);
    escrever(rotF, x0 + 3 * MM, baseF, { fonte: forte, tam: T.final, cor: BRANCO });
    escrever(vF, x0 + L - 3 * MM - largura(forte, T.final, vF), baseF, { fonte: forte, tam: T.final, cor: BRANCO });
    y -= hF;
    pag.drawRectangle({ x: x0, y, width: L, height: topoCaixa - y, borderColor: VERDE, borderWidth: 1.1 });
  }

  // ---------- o número de cada folha, logo acima do rodapé ----------
  paginas.forEach((p, i) => {
    const t = `página ${i + 1} de ${paginas.length}`;
    p.drawText(t, {
      x: MARGEM + AREA - largura(regular, T.pagina, t), y: BASE_PE + hPe + 3 * MM,
      size: T.pagina, font: regular, color: CINZA,
    });
  });

  return pdf.save();
}
