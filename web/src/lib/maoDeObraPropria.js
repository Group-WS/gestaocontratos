import { supabase, supabaseConfigurado } from "./supabase";

/**
 * A mão de obra própria (Gestão de compras): a equipe interna — a
 * especialidade, a função, a diária e, quando se sabe, o nome da pessoa.
 * É daqui que a calculadora da "mão de obra a contratar" tira os valores.
 * Tabela: supabase/mao-de-obra-propria.sql.
 */

// A tabela ainda não existe (o SQL não rodou): a tela avisa em vez de quebrar.
const faltaTabela = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205"
  || (/prestador_interno/.test(e.message || "") && /exist|schema cache/i.test(e.message || "")));

const COLUNAS = "id, nome, especialidade, funcao, diaria, ativo";
const paraApp = (r) => ({
  id: r.id, nome: r.nome || "", especialidade: r.especialidade, funcao: r.funcao,
  diaria: Number(r.diaria) || 0, ativo: r.ativo !== false,
});

/** `{ lista }` com a equipe interna; `faltaTabela` enquanto o SQL não roda. */
export async function carregarPrestadores() {
  if (!supabaseConfigurado) return { lista: [] };
  const { data, error } = await supabase.from("prestador_interno").select(COLUNAS)
    .order("especialidade").order("funcao");
  if (error) {
    if (faltaTabela(error)) return { lista: [], faltaTabela: true };
    throw error;
  }
  return { lista: (data || []).map(paraApp) };
}

/** Cria (sem `id`) ou atualiza um prestador. Devolve a linha gravada. */
export async function salvarPrestador(p, por) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const linha = {
    nome: String(p.nome || "").trim() || null,
    especialidade: String(p.especialidade || "").trim(),
    funcao: String(p.funcao || "").trim(),
    diaria: Number(p.diaria) || 0,
    ativo: p.ativo !== false,
    atualizado_em: new Date().toISOString(),
    atualizado_por: por || null,
  };
  if (!linha.especialidade || !linha.funcao) throw new Error("Especialidade e função são obrigatórias.");
  const base = supabase.from("prestador_interno");
  const q = p.id ? base.update(linha).eq("id", p.id) : base.insert(linha);
  const { data, error } = await q.select(COLUNAS).single();
  if (error) throw error;
  return paraApp(data);
}

/** Tira um prestador do cadastro. */
export async function excluirPrestador(id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const { error } = await supabase.from("prestador_interno").delete().eq("id", id);
  if (error) throw error;
}
