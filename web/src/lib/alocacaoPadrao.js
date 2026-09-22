import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

/**
 * Alocação de recurso padrão da empresa, por DESCRIÇÃO do item.
 *
 * "Anotação de responsabilidade técnica – RRT" é mão de obra em toda obra
 * que a Group WS faz. "Caçambas de entulho" também. Corrigir isso obra a
 * obra é refazer a mesma decisão pra sempre — e basta alguém esquecer uma
 * vez pra o valor cair na coluna errada e o contrato nascer menor do que
 * deveria.
 *
 * Então a correção vale pra empresa inteira: mexeu numa obra, toda obra
 * que tiver a mesma descrição passa a nascer certa. A obra específica
 * ainda pode discordar — `alocacaoManual` no item ganha deste padrão.
 *
 * Mora num registro de módulo pelo mesmo motivo da EAP (ver lib/eap.js):
 * `alocacaoDoItem` e `parcelasDoItem` são funções puras, chamadas no meio
 * da renderização, e não podem esperar uma promessa.
 *
 * O banco fica atrás da API (web/api/_lib/rotas/cadastros.js): o navegador
 * não fala mais com o Supabase fora do login (VH-02). O que a tela faz
 * continua igual — o caminho é que mudou.
 */

let registro = new Map();

/* A comparação é por descrição normalizada: sem acento, sem caixa, sem
   espaço dobrado. O mesmo item vem escrito de três jeitos entre planilhas
   ("Caçambas de entulho", "CAÇAMBAS DE ENTULHO ", "Caçambas  de entulho")
   e as três têm que casar — é a mesma razão pela qual o depara casa por
   descrição e não por código.

   Normalizar é daqui, e não da API: é esta mesma função que casa o item na
   tela, chamada na renderização. A rota recebe a chave já normalizada e
   confere que ela chegou nessa forma. */
export function normalizarDesc(desc) {
  return String(desc || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

/** MAT | MO | AMBOS, ou null quando a empresa nunca decidiu essa descrição. */
export function padraoDaDescricao(desc) {
  const chave = normalizarDesc(desc);
  if (!chave) return null;
  return registro.get(chave) || null;
}

export function definirPadroes(lista) {
  registro = new Map();
  (lista || []).forEach((p) => {
    const chave = normalizarDesc(p.descricao);
    if (chave && p.alocacao) registro.set(chave, p.alocacao);
  });
}

export function quantosPadroes() { return registro.size; }

export async function carregarAlocacoesDoBanco() {
  if (!supabaseConfigurado) return 0;
  const lista = await apiJson("/api/alocacao-padrao");
  definirPadroes(lista || []);
  return registro.size;
}

/**
 * Grava a decisão como padrão da empresa.
 *
 * Atualiza o registro em memória ANTES de ir ao banco: a tela tem que
 * reagir no clique, e se a gravação falhar a pessoa já vê o efeito e o
 * erro junto — em vez de clicar de novo achando que não pegou.
 *
 * `por` continua na assinatura porque a tela sabe quem mexeu, mas não vai
 * no pedido: quem assina a linha é o login conferido no servidor (SEG-13).
 */
export async function salvarAlocacaoPadrao(desc, alocacao, por) {
  const chave = normalizarDesc(desc);
  if (!chave) return;
  if (alocacao) registro.set(chave, alocacao); else registro.delete(chave);
  if (!supabaseConfigurado) return;

  if (!alocacao) {
    await apiJson(`/api/alocacao-padrao/${encodeURIComponent(chave)}`, { metodo: "DELETE" });
    return;
  }
  await apiJson("/api/alocacao-padrao", {
    metodo: "PUT",
    corpo: { chave, descricao: String(desc).trim(), alocacao },
  });
}
