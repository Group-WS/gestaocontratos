import { supabase, supabaseConfigurado } from "./supabase";
import { assinaturaDoEnvio, novaChaveIdempotencia } from "./siengeIdempotencia.js";

/**
 * O rastro dos envios ao Sienge (tabela `sienge_solicitacao`).
 *
 * A regra que organiza este arquivo: **o registro nasce antes do envio**.
 *
 * Gravar depois parece natural e tem um buraco fatal — se o navegador
 * fecha, a aba trava ou a resposta se perde no caminho de volta, a
 * solicitação existe no Sienge e não existe aqui. A pessoa não tem como
 * saber, reenvia, e agora são duas. Por isso:
 *
 *   1. `abrirEnvio()`   grava `status='enviando'` ANTES da primeira chamada
 *   2. o envio acontece
 *   3. `fecharEnvio()`  grava o que voltou
 *
 * Linha que ficou em 'enviando' é a pergunta "será que entrou?" — e
 * `enviosPendentes()` é quem a faz na abertura da tela.
 */

/**
 * Abre o registro ANTES de falar com o Sienge.
 *
 * Devolve `{ id, chave }`. Sem Supabase configurado devolve `id: null` e o
 * envio segue — modo local não tem onde guardar, e travar o envio por
 * causa do histórico seria pior que ficar sem ele.
 */
export async function abrirEnvio({ obraCodigo, buildingId, por, payload, chave, assinatura, solicitacaoId = null }) {
  if (!supabaseConfigurado) return { id: null, chave };
  const { data, error } = await supabase
    .from("sienge_solicitacao")
    .insert({
      obra_codigo: String(obraCodigo),
      building_id: Number(buildingId),
      solicitacao_id: solicitacaoId,
      enviado_por: por || null,
      payload,
      resposta: {},
      ok: false,
      status: "enviando",
      idempotency_key: chave,
      assinatura,
    })
    .select("id")
    .single();
  if (error) {
    // 23505 = violação de índice único: esta MESMA tentativa já está
    // registrada, ou seja, o envio já saiu. Deixar passar criaria a
    // segunda solicitação — que é exatamente o que a chave existe pra
    // impedir.
    if (error.code === "23505") {
      const e = new Error("Este envio já foi iniciado — não foi enviado de novo.");
      e.jaEnviado = true;
      throw e;
    }
    /* Coluna que o banco ainda não tem (PGRST204, ou a mensagem do
       PostgREST sobre o schema cache): é migration pendente, não falha
       passageira. Sem distinguir isso, a orientação vira "tente de novo"
       — e tentar de novo não cria coluna nenhuma. */
    if (error.code === "PGRST204" || /Could not find the .* column|schema cache/i.test(error.message || "")) {
      const e = new Error(`O banco de dados está desatualizado para esta funcionalidade: ${error.message}`);
      e.migracaoPendente = true;
      throw e;
    }
    throw error;
  }
  return { id: data.id, chave };
}

/** Fecha o registro com o que o Sienge respondeu. */
export async function fecharEnvio(id, { solicitacaoId, resposta, status, ok }) {
  if (!supabaseConfigurado || !id) return;
  const { error } = await supabase
    .from("sienge_solicitacao")
    .update({
      solicitacao_id: solicitacaoId ?? null,
      resposta,
      status,
      ok: !!ok,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Os envios desta obra que ficaram sem resposta. */
export async function enviosPendentes(obraCodigo) {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from("sienge_solicitacao")
    .select("id, solicitacao_id, enviado_por, enviado_em, payload, status")
    .eq("obra_codigo", String(obraCodigo))
    .eq("status", "enviando")
    .order("enviado_em", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Um envio anterior com o mesmo conteúdo, pra tela poder avisar. */
export async function envioComMesmoConteudo(obraCodigo, assinatura) {
  if (!supabaseConfigurado || !assinatura) return null;
  const { data, error } = await supabase
    .from("sienge_solicitacao")
    .select("id, solicitacao_id, enviado_em, enviado_por, status")
    .eq("obra_codigo", String(obraCodigo))
    .eq("assinatura", assinatura)
    .in("status", ["concluido", "parcial", "enviando"])
    .order("enviado_em", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

/** Encerra um pendente depois de conferir o que o Sienge realmente tem. */
export async function reconciliarEnvio(id, { solicitacaoId, resposta, status, ok, por }) {
  if (!supabaseConfigurado || !id) return;
  const { error } = await supabase
    .from("sienge_solicitacao")
    .update({
      solicitacao_id: solicitacaoId ?? null,
      resposta,
      status,
      ok: !!ok,
      atualizado_em: new Date().toISOString(),
      reconciliado_em: new Date().toISOString(),
      reconciliado_por: por || null,
    })
    .eq("id", id);
  if (error) throw error;
}

/** O histórico de envios de uma obra, do mais recente pro mais antigo. */
export async function listarEnviosSienge(obraCodigo, limite = 20) {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from("sienge_solicitacao")
    // O payload vem junto: é ele que guarda o que foi pedido — insumo,
    // quantidade, preço e apropriação. Sem ele o histórico diz que houve
    // um envio, mas não o quê.
    .select("id, solicitacao_id, enviado_por, enviado_em, ok, status, payload, resposta")
    .eq("obra_codigo", String(obraCodigo))
    .order("enviado_em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data || [];
}

/* Reexportadas por conveniência de quem já importa deste arquivo — a
   implementação mora em `siengeIdempotencia.js`, sem Supabase junto. */
export { assinaturaDoEnvio, novaChaveIdempotencia };
