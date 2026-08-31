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

const lista = (v) => (Array.isArray(v) ? v : []);

const paraApp = (l) => ({
  email: l.email, nome: l.nome, cargo: l.cargo || "", ativo: l.ativo !== false,
  admin: !!l.admin,
  /* Lista VAZIA quer dizer TODOS, e nao "nenhum". Quem foi cadastrado
     antes destas colunas existirem perderia o app inteiro no instante em
     que a migracao rodasse. */
  modulos: lista(l.modulos),
  obrasRegra: l.obras_regra || "todas",
  obras: lista(l.obras).map(String),
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

export async function salvarPessoa({ email, nome, cargo, ativo = true, admin, modulos, obrasRegra, obras, por }) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const e = String(email || "").trim().toLowerCase();
  if (!e) throw new Error("O e-mail é obrigatório.");
  const campos = {
    email: e,
    nome: String(nome || "").trim() || nomeDoEmail(e),
    cargo: cargo || null,
    ativo,
    criado_por: por || null,
  };
  /* So' manda o que veio. Um upsert que sempre escreve `admin: false`
     apagaria o admin de alguem so' porque quem editou o nome nao mexeu
     nessa parte da tela. */
  if (admin !== undefined) campos.admin = !!admin;
  if (modulos !== undefined) campos.modulos = lista(modulos);
  if (obrasRegra !== undefined) campos.obras_regra = obrasRegra;
  if (obras !== undefined) campos.obras = lista(obras).map(String);

  const { data, error } = await supabase.from("pessoa").upsert(campos, { onConflict: "email" }).select().single();
  if (error) throw error;
  return paraApp(data);
}

export async function excluirPessoa(email) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const { error } = await supabase.from("pessoa").delete().eq("email", email);
  if (error) throw error;
}

/* ---------- Quem ve o que ----------
 *
 * Estas duas funcoes decidem o que cada pessoa enxerga. Elas moram aqui,
 * sem React e sem supabase, porque errar nelas nao produz um numero
 * torto: produz alguem trancado fora do proprio sistema, ou vendo obra
 * que nao devia.
 */

/* NAO ACHADA = ACESSO TOTAL.
 *
 * Parece o contrario do que seguranca pede, e e' de proposito: a primeira
 * pessoa a abrir o app depois desta migracao nao esta cadastrada em
 * lugar nenhum, e negar por padrao a trancaria pra fora antes de existir
 * qualquer admin pra liberar. Fechar de verdade e' trabalho do banco
 * (RLS), e ele so' pode ser ligado depois que os cadastros existirem. */
export function podeVerModulo(pessoa, moduloId) {
  if (!pessoa || pessoa.admin) return true;
  const m = Array.isArray(pessoa.modulos) ? pessoa.modulos : [];
  return m.length === 0 || m.includes(moduloId);
}

/* As obras que a pessoa enxerga.
 *
 * "minhas" se atualiza sozinha quando a obra troca de GC — e' por isso
 * que ela existe em vez de a coordenacao remarcar a lista a cada troca.
 *
 * Obra SEM GC continua visivel pra todo mundo: enquanto os vinculos nao
 * estao feitos, esconder o que nao tem dono deixaria obra viva fora da
 * tela de todos. */
export function obrasPermitidas(pessoa, obras) {
  const todas = obras || [];
  if (!pessoa || pessoa.admin || pessoa.obrasRegra === "todas" || !pessoa.obrasRegra) return todas;
  if (pessoa.obrasRegra === "minhas") {
    const meu = String(pessoa.email || "").toLowerCase();
    return todas.filter((o) => !o.gc || String(o.gc).toLowerCase() === meu);
  }
  const escolhidas = new Set((pessoa.obras || []).map(String));
  return todas.filter((o) => escolhidas.has(String(o.codigo)));
}
