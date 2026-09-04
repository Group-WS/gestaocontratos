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

/* Preço em texto vira centavos inteiros. A planilha padrão da casa vem
   em formato brasileiro ("1.213,11"), mas planilha de fornecedor pode
   vir formatada em inglês pelo próprio Excel ("R$ 1,091.00" — vírgula de
   milhar, ponto decimal). Não dá pra confiar no formato: tem que achar
   qual separador é o decimal pela POSIÇÃO — o último separador da string,
   se tiver 1 ou 2 dígitos depois dele, é o decimal; os outros são milhar.
   Coluna vazia ou sem número não é erro, é produto sem preço ainda. */
const precoDeTexto = (v) => {
  const t = texto(v).replace(/[^\d,.-]/g, "");
  if (!t) return null;
  const ultimoSeparador = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  let limpo;
  if (ultimoSeparador === -1) {
    limpo = t;
  } else {
    const casasDecimais = t.length - ultimoSeparador - 1;
    limpo = casasDecimais === 1 || casasDecimais === 2
      ? `${t.slice(0, ultimoSeparador).replace(/[,.]/g, "")}.${t.slice(ultimoSeparador + 1)}`
      : t.replace(/[,.]/g, "");
  }
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

/* Um título de grupo está SOZINHO na linha — ou acompanhado só de zeros,
   que é como a planilha preenche o que não tem. */
const ehTituloDeGrupo = (r) => {
  const c = r.map(texto);
  if (!c[0]) return false;
  return !c.slice(1).some((x) => x && x !== "0");
};

/* O cabeçalho nem sempre tem IMAGEM na coluna 0 e DESCRIÇÃO na 1 — a
   planilha de metais, por exemplo, começa com duas colunas de cadastro
   interno antes disso. Então a checagem é "em algum lugar da linha", não
   por posição. */
const ehCabecalho = (r) => {
  const h = r.map(norm);
  return h.some((c) => c.includes("imagem")) && h.some((c) => c.includes("descri"));
};

function acharColunaCab(header, padroes, ignorar) {
  for (let i = 0; i < header.length; i++) {
    if (ignorar && ignorar.has(i)) continue;
    if (padroes.some((p) => p.test(header[i]))) return i;
  }
  return -1;
}

/* Descobre onde está cada dado a partir do TEXTO do cabeçalho, em vez de
   supor posição fixa. A planilha padrão da casa (IMAGEM|DESCRIÇÃO|CÓDIGO|
   FORNECEDOR|OBSERVAÇÕES|PREÇO) e a de metais (que separa DESCRIÇÃO -
   CRIATIVO de DESCRIÇÃO - EXECUTIVO e troca a ordem das colunas) caem
   nas mesmas chaves aqui. */
function colunasDoCabecalho(headerBruto) {
  const h = (headerBruto || []).map(norm);
  const usadas = new Set();
  const reservar = (padroes) => {
    const i = acharColunaCab(h, padroes, usadas);
    if (i >= 0) usadas.add(i);
    return i;
  };
  const descCriativo = reservar([/descri.*criativ/]);
  let descExec = reservar([/descri.*execut/, /descri.*tecnic/]);
  if (descExec < 0) descExec = reservar([/descri/]);
  const codigo = reservar([/codigo/, /especifica/]);
  const fornecedor = reservar([/fornecedor/]);
  const preco = reservar([/preco/, /^valor$/]);
  const obs = reservar([/observa/]);
  return { descExec, descCriativo, codigo, fornecedor, preco, obs };
}

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
  /* Posição da planilha padrão, valendo até a primeira linha de
     cabeçalho aparecer — na prática o cabeçalho sempre vem antes dos
     itens, isso é só uma rede de segurança. */
  let cols = { descExec: 1, descCriativo: -1, codigo: 2, fornecedor: 3, preco: 5, obs: 4 };

  (linhas || []).forEach((r, i) => {
    if (!Array.isArray(r) || !r.some((c) => texto(c))) return;
    if (ehCabecalho(r)) { cols = colunasDoCabecalho(r); return; }
    if (ehTituloDeGrupo(r)) {
      grupo = texto(r[0]);
      verba = verbaDoGrupo(grupo, apelidos);
      return;
    }
    const campo = (idx) => (idx >= 0 ? texto(r[idx]) : "");
    /* Quando a planilha separa criativo de executivo, a descrição
       "principal" do produto é a executiva — a criativa é guardada à
       parte. Se só uma das duas vier preenchida na linha, essa é a
       descrição do produto. */
    const descricao = campo(cols.descExec) || campo(cols.descCriativo);
    if (!descricao) return;
    const descricaoCriativo = campo(cols.descCriativo);

    saida.push({
      linha: i,                        // 0-based, igual à âncora do desenho
      grupo,
      verba,
      descricao,
      descricaoCriativo: descricaoCriativo || null,
      codigo: campo(cols.codigo) || null,
      /* "FORNECEDOR " vem com espaço no cabeçalho e os valores vêm com
         espaço no fim: "Herval ". Espaço sobrando cria fornecedor
         duplicado que ninguém consegue juntar depois. */
      fornecedor: campo(cols.fornecedor) || null,
      observacoes: campo(cols.obs) || null,
      precoRef: cols.preco >= 0 ? precoDeTexto(r[cols.preco]) : null,
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
