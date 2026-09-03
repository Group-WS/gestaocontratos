import { subgrupoDe } from "./catalogoModelo.js";

/**
 * Importa a planilha de padronização de produtos.
 *
 * A planilha da casa é assim:
 *
 *   ILUMINAÇÃO                                      <- título de grupo, sozinho na linha
 *   IMAGEM | DESCRIÇÃO | CÓDIGO | FORNECEDOR | OBS  <- cabeçalho, repetido a cada grupo
 *          | SPOT EMBUTIDO ...  | 6730  | NORDECOR
 *
 * E as fotos NÃO estão em célula nenhuma: são desenhos ancorados a uma
 * linha, guardados dentro do .xlsx como arquivos separados. Sem ler a
 * âncora, a coluna IMAGEM chega aqui vazia e o catálogo nasce sem a única
 * coisa que faz alguém reconhecer a peça.
 *
 * Tudo isto roda no NAVEGADOR, com o login de quem está importando. Não
 * há script com chave de banco em lugar nenhum — foi decisão, não acaso.
 */

const norm = (s) => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]/gi, "").toLowerCase();

const texto = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/* Preço em texto brasileiro ("1.213,11", "R$ 45,00") vira centavos
   inteiros — o mesmo formato que o resto do catálogo usa. Coluna vazia
   ou sem número não é erro, é produto sem preço ainda. */
const precoDeTexto = (v) => {
  const t = texto(v).replace(/[^\d,.-]/g, "");
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

/* Um título de grupo está SOZINHO na linha — ou acompanhado só de zeros,
   que é como a planilha preenche o que não tem. */
const ehTituloDeGrupo = (r) => {
  const c = r.map(texto);
  if (!c[0]) return false;
  return !c.slice(1).some((x) => x && x !== "0");
};

const ehCabecalho = (r) =>
  /imagem/i.test(texto(r[0])) && /descri/i.test(texto(r[1]));

/* O grupo da planilha vira VERBA da EAP pelo mesmo motor do resto do app:
   o apelido mais longo ganha, porque é o mais específico. */
export function verbaDoGrupo(nomeDoGrupo, apelidos) {
  const t = norm(nomeDoGrupo);
  if (!t) return null;
  let achado = null, melhor = 0;
  Object.entries(apelidos || {}).forEach(([num, aps]) => {
    (aps || []).forEach((ap) => {
      if (ap.length > melhor && t.includes(ap)) { achado = num; melhor = ap.length; }
    });
  });
  return achado;
}

/**
 * Lê as linhas da planilha.
 *
 * `linhas` é o array de arrays do XLSX (header: 1). Devolve produtos com
 * o número da linha preservado — é por ele que a foto encontra o produto.
 */
export function lerProdutos(linhas, apelidos) {
  const saida = [];
  let grupo = null, verba = null;

  (linhas || []).forEach((r, i) => {
    if (!Array.isArray(r) || !r.some((c) => texto(c))) return;
    if (ehCabecalho(r)) return;
    if (ehTituloDeGrupo(r)) {
      grupo = texto(r[0]);
      verba = verbaDoGrupo(grupo, apelidos);
      return;
    }
    const descricao = texto(r[1]);
    if (!descricao) return;

    saida.push({
      linha: i,                        // 0-based, igual à âncora do desenho
      grupo,
      verba,
      descricao,
      codigo: texto(r[2]) || null,
      /* "FORNECEDOR " vem com espaço no cabeçalho e os valores vêm com
         espaço no fim: "Herval ". Espaço sobrando cria fornecedor
         duplicado que ninguém consegue juntar depois. */
      fornecedor: texto(r[3]) || null,
      observacoes: texto(r[4]) || null,
      precoRef: precoDeTexto(r[5]),
      subgrupo: subgrupoDe(descricao, verba),
    });
  });

  return saida;
}

/**
 * Onde está cada foto.
 *
 * O desenho guarda `<xdr:from><xdr:row>N` e um `r:embed="rIdX"`; o
 * arquivo de relações liga `rIdX` a `xl/media/imageY.png`. Sem juntar os
 * dois não há como saber de quem é a foto.
 */
export function ancorasDeImagem(drawingXml, relsXml) {
  if (!drawingXml || !relsXml) return new Map();
  const rel = new Map();
  for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    const alvo = m[2].split("/").pop();
    if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(alvo)) rel.set(m[1], `xl/media/${alvo}`);
  }
  const mapa = new Map();
  for (const m of drawingXml.matchAll(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?r:embed="([^"]+)"/g)) {
    const caminho = rel.get(m[2]);
    /* Primeira foto da linha ganha. Duas imagens na mesma linha é caso
       de planilha remontada, e escolher a segunda seria escolher no
       escuro. */
    if (caminho && !mapa.has(Number(m[1]))) mapa.set(Number(m[1]), caminho);
  }
  return mapa;
}

/** Junta as duas leituras: produto + caminho da foto dentro do .xlsx. */
export function juntar(produtos, ancoras) {
  return (produtos || []).map((p) => ({ ...p, arquivoImagem: ancoras.get(p.linha) || null }));
}

/**
 * O que a tela precisa dizer antes de gravar nada.
 *
 * Importação é gravação em massa: a pessoa tem que ver o que vai entrar,
 * e principalmente o que NÃO vai — grupo que não virou verba é produto
 * que ficaria órfão, e é melhor saber antes.
 */
export function resumoDaImportacao(produtos) {
  const semVerba = produtos.filter((p) => !p.verba);
  const gruposSemVerba = [...new Set(semVerba.map((p) => p.grupo).filter(Boolean))];
  const porGrupo = new Map();
  produtos.forEach((p) => {
    const k = p.grupo || "sem grupo";
    porGrupo.set(k, (porGrupo.get(k) || 0) + 1);
  });
  return {
    total: produtos.length,
    validos: produtos.length - semVerba.length,
    comFoto: produtos.filter((p) => p.arquivoImagem).length,
    comPreco: produtos.filter((p) => p.precoRef != null).length,
    fornecedores: [...new Set(produtos.map((p) => p.fornecedor).filter(Boolean))],
    semSubgrupo: produtos.filter((p) => p.verba && !p.subgrupo).length,
    gruposSemVerba,
    porGrupo: [...porGrupo.entries()],
  };
}
