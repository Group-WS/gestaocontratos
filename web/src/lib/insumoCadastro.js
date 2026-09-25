/**
 * O Cadastro de Insumos visto do navegador (ADR-008).
 *
 * Tudo passa pela rota /api/insumo-cadastro (VH-02). A única exceção é o
 * arquivo do relatório, que sobe direto para o balde por um endereço que a
 * API assina (`enviarAssinado`, o mesmo caminho dos cadernos e contratos).
 */
import { apiJson } from "./api";
import { enviarAssinado } from "./storage";

const BASE = "/api/insumo-cadastro";
export const BALDE_DOS_RELATORIOS = "insumo-importacao";
export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Uma página da lista: `{ itens, total, faltaTabela?, aviso? }`. */
export function listarInsumos({ busca = "", ativo = "todos", unidade = "", de = 0, passo = 50 } = {}) {
  const q = new URLSearchParams({ ativo, de: String(de), passo: String(passo) });
  if (busca.trim().length >= 2) q.set("busca", busca.trim());
  if (unidade) q.set("unidade", unidade);
  return apiJson(`${BASE}?${q}`);
}

export const listarUnidades = () => apiJson(`${BASE}/unidades`);
export const lerTabelaAtiva = () => apiJson(`${BASE}/tabela-ativa`);
export const salvarTabelaAtiva = ({ codigo, nome }) => apiJson(`${BASE}/tabela-ativa`, { metodo: "PUT", corpo: { codigo, nome } });

export const criarInsumo = (dados) => apiJson(BASE, { metodo: "POST", corpo: dados });
export const editarInsumo = (id, mudancas) => apiJson(`${BASE}/${id}`, { metodo: "PATCH", corpo: mudancas });
export const usosDoInsumo = (id) => apiJson(`${BASE}/${id}/usos`);
export const historicoDoInsumo = (id) => apiJson(`${BASE}/${id}/historico`);
export const apagarInsumo = (id) => apiJson(`${BASE}/${id}`, { metodo: "DELETE" });

export const listarImportacoes = () => apiJson(`${BASE}/importacoes`);

/**
 * Registra a importação, sobe o arquivo para o balde e pede a prévia.
 * Devolve `{ id, resumo, listas }`.
 */
export async function enviarRelatorio(arquivo) {
  const { id, assinatura } = await apiJson(`${BASE}/importacoes`, { metodo: "POST", corpo: { nome: arquivo.name } });
  // O balde só aceita xlsx: o tipo vai explícito, mesmo quando o navegador não o informa.
  const comTipo = arquivo.type === TIPO_XLSX ? arquivo : new File([arquivo], arquivo.name, { type: TIPO_XLSX });
  await enviarAssinado(BALDE_DOS_RELATORIOS, assinatura, comTipo, { upsert: true });
  return pedirPrevia(id);
}

export const pedirPrevia = (id) => apiJson(`${BASE}/importacoes/${id}/previa`, { metodo: "POST" });

/**
 * Grava a importação até o fim. Cada chamada da API trabalha alguns segundos
 * e devolve o progresso; aqui chamamos de novo até ela concluir.
 * `aoAvancar(restantes)` recebe quanto falta.
 */
export async function aplicarImportacao(id, { caminho, conflitos = {}, confirmouNome = false }, aoAvancar) {
  for (let volta = 0; volta < 200; volta++) {
    const r = await apiJson(`${BASE}/importacoes/${id}/aplicar`, { metodo: "POST", corpo: { caminho, conflitos, confirmouNome } });
    if (r?.status === "concluida") return r;
    if (aoAvancar) aoAvancar(r?.restantes ?? null);
  }
  throw new Error("A gravação não terminou. Use Continuar para seguir de onde parou.");
}
