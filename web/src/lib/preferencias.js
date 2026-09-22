import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";
import { readCache, writeCache, lerLegado, apagarLegado } from "./armazenamento";

/**
 * O que a tela lembra de cada pessoa — "só as minhas obras", a lista por
 * número ou por squad, os grupos dobrados.
 *
 * Mora no BANCO (public.preferencia, pela API /api/preferencias) e segue a
 * pessoa entre computadores. O navegador guarda só uma cópia
 * (cache:preferencias, via lib/armazenamento.js), para a tela abrir já no
 * jeito de sempre, sem piscar; a API confirma logo depois (NAV-02, NAV-05).
 *
 * As chaves que existem estão em web/api/_lib/rotas/preferencias.js.
 */

const CACHE = "cache:preferencias";

// Uma ida à API por carregamento do app, dividida entre todos os hooks.
let doServidor = null;
function carregarDoServidor() {
  if (!doServidor) {
    doServidor = apiFetch("/api/preferencias")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return doServidor;
}

/** Depois do logout: a próxima pessoa neste navegador busca as dela. */
export function esquecerPreferencias() {
  doServidor = null;
}

const doCache = () => readCache(CACHE) || {};
const guardarNoCache = (chave, valor) => writeCache(CACHE, { ...doCache(), [chave]: valor });

function gravarNoServidor(chave, valor) {
  return apiFetch(`/api/preferencias/${encodeURIComponent(chave)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valor }),
  }).catch(() => { /* sem rede: a cópia local segura até a próxima troca */ });
}

/* Lê a chave antiga do localStorage (o jeito de antes de 21/09/2026). */
function legadoDe(converter, chaveAntiga) {
  if (!chaveAntiga) return undefined;
  const bruto = lerLegado(chaveAntiga);
  if (bruto == null) return undefined;
  try { return converter(bruto); } catch { return undefined; }
}

/**
 * [valor, mudar] — como o useState, mas lembrado no banco.
 *
 * @param {string} chave  a preferência (ex.: "obras.modo")
 * @param {*} padrao      o valor de quem nunca escolheu
 * @param {{ antiga?: string, converter?: (bruto: string) => * }} [legado]
 *   a chave antiga do localStorage e como ler o texto dela
 */
export function usePreferencia(chave, padrao, { antiga, converter = JSON.parse } = {}) {
  const [valor, setValor] = useState(() => {
    const c = doCache();
    if (chave in c) return c[chave];
    const antigo = legadoDe(converter, antiga);
    return antigo !== undefined ? antigo : padrao;
  });
  const atual = useRef(valor);
  atual.current = valor;

  useEffect(() => {
    let vivo = true;
    carregarDoServidor().then((prefs) => {
      if (!vivo || !prefs) return;
      if (chave in prefs) {
        atual.current = prefs[chave];
        setValor(prefs[chave]);
        guardarNoCache(chave, prefs[chave]);
      } else {
        // O banco ainda não tem: sobe o que este navegador já lembrava.
        const antigo = legadoDe(converter, antiga);
        if (antigo !== undefined) {
          guardarNoCache(chave, antigo);
          gravarNoServidor(chave, antigo);
        }
      }
      if (antiga) apagarLegado(antiga);
    });
    return () => { vivo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  const mudar = useCallback((novo) => {
    const v = typeof novo === "function" ? novo(atual.current) : novo;
    atual.current = v;
    setValor(v);
    guardarNoCache(chave, v);
    gravarNoServidor(chave, v);
  }, [chave]);

  return [valor, mudar];
}
