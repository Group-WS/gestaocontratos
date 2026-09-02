/**
 * APRESENTAÇÃO DE ESPECIFICAÇÕES.
 *
 * O documento que a casa mostra ao cliente: uma capa com os dados do
 * projeto e, depois, um slide por ambiente.
 *
 * A GEOMETRIA SAIU DO PPTX DELA, não de suposição. O slide é 1280×720 px
 * (960×540 pt) e o slide do Living está montado assim:
 *
 *   render do ambiente   x=0  y=0  692×355 px   -> um CANTO, não sangria
 *   foto do produto      ~120–290 px
 *   descrição            logo ABAIXO da foto, 180×42 px
 *
 * Ou seja: não é uma foto grande com etiquetas por cima — é uma COLAGEM.
 * Foi exatamente aí que eu errei na primeira versão.
 *
 * Tudo aqui é em PONTOS (960×540), com a origem no ALTO à esquerda, que é
 * como se pensa numa tela. A conversão para o sistema do PDF (origem
 * embaixo) acontece num lugar só, na hora de desenhar.
 */

export const LARGURA = 960;
export const ALTURA = 540;

/* A tarja "TKWS | AMBIENTE" no rodapé. Nada pode nascer em cima dela. */
export const RODAPE = 30;

/* Onde cada valor entra na capa — medido no PPTX, em pontos.
   `rotuloX`/`rotuloL` marcam onde está o rótulo desenhado NA ARTE, e
   servem só na emissão em inglês, pra cobrir a palavra em português.
   Data e Rev dividem a linha; usar a mesma posição pros dois fez a tarja
   do Rev apagar o "Date" recém-escrito. */
export const CAMPOS_CAPA = [
  { id: "squad",   x: 200, y: 72,  tamanho: 12, rotuloX: 74,  rotuloL: 120 },
  { id: "cliente", x: 200, y: 308, tamanho: 12, rotuloX: 74,  rotuloL: 120 },
  { id: "projeto", x: 200, y: 362, tamanho: 12, rotuloX: 74,  rotuloL: 120 },
  { id: "data",    x: 112, y: 414, tamanho: 12, rotuloX: 74,  rotuloL: 34 },
  { id: "rev",     x: 339, y: 414, tamanho: 12, rotuloX: 256, rotuloL: 34 },
  { id: "local",   x: 200, y: 466, tamanho: 12, rotuloX: 74,  rotuloL: 120, linhas: 2 },
];

export const TITULO_PADRAO = "APRESENTAÇÃO DE ESPECIFICAÇÕES";

/* O render nasce no canto de cima à esquerda, no tamanho do PPTX
   (692×355 px = 519×266 pt). Move e redimensiona. */
export const RENDER_PADRAO = { x: 0, y: 0, w: 519, h: 266 };

/* O bloco de produto: foto em cima, descrição embaixo. A largura manda —
   a foto é quadrada e a legenda tem a mesma largura dela. */
export const BLOCO = {
  largura: 110,
  legenda: 10,
  entrelinha: 12,
  maxLinhas: 3,
  respiro: 6,
};

export const alturaDoBloco = (b) => {
  const w = (b && b.w) || BLOCO.largura;
  return w + BLOCO.respiro + BLOCO.maxLinhas * BLOCO.entrelinha;
};

export const novaApresentacao = (obra) => ({
  obraCodigo: obra && obra.codigo ? String(obra.codigo) : null,
  capa: {
    squad: (obra && obra.squad) || "",
    cliente: obra && obra.cliente && obra.cliente !== "—" ? obra.cliente : "",
    projeto: obra && obra.codigo ? String(obra.codigo) : "",
    data: new Date().toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }),
    rev: "00",
    local: obra && obra.endereco && obra.endereco !== "—" ? obra.endereco : "",
    titulo: TITULO_PADRAO,
  },
  slides: [],
});

const id = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const novoSlide = (ambiente = "") => ({
  id: id("s"),
  ambiente,
  render: { imagem: null, ...RENDER_PADRAO },
  blocos: [],
});

/* Quebra o texto da legenda em linhas curtas. Sem isto, "SOFÁ ELYSIUM NOA
   MODULO 220CM + 90CM + MODULO CHAISE 140CM" vira uma faixa atravessando
   o slide. */
export function quebrar(texto, porLinha = 24) {
  const palavras = String(texto || "").split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = "";
  palavras.forEach((p) => {
    if (!atual) { atual = p; return; }
    if ((atual + " " + p).length <= porLinha) atual += " " + p;
    else { linhas.push(atual); atual = p; }
  });
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [""];
}

