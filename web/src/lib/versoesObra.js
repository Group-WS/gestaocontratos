import { supabase, supabaseConfigurado } from "./supabase";

/* VERSOES ANTERIORES DA OBRA.
 *
 * Quem GRAVA e' o banco: o gatilho `trg_obra_dados_versao` guarda a linha
 * antiga a cada alteracao de conteudo (ver supabase/obra-versao.sql). Este
 * arquivo so' LE a lista e devolve uma versao pro lugar.
 *
 * Isso e' de proposito. Historico escrito pelo app teria o mesmo defeito do
 * app: o caminho que esquece de chamar. O gatilho pega tudo, inclusive
 * UPDATE rodado a mao no SQL Editor.
 */

/* O SQL ainda nao rodou.
 *
 * 42P01 e' o Postgres ("relation does not exist"); PGRST205 e' o PostgREST
 * quando o cache de schema nao conhece a tabela. Dois codigos, um sentido
 * so' — e nenhum outro erro pode virar "tabela nao existe", senao uma queda
 * de rede apareceria na tela como migracao pendente. */
const semTabela = (erro) => erro?.code === "42P01" || erro?.code === "PGRST205";

/* O que volta pro lugar numa restauracao.
 *
 * FICAM DE FORA, de proposito:
 *   editando_por / editando_desde — a trava e' de agora, nao de entao.
 *     Devolver a trava antiga deixaria a obra presa em nome de quem nao
 *     esta' mais nela.
 *   obra_codigo / criado_em / id — identidade da linha, nao conteudo.
 *   atualizado_por / atualizado_em — quem restaurou e' quem clicou agora.
 */
const CAMPOS_RESTAURAVEIS = [
  "categorias", "cadernos", "arquivos", "aprovacoes",
  "depara_aprovado", "executivo_liberado_direto", "compras_liberadas",
  "etapas_concluidas",
  "cliente_assinou_em", "cliente_assinatura_por", "cliente_assinatura_arq",
  "cliente_assinatura_obs",
  "compra_sem_assinatura_por", "compra_sem_assinatura_em", "compra_sem_assinatura_just",
  "cmv_liberado", "cmv_liberado_em", "cmv_liberado_por",
  "data_entrega", "escopos",
];

/**
 * As versoes guardadas desta obra, da mais nova pra mais velha.
 *
 * NAO traz o `conteudo`: ele e' o JSONB gordo — centenas de KB por versao —
 * e a lista so' precisa da data, de quem gravou e de quantos itens tinha.
 * O conteudo so' e' lido na hora de restaurar.
 *
 * Devolve `{ semTabela: true, versoes: [] }` enquanto o SQL nao rodou, pra
 * tela poder dizer isso em vez de mostrar erro.
 */
export async function listarVersoes(codigo) {
  if (!supabaseConfigurado) return { versoes: [] };
  const { data, error } = await supabase
    .from("obra_versao")
    .select("id, n_itens, queda, atualizado_por, criado_em")
    .eq("obra_codigo", String(codigo))
    .order("criado_em", { ascending: false });

  if (error) {
    if (semTabela(error)) return { semTabela: true, versoes: [] };
    throw error;
  }
  return { versoes: data || [] };
}

/**
 * Devolve a obra ao estado de uma versao.
 *
 * A propria restauracao vira versao: o UPDATE dispara o gatilho, que guarda
 * o estado de agora antes de troca-lo. Restaurar errado tem volta.
 */
export async function restaurarVersao(codigo, versaoId, email) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");

  const { data: versao, error } = await supabase
    .from("obra_versao")
    .select("id, obra_codigo, conteudo, n_itens, criado_em")
    .eq("id", versaoId)
    .maybeSingle();
  if (error) throw semTabela(error) ? new Error("O histórico de versões ainda não foi criado no banco.") : error;
  if (!versao) throw new Error("Essa versão não existe mais.");

  /* A versao e' de OUTRA obra. Nao deveria acontecer pela tela, mas o id
     vem de fora da funcao e restaurar a obra errada e' irreversivel do
     ponto de vista de quem perdeu o trabalho. */
  if (String(versao.obra_codigo) !== String(codigo)) {
    throw new Error("Essa versão é de outra obra — não restaurei nada.");
  }

  const de = versao.conteudo || {};
  const patch = { atualizado_por: email || null };
  /* So' o que EXISTE na versao. Coluna criada depois do snapshot nao
     aparece ali, e escrever `undefined` nela apagaria o valor de hoje. */
  CAMPOS_RESTAURAVEIS.forEach((c) => {
    if (Object.prototype.hasOwnProperty.call(de, c)) patch[c] = de[c];
  });

  const { error: erroAoGravar } = await supabase
    .from("obra_dados")
    .update(patch)
    .eq("obra_codigo", String(codigo));
  if (erroAoGravar) throw erroAoGravar;

  return { restaurou: versao.n_itens, de: versao.criado_em };
}
