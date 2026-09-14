import React, { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "./lib/supabase";
import { LogoGroupWS } from "./marca.jsx";

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text-mute)", fontFamily: "var(--font-sans)", fontSize: 14 }}>
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

  /* Split-screen do padrão Auth do design system: marca à esquerda,
     formulário à direita. No celular a marca some e o logo sobe pro topo
     do formulário. */
  return (
    <div className="auth">
      <EstiloAuth />
      <aside className="auth-marca">
        <LogoGroupWS style={{ fontSize: 15 }} />
        <div>
          <h2 className="auth-manchete">Gestão de Obras <em>TKWS</em></h2>
          <p className="auth-lema">Onde estratégia, execução e excelência se encontram.</p>
        </div>
      </aside>
      <main className="auth-lado">
        <div className="auth-form">
          <div className="auth-logo-celular"><LogoGroupWS style={{ fontSize: 14 }} /></div>
          <div>
            <h1 className="auth-titulo">Entrar</h1>
            <p className="auth-sub">Entre com seu acesso do time.</p>
          </div>

          {/* Dizer o que houve evita a pessoa achar que perdeu o acesso. */}
          {derrubada && (
            <div className="auth-aviso">
              Sua sessão anterior estava inválida e foi limpa — costuma ser relógio do
              computador fora de hora quando ela foi criada. Entre de novo que resolve.
            </div>
          )}
          {erro && <div className="auth-erro" role="alert">{erro}</div>}

          <button type="button" className="auth-botao" onClick={entrarComMicrosoft} disabled={carregando}>
            <LogoMicrosoft /> {carregando ? "Entrando…" : "Entrar com a conta Microsoft"}
          </button>
        </div>
      </main>
    </div>
  );
}

/* O estilo do login mora aqui porque esta tela aparece ANTES do App
   existir: a folha do App.jsx só entra depois de entrar. Os tokens vêm de
   estilos/design-system.css, que é global. */
function EstiloAuth() {
  return <style>{`
    .auth { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) 460px; background: var(--surface-1); color: var(--text); font-family: var(--font-sans); }
    .auth-marca { display: flex; flex-direction: column; justify-content: space-between; gap: 32px; padding: 48px; color: var(--text); background: linear-gradient(135deg, var(--surface-3) 0%, var(--surface-4) 60%, var(--brand-soft) 100%); }
    .auth-manchete { margin: 0; font-size: 40px; font-weight: 300; line-height: 1.05; letter-spacing: -0.02em; }
    .auth-manchete em { font-style: italic; color: var(--brand); }
    .auth-lema { margin: 12px 0 0; max-width: 420px; font-size: 14px; line-height: 1.55; color: var(--text-soft); }
    .auth-lado { display: flex; align-items: center; justify-content: center; padding: 40px; background: var(--surface-1); }
    .auth-form { display: grid; gap: 20px; width: 100%; max-width: 360px; }
    .auth-logo-celular { display: none; color: var(--text); }
    .auth-titulo { margin: 0; font-size: 28px; font-weight: 300; line-height: 1.1; letter-spacing: -0.02em; }
    .auth-sub { margin: 4px 0 0; font-size: 13.5px; color: var(--text-soft); }
    .auth-aviso, .auth-erro { border-radius: 10px; padding: 12px 14px; font-size: 12.5px; line-height: 1.55; color: var(--text); }
    .auth-aviso { background: var(--warning-soft); border: 1px solid var(--warning-line); }
    .auth-erro { background: var(--danger-soft); border: 1px solid var(--danger-line); }
    .auth-botao { display: inline-flex; align-items: center; justify-content: center; gap: 9px; width: 100%; min-height: 44px; padding: 0 20px; border-radius: 10px; border: 1px solid var(--line-2); background: transparent; color: var(--text); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease; }
    .auth-botao:hover:not(:disabled) { background: var(--surface-2); border-color: var(--line-3); }
    .auth-botao:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (max-width: 900px) {
      .auth { grid-template-columns: 1fr; }
      .auth-marca { display: none; }
      .auth-lado { padding: 24px; }
      .auth-logo-celular { display: block; }
    }
  `}</style>;
}

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
