/**
 * Ler o conteudo da obra, a trava de edicao e o historico de versoes.
 * -----------------------------------------------------------
 * GET    /api/obras/:codigo/conteudo   -> { gzip }  a linha de obra_dados
 * POST   /api/obras/:codigo/conteudo   -> {}        so' garante que a linha existe
 * POST   /api/obras/:codigo/edicao     -> { ok: true, gzip } | { ok: false, por, desde }
 * DELETE /api/obras/:codigo/edicao     -> {}        devolve a obra pros outros
 * GET    /api/obras-travas             -> [{ obra_codigo, editando_por, editando_desde }]
 * POST   /api/obras-resumos            -> { gzip }  um LOTE de obras, so' as colunas do painel
 * GET    /api/obras/:codigo/versoes    -> { versoes } | { semTabela: true, versoes: [] }
 *
 * A ESCRITA do conteudo mora em obraDados.js (gravar, patch, restaurar) e nao
 * passa por aqui. Aqui fica o que a tela LE e a trava que diz quem pode
 * escrever.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido. O
 * e-mail de quem pega e de quem devolve a trava vem do LOGIN, nunca do
 * pedido (SEG-13).
 *
 * POR QUE A LEITURA VOLTA COMPRIMIDA
 * ----------------------------------
 * A funcao da Vercel corta o corpo em 4,5 MB — nos dois sentidos. A
 * GRAVACAO ja' sobe comprimida por causa disso (ver obraDados.js e
 * `salvarDadosObra`); a leitura tem o mesmo teto e a mesma carga: o
 * `categorias` de uma obra grande sozinho passa de 1 MB em JSON. Entao a
 * obra inteira (`/conteudo`, a trava que devolve a obra junto) e o lote do
 * painel (`/obras-resumos`) voltam em `{ gzip: "<base64>" }`, e o navegador
 * descomprime com o `fflate` (web/src/lib/dadosObra.js) — o caminho inverso
 * do `gzipSync`/`strToU8` da gravacao.
 */

const express = require("express");
const { gzipSync } = require("node:zlib");
const { exigirLogin, exigirMembro, exigirObra, exigirEdicaoDeObra } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* AS COLUNAS DA OBRA — todas as que `paraApp(linha)` le no navegador
   (web/src/lib/dadosObra.js), mais a `versao`. Era um `select("*")` feito do
   navegador; virou lista porque coluna que nao se usa nao viaja (SQL-32) —
   mas AQUI ela tem que estar COMPLETA: campo que faltar nao da' erro, some
   da tela como se o banco estivesse vazio. Campo novo em `paraApp` entra
   nesta lista no mesmo commit. */
const COLUNAS_DA_OBRA = [
  "categorias", "cadernos", "arquivos", "aprovacoes",
  "depara_aprovado", "executivo_liberado_direto", "compras_liberadas",
  "etapas_concluidas",
  "cliente_assinou_em", "cliente_assinatura_por", "cliente_assinatura_arq", "cliente_assinatura_obs",
  "compra_sem_assinatura_por", "compra_sem_assinatura_em", "compra_sem_assinatura_just",
  "data_entrega", "escopos",
  "cmv_liberado", "cmv_liberado_em", "cmv_liberado_por",
  "editando_por", "editando_desde",
  "atualizado_em", "atualizado_por",
  "versao",
];

/* AS COLUNAS QUE SEMPRE EXISTIRAM — o conjunto minimo, de quando `obra_dados`
   nasceu. As outras chegaram em SQL separado (salvar-obra.sql, escopos.sql,
   prazos.sql, etapas.sql, arquivos-obra.sql), e entre o deploy do app e
   alguem rodar um deles existe uma janela em que o Postgres recusa a leitura
   INTEIRA por causa de uma coluna desconhecida.

   O `select("*")` do navegador atravessava essa janela sozinho: devolvia a
   linha sem a coluna, e `paraApp` fazia `versao: linha.versao ?? null` — a
   obra abria em leitura e a tela dizia o que faltava rodar. Sem este retry a
   obra ficaria inutilizavel, com uma frase generica. E' o mesmo cinto de
   `listarObras` (web/api/_lib/rotas/obras.js). */
