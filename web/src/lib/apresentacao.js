import { supabase, supabaseConfigurado } from "./supabase";
export * from "./apresentacaoModelo";

/**
 * Onde a apresentação fica guardada enquanto não vira PDF.
 *
 * Montar uma apresentação de vinte ambientes não se faz numa sentada. Sem
 * guardar, fechar a aba jogaria fora a tarde inteira — e a pessoa
 * descobriria isso justamente ao voltar.
 *
 * Uma por obra e por revisão: a REV 01 não apaga a 00, porque a 00 já foi
 * apresentada ao cliente e alguém vai querer conferir o que mudou.
 */

const paraApp = (r) => ({
  id: r.id,
  obraCodigo: r.obra_codigo,
  rev: r.rev,
  capa: r.capa || {},
  slides: Array.isArray(r.slides) ? r.slides : [],
  idioma: r.idioma || "pt",
  arquivo: r.arquivo || null,
  geradoEm: r.gerado_em || null,
  atualizadoEm: r.atualizado_em,
  atualizadoPor: r.atualizado_por,
});

export async function listarApresentacoes(obraCodigo) {
  if (!supabaseConfigurado) return [];
  let q = supabase.from("apresentacao").select("*").order("atualizado_em", { ascending: false });
  if (obraCodigo) q = q.eq("obra_codigo", String(obraCodigo));
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(paraApp);
}

export async function salvarApresentacao(doc, por) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  if (!doc.obraCodigo) throw new Error("A apresentação precisa de uma obra.");
  const linha = {
    obra_codigo: String(doc.obraCodigo),
    rev: doc.capa?.rev || "00",
    capa: doc.capa || {},
    slides: doc.slides || [],
    idioma: doc.idioma || "pt",
    atualizado_por: por || null,
    atualizado_em: new Date().toISOString(),
    ...(doc.id ? {} : { criado_por: por || null }),
  };
  const q = doc.id
    ? supabase.from("apresentacao").update(linha).eq("id", doc.id)
    : supabase.from("apresentacao").insert(linha);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return paraApp(data);
}

export async function excluirApresentacao(id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const { error } = await supabase.from("apresentacao").delete().eq("id", id);
  if (error) throw error;
}

/** Marca que esta revisão virou PDF, e onde ele foi parar. */
export async function marcarGerada(id, caminho) {
  if (!supabaseConfigurado || !id) return;
  await supabase.from("apresentacao")
    .update({ arquivo: caminho, gerado_em: new Date().toISOString() })
    .eq("id", id);
}

/* As imagens de ambiente moram no mesmo balde do catálogo, numa pasta
   própria. Um balde só, um conjunto de permissões só — dois baldes seria
   o dobro de política pra manter e nenhuma vantagem. */
const BUCKET = "catalogo";

export async function subirAmbiente(file, obraCodigo) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  /* Carimbo de tempo no nome: reusar o caminho faria o navegador
     continuar mostrando o render antigo, do cache, depois da troca. */
  const caminho = `ambientes/${obraCodigo || "sem-obra"}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, file, { upsert: true });
  if (error) throw error;
  return caminho;
}

export function urlDaImagem(caminho) {
  if (!caminho || !supabaseConfigurado) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

/** Os bytes de uma imagem do balde — é o que o gerador de PDF embute. */
export async function bytesDaImagem(caminho) {
  if (!caminho || !supabaseConfigurado) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
