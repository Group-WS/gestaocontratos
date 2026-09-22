/**
 * Catalogo TKWS — o que a casa especifica, e quem vende.
 * -----------------------------------------------------------
 * GET    /api/catalogo/produtos           -> as linhas de `catalogo_produto`
 * PUT    /api/catalogo/produtos           -> grava uma (update com id, insert sem)
 * DELETE /api/catalogo/produtos/:id       -> tira do catalogo
 * GET    /api/catalogo/fornecedores       -> as linhas de `catalogo_fornecedor`
 * PUT    /api/catalogo/fornecedores       -> grava uma (update com id, upsert por nome sem)
 * DELETE /api/catalogo/fornecedores/:id   -> tira do cadastro
 * POST   /api/catalogo/foto/envio         -> assina a subida da foto do produto
 *
 * Antes o navegador falava direto com `catalogo_produto`, com
 * `catalogo_fornecedor` e com o balde `catalogo` do Storage. Agora o
 * caminho e' este: navegador -> API -> banco (VH-02). Quem decide o que
 * cada um ve e grava continua sendo o RLS, porque tudo aqui roda com o
 * client do PROPRIO usuario (`req.supabase`) — a rota nao e' porta de
 * servico para quem o banco recusaria.
 *
 * O formato que a tela consome (camelCase, preco em centavos) continua
 * sendo montado no front, em `web/src/lib/catalogo.js`: aqui trafega a
 * linha do banco como ela e'.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido.
 */

const express = require("express");
const { exigirLogin, exigirMembro } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");
const { assinarEnvio, erroDoStorage } = require("../storage.js");

/* O balde da foto do produto — publico de proposito (supabase/catalogo.sql):
   a foto aparece dezenas de vezes na mesma tela e nao carrega segredo. */
const BALDE = "catalogo";

/* As colunas, uma a uma (SQL-32). Sao exatamente as que a tela le em
   `paraApp`/`paraBanco`; `atualizado_em` fica de fora porque nenhuma tela
   a mostra. Coluna nova no catalogo entra AQUI tambem — o que some desta
   lista some da tela. */
const COLUNAS_PRODUTO =
  "id, verba, subgrupo, descricao, tipo_item, descricao_criativo, descricao_en, "
  + "codigo, fornecedor, observacoes, preco_ref, preco_em, imagem, unidade, ativo, "
  + "criado_em, criado_por";

const COLUNAS_FORNECEDOR =
  "id, nome, contato, telefone, email, site, observacoes, ativo";

/* ---------- o que pode chegar ---------- */

const textoOuNulo = (max) => z.string().max(max).nullable();
const paramId = z.object({ id: z.string().uuid() }).strict();

/* Os nomes sao os das COLUNAS: quem traduz de camelCase para o banco e'
   o front (`paraBanco`), que ja' fazia isso quando gravava direto. */
const produtoParaGravar = z.object({
  // Sem id e' produto novo; com id, e' o que ja' existe sendo corrigido.
  id: z.string().uuid().optional(),
  verba: z.string().min(1).max(40),
  subgrupo: textoOuNulo(200),
  descricao: z.string().min(1).max(4000),
  tipo_item: z.enum(["produto", "acabamento"]),
  descricao_criativo: textoOuNulo(4000),
  descricao_en: textoOuNulo(4000),
  codigo: textoOuNulo(200),
  fornecedor: textoOuNulo(200),
  observacoes: textoOuNulo(4000),
  // CENTAVOS inteiros: o banco guarda integer, e float de dinheiro soma errado.
  preco_ref: z.number().int().nullable(),
  preco_em: z.string().regex(/^\d{4}-\d{2}-\d{2}/).max(40).nullable(),
  imagem: textoOuNulo(300),
  unidade: z.string().min(1).max(40),
  ativo: z.boolean(),
}).strict();

const fornecedorParaGravar = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(200),
  contato: textoOuNulo(200),
  telefone: textoOuNulo(200),
  email: textoOuNulo(200),
  site: textoOuNulo(400),
  observacoes: textoOuNulo(4000),
  ativo: z.boolean(),
}).strict();

