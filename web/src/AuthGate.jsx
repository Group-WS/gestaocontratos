import React, { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase, supabaseConfigurado, configuracaoAusente } from "./lib/supabase";
import { LogoGroupWS } from "./marca.jsx";
import capa from "./assets/login-capa.jpg";
import capaPequena from "./assets/login-capa-1000.jpg";

/* "Precisa de ajuda?" cai no WhatsApp de quem administra o sistema. */
const SUPORTE = "https://wa.me/5548999348866?text="
  + encodeURIComponent("Olá! Preciso de ajuda para acessar o Gestão de Obras TKWS.");

/* Só no `npm run dev`: `?previaLogin` mostra a tela de entrada mesmo com a
   conta aberta, pra conferir o desenho sem sair dela (`?previaLogin=aviso`
   mostra junto o aviso de sessão derrubada). Lido quando o módulo carrega;
   no build vira null e some. */
const PREVIA_LOGIN = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("previaLogin")
  : null;

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
  const [session, setSession] = useState(
    supabaseConfigurado ? undefined : (configuracaoAusente ? null : "local")
  );
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

  /* Publicado sem as variáveis do Supabase: ninguém entra, e a tela diz
     por quê. Liberar aqui seria abrir o sistema por erro de configuração. */
  if (configuracaoAusente) {
    return (
      <Centro>
        Este ambiente está sem configuração de acesso. Avise quem cuida do sistema — ninguém
        consegue entrar até que ela seja definida.
      </Centro>
    );
  }

  if (PREVIA_LOGIN !== null) return <LoginScreen derrubada={PREVIA_LOGIN === "aviso"} />;
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

  /* Tela dividida: a foto de uma obra entregue à esquerda (62%) e o
     acesso à direita (38%). No celular a foto vira uma faixa no topo e o
     acesso desce. Só o desenho é daqui — quem entra continua sendo o
     entrarComMicrosoft acima, sem mudança. */
  return (
    <div className="auth">
      <EstiloAuth />
      <AreaSegura />
      <aside className="auth-capa">
        <img className="auth-capa-foto" src={capa} srcSet={`${capaPequena} 1000w, ${capa} 2000w`}
          sizes="(max-width: 900px) 100vw, 62vw" alt="" aria-hidden="true" decoding="async" />
        <div className="auth-capa-conteudo">
          <LogoGroupWS className="auth-capa-logo" />
          <div>
            <h1 className="auth-manchete">Gestão de Obras TKWS</h1>
            <p className="auth-lema">Toda a jornada da obra, do planejamento à entrega.</p>
          </div>
        </div>
      </aside>
      <main className="auth-acesso">
        <div className="auth-bloco">
          <h2 className="auth-titulo">Bem-vinda</h2>
          <p className="auth-sub">Acesse a plataforma com sua conta corporativa.</p>

          {/* Dizer o que houve evita a pessoa achar que perdeu o acesso. */}
          {derrubada && (
            <div className="auth-aviso">
              Sua sessão anterior estava inválida e foi limpa — costuma ser relógio do
              computador fora de hora quando ela foi criada. Entre de novo que resolve.
            </div>
          )}
          {erro && <div className="auth-erro" role="alert">{erro}</div>}

          <button type="button" className="auth-botao" onClick={entrarComMicrosoft}
            disabled={carregando} aria-busy={carregando}>
            <span className="auth-botao-icone">
              {carregando ? <span className="auth-giro" aria-hidden="true" /> : <LogoMicrosoft />}
            </span>
            {carregando ? "Conectando…" : "Continuar com Microsoft"}
          </button>

          <div className="auth-rodape">
            <p className="auth-exclusivo"><Lock size={12} strokeWidth={2.2} aria-hidden="true" /> Acesso exclusivo ao time Group WS</p>
            <a className="auth-ajuda" href={SUPORTE} target="_blank" rel="noopener noreferrer">
              Precisa de ajuda? <span>Fale com o suporte.</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

/* No iPhone, `viewport-fit=cover` deixa a foto ir até a borda de cima e faz
   o `env(safe-area-inset-*)` valer: o estilo usa isso pra manter o logo
   longe do relógio e os avisos longe da barra de gesto. Só enquanto a tela
   de entrada está aberta — o resto do app não trata essas áreas. */
function AreaSegura() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta || /viewport-fit/.test(meta.content)) return;
    const antes = meta.content;
    meta.content = `${antes}, viewport-fit=cover`;
    return () => { meta.content = antes; };
  }, []);
  return null;
}

/* O estilo do login mora aqui porque esta tela aparece ANTES do App
   existir: a folha do App.jsx só entra depois de entrar. A fonte vem de
   estilos/design-system.css; as cores ficam fixas aqui, e não nos tokens,
   porque a entrada tem o mesmo desenho nos dois temas (o azul-marinho é o
   fundo do tema escuro do design system).

   A camada sobre a foto é chapada, sem degradê, e forte o bastante pro
   texto branco ter contraste de 4,5:1 até nos pontos mais claros da foto,
   que é de sol. */
