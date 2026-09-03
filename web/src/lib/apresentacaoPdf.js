import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import {
  LARGURA, ALTURA, RODAPE, CAMPOS_CAPA, BLOCO, quebrar,
  caixaDoCampo, ANO_NA_ARTE, COR_VALOR, COR_TITULO,
  blocosImagem, blocosLista, listaDoSlide, listaDentro, LISTA_ITEM,
} from "./apresentacaoModelo.js";
import { TEXTOS, ambienteEm, textoDoBloco } from "./apresentacaoIdioma.js";

/**
 * Monta o PDF da apresentação.
 *
 * Desenha de verdade — imagem embutida e texto vetorial — em vez de
 * fotografar a tela. Texto fotografado fica borrado no projetor e não se
 * copia; e o cliente costuma querer copiar o nome da peça.
 *
 * O sistema de coordenadas muda aqui, uma vez só: na tela a origem é no
 * ALTO à esquerda, no PDF é EMBAIXO. Espalhar essa conversão pelo código
 * é receita de bloco fora da página.
 */
const paraPdfY = (y, altura = 0) => ALTURA - y - altura;

const BRANCO = rgb(1, 1, 1);
const PRETO = rgb(0.09, 0.11, 0.13);
const CINZA = rgb(0.42, 0.44, 0.46);
/* O azul do fundo da capa, medido no pixel do arquivo dela: #092737.
   Chutado, a tarja que cobre o ano apareceria como um retângulo. */
const AZUL_CAPA = rgb(9 / 255, 39 / 255, 55 / 255);
const CINZA_CAPA = rgb(0.55, 0.60, 0.63);

const hex = (h) => rgb(
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255);

/* pdf-lib usa WinAnsi nas fontes padrão, e ela não tem tudo que o
   português escreve — travessão, aspas curvas e reticências derrubam a
   geração com "cannot encode". Trocar por equivalentes é melhor do que
   perder o documento inteiro por causa de um travessão. */
function seguro(t) {
  return String(t == null ? "" : t)
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[^\x20-\xFF]/g, "");
}

/* Corta o texto até caber numa linha só, com "..." no fim.
 *
 * A listagem é uma linha por item — não tem as três linhas de quebra do
 * bloco com foto. "..." em vez de "…" pelo mesmo motivo do `seguro()`
 * logo abaixo: a fonte padrão do pdf-lib não tem todo caractere do
 * português, e um caractere que ela não sabe desenhar derruba a geração
 * inteira. */
function truncar(fonte, tamanho, texto, largura) {
  const t = seguro(texto);
  if (fonte.widthOfTextAtSize(t, tamanho) <= largura) return t;
  let c = t;
  while (c.length > 1 && fonte.widthOfTextAtSize(`${c}...`, tamanho) > largura) c = c.slice(0, -1);
  return `${c.trimEnd()}...`;
}

async function embutir(pdf, bytes) {
  /* PNG e JPEG pela assinatura, não pela extensão: nome mente, cabeçalho
     não. */
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ehPng = b[0] === 0x89 && b[1] === 0x50;
  return ehPng ? pdf.embedPng(b) : pdf.embedJpg(b);
}

/* Desenha a imagem COBRINDO a caixa, sem distorcer: a proporção de um
   render nunca é a da caixa, e esticar deforma o ambiente — que é
   justamente o que o cliente está avaliando. O que sobra é cortado. */
function cobrir(pag, img, caixa) {
  const escala = Math.max(caixa.w / img.width, caixa.h / img.height);
  const w = img.width * escala, h = img.height * escala;
  pag.drawImage(img, {
    x: caixa.x + (caixa.w - w) / 2,
    y: paraPdfY(caixa.y + caixa.h) + (caixa.h - h) / 2,
    width: w, height: h,
  });
}

/* A foto do produto CABE inteira na caixa, e não é cortada: aqui o corte
   tiraria justamente a peça. Sobra fica branca. */
