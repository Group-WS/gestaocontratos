import React, { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "./lib/supabase";
import { dominioPermitido, DOMINIOS } from "./lib/pessoas";

/**
 * Envolve o app com o login do Supabase. Enquanto o Supabase não
 * estiver configurado (sem .env), libera o app direto — modo local.
 */
/* Erro de token que NÃO se resolve tentando de novo.
 *
 * "JWT issued at future" acontece quando o relógio de quem gerou o token
 * estava adiantado: o servidor recebe um token que diz ter sido emitido
 * daqui a pouco e recusa, pra sempre. Some com o horário certo — o token
 * guardado continua ruim. */
const tokenPodre = (e) => {
  const m = `${e?.message || ""} ${e?.name || ""}`.toLowerCase();
  return /jwt|issued at|token|claim|expired|invalid|session/.test(m)
    || e?.status === 401 || e?.status === 403;
};

/* Apaga a sessão guardada, inclusive o que o cliente não alcança.
 *
 * `signOut` sozinho não basta com token inválido: ele tenta avisar o
 * servidor, leva erro e às vezes deixa a chave no localStorage. Aí o F5
 * traz o mesmo token podre de volta e a pessoa fica presa no mesmo erro
 * pra sempre, sem nem um botão de sair na tela. */
async function limparSessao() {
  try { await supabase.auth.signOut({ scope: "local" }); } catch (e) { /* segue */ }
  try {
    Object.keys(localStorage)
      .filter((k) => /^sb-.*-auth-token/.test(k))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* navegador sem storage */ }
}

export default function AuthGate({ children }) {
  // undefined = carregando ; null = deslogado ; objeto = logado
  const [session, setSession] = useState(supabaseConfigurado ? undefined : "local");
  const [derrubada, setDerrubada] = useState(false);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      if (!data.session) { setSession(null); return; }

      /* Sessão guardada não é sessão válida.
         `getSession` só lê o localStorage; quem pergunta ao servidor é
         `getUser`. Sem esta checagem o app entrava achando que estava
         logado, toda chamada ao banco falhava e não havia como sair. */
      const { error } = await supabase.auth.getUser();
      if (!vivo) return;
      if (error && tokenPodre(error)) {
        await limparSessao();
        if (!vivo) return;
        setDerrubada(true);
        setSession(null);
        return;
      }
      // Erro de rede não derruba ninguém: fica logado e tenta de novo.
      setSession(data.session);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!vivo) return;
      setSession(s);
      if (s) setDerrubada(false);
    });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);

  if (session === undefined) {
    return <Centro>Carregando…</Centro>;
  }
  if (supabaseConfigurado && !session) {
    return <LoginScreen derrubada={derrubada} />;
  }
  return children;
}

function Centro({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F3F1", color: "#555", fontFamily: "Inter, system-ui, sans-serif", fontSize: 14 }}>
      {children}
    </div>
  );
}

/* O Azure recusa NA VOLTA, nao na ida: o navegador sai daqui, falha la',
   e volta com o motivo na URL — as vezes em `?query`, as vezes em
   `#hash`. Sem ler os dois, a tela de login reaparece limpa e parece que
   nada aconteceu, que foi exatamente o que ela viu. */