const cruza = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Onde os blocos nascem.
 *
 * Varre o slide em grade e pula toda célula que encostaria no render ou
 * na tarja do rodapé. É ponto de partida pra arrastar — não tentativa de
 * adivinhar a composição, que é trabalho de quem tem olho.
 */
/* Quantos blocos cabem sem amontoar. A tela usa pra avisar antes, e o
   teste usa pra provar que redimensionar o render muda a conta. */
export function quantasCabem(render, largura = BLOCO.largura) {
  return varrer(render, Infinity, largura).length;
}

export function vagas(render, quantos, largura = BLOCO.largura) {
  const livres = varrer(render, quantos, largura);
  const alturaBloco = largura + BLOCO.respiro + BLOCO.maxLinhas * BLOCO.entrelinha;
  /* Mais produtos do que cabem: o excedente amontoa, visivelmente, no
     canto de baixo. Some seria pior — ninguém procura o que não sabe que
     sumiu. */
  while (livres.length < quantos) {
    const k = livres.length;
    livres.push({ x: 12 + (k % 5) * 8, y: ALTURA - RODAPE - alturaBloco - 4 });
  }
  return livres;
}

function varrer(render, quantos, largura = BLOCO.largura) {
  const passoX = largura + 20;
  const alturaBloco = largura + BLOCO.respiro + BLOCO.maxLinhas * BLOCO.entrelinha;
  const passoY = alturaBloco + 14;
  const margem = 12;
  const ocupado = render ? { x: render.x, y: render.y, w: render.w + 14, h: render.h + 14 } : null;

  const livres = [];
  for (let y = margem; y + alturaBloco <= ALTURA - RODAPE - 4; y += passoY) {
    for (let x = margem; x + largura <= LARGURA - margem; x += passoX) {
      if (ocupado && cruza({ x, y, w: largura, h: alturaBloco }, ocupado)) continue;
      livres.push({ x, y });
      if (livres.length >= quantos) return livres;
    }
  }
  return livres;
}

/** Produto do catálogo vira bloco. O texto continua editável depois. */
export function produtoParaBloco(p, pos) {
  return {
    id: id("b"),
    produtoId: p.id || null,
    imagem: p.imagem || null,
    texto: String(p.descricaoCriativo || "").trim() || p.descricao || "",
    textoEn: p.descricaoEn || "",
    x: pos.x, y: pos.y, w: BLOCO.largura,
  };
}

/** Acrescenta produtos a um slide, cada um numa vaga livre. */
export function acrescentar(slide, produtos) {
  const jaTem = (slide.blocos || []).length;
  const livres = vagas(slide.render, jaTem + produtos.length);
  return {
    ...slide,
    blocos: [...(slide.blocos || []), ...produtos.map((p, i) => produtoParaBloco(p, livres[jaTem + i]))],
  };
}

/* Mantém o que se arrasta dentro da página. Sem isto um puxão leva o
   bloco pra fora e ele some do PDF sem erro nenhum. */
export function dentro(b) {
  const h = alturaDoBloco(b);
  return {
    ...b,
    x: Math.max(0, Math.min(LARGURA - b.w, b.x)),
    y: Math.max(0, Math.min(ALTURA - RODAPE - h, b.y)),
  };
}

export function renderDentro(r) {
  const w = Math.max(80, Math.min(LARGURA, r.w));
  const h = Math.max(60, Math.min(ALTURA, r.h));
  return {
    ...r, w, h,
    x: Math.max(0, Math.min(LARGURA - w, r.x)),
    y: Math.max(0, Math.min(ALTURA - h, r.y)),
  };
}

/* O que falta antes de gerar. Descobrir que um ambiente ficou sem imagem
   depois de gerar 40 páginas é caro. */
export function conferir(doc) {
  const slides = (doc && doc.slides) || [];
  return {
    slides: slides.length,
    blocos: slides.reduce((a, s) => a + (s.blocos || []).length, 0),
    semImagem: slides.filter((s) => !(s.render && s.render.imagem)).map((s) => s.ambiente || "sem nome"),
    semAmbiente: slides.filter((s) => !String(s.ambiente || "").trim()).length,
    pronto: slides.length > 0
      && slides.every((s) => s.render && s.render.imagem && String(s.ambiente || "").trim()),
  };
}

/* O nome do arquivo é o que aparece em Arquivos da obra, no padrão do
   documento dela: 2307_PE_ESPECIFICACOES. */
export function nomeDoArquivo(doc, idioma = "pt") {
  const cod = (doc && doc.capa && doc.capa.projeto) || (doc && doc.obraCodigo) || "obra";
  const rev = doc && doc.capa && doc.capa.rev ? `_REV${doc.capa.rev}` : "";
  const lng = idioma === "en" ? "_EN" : "";
  return `${cod}_PE_ESPECIFICACOES${rev}${lng}.pdf`;
}
