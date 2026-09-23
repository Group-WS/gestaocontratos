/* O RESUMO DE UMA IMPORTACAO — funcoes puras, sem rede.
 *
 * Separadas de importacoes.js (que fala com a API) para serem testadas no
 * Node: src/__testes__/importacao-resumo.test.mjs. Ver o porque de tudo no
 * topo de importacoes.js.
 */

/** Os tres documentos que se importam, com o rotulo e o campo da verba. */
export const DOCUMENTOS = {
  vendido_contrato: { rotulo: "Vendido Contrato", campo: "itensContrato" },
  vendido_planilha: { rotulo: "Vendido Planilha", campo: "itensPlanilha" },
  planilha_executivo: { rotulo: "Planilha Executivo", campo: "itensPlanilhaExecutivo" },
};

const qtd = (lista) => (Array.isArray(lista) ? lista.length : 0);

/**
 * O que a importacao vai fazer com as verbas, sem aplicar nada.
 *
 * Espelha a regra de aplicarItensNasVerbas: verba que veio no arquivo e'
 * TROCADA; verba que ja' tinha itens e nao veio FICA como estava. Grupo
 * fora da EAP padrao e' identificado pelo nome.
 *
 * `numsExtras`: verbas que o documento toca sem trazer item — o Vendido
 * Contrato traz o valor vendido por verba mesmo onde nao le itens.
 *
 * @returns {{
 *   trocadas: {num, nome, antes, depois}[],
 *   mantidas: {num, nome, itens}[],
 *   nItens: number,
 *   itensAntes: number,
 *   haviaConteudo: boolean,
 * }}
 */
export function resumoDaImportacao(categorias, itens, campo, numsExtras = []) {
  const cats = Array.isArray(categorias) ? categorias : [];
  const lista = Array.isArray(itens) ? itens : [];

  const porNum = new Map();
  const porGrupoFora = new Map();
  lista.forEach((it) => {
    if (it?.foraDoPadrao) {
      const nome = it.grupoOriginal || "Grupo não identificado";
      porGrupoFora.set(nome, (porGrupoFora.get(nome) || 0) + 1);
    } else if (it?.num) {
      porNum.set(String(it.num), (porNum.get(String(it.num)) || 0) + 1);
    }
  });
  numsExtras.forEach((n) => { if (n != null && !porNum.has(String(n))) porNum.set(String(n), 0); });

  const trocadas = [];
  const mantidas = [];
  let itensAntes = 0;

  cats.forEach((c) => {
    const antes = qtd(c[campo]);
    itensAntes += antes;
    if (c.foraDaEapPadrao) {
      if (porGrupoFora.has(c.nome)) {
        trocadas.push({ num: c.num, nome: c.nome, antes, depois: porGrupoFora.get(c.nome) });
        porGrupoFora.delete(c.nome);
      } else if (antes > 0) {
        mantidas.push({ num: c.num, nome: c.nome, itens: antes });
      }
      return;
    }
    const num = String(c.num);
    if (porNum.has(num)) {
      trocadas.push({ num: c.num, nome: c.nome, antes, depois: porNum.get(num) });
    } else if (antes > 0) {
      mantidas.push({ num: c.num, nome: c.nome, itens: antes });
    }
  });
  // Grupo fora do padrao que ainda nao existia na obra: entra como novo.
  porGrupoFora.forEach((depois, nome) => trocadas.push({ num: "—", nome, antes: 0, depois }));

  return { trocadas, mantidas, nItens: lista.length, itensAntes, haviaConteudo: itensAntes > 0 };
}

const MAX_NOMES = 6;
const nomeDaVerba = (v) => (v.num && v.num !== "—" ? `${v.num} ${v.nome}` : v.nome);
function listaCurta(verbas) {
  const nomes = verbas.slice(0, MAX_NOMES).map(nomeDaVerba);
  const resto = verbas.length - nomes.length;
  return resto > 0 ? `${nomes.join(", ")} e mais ${resto}` : nomes.join(", ");
}
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/**
 * O texto do aviso, em linhas (a tela junta com quebra). So' faz sentido
 * quando `resumo.haviaConteudo`: a primeira importacao nao tem o que avisar.
 */
export function linhasDoAviso(resumo) {
  const { trocadas, mantidas, nItens, itensAntes } = resumo;
  const linhas = [
    `O arquivo traz ${plural(nItens, "item", "itens")}. Hoje a obra tem ${plural(itensAntes, "item", "itens")} deste documento.`,
  ];
  if (trocadas.length) {
    linhas.push(`Serão trocadas ${plural(trocadas.length, "verba", "verbas")}: ${listaCurta(trocadas)}.`);
  }
  if (mantidas.length) {
    const nMantidos = mantidas.reduce((a, v) => a + v.itens, 0);
    linhas.push(
      `Ficam como estão ${plural(mantidas.length, "verba", "verbas")} que não vieram no arquivo ` +
      `(${plural(nMantidos, "item", "itens")} da importação anterior): ${listaCurta(mantidas)}.`,
    );
  } else {
    linhas.push("Nenhuma verba fica com dado da importação anterior.");
  }
  return linhas;
}

/** A extensao do arquivo, em minusculas ("xlsx", "pdf"). */
export function formatoDoArquivo(nome) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(String(nome || ""));
  return m ? m[1].toLowerCase() : null;
}
