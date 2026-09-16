/* A EAP do Sienge — leitura do relatório de orçamento em Excel.
 *
 * É essa estrutura que diz ONDE cada produto comprado é apropriado. Toda
 * solicitação de compra exige uma referência de item do orçamento
 * (`costEstimationItemReference`, ex. "04.001.001.001") e uma unidade
 * construtiva — e nenhum dos dois existia no GC antes disto.
 *
 * O relatório tem quatro níveis; só a FOLHA (nível 4) é apropriável. Os
 * três de cima existem pra agrupar, e entram no cadastro só pra tela
 * poder mostrar a árvore como o Sienge mostra.
 *
 * Muita família separa material de mão de obra na folha:
 *   04.001.001.001  Climatização, ventilação e exaustão [MAT]
 *   04.001.001.002  Climatização, ventilação e exaustão [MO]
 * Em Compras de Produtos vale sempre a [MAT] — ver `ehMaterial` abaixo.
 */
import { semelhanca } from "./sienge.js";

/* Sem acento, minúsculo, sem espaço sobrando — pra achar rótulo de
   cabeçalho sem depender de como foi digitado. */
const norm = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* O código vem com espaço no fim ("04.001 ") e em quatro formas:
   nn · nn.nnn · nn.nnn.nnn · nn.nnn.nnn.nnn */
const RE_CODIGO = /^\d{2}(\.\d{3}){0,3}$/;

/* "9 - EAP INICIAL - TKWS INTERIORES" → { id: 9, nome: "EAP INICIAL - TKWS INTERIORES" }
   O nome também tem hífen, então só o PRIMEIRO separa. */
function idENome(txt) {
  const m = String(txt ?? "").trim().match(/^(\d+)\s*-\s*(.+)$/);
  return m ? { id: Number(m[1]), nome: m[2].trim() } : { id: null, nome: String(txt ?? "").trim() || null };
}

/* "15/04/2026" → "2026-04-15" (o que o Postgres aceita em `date`).
   Qualquer outra forma volta nula em vez de virar data errada. */
function dataISO(txt) {
  const m = String(txt ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** A folha é de material? `[MAT]` e `[MAT/MO]` sim, `[MO]` não. */
export function ehMaterial(descricao) {
  const d = norm(descricao);
  if (/\[\s*mo\s*\]/.test(d)) return false;
  return true;
}

/**
 * Lê o relatório de orçamento do Sienge.
 *
 * Recebe as linhas cruas da planilha (`XLSX.utils.sheet_to_json(ws, { header: 1 })`),
 * como `parsePedidoSiengeExcel` — o arquivo é lido por quem chama.
 *
 * Devolve `{ versao, itens, avisos }`. Os avisos NÃO travam nada: eles
 * aparecem na tela antes da pessoa confirmar a importação, porque uma
 * planilha meio lida é pior calada do que recusada.
 */
export function parseEapSienge(linhas) {
  const L = (linhas || []).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim()));
  const avisos = [];

  /* Cabeçalho: os rótulos ficam na coluna A e o valor mais à direita, em
     coluna que muda de relatório pra relatório (célula mesclada). Em vez
     de fixar a coluna, pega o primeiro valor não vazio depois do rótulo. */
  const valorDe = (re) => {
    const linha = L.find((r) => re.test(norm(r[0])));
    if (!linha) return null;
    for (let c = 1; c < linha.length; c++) {
      const v = String(linha[c] ?? "").trim();
      if (v) return v;
    }
    return null;
  };

  const unidade = idENome(valorDe(/^unidade construtiva$/));
  const obra = valorDe(/^obra$/);
  const versaoOrcamento = valorDe(/^versao do orcamento$/);
  // "Data base" divide a linha com "Versão do orçamento" — o rótulo não
  // está na coluna A, então procura em qualquer célula.
  const linhaData = L.find((r) => r.some((c) => /^data base$/.test(norm(c))));
  const dataBase = linhaData
    ? dataISO(linhaData.slice().reverse().map((c) => String(c ?? "").trim()).find(Boolean))
    : null;

  if (!unidade.id) avisos.push("A planilha não traz a unidade construtiva no cabeçalho — ela é obrigatória na apropriação.");

  const itens = [];
  const vistos = new Set();
  for (const r of L) {
    const codigo = String(r[0] ?? "").trim();
    if (!RE_CODIGO.test(codigo)) continue;
    if (vistos.has(codigo)) { avisos.push(`Código repetido na planilha: ${codigo} — ficou a primeira ocorrência.`); continue; }
    vistos.add(codigo);
    const nivel = codigo.split(".").length;
    itens.push({
      codigo,
      descricao: String(r[2] ?? "").trim(),
      nivel,
      unidade: String(r[13] ?? "").trim() || null,
      folha: nivel === 4,
    });
  }

  const folhas = itens.filter((i) => i.folha);
  if (!folhas.length) {
    avisos.push("Nenhum item apropriável (nível 4) encontrado — confira se é o relatório de orçamento do Sienge.");
  }
  // Folha sem o pai de nível 3 não quebra o envio (a referência é o
  // código inteiro), mas quebra a árvore da tela — melhor dizer.
  const codigos = new Set(itens.map((i) => i.codigo));
  folhas.forEach((f) => {
    const pai = f.codigo.split(".").slice(0, 3).join(".");
    if (!codigos.has(pai)) avisos.push(`A folha ${f.codigo} não tem o grupo ${pai} na planilha.`);
  });

  return {
    versao: {
      nome: unidade.nome,
      unidadeId: unidade.id,
      obraModelo: obra,
      versaoOrcamento,
      dataBase,
    },
    itens,
    avisos,
  };
}

/* Sugestão de folha pra uma verba do GC.
 *
 * SUGESTÃO, e só: as duas EAPs têm numeração e nomes diferentes ("20
 * Climatização / Exaustão" × "04.001.001.001 Climatização, ventilação e
 * exaustão [MAT]"), e apropriar na conta errada é um erro que o Sienge
 * aceita calado — o código existe, só não é aquele. Quem confirma é a
 * pessoa; esta função só poupa a procura na lista de 53.
 *
 * Empate vai pra [MAT]: aqui só passa compra de produto.
 */
export function sugerirFolha(nomeVerba, itens, minimo = 0.34) {
  let melhor = null;
  folhasDaEap(itens).forEach((f) => {
    // O sufixo [MAT]/[MO] não descreve a coisa — tirar antes de comparar
    // evita que ele conte como palavra em comum entre folhas diferentes.
    const limpo = f.descricao.replace(/\[\s*mat(\s*\/\s*mo)?\s*\]|\[\s*mo\s*\]/gi, " ");
    const nota = semelhanca(nomeVerba, limpo);
    if (nota < minimo) return;
    if (!melhor || nota > melhor.nota || (nota === melhor.nota && ehMaterial(f.descricao) && !ehMaterial(melhor.folha.descricao))) {
      melhor = { folha: f, nota };
    }
  });
  return melhor;
}

/** Só as folhas, que são as únicas que a apropriação aceita. */
export function folhasDaEap(itens) {
  return (itens || []).filter((i) => i.folha);
}

/** Índice código → item, pra tela resolver a descrição de um código salvo. */
export function porCodigo(itens) {
  return new Map((itens || []).map((i) => [i.codigo, i]));
}
