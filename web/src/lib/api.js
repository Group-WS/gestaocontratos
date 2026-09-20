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
