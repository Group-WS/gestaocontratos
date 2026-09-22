import { apiFetch } from "./api";
import { ErroDeGravacao, erroDaResposta } from "./gravacaoObra";
import { totaisDoDocumento } from "./aditivoDoc";
import { resumoDoDoc } from "./documentosDaObra";

/* O banco, visto da tela. O modelo do documento — totais, numeracao, saldo —
   mora em aditivoDoc.js, sem import de rede, pra poder rodar no teste.

   Tudo passa pela API (web/api/_lib/rotas/documentosDaObra.js), que chama as
   funcoes do banco. O aditivo so' e' gravado com a VERSAO que a tela leu: se
   outra pessoa gravou no meio, a gravacao e' recusada com o motivo, e a tela
   avisa em vez de apagar o trabalho dela.

   O `numero` ("2405/3") sai do banco na criacao, com trava por obra: contar
   na tela fazia duas pessoas pedirem o mesmo numero no mesmo segundo. */

const paraApp = (l) => ({
  id: l.id,
  obraCodigo: l.obra_codigo,
  seq: l.seq,
  numero: l.numero,
  descricao: l.descricao || "",
  status: l.status || "rascunho",
  doc: l.dados || null,
  resumo: l.dados
    ? resumoDoDoc(l.dados)
    : { data: l.resumo_data ?? null, observacao: l.resumo_observacao ?? null, pipefy: l.resumo_pipefy ?? null },
  totalSupressao: Number(l.total_supressao) || 0,
  totalAdicao: Number(l.total_adicao) || 0,
  criadoEm: l.criado_em,
  criadoPor: l.criado_por,
  atualizadoEm: l.atualizado_em,
  atualizadoPor: l.atualizado_por,
  // Sem versao nao se grava, e quem grava sempre releu antes.
  versao: l.versao ?? null,
});

/** Chama a API e devolve o corpo; erro vira ErroDeGravacao (com `tipo`). */
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

/**
 * Os aditivos que a pessoa enxerga, com o documento: os aprovados entram nas
 * contas da obra (orcamento, CMV, Plano de Compras), e essas contas leem os
 * grupos de dentro dele.
 *
 * Para EDITAR, porem, ninguem parte daqui: `carregarAditivo` traz o documento
 * e a versao de agora, e e' esse que volta alterado. A lista pode estar
 * aberta ha meia hora.
 */
export async function listarAditivos(obraCodigo) {
  const busca = obraCodigo ? `?obra=${encodeURIComponent(String(obraCodigo))}` : "";
  const r = await pedir(`/api/aditivos${busca}`);
  return (r.aditivos || []).map(paraApp);
}

/** Um aditivo inteiro, com o documento e a versao de agora. */
export async function carregarAditivo(obraCodigo, id) {
  const r = await pedir(`/api/obras/${encodeURIComponent(String(obraCodigo))}/aditivos/${encodeURIComponent(String(id))}`);
  return paraApp(r.aditivo);
}

/**
 * Cria o aditivo na obra. O numero e a sequencia vem do banco — quem chama
 * manda so' o que a pessoa escreveu.
 */
export async function criarAditivo({ obraCodigo, descricao, doc }) {
  const t = totaisDoDocumento(doc);
  const r = await pedir(`/api/obras/${encodeURIComponent(String(obraCodigo))}/aditivos`, {
    method: "POST",
    body: JSON.stringify({
      campos: {
        descricao: descricao || "",
        dados: doc || {},
        total_supressao: t.supressao,
        total_adicao: t.adicao,
      },
    }),
  });
  return {
    id: r.id, seq: r.seq, numero: r.numero, versao: r.versao,
    obraCodigo: String(obraCodigo), descricao: descricao || "", status: "rascunho",
    doc: doc || {}, resumo: resumoDoDoc(doc), totalSupressao: t.supressao, totalAdicao: t.adicao,
  };
}

/**
 * Grava o aditivo. `versao` e' a que a tela leu; o que volta e' a nova.
 *
 * Nao manda mais `usuario`: quem gravou sai do login, no banco (o gatilho
 * `aditivo_autoria`) — o corpo do pedido nao decide autoria.
 */
export async function salvarAditivo(obraCodigo, id, versao, { descricao, status, doc } = {}) {
  const campos = {};
  if (descricao !== undefined) campos.descricao = descricao;
  if (status !== undefined) campos.status = status;
  if (doc !== undefined) {
    const t = totaisDoDocumento(doc);
    campos.dados = doc;
    campos.total_supressao = t.supressao;
    campos.total_adicao = t.adicao;
  }
  const r = await pedir(
    `/api/obras/${encodeURIComponent(String(obraCodigo))}/aditivos/${encodeURIComponent(String(id))}/gravar`,
    { method: "POST", body: JSON.stringify({ versao, campos }) },
  );
  return { versao: r.versao, campos };
}

export async function excluirAditivo(obraCodigo, id) {
  await pedir(`/api/obras/${encodeURIComponent(String(obraCodigo))}/aditivos/${encodeURIComponent(String(id))}`,
    { method: "DELETE" });
}
