import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

/**
 * A EAP padrão da empresa, vinda da tabela `eap_grupo` — agora pela API
 * (`GET /api/eap/grupos`), que é quem fala com o banco (VH-02).
 *
 * O app precisa da EAP em funções puras (os importadores, o depara), que
 * rodam em qualquer momento e não podem esperar uma promessa. Por isso o
 * padrão vive num registro de módulo: começa com o que veio no código e é
 * TROCADO quando o banco responde.
 *
 * Isso é de propósito, não preguiça. Se a API estiver fora do ar ou a
 * tabela vazia, o app continua com uma EAP válida em vez de abrir sem
 * grupo nenhum e descartar tudo que for importado.
 */

let registro = null;

export function definirEapPadrao(grupos, apelidos, naoAnalisadas) {
  registro = { grupos, apelidos, naoAnalisadas };
}

export function eapAtual() {
  return registro;
}

/** true quando o que está valendo veio do banco, não do código. */
export let veioDoBanco = false;

export async function carregarEapDoBanco() {
  if (!supabaseConfigurado) return null;

  const data = await apiJson("/api/eap/grupos");

  // Tabela vazia não substitui o padrão do código: ficar sem EAP é pior
  // que ficar com uma desatualizada — sem grupo, todo item importado é
  // descartado.
  if (!data || data.length === 0) return null;

  const grupos = data.map((g) => ({ num: g.num, nome: g.nome }));
  const apelidos = {};
  const naoAnalisadas = {};
  data.forEach((g) => {
    apelidos[g.num] = Array.isArray(g.apelidos) ? g.apelidos : [];
    if (!g.analisar) naoAnalisadas[g.num] = g.motivo_na || "Não conferido item a item nesta etapa";
  });

  definirEapPadrao(grupos, apelidos, naoAnalisadas);
  veioDoBanco = true;
  return { grupos: grupos.length, apelidos: Object.values(apelidos).flat().length, naoAnalisadas: Object.keys(naoAnalisadas).length };
}

/**
 * Ensina a verba um nome de grupo que ela não reconhecia (RN-030): o
 * apelido fica em `eap_grupo.apelidos`, e a EAP em uso é recarregada para
 * valer já nesta sessão.
 */
export async function ensinarApelidoDaVerba(num, apelido) {
  await apiJson(`/api/eap/grupos/${encodeURIComponent(num)}/apelidos`, { metodo: "PUT", corpo: { apelido } });
}
