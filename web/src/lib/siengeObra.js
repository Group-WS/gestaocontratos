import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

/**
 * O histórico de obras do Sienge — de onde saem nome, cidade e estado
 * pra montar o painel de localização no dashboard.
 *
 * É um espelho ESTÁTICO: alguém exporta do Sienge e roda o SQL de
 * importação (ver supabase/sienge_obra.sql) — não é uma leitura ao vivo
 * do Sienge. Enquanto não existir uma API direta, atualizar esta tabela
 * é reexportar e reimportar.
 *
 * Quem fala com o banco é a API (web/api/_lib/rotas/siengeBanco.js): aqui
 * mora só o pedido. As colunas lidas e a convivência com o banco que
 * ainda não tem as coordenadas moram lá, porque é lá que se sabe o que o
 * Postgres respondeu.
 */

export async function listarSiengeObras() {
  if (!supabaseConfigurado) return [];
  return apiJson("/api/sienge-obras");
}

/**
 * A marcação manual — "eu sei que essa está finalizada/ativa" — manda
 * mais que qualquer regra automática (ver `statusSienge` em App.jsx).
 * Passar `status: null` volta a obra pro palpite automático.
 */
export async function marcarStatusSienge(codigo, status) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  await apiJson(`/api/sienge-obras/${encodeURIComponent(String(codigo))}/status`,
    { metodo: "PUT", corpo: { status } });
}
