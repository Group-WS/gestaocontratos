import { supabase, supabaseConfigurado } from "./supabase";

/**
 * A equipe.
 *
 * Existe pra que atribuir o GC de uma obra seja ESCOLHER de uma lista, e
 * nao digitar um e-mail: e-mail digitado erra, e um caractere trocado faz
 * a obra ficar sem dono sem ninguem perceber.
 */

/* Sugestoes, nao camisa de forca: o campo aceita qualquer texto, porque
   cargo de empresa muda e ninguem quer abrir codigo pra criar um. */
export const CARGOS = [
  "GC", "Coordenação", "Comercial", "Compras", "Projetos", "Financeiro", "Administrativo",
];

const paraApp = (l) => ({
  email: l.email, nome: l.nome, cargo: l.cargo || "", ativo: l.ativo !== false,
  criadoEm: l.criado_em, criadoPor: l.criado_por,
});

/* O nome sai do e-mail quando ninguem cadastrou ainda:
   "priscila.wayhs@..." vira "Priscila Wayhs". Melhor um palpite legivel
   que um e-mail cru no meio de uma lista de obras. */
export function nomeDoEmail(email) {
  const antes = String(email || "").split("@")[0];
  if (!antes) return "";
  return antes.split(/[._-]+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export async function listarPessoas() {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase.from("pessoa").select("*").order("nome");
  if (error) throw error;
  return (data || []).map(paraApp);
}

export async function salvarPessoa({ email, nome, cargo, ativo = true, por }) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const e = String(email || "").trim().toLowerCase();
  if (!e) throw new Error("O e-mail é obrigatório.");
  const { data, error } = await supabase.from("pessoa").upsert({
    email: e,
    nome: String(nome || "").trim() || nomeDoEmail(e),
    cargo: cargo || null,
    ativo,
    criado_por: por || null,
  }, { onConflict: "email" }).select().single();
  if (error) throw error;
  return paraApp(data);
}

export async function excluirPessoa(email) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const { error } = await supabase.from("pessoa").delete().eq("email", email);
  if (error) throw error;
}
