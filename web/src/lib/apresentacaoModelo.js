/**
 * APRESENTAÇÃO DE ESPECIFICAÇÕES.
 *
 * É o documento que a casa mostra ao cliente: uma capa com os dados do
 * projeto e, depois, um slide por ambiente — o render grande, e por cima
 * dele as etiquetas dizendo o que é cada peça.
 *
 * As medidas saíram do PDF que ela mandou (2307): a página é 960×540 pt,
 * 16:9, e a capa tem os rótulos desenhados na própria arte, com os
 * valores escritos ao lado de cada um.
 *
 * O QUE UM PROGRAMA NÃO SABE FAZER: onde vai cada etiqueta. Elas ficam
 * sobre o render, apontando pra peça — e nenhuma conta descobre onde
 * está o sofá. Então as etiquetas nascem distribuídas na borda e são
 * arrastadas. Automático até onde dá, manual só no que exige olho.
 */

export const LARGURA = 960;
export const ALTURA = 540;

/* Onde cada valor entra na capa. Medido no PDF dela, em pontos, com a
   origem no ALTO à esquerda — que é como se pensa numa tela; a conversão
   pro sistema do PDF (origem embaixo) fica num lugar só, na hora de
   desenhar. */
/* `x` e' onde entra o VALOR; `rotuloX`/`rotuloL`, onde esta' o rotulo
   desenhado na arte — usados so' na emissao em ingles, pra cobrir a
   palavra em portugues e reescrever por cima. Data e Rev dividem a mesma
   linha, entao cada um cobre so' o seu pedaco: usar a mesma posicao pros
   dois fez a tarja do Rev apagar o "Date" recem-escrito. */
export const CAMPOS_CAPA = [
  { id: "squad",   x: 200, y: 72,  tamanho: 12, rotuloX: 74,  rotuloL: 120 },
  { id: "cliente", x: 200, y: 308, tamanho: 12, rotuloX: 74,  rotuloL: 120 },
  { id: "projeto", x: 200, y: 362, tamanho: 12, rotuloX: 74,  rotuloL: 120 },
  { id: "data",    x: 112, y: 414, tamanho: 12, rotuloX: 74,  rotuloL: 34 },
  { id: "rev",     x: 339, y: 414, tamanho: 12, rotuloX: 256, rotuloL: 34 },
  { id: "local",   x: 200, y: 466, tamanho: 12, rotuloX: 74,  rotuloL: 120, linhas: 2 },
];

export const TITULO_PADRAO = "APRESENTAÇÃO DE ESPECIFICAÇÕES";

/* A etiqueta é branca sobre o render. Fundo escuro atrás dela não é
   enfeite: render claro engole texto branco, e a apresentação é vista em
   projetor, onde contraste some. */
export const ETIQUETA = {
  tamanho: 10,
  entrelinha: 12,
  recuo: 5,
  larguraMax: 190,
  maxLinhas: 3,
};

/* A tarja "TKWS | AMBIENTE" ocupa o rodapé. Etiqueta que nasce em cima
   dela fica ilegível — e nasceu, na primeira geração de teste. */
export const RODAPE = 30;

export const novaApresentacao = (obra) => ({
  obraCodigo: obra?.codigo ? String(obra.codigo) : null,
  capa: {
    squad: obra?.squad || "",
    cliente: obra?.cliente && obra.cliente !== "—" ? obra.cliente : "",
    projeto: obra?.codigo ? String(obra.codigo) : "",
    data: new Date().toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }).replace("/", "/"),
    rev: "00",
    local: obra?.endereco && obra.endereco !== "—" ? obra.endereco : "",
    titulo: TITULO_PADRAO,
  },
  slides: [],
});

export const novoSlide = (ambiente = "") => ({
  id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  ambiente,
  imagem: null,          // caminho no bucket
  etiquetas: [],
});

/* Quebra o texto da etiqueta em linhas curtas.
 *
 * Sem isto, "SOFÁ ELYSIUM NOA MODULO 220CM + 90CM + MODULO CHAISE 140CM"
 * vira uma faixa de 400pt atravessando o render. No documento dela essas
 * descrições vêm quebradas em duas ou três linhas — é assim que cabem. */
export function quebrar(texto, porLinha = 26) {
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

/**
 * Onde as etiquetas nascem.
 *
 * Distribuídas pela borda, em sentido horário, começando pelo alto à
 * esquerda: nunca em cima umas das outras, nunca fora da página, e nunca
 * no meio — o meio é onde está o render que elas descrevem.
 *
 * É um ponto de partida pra arrastar, não uma tentativa de acertar.
 */
export function posicaoInicial(i, total) {
  const margem = 24;
  const faixa = 210;                       // largura reservada de cada lado
  /* O primeiro y possível e o último: embaixo, a etiqueta inteira
     (até 3 linhas) tem que caber ACIMA da tarja do rodapé. */
  const topo = margem + 8;
  const base = ALTURA - RODAPE - ETIQUETA.maxLinhas * ETIQUETA.entrelinha - margem;

  const doLado = Math.ceil(total / 2);
  const esquerda = i < doLado;
  const k = esquerda ? i : i - doLado;
  const quantos = esquerda ? doLado : total - doLado;
  const passo = quantos > 1 ? (base - topo) / (quantos - 1) : 0;
  return {
    x: esquerda ? margem : LARGURA - margem - faixa,
    y: quantos > 1 ? topo + k * passo : (topo + base) / 2,
  };
}

/** Produto do catálogo vira etiqueta. O texto continua editável depois. */
export function produtoParaEtiqueta(p, i, total) {
  const { x, y } = posicaoInicial(i, total);
  return {
    id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    produtoId: p.id || null,
    texto: p.descricao || "",
    x, y,
  };
}

/* Quantos slides, quantas etiquetas, e o que falta — a tela precisa
   dizer isso antes de gerar, porque gerar um PDF de 40 páginas pra
   descobrir que um ambiente ficou sem imagem é caro. */
export function conferir(doc) {
  const slides = doc?.slides || [];
  return {
    slides: slides.length,
    etiquetas: slides.reduce((a, s) => a + (s.etiquetas || []).length, 0),
    semImagem: slides.filter((s) => !s.imagem).map((s) => s.ambiente || "sem nome"),
    semAmbiente: slides.filter((s) => !String(s.ambiente || "").trim()).length,
    pronto: slides.length > 0 && slides.every((s) => s.imagem && String(s.ambiente || "").trim()),
  };
}

/* O nome do arquivo é o que vai aparecer em Arquivos da obra. Segue o
   padrão do documento dela: 2307_PE_ESPECIFICACOES. */
export function nomeDoArquivo(doc) {
  const cod = doc?.capa?.projeto || doc?.obraCodigo || "obra";
  const rev = doc?.capa?.rev ? `_REV${doc.capa.rev}` : "";
  return `${cod}_PE_ESPECIFICACOES${rev}.pdf`;
}
