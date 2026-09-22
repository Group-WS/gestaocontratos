import { apiFetch } from "./api";
import { ErroDeGravacao, erroDaResposta, bytesParaBase64 } from "./gravacaoObra";
import { reduzirImagem } from "./imagem";
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
 * Tudo passa pela API (web/api/_lib/rotas/documentosDaObra.js), que chama as
 * funções do banco. A gravação leva a VERSÃO que a tela leu: duas pessoas na
 * mesma revisão não se apagam mais em silêncio — a segunda é recusada com o
 * motivo, e a tela avisa.
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
  versao: r.versao ?? null,
});

async function pedir(caminho, opcoes = {}) {
  let res;
  try {
    res = await apiFetch(caminho, {
      ...opcoes,
      headers: opcoes.body ? { "Content-Type": "application/json", ...(opcoes.headers || {}) } : opcoes.headers,
    });
  } catch {
    throw new ErroDeGravacao("Sem conexão com o servidor.", { tipo: "temporario" });
  }
  let dados = null;
  try { dados = await res.json(); } catch { /* resposta sem corpo */ }
  if (!res.ok) throw erroDaResposta(res.status, dados);
  return dados || {};
}

const daObra = (obraCodigo) => `/api/obras/${encodeURIComponent(String(obraCodigo))}`;

/**
 * As revisões desta obra, da mais nova pra mais velha. SEM capa e slides:
 * a lista mostra revisão, data e quem mexeu. O documento vem de
 * `carregarApresentacao`, na hora de abrir — assim se edita sempre a partir
 * do que está no banco.
 */
export async function listarApresentacoes(obraCodigo) {
  if (!obraCodigo) return [];
  const r = await pedir(`${daObra(obraCodigo)}/apresentacoes`);
  return (r.apresentacoes || []).map(paraApp);
}

/** Uma revisão inteira, com capa, slides e a versão de agora. */
export async function carregarApresentacao(obraCodigo, id) {
  const r = await pedir(`${daObra(obraCodigo)}/apresentacoes/${encodeURIComponent(String(id))}`);
  return paraApp(r.apresentacao);
}

/* O que vai para o banco, com os nomes das colunas. A trava de quem gravou
   não vai: quem gravou é o login, no banco. */
const conteudoDaTela = (doc) => ({
  capa: doc.capa || {},
  slides: Array.isArray(doc.slides) ? doc.slides : [],
  idioma: doc.idioma || "pt",
});

/** Cria a revisão. Revisão que já existe volta como conflito, com o motivo. */
export async function criarApresentacao(obraCodigo, rev, doc) {
  const r = await pedir(`${daObra(obraCodigo)}/apresentacoes`, {
    method: "POST",
    body: JSON.stringify({ rev: String(rev || "00"), conteudo: conteudoDaTela(doc || {}) }),
  });
  return { id: r.id, rev: r.rev, versao: r.versao };
}

/** Grava a revisão com a versão que a tela leu; devolve a versão nova. */
export async function salvarApresentacao(obraCodigo, id, versao, doc) {
  const r = await pedir(`${daObra(obraCodigo)}/apresentacoes/${encodeURIComponent(String(id))}/gravar`, {
    method: "POST",
    body: JSON.stringify({ versao, conteudo: conteudoDaTela(doc) }),
  });
  return { versao: r.versao };
}

export async function excluirApresentacao(obraCodigo, id) {
  await pedir(`${daObra(obraCodigo)}/apresentacoes/${encodeURIComponent(String(id))}`, { method: "DELETE" });
}

/** Marca que esta revisão virou PDF, e onde ele foi parar. */
export async function marcarGerada(obraCodigo, id, versao, caminho) {
  const r = await pedir(`${daObra(obraCodigo)}/apresentacoes/${encodeURIComponent(String(id))}/gravar`, {
    method: "POST",
    body: JSON.stringify({
      versao,
      conteudo: { arquivo: caminho || null, gerado_em: new Date().toISOString() },
    }),
  });
  return { versao: r.versao };
}

/* ---------- as imagens dos ambientes ---------- */

/* Elas moram no balde da OBRA (`obra-arquivos/<codigo>/ambientes/`), junto
   com os outros arquivos dela: mesmo balde privado, mesmas permissões. Antes
   ficavam no balde do catálogo, que é público — quem tivesse o endereço via
   o render de qualquer obra. As que já estão lá continuam abrindo. */

/** Sobe a foto do ambiente (reduzida pelo navegador) e devolve o caminho. */
export async function subirAmbiente(file, obraCodigo) {
  if (!obraCodigo) throw new Error("Escolha a obra antes de subir a imagem.");
  const { tipo, bytes } = await reduzirImagem(file);
  const r = await pedir(`${daObra(obraCodigo)}/ambientes`, {
    method: "POST",
    body: JSON.stringify({ nome: file.name || "ambiente.jpg", tipo, base64: bytesParaBase64(bytes) }),
  });
  return r.caminho;
}

/** Os endereços para VER estas imagens (assinados, valem uma hora). */
export async function enderecosDeImagens(obraCodigo, caminhos) {
  const lista = [...new Set((caminhos || []).filter(Boolean))];
  if (!obraCodigo || !lista.length) return {};
  const r = await pedir(`${daObra(obraCodigo)}/ambientes/links`, {
    method: "POST",
    body: JSON.stringify({ caminhos: lista }),
  });
  return r.urls || {};
}

/**
 * Um leitor de bytes para o gerador do PDF e do PPTX: `(caminho) => bytes`.
 *
 * Guarda os endereços já pedidos, porque o mesmo render costuma aparecer em
 * mais de um slide, e devolve `null` quando a imagem não abre — um render
 * que sumiu não pode derrubar o documento inteiro.
 */
export function criarLeitorDeImagens(obraCodigo) {
  const endereco = new Map();
  return async function bytesDaImagem(caminho) {
    if (!caminho) return null;
    try {
      if (!endereco.has(caminho)) {
        const urls = await enderecosDeImagens(obraCodigo, [caminho]);
        endereco.set(caminho, urls[caminho] || null);
      }
      const url = endereco.get(caminho);
      if (!url) return null;
      const resposta = await fetch(url);
      if (!resposta.ok) return null;
      return new Uint8Array(await resposta.arrayBuffer());
    } catch {
      return null;
    }
  };
}
