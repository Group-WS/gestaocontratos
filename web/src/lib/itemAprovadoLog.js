import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

/* RN-002 · O REGISTRO DAS MUDANCAS NO ITEM APROVADO (25/09/2026).
 *
 * Em Compras de Produtos o item aprovado para compra pode mudar; cada campo
 * que muda vira uma linha, gravada pelo gatilho do banco
 * (supabase/rn-002-compras-com-registro.sql). A rota e'
 * web/api/_lib/rotas/itemAprovadoLog.js; aqui so' se le.
 */

/** As mudanças da linha (id da linha, ADR-007), da mais nova para a mais antiga. */
export async function listarMudancasDoItem(obraCodigo, idLinha) {
  if (!supabaseConfigurado || !idLinha) return { registros: [] };
  const q = new URLSearchParams({ idLinha: String(idLinha) });
  return apiJson(`/api/obras/${encodeURIComponent(String(obraCodigo))}/itens-aprovados/log?${q}`);
}

/* O nome de cada campo como a tela o chama. */
const NOME_DO_CAMPO = {
  desc: "Descrição", especificacao: "Especificação", marca: "Fornecedor", ambiente: "Ambiente", un: "Unidade",
  qtdVendida: "Qtd. vendida", qtdExecutivo: "Qtd. executivo",
  custo: "Custo", custoUnitario: "Custo unitário", custoMaterial: "Custo do material", custoMO: "Custo da mão de obra",
  totalMaterial: "Total do material", totalMO: "Total da mão de obra",
  excluido: "Removido", removido: "Item tirado da lista",
};

export const nomeDoCampo = (campo) => NOME_DO_CAMPO[campo] || campo;

/** O valor do registro como texto curto. */
export function valorDoRegistro(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (v === true) return "sim";
  if (v === false) return "não";
  if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  return String(v);
}
