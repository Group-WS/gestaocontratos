import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

/**
 * Quem compra cada grupo de compra (Gestão de compras).
 *
 * O grupo é o da EAP, guardado pelo NOME: a numeração da EAP já mudou uma
 * vez e obra antiga guarda número velho. Um comprador por grupo.
 * Tabela: supabase/compradores.sql.
 *
 * Quem fala com a tabela é a API (web/api/_lib/rotas/cadastros.js): o
 * navegador só usa o Supabase para o login (VH-02). Inclusive a conta de
 * "a tabela ainda não existe" — ela dependia do código de erro do Postgres
 * e agora é a rota que decide; aqui chega `faltaTabela` pronto.
 */

// Nome do grupo pra comparar: sem acento, sem espaço sobrando, maiúsculo.
export function chaveDoGrupo(nome) {
  return String(nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim().toUpperCase();
}

/** `{ mapa }`: chaveDoGrupo(nome) → { grupo, email, nome }. `faltaTabela` enquanto o SQL não roda. */
export async function carregarCompradores() {
  if (!supabaseConfigurado) return { mapa: new Map() };
  const r = await apiJson("/api/compradores");
  const mapa = new Map((r?.lista || []).map((x) => [chaveDoGrupo(x.grupo),
    { grupo: x.grupo, email: x.comprador_email, nome: x.comprador_nome || x.comprador_email }]));
  return r?.faltaTabela ? { mapa, faltaTabela: true } : { mapa };
}

/** Atribui o comprador de um grupo — ou tira, com `pessoa` null. */
export async function salvarComprador(grupo, pessoa, por) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  if (!pessoa) {
    await apiJson(`/api/compradores/${encodeURIComponent(grupo)}`, { metodo: "DELETE" });
    return;
  }
  // `por` fica na assinatura (a tela sabe quem mexeu), mas quem assina a
  // linha é o login conferido no servidor (SEG-13).
  await apiJson("/api/compradores", {
    metodo: "PUT",
    corpo: { grupo, email: pessoa.email, nome: pessoa.nome || pessoa.email },
  });
}
