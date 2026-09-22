/**
 * Arquivo guardado — o que o navegador ainda faz, e por quê.
 * -----------------------------------------------------------
 * O dado do app passa todo pela API (VH-02). O ARQUIVO é a exceção
 * registrada: a foto do catálogo, o caderno do Executivo e o documento
 * assinado pelo cliente sobem DIRETO para o Storage, por um endereço
 * assinado que a API emite depois de conferir quem está mandando.
 *
 * Por que não passar o arquivo pela API: a função da Vercel corta o corpo
 * do pedido em 4,5 MB, e o balde `obra-arquivos` aceita até 50 MB por
 * arquivo. Um caderno de Executivo de 12 MB não caberia — e o caminho
 * "manda pro servidor, servidor manda pro Storage" gastaria a banda duas
 * vezes para chegar no mesmo lugar.
 *
 * Quem decide continua sendo a API: ela é que assina o endereço, e sem
 * assinatura o Storage recusa. É a saída que a própria regra prevê
 * ("upload direto por URL assinada emitida pela API").
 *
 * Regra: .quality/regras/perfis/webapp-vite-hono.md (VH-02).
 */
import { supabase } from "./supabase";

const URL_DO_BANCO = import.meta.env.VITE_SUPABASE_URL || "";

/**
 * O endereço público de um arquivo de balde público — montado aqui, sem
 * ida ao servidor. É a mesma URL que o supabase-js devolvia: o balde
 * `catalogo` é público de propósito (foto de produto e avatar aparecem
 * dezenas de vezes na mesma tela), então o endereço é previsível e não
 * carrega segredo nenhum.
 */
export function urlPublica(balde, caminho) {
  if (!caminho || !URL_DO_BANCO) return null;
  const partes = String(caminho).split("/").map(encodeURIComponent).join("/");
  return `${URL_DO_BANCO}/storage/v1/object/public/${balde}/${partes}`;
}

/** Os bytes de um arquivo público — é o que o gerador de PDF embute. */
export async function bytesDaUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Manda o arquivo pelo endereço que a API assinou.
 *
 * `assinatura` é o que a rota devolveu: { caminho, token }.
 */
export async function enviarAssinado(balde, assinatura, file, { upsert = true } = {}) {
  if (!supabase) throw new Error("Banco de dados não configurado — o arquivo não tem onde ficar guardado.");
  // gate-allow VH-02: upload direto por URL assinada emitida pela API — o corpo da função da Vercel para em 4,5 MB e o balde aceita 50 MB por arquivo; quem autoriza continua sendo a rota que assina
  const { error } = await supabase.storage
    .from(balde)
    .uploadToSignedUrl(assinatura.caminho, assinatura.token, file, {
      upsert,
      contentType: file?.type || undefined,
    });
  if (error) throw new Error(explicarStorage(error));
  return assinatura.caminho;
}

/* Erro do Storage chega como frase em inglês. As que a equipe realmente
   encontra viram instrução em português — principalmente a primeira, que
   não é defeito de quem está anexando: é a migração que ainda não rodou. */
export function explicarStorage(error) {
  const msg = error?.message || "";
  if (/bucket not found/i.test(msg))
    return 'O depósito de arquivos ainda não existe no banco. Rode "supabase/arquivos.sql" no SQL Editor do Supabase e tente de novo.';
  if (/exceeded the maximum allowed size|payload too large/i.test(msg))
    return "Arquivo grande demais — o limite é 50 MB por arquivo.";
  if (/mime type|not supported/i.test(msg))
    return "Tipo de arquivo não aceito aqui. Vale PDF, Excel, CSV, PNG ou JPG.";
  if (/row-level security|not authorized|jwt|expired/i.test(msg))
    return "Sua sessão expirou. Saia e entre de novo pra anexar.";
  return "Não consegui guardar o arquivo: " + msg;
}
