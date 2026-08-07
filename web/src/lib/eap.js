import { supabase, supabaseConfigurado } from "./supabase";

/**
 * A EAP padrão da empresa, vinda da tabela `eap_grupo`.
 *
 * O app precisa da EAP em funções puras (os importadores, o depara), que
 * rodam em qualquer momento e não podem esperar uma promessa. Por isso o
 * padrão vive num registro de módulo: começa com o que veio no código e é
 * TROCADO quando o banco responde.
 *
 * Isso é de propósito, não preguiça. Se o Supabase estiver fora do ar ou
 * a tabela vazia, o app continua com uma EAP válida em vez de abrir sem
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

  const { data, error } = await supabase
    .from("eap_grupo")
    .select("num, nome, apelidos, analisar, motivo_na")
    .eq("ativo", true)
    .order("ordem");

  if (error) throw error;
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
