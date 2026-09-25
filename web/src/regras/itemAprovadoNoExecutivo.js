/**
 * RN-002 — Item aprovado para compra não se edita nem se remove no Executivo.
 *
 * Um item que já foi aprovado para compra na Conferência do executivo — ou
 * que já está andando na compra (solicitado, comprado, com canal, avulso ou
 * de aditivo) — fica travado no Executivo: ninguém edita as células, remove
 * ou substitui, nem o administrador. Para mexer, a aprovação é desfeita
 * antes (e só dá para desfazer o que ainda não andou). Adicionar item novo
 * continua livre.
 *
 * Fora do Executivo (Compras de Produtos) o item aprovado pode mudar, mas
 * cada mudança fica no registro: quem, quando, campo, antes e depois
 * (decisão de 25/09/2026).
 *
 * Ficha: docs/regras-de-negocio/RN-002-item-aprovado-no-executivo.md
 * Decisão: docs/ADR-006-executivo-trava-item-aprovado.md
 * Garantia no banco: supabase/rn-002-item-aprovado-no-executivo.sql e
 *   supabase/rn-002-compras-com-registro.sql (25/09/2026)
 *
 * Função pura: não lê banco, sessão nem relógio.
 */

/** RN-002 — os campos da planilha que o item aprovado não pode mudar. */
export const CAMPOS_TRAVADOS = Object.freeze([
  "desc", "especificacao", "marca", "ambiente", "un",
  "qtdVendida", "qtdExecutivo",
  "custo", "custoUnitario", "custoMaterial", "custoMO", "totalMaterial", "totalMO",
  "excluido",
]);

/* O mesmo "verdadeiro" do JavaScript para os valores que vêm do JSON:
   null, false, "" e 0 não contam. */
const ligado = (v) => v !== undefined && v !== null && v !== false && v !== "" && v !== 0;

/** RN-002 — o item (da lista de trabalho da verba) está aprovado ou já andando na compra? */
export function itemTravadoNoExecutivo(it) {
  if (!it) return false;
  return ["liberadoCompra", "comprado", "canalCompra", "solicitado", "avulso", "aditivo"].some((k) => ligado(it[k]));
}

/**
 * RN-002 — a linha da planilha do Executivo está travada?
 *
 * A linha casa com os itens da verba pelo identificador da linha (`idLinha`,
 * ADR-007): o item e a linha de mão de obra separada dele levam o mesmo id,
 * e basta um deles aprovado para travar. Linha sem id (obra que a migração
 * não conseguiu casar com certeza) fica do lado seguro: casa pela descrição
 * normalizada (`chave`) e trava se QUALQUER item com a mesma descrição
 * estiver aprovado.
 */
export function linhaDoExecutivoTravada(linha, itensDaVerba, chave) {
  if (!linha) return false;
  const itens = Array.isArray(itensDaVerba) ? itensDaVerba : [];
  if (linha.idLinha) return itens.some((it) => it?.idLinha === linha.idLinha && itemTravadoNoExecutivo(it));
  const k = chave(linha.desc);
  return itens.some((it) => chave(it?.desc) === k && itemTravadoNoExecutivo(it));
}

/* A digital da linha: só os campos travados, em ordem fixa. `excluido`
   vale como sim/não. */
function digital(it) {
  return JSON.stringify(CAMPOS_TRAVADOS.map((k) => (k === "excluido" ? it?.[k] === true : it?.[k] ?? null)));
}

const lista = (v) => (Array.isArray(v) ? v : []);

/* Os ids das linhas com item travado na lista de trabalho (`itens`). */
function idsTravados(categorias) {
  const ids = new Set();
  for (const cat of lista(categorias)) {
    for (const it of lista(cat?.itens)) if (it?.idLinha && itemTravadoNoExecutivo(it)) ids.add(it.idLinha);
  }
  return ids;
}

function contarLinhas(categorias, ids) {
  const contagem = new Map();
  for (const cat of lista(categorias)) {
    for (const l of lista(cat?.itensPlanilhaExecutivo)) {
      if (ids && !(l?.idLinha && ids.has(l.idLinha))) continue;
      const d = digital(l);
      contagem.set(d, (contagem.get(d) || 0) + 1);
    }
  }
  return contagem;
}

/**
 * RN-002 — quantas linhas travadas do Executivo uma gravação altera ou tira.
 *
 * A trava é da planilha do Executivo (`itensPlanilhaExecutivo`): a linha
 * cujo id (ADR-007) tem item aprovado ou andando na compra precisa
 * continuar existindo depois com os mesmos campos travados. Editar,
 * remover, substituir ou trocar a planilha muda a digital; desfazer a
 * aprovação e mexer na lista de trabalho (Compras) não.
 *
 * É a mesma conta do gatilho do banco (supabase/rn-002-compras-com-registro.sql).
 *
 * @returns {number} 0 quando a gravação respeita a regra.
 */
export function linhasTravadasAlteradas(antes, depois) {
  const ids = idsTravados(antes);
  if (!ids.size) return 0;
  const exigidas = contarLinhas(antes, ids);
  const existentes = contarLinhas(depois, null);
  let faltam = 0;
  for (const [d, qtd] of exigidas) faltam += Math.max(0, qtd - (existentes.get(d) || 0));
  return faltam;
}

/* O item casa entre antes e depois pela verba, pelo id da linha e pela
   ordem entre os que têm o mesmo id (o produto e a mão de obra separada
   dele levam o mesmo id). Item sem id casa pela posição na verba. */
function porChave(categorias) {
  const mapa = new Map();
  for (const cat of lista(categorias)) {
    const vistos = new Map();
    lista(cat?.itens).forEach((it, i) => {
      const base = it?.idLinha ? `id:${it.idLinha}` : `pos:${i}`;
      const n = vistos.get(base) || 0;
      vistos.set(base, n + 1);
      mapa.set(`${cat?.num ?? ""}|${base}|${n}`, { verba: cat?.num ?? null, item: it });
    });
  }
  return mapa;
}

const valor = (it, k) => (k === "excluido" ? it?.[k] === true : it?.[k] ?? null);

/**
 * RN-002 — o registro do que mudou nos itens travados da lista de trabalho.
 *
 * Um registro por campo travado que mudou; o item que saiu da lista vira
 * um registro com campo "removido". Item não travado não entra.
 *
 * É a mesma conta do gatilho do banco (supabase/rn-002-compras-com-registro.sql).
 *
 * @returns {{verba, idLinha, desc, campo, antes, depois}[]}
 */
export function alteracoesEmItensAprovados(antes, depois) {
  const novos = porChave(depois);
  const registros = [];
  for (const [k, { verba, item }] of porChave(antes)) {
    if (!itemTravadoNoExecutivo(item)) continue;
    const base = { verba, idLinha: item.idLinha ?? null, desc: item.desc ?? null };
    const novo = novos.get(k)?.item;
    if (!novo) {
      registros.push({ ...base, campo: "removido", antes: true, depois: null });
      continue;
    }
    for (const campo of CAMPOS_TRAVADOS) {
      const a = valor(item, campo);
      const d = valor(novo, campo);
      if (JSON.stringify(a) !== JSON.stringify(d)) registros.push({ ...base, campo, antes: a, depois: d });
    }
  }
  return registros;
}
