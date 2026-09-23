import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

/* REGISTRO DOS ARQUIVOS DA OBRA (23/09/2026).
 *
 * Quem anexou, trocou ou removeu qual arquivo, e quando. Antes o historico
 * lia os arquivos que a obra guarda HOJE: caderno trocado mostrava so' a
 * versao atual e anexo removido sumia. A tabela e'
 * supabase/obra-arquivo-evento.sql; a rota, web/api/_lib/rotas/arquivoEventos.js.
 */

/** Os eventos da obra, do mais novo pro mais antigo. */
export async function listarEventosDeArquivo(obraCodigo) {
  if (!supabaseConfigurado) return { eventos: [] };
  return apiJson(`/api/obras/${encodeURIComponent(String(obraCodigo))}/arquivos-eventos`);
}

/**
 * Registra um evento. O AUTOR nao vai no pedido: o servidor carimba o
 * e-mail do login, e o banco recusa assinar por outro.
 * `acao`: anexou | trocou | removeu. `tipo`: a chave do caderno, "contrato",
 * "apresentacao", "assinatura" ou "avulso".
 */
export async function registrarEventoDeArquivo(obraCodigo, { acao, tipo, titulo, arquivoNome, arquivoAnterior = null, caminho = null }) {
  if (!supabaseConfigurado) return null;
  const corta = (t, n) => (t == null ? null : String(t).slice(0, n));
  return apiJson(`/api/obras/${encodeURIComponent(String(obraCodigo))}/arquivos-eventos`, {
    metodo: "POST",
    corpo: {
      acao, tipo,
      titulo: corta(titulo || arquivoNome || "arquivo", 255),
      arquivoNome: corta(arquivoNome || titulo || "arquivo", 255),
      arquivoAnterior: corta(arquivoAnterior, 255),
      caminho: corta(caminho, 1024),
    },
  });
}
