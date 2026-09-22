import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";
import { urlPublica, bytesDaUrl, enviarAssinado } from "./storage";
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
 *
 * Quem fala com o banco é a API (VH-02, web/api/_lib/rotas/apresentacoes.js).
 * Só mudou o caminho — o que estas funções recebem e devolvem é o mesmo.
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
  const busca = obraCodigo ? `?obra=${encodeURIComponent(String(obraCodigo))}` : "";
  const data = await apiJson(`/api/apresentacoes${busca}`);
  return (data || []).map(paraApp);
}

/* `por` continua na assinatura porque as telas o passam, mas quem grava
   vem do LOGIN, no servidor (SEG-13): e-mail de dono de linha não se
   aceita do corpo do pedido. É o mesmo valor — o da pessoa logada. */
export async function salvarApresentacao(doc, por) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  if (!doc.obraCodigo) throw new Error("A apresentação precisa de uma obra.");
  const salvo = await apiJson("/api/apresentacoes", {
    metodo: "PUT",
    corpo: {
      /* Com `id` a rota atualiza a revisão; sem `id` ela cria outra linha —
         é assim que a REV 01 nasce sem apagar a 00. */
      ...(doc.id ? { id: doc.id } : {}),
      obraCodigo: String(doc.obraCodigo),
      capa: doc.capa || {},
      slides: doc.slides || [],
      idioma: doc.idioma || "pt",
    },
  });
  return paraApp(salvo);
}

export async function excluirApresentacao(id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  await apiJson(`/api/apresentacoes/${encodeURIComponent(id)}`, { metodo: "DELETE" });
}

/** Marca que esta revisão virou PDF, e onde ele foi parar. */
/* Sempre foi calado: o PDF já está gerado e guardado em Arquivos da obra,
   e falhar o carimbo não é motivo pra dizer que a geração deu errado. */
export async function marcarGerada(id, caminho) {
  if (!supabaseConfigurado || !id) return;
  try {
    await apiJson(`/api/apresentacoes/${encodeURIComponent(id)}/gerada`, {
      metodo: "PUT",
      corpo: { caminho },
    });
  } catch {
    /* silêncio proposital */
  }
}

/* As imagens de ambiente moram no mesmo balde do catálogo, numa pasta
   própria. Um balde só, um conjunto de permissões só — dois baldes seria
   o dobro de política pra manter e nenhuma vantagem. */
const BUCKET = "catalogo";

/* Quem monta o caminho (e o carimbo de tempo que evita o cache) é a rota:
   o navegador manda o nome do arquivo e sobe pelo endereço assinado. */
export async function subirAmbiente(file, obraCodigo) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const assinatura = await apiJson("/api/apresentacoes/ambiente/envio", {
    metodo: "POST",
    corpo: { ...(obraCodigo ? { obraCodigo: String(obraCodigo) } : {}), nome: file.name },
  });
  return enviarAssinado(BUCKET, assinatura, file, { upsert: true });
}

/* O balde `catalogo` é público de propósito (a mesma foto aparece dezenas
   de vezes na tela), então o endereço se monta aqui, sem ida ao servidor —
   e esta função continua SÍNCRONA, porque quem a chama é o render. */
export function urlDaImagem(caminho) {
  return urlPublica(BUCKET, caminho);
}

/** Os bytes de uma imagem do balde — é o que o gerador de PDF embute. */
export async function bytesDaImagem(caminho) {
  return bytesDaUrl(urlPublica(BUCKET, caminho));
}
