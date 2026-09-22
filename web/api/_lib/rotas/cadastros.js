/**
 * Tres cadastros pequenos da empresa, num arquivo so'.
 * -----------------------------------------------------------
 * GET    /api/alocacao-padrao             -> [{ descricao, alocacao }]
 * PUT    /api/alocacao-padrao             { chave, descricao, alocacao }
 * DELETE /api/alocacao-padrao/:chave      tira a decisao daquela descricao
 *
 * GET    /api/compradores                 -> { lista: [...], faltaTabela? }
 * PUT    /api/compradores                 { grupo, email, nome }
 * DELETE /api/compradores/:grupo          o grupo fica sem comprador
 *
 * GET    /api/prestadores-internos        -> { lista: [...], faltaTabela? }
 * PUT    /api/prestadores-internos        { id?, nome, especialidade, funcao, diaria, ativo } -> a linha gravada
 * DELETE /api/prestadores-internos/:id    tira a pessoa da equipe interna
 *
 * Sao tres cadastros da EMPRESA (nao de uma obra): quem pode ler e quem
 * pode escrever esta' no RLS de cada tabela — o time inteiro le', so'
 * administrador escreve em comprador_grupo e prestador_interno
 * (supabase/compradores.sql, supabase/mao-de-obra-propria.sql,
 * supabase/alocacao.sql). Por isso aqui basta exigir login e ser do time:
 * a ultima palavra continua sendo do banco, como era quando o navegador
 * falava direto com ele.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido. Quem
 * assina a linha vem do LOGIN, nunca do corpo do pedido (SEG-13).
 */

const express = require("express");
const { exigirLogin, exigirMembro } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* A tabela ainda nao existe (o SQL nao rodou): a tela avisa em vez de
   quebrar. Esta decisao dependia do codigo de erro do Postgres e morava no
   navegador; agora quem fala com o banco e' esta rota, entao ela mora aqui
   — o front recebe a decisao ja' tomada (`faltaTabela: true`). */
const faltaTabela = (e, tabela) => !!e && (e.code === "42P01" || e.code === "PGRST205"
  || (new RegExp(tabela).test(e.message || "") && /exist|schema cache/i.test(e.message || "")));

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/* ---------- alocacao de recurso padrao, por descricao ---------- */

/* A chave e' a descricao NORMALIZADA — sem acento, sem caixa, sem espaco
   dobrado (supabase/alocacao.sql). Quem normaliza continua sendo a tela
   (web/src/lib/alocacaoPadrao.js): e' a mesma normalizacao que casa o item
   na lista, chamada no meio da renderizacao. Aqui a chave e' CONFERIDA —
   chave fora dessa forma vira uma linha que a tela nunca mais acha. */
const jaNormalizada = (s) => s === s.toLowerCase()
  && s === s.trim()
  && !/\s\s/.test(s)
  && !/[^\S ]/.test(s)
  && !/[̀-ͯ]/.test(s.normalize("NFD"));

const chaveDaAlocacao = z.string().min(1).max(1000).refine(jaNormalizada);
// O mesmo check da coluna `alocacao` na tabela.
const alocacaoDoItem = z.enum(["MAT", "MO", "AMBOS"]);

const corpoDaAlocacao = z.object({
  chave: chaveDaAlocacao,
  descricao: z.string().min(1).max(1000),
  alocacao: alocacaoDoItem,
}).strict();
const paramChaveDaAlocacao = z.object({ chave: chaveDaAlocacao }).strict();

rotas.get("/api/alocacao-padrao", async (req, res) => {
  const { data, error } = await req.supabase
    .from("alocacao_padrao")
    .select("descricao, alocacao");
  if (error) return erroDoBanco(res, error);
  res.json(data || []);
});

