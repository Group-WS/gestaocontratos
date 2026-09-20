/**
 * Portaria do backend — quem entra e o que pode ver.
 * -----------------------------------------------------------
 * Antes disto as rotas eram abertas: qualquer um que soubesse a URL
 * criava solicitacao de compra no Sienge de producao. O token do Monday
 * e a credencial do Sienge nao ficam no navegador, mas de nada adianta
 * guardar a chave se a porta esta destrancada.
 *
 * Duas camadas:
 *  1. exigirLogin  — o pedido traz um token do Supabase que o SERVIDOR
 *     verifica (getUser consulta o Auth; nao basta ler o token).
 *  2. podeAcessarObra — o usuario logado so' mexe nas obras do perfil
 *     dele. Mesma regra da funcao `minhas_obras()` do banco, escrita
 *     aqui porque a API precisa decidir antes de falar com o Sienge, que
 *     nao conhece RLS.
 *
 * Regra: .quality/regras/03-seguranca-e-acesso.md (SEG-01, SEG-02, SEG-14).
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
    console.error("[auth] SUPABASE_URL/SUPABASE_ANON_KEY ausentes: recusando todas as rotas.");
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
    // O detalhe vai pro log; o usuario recebe a mensagem padrao (SEG-33).
    console.error("[auth] falha ao verificar o token:", e);
    res.status(401).json({ erro: "Não autenticado." });
  }
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

  const { data: pessoa, error: erroPessoa } = await req.supabase
    .from("pessoa")
    .select("perfil, ativo")
    .eq("email", req.usuario.email)
    .maybeSingle();

  if (erroPessoa) {
    console.error("[auth] não consegui ler o perfil de", req.usuario.email, erroPessoa);
    return false;
  }
  if (!pessoa || pessoa.ativo === false) return false;

  const perfil = pessoa.perfil || null;
  if (["master", "admin", "geral", "mehoo"].includes(perfil)) return true;
  if (perfil !== "gc") return false;

  const { data: obra, error: erroObra } = await req.supabase
    .from("obra")
    .select("codigo, gc")
    .eq("codigo", alvo)
    .maybeSingle();

  if (erroObra) {
    console.error("[auth] não consegui ler a obra", alvo, erroObra);
    return false;
  }
  if (!obra) return false;

  // Obra sem dono e' de quem pegar: e' assim que o GC assume a dele.
  return !obra.gc || String(obra.gc).toLowerCase() === req.usuario.email;
}

/** Barreira pronta pras rotas que recebem o codigo da obra na URL. */
function exigirObra(deOndeVem) {
  return async (req, res, next) => {
    const codigo = deOndeVem(req);
    if (await podeAcessarObra(req, codigo)) return next();
    // "Nao encontrada", nao "proibida": nao confirmamos que a obra existe (SEG-14).
    res.status(404).json({ erro: "Obra não encontrada." });
  };
}

module.exports = { exigirLogin, exigirObra, podeAcessarObra };
