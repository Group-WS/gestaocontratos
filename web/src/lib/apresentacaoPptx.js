import { zipSync } from "fflate";
import {
  LARGURA, ALTURA, RODAPE, CAMPOS_CAPA, BLOCO, quebrar,
  caixaDoCampo, ANO_NA_ARTE, COR_VALOR, COR_TITULO,
  blocosImagem, blocosLista, listaDoSlide, listaDentro, LISTA_ITEM,
} from "./apresentacaoModelo.js";
import { TEXTOS, ambienteEm, textoDoBloco } from "./apresentacaoIdioma.js";

/**
 * Monta o .pptx EDITÁVEL da apresentação.
 *
 * O PDF é o documento final, pra imprimir e mandar pro cliente. Este é
 * outra coisa: ela pediu especificamente pra poder abrir no PowerPoint e
 * mexer depois — texto solto, imagem solta, cada elemento arrastável
 * como em qualquer apresentação normal. Não dá pra chegar nisso
 * desenhando em cima de uma página, como o PDF faz; precisa da estrutura
 * inteira que o PowerPoint espera: tema, slide master, layout, e cada
 * slide com suas próprias formas.
 *
 * A GEOMETRIA é a MESMA do editor e do PDF — 960×540 pontos — porque
 * 960pt é exatamente 13,333in (960/72), que é a largura padrão do slide
 * 16:9 do PowerPoint. Não precisou reescalar nada: só converter ponto
 * pra EMU (a unidade do OOXML), numa conta só, uma vez.
 */

const EMU_PT = 12700;                          // EMU por ponto
const px = (v) => Math.round(v * EMU_PT);

