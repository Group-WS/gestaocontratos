import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { LARGURA, ALTURA, CAMPOS_CAPA, ETIQUETA, quebrar } from "./apresentacaoModelo.js";
import { TEXTOS, ambienteEm, textoDaEtiqueta } from "./apresentacaoIdioma.js";

/**
 * Monta o PDF da apresentação.
 *
 * Desenha de verdade — imagem embutida e texto vetorial — em vez de
 * fotografar a tela. Texto fotografado fica borrado no projetor e não se
 * copia; e o cliente costuma querer copiar o nome da peça.
 *
 * O sistema de coordenadas muda aqui, uma vez só: na tela a origem é no
 * ALTO à esquerda, no PDF é EMBAIXO. Espalhar essa conversão pelo código
 * é receita de etiqueta fora da página.
 */
const paraPdfY = (y, alturaDoTexto = 0) => ALTURA - y - alturaDoTexto;

const BRANCO = rgb(1, 1, 1);
const PRETO = rgb(0.09, 0.11, 0.13);

/* pdf-lib usa WinAnsi nas fontes padrão, e ela não tem tudo que o
   português escreve — travessão, aspas curvas e reticências derrubam a
   geração com "cannot encode". Trocar por equivalentes é melhor do que
   perder o documento inteiro por causa de um travessão. */
function seguro(t) {
  return String(t ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[^\x20-\xFF]/g, "");
}

async function embutir(pdf, bytes) {
  /* PNG e JPEG são reconhecidos pela assinatura, e não pela extensão do
     arquivo: nome mente, cabeçalho não. */
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ehPng = b[0] === 0x89 && b[1] === 0x50;
  return ehPng ? pdf.embedPng(b) : pdf.embedJpg(b);
}

/**
 * @param doc        o documento (capa + slides)
 * @param capaBytes  a arte da capa (PNG)
 * @param imagemDe   (slide) => Promise<Uint8Array|null> — busca o render
 */
export async function gerarPdf(doc, capaBytes, imagemDe, idioma = "pt") {
  const T = TEXTOS[idioma] || TEXTOS.pt;
  const pdf = await PDFDocument.create();
  pdf.setTitle(seguro(`${doc?.capa?.projeto || ""} ${doc?.capa?.titulo || ""}`.trim()));
  pdf.setProducer("Gestão de Obras TKWS");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const forte = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ---------- CAPA ----------
  const capa = pdf.addPage([LARGURA, ALTURA]);
  if (capaBytes) {
    const img = await embutir(pdf, capaBytes);
    capa.drawImage(img, { x: 0, y: 0, width: LARGURA, height: ALTURA });
  }

  /* Os rótulos da capa (Squad, Cliente, Nº do projeto...) estão DENTRO
     da arte, não são texto. Pra sair em inglês, cada um é coberto por
     uma tarja da cor do fundo e reescrito. É remendo, e está anotado
     como remendo: com uma capa em inglês de verdade, some daqui. */
  if (idioma !== "pt") {
    CAMPOS_CAPA.forEach((c) => {
      capa.drawRectangle({
        x: c.rotuloX, y: paraPdfY(c.y + 2, 13), width: c.rotuloL, height: 15,
        color: BRANCO,
      });
      capa.drawText(seguro(T[c.id] || ""), {
        x: c.rotuloX, y: paraPdfY(c.y, c.tamanho),
        size: c.tamanho, font: forte, color: PRETO,
      });
    });
  }

  CAMPOS_CAPA.forEach((c) => {
    const valor = seguro(doc?.capa?.[c.id] || "");
    if (!valor) return;
    /* Localização costuma ter duas linhas ("Balneário Camboriú,
       Condomínio bela vista, Quadra F, lote 12 e lote 10"). */
    const linhas = c.linhas > 1 ? quebrar(valor, 42).slice(0, c.linhas) : [valor];
    linhas.forEach((l, i) => {
      capa.drawText(l, {
        x: c.x, y: paraPdfY(c.y + i * 14, c.tamanho),
        size: c.tamanho, font: regular, color: PRETO,
      });
    });
  });

  /* O título sai no idioma da emissão, a menos que alguém tenha
     escrito um título próprio — aí o dele manda. */
  const titulo = doc?.capa?.titulo && doc.capa.titulo !== TEXTOS.pt.titulo
    ? doc.capa.titulo : T.titulo;
  if (titulo) {
    capa.drawText(seguro(titulo), {
      x: 71, y: paraPdfY(196, 20), size: 20, font: forte, color: PRETO,
    });
  }

  // ---------- UM SLIDE POR AMBIENTE ----------
  for (const s of doc?.slides || []) {
    const pag = pdf.addPage([LARGURA, ALTURA]);
    pag.drawRectangle({ x: 0, y: 0, width: LARGURA, height: ALTURA, color: BRANCO });

    const bytes = await imagemDe(s);
    if (bytes) {
      const img = await embutir(pdf, bytes);
      /* COBRIR a página inteira sem distorcer: a proporção do render
         nunca é exatamente 16:9, e esticar a imagem pra caber deforma o
         ambiente — que é justamente o que o cliente está avaliando. */
      const escala = Math.max(LARGURA / img.width, ALTURA / img.height);
      const w = img.width * escala, h = img.height * escala;
      pag.drawImage(img, { x: (LARGURA - w) / 2, y: (ALTURA - h) / 2, width: w, height: h });
    }

    // "TKWS | LIVING", no rodapé à esquerda, como no documento dela
    const rotulo = seguro(`TKWS | ${ambienteEm(s.ambiente, idioma).toUpperCase()}`);
    pag.drawRectangle({
      x: 0, y: 0, width: LARGURA, height: 30,
      color: rgb(0, 0, 0), opacity: 0.45,
    });
    pag.drawText(rotulo, { x: 20, y: 10, size: 12, font: forte, color: BRANCO });

    (s.etiquetas || []).forEach((e) => {
      const linhas = quebrar(seguro(textoDaEtiqueta(e, idioma)), 26);
      const alturaBloco = linhas.length * ETIQUETA.entrelinha;
      const largura = Math.min(
        ETIQUETA.larguraMax,
        Math.max(...linhas.map((l) => regular.widthOfTextAtSize(l, ETIQUETA.tamanho))) + ETIQUETA.recuo * 2);

      /* Tarja atrás do texto: sem ela a etiqueta some sobre a parte
         clara do render, e é exatamente sobre parede clara que a maioria
         cai. */
      pag.drawRectangle({
        x: e.x - ETIQUETA.recuo,
        y: paraPdfY(e.y + alturaBloco, 0) - ETIQUETA.recuo,
        width: largura,
        height: alturaBloco + ETIQUETA.recuo * 2,
        color: rgb(0, 0, 0), opacity: 0.42,
      });

      linhas.forEach((l, i) => {
        pag.drawText(l, {
          x: e.x, y: paraPdfY(e.y + i * ETIQUETA.entrelinha, ETIQUETA.tamanho),
          size: ETIQUETA.tamanho, font: regular, color: BRANCO,
        });
      });
    });
  }

  return pdf.save();
}
