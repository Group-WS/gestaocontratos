import React, { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "./lib/supabase";

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

function LoginScreen({ derrubada }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro(null);
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

        <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>E-mail</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@groupws.com"
          style={inputStyle} />

        <label style={{ fontSize: 12, fontWeight: 600, color: "#555", marginTop: 14, display: "block" }}>Senha</label>
        <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••"
          style={inputStyle} />

        {erro && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 12 }}>{erro}</div>}

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