const esc = (t) => String(t ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/* PNG e JPEG pela assinatura dos bytes — nome de arquivo mente,
   cabeçalho não. É o mesmo cuidado do gerador de PDF. */
function tipoDaImagem(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return b[0] === 0x89 && b[1] === 0x50 ? { ext: "png", mime: "image/png" } : { ext: "jpeg", mime: "image/jpeg" };
}

/**
 * @param doc      capa + slides (o mesmo objeto que alimenta o PDF)
 * @param artes    { abertura, dados, fechamento } — bytes dos PNGs
 * @param imagemDe (caminho) => Promise<Uint8Array|null>
 * @param idioma   "pt" | "en"
 * @returns Uint8Array — o .pptx pronto
 */
export async function gerarPptx(doc, artes, imagemDe, idioma = "pt") {
  const T = TEXTOS[idioma] || TEXTOS.pt;
  const arquivos = {};                         // caminho dentro do zip -> bytes | string
  const midias = [];                           // [{ nome, bytes }] em ppt/media
  const cache = new Map();                     // um caminho de imagem vira UMA media, não uma por uso

  async function media(bytesOuNulo) {
    if (!bytesOuNulo) return null;
    const { ext, mime } = tipoDaImagem(bytesOuNulo);
    const nome = `image${midias.length + 1}.${ext}`;
    midias.push({ nome, bytes: bytesOuNulo, mime });
    return nome;
  }
  async function mediaDoCaminho(caminho) {
    if (!caminho) return null;
    if (cache.has(caminho)) return cache.get(caminho);
    let bytes = null;
    try { bytes = await imagemDe(caminho); } catch { bytes = null; }
    const nome = bytes ? await media(bytes) : null;
    cache.set(caminho, nome);
    return nome;
  }

  /* ---------- as peças fixas do pacote (tema, mestre, layout) ----------
   *
   * O PowerPoint exige essa cadeia inteira mesmo pra um slide em branco:
   * presentation -> slideMaster -> slideLayout -> theme. É boilerplate,
   * e é o motivo de um .pptx nunca ser "só as imagens e o texto". */
  const TEMA = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="TKWS">
<a:themeElements>
<a:clrScheme name="TKWS">
<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="092737"/></a:dk2>
<a:lt2><a:srgbClr val="E8E8E8"/></a:lt2>
<a:accent1><a:srgbClr val="092737"/></a:accent1>
<a:accent2><a:srgbClr val="7F7F7F"/></a:accent2>
<a:accent3><a:srgbClr val="A6A6A6"/></a:accent3>
<a:accent4><a:srgbClr val="6B6E70"/></a:accent4>
<a:accent5><a:srgbClr val="092737"/></a:accent5>
<a:accent6><a:srgbClr val="7F7F7F"/></a:accent6>
<a:hlink><a:srgbClr val="0563C1"/></a:hlink>
<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="TKWS">
<a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
</a:fontScheme>
<a:fmtScheme name="TKWS">
<a:fillStyleLst>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
</a:fillStyleLst>
<a:lnStyleLst>
<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
</a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
</a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements>
</a:theme>`;

  const SLIDE_MASTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>
<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;

  const SLIDE_LAYOUT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank" preserve="1">
<p:cSld name="Em branco"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
</p:sldLayout>`;

  /* ---------- as formas que compõem CADA slide ---------- */

  function imagemXml(id, rId, x, y, w, h) {
    return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Imagem ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="${px(x)}" y="${px(y)}"/><a:ext cx="${px(w)}" cy="${px(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>`;
  }

  /* Caixa de texto solta e editável: é o ponto do arquivo inteiro. Cada
     `<a:r>` é uma linha, e `algn`/cor/negrito viram atributos reais do
     PowerPoint — não desenho, texto de verdade que se seleciona e edita. */
  function textoXml(id, x, y, w, h, linhas, { tamanho = 10, cor = "191D21", negrito = false, direita = false } = {}) {
    const paras = (Array.isArray(linhas) ? linhas : [linhas]).map((l) => `<a:p>` +
      (direita ? `<a:pPr algn="r"/>` : "") +
      `<a:r><a:rPr lang="pt-BR" sz="${Math.round(tamanho * 100)}" b="${negrito ? 1 : 0}" dirty="0">` +
      `<a:solidFill><a:srgbClr val="${cor}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>` +
      `<a:t>${esc(l)}</a:t></a:r></a:p>`).join("");
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Texto ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${px(x)}" y="${px(y)}"/><a:ext cx="${px(w)}" cy="${px(h)}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody>
</p:sp>`;
  }

  /* TODO slide precisa desta relação — é como o PowerPoint sabe de qual
     layout ele herda. Faltando ela, o arquivo abre "reparado" (ou nem
     abre): foi um bug real, achado só ao inspecionar um .pptx de
     verdade — o `||` que devia suprir essa relação nos slides sem
     imagem nunca disparava, porque `relXml([])` já devolve uma string
     não-vazia mesmo sem nenhuma foto. */
  const RELACAO_LAYOUT = { id: "rId1", tipo: "slideLayout", alvo: "../slideLayouts/slideLayout1.xml" };

  /* Uma página inteira de arte fixa (abertura, dados, fechamento): a
     imagem cobrindo o slide todo. Continua sendo IMAGEM, não texto —
     ela é a marca da casa, e não deveria ser editável por engano. */
  async function slideDeArte(bytes) {
    const nome = await media(bytes);
    if (!nome) return { formas: "", rels: "" };
    return {
      formas: imagemXml(2, "rId2", 0, 0, LARGURA, ALTURA),
      rels: relXml([RELACAO_LAYOUT, { id: "rId2", tipo: "image", alvo: `../media/${nome}` }]),
    };
  }

  function relXml(itens) {
    const linhas = itens.map((it) =>
      `<Relationship Id="${it.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${it.tipo}" Target="${it.alvo}"/>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${linhas}</Relationships>`;
  }

  const slides = [];                            // [{ formas, rels }]

  // ---------- 1. ABERTURA ----------
  const abertura = await slideDeArte(artes && artes.abertura);
  if (abertura.formas) {
    /* O ano, igual ao PDF: a arte traz "2025" impresso, e uma tarja da
       cor do fundo cobre e reescreve com o ano vigente. */
    const A = ANO_NA_ARTE;
    const tarja = `<p:sp><p:nvSpPr><p:cNvPr id="9" name="Tarja do ano"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${px(A.x)}" y="${px(A.y)}"/><a:ext cx="${px(A.w)}" cy="${px(A.h)}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="092737"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
    const ano = textoXml(10, A.x - 4, A.y + A.h / 2 - 8, A.w + 8, 16, String(new Date().getFullYear()),
      { tamanho: 7, cor: "8C9296" });
    slides.push({ formas: abertura.formas + tarja + ano, rels: abertura.rels });
  }

  // ---------- 2. DADOS DO PROJETO ----------
  const dados = await slideDeArte(artes && artes.dados);
  if (dados.formas) {
    let id = 20;
    let formas = dados.formas;
    /* Em inglês, cobre e reescreve os rótulos — mesmo remendo do PDF: a
       arte é uma imagem, o rótulo faz parte dela. */
    if (idioma !== "pt") {
      CAMPOS_CAPA.forEach((c) => {
        const tarja = `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Tarja"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${px(c.rotuloX)}" y="${px(c.y - 2)}"/><a:ext cx="${px(c.rotuloL)}" cy="${px(16)}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
        formas += tarja;
        id += 1;
        formas += textoXml(id, c.rotuloX, c.y - c.tamanho, c.rotuloL, 16, T[c.id] || "", { tamanho: c.tamanho, cor: "191D21", negrito: true });
        id += 1;
      });
    }
    CAMPOS_CAPA.forEach((c) => {
      let bruto = ((doc && doc.capa && doc.capa[c.id]) || "").trim();
      if (c.id === "titulo" && (!bruto || bruto === TEXTOS.pt.titulo)) bruto = T.titulo;
      if (!bruto) return;
      const cx = caixaDoCampo(doc, c);
      const linhas = c.linhas > 1 ? quebrar(bruto, 42).slice(0, c.linhas) : [bruto];
      formas += textoXml(id, cx.x, cx.y - c.tamanho, cx.w, (c.linhas || 1) * 16 + 4, linhas, {
        tamanho: c.tamanho, cor: c.id === "titulo" ? COR_TITULO.replace("#", "") : COR_VALOR.replace("#", ""),
        negrito: !!c.forte, direita: !c.esquerda,
      });
      id += 1;
    });
    slides.push({ formas, rels: dados.rels });
  }

  // ---------- UM SLIDE POR AMBIENTE ----------
  for (const s of (doc && doc.slides) || []) {
    /* id COMEÇA EM 2: o grupo raiz do slide (<p:nvGrpSpPr>) já usa id=1,
       e o PowerPoint exige id único por FORMA dentro do slide inteiro —
       reusar o 1 aqui é a receita de um arquivo que abre "reparado" ou
       nem abre. */
    let id = 2;
    let formas = "";
    const relItens = [RELACAO_LAYOUT];
    let rId = 2;
    const novoRid = () => `rId${rId++}`;

    // fundo branco: sem isto, um slide sem render mostraria o cinza do
    // PowerPoint em vez da página em branco de sempre
    formas += `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Fundo"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${px(LARGURA)}" cy="${px(ALTURA)}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
    id += 1;

    // o render, no canto e tamanho em que foi deixado
    const r = s.render || {};
    const nomeRender = await mediaDoCaminho(r.imagem);
    if (nomeRender) {
      const rid = novoRid();
      relItens.push({ id: rid, tipo: "image", alvo: `../media/${nomeRender}` });
      formas += imagemXml(id, rid, r.x || 0, r.y || 0, r.w || 519, r.h || 266);
      id += 1;
    }

    // cada produto em modo imagem: foto + legenda editável, os dois soltos
    for (const b of blocosImagem(s)) {
      const w = b.w || BLOCO.largura;
      const nomeFoto = await mediaDoCaminho(b.imagem);
      if (nomeFoto) {
        const rid = novoRid();
        relItens.push({ id: rid, tipo: "image", alvo: `../media/${nomeFoto}` });
        formas += imagemXml(id, rid, b.x, b.y, w, w);
        id += 1;
      }
      const linhas = quebrar(textoDoBloco(b, idioma), 24).slice(0, BLOCO.maxLinhas);
      formas += textoXml(id, b.x, b.y + w + BLOCO.respiro, w, BLOCO.maxLinhas * BLOCO.entrelinha, linhas,
        { tamanho: BLOCO.legenda, cor: "6B6E70" });
      id += 1;
    }

    // a listagem: uma caixa de texto só, com uma linha por item — no
    // pptx ela pode ser TEXTO DE VERDADE, sem o corte por reticências
    // que o PDF precisa fazer; quem editar aqui pode até quebrar linha.
    const emLista = blocosLista(s);
    if (emLista.length) {
      const lb = listaDentro(listaDoSlide(s), emLista.length);
      const linhas = emLista.map((b) => `– ${textoDoBloco(b, idioma)}`);
      formas += textoXml(id, lb.x, lb.y, lb.w, emLista.length * LISTA_ITEM.entrelinha + 10, linhas,
        { tamanho: LISTA_ITEM.tamanho, cor: "6B6E70" });
      id += 1;
    }

    // "TKWS | AMBIENTE", rodapé
    formas += textoXml(id, 20, ALTURA - RODAPE + 8, 400, 20,
      `TKWS  |  ${ambienteEm(s.ambiente, idioma).toUpperCase()}`, { tamanho: 12, cor: "191D21", negrito: true });

    slides.push({ formas, rels: relXml(relItens) });
  }

  // ---------- FECHAMENTO ----------
  const fechamento = await slideDeArte(artes && artes.fechamento);
  if (fechamento.formas) slides.push(fechamento);

  /* ---------- monta o pacote ---------- */

  arquivos["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("\n")}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  arquivos["_rels/.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const agora = new Date().toISOString();
  arquivos["docProps/core.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc((doc && doc.capa && doc.capa.projeto) || "")} ${esc(T.titulo)}</dc:title>
<dc:creator>Gestão de Obras TKWS</dc:creator>
<cp:lastModifiedBy>Gestão de Obras TKWS</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${agora}</dcterms:modified>
</cp:coreProperties>`;

  arquivos["docProps/app.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>Gestão de Obras TKWS</Application>
<Slides>${slides.length}</Slides>
</Properties>`;

  arquivos["ppt/theme/theme1.xml"] = TEMA;
  arquivos["ppt/slideMasters/slideMaster1.xml"] = SLIDE_MASTER;
  /* O slideMaster PRECISA de uma relação com o tema — sem ela o arquivo
     abre "reparado" no PowerPoint. Achado comparando com um .pptx de
     verdade, feito no PowerPoint (o master dele referencia o tema por
     aqui, não por outro lugar do pacote): faltava inteiramente. */
  arquivos["ppt/slideMasters/_rels/slideMaster1.xml.rels"] = relXml([
    { id: "rId1", tipo: "slideLayout", alvo: "../slideLayouts/slideLayout1.xml" },
    { id: "rId2", tipo: "theme", alvo: "../theme/theme1.xml" },
  ]);
  arquivos["ppt/slideLayouts/slideLayout1.xml"] = SLIDE_LAYOUT;
  arquivos["ppt/slideLayouts/_rels/slideLayout1.xml.rels"] = relXml([
    { id: "rId1", tipo: "slideMaster", alvo: "../slideMasters/slideMaster1.xml" },
  ]);

  arquivos["ppt/presentation.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("")}</p:sldIdLst>
<p:sldSz cx="${px(LARGURA)}" cy="${px(ALTURA)}" type="screen16x9"/>
<p:notesSz cx="${px(ALTURA)}" cy="${px(LARGURA)}"/>
</p:presentation>`;

  arquivos["ppt/_rels/presentation.xml.rels"] = relXml([
    { id: "rId1", tipo: "slideMaster", alvo: "slideMasters/slideMaster1.xml" },
    ...slides.map((_, i) => ({ id: `rId${i + 2}`, tipo: "slide", alvo: `slides/slide${i + 1}.xml` })),
  ]);

  slides.forEach((s, i) => {
    arquivos[`ppt/slides/slide${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${s.formas}
</p:spTree></p:cSld>
</p:sld>`;
    arquivos[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = s.rels || relXml([RELACAO_LAYOUT]);
  });

  midias.forEach((m) => { arquivos[`ppt/media/${m.nome}`] = m.bytes; });

  /* zipSync recebe { caminho: bytes }; texto vira Uint8Array via
     TextEncoder — fflate não converte string sozinho. */
  const enc = new TextEncoder();
  const paraZip = {};
  Object.entries(arquivos).forEach(([caminho, conteudo]) => {
    paraZip[caminho] = typeof conteudo === "string" ? enc.encode(conteudo) : conteudo;
  });
  return zipSync(paraZip, { level: 6 });
}
