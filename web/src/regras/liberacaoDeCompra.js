/**
 * RN-001 — Só o administrador libera a compra.
 *
 * Um item do executivo só entra no fluxo de compra quando um administrador
 * (perfil admin ou master, ativo) o libera — inclusive a liberação que
 * dispensa a aprovação do cliente. A liberação fica no item com quem
 * liberou e quando, e quem liberou é sempre quem está logado.
 *
 * Exceção (decisão de 17/09/2026): ao corrigir a alocação de um item de
 * mão de obra para material, quem edita a obra faz o item entrar já
 * liberado — o carimbo leva `viaAlocacao`.
 *
 * Ficha: docs/regras-de-negocio/RN-001-liberacao-de-compra.md
 * Garantia no banco: supabase/rn-001-liberacao-de-compra.sql
 *
 * Função pura: não lê banco, sessão nem relógio. Quem grava é o fluxo.
 */

/** RN-001 — os perfis que liberam compra. */
export const PERFIS_QUE_LIBERAM_COMPRA = Object.freeze(["master", "admin"]);

/** RN-001 — os campos do item que registram a liberação. */
export const CAMPOS_DE_LIBERACAO = Object.freeze(["liberadoCompra", "liberadoSemCliente"]);

/** RN-001 — esta pessoa pode liberar item para compra (e liberar sem a aprovação do cliente)? */
export function podeLiberarCompra(pessoa) {
  return !!pessoa && PERFIS_QUE_LIBERAM_COMPRA.includes(pessoa.perfil) && pessoa.ativo !== false;
}

/** RN-001 — a liberação veio da correção da alocação (a exceção de 17/09/2026)? */
export function ehLiberacaoPorAlocacao(carimbo) {
  return !!carimbo && typeof carimbo === "object" && carimbo.viaAlocacao === true;
}

const temValor = (v) => v !== undefined && v !== null && v !== false;
const chave = (campo, valor) => `${campo}|${JSON.stringify(valor)}`;

/* Os carimbos de uma obra, contados por conteúdo. Os itens não têm
   identificador estável dentro das categorias (a posição muda quando entra
   ou sai linha), então a comparação é pelo carimbo e pela quantidade: o
   carimbo leva a data em milissegundos e o autor. */
function contarCarimbos(categorias) {
  const contagem = new Map();
  for (const cat of Array.isArray(categorias) ? categorias : []) {
    for (const item of Array.isArray(cat?.itens) ? cat.itens : []) {
      for (const campo of CAMPOS_DE_LIBERACAO) {
        const valor = item?.[campo];
        if (!temValor(valor)) continue;
        const k = chave(campo, valor);
        const atual = contagem.get(k);
        contagem.set(k, { campo, carimbo: valor, qtd: (atual?.qtd || 0) + 1 });
      }
    }
  }
  return contagem;
}

/**
 * RN-001 — os carimbos de liberação que uma gravação ACRESCENTA à obra.
 * Tirar liberação não entra aqui (substituir a planilha zera todas, e a
 * regra não trata disso).
 *
 * @returns {{ campo: string, carimbo: unknown, aMais: number, total: number }[]}
 *   `total` é quantos itens ficam com aquele carimbo depois da gravação.
 */
export function liberacoesAcrescentadas(antes, depois) {
  const velhas = contarCarimbos(antes);
  const novas = [];
  for (const [k, { campo, carimbo, qtd }] of contarCarimbos(depois)) {
    const aMais = qtd - (velhas.get(k)?.qtd || 0);
    if (aMais > 0) novas.push({ campo, carimbo, aMais, total: qtd });
  }
  return novas;
}

/**
 * RN-001 — o que uma gravação não pode fazer, dado quem grava.
 *
 * - Liberação pela alocação: qualquer pessoa que edita, em nome próprio.
 * - Qualquer outra liberação (inclusive sem o cliente): só quem libera
 *   (`podeLiberarCompra`), em nome próprio.
 * - Restaurar uma versão não é liberar de novo: o carimbo que já existiu
 *   na obra volta, no máximo tantas vezes quanto ele aparecia numa versão
 *   (`vezesNoHistorico`). Copiar o carimbo antigo para OUTROS itens passa
 *   dessa conta e é recusado.
 *
 * É a mesma conta do gatilho do banco (supabase/rn-001-liberacao-de-compra.sql).
 *
 * @param {{ antes: unknown, depois: unknown, pessoa: { perfil?: string, ativo?: boolean } | null,
 *           email: string, vezesNoHistorico?: (campo: string, carimbo: object) => number }} gravacao
 * @returns {{ campo: string, carimbo: unknown, motivo: "so-administrador" | "em-nome-de-outro" }[]}
 */
export function recusasDeLiberacao({ antes, depois, pessoa, email, vezesNoHistorico = () => 0 }) {
  const quem = String(email || "").trim().toLowerCase();
  const pode = podeLiberarCompra(pessoa);
  const recusas = [];
  for (const { campo, carimbo, total } of liberacoesAcrescentadas(antes, depois)) {
    const ehObjeto = !!carimbo && typeof carimbo === "object";
    const emNomeProprio = ehObjeto && String(carimbo.por || "").trim().toLowerCase() === quem;
    const viaAlocacao = campo === "liberadoCompra" && ehLiberacaoPorAlocacao(carimbo);

    // O caminho de sempre: pela alocação, ou pelo administrador, em nome próprio.
    if (viaAlocacao && emNomeProprio) continue;
    if (!viaAlocacao && pode && (emNomeProprio || !ehObjeto)) continue;
    // Restauração de versão.
    if (ehObjeto && total <= vezesNoHistorico(campo, carimbo)) continue;

    recusas.push({ campo, carimbo, motivo: viaAlocacao || (pode && ehObjeto) ? "em-nome-de-outro" : "so-administrador" });
  }
  return recusas;
}
