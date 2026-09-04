import { supabase, supabaseConfigurado } from "./supabase";

/**
 * O histórico de obras do Sienge — de onde saem nome, cidade e estado
 * pra montar o painel de localização no dashboard.
 *
 * É um espelho ESTÁTICO: alguém exporta do Sienge e roda o SQL de
 * importação (ver supabase/sienge_obra.sql) — não é uma leitura ao vivo
 * do Sienge. Enquanto não existir uma API direta, atualizar esta tabela
 * é reexportar e reimportar.
 */
export async function listarSiengeObras() {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from("sienge_obra")
    .select("codigo, nome, cidade, estado");
  if (error) throw error;
  return data || [];
}
