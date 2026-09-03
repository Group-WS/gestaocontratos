import { subgrupoDe } from "./catalogoModelo.js";

/**
 * Lê a biblioteca de materiais em .pptx.
 *
 * O arquivo "ARQUIVOS BASE EXECUTIVO" é uma amostragem: cada slide traz o
 * nome da família no rodapé e, dentro, pares de FOTO + LEGENDA logo
 * abaixo dela. Não há tabela, não há coluna — a informação está na
 * GEOMETRIA, e é dela que a leitura sai.
 *
 * Duas medidas do arquivo, e não de suposição:
 *   - o slide é 1280×720 px a 96 dpi (12192000×6858000 EMU);
 *   - a legenda fica logo abaixo da foto e alinhada com ela.
 */

const EMU_PX = 9525;                       // EMU por pixel a 96 dpi

const texto = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

function formas(xml) {
  const out = [];
  for (const m of xml.matchAll(/<p:(pic|sp)\b([\s\S]*?)<\/p:\1>/g)) {
    const c = m[2];
    const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(c);
    if (!off) continue;
    const [x, y, w, h] = off.slice(1, 5).map((v) => Number(v) / EMU_PX);
    const emb = /r:embed="([^"]+)"/.exec(c);
    const txt = texto([...c.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join(" "));
    out.push({ tipo: m[1], x, y, w, h, rel: emb ? emb[1] : null, texto: txt });
  }
  return out;
}

/* O título do slide: a linha do rodapé, que nomeia a família inteira
   ("ARQUIVOS BASE EXECUTIVO – PEDRAS"). É o único lugar do arquivo que
   diz de que grupo aquelas amostras são. */
function tituloDoSlide(fs) {
  const rodape = fs.filter((f) => f.tipo === "sp" && f.texto && f.y > 600);
  const cand = rodape.find((f) => /ARQUIVOS BASE|^TKWS/i.test(f.texto)) || rodape[0];
  return cand ? cand.texto : "";
}

/**
 * A legenda de cada foto.
 *
 * É o texto que começa ABAIXO da foto e cruza com ela na horizontal — o
 * mais próximo vence. Sem a exigência de cruzar na horizontal, a legenda
 * do vizinho da esquerda seria roubada em slides com quatro colunas.
 */
function legendaDe(pic, textos) {
  let melhor = null, dist = Infinity;
  for (const t of textos) {
    if (t.usada) continue;
    const abaixo = t.y >= pic.y + pic.h - 6;
    if (!abaixo) continue;
    const cruza = t.x < pic.x + pic.w && t.x + t.w > pic.x;
    if (!cruza) continue;
    const d = (t.y - (pic.y + pic.h)) + Math.abs((t.x + t.w / 2) - (pic.x + pic.w / 2)) * 0.35;
    if (d < dist) { dist = d; melhor = t; }
  }
  /* Longe demais não é legenda — é outra fileira. Meia altura de foto é
     o limite: abaixo disso a legenda pertence à fila de baixo. */
  if (melhor && dist < pic.h * 0.9 + 60) { melhor.usada = true; return melhor; }
  return null;
}

/* O que a família diz sobre grupo, e sobre ser ACABAMENTO ou PRODUTO.
 *
 * Acabamento é cor e material — MDF, laca, tinta, tecido. Não tem código
 * de compra, não vira linha de orçamento: ele QUALIFICA outra coisa.
 * Produto é peça: torneira, spot, coifa.
 *
 * A ordem importa: o mais específico primeiro. "LÂMINAS" antes de "MDF",
 * porque o título traz os dois. */