function caber(pag, img, caixa) {
  const escala = Math.min(caixa.w / img.width, caixa.h / img.height);
  const w = img.width * escala, h = img.height * escala;
  pag.drawImage(img, {
    x: caixa.x + (caixa.w - w) / 2,
    y: paraPdfY(caixa.y + caixa.h) + (caixa.h - h) / 2,
    width: w, height: h,
  });
}

/**
 * @param doc      capa + slides
 * @param artes    { abertura, dados, fechamento } — bytes dos PNGs
 * @param imagemDe (caminho) => Promise<Uint8Array|null>
 * @param idioma   "pt" | "en"
 */
export async function gerarPdf(doc, artes, imagemDe, idioma = "pt") {
  const T = TEXTOS[idioma] || TEXTOS.pt;
  const pdf = await PDFDocument.create();
  pdf.setTitle(seguro(`${(doc && doc.capa && doc.capa.projeto) || ""} ${T.titulo}`.trim()));
  pdf.setProducer("Gestao de Obras TKWS");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const forte = await pdf.embedFont(StandardFonts.HelveticaBold);

  /* Uma imagem usada em dez slides é embutida UMA vez. Sem isto o PDF
     duplica cada foto e um documento de 40 páginas passa de 100 MB. */
  const cache = new Map();
  const buscar = async (caminho) => {
    if (!caminho) return null;
    if (cache.has(caminho)) return cache.get(caminho);
    let img = null;
    try {
      const bytes = await imagemDe(caminho);
      img = bytes ? await embutir(pdf, bytes) : null;
    } catch { img = null; }   // foto que falha não derruba o documento
    cache.set(caminho, img);
    return img;
  };

  const arte = async (bytes) => {
    if (!bytes) return null;
    const pag = pdf.addPage([LARGURA, ALTURA]);
    const img = await embutir(pdf, bytes);
    pag.drawImage(img, { x: 0, y: 0, width: LARGURA, height: ALTURA });
    return pag;
  };

  // ---------- 1. ABERTURA: TKWS | Years Ahead. ----------
  const abertura = await arte(artes && artes.abertura);
  if (abertura) {
    /* O ano na lateral é o VIGENTE, e não o que estava impresso quando a
       arte foi feita. Uma apresentação de 2026 com "2025" no canto é o
       tipo de detalhe que o cliente nota e ninguém revisa. */
    const A = ANO_NA_ARTE;
    abertura.drawRectangle({
      x: A.x, y: paraPdfY(A.y + A.h), width: A.w, height: A.h, color: AZUL_CAPA,
    });
    abertura.drawText(String(new Date().getFullYear()), {
      x: A.x + 2, y: paraPdfY(A.y + 2), size: A.tamanho, font: regular,
      color: CINZA_CAPA, rotate: degrees(-90),
    });
  }

  // ---------- 2. DADOS DO PROJETO ----------
  const capa = await arte(artes && artes.dados);
  if (!capa) return pdf.save();

  /* Os rótulos da capa (Squad, Cliente, Nº do projeto...) estão DENTRO da
     arte, não são texto. Pra sair em inglês, cada um é coberto por uma
     tarja da cor do fundo e reescrito. É remendo, e está anotado como
     remendo: com uma capa em inglês de verdade, some daqui. */
  if (idioma !== "pt") {
    CAMPOS_CAPA.forEach((c) => {
      capa.drawRectangle({
        x: c.rotuloX, y: paraPdfY(c.y + 2, 13), width: c.rotuloL, height: 15, color: BRANCO,
      });
      capa.drawText(seguro(T[c.id] || ""), {
        x: c.rotuloX, y: paraPdfY(c.y, c.tamanho), size: c.tamanho, font: forte, color: PRETO,
      });
    });
  }

  CAMPOS_CAPA.forEach((c) => {
    let bruto = ((doc && doc.capa && doc.capa[c.id]) || "").trim();
    /* O título sai no idioma da emissão — a menos que alguém tenha
       escrito um próprio, e aí o dele manda. */
    if (c.id === "titulo" && (!bruto || bruto === TEXTOS.pt.titulo)) bruto = T.titulo;
    const valor = seguro(bruto);
    if (!valor) return;
    const cx = caixaDoCampo(doc, c);
    const fonte = c.forte ? forte : regular;
    const cor = hex(c.id === "titulo" ? COR_TITULO : COR_VALOR);
    const linhas = c.linhas > 1 ? quebrar(valor, 42).slice(0, c.linhas) : [valor];
    linhas.forEach((l, i) => {
      /* ALINHADO À DIREITA, dentro da caixa. É como o PPTX faz (algn="r")
         e é o que faz o valor terminar junto com o fim da linha impressa
         na arte. Alinhado à esquerda, "00" e "2307" paravam no vazio. */
      const larg = fonte.widthOfTextAtSize(l, c.tamanho);
      const x = c.esquerda ? cx.x : cx.x + cx.w - larg;
      capa.drawText(l, {
        x, y: paraPdfY(cx.y + i * 14, c.tamanho),
        size: c.tamanho, font: fonte, color: cor,
      });
    });
  });


  // ---------- UM SLIDE POR AMBIENTE ----------
  /* eslint-disable no-unused-vars */
  for (const s of (doc && doc.slides) || []) {
    const pag = pdf.addPage([LARGURA, ALTURA]);
    pag.drawRectangle({ x: 0, y: 0, width: LARGURA, height: ALTURA, color: BRANCO });

    // O render, no canto e no tamanho em que foi deixado
    const r = s.render || {};
    const imgR = await buscar(r.imagem);
    if (imgR) cobrir(pag, imgR, { x: r.x || 0, y: r.y || 0, w: r.w || 519, h: r.h || 266 });

    // Cada produto EM MODO IMAGEM: foto em cima, descrição embaixo
    for (const b of blocosImagem(s)) {
      const w = b.w || BLOCO.largura;
      const img = await buscar(b.imagem);
      if (img) caber(pag, img, { x: b.x, y: b.y, w, h: w });
      else {
        pag.drawRectangle({
          x: b.x, y: paraPdfY(b.y + w), width: w, height: w,
          color: rgb(0.95, 0.95, 0.94),
        });
      }

      const linhas = quebrar(seguro(textoDoBloco(b, idioma)), 24).slice(0, BLOCO.maxLinhas);
      linhas.forEach((l, i) => {
        pag.drawText(l, {
          x: b.x,
          y: paraPdfY(b.y + w + BLOCO.respiro + 8 + i * BLOCO.entrelinha, 0),
          size: BLOCO.legenda, font: regular, color: CINZA,
          maxWidth: w,
        });
      });
    }

    // A LISTAGEM: quem está em modo lista, uma linha cada, sem foto
    const emLista = blocosLista(s);
    if (emLista.length) {
      const lb = listaDentro(listaDoSlide(s), emLista.length);
      let y = lb.y + 3;
      emLista.forEach((b) => {
        const txt = truncar(regular, LISTA_ITEM.tamanho, textoDoBloco(b, idioma), lb.w - 14);
        pag.drawText("–", {
          x: lb.x, y: paraPdfY(y + LISTA_ITEM.tamanho, 0), size: LISTA_ITEM.tamanho, font: regular, color: CINZA,
        });
        pag.drawText(txt, {
          x: lb.x + 10, y: paraPdfY(y + LISTA_ITEM.tamanho, 0), size: LISTA_ITEM.tamanho, font: regular, color: CINZA,
        });
        y += LISTA_ITEM.entrelinha;
      });
    }

    // "TKWS | LIVING", no rodapé à esquerda, como no documento dela
    pag.drawText(seguro(`TKWS  |  ${ambienteEm(s.ambiente, idioma).toUpperCase()}`), {
      x: 20, y: paraPdfY(ALTURA - RODAPE + 9, 12), size: 12, font: forte, color: PRETO,
    });
  }

  // ---------- FECHAMENTO ----------
  await arte(artes && artes.fechamento);

  return pdf.save();
}
