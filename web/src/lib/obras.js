import { supabase, supabaseConfigurado } from "./supabase";

/**
 * Ciclo de vida das obras.
 *
 * O Monday lista tudo que existe; esta tabela guarda o que o time
 * decidiu acompanhar. Uma obra do Monday que ninguém iniciou é só uma
 * sugestão — aparece em "Novas obras" e mais nada.
 *
 * Sem Supabase configurado (modo local, sem .env), tudo aqui vira
 * conversa fiada silenciosa: devolve vazio e não grava. O app continua
 * abrindo, só não persiste — que é o comportamento antigo.
 */

export async function listarObras() {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from("obra")
    .select("codigo, nome, squad, situacao, iniciada_em, concluida_em");
  if (error) throw error;
  return data || [];
}

/**
 * Registra a obra no banco — é o "Dar start". A partir daqui ela passa
 * a existir por conta própria: some do Monday e ela continua aqui.
 *
 * `obra` é o objeto do app (o mesmo que a sidebar usa).
 */
export async function iniciarObra(obra) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("obra")
    .insert({
      codigo: String(obra.codigo),
      nome: obra.nome,
      squad: obra.squad,
      board_id: obra.boardId ? String(obra.boardId) : null,
      cliente: obra.cliente,
      endereco: obra.endereco,
      gc: obra.gc,
      valor_vendido: obra.valorVendido || null,
      situacao: "ativa",
    })
    .select("codigo, nome, squad, situacao, iniciada_em, concluida_em")
    .single();
  if (error) throw error;
  return data;
}

/** Tira da sidebar e manda pro Arquivo (só leitura). */
export async function concluirObra(codigo) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("obra")
    .update({ situacao: "concluida", concluida_em: new Date().toISOString() })
    .eq("codigo", String(codigo))
    .select("codigo, nome, squad, situacao, iniciada_em, concluida_em")
    .single();
  if (error) throw error;
  return data;
}

/** Volta pra sidebar — pra quando alguém concluir sem querer. */
export async function reabrirObra(codigo) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("obra")
    .update({ situacao: "ativa", concluida_em: null })
    .eq("codigo", String(codigo))
    .select("codigo, nome, squad, situacao, iniciada_em, concluida_em")
    .single();
  if (error) throw error;
  return data;
}
