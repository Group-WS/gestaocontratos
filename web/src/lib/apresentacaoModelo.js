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

/* AS CAIXAS DE TEXTO DA FOLHA DE DADOS.
 *
 * Medidas tiradas do PPTX dela, convertidas de px (96dpi) pra pontos.
 * Três coisas vieram do arquivo, e não de suposição:
 *
 *   - `algn="r"` em TODOS os valores: eles são alinhados à DIREITA, e é
 *     por isso que terminam junto com o fim da linha impressa na arte.
 *     Alinhados à esquerda, "00" e "2307" paravam no meio do nada.
 *   - a cor: #7F7F7F nos valores e #A6A6A6 no título. Não é preto — foi
 *     o que ela viu e o PDF original confirma.
 *   - Data e Rev dividem a mesma linha, com fins diferentes.
 *
 * `x`,`y` são o canto de cima à esquerda da CAIXA, e `w` a largura dela.
 * A caixa é o que se arrasta; o texto se alinha dentro. Guardar o ponto
 * do texto em vez da caixa faria o alinhamento à direita perder a
 * referência assim que alguém movesse o campo. */
export const CAMPOS_CAPA = [
  { id: "squad",   x: 150, y: 58,  w: 200, tamanho: 12, rotuloX: 74,  rotuloL: 120 },
  { id: "cliente", x: 120, y: 295, w: 230, tamanho: 12, rotuloX: 74,  rotuloL: 120 },
  { id: "projeto", x: 150, y: 349, w: 200, tamanho: 12, rotuloX: 74,  rotuloL: 120 },
  { id: "data",    x: 74,  y: 401, w: 80,  tamanho: 12, rotuloX: 74,  rotuloL: 34 },
  { id: "rev",     x: 250, y: 401, w: 100, tamanho: 12, rotuloX: 256, rotuloL: 34 },
  { id: "local",   x: 120, y: 452, w: 230, tamanho: 12, rotuloX: 74,  rotuloL: 120, linhas: 2 },
  /* O título é o único alinhado à esquerda — ele não pertence a nenhuma
     das linhas impressas. */
  { id: "titulo",  x: 64,  y: 176, w: 540, tamanho: 20, esquerda: true, forte: true },
];

/* As cores, medidas no PDF original. */
export const COR_VALOR = "#7F7F7F";
export const COR_TITULO = "#A6A6A6";

/* A caixa efetiva de um campo: a que a pessoa moveu, ou a de fábrica. */
export function caixaDoCampo(doc, campo) {
  const salva = doc && doc.capa && doc.capa.caixas && doc.capa.caixas[campo.id];
  return {
    x: salva && Number.isFinite(salva.x) ? salva.x : campo.x,
    y: salva && Number.isFinite(salva.y) ? salva.y : campo.y,
    w: salva && Number.isFinite(salva.w) ? salva.w : campo.w,
  };
}

/* Mantém a caixa dentro da página. */
export function caixaDentro(c) {
  const w = Math.max(40, Math.min(LARGURA, c.w));
  return {
    x: Math.max(0, Math.min(LARGURA - w, c.x)),
    y: Math.max(0, Math.min(ALTURA - 20, c.y)),
    w,
  };
}

/* Onde está o "2025" impresso na arte da abertura, em pontos — MEDIDO no
   pixel do arquivo, varrendo o canto superior direito atrás do que não é
   fundo. Estimado, a tarja caía ao lado e o documento saía com dois anos
   escritos, que foi o que aconteceu. */
export const ANO_NA_ARTE = { x: 930, y: 39, w: 12, h: 26, tamanho: 7 };

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

  /* Varre TUDO antes de escolher, e só então ordena: a ordem é da
     ESQUERDA pra direita, coluna por coluna.
     Antes era linha por linha, e como o render ocupa o canto de cima à
     esquerda, os primeiros produtos caíam lá na direita — longe de onde
     a pessoa está olhando, e num slide grande isso obriga a caçar. */
  const livres = [];
  for (let y = margem; y + alturaBloco <= ALTURA - RODAPE - 4; y += passoY) {
    for (let x = margem; x + largura <= LARGURA - margem; x += passoX) {
      if (ocupado && cruza({ x, y, w: largura, h: alturaBloco }, ocupado)) continue;
      livres.push({ x, y });
    }
  }
  livres.sort((a, b) => (a.x - b.x) || (a.y - b.y));
  return livres.slice(0, quantos);
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

/* A PRÓXIMA REVISÃO.
 *
 * "00" -> "01" -> "02". Dois dígitos porque é assim que a casa escreve, e
 * porque "9" seguido de "10" ordena errado em qualquer lista.
 *
 * Revisão não é rascunho: a 00 já foi ao cliente. Por isso a nova NASCE
 * como cópia — o trabalho todo continua, e o que muda é o que a pessoa
 * mudar. */
export function proximaRev(revs) {
  const maior = (revs || []).reduce((a, r) => {
    const n = parseInt(String(r).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > a ? n : a;
  }, -1);
  return String(maior + 1).padStart(2, "0");
}

/* Copia uma revisão pra virar a próxima. Sem `id`, o banco grava uma
   linha nova em vez de escrever por cima da que já foi apresentada. */
export function duplicarComoRev(doc, rev) {
  return {
    obraCodigo: doc.obraCodigo,
    capa: { ...doc.capa, rev },
    slides: JSON.parse(JSON.stringify(doc.slides || [])),
    idioma: doc.idioma || "pt",
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
