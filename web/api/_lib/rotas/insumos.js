/**
 * Banco de precos e cadastro de insumos do Sienge.
 * -----------------------------------------------------------
 * GET    /api/insumos/precos            -> a lista da tela (busca + limite)
 * GET    /api/insumos/precos/pagina     -> UMA pagina da base inteira (range)
 * GET    /api/insumos/precos/contagem   -> { total } de linhas na base
 * GET    /api/insumos/precos/sugestoes  -> candidatos de preco para uma descricao
 * POST   /api/insumos/precos            -> grava UM bloco da importacao (upsert)
 * DELETE /api/insumos/precos            -> limpa a base inteira
 * GET    /api/insumos/sienge            -> UMA pagina do cadastro de insumos ativos
 * POST   /api/insumos/sienge            -> grava UM bloco do cadastro (upsert)
 * POST   /api/insumos/sienge/remover    -> tira UM bloco de codigos do cadastro
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido.
 *
 * A PAGINACAO E OS BLOCOS FICAM NO FRONT, de proposito: cada chamada aqui
 * atende UMA pagina ou UM bloco. E' o que mantem o `onProgresso` da tela
 * ("Gravando 1.500 de 10.507…") funcionando e nenhum corpo de pedido
 * passando de 1 MB (o limite do leitor de JSON do mondayApp.js).
 *
 * Nao e' rota "de uma obra": aqui `exigirMembro` basta, e quem decide o
 * resto e' o RLS — como ja' era quando o navegador falava direto.
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirPerfilDeEdicao } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* As colunas listadas uma a uma, nunca o asterisco (SQL-32). Sao as
   mesmas que o navegador pedia antes desta rota existir. */
const COLUNAS_PRECO = "codigo, descricao, unidade, custo_unitario, data_ref, fornecedor";
const COLUNAS_BASE = "codigo, descricao, unidade, custo_unitario";
const COLUNAS_CHAVE = "codigo, descricao, unidade";

/* O front sobe em blocos de 500 (`TAMANHO_BLOCO` em web/src/lib/insumos.js)
   e le' de mil em mil. O teto aqui e' o dobro do bloco: da' folga se o
   bloco mudar e ainda assim nenhum corpo chega perto de 1 MB. */
const MAX_LINHAS_POR_BLOCO = 1000;
// O delete do cadastro vai em blocos de 150 (a lista de codigos ia na URL).
const MAX_CODIGOS_POR_BLOCO = 500;

/* ---------- o que pode chegar de fora (VH-06) ---------- */

const termoDeBusca = z.string().trim().max(200);
const limiteDaLista = z.coerce.number().int().min(1).max(500);

const queryLista = z.object({
  busca: termoDeBusca.optional(),
  limite: limiteDaLista.default(200),
}).strict();

const faixaDaPagina = {
  de: z.coerce.number().int().min(0).max(1_000_000),
  passo: z.coerce.number().int().min(1).max(1000),
};
const queryPagina = z.object({
  ...faixaDaPagina,
  // `chave` traz so' o que forma a chave do insumo; `custo` traz o preco junto.
  campos: z.enum(["chave", "custo"]).default("custo"),
}).strict();
const queryPaginaDoCadastro = z.object({ ...faixaDaPagina }).strict();

/* As palavras vem prontas do front (as duas mais longas da descricao) e
   podem repetir o mesmo nome de parametro: `?palavra=arandela&palavra=embutido`. */
