import { supabase, supabaseConfigurado } from "./supabase";

/**
 * Quem compra cada grupo de compra (Gestão de compras).
 *
 * O grupo é o da EAP, guardado pelo NOME: a numeração da EAP já mudou uma
 * vez e obra antiga guarda número velho. Um comprador por grupo.
 * Tabela: supabase/compradores.sql.
 */

// Nome do grupo pra comparar: sem acento, sem espaço sobrando, maiúsculo.
export function chaveDoGrupo(nome) {
  return String(nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim().toUpperCase();
}

// A tabela ainda não existe (o SQL não rodou): a tela avisa em vez de quebrar.
const faltaTabela = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205"
  || (/comprador_grupo/.test(e.message || "") && /exist|schema cache/i.test(e.message || "")));

/** `{ mapa }`: chaveDoGrupo(nome) → { grupo, email, nome }. `faltaTabela` enquanto o SQL não roda. */
export async function carregarCompradores() {
  if (!supabaseConfigurado) return { mapa: new Map() };
  const { data, error } = await supabase.from("comprador_grupo").select("grupo, comprador_email, comprador_nome");
  if (error) {
    if (faltaTabela(error)) return { mapa: new Map(), faltaTabela: true };
    throw error;
  }
  return { mapa: new Map((data || []).map((r) => [chaveDoGrupo(r.grupo),
    { grupo: r.grupo, email: r.comprador_email, nome: r.comprador_nome || r.comprador_email }])) };
}

/** Atribui o comprador de um grupo — ou tira, com `pessoa` null. */
export async function salvarComprador(grupo, pessoa, por) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  if (!pessoa) {
    const { error } = await supabase.from("comprador_grupo").delete().eq("grupo", grupo);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("comprador_grupo").upsert({
    grupo, comprador_email: pessoa.email, comprador_nome: pessoa.nome || pessoa.email,
    atualizado_em: new Date().toISOString(), atualizado_por: por || null,
  }, { onConflict: "grupo" });
  if (error) throw error;
}
