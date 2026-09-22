/**
 * Observacoes internas da obra — o recado pra quem executa depois.
 * -----------------------------------------------------------
 * GET    /api/obras/:codigo/comentarios   -> { comentarios: [...] } (ou { semTabela: true, comentarios: [] })
 * POST   /api/obras/:codigo/comentarios   -> grava um recado e devolve a linha
 * DELETE /api/comentarios/:id             -> apaga (quem pode e' o BANCO que decide)
 *
 * "falta comprar divisor de talher", "nao pode esquecer de ver o tapetinho
 * das gavetas". Nao e' decisao registrada: e' aviso de quem passou pela obra
 * pra quem vem depois.
 *
 * Ate' 22/09/2026 o navegador falava com a tabela direto (VH-02). Mudou o
 * CAMINHO, nao a regra. Duas coisas que vieram do front junto e nao podem
 * se perder:
 *
 *  1. O AUTOR vem do login (`req.usuario.email`), nunca do pedido (SEG-13):
 *     e' o mesmo cuidado da remocao de item. Se o nome viesse da tela,
 *     bastaria um caminho novo pra observacao chegar sem dono — e recado sem
 *     dono nao se cobra de ninguem. A regra tambem esta' no banco: o
 *     `with check` recusa assinar por outro.
 *  2. O SQL ainda nao rodou (42P01 / PGRST205) deixa de ser erro e vira
 *     resposta: a tela diz "ainda nao criado no banco" em vez de quebrar.
 *
 * Comentar NAO exige a trava de edicao da obra, e nao e' so' de quem edita:
 * a decisao de 19/09/2026 e' que TODO MUNDO que entra no app comenta (o
 * `with check` de supabase/obra-comentario.sql diz o mesmo). Por isso as
 * duas rotas da obra usam `exigirObra`, a barreira de QUEM ENXERGA a obra —
 * `exigirEdicaoDeObra` tiraria o recado da mao da Mehoo e da Taylor Made.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido.
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirObra } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* O SQL ainda nao rodou. Dois codigos, um sentido so' — 42P01 e' o
   Postgres, PGRST205 e' o PostgREST sem a tabela no cache do schema. */
const semTabela = (erro) => erro?.code === "42P01" || erro?.code === "PGRST205";

/* As colunas que a tela le'. Uma a uma, nunca `*` (SQL-32). */
const COLUNAS = "id, verba_num, item_chave, texto, autor, criado_em";

const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);

const paramObra = z.object({ codigo: codigoDeObra }).strict();
// O id e' `bigint generated always as identity`: chega na URL como texto.
const paramId = z.object({ id: z.coerce.number().int().positive() }).strict();

const corpoNovo = z.object({
  verbaNum: z.string().min(1).max(60),
  // Vazio e nulo sao a MESMA coisa aqui: observacao da VERBA. String vazia
  // viraria um recado preso a um produto de nome "" que nao existe.
  itemChave: z.string().max(2000).nullish(),
  texto: z.string().trim().min(1).max(20000),
}).strict();

const codigoDoPedido = (req) => req.valido.param.codigo;

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

rotas.get("/api/obras/:codigo/comentarios",
  zValidator("param", paramObra),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    /* Vem tudo de uma vez e a tela separa por verba: sao poucas linhas por
       obra, e uma consulta por verba aberta seria dezenas de idas ao banco
       na mesma pagina. */
    const { data, error } = await req.supabase
      .from("obra_comentario")
      .select(COLUNAS)
      .eq("obra_codigo", codigoDoPedido(req))
      .order("criado_em", { ascending: true });

    if (error) {
      if (semTabela(error)) return res.json({ semTabela: true, comentarios: [] });
      return erroDoBanco(res, error);
    }
    res.json({ comentarios: data || [] });
  });

rotas.post("/api/obras/:codigo/comentarios",
  zValidator("param", paramObra),
  exigirObra(codigoDoPedido),
  zValidator("json", corpoNovo),
  async (req, res) => {
    const c = req.valido.json;
    const { data, error } = await req.supabase
      .from("obra_comentario")
      .insert({
        obra_codigo: codigoDoPedido(req),
        verba_num: c.verbaNum,
        item_chave: c.itemChave || null,
        texto: c.texto,
        // O autor vem do LOGIN, nunca do corpo do pedido (SEG-13).
        autor: req.usuario.email,
      })
      .select(COLUNAS)
      .single();

    if (error) {
      if (semTabela(error)) {
        return res.status(503).json({
          error: "As observações internas ainda não foram criadas no banco — falta rodar supabase/obra-comentario.sql.",
          code: error.code,
        });
      }
      return erroDoBanco(res, error);
    }
    res.json(data);
  });

rotas.delete("/api/comentarios/:id",
  zValidator("param", paramId),
  async (req, res) => {
    /* Quem pode apagar e' o autor ou um administrador, e quem decide isso e'
       o BANCO (a politica de delete), nao a tela. Sem obra no caminho de
       proposito: o recado e' identificado pelo id, e a politica ja' sabe de
       quem ele e'.

       Nao existe editar de proposito: recado alterado depois de lido confunde
       mais do que ajuda. Quem errou apaga e escreve de novo, e a data nova
       conta a verdade. */
    const { error } = await req.supabase.from("obra_comentario").delete().eq("id", req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    res.status(204).end();
  });

module.exports = { rotasDeComentarios: rotas, semTabela };
