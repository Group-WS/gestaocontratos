import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

/* REGISTRO E AVISO DAS IMPORTACOES (23/09/2026).
 *
 * Subir um documento (Vendido Contrato, Vendido Planilha, Planilha
 * Executivo) troca os itens SO' das verbas que vieram no arquivo: as outras
 * ficam com a importacao anterior (aplicarItensNasVerbas, no App.jsx). Isso
 * foi mantido de proposito — decisao de 23/09/2026: "manter e avisar". O
 * que faltava era o AVISO (a pessoa nao sabia que ficava dado antigo) e o
 * RASTRO (nem o arquivo, nem quem, nem quando ficavam gravados).
 *
 * Aqui mora:
 *   - `resumoDaImportacao`: o que o arquivo vai trocar e o que vai ficar,
 *     calculado ANTES de aplicar. Funcao pura, testada em
 *     src/__testes__/importacao-resumo.test.mjs.
 *   - `linhasDoAviso`: o texto do aviso, a partir do resumo.
 *   - `listarImportacoes` / `registrarImportacao`: a API
 *     (web/api/_lib/rotas/importacoes.js -> supabase/obra-importacao.sql).
 */

export { DOCUMENTOS, resumoDaImportacao, linhasDoAviso, formatoDoArquivo } from "./importacaoResumo.js";

/**
 * As importacoes da obra, da mais nova pra mais antiga.
 * `{ semTabela: true, importacoes: [] }` enquanto o SQL nao rodou.
 */
export async function listarImportacoes(obraCodigo) {
  if (!supabaseConfigurado) return { importacoes: [] };
  return apiJson(`/api/obras/${encodeURIComponent(String(obraCodigo))}/importacoes`);
}

/**
 * Registra uma importacao. O AUTOR nao vai no pedido: o servidor carimba o
 * e-mail do login (SEG-13), e o banco recusa assinar por outro.
 */
export async function registrarImportacao(obraCodigo, { documento, arquivo, resumo }) {
  if (!supabaseConfigurado) return null;
  return apiJson(`/api/obras/${encodeURIComponent(String(obraCodigo))}/importacoes`, {
    metodo: "POST",
    corpo: {
      documento,
      arquivoNome: String(arquivo?.name || "arquivo").slice(0, 255),
      arquivoTamanho: Number.isFinite(arquivo?.size) ? arquivo.size : null,
      nItens: resumo.nItens,
      verbasTrocadas: resumo.trocadas.map((v) => String(v.num)).slice(0, 200),
      verbasMantidas: resumo.mantidas.map((v) => String(v.num)).slice(0, 200),
    },
  });
}