const COLUNAS_DE_SEMPRE = [
  "categorias", "cadernos", "arquivos", "aprovacoes",
  "depara_aprovado", "compras_liberadas",
  "editando_por", "editando_desde",
  "atualizado_em", "atualizado_por",
];

const faltaColuna = (error) => !!error && (
  error.code === "42703" || error.code === "PGRST204"
  || /column .* does not exist|Could not find the/i.test(error.message || ""));

/** A linha da obra, com o retry sem as colunas novas. */
async function lerObra(supabase, codigo) {
  const completa = await supabase
    .from("obra_dados").select(COLUNAS_DA_OBRA.join(", "))
    .eq("obra_codigo", codigo).maybeSingle();
  if (!completa.error || !faltaColuna(completa.error)) return completa;
  return supabase
    .from("obra_dados").select(COLUNAS_DE_SEMPRE.join(", "))
    .eq("obra_codigo", codigo).maybeSingle();
}

/* O RESUMO DO PAINEL — colunas escolhidas a dedo. `categorias` ja' e' um
   JSONB gordo; trazer `cadernos`, `escopos` e o resto de dezenas de obras
   encheria a memoria com o que a tela do painel nao le. */
const COLUNAS_DO_RESUMO =
  "obra_codigo, categorias, data_entrega, compras_liberadas, cadernos, depara_aprovado, cmv_liberado, cliente_assinou_em";

/* O MESMO PRAZO DA TELA (web/src/lib/dadosObra.js, MINUTOS_ATE_TRAVA_EXPIRAR).
   Depois deste tempo SEM ALTERACAO a trava e' considerada abandonada: outra
   pessoa assume e o cadeado sai da lista. O vencimento e' aplicado em tres
   lugares, e dois deles sao aqui: a condicao do UPDATE que toma a trava e o
   filtro da lista de cadeados. O terceiro e' a leitura da obra, no
   navegador (`travaViva` dentro de `paraApp`). Mudou aqui, muda la'. */
const MINUTOS_ATE_TRAVA_EXPIRAR = 5;
const limiteDaTrava = () => new Date(Date.now() - MINUTOS_ATE_TRAVA_EXPIRAR * 60_000).toISOString();

/* O SQL do historico ainda nao rodou.
 *
 * 42P01 e' o Postgres ("relation does not exist"); PGRST205 e' o PostgREST
 * quando o cache de schema nao conhece a tabela. Dois codigos, um sentido
 * so' — e nenhum outro erro pode virar "tabela nao existe", senao uma queda
 * de rede apareceria na tela como migracao pendente.
 *
 * A decisao vivia no navegador, com o codigo do erro do Postgres na mao;
 * agora quem fala com o banco e' esta rota, entao ela decide e o front
 * recebe a resposta pronta. */
const semTabela = (erro) => erro?.code === "42P01" || erro?.code === "PGRST205";

/** O JSON que vai para a tela, comprimido (ver o cabecalho deste arquivo). */
const comprimido = (valor) => ({ gzip: gzipSync(Buffer.from(JSON.stringify(valor ?? null), "utf8")).toString("base64") });

const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);
const paramCodigo = z.object({ codigo: codigoDeObra }).strict();
/* Um LOTE do painel. Quem fatia e' a tela (web/src/lib/dadosObra.js), que
   manda de doze em doze e vai preenchendo o painel a cada resposta; o teto
   daqui so' impede um pedido feito para varrer o banco inteiro de uma vez. */
const corpoDosResumos = z.object({ codigos: z.array(codigoDeObra).min(1).max(100) }).strict();

const codigoDoPedido = (req) => req.valido.param.codigo;

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/* ---------- o conteudo da obra ---------- */

