// armazenamento.js — ÚNICO acesso ao armazenamento do navegador.
//
// Regra: .quality/regras/04-dados-no-navegador.md. O navegador guarda só
// SESSÃO (a do Supabase, gerida pelo supabase-js) e CACHE (cópia
// descartável do que mora no banco). Toda chave de ALLOWED_KEYS também está
// declarada em .quality/manifest.json → navegador.permitidos (o gate
// confere os dois lados).

const ENVELOPE_VERSION = 1;
const DAY = 24 * 60 * 60 * 1000;

export const ALLOWED_KEYS = {
  // As preferências da pessoa (public.preferencia), para a tela abrir sem
  // piscar; a API confirma logo depois (lib/preferencias.js).
  "cache:preferencias": { ttlMs: 30 * DAY },
};

function storage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // modo privado, cookies bloqueados, ambiente sem window
  }
}

export function readCache(key) {
  if (!(key in ALLOWED_KEYS)) return null;
  const raw = storage()?.getItem(key);
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw);
    if (envelope?.version !== ENVELOPE_VERSION || !(envelope.expiresAt > Date.now())) {
      storage()?.removeItem(key);
      return null;
    }
    return envelope.data;
  } catch {
    storage()?.removeItem(key);
    return null;
  }
}

export function writeCache(key, data) {
  if (!(key in ALLOWED_KEYS)) return;
  const envelope = { version: ENVELOPE_VERSION, expiresAt: Date.now() + ALLOWED_KEYS[key].ttlMs, data };
  try {
    storage()?.setItem(key, JSON.stringify(envelope));
  } catch {
    // cota cheia ou storage indisponível: cache é descartável, seguir sem ele
  }
}

/** Chamado no logout (NAV-06). */
export function clearBrowserData() {
  for (const key of Object.keys(ALLOWED_KEYS)) {
    try { storage()?.removeItem(key); } catch { /* segue */ }
  }
}

/* A sessão do Supabase é do supabase-js. Só num caso o app mexe nela: token
   podre que o `signOut` não conseguiu apagar (ele tenta avisar o servidor,
   leva erro e às vezes deixa a chave) — e aí o F5 traria o mesmo token de
   volta, pra sempre. A chave é a declarada no manifesto como sessão. */
export function apagarSessaoDoSupabase() {
  const s = storage();
  if (!s) return;
  try {
    Object.keys(s)
      .filter((k) => /^sb-.*-auth-token/.test(k))
      .forEach((k) => s.removeItem(k));
  } catch { /* navegador sem storage */ }
}

/* As preferências que moravam soltas no localStorage até 21/09/2026. Cada
   uma é lida UMA vez, para subir pro banco, e apagada — quem já tinha
   escolhido não perde a escolha na troca. */
export const CHAVES_ANTIGAS = Object.freeze([
  "tkws.so.minhas", "confere:obras-modo", "tkws.squads.fechados", "equipe-grupos-fechados",
]);

export function lerLegado(chave) {
  if (!CHAVES_ANTIGAS.includes(chave)) return null;
  try { return storage()?.getItem(chave) ?? null; } catch { return null; }
}

export function apagarLegado(chave) {
  if (!CHAVES_ANTIGAS.includes(chave)) return;
  try { storage()?.removeItem(chave); } catch { /* segue */ }
}