function EstiloAuth() {
  return <style>{`
    .auth {
      --a-marinho: #0a2f4d; --a-marinho-hover: #0e3a5e; --a-marinho-fundo: #061828;
      --a-tinta: #111111; --a-tinta-2: #5c5c5c; --a-tinta-3: #6b6b6b;
      --a-linha: rgba(24, 24, 27, 0.1); --a-foco: #0e8194;
      height: 100vh; height: 100dvh; overflow: hidden;
      display: grid; grid-template-columns: minmax(0, 62fr) minmax(0, 38fr);
      background: #ffffff; color: var(--a-tinta); font-family: var(--font-sans);
      -webkit-font-smoothing: antialiased;
    }
    .auth-capa { position: relative; overflow: hidden; min-width: 0; background: var(--a-marinho-fundo); color: #ffffff; }
    .auth-capa-foto { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 55% 50%; }
    .auth-capa::after { content: ""; position: absolute; inset: 0; background: rgba(6, 24, 40, 0.55); }
    .auth-capa-conteudo { position: relative; z-index: 1; box-sizing: border-box; height: 100%; display: flex; flex-direction: column; justify-content: space-between; gap: 32px; padding: 44px 48px 52px; }
    .auth-capa-logo { font-size: 15px; align-self: flex-start; }
    .auth-manchete { margin: 0; font-size: clamp(34px, 3.2vw, 50px); font-weight: 400; line-height: 1.05; letter-spacing: -0.025em; text-wrap: balance; }
    .auth-lema { margin: 14px 0 0; max-width: 460px; font-size: 17px; line-height: 1.5; color: rgba(255, 255, 255, 0.86); text-wrap: balance; }
    .auth-acesso { display: flex; align-items: center; justify-content: center; min-width: 0; padding: 48px clamp(28px, 4.4vw, 64px); overflow-y: auto; }
    .auth-bloco { display: flex; flex-direction: column; width: 100%; max-width: 420px; }
    .auth-titulo { margin: 0; font-size: 32px; font-weight: 500; line-height: 1.1; letter-spacing: -0.02em; }
    .auth-sub { margin: 10px 0 0; font-size: 15px; line-height: 1.5; color: var(--a-tinta-2); text-wrap: pretty; }
    .auth-aviso, .auth-erro { margin-top: 24px; border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.55; }
    .auth-aviso { background: #fff8eb; border: 1px solid #efd8a6; color: #5a4210; }
    .auth-erro { background: #fdf1f1; border: 1px solid #efc4c4; color: #7a1f1f; }
    .auth-botao { display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; height: 52px; margin-top: 32px; padding: 0 20px; border: 0; border-radius: 6px; background: var(--a-marinho); color: #ffffff; font-family: inherit; font-size: 15px; font-weight: 600; letter-spacing: 0.005em; cursor: pointer; transition: background-color 0.15s ease; }
    .auth-botao:hover:not(:disabled) { background: var(--a-marinho-hover); }
    .auth-botao:active:not(:disabled) { background: var(--a-marinho-fundo); }
    .auth-botao:focus-visible { outline: 2px solid var(--a-foco); outline-offset: 3px; }
    .auth-botao:disabled { cursor: progress; }
    .auth-botao-icone { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; }
    .auth-botao-icone svg { width: 18px; height: 18px; }
    .auth-giro { box-sizing: border-box; width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: #ffffff; animation: auth-giro 0.8s linear infinite; }
    @keyframes auth-giro { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .auth-giro { animation-duration: 2.4s; } }
    .auth-rodape { display: flex; flex-direction: column; gap: 6px; margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--a-linha); font-size: 13px; line-height: 1.5; color: var(--a-tinta-3); }
    .auth-rodape p { margin: 0; }
    .auth-exclusivo { display: flex; align-items: center; gap: 6px; }
    .auth-exclusivo svg { flex-shrink: 0; }
    .auth-ajuda { align-self: flex-start; color: inherit; text-decoration: none; border-radius: 4px; }
    .auth-ajuda span { color: var(--a-marinho); font-weight: 500; text-decoration: underline; text-decoration-color: rgba(10, 47, 77, 0.3); text-underline-offset: 3px; }
    .auth-ajuda:hover span { text-decoration-color: currentColor; }
    .auth-ajuda:focus-visible { outline: 2px solid var(--a-foco); outline-offset: 3px; }
    @media (max-width: 900px) {
      .auth { grid-template-columns: 1fr; grid-template-rows: auto 1fr; height: auto; min-height: 100vh; min-height: 100dvh; overflow: visible; }
      .auth-capa { height: clamp(230px, 40vh, 360px); height: clamp(230px, 40dvh, 360px); }
      .auth-capa-conteudo { gap: 16px; padding: max(22px, calc(env(safe-area-inset-top) + 12px)) max(24px, env(safe-area-inset-right)) 26px max(24px, env(safe-area-inset-left)); }
      .auth-capa-logo { font-size: 13px; }
      .auth-manchete { font-size: 28px; }
      .auth-lema { margin-top: 8px; font-size: 15px; }
      /* A área branca é uma coluna: o bloco de acesso fica no meio do espaço
         acima dos avisos, e o vazio se divide por igual entre o topo e o
         caminho do botão até os avisos. */
      .auth-acesso { flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 28px max(24px, env(safe-area-inset-right)) max(28px, calc(env(safe-area-inset-bottom) + 16px)) max(24px, env(safe-area-inset-left)); overflow: visible; }
      .auth-bloco { flex: 1 0 auto; max-width: none; }
      .auth-titulo { margin-top: auto; font-size: 26px; }
      .auth-botao { margin: 28px 0 auto; }
      .auth-rodape { margin-top: 28px; }
    }
    /* celular baixo (SE, ou com a barra do navegador aberta) */
    @media (max-width: 900px) and (max-height: 700px) {
      .auth-capa { height: clamp(200px, 34vh, 300px); height: clamp(200px, 34dvh, 300px); }
      .auth-manchete { font-size: 25px; }
      .auth-lema { font-size: 14px; }
      .auth-acesso { padding-top: 22px; }
      .auth-botao { margin-top: 22px; }
      .auth-rodape { margin-top: 20px; padding-top: 16px; }
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
