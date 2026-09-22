/**
 * Preferencias da pessoa — o que a tela lembra de cada um.
 * -----------------------------------------------------------
 * GET /api/preferencias           todas as da pessoa logada, { chave: valor }
 * PUT /api/preferencias/:chave    grava uma: { valor }
 *
 * Moram no banco (supabase/preferencia.sql) e seguem a pessoa entre
 * computadores (NAV-02). O e-mail vem do LOGIN, nunca do pedido (SEG-13); a
 * chave e o formato do valor sao conferidos aqui, e o RLS garante que cada
 * um so' toca as proprias linhas.
 *
 * Molde das rotas de dados: valida -> autoriza (login, membro) -> grava com
 * o client do usuario (RLS) -> responde, com erro do banco traduzido.
 */

const express = require("express");
const { exigirLogin, exigirMembro } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* As preferencias que existem, e o formato de cada uma. Chave nova entra
   aqui (e no hook do front, web/src/lib/preferencias.js). */
const nomeDeGrupo = z.string().min(1).max(120);
const PREFERENCIAS = {
  "obras.so_minhas": z.boolean(),
  "obras.modo": z.enum(["numero", "squad"]),
  "obras.squads_fechados": z.array(nomeDeGrupo).max(50),
  "equipe.grupos_fechados": z.array(nomeDeGrupo).max(50),
};

const paramChave = z.object({ chave: z.enum(Object.keys(PREFERENCIAS)) }).strict();
const corpoValor = z.object({ valor: z.unknown() }).strict();

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

rotas.get("/api/preferencias", async (req, res) => {
  const { data, error } = await req.supabase
    .from("preferencia")
    .select("chave, valor")
    .eq("email", req.usuario.email);
  if (error) return erroDoBanco(res, error);
  // So' as chaves que ainda existem: preferencia aposentada nao volta pra tela.
  res.json(Object.fromEntries(data.filter((p) => p.chave in PREFERENCIAS).map((p) => [p.chave, p.valor])));
});

rotas.put("/api/preferencias/:chave",
  zValidator("param", paramChave),
  zValidator("json", corpoValor),
  async (req, res) => {
    const { chave } = req.valido.param;
    const valido = PREFERENCIAS[chave].safeParse(req.valido.json.valor);
    if (!valido.success) {
      return res.status(400).json({ error: "Os dados enviados não estão no formato esperado.", campos: ["valor"] });
    }
    const { error } = await req.supabase
      .from("preferencia")
      .upsert(
        { email: req.usuario.email, chave, valor: valido.data, atualizado_em: new Date().toISOString() },
        { onConflict: "email,chave" },
      );
    if (error) return erroDoBanco(res, error);
    res.json({ chave, valor: valido.data });
  });

module.exports = { rotasDePreferencias: rotas, PREFERENCIAS };
