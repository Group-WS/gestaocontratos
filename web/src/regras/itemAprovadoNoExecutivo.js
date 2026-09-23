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
 * Ficha: docs/regras-de-negocio/RN-002-item-aprovado-no-executivo.md
 * Decisão: docs/ADR-006-executivo-trava-item-aprovado.md
 * Garantia no banco: supabase/rn-002-item-aprovado-no-executivo.sql
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

/* A digital do item: só os campos travados, em ordem fixa. `excluido` vale
   como sim/não. */
function digital(it) {
  return JSON.stringify(CAMPOS_TRAVADOS.map((k) => (k === "excluido" ? it?.[k] === true : it?.[k] ?? null)));
}

function contar(categorias, soTravados) {
  const contagem = new Map();
  for (const cat of Array.isArray(categorias) ? categorias : []) {
    for (const it of Array.isArray(cat?.itens) ? cat.itens : []) {
      if (soTravados && !itemTravadoNoExecutivo(it)) continue;
      const d = digital(it);
      contagem.set(d, (contagem.get(d) || 0) + 1);
    }
  }
  return contagem;
}

/**
 * RN-002 — quantos itens travados uma gravação altera ou tira da obra.
 *
 * Os itens não têm identificador estável (a posição muda quando entra ou
 * sai linha), então a conta é por conteúdo: cada item travado de antes
 * precisa continuar existindo depois com os mesmos campos travados. Tirar
 * a aprovação não muda a digital; editar, remover, substituir ou trocar a
 * planilha muda.
 *
 * É a mesma conta do gatilho do banco (supabase/rn-002-item-aprovado-no-executivo.sql).
 *
 * @returns {number} 0 quando a gravação respeita a regra.
 */
export function travadosAlterados(antes, depois) {
  const exigidos = contar(antes, true);
  const existentes = contar(depois, false);
  let faltam = 0;
  for (const [d, qtd] of exigidos) faltam += Math.max(0, qtd - (existentes.get(d) || 0));
  return faltam;
}
