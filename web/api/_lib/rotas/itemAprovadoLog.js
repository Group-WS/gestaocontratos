/**
 * RN-002 — o registro das mudanças no item aprovado para compra.
 * -----------------------------------------------------------
 * GET /api/obras/:codigo/itens-aprovados/log[?idLinha=…]  -> { registros: [...] } (ou { semTabela: true, registros: [] })
 *
 * Quem escreve é o gatilho do banco (supabase/rn-002-compras-com-registro.sql),
 * a cada gravação da obra que muda um item aprovado. Aqui só se lê; quem
 * pode ler é o RLS (quem enxerga a obra).
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirObra } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

const semTabela = (erro) => erro?.code === "42P01" || erro?.code === "PGRST205";

/* As colunas que a tela lê. Uma a uma, nunca `*` (SQL-32). */
const COLUNAS = "id, verba, id_linha, descricao, campo, antes, depois, autor, criado_em";
const LIMITE = 200;

const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);
const paramObra = z.object({ codigo: codigoDeObra }).strict();
const consulta = z.object({ idLinha: z.string().trim().min(1).max(80).optional() }).strict();

const codigoDoPedido = (req) => req.valido.param.codigo;

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

rotas.get("/api/obras/:codigo/itens-aprovados/log",
  zValidator("param", paramObra),
  zValidator("query", consulta),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    let q = req.supabase
      .from("obra_item_aprovado_log")
      .select(COLUNAS)
      .eq("obra_codigo", codigoDoPedido(req));
    if (req.valido.query.idLinha) q = q.eq("id_linha", req.valido.query.idLinha);
    const { data, error } = await q.order("criado_em", { ascending: false }).limit(LIMITE);

    if (error) {
      if (semTabela(error)) return res.json({ semTabela: true, registros: [] });
      return erroDoBanco(res, error);
    }
    res.json({ registros: data || [] });
  });

module.exports = { rotasDeItemAprovadoLog: rotas };
