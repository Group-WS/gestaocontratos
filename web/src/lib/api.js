import { supabase, supabaseConfigurado } from "./supabase";

/**
 * A porta de entrada do backend, vista do navegador.
 *
 * Toda chamada leva o token da sessao no cabecalho `Authorization`: o
 * backend agora exige usuario logado em todas as rotas, e e' la' que o
 * token e' VERIFICADO. A tela esconder um botao continua sendo so'
 * experiencia; a barreira e' a API.
 *
 * Regra: .quality/regras/03-seguranca-e-acesso.md (SEG-11).
 */

// O backend mora no mesmo dominio do site (funcao serverless da Vercel,
// em web/api/), entao "/api/..." resolve sozinho — em dev pelo proxy do
// Vite, publicado pela propria Vercel. VITE_API_BASE so' e' necessaria no
// caso raro de apontar pra um backend em outro dominio.
const API_BASE = import.meta.env.VITE_API_BASE || "";

export const api = (path) => API_BASE + path;

async function tokenAtual() {
  if (!supabaseConfigurado) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch (e) {
    return null;
  }
}

/**
 * `fetch` do Confere. Mesma assinatura do fetch, com o caminho relativo
 * ("/api/...") e o cabecalho de login ja' no lugar.
 */
export async function apiFetch(path, opcoes = {}) {
  const token = await tokenAtual();
  const headers = new Headers(opcoes.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(api(path), { ...opcoes, headers });
}

/**
 * O mesmo pedido, já lido como JSON — e com o erro virando exceção.
 *
 * As libs de `lib/` falavam com o banco direto e deixavam o erro do
 * Postgres subir cru. Agora quem fala com o banco é a API, e o que volta
 * é `{ error: "frase para a pessoa", code? }`: esta função transforma isso
 * num `Error` com a mesma frase, para a tela continuar mostrando o que
 * mostrava. O `code` do banco (quando a API o devolve) fica em `err.code`,
 * porque há tela que decide por ele.
 *
 * Regra: perfis/webapp-vite-hono.md (VH-02, VH-03).
 */
export async function apiJson(caminho, { metodo = "GET", corpo, ...resto } = {}) {
  const opcoes = { method: metodo, ...resto };
  if (corpo !== undefined) {
    opcoes.headers = { "Content-Type": "application/json", ...(resto.headers || {}) };
    opcoes.body = JSON.stringify(corpo);
  }

  let res;
  try {
    res = await apiFetch(caminho, opcoes);
  } catch {
    throw new Error("Sem conexão com o servidor.");
  }

  let dados = null;
  try { dados = await res.json(); } catch { /* resposta sem corpo */ }

  if (!res.ok) {
    /* Duas chaves porque o backend tem duas idades: a portaria (auth.js)
       responde `erro`, e as rotas de dados, `error`. Ler so' uma fazia toda
       recusa de login e de permissao chegar na tela como "não foi possível
       concluir" — a pessoa sem saber que era a sessão que tinha caído. */
    const err = new Error(dados?.error || dados?.erro || "Não foi possível concluir a operação. Tente novamente em instantes.");
    err.status = res.status;
    if (dados?.code) err.code = dados.code;
    if (dados?.correlationId) err.correlationId = dados.correlationId;
    if (Array.isArray(dados?.campos)) err.campos = dados.campos;
    // O motivo de cada recusa de uma leitura de arquivo (ex.: relatório fora do modelo).
    if (Array.isArray(dados?.erros)) err.erros = dados.erros;
    throw err;
  }
  return dados;
}