/* O caminho da foto e' montado no front (`id/carimbo.ext`) porque o
   carimbo de tempo e' o que impede o navegador de continuar mostrando a
   foto velha do cache. Aqui ele e' CONFERIDO: `assinarEnvio` recusa
   caminho que tente escapar da pasta ("..", barra no comeco). */
const fotoParaEnviar = z.object({
  caminho: z.string().min(1).max(300),
}).strict();

const FORMATO = "Os dados enviados não estão no formato esperado.";

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/* ---------- PRODUTO ---------- */

rotas.get("/api/catalogo/produtos", async (req, res) => {
  const { data, error } = await req.supabase
    .from("catalogo_produto")
    .select(COLUNAS_PRODUTO)
    .order("verba").order("subgrupo").order("descricao");
  if (error) return erroDoBanco(res, error);
  res.json(data || []);
});

rotas.put("/api/catalogo/produtos",
  zValidator("json", produtoParaGravar),
  async (req, res) => {
    const { id, ...campos } = req.valido.json;
    /* Quem criou vem do LOGIN, nunca do pedido (SEG-13), e so' na
       criacao: corrigir um produto nao muda de quem ele e'. */
    const q = id
      ? req.supabase.from("catalogo_produto").update(campos).eq("id", id)
      : req.supabase.from("catalogo_produto").insert({ ...campos, criado_por: req.usuario.email });
    const { data, error } = await q.select(COLUNAS_PRODUTO).single();
    if (error) return erroDoBanco(res, error);
    res.json(data);
  });

rotas.delete("/api/catalogo/produtos/:id",
  zValidator("param", paramId),
  async (req, res) => {
    const { error } = await req.supabase
      .from("catalogo_produto").delete().eq("id", req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

/* ---------- FORNECEDOR ----------
 *
 * Fornecedor tem cadastro PROPRIO, e nao e' so' um texto no produto: o
 * contato de quem vende e' o que falta na hora de pedir, e digitar
 * "Nordecor" de tres jeitos diferentes cria tres fornecedores.
 */

rotas.get("/api/catalogo/fornecedores", async (req, res) => {
  const { data, error } = await req.supabase
    .from("catalogo_fornecedor")
    .select(COLUNAS_FORNECEDOR)
    .order("nome");
  if (error) return erroDoBanco(res, error);
  res.json(data || []);
});

rotas.put("/api/catalogo/fornecedores",
  zValidator("json", fornecedorParaGravar),
  async (req, res) => {
    const { id, ...campos } = req.valido.json;
    /* Sem id o caminho e' UPSERT por NOME: a importacao manda os
       fornecedores da planilha um a um, e o nome e' unico no banco —
       quem ja' existe e' atualizado em vez de estourar duplicidade. */
    const q = id
      ? req.supabase.from("catalogo_fornecedor").update(campos).eq("id", id)
      : req.supabase.from("catalogo_fornecedor")
        .upsert({ ...campos, criado_por: req.usuario.email }, { onConflict: "nome" });
    const { data, error } = await q.select(COLUNAS_FORNECEDOR).single();
    if (error) return erroDoBanco(res, error);
    res.json(data);
  });

rotas.delete("/api/catalogo/fornecedores/:id",
  zValidator("param", paramId),
  async (req, res) => {
    const { error } = await req.supabase
      .from("catalogo_fornecedor").delete().eq("id", req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

/* ---------- A FOTO ----------
 *
 * E' o que faz o catalogo ser catalogo: quem escolhe um spot reconhece a
 * peca antes de ler o codigo. O arquivo sobe DIRETO para o Storage, pelo
 * endereco que esta rota assina depois de conferir quem esta' mandando
 * (o mesmo desenho do resto do app — ver web/src/lib/storage.js).
 */

rotas.post("/api/catalogo/foto/envio",
  zValidator("json", fotoParaEnviar),
  async (req, res) => {
    const { caminho, token, error, erroDeCaminho } =
      await assinarEnvio(req.supabase, BALDE, req.valido.json.caminho);
    if (erroDeCaminho) return res.status(400).json({ error: FORMATO, campos: ["caminho"] });
    if (error) return erroDoStorage(res, error);
    res.json({ caminho, token });
  });

module.exports = { rotasDeCatalogo: rotas };