rotas.put("/api/alocacao-padrao",
  zValidator("json", corpoDaAlocacao),
  async (req, res) => {
    const { chave, descricao, alocacao } = req.valido.json;
    const { error } = await req.supabase.from("alocacao_padrao").upsert({
      descricao_norm: chave,
      // Como foi escrito da ultima vez: a chave e' a comparacao, esta e' a leitura.
      descricao,
      alocacao,
      por: req.usuario.email,
      em: new Date().toISOString(),
    }, { onConflict: "descricao_norm" });
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

/* A chave vai no endereco com `encodeURIComponent` (a tela): descricao tem
   barra ("forro 1/2 polegada"), e `%2F` chega aqui como um pedaco so' — o
   Express casa a rota no endereco cru e so' depois decodifica o parametro. */
rotas.delete("/api/alocacao-padrao/:chave",
  zValidator("param", paramChaveDaAlocacao),
  async (req, res) => {
    const { error } = await req.supabase
      .from("alocacao_padrao")
      .delete()
      .eq("descricao_norm", req.valido.param.chave);
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

/* ---------- quem compra cada grupo de compra ---------- */

/* O grupo e' guardado pelo NOME: a numeracao da EAP ja' mudou uma vez e
   obra antiga guarda numero velho. Um comprador por grupo. */
const nomeDoGrupo = z.string().min(1).max(500);
const corpoDoComprador = z.object({
  grupo: nomeDoGrupo,
  // A pessoa vem da lista de pessoas do time (tabela `pessoa`), escolhida
  // num Select: aqui se confere o formato, quem pode atribuir e' o RLS.
  email: z.string().min(1).max(320),
  nome: z.string().min(1).max(320),
}).strict();
const paramGrupo = z.object({ grupo: nomeDoGrupo }).strict();

rotas.get("/api/compradores", async (req, res) => {
  const { data, error } = await req.supabase
    .from("comprador_grupo")
    .select("grupo, comprador_email, comprador_nome");
  if (error) {
    if (faltaTabela(error, "comprador_grupo")) return res.json({ lista: [], faltaTabela: true });
    return erroDoBanco(res, error);
  }
  res.json({ lista: data || [] });
});

rotas.put("/api/compradores",
  zValidator("json", corpoDoComprador),
  async (req, res) => {
    const { grupo, email, nome } = req.valido.json;
    const { error } = await req.supabase.from("comprador_grupo").upsert({
      grupo, comprador_email: email, comprador_nome: nome,
      atualizado_em: new Date().toISOString(), atualizado_por: req.usuario.email,
    }, { onConflict: "grupo" });
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

// Nome de grupo tambem tem barra ("Louças/metais") — ver a alocacao acima.
rotas.delete("/api/compradores/:grupo",
  zValidator("param", paramGrupo),
  async (req, res) => {
    const { error } = await req.supabase
      .from("comprador_grupo")
      .delete()
      .eq("grupo", req.valido.param.grupo);
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

/* ---------- a mao de obra propria (equipe interna) ---------- */

// Nunca `select("*")`: as colunas que a tela usa, e so' elas (SQL-32).
const COLUNAS_DO_PRESTADOR = "id, nome, especialidade, funcao, diaria, ativo";

const corpoDoPrestador = z.object({
  // Sem `id` e' cadastro novo; com `id` e' a linha que ja' existe.
  id: z.uuid().optional(),
  nome: z.string().max(500).nullable(),
  especialidade: z.string().min(1).max(500),
  funcao: z.string().min(1).max(500),
  diaria: z.number().nonnegative().finite(),
  ativo: z.boolean(),
}).strict();
const paramIdDoPrestador = z.object({ id: z.uuid() }).strict();

rotas.get("/api/prestadores-internos", async (req, res) => {
  const { data, error } = await req.supabase
    .from("prestador_interno")
    .select(COLUNAS_DO_PRESTADOR)
    .order("especialidade")
    .order("funcao");
  if (error) {
    if (faltaTabela(error, "prestador_interno")) return res.json({ lista: [], faltaTabela: true });
    return erroDoBanco(res, error);
  }
  res.json({ lista: data || [] });
});

rotas.put("/api/prestadores-internos",
  zValidator("json", corpoDoPrestador),
  async (req, res) => {
    const { id, ...campos } = req.valido.json;
    const linha = {
      ...campos,
      atualizado_em: new Date().toISOString(),
      atualizado_por: req.usuario.email,
    };
    /* Dois caminhos, cada um com o seu nome: cadastrar CRIA a linha,
       editar MUDA a que ja' existe. Os dois devolvem a linha gravada, que
       e' o que a tela poe de volta na lista. */
    if (id) {
      const { data, error } = await req.supabase
        .from("prestador_interno")
        .update(linha)
        .eq("id", id)
        .select(COLUNAS_DO_PRESTADOR)
        .single();
      if (error) return erroDoBanco(res, error);
      return res.json(data);
    }
    const { data, error } = await req.supabase
      .from("prestador_interno")
      .insert(linha)
      .select(COLUNAS_DO_PRESTADOR)
      .single();
    if (error) return erroDoBanco(res, error);
    res.json(data);
  });

rotas.delete("/api/prestadores-internos/:id",
  zValidator("param", paramIdDoPrestador),
  async (req, res) => {
    const { error } = await req.supabase
      .from("prestador_interno")
      .delete()
      .eq("id", req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

module.exports = { rotasDeCadastros: rotas };
