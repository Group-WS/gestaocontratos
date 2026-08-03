import { createClient } from "@supabase/supabase-js";

// A URL e a PUBLISHABLE KEY são públicas por design (vão embutidas no
// frontend, protegidas pelas regras de acesso/RLS do banco). A SECRET
// key NUNCA entra aqui — ela vive só no backend.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Se ainda não estiver configurado, o app segue funcionando sem login
// (modo local). Assim nada quebra durante a transição.
export const supabaseConfigurado = Boolean(url && anonKey);

export const supabase = supabaseConfigurado ? createClient(url, anonKey) : null;
