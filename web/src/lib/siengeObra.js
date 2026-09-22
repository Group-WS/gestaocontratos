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
const COLUNAS = "codigo, nome, cidade, estado, status_manual, endereco_completo";

export async function listarSiengeObras() {
  if (!supabaseConfigurado) return [];
  // O endereço completo também serve pra obra que não tem um (Monday não traz
  // a Localização). As coordenadas são do mapa do Início.
  const comMapa = await supabase
    .from("sienge_obra")
    .select(`${COLUNAS}, lat, lng, geo_precisao`);
  if (!comMapa.error) return comMapa.data || [];
  /* Coluna que ainda não existe (42703): supabase/sienge-obra-coordenadas.sql
     não rodou neste banco. A tela segue sem os pinos, em vez de perder a
     lista inteira — o mapa mostra as obras no painel e os estados no mapa. */
  if (comMapa.error.code !== "42703") throw comMapa.error;
  const { data, error } = await supabase
    // gate-allow VH-02: repete a consulta acima sem lat/lng/geo_precisao — compatibilidade de schema (SQL-03) antes de supabase/sienge-obra-coordenadas.sql rodar; some quando a migration for aplicada em todo ambiente
    .from("sienge_obra")
    .select(COLUNAS);
  if (error) throw error;
  return data || [];
}

/**
 * A marcação manual — "eu sei que essa está finalizada/ativa" — manda
 * mais que qualquer regra automática (ver `statusSienge` em App.jsx).
 * Passar `status: null` volta a obra pro palpite automático.
 */
export async function marcarStatusSienge(codigo, status) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  const { error } = await supabase
    .from("sienge_obra")
    .update({ status_manual: status })
    .eq("codigo", String(codigo));
  if (error) throw error;
}
