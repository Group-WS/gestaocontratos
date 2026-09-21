/**
 * Portaria do backend — quem entra e o que pode ver.
 * -----------------------------------------------------------
 * Antes disto as rotas eram abertas: qualquer um que soubesse a URL
 * criava solicitacao de compra no Sienge de producao. O token do Monday
 * e a credencial do Sienge nao ficam no navegador, mas de nada adianta
 * guardar a chave se a porta esta destrancada.
 *
 * Tres camadas:
 *  1. exigirLogin  — o pedido traz um token do Supabase que o SERVIDOR
 *     verifica (getUser consulta o Auth; nao basta ler o token).
 *  2. exigirMembro — logado nao basta: a pessoa precisa ter perfil e
 *     estar ativa. A sala de espera nao chama a API.
 *  3. podeAcessarObra / podeEditarObra — o usuario so' ve e so' mexe nas
 *     obras do perfil dele. Mesma regra do banco (`minhas_obras()` e o
 *     `with check` das obras), escrita aqui porque a API precisa decidir
 *     antes de falar com o Sienge, que nao conhece RLS.
 *
 * Regra: .quality/regras/03-seguranca-e-acesso.md (SEG-01, SEG-02, SEG-11, SEG-14).
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const configurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Cliente que age COMO o usuario: o RLS do banco continua valendo. */
function clienteDoUsuario(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function tokenDoPedido(req) {
  const cabecalho = req.headers.authorization || "";
  const [tipo, valor] = cabecalho.split(" ");
  return /^bearer$/i.test(tipo || "") ? (valor || "").trim() : "";
}

/**
 * Middleware: sem usuario valido, nada passa.
 *
 * Sem Supabase configurado o servidor RECUSA tudo, em vez de liberar.
 * Configuracao faltando e' problema de quem publica, nao permissao pra
 * quem chama: abrir "enquanto nao configura" foi exatamente o buraco
 * que este arquivo fecha.
 */
async function exigirLogin(req, res, next) {
  if (!configurado) {
    console.error(JSON.stringify({ level: "error", event: "auth_sem_configuracao" }));
    return res.status(503).json({ erro: "Autenticação indisponível." });
  }

  const token = tokenDoPedido(req);
  if (!token) return res.status(401).json({ erro: "Não autenticado." });

  try {
    const sb = clienteDoUsuario(token);
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return res.status(401).json({ erro: "Não autenticado." });

    req.usuario = { id: data.user.id, email: String(data.user.email || "").toLowerCase() };
    req.supabase = sb;
    next();
  } catch (e) {
    // So' o tipo do erro vai pro log: a mensagem pode carregar o token ou
    // o endereco do projeto. O usuario recebe a mensagem padrao (SEG-33).
    console.error(JSON.stringify({ level: "error", event: "auth_falhou", erro: e?.name || "Error" }));
    res.status(401).json({ erro: "Não autenticado." });
  }
}

/* Os perfis, como o banco os entende (supabase/rls-perfis.sql e
   docs/SPEC-acessos.md). A API repete a regra do banco porque decide
   ANTES de falar com o Monday e o Sienge, que nao conhecem RLS — e o
   banco continua sendo a ultima linha.
     - editam: o `with check` das obras (master, admin, geral, gc)
     - veem todas as obras: `public.minhas_obras()` (master, admin, geral, mehoo)
   A Mehoo ve e nao edita nada; quem nao tem perfil fica na sala de espera. */
const PERFIS_QUE_EDITAM = ["master", "admin", "geral", "gc"];
const PERFIS_QUE_VEEM_TODAS = ["master", "admin", "geral", "mehoo"];

const SEM_ACESSO = "Você não tem acesso a esta área.";

/**
 * A linha de `pessoa` de quem chamou (perfil e ativo), lida uma vez por
 * pedido. Le com o client do proprio usuario: e' a politica "leio a minha
 * linha" que responde.
 *
 * Na duvida, NEGA: falha de leitura do banco vira `null`, nunca permissao.
 */
async function pessoaDoPedido(req) {
  if (req.pessoa !== undefined) return req.pessoa;
  const { data, error } = await req.supabase
    .from("pessoa")
    .select("perfil, ativo")
    .eq("email", req.usuario.email)
    .maybeSingle();
  if (error) {
    console.error(JSON.stringify({ level: "error", event: "perfil_ilegivel", usuario: req.usuario.id, codigo: error.code || null }));
    req.pessoa = null;
    return null;
  }
  req.pessoa = data || null;
  return req.pessoa;
}

const ehMembro = (pessoa) => !!pessoa && !!pessoa.perfil && pessoa.ativo !== false;

/**
 * Middleware: estar logado nao basta, e' preciso ser do time.
 *
 * Qualquer conta do diretorio abre sessao ao clicar em "Continuar com
 * Microsoft" — inclusive quem ainda esta na sala de espera (sem perfil) e
 * quem foi desativado. Sem isto, essas contas chamavam o Monday, os
 * leitores de PDF e o Sienge com a credencial do servidor.
 */
async function exigirMembro(req, res, next) {
  if (ehMembro(await pessoaDoPedido(req))) return next();
  res.status(403).json({ erro: SEM_ACESSO });
}

/** Middleware: so' quem edita (vem depois do exigirMembro, que ja' leu a pessoa). */
async function exigirPerfilDeEdicao(req, res, next) {
  const pessoa = await pessoaDoPedido(req);
  if (ehMembro(pessoa) && PERFIS_QUE_EDITAM.includes(pessoa.perfil)) return next();
  res.status(403).json({ erro: SEM_ACESSO });
}

/**
 * Este usuario enxerga esta obra?
 *
 * Espelha `public.minhas_obras()` (supabase/rls-perfis.sql): master,
 * admin, geral e mehoo veem todas; o GC ve as dele e as sem dono;
 * quem nao tem perfil (sala de espera) nao ve nenhuma.
 *
 * Na duvida, NEGA: falha de leitura do banco nao vira permissao.
 */
async function podeAcessarObra(req, codigo) {
  const alvo = String(codigo || "").trim();
  if (!alvo) return false;

  const pessoa = await pessoaDoPedido(req);
  if (!ehMembro(pessoa)) return false;

  if (PERFIS_QUE_VEEM_TODAS.includes(pessoa.perfil)) return true;
  if (pessoa.perfil !== "gc") return false;

  const { data: obra, error: erroObra } = await req.supabase
    .from("obra")
    .select("codigo, gc")
    .eq("codigo", alvo)
    .maybeSingle();

  if (erroObra) {
    console.error(JSON.stringify({ level: "error", event: "obra_ilegivel", usuario: req.usuario.id, codigo: erroObra.code || null }));
    return false;
  }
  if (!obra) return false;

  // Obra sem dono e' de quem pegar: e' assim que o GC assume a dele.
  return !obra.gc || String(obra.gc).toLowerCase() === req.usuario.email;
}

/**
 * Este usuario pode MUDAR alguma coisa nesta obra — criar solicitacao de
 * compra no Sienge, por exemplo? Ver nao basta: a Mehoo enxerga todas as
 * obras e nao edita nenhuma (docs/SPEC-acessos.md).
 */
async function podeEditarObra(req, codigo) {
  const pessoa = await pessoaDoPedido(req);
  if (!ehMembro(pessoa) || !PERFIS_QUE_EDITAM.includes(pessoa.perfil)) return false;
  return podeAcessarObra(req, codigo);
}

/* "Nao encontrada", nao "proibida": nao confirmamos que a obra existe (SEG-14). */
function barreiraDeObra(pode) {
  return (deOndeVem) => async (req, res, next) => {
    if (await pode(req, deOndeVem(req))) return next();
    res.status(404).json({ erro: "Obra não encontrada." });
  };
}

/** Barreira pronta pras rotas que LEEM dados de uma obra. */
const exigirObra = barreiraDeObra(podeAcessarObra);
/** Barreira pronta pras rotas que ESCREVEM em nome de uma obra. */
const exigirEdicaoDeObra = barreiraDeObra(podeEditarObra);

module.exports = {
  exigirLogin, exigirMembro, exigirPerfilDeEdicao, exigirObra, exigirEdicaoDeObra,
  podeAcessarObra, podeEditarObra, PERFIS_QUE_EDITAM,
};
