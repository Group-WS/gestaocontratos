import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";
import { totaisDoDocumento, numeroAditivo } from "./aditivoDoc";

/* O banco, agora pela API (web/api/_lib/rotas/aditivos.js) — o navegador
   nao fala mais com a tabela (VH-02).

   O modelo do documento — totais, numeracao, saldo — continua em
   aditivoDoc.js, sem import de supabase, pra poder rodar no teste. E
   continua sendo AQUI que ele e' aplicado: os totais e o numero sao
   calculados antes de mandar, pela mesma funcao de sempre, e a rota so'
   grava o que recebe. Conta de aditivo e' dinheiro de contrato; mudar
   ela de lado nesta migracao seria mudar quem a confere. */

/* ---------- banco ---------- */

const paraApp = (l) => ({
  id: l.id,
  obraCodigo: l.obra_codigo,
  seq: l.seq,
  numero: l.numero,
  descricao: l.descricao || "",
  status: l.status || "rascunho",
  doc: l.dados || {},
  totalSupressao: Number(l.total_supressao) || 0,
  totalAdicao: Number(l.total_adicao) || 0,
  criadoEm: l.criado_em,
  criadoPor: l.criado_por,
  atualizadoEm: l.atualizado_em,
  atualizadoPor: l.atualizado_por,
});

export async function listarAditivos(obraCodigo) {
  if (!supabaseConfigurado) return [];
  // Sem obra = todos os que a pessoa enxerga, como era no `if (obraCodigo)`.
  const filtro = obraCodigo ? `?obra=${encodeURIComponent(String(obraCodigo))}` : "";
  const data = await apiJson(`/api/aditivos${filtro}`);
  return (data || []).map(paraApp);
}

/* `usuario` continua na assinatura porque a tela o passa, mas nao viaja
   mais no pedido: quem assina o aditivo e' o login conferido no servidor
   (SEG-13), e e' esse e-mail que a politica de exclusao compara depois. */
export async function criarAditivo({ obraCodigo, seq, descricao, doc }) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const t = totaisDoDocumento(doc);
  const data = await apiJson("/api/aditivos", {
    metodo: "POST",
    corpo: {
      obraCodigo: String(obraCodigo),
      seq,
      numero: numeroAditivo(obraCodigo, seq),
      descricao: descricao || "",
      doc,
      totalSupressao: t.supressao,
      totalAdicao: t.adicao,
    },
  });
  return paraApp(data);
}

export async function salvarAditivo(id, { descricao, status, doc } = {}) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const campos = {};
  if (descricao !== undefined) campos.descricao = descricao;
  if (status !== undefined) campos.status = status;
  /* Os totais vao JUNTO com o documento, sempre os dois: `dados` novo com
     total velho faria o Dashboard, o CMV e o Plano de Compras lerem um
     valor que nao existe em documento nenhum. A rota recusa um sem o
     outro. */
  if (doc !== undefined) {
    const t = totaisDoDocumento(doc);
    campos.doc = doc;
    campos.totalSupressao = t.supressao;
    campos.totalAdicao = t.adicao;
  }
  /* A tradução do "falta rodar supabase/aditivo-aguardando.sql" mora na
     rota: quem ve o codigo do Postgres (23514) e' quem fala com o banco.
     A frase que chega aqui e' a mesma de antes. */
  const data = await apiJson(`/api/aditivos/${encodeURIComponent(id)}`, { metodo: "PATCH", corpo: campos });
  return paraApp(data);
}

export async function excluirAditivo(id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  await apiJson(`/api/aditivos/${encodeURIComponent(id)}`, { metodo: "DELETE" });
}
