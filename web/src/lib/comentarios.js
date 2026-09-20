import { supabase, supabaseConfigurado } from "./supabase";

/* OBSERVACOES DA OBRA — o recado pra quem executa depois.
 *
 * "falta comprar divisor de talher", "nao pode esquecer de ver o tapetinho
 * das gavetas". E' a primeira coisa no app que nao e' decisao registrada:
 * justificativa, conferencia e liberacao sao carimbos de quem decidiu; isto
 * aqui e' aviso de quem passou pela obra pra quem vem depois.
 *
 * Mora em tabela propria (supabase/obra-comentario.sql), e nao dentro de
 * `obra_dados.categorias`, por dois motivos que valem mais que a
 * conveniencia: `categorias` e' TROCADA inteira quando alguem substitui a
 * Planilha Executivo, e escrever ali exigiria a trava de edicao da obra —
 * quem quer deixar um aviso nao pode ter que tomar a obra de quem esta'
 * trabalhando nela.
 */

/* O SQL ainda nao rodou. Dois codigos, um sentido so' — 42P01 e' o
   Postgres, PGRST205 e' o PostgREST sem a tabela no cache do schema. */
const semTabela = (erro) => erro?.code === "42P01" || erro?.code === "PGRST205";

/**
 * Todas as observacoes de uma obra, das mais antigas pras mais novas.
 *
 * Vem tudo de uma vez e a tela separa por verba: sao poucas linhas por obra,
 * e uma consulta por verba aberta seria dezenas de idas ao banco na mesma
 * pagina.
 *
 * Devolve `{ semTabela: true, comentarios: [] }` enquanto o SQL nao rodou,
 * pra tela poder dizer isso em vez de mostrar erro.
 */
export async function listarComentarios(obraCodigo) {
  if (!supabaseConfigurado) return { comentarios: [] };
  const { data, error } = await supabase
    .from("obra_comentario")
    .select("id, verba_num, item_chave, texto, autor, criado_em")
    .eq("obra_codigo", String(obraCodigo))
    .order("criado_em", { ascending: true });

  if (error) {
    if (semTabela(error)) return { semTabela: true, comentarios: [] };
    throw error;
  }
  return { comentarios: data || [] };
}

/**
 * Escreve uma observacao. `itemChave` vazio = observacao da VERBA.
 *
 * O AUTOR vai daqui, e nao da tela: e' o mesmo cuidado da remocao de item
 * (18/09/2026). Se o nome viesse da tela, bastaria um caminho novo pra
 * observacao chegar sem dono — e recado sem dono nao se cobra de ninguem.
 * A regra tambem esta' no banco: o `with check` recusa assinar por outro.
 */
export async function criarComentario({ obraCodigo, verbaNum, itemChave = null, texto, autor }) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");
  const limpo = String(texto || "").trim();
  if (!limpo) throw new Error("Escreva a observação interna antes de salvar.");
  if (!autor) throw new Error("Não consegui identificar quem está escrevendo.");

  const { data, error } = await supabase
    .from("obra_comentario")
    .insert({
      obra_codigo: String(obraCodigo),
      verba_num: String(verbaNum),
      item_chave: itemChave || null,
      texto: limpo,
      autor: String(autor).toLowerCase(),
    })
    .select("id, verba_num, item_chave, texto, autor, criado_em")
    .single();

  if (error) {
    if (semTabela(error)) throw new Error("As observações internas ainda não foram criadas no banco — falta rodar supabase/obra-comentario.sql.");
    throw error;
  }
  return data;
}

/**
 * Apaga uma observacao. Quem pode e' o autor ou um administrador, e quem
 * decide isso e' o BANCO (a politica de delete), nao a tela.
 *
 * Nao existe editar de proposito: recado alterado depois de lido confunde
 * mais do que ajuda. Quem errou apaga e escreve de novo, e a data nova conta
 * a verdade.
 */
export async function apagarComentario(id) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");
  const { error } = await supabase.from("obra_comentario").delete().eq("id", id);
  if (error) throw error;
}