const FAMILIAS = [
  /* ACABAMENTO DE MÓVEL SOLTO — foi ela quem enquadrou: "madeira, couro,
     laca, MDF e tecido são acabamentos de móveis soltos". Eu tinha posto
     MDF e laca em Marcenaria e tecido em Estofados, que é onde o material
     PARECE pertencer e não é onde a casa o usa. */
  { casa: /l[âa]mina/i,                verba: "24", tipo: "acabamento", familia: "Lâminas" },
  { casa: /laca/i,                     verba: "24", tipo: "acabamento", familia: "Lacas" },
  { casa: /\bmdf/i,                    verba: "24", tipo: "acabamento", familia: "MDF" },
  { casa: /madeira/i,                  verba: "24", tipo: "acabamento", familia: "Madeiras" },
  { casa: /couro/i,                    verba: "24", tipo: "acabamento", familia: "Couros" },
  { casa: /tecido|boucl/i,             verba: "24", tipo: "acabamento", familia: "Tecidos" },

  /* ACABAMENTO DE MARMORARIA: travertino, quartzito, mármore, granito. */
  { casa: /pedra|m[áa]rmore|granito|travertino|quartzito/i,
                                       verba: "26", tipo: "acabamento", familia: "Pedras" },

  /* ACABAMENTO DE PINTURA, inclusive os efeitos. */
  { casa: /pintura|efeito|textura/i,   verba: "18", tipo: "acabamento", familia: "Pinturas" },

  /* PEÇAS: têm código, têm preço, viram linha de orçamento. */
  { casa: /metais|lou[çc]a/i,          verba: "27", tipo: "produto",    familia: "Metais" },
  { casa: /ilumina|luminot/i,          verba: "05", tipo: "produto",    familia: "Iluminação" },
  { casa: /eletro/i,                   verba: "28", tipo: "produto",    familia: "Eletros" },
  /* CORTINA É ACABAMENTO, a linha inteira — prega, blackout, tecido,
     persiana. Foi ela quem disse: "tudo isso são acabamentos e não
     produtos". Cortina não se compra de catálogo; ela se especifica. */
  { casa: /cortina|persiana|decora/i,  verba: "30", tipo: "acabamento", familia: "Cortinas" },
  { casa: /m[óo]vel|m[óo]veis/i,       verba: "24", tipo: "produto",    familia: "Móveis" },
];

/* ACABAMENTO SE RECONHECE PELA PRÓPRIA DESCRIÇÃO, e não só pelo slide.
 *
 * Um slide de "DECORAÇÃO" traz a persiana (peça) e, ao lado, a prega
 * macho e o blackout embutido — que são jeitos de FAZER a cortina, não
 * coisas que se compram soltas. Sem olhar o item, os dois entrariam
 * iguais, e a prega viraria uma linha de custo no orçamento.
 *
 * Vale nos dois sentidos: uma peça dentro de um slide de acabamento
 * também é reconhecida. */
const ACABAMENTO_NO_NOME =
  /\bprega\b|black\s*out|\btecido|\bbouc|\blaca\b|\bmdf\b|\bl[âa]mina|\bmadeira\b|\bcouro\b|travertino|quartzito|m[áa]rmore|granito|\bpedra\b|\b[óo]nix\b|pintura|textura|\befeito\b|\bcor\s+\d|\blinho\b|\bvo[ií]l/i;

const PECA_NO_NOME =
  /torneira|monocomando|chuveiro|ducha|cuba|tanque|papeleira|cabide|lixeira|spot|pendente|arandela|luminaria|perfil|fonte|coifa|cooktop|forno|geladeira|frigobar|adega|beer|ar\s*condicionado/i;

export function tipoDoItem(descricao, padrao) {
  const t = String(descricao || "");
  if (PECA_NO_NOME.test(t)) return "produto";
  if (ACABAMENTO_NO_NOME.test(t)) return "acabamento";
  return padrao;
}

export function familiaDoTitulo(titulo) {
  const t = String(titulo || "");
  return FAMILIAS.find((f) => f.casa.test(t)) || null;
}

/* O FORNECEDOR costuma estar no próprio título: "MDFS PADRÃO DALMOBILE",
   "PINTURAS SUVINIL", "TECIDOS / BESS TECIDOS". Sem ele, cada amostra
   entraria sem dono e ninguém saberia a quem pedir.
 *
 * O que sobra do título depois de tirar o que NÃO é nome de casa: as
 * palavras de estrutura ("arquivos base executivo", "padrão", "para box
 * de cama") e o nome da própria família ("tecidos", "pinturas"). Sem
 * essa limpeza, o fornecedor dos tecidos de cama saía como "PARA BOX DE
 * CAMA LIFE". */
