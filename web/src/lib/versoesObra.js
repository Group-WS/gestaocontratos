import { supabase, supabaseConfigurado } from "./supabase";
import { apiFetch } from "./api";

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

/* O que volta pro lugar numa restauracao mora na funcao do banco
 * `restaurar_versao_obra` (supabase/salvar-obra.sql), e nao mais aqui.
 *
 * FICAM DE FORA, de proposito:
 *   editando_por / editando_desde — a trava e' de agora, nao de entao.
 *     Devolver a trava antiga deixaria a obra presa em nome de quem nao
 *     esta' mais nela.
 *   obra_codigo / criado_em / id — identidade da linha, nao conteudo.
 *   atualizado_por / atualizado_em — quem restaurou e' quem clicou agora.
 *   versao — a versao da obra sobe na restauracao, nunca volta.
 */

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
 *
 * Era um UPSERT feito daqui, sem conferir nada. Agora passa pela API e pela
 * funcao `restaurar_versao_obra` (supabase/salvar-obra.sql), que faz o que
 * este arquivo fazia — so' os campos de conteudo que existem na versao,
 * a versao tem que ser desta obra, a obra apagada volta inteira — e mais:
 * nao restaura por cima de quem esta' editando, e sobe a versao da obra,
 * entao a tela que tinha a copia anterior nao grava por cima da restauracao.
 */
export async function restaurarVersao(codigo, versaoId) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");

  const res = await apiFetch(`/api/obras/${encodeURIComponent(String(codigo))}/versoes/${encodeURIComponent(String(versaoId))}/restaurar`,
    { method: "POST" });
  let dados = null;
  try { dados = await res.json(); } catch { /* resposta sem corpo */ }
  if (!res.ok) {
    if (res.status === 409 && dados?.motivo === "trava") {
      throw new Error(`${dados.por || "Outra pessoa"} está editando esta obra agora. Restaure depois que a edição terminar, para não apagar o trabalho em andamento.`);
    }
    if (res.status === 404) throw new Error("Essa versão não existe mais.");
    throw new Error(dados?.error || "Não foi possível restaurar a versão. Tente novamente em instantes.");
  }
  return { restaurou: dados.restaurou, de: dados.de, versao: dados.versao };
}