const umaPalavra = z.string().trim().min(1).max(120);
const querySugestoes = z.object({
  palavra: z.preprocess(
    (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
    z.array(umaPalavra).min(1).max(4),
  ),
  limite: limiteDaLista.default(6),
}).strict();

/* OS TETOS ACOMPANHAM O BANCO, que e' `text` em todas estas colunas
   (supabase/schema.sql). Apertar mais do que o banco aperta nao protege
   nada e custa caro: a `unidade` sai do leitor de PDF do Sienge como "a
   linha entre a quantidade e o preco", e um layout diferente punha ali um
   texto comprido — que ANTES entrava no banco e agora derrubaria o bloco de
   500 linhas inteiro, no meio de uma importacao. O teto aqui existe so' pra
   barrar o absurdo (um corpo feito pra ocupar a funcao). */
const linhaDePreco = z.object({
  codigo: z.string().min(1).max(200),
  descricao: z.string().min(1).max(4000),
  unidade: z.string().max(400),
  custo_unitario: z.number().finite(),
  data_ref: z.string().max(40),
  fornecedor: z.string().max(400).nullish(),
}).strict();

const corpoDePrecos = z.object({
  linhas: z.array(linhaDePreco).min(1).max(MAX_LINHAS_POR_BLOCO),
}).strict();

const linhaDoCadastro = z.object({
  codigo: z.string().min(1).max(200),
  descricao: z.string().min(1).max(4000),
  unidade: z.string().max(40),
  preco_tabela: z.number().finite().nullable(),
}).strict();

const corpoDoCadastro = z.object({
  linhas: z.array(linhaDoCadastro).min(1).max(MAX_LINHAS_POR_BLOCO),
}).strict();

const corpoDeRemocao = z.object({
  codigos: z.array(z.string().min(1).max(60)).min(1).max(MAX_CODIGOS_POR_BLOCO),
}).strict();

/* ---------- o filtro de texto, montado com o que a pessoa digitou ----------

   `or=(codigo.ilike.%x%,descricao.ilike.%x%)` e' uma linguagem: virgula
   separa condicoes, ponto separa coluna/operador/valor, parenteses agrupam.
   Interpolar o termo cru deixava a pessoa (ou quem chamasse a API)
   escrever condicao nova dentro do filtro.

   O PostgREST resolve isso com valor entre aspas: dentro delas, virgula,
   ponto e parenteses sao texto. So' `"` e `\` precisam de barra invertida.
   O `%` continua sendo curinga do ilike, como sempre foi. */
function valorDoFiltro(texto) {
  return `"${String(texto).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** As colunas onde procurar o termo, no formato do `.or()`. */
function filtroDeBusca(termo, colunas) {
  const valor = valorDoFiltro(`%${termo}%`);
  return colunas.map((c) => `${c}.ilike.${valor}`).join(",");
}

/* ---------- "a tabela do cadastro nao existe" ----------

   E' so' isso, e nao qualquer erro que cite o nome dela: o Postgres cita o
   nome da tabela em quase tudo (falta de permissao vem como `new row
   violates row-level security policy for table "insumo_sienge"`). Um banco
   que RECUSOU a gravacao anunciado como "falta rodar o SQL" custa a tarde
   de quem esta' do outro lado.

   - 42P01: a tabela nao existe mesmo.
   - PGRST205: ela existe, mas o PostgREST ainda nao a enxerga (o cache de
     schema dele demora a recarregar depois de um `create table`). A saida
     e' outra, e por isso o app precisa saber diferenciar. */
const semTabelaCadastro = (e) => e?.code === "42P01" || e?.code === "PGRST205";
const cachePendente = (e) => e?.code === "PGRST205";

/**
 * O banco recusou a gravacao do cadastro por outro motivo.
 *
 * O caso que importa e' a politica de acesso: se o `create policy` do
 * insumo-sienge.sql nao tiver rodado, a leitura devolve vazio (o RLS
 * esconde tudo) e a gravacao e' recusada — e sem esta mensagem ninguem
 * descobre isso. O texto do Postgres fica no log, nao na tela (SEG-33).
 */
function mensagemDeRecusa(codigo) {
  const politica = "falta a política do supabase/insumo-sienge.sql — rode o arquivo inteiro";
  if (codigo === "42501") {
    return `O banco recusou a gravação do cadastro (código 42501): é "row-level security", ${politica}.`;
  }
  return `O banco recusou a gravação do cadastro${codigo ? ` (código ${codigo})` : ""}.`
    + ` Se for "row-level security" (código 42501), ${politica}.`;
}

function recusaDoCadastro(res, error) {
  const codigo = error?.code || null;
  console.error(JSON.stringify({
    level: "error", event: "insumo_sienge_gravacao_recusada", codigo,
  }));
  return res.status(codigo === "42501" ? 403 : 500).json({
    error: mensagemDeRecusa(codigo),
    code: codigo,
  });
}

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/* ---------- a base de precos ---------- */

rotas.get("/api/insumos/precos",
  zValidator("query", queryLista),
  async (req, res) => {
    const { busca, limite } = req.valido.query;
    let q = req.supabase
      .from("insumo_preco")
      .select(COLUNAS_PRECO)
      .order("data_ref", { ascending: false })
      .limit(limite);

    // busca no codigo OU na descricao — quem procura as vezes sabe o
    // codigo, as vezes so' lembra do nome
    const termo = (busca || "").trim();
    if (termo) q = q.or(filtroDeBusca(termo, ["codigo", "descricao"]));

    const { data, error } = await q;
    if (error) return erroDoBanco(res, error);
    res.json(data || []);
  });

/* Uma pagina da base inteira.
 *
 * O casamento de itens compara CADA item da obra contra a base inteira —
 * 200 itens contra milhares de insumos. Fazer isso por consulta seria 200
 * chamadas e uma tela travada; a base cabe na memoria e cabe de sobra.
 *
 * O front pagina de mil em mil porque o PostgREST corta em 1.000 por
 * padrao, e uma base cortada casa de vermelho o que existe — o pior erro
 * possivel aqui, porque manda cadastrar duplicado. */
rotas.get("/api/insumos/precos/pagina",
  zValidator("query", queryPagina),
  async (req, res) => {
    const { de, passo, campos } = req.valido.query;
    const { data, error } = await req.supabase
      .from("insumo_preco")
      .select(campos === "chave" ? COLUNAS_CHAVE : COLUNAS_BASE)
      .range(de, de + passo - 1);
    if (error) return erroDoBanco(res, error);
    res.json(data || []);
  });

rotas.get("/api/insumos/precos/contagem", async (req, res) => {
  const { count, error } = await req.supabase
    .from("insumo_preco")
    .select("id", { count: "exact", head: true });
  if (error) return erroDoBanco(res, error);
  res.json({ total: count || 0 });
});

/**
 * Precos de referencia parecidos com a descricao de um item.
 *
 * Devolve candidatos pra PESSOA escolher — de proposito nao preenche nada
 * sozinho. O mesmo codigo do Sienge cobre faixas enormes ("DECORATIVOS
 * OBRAS" vai de R$ 15 a R$ 3.845), entao um numero escolhido
 * automaticamente seria um chute com cara de certeza.
 */
rotas.get("/api/insumos/precos/sugestoes",
  zValidator("query", querySugestoes),
  async (req, res) => {
    const { palavra, limite } = req.valido.query;
    const { data, error } = await req.supabase
      .from("insumo_preco")
      .select(COLUNAS_PRECO)
      .or(palavra.map((p) => `descricao.ilike.${valorDoFiltro(`%${p}%`)}`).join(","))
      // Preco zero e' insumo do cadastro sem preco de tabela: nao e' referencia.
      .gt("custo_unitario", 0)
      .order("data_ref", { ascending: false })
      .limit(limite);
    if (error) return erroDoBanco(res, error);
    res.json(data || []);
  });

/**
 * Um bloco da base importada.
 *
 * Cada (codigo + descricao + unidade) tem uma linha so' — reimportar
 * atualiza o preco em vez de duplicar, entao da' pra subir um relatorio
 * novo do Sienge por cima do antigo sem limpar nada antes.
 */
rotas.post("/api/insumos/precos",
  zValidator("json", corpoDePrecos),
  async (req, res) => {
    const linhas = req.valido.json.linhas;
    const { error } = await req.supabase
      .from("insumo_preco")
      .upsert(linhas, { onConflict: "codigo,descricao,unidade" });
    if (error) return erroDoBanco(res, error);
    res.json({ gravados: linhas.length });
  });

/* APAGA A BASE INTEIRA — 10 mil linhas de preco pago, sem volta.
   Nao basta ser do time: a mesma regua de quem edita obra. Enquanto o
   navegador falava com o banco direto, isto exigia chamar o PostgREST na
   mao; virar uma URL do proprio dominio sem guarda seria trocar uma
   dificuldade por um clique. */
rotas.delete("/api/insumos/precos", exigirPerfilDeEdicao, async (req, res) => {
  const { error } = await req.supabase.from("insumo_preco").delete().gte("id", 0);
  if (error) return erroDoBanco(res, error);
  res.json({ limpou: true });
});

/* ---------- o cadastro de insumos ATIVOS do Sienge ----------

   `insumo_preco` guarda UMA LINHA POR COMPRA, muitas com o nome que o
   insumo tinha na epoca. O codigo 411 e' o exemplo: continua ativo no
   Sienge, mas hoje se chama "MOBILIA SOLTA - MESAS AUXILIARES", e a
   associacao mostrava "MESA DE CENTRO/LATERAL" porque esse era o nome mais
   repetido nas compras antigas. Esta tabela e' a lista do que o Sienge
   chama de insumo HOJE.

   Precisa do `supabase/insumo-sienge.sql`. Enquanto a tabela nao existir,
   a leitura devolve vazio em silencio e o app se comporta como antes —
   importar cadastro e' o que liga a regra. */

rotas.get("/api/insumos/sienge",
  zValidator("query", queryPaginaDoCadastro),
  async (req, res) => {
    const { de, passo } = req.valido.query;
    const { data, error } = await req.supabase
      .from("insumo_sienge")
      .select(COLUNAS_CHAVE)
      .range(de, de + passo - 1);
    // Tabela ainda nao criada: nao e' erro de tela, e' regra desligada.
    if (error) {
      if (semTabelaCadastro(error)) return res.json([]);
      return erroDoBanco(res, error);
    }
    res.json(data || []);
  });

/**
 * Um bloco do cadastro lido do relatorio: o que existe atualiza o nome.
 *
 * Sem a tabela, responde 200 com `semTabela` — a tela precisa distinguir
 * "falta rodar o SQL" (e avisar sem quebrar) de "o banco recusou".
 */
rotas.post("/api/insumos/sienge",
  zValidator("json", corpoDoCadastro),
  async (req, res) => {
    /* Quem importou vem do LOGIN, nunca do corpo do pedido (SEG-13). E' o
       mesmo e-mail que a tela mandava: o da sessao aberta. */
    const linhas = req.valido.json.linhas.map((l) => ({ ...l, importado_por: req.usuario.email }));
    const { error } = await req.supabase
      .from("insumo_sienge")
      .upsert(linhas, { onConflict: "codigo" });
    if (error) {
      if (semTabelaCadastro(error)) {
        return res.json({ gravados: 0, semTabela: true, cachePendente: cachePendente(error) });
      }
      return recusaDoCadastro(res, error);
    }
    res.json({ gravados: linhas.length });
  });

/**
 * Um bloco de codigos que saiu do cadastro.
 *
 * Sair da tabela e' o unico jeito de o insumo desativado parar de ser
 * oferecido, e e' seguro: aqui nao mora preco pago nenhum — isso fica em
 * `insumo_preco`, que esta rota nao encosta.
 */
rotas.post("/api/insumos/sienge/remover",
  zValidator("json", corpoDeRemocao),
  async (req, res) => {
    const { codigos } = req.valido.json;
    const { error } = await req.supabase.from("insumo_sienge").delete().in("codigo", codigos);
    if (error) return erroDoBanco(res, error);
    res.json({ removidos: codigos.length });
  });

module.exports = {
  rotasDeInsumos: rotas,
  // Abertos para os testes: sao as decisoes que este arquivo protege.
  filtroDeBusca, valorDoFiltro, semTabelaCadastro, cachePendente, mensagemDeRecusa,
};
