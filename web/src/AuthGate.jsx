import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Card, CardContent, Spinner } from "@group-ws/ws-ui";
import { Lock } from "lucide-react";
import { supabase, supabaseConfigurado, configuracaoAusente } from "./lib/supabase";
import { apagarSessaoDoSupabase, clearBrowserData } from "./lib/armazenamento";
import { LogoGroupWS } from "./marca.jsx";
import capa from "./assets/login-capa.jpg";
import capaPequena from "./assets/login-capa-1000.jpg";
import logoMicrosoft from "./assets/logo-microsoft.svg";

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
  // A chave da sessão sai pelo wrapper, o único que toca o storage (NAV-03).
  apagarSessaoDoSupabase();
  clearBrowserData();
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
         `getSession` só lê o que ficou guardado no navegador; quem pergunta ao servidor é
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
    return <Centro><Spinner label="Carregando…" /></Centro>;
  }
  if (supabaseConfigurado && !session) {
    return <LoginScreen derrubada={derrubada} />;
  }
  return children;
}

function Centro({ children }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-6 text-sm text-text-mute">
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
  // O URLSearchParams ja' decodifica. Decodificar de novo derrubava a tela
  // de login inteira quando o texto trazia um "%" (URIError).
  const t = bruto;

  /* Os codigos AADSTS que tem conserto conhecido viram instrucao. */
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
  /* O resto NAO aparece cru. O texto vem da URL, e qualquer um monta um link
     com a frase que quiser ("sua senha expirou, ligue para...") para ela
     aparecer dentro da nossa tela de login. O motivo nao some: fica o
     codigo do Azure, que e' o que o suporte procura (SEG-33). */
  const codigo = (t.match(/\bAADSTS\d{4,}\b/) || [])[0];
  return "Não conseguimos concluir a entrada pela Microsoft. Tente de novo; se continuar, avise quem cuida do sistema"
    + (codigo ? ` (código ${codigo}).` : ".");
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
        : "Não conseguimos abrir o login da Microsoft. Tente de novo em instantes.");
    }
    // Deu certo: o navegador sai desta pagina, entao nao ha o que limpar.
  }

  /* Tela dividida: a foto de uma obra entregue à esquerda (3/5) e o
     acesso à direita (2/5). No celular a foto vira uma faixa no topo e o
     acesso desce. A capa roda no tema escuro do design system
     (`data-theme="dark"`) para o texto claro vir dos tokens, seja qual for
     o tema do app. Só o desenho é daqui — quem entra continua sendo o
     entrarComMicrosoft acima, sem mudança. */
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-bg text-text md:grid-cols-5">
      <aside data-theme="dark" className="relative h-64 overflow-hidden bg-bg text-text-strong sm:h-80 md:col-span-3 md:h-auto md:min-h-dvh">
        <img className="absolute inset-0 h-full w-full object-cover" src={capa} srcSet={`${capaPequena} 1000w, ${capa} 2000w`}
          sizes="(max-width: 768px) 100vw, 60vw" alt="" aria-hidden="true" decoding="async" />
        <div className="absolute inset-0 bg-bg/60" aria-hidden="true" />
        <div className="relative z-10 flex h-full flex-col justify-between gap-6 p-6 md:p-12">
          <LogoGroupWS className="self-start text-sm md:text-base" />
          <div className="space-y-2 md:space-y-4">
            <p className="text-2xl font-normal leading-tight tracking-tight md:text-5xl">Gestão de Obras TKWS</p>
            <p className="max-w-md text-sm text-text-soft md:text-lg">Toda a jornada da obra, do planejamento à entrega.</p>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center p-6 md:col-span-2 md:p-12">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-medium leading-tight tracking-tight">Bem-vinda</h2>
              <p className="text-sm text-text-soft">Acesse a plataforma com sua conta corporativa.</p>
            </div>

            {/* Dizer o que houve evita a pessoa achar que perdeu o acesso. */}
            {derrubada && (
              <Alert tone="warning">
                <AlertDescription>
                  Sua sessão anterior estava inválida e foi limpa — costuma ser relógio do
                  computador fora de hora quando ela foi criada. Entre de novo que resolve.
                </AlertDescription>
              </Alert>
            )}
            {erro && (
              <Alert tone="danger" role="alert">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            <Button type="button" size="lg" className="w-full" onClick={entrarComMicrosoft}
              disabled={carregando} aria-busy={carregando}>
              {carregando ? <Spinner size="sm" tone="neutral" /> : <LogoMicrosoft />}
              {carregando ? "Conectando…" : "Continuar com Microsoft"}
            </Button>

            <div className="space-y-2 border-t border-line-1 pt-4 text-sm text-text-soft">
              <p className="flex items-center gap-2"><Lock size={12} strokeWidth={2.2} aria-hidden="true" /> Acesso exclusivo ao time Group WS</p>
              <a className="inline-block rounded-sm text-text-soft no-underline focus-visible:outline-2 focus-visible:outline-brand" href={SUPORTE} target="_blank" rel="noopener noreferrer">
                Precisa de ajuda? <span className="font-medium text-brand underline underline-offset-4">Fale com o suporte.</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

/* O quadriculado da Microsoft, num arquivo do proprio projeto
   (assets/logo-microsoft.svg): quatro retangulos nao valem uma dependencia
   nova, e um <img> de CDN nao carregaria — a pagina de login e' a primeira
   coisa que abre, e ela nao pode depender de terceiro pra ficar de pe. As
   cores sao a paleta oficial do logotipo de terceiro, e por isso moram na
   arte, e nao em token do design system. */
function LogoMicrosoft() {
  return <img src={logoMicrosoft} width="16" height="16" alt="" aria-hidden="true" />;
}
