import { supabase, supabaseConfigurado } from "./supabase";
export * from "./catalogoModelo";

/* O acesso ao banco. A parte pura mora em catalogoModelo.js: ela e'
   testada sem supabase, e assim nenhum teste esbarra na rede. */

/* ---------- BANCO ---------- */

const paraApp = (r) => ({
  id: r.id,
  verba: r.verba,
  subgrupo: r.subgrupo || null,
  descricao: r.descricao,
  tipoItem: r.tipo_item || "produto",
  descricaoCriativo: r.descricao_criativo || null,
  descricaoEn: r.descricao_en || null,
  codigo: r.codigo || null,
  fornecedor: r.fornecedor || null,
  observacoes: r.observacoes || null,
  precoRef: r.preco_ref == null ? null : Number(r.preco_ref),
  precoEm: r.preco_em || null,
  imagem: r.imagem || null,
  unidade: r.unidade || "un",
  ativo: r.ativo !== false,
  criadoEm: r.criado_em, criadoPor: r.criado_por,
});

const paraBanco = (p) => ({
  verba: p.verba,
  subgrupo: p.subgrupo || null,
  descricao: String(p.descricao || "").trim(),
  tipo_item: p.tipoItem === "acabamento" ? "acabamento" : "produto",
  descricao_criativo: String(p.descricaoCriativo || "").trim() || null,
  descricao_en: String(p.descricaoEn || "").trim() || null,
  codigo: p.codigo || null,
  fornecedor: p.fornecedor || null,
  observacoes: p.observacoes || null,
  preco_ref: p.precoRef ?? null,
  preco_em: p.precoEm || null,
  imagem: p.imagem || null,
  unidade: p.unidade || "un",
  ativo: p.ativo !== false,
});

export async function listarProdutos() {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase.from("catalogo_produto")
    .select("*").order("verba").order("subgrupo").order("descricao");
  if (error) throw error;
  return (data || []).map(paraApp);
}

export async function salvarProduto(p, por) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  if (!String(p.descricao || "").trim()) throw new Error("A descrição é obrigatória.");
  if (!p.verba) throw new Error("O grupo é obrigatório — é ele que diz em qual verba o produto entra.");
  const campos = { ...paraBanco(p), ...(p.id ? {} : { criado_por: por || null }) };
  const q = p.id
    ? supabase.from("catalogo_produto").update(campos).eq("id", p.id)
    : supabase.from("catalogo_produto").insert(campos);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return paraApp(data);
}

export async function excluirProduto(id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const { error } = await supabase.from("catalogo_produto").delete().eq("id", id);
  if (error) throw error;
}

/* Fornecedor tem cadastro PRÓPRIO, e não é só um texto no produto: o
   contato de quem vende é o que falta na hora de pedir, e digitar
   "Nordecor" de três jeitos diferentes cria três fornecedores. */
export async function listarFornecedores() {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase.from("catalogo_fornecedor").select("*").order("nome");
  if (error) throw error;
  return (data || []).map((f) => ({
    id: f.id, nome: f.nome, contato: f.contato || null, telefone: f.telefone || null,
    email: f.email || null, site: f.site || null, observacoes: f.observacoes || null,
    ativo: f.ativo !== false,
  }));
}

export async function salvarFornecedor(f, por) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const nome = String(f.nome || "").trim();
  if (!nome) throw new Error("O nome do fornecedor é obrigatório.");
  const campos = {
    nome, contato: f.contato || null, telefone: f.telefone || null,
    email: f.email || null, site: f.site || null, observacoes: f.observacoes || null,
    ativo: f.ativo !== false, ...(f.id ? {} : { criado_por: por || null }),
  };
  const q = f.id
    ? supabase.from("catalogo_fornecedor").update(campos).eq("id", f.id)
    : supabase.from("catalogo_fornecedor").upsert(campos, { onConflict: "nome" });
  const { data, error } = await q.select().single();
  if (error) throw error;
  return { id: data.id, nome: data.nome, contato: data.contato, telefone: data.telefone,
    email: data.email, site: data.site, observacoes: data.observacoes, ativo: data.ativo !== false };
}

export async function excluirFornecedor(id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const { error } = await supabase.from("catalogo_fornecedor").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- IMAGEM ----------
 *
 * A foto é o que faz o catálogo ser catálogo: quem escolhe um spot
 * reconhece a peça antes de ler o código.
 */
export const BUCKET = "catalogo";

export async function subirImagem(file, id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  /* Nome com carimbo de tempo: reusar o caminho faria o navegador
     continuar mostrando a foto velha do cache depois da troca. */
  const caminho = `${id || "novo"}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, file, { upsert: true });
  if (error) throw error;
  return caminho;
}

export function urlDaImagem(caminho) {
  if (!caminho || !supabaseConfigurado) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}