rotas.get("/api/obras/:codigo/conteudo",
  zValidator("param", paramCodigo),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await lerObra(req.supabase, codigoDoPedido(req));
    if (error) return erroDoBanco(res, error);
    // Obra sem linha ainda: volta `null`, e a tela segue com o cadastro do Monday.
    res.json(comprimido(data || null));
  });

/**
 * So' garante que a linha da obra existe — sem mexer em nada que ja' esteja
 * la', nem trava de edicao, nem conteudo (`ignoreDuplicates` faz o upsert
 * nao tocar em nada quando a linha ja' existe).
 *
 * Uma obra cadastrada na mao (fora do fluxo normal de upload de planilha)
 * nunca ganha essa linha sozinha, e sem ela "Arquivos da obra" nao tem onde
 * guardar nada — quem descobria isso era a geracao de PDF da apresentacao,
 * no meio do processo, tarde demais.
 */
rotas.post("/api/obras/:codigo/conteudo",
  zValidator("param", paramCodigo),
  exigirEdicaoDeObra(codigoDoPedido),
  async (req, res) => {
    const { error } = await req.supabase
      .from("obra_dados")
      .upsert({ obra_codigo: codigoDoPedido(req) }, { onConflict: "obra_codigo", ignoreDuplicates: true });
    if (error) return erroDoBanco(res, error);
    res.json({});
  });

/* ---------- a trava de edicao ---------- */

/**
 * Tenta pegar a obra pra editar.
 *
 * A trava so' e' tomada se estiver livre, ja' for desta pessoa ou tiver
 * vencido — e a condicao vai DENTRO do UPDATE. E' isso que faz quem chega em
 * segundo lugar simplesmente nao atualizar nenhuma linha e descobrir. Ler,
 * decidir e so' entao gravar deixaria a fresta em que as duas pessoas leem
 * "livre" antes de qualquer uma escrever.
 *
 * Responde `{ ok: true, gzip }` com a obra como esta' no banco NO INSTANTE
 * em que a trava foi pega — a mesma linha que o UPDATE devolve. E' ela que a
 * tela passa a editar: a copia que estava aberta pode ser de antes da ultima
 * gravacao de outra pessoa, e editar a partir dela apagaria esse trabalho.
 *
 * Nao conseguiu: `{ ok: false, por, desde }`, a trava como esta' no banco. A
 * regua do vencimento na LEITURA e' aplicada na tela (`travaViva`), a mesma
 * que a leitura da obra usa.
 */
rotas.post("/api/obras/:codigo/edicao",
  zValidator("param", paramCodigo),
  exigirEdicaoDeObra(codigoDoPedido),
  async (req, res) => {
    const codigo = codigoDoPedido(req);
    const email = req.usuario.email;
    const limite = limiteDaTrava();
    const agora = new Date().toISOString();

    // A obra pode nao ter linha ainda (cadastro na mao): sem linha, nao ha' o que travar.
    const { error: erroDaLinha } = await req.supabase
      .from("obra_dados")
      .upsert({ obra_codigo: codigo }, { onConflict: "obra_codigo", ignoreDuplicates: true });
    if (erroDaLinha) return erroDoBanco(res, erroDaLinha);

    const { data, error } = await req.supabase
      .from("obra_dados")
      .update({ editando_por: email, editando_desde: agora })
      .eq("obra_codigo", codigo)
      .or(`editando_por.is.null,editando_por.eq.${email},editando_desde.lt.${limite}`)
      .select(COLUNAS_DA_OBRA.join(", "))
      .maybeSingle();
    if (error && faltaColuna(error)) {
      /* Mesma janela de migracao da leitura: o UPDATE funciona, so' o SELECT
         de volta pede coluna que ainda nao existe. A trava JA' foi tomada
         aqui — entao le' de novo, com o conjunto minimo, em vez de recusar. */
      const r = await lerObra(req.supabase, codigo);
      if (r.error) return erroDoBanco(res, r.error);
      if (r.data) return res.json({ ok: true, ...comprimido(r.data) });
    } else if (error) {
      return erroDoBanco(res, error);
    }
    if (data) return res.json({ ok: true, ...comprimido(data) });

    // Nao conseguiu: alguem esta' com ela. Quem, e desde quando.
    const { data: atual, error: erroAtual } = await req.supabase
      .from("obra_dados")
      .select("editando_por, editando_desde")
      .eq("obra_codigo", codigo)
      .maybeSingle();
    if (erroAtual) return erroDoBanco(res, erroAtual);
    res.json({ ok: false, por: atual?.editando_por || null, desde: atual?.editando_desde || null });
  });

