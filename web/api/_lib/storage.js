/**
 * O que o servidor faz por um arquivo do Storage.
 * -----------------------------------------------------------
 * O navegador nunca fala com o Storage por conta propria: pede aqui. A
 * rota confere quem esta' mandando (login, time, e a obra quando for o
 * caso) e so' entao assina o endereco — de subida ou de descida.
 *
 * Tudo com o client do PROPRIO usuario (req.supabase): as policies de
 * `storage.objects` continuam valendo, e o servidor nao vira porta de
 * servico para quem o banco recusaria.
 *
 * Regra: .quality/regras/perfis/webapp-vite-hono.md (VH-02, VH-08).
 */

/** O caminho sem nada que escape da pasta ("..", "/" no comeco, barra dupla). */
function caminhoSeguro(caminho) {
  const limpo = String(caminho || "").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!limpo || limpo.split("/").some((p) => p === "." || p === "..")) return null;
  return limpo;
}

/**
 * Assina a subida de UM arquivo. Devolve { caminho, token } — o token e'
 * o que o navegador apresenta ao Storage, e vale para este caminho so'.
 */
async function assinarEnvio(supabase, balde, caminho, { upsert = true } = {}) {
  const alvo = caminhoSeguro(caminho);
  if (!alvo) return { erroDeCaminho: true };
  const { data, error } = await supabase.storage.from(balde).createSignedUploadUrl(alvo, { upsert });
  if (error) return { error };
  return { caminho: alvo, token: data.token };
}

/** Assina a descida de um arquivo de balde privado (endereco temporario). */
async function assinarLeitura(supabase, balde, caminho, { segundos = 3600, baixar = false } = {}) {
  const alvo = caminhoSeguro(caminho);
  if (!alvo) return { erroDeCaminho: true };
  const { data, error } = await supabase.storage
    .from(balde)
    .createSignedUrl(alvo, segundos, baixar ? { download: true } : {});
  if (error) return { error };
  return { url: data.signedUrl };
}

/** Erro do Storage virando resposta. Mesma ideia do erroDoBanco, outro servico. */
function erroDoStorage(res, error) {
  const msg = String(error?.message || "");
  if (/bucket not found/i.test(msg)) {
    return res.status(503).json({ error: 'O depósito de arquivos ainda não existe no banco. Rode "supabase/arquivos.sql" no SQL Editor do Supabase e tente de novo.' });
  }
  if (/not found|does not exist/i.test(msg)) {
    return res.status(404).json({ error: "Registro não encontrado." });
  }
  if (/row-level security|not authorized|Unauthorized|violates/i.test(msg)) {
    return res.status(403).json({ error: "Você não tem permissão para esta ação." });
  }
  console.error(JSON.stringify({ level: "error", event: "storage_falhou", status: error?.statusCode || null }));
  return res.status(500).json({ error: "Não foi possível concluir a operação. Tente novamente em instantes." });
}

module.exports = { assinarEnvio, assinarLeitura, erroDoStorage, caminhoSeguro };
