/**
 * O IDENTIFICADOR DA LINHA DO EXECUTIVO (ADR-007, 23/09/2026).
 *
 * A planilha do Executivo (`itensPlanilhaExecutivo`) e a lista de trabalho
 * da verba (`itens`, que a Conferência, o Plano e as Compras leem) nascem
 * iguais e depois se separam: a mão de obra das verbas de contrato vira
 * linha própria, entram trocas, sai item. Até aqui uma linha achava a outra
 * pela DESCRIÇÃO — e quatro "Painel de embutir ECO 18W" em ambientes
 * diferentes viravam um só: aprovar dois travava os quatro no Executivo, e
 * editar um gravava nos quatro.
 *
 * Agora cada linha leva `idLinha`, e o item da lista de trabalho leva o
 * mesmo id da linha de onde veio. A linha de mão de obra separada leva o id
 * do produto (é o mesmo produto).
 */

/** Um id novo de linha. */
export function novoIdDeLinha() {
  return globalThis.crypto.randomUUID();
}

/** A linha com id: mantém o que já tem, dá um novo a quem não tem. */
export function comIdDeLinha(linha, gerar = novoIdDeLinha) {
  if (!linha || linha.idLinha) return linha;
  return { ...linha, idLinha: gerar() };
}

const normal = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** O que identifica o produto: descrição, ambiente, especificação, fornecedor e unidade. */
export function identidadeDoProduto(it) {
  return [it?.desc, it?.ambiente, it?.especificacao, it?.marca, it?.un].map(normal).join("|");
}

const agrupar = (lista, filtro) => {
  const grupos = new Map();
  (lista || []).forEach((it, i) => {
    if (!filtro(it)) return;
    const k = identidadeDoProduto(it);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(i);
  });
  return grupos;
};

/**
 * MIGRAÇÃO: casa as linhas de UMA verba que ainda não têm id.
 *
 * Só casa com certeza: uma linha do Executivo e um item de material com a
 * MESMA identidade, os dois únicos na verba. A linha de mão de obra separada
 * (`separadoDe`) leva o id do produto dela. O que empata (duas linhas iguais
 * em tudo) ou não tem par fica sem id — a tela trata pela descrição, do lado
 * seguro — e volta no relatório.
 *
 * @returns {{ categoria: object, casadas: number, semPar: object[], empates: object[] }}
 */
export function casarLinhasDaVerba(categoria, gerar = novoIdDeLinha) {
  const exe = [...(categoria?.itensPlanilhaExecutivo || [])];
  const itens = [...(categoria?.itens || [])];
  const semId = (it) => !!it && !it.idLinha && !it.ehTitulo;
  const porExe = agrupar(exe, semId);
  const porMaterial = agrupar(itens, (it) => semId(it) && !it.separadoDe);
  const porMO = agrupar(itens, (it) => semId(it) && !!it.separadoDe);
  const resumo = (it) => ({ desc: it.desc ?? null, ambiente: it.ambiente ?? null, codigo: it.codigo ?? null });
  let casadas = 0;
  const semPar = [];
  const empates = [];

  for (const [k, iExe] of porExe) {
    const iMat = porMaterial.get(k) || [];
    if (iExe.length === 1 && iMat.length === 1) {
      const id = gerar();
      exe[iExe[0]] = { ...exe[iExe[0]], idLinha: id };
      itens[iMat[0]] = { ...itens[iMat[0]], idLinha: id };
      (porMO.get(k) || []).forEach((i) => { itens[i] = { ...itens[i], idLinha: id }; });
      casadas += 1;
    } else if (iMat.length === 0) {
      iExe.forEach((i) => semPar.push({ lado: "executivo", ...resumo(exe[i]) }));
    } else {
      iExe.forEach((i) => empates.push({ lado: "executivo", ...resumo(exe[i]) }));
    }
  }
  for (const [k, iMat] of porMaterial) {
    if (!porExe.has(k)) iMat.forEach((i) => semPar.push({ lado: "lista de trabalho", ...resumo(itens[i]) }));
  }

  return { categoria: { ...categoria, itensPlanilhaExecutivo: exe, itens }, casadas, semPar, empates };
}

/** MIGRAÇÃO: a obra inteira. `mudou` diz se alguma linha ganhou id. */
export function casarLinhasDaObra(categorias, gerar = novoIdDeLinha) {
  let casadas = 0;
  const semPar = [];
  const empates = [];
  const novas = (categorias || []).map((c) => {
    const r = casarLinhasDaVerba(c, gerar);
    casadas += r.casadas;
    r.semPar.forEach((x) => semPar.push({ verba: c.num, ...x }));
    r.empates.forEach((x) => empates.push({ verba: c.num, ...x }));
    return r.casadas ? r.categoria : c;
  });
  return { categorias: novas, casadas, semPar, empates, mudou: casadas > 0 };
}