/** Devolve a obra pros outros — some a trava, o conteudo fica. */
rotas.delete("/api/obras/:codigo/edicao",
  zValidator("param", paramCodigo),
  exigirEdicaoDeObra(codigoDoPedido),
  async (req, res) => {
    /* So' a propria trava: o `eq` no e-mail de quem chamou impede que
       devolver a obra de um solte a trava que ja' e' de outro. */
    const { error } = await req.supabase
      .from("obra_dados")
      .update({ editando_por: null, editando_desde: null })
      .eq("obra_codigo", codigoDoPedido(req))
      .eq("editando_por", req.usuario.email);
    if (error) return erroDoBanco(res, error);
    res.json({});
  });

/**
 * Quem esta' editando cada obra — pro cadeado da barra lateral.
 *
 * E' sobre VARIAS obras, e nao sobre uma: quem filtra e' o RLS
 * (`obra_dados: ler`), como ja' era quando o navegador perguntava direto.
 * Trava vencida nao entra: e' a mesma regua da leitura da obra, e foi a
 * divergencia entre as duas que deixou o cadeado aceso horas depois.
 */
rotas.get("/api/obras-travas", async (req, res) => {
  const { data, error } = await req.supabase
    .from("obra_dados")
    .select("obra_codigo, editando_por, editando_desde")
    .not("editando_por", "is", null)
    .gte("editando_desde", limiteDaTrava());
  if (error) return erroDoBanco(res, error);
  res.json(data || []);
});

/**
 * O essencial de VARIAS obras de uma vez, para o painel geral.
 *
 * Um LOTE por pedido: a tela fatia e vai se preenchendo, e um lote que falha
 * nao derruba os outros. Tambem e' sobre varias obras — quem filtra e' o RLS.
 */
rotas.post("/api/obras-resumos",
  zValidator("json", corpoDosResumos),
  async (req, res) => {
    const { data, error } = await req.supabase
      .from("obra_dados")
      /* `cliente_assinou_em` entra pra contagem de pendencias do Inicio: sem
         ele, obra com assinatura geral do cliente apareceria com TODOS os
         itens "esperando o cliente" — o oposto da verdade. */
      .select(COLUNAS_DO_RESUMO)
      .in("obra_codigo", req.valido.json.codigos);
    if (error) return erroDoBanco(res, error);
    res.json(comprimido(data || []));
  });

/* ---------- o historico ---------- */

/**
 * As versoes guardadas desta obra, da mais nova pra mais velha.
 *
 * NAO traz o `conteudo`: ele e' o JSONB gordo — centenas de KB por versao —
 * e a lista so' precisa da data, de quem gravou e de quantos itens tinha. O
 * conteudo so' e' lido na hora de restaurar, dentro da funcao do banco.
 *
 * Devolve `{ semTabela: true, versoes: [] }` enquanto o SQL nao rodou, pra
 * tela poder dizer isso em vez de mostrar erro.
 */
rotas.get("/api/obras/:codigo/versoes",
  zValidator("param", paramCodigo),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase
      .from("obra_versao")
      .select("id, n_itens, queda, atualizado_por, criado_em")
      .eq("obra_codigo", codigoDoPedido(req))
      .order("criado_em", { ascending: false });
    if (error) {
      if (semTabela(error)) return res.json({ semTabela: true, versoes: [] });
      return erroDoBanco(res, error);
    }
    res.json({ versoes: data || [] });
  });

module.exports = { rotasDeObraConteudo: rotas, COLUNAS_DA_OBRA, MINUTOS_ATE_TRAVA_EXPIRAR };
