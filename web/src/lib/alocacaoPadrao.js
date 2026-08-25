import { supabase, supabaseConfigurado } from "./supabase";

/**
 * Alocação de recurso padrão da empresa, por DESCRIÇÃO do item.
 *
 * "Anotação de responsabilidade técnica – RRT" é mão de obra em toda obra
 * que a Group WS faz. "Caçambas de entulho" também. Corrigir isso obra a
 * obra é refazer a mesma decisão pra sempre — e basta alguém esquecer uma
 * vez pra o valor cair na coluna errada e o contrato nascer menor do que
 * deveria.
 *
 * Então a correção vale pra empresa inteira: mexeu numa obra, toda obra
 * que tiver a mesma descrição passa a nascer certa. A obra específica
 * ainda pode discordar — `alocacaoManual` no item ganha deste padrão.
 *
 * Mora num registro de módulo pelo mesmo motivo da EAP (ver lib/eap.js):
 * `alocacaoDoItem` e `parcelasDoItem` são funções puras, chamadas no meio
 * da renderização, e não podem esperar uma promessa.
 */

let registro = new Map();

/* A comparação é por descrição normalizada: sem acento, sem caixa, sem
   espaço dobrado. O mesmo item vem escrito de três jeitos entre planilhas
   ("Caçambas de entulho", "CAÇAMBAS DE ENTULHO ", "Caçambas  de entulho")
   e as três têm que casar — é a mesma razão pela qual o depara casa por
   descrição e não por código. */
export function normalizarDesc(desc) {
  return String(desc || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

/** MAT | MO | AMBOS, ou null quando a empresa nunca decidiu essa descrição. */
export function padraoDaDescricao(desc) {
  const chave = normalizarDesc(desc);
  if (!chave) return null;
  return registro.get(chave) || null;
}

export function definirPadroes(lista) {
  registro = new Map();
  (lista || []).forEach((p) => {
    const chave = normalizarDesc(p.descricao);
    if (chave && p.alocacao) registro.set(chave, p.alocacao);
  });
}

export function quantosPadroes() { return registro.size; }

export async function carregarAlocacoesDoBanco() {
  if (!supabaseConfigurado) return 0;
  const { data, error } = await supabase
    .from("alocacao_padrao")
    .select("descricao, alocacao");
  if (error) throw error;
  definirPadroes(data || []);
  return registro.size;
}

/**
 * Grava a decisão como padrão da empresa.
 *
 * Atualiza o registro em memória ANTES de ir ao banco: a tela tem que
 * reagir no clique, e se a gravação falhar a pessoa já vê o efeito e o
 * erro junto — em vez de clicar de novo achando que não pegou.
 */
export async function salvarAlocacaoPadrao(desc, alocacao, por) {
  const chave = normalizarDesc(desc);
  if (!chave) return;
  if (alocacao) registro.set(chave, alocacao); else registro.delete(chave);
  if (!supabaseConfigurado) return;

  if (!alocacao) {
    const { error } = await supabase.from("alocacao_padrao").delete().eq("descricao_norm", chave);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("alocacao_padrao").upsert({
    descricao_norm: chave,
    descricao: String(desc).trim(),
    alocacao,
    por: por || null,
    em: new Date().toISOString(),
  }, { onConflict: "descricao_norm" });
  if (error) throw error;
}
