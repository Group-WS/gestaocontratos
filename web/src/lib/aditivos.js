import { supabase, supabaseConfigurado } from "./supabase";
import { totaisDoDocumento, numeroAditivo } from "./aditivoDoc";

/* O banco. O modelo do documento — totais, numeracao, saldo — mora em
   aditivoDoc.js, sem import de supabase, pra poder rodar no teste. */

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
  let q = supabase.from("aditivo").select("*").order("obra_codigo").order("seq", { ascending: false });
  if (obraCodigo) q = q.eq("obra_codigo", String(obraCodigo));
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(paraApp);
}

export async function criarAditivo({ obraCodigo, seq, descricao, doc, usuario }) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const t = totaisDoDocumento(doc);
  const { data, error } = await supabase.from("aditivo").insert({
    obra_codigo: String(obraCodigo),
    seq,
    numero: numeroAditivo(obraCodigo, seq),
    descricao: descricao || "",
    dados: doc,
    total_supressao: t.supressao,
    total_adicao: t.adicao,
    criado_por: usuario || null,
    atualizado_por: usuario || null,
  }).select().single();
  if (error) throw error;
  return paraApp(data);
}

export async function salvarAditivo(id, { descricao, status, doc, usuario }) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const campos = { atualizado_em: new Date().toISOString(), atualizado_por: usuario || null };
  if (descricao !== undefined) campos.descricao = descricao;
  if (status !== undefined) campos.status = status;
  if (doc !== undefined) {
    const t = totaisDoDocumento(doc);
    campos.dados = doc;
    campos.total_supressao = t.supressao;
    campos.total_adicao = t.adicao;
  }
  const { data, error } = await supabase.from("aditivo").update(campos).eq("id", id).select().single();
  /* A fase "Aguardando cliente" so' existe no banco depois do SQL: antes
     disso o Postgres recusa a linha com um erro que nao diz o que fazer
     ("violates check constraint"), e a pessoa fica achando que o app
     quebrou. */
  if (error?.code === "23514" && /status/i.test(error.message || "")) {
    throw new Error("O banco ainda não conhece a fase “Aguardando cliente”: falta rodar supabase/aditivo-aguardando.sql no Supabase (SQL Editor).");
  }
  if (error) throw error;
  return paraApp(data);
}

export async function excluirAditivo(id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const { error } = await supabase.from("aditivo").delete().eq("id", id);
  if (error) throw error;
}
