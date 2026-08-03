import React, { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "./lib/supabase";

/**
 * Envolve o app com o login do Supabase. Enquanto o Supabase não
 * estiver configurado (sem .env), libera o app direto — modo local.
 */
export default function AuthGate({ children }) {
  // undefined = carregando ; null = deslogado ; objeto = logado
  const [session, setSession] = useState(supabaseConfigurado ? undefined : "local");

  useEffect(() => {
    if (!supabaseConfigurado) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <Centro>Carregando…</Centro>;
  }
  if (supabaseConfigurado && !session) {
    return <LoginScreen />;
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

function LoginScreen() {
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
