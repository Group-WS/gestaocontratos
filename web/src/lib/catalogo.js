import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";
import { urlPublica, enviarAssinado } from "./storage";
export * from "./catalogoModelo";

/* O acesso aos dados. A parte pura mora em catalogoModelo.js: ela e'
   testada sem supabase, e assim nenhum teste esbarra na rede.

   O caminho mudou de lugar, nao de regra: quem fala com o banco agora e'
   a API (web/api/_lib/rotas/catalogo.js), e este arquivo so' pede a ela.
   `supabaseConfigurado` continua aqui porque ele nao e' acesso a dado —
   e' a flag que diz se o app esta' rodando com banco (VH-02). */

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
  const data = await apiJson("/api/catalogo/produtos");
  return (data || []).map(paraApp);
}

/* `por` continua na assinatura, mas quem grava e' o LOGIN: o e-mail de
   quem cria sai da sessao, no servidor (SEG-13), e nao do que a tela
   manda junto. */
export async function salvarProduto(p, por) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  if (!String(p.descricao || "").trim()) throw new Error("A descrição é obrigatória.");
  if (!p.verba) throw new Error("O grupo é obrigatório — é ele que diz em qual verba o produto entra.");
  const corpo = { ...paraBanco(p), ...(p.id ? { id: p.id } : {}) };
  return paraApp(await apiJson("/api/catalogo/produtos", { metodo: "PUT", corpo }));
}

export async function excluirProduto(id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  await apiJson(`/api/catalogo/produtos/${encodeURIComponent(id)}`, { metodo: "DELETE" });
}

/* Fornecedor tem cadastro PRÓPRIO, e não é só um texto no produto: o
   contato de quem vende é o que falta na hora de pedir, e digitar
   "Nordecor" de três jeitos diferentes cria três fornecedores. */
export async function listarFornecedores() {
  if (!supabaseConfigurado) return [];
  const data = await apiJson("/api/catalogo/fornecedores");
  return (data || []).map((f) => ({
    id: f.id, nome: f.nome, contato: f.contato || null, telefone: f.telefone || null,
    email: f.email || null, site: f.site || null, observacoes: f.observacoes || null,
    ativo: f.ativo !== false,
  }));
}

/* Sem id, a API faz UPSERT pelo nome (o nome é único no banco): é o que
   permite a importação mandar os fornecedores da planilha um a um sem
   estourar duplicidade em quem já existe. */
export async function salvarFornecedor(f, por) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const nome = String(f.nome || "").trim();
  if (!nome) throw new Error("O nome do fornecedor é obrigatório.");
  const corpo = {
    nome, contato: f.contato || null, telefone: f.telefone || null,
    email: f.email || null, site: f.site || null, observacoes: f.observacoes || null,
    ativo: f.ativo !== false, ...(f.id ? { id: f.id } : {}),
  };
  const data = await apiJson("/api/catalogo/fornecedores", { metodo: "PUT", corpo });
  return { id: data.id, nome: data.nome, contato: data.contato, telefone: data.telefone,
    email: data.email, site: data.site, observacoes: data.observacoes, ativo: data.ativo !== false };
}

export async function excluirFornecedor(id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  await apiJson(`/api/catalogo/fornecedores/${encodeURIComponent(id)}`, { metodo: "DELETE" });
}

/* ---------- IMAGEM ----------
 *
 * A foto é o que faz o catálogo ser catálogo: quem escolhe um spot
 * reconhece a peça antes de ler o código.
 *
 * O arquivo continua subindo DIRETO para o Storage — o que mudou é quem
 * autoriza: a API assina o endereço depois de conferir quem está
 * mandando, e sem assinatura o Storage recusa (ver lib/storage.js).
 */
export const BUCKET = "catalogo";

export async function subirImagem(file, id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  /* Nome com carimbo de tempo: reusar o caminho faria o navegador
     continuar mostrando a foto velha do cache depois da troca. */
  const caminho = `${id || "novo"}/${Date.now()}.${ext}`;
  const assinatura = await apiJson("/api/catalogo/foto/envio", { metodo: "POST", corpo: { caminho } });
  return enviarAssinado(BUCKET, assinatura, file);
}

/* Síncrona de propósito: a tela chama dentro do render, uma vez por
   cartão. O balde é público, então o endereço se monta aqui mesmo, sem
   ida ao servidor por foto. */
export function urlDaImagem(caminho) {
  if (!caminho || !supabaseConfigurado) return null;
  return urlPublica(BUCKET, caminho);
}