export function erroDaVolta(href) {
  let bruto = null;
  try {
    const u = new URL(href);
    bruto = u.searchParams.get("error_description") || u.searchParams.get("error")
      || new URLSearchParams(u.hash.replace(/^#/, "")).get("error_description")
      || new URLSearchParams(u.hash.replace(/^#/, "")).get("error");
  } catch { return null; }
  if (!bruto) return null;
  const t = decodeURIComponent(bruto);

  /* Os codigos AADSTS que tem conserto conhecido viram instrucao. O resto
     aparece cru: melhor um texto feio do que esconder o motivo. */
  if (/AADSTS50194|multi-?tenant/i.test(t)) {
    return "O app do Azure é de um único tenant, mas o Supabase está chamando o endereço /common. "
      + "Conserto: no Supabase, em Authentication → Sign In / Providers → Azure, preencha o campo "
      + "\"Azure Tenant URL\" com https://login.microsoftonline.com/SEU-TENANT-ID (o Directory (tenant) ID "
      + "está no Azure, na visão geral do app).";
  }
  /* Os dois GUIDs ficam um embaixo do outro na mesma tela do Azure, e o
     de cima e' o errado. Trocar um pelo outro e' o tropeco padrao. */
  if (/AADSTS90002|Tenant .* not found/i.test(t)) {
    return "O Tenant URL no Supabase está com o GUID errado — provavelmente o Application (client) ID "
      + "no lugar do Directory (tenant) ID. São dois GUIDs diferentes, um embaixo do outro no Azure, "
      + "em App registrations → o app → Overview. O Tenant URL leva o SEGUNDO "
      + "(Directory (tenant) ID); o primeiro fica no campo Azure Client ID.";
  }
  if (/AADSTS50011|redirect_uri/i.test(t)) {
    return "O endereço de retorno não bate. No Azure, em Authentication → Redirect URIs, tem que estar "
      + "exatamente a URL de callback do Supabase (…supabase.co/auth/v1/callback).";
  }
  if (/AADSTS7000215|invalid_client|client_secret/i.test(t)) {
    return "O segredo do Azure não foi aceito. Gere um novo Client Secret e cole o VALUE (não o Secret ID) "
      + "no Supabase. Segredo do Azure expira.";
  }
  if (/access_denied|consent/i.test(t)) {
    return "O acesso foi negado no login da Microsoft — ou você cancelou, ou o app precisa de consentimento "
      + "do administrador do diretório.";
  }
  return t;
}

function LoginScreen({ derrubada }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(() => erroDaVolta(window.location.href));
  const [carregando, setCarregando] = useState(false);

  /* Limpa a URL depois de ler: senao o erro gruda e reaparece a cada
     tentativa, inclusive nas que derem certo. */
  useEffect(() => {
    if (!erro) return;
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);   // so' na entrada: e' a URL de chegada que interessa

  /* Entrar com a conta da empresa.

     O ID e o segredo do Azure NAO passam por aqui: eles vivem no painel
     do Supabase, e o navegador so' e' mandado pro fluxo. Chave de OAuth
     em codigo de frontend e' chave publicada — o bundle e' baixavel por
     qualquer um que abra o site.

     `redirectTo` volta pra origem atual, e nao pra uma URL fixa: assim o
     mesmo codigo funciona em producao e no `localhost` de quem
     desenvolve, sem alguem lembrar de trocar. */
  async function entrarComMicrosoft() {
    setErro(null);
    setCarregando(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { scopes: "email openid profile", redirectTo: window.location.origin },
    });
    if (error) {
      setCarregando(false);
      setErro(/provider is not enabled/i.test(error.message)
        ? "O login da Microsoft ainda não foi ligado no Supabase."
        : `Não consegui abrir o login da Microsoft: ${error.message}`);
    }
    // Deu certo: o navegador sai desta pagina, entao nao ha o que limpar.
  }

  async function entrar(e) {
    e.preventDefault();
    setErro(null);
    /* `required` saiu dos campos porque o botao da Microsoft mora dentro
       do mesmo <form>: com ele, clicar na Microsoft disparava a validacao
       do HTML e o navegador reclamava de campos vazios antes de qualquer
       coisa acontecer. A checagem vive aqui agora. */
    if (!email.trim() || !senha) { setErro("Preencha e-mail e senha, ou entre com a conta Microsoft."); return; }
    /* Corta o dominio ANTES de tentar entrar. A sala de espera ja
       protegeria os dados, mas sem este corte qualquer pessoa com o link
       viraria uma linha na fila — e a tela de quem esta esperando entrar
       viraria caixa de entrada de desconhecido. */
    if (!dominioPermitido(email)) {
      setErro(`Este sistema é do time da Group WS. Entre com um e-mail @${DOMINIOS[0]}.`);
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) setErro("E-mail ou senha incorretos.");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F3F1", fontFamily: "Inter, system-ui, sans-serif", padding: 20 }}>
      <form onSubmit={entrar} style={{ width: "100%", maxWidth: 360, background: "#fff", border: "1px solid #e5e2dd", borderRadius: 16, padding: "32px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <img src="/logo.png" alt="Group WS" style={{ width: 54, height: 46, objectFit: "cover", objectPosition: "top center" }} onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
        </div>
        <div style={{ textAlign: "center", fontWeight: 700, letterSpacing: "0.05em", fontSize: 14, color: "#1a1a1a", marginBottom: 4 }}>GESTÃO DE OBRAS TKWS</div>
        <div style={{ textAlign: "center", fontSize: 12.5, color: "#888", marginBottom: 22 }}>Entre com seu acesso do time</div>

        {/* Dizer o que houve evita a pessoa achar que perdeu o acesso. */}
        {derrubada && (
          <div style={{ background: "#FAEFDC", border: "1px solid #E8CE9A", color: "#7A4C0A", borderRadius: 10, padding: "10px 12px", fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
            Sua sessão anterior estava inválida e foi limpa — costuma ser relógio do
            computador fora de hora quando ela foi criada. Entre de novo que resolve.
          </div>
        )}

        {erro && (
          <div style={{ color: "#b91c1c", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
            {erro}
          </div>
        )}
        {/* A conta da empresa PRIMEIRO, e a senha depois da linha: e' o
            caminho que praticamente todo mundo vai usar, e deixa-lo
            embaixo dos campos fazia a pessoa preencher e-mail e senha
            antes de descobrir que nao precisava. */}
        <button type="button" onClick={entrarComMicrosoft} disabled={carregando}
          style={{ width: "100%", background: "#fff", color: "#1a1a1a", border: "1px solid #e5e2dd", borderRadius: 10, padding: "11px 0", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, opacity: carregando ? 0.6 : 1 }}>
          <LogoMicrosoft /> Entrar com a conta Microsoft
        </button>

        {/* A senha continua existindo como plano B: se o Azure cair ou a
            conta de alguem ainda nao estiver no diretorio, ninguem fica
            de fora do proprio sistema. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
          <div style={{ flex: 1, height: 1, background: "#e5e2dd" }} />
          <span style={{ fontSize: 11, color: "#aaa" }}>ou com e-mail e senha</span>
          <div style={{ flex: 1, height: 1, background: "#e5e2dd" }} />
        </div>

        <div id="campos-senha">
          <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@groupws.com"
            style={inputStyle} />

          <label style={{ fontSize: 12, fontWeight: 600, color: "#555", marginTop: 14, display: "block" }}>Senha</label>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••"
            style={inputStyle} />
        </div>


        <button type="submit" disabled={carregando}
          style={{ width: "100%", marginTop: 20, background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: carregando ? 0.6 : 1 }}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  marginTop: 5,
  border: "1px solid #e5e2dd",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13.5,
  fontFamily: "Inter, system-ui, sans-serif",
  boxSizing: "border-box",
  outline: "none",
};

/* O quadriculado da Microsoft, desenhado aqui: quatro retangulos nao
   valem uma dependencia nova, e um <img> de CDN nao carregaria — a
   pagina de login e' a primeira coisa que abre, e ela nao pode depender
   de terceiro pra ficar de pe. */
function LogoMicrosoft() {
  return (
    <svg width="15" height="15" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