const VAZIAS = new Set([
  "arquivos", "base", "executivo", "padrao", "para", "de", "do", "da", "e",
  "box", "cama", "linhas", "chamada", "com", "em",
  "mdf", "mdfs", "laca", "lacas", "lamina", "laminas", "pedra", "pedras",
  "metais", "louca", "loucas", "iluminacao", "eletro", "eletros",
  "pintura", "pinturas", "tecido", "tecidos", "decoracao", "movel", "moveis",
  "cortina", "cortinas", "persiana", "persianas",
]);

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function fornecedorDoTitulo(titulo) {
  const bruto = texto(titulo).replace(/^TKWS\s*\|\s*/i, "");
  const palavras = bruto.split(/[\s/|–—-]+/).filter(Boolean);
  const sobra = palavras.filter((w) => !VAZIAS.has(semAcento(w).toLowerCase()));
  /* Mais de três palavras não é nome de fornecedor — é frase, e chutar
     ali coloca lixo no cadastro de quem vende. */
  if (!sobra.length || sobra.length > 3) return null;
  return sobra.join(" ");
}

/**
 * @param slides  [{ xml, rels }] na ordem do arquivo
 * @returns produtos com `arquivoImagem` apontando pro media dentro do zip
 */
export function lerPptx(slides) {
  const saida = [];
  (slides || []).forEach(({ xml, rels }, iSlide) => {
    if (!xml) return;
    const fs = formas(xml);
    const titulo = tituloDoSlide(fs);
    const fam = familiaDoTitulo(titulo);
    if (!fam) return;                       // slide de capa, planta baixa, índice

    const mapa = new Map();
    for (const m of String(rels || "").matchAll(/Id="([^"]+)"[^>]*Target="[^"]*media\/([^"]+)"/g)) {
      if (/\.(png|jpe?g|gif|webp|bmp|emf|wmf)$/i.test(m[2])) mapa.set(m[1], `ppt/media/${m[2]}`);
    }

    const fotos = fs.filter((f) => f.tipo === "pic" && f.rel && mapa.has(f.rel));
    const textos = fs.filter((f) => f.tipo === "sp" && f.texto && f.texto !== titulo)
      .map((t) => ({ ...t }));

    fotos.forEach((p) => {
      const leg = legendaDe(p, textos);
      const descricao = leg ? leg.texto : "";
      if (!descricao) return;               // foto sem legenda não vira produto
      saida.push({
        slide: iSlide + 1,
        titulo,
        familia: fam.familia,
        verba: fam.verba,
        tipoItem: tipoDoItem(descricao, fam.tipo),
        descricao,
        /* Executivo e criativo iguais na importação, como ela pediu: ela
           ajusta depois o que quiser encurtar. Repetir agora é melhor do
           que deixar vazio — vazio some da apresentação. */
        descricaoCriativo: descricao,
        fornecedor: fornecedorDoTitulo(titulo),
        codigo: null,
        observacoes: null,
        subgrupo: subgrupoDe(descricao, fam.verba),
        arquivoImagem: mapa.get(p.rel),
      });
    });
  });
  return saida;
}

/* O MESMO formato do resumo do .xlsx, de propósito: a tela de importação
   não precisa saber de que arquivo veio. */
export function resumoPptx(itens) {
  const porGrupo = new Map();
  (itens || []).forEach((i) => {
    const k = `${i.familia} · ${i.tipoItem === "acabamento" ? "acabamento" : "produto"}`;
    porGrupo.set(k, (porGrupo.get(k) || 0) + 1);
  });
  const validos = (itens || []).filter((i) => i.verba);
  return {
    total: (itens || []).length,
    validos: validos.length,
    comFoto: (itens || []).filter((i) => i.arquivoImagem).length,
    fornecedores: [...new Set((itens || []).map((i) => i.fornecedor).filter(Boolean))],
    semFornecedor: (itens || []).filter((i) => !i.fornecedor).length,
    semSubgrupo: validos.filter((i) => !i.subgrupo).length,
    acabamentos: (itens || []).filter((i) => i.tipoItem === "acabamento").length,
    produtos: (itens || []).filter((i) => i.tipoItem !== "acabamento").length,
    gruposSemVerba: [...new Set((itens || []).filter((i) => !i.verba).map((i) => i.titulo).filter(Boolean))],
    porGrupo: [...porGrupo.entries()],
  };
}
