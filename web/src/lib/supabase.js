import { createClient } from "@supabase/supabase-js";

// A URL e a PUBLISHABLE KEY são públicas por design (vão embutidas no
// frontend, protegidas pelas regras de acesso/RLS do banco). A SECRET
// key NUNCA entra aqui — ela vive só no backend.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sem URL e chave, o app NÃO abre — e isso é de propósito.
//
// Antes havia um "modo local": faltando o .env, o app liberava tudo sem
// login. Serviu na transição, mas é uma porta destrancada por descuido de
// configuração: um build publicado sem as variáveis entregava o sistema
// inteiro aberto. Em desenvolvimento o atalho continua valendo, porque lá
// não há dado de ninguém.
// Regra: .quality/regras/03-seguranca-e-acesso.md (SEG-10, negar por padrão).
export const supabaseConfigurado = Boolean(url && anonKey);

export const modoLocalPermitido = import.meta.env.DEV;

/** Publicado sem configuração: não há como autenticar ninguém. */
export const configuracaoAusente = !supabaseConfigurado && !modoLocalPermitido;

export const supabase = supabaseConfigurado ? createClient(url, anonKey) : null;
