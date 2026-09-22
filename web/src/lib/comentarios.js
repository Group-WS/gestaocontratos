import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

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
 *
 * Desde 22/09/2026 quem fala com a tabela e' a API
 * (web/api/_lib/rotas/comentarios.js), e nao mais o navegador (VH-02).
 * Duas coisas foram junto, porque dependem do banco: o AUTOR (o servidor
 * carimba o e-mail do login) e a leitura do "o SQL ainda nao rodou".
 */

/**
 * Todas as observacoes de uma obra, das mais antigas pras mais novas.
 *
 * Vem tudo de uma vez e a tela separa por verba: sao poucas linhas por obra,
 * e uma consulta por verba aberta seria dezenas de idas ao banco na mesma
 * pagina.
 *
 * Devolve `{ semTabela: true, comentarios: [] }` enquanto o SQL nao rodou,
 * pra tela poder dizer isso em vez de mostrar erro. Quem reconhece a tabela
 * que falta e' a rota — o codigo do Postgres nao chega mais aqui.
 */
export async function listarComentarios(obraCodigo) {
  if (!supabaseConfigurado) return { comentarios: [] };
  return apiJson(`/api/obras/${encodeURIComponent(String(obraCodigo))}/comentarios`);
}

/**
 * Escreve uma observacao. `itemChave` vazio = observacao da VERBA.
 *
 * O AUTOR nao vai no pedido, e' o SERVIDOR que carimba quem esta' logado:
 * e' o mesmo cuidado da remocao de item (18/09/2026), agora um passo mais
 * atras. Se o nome viesse da tela, bastaria um caminho novo pra observacao
 * chegar sem dono — e recado sem dono nao se cobra de ninguem. A regra
 * tambem esta' no banco: o `with check` recusa assinar por outro.
 *
 * `autor` continua sendo pedido aqui porque a tela sem ninguem identificado
 * nao tenta gravar: a recusa acontece antes da viagem, com a mesma frase de
 * sempre.
 */
export async function criarComentario({ obraCodigo, verbaNum, itemChave = null, texto, autor }) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");
  const limpo = String(texto || "").trim();
  if (!limpo) throw new Error("Escreva a observação interna antes de salvar.");
  if (!autor) throw new Error("Não consegui identificar quem está escrevendo.");

  return apiJson(`/api/obras/${encodeURIComponent(String(obraCodigo))}/comentarios`, {
    metodo: "POST",
    corpo: { verbaNum: String(verbaNum), itemChave: itemChave || null, texto: limpo },
  });
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
  await apiJson(`/api/comentarios/${encodeURIComponent(id)}`, { metodo: "DELETE" });
}
