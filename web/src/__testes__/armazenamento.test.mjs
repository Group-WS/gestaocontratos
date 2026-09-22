/* O wrapper do armazenamento do navegador (web/src/lib/armazenamento.js).
 *
 * Roda com: node web/src/__testes__/armazenamento.test.mjs
 *
 * É o ÚNICO arquivo do front que toca o localStorage (NAV-03). O que ele
 * tem que garantir: só chave declarada, cache com versão e validade
 * (NAV-05), limpeza no logout (NAV-06), a chave de sessão do Supabase
 * apagada só quando pedida, e as preferências antigas lidas uma vez.
 */

// Um localStorage de mentira, do tamanho do que o wrapper usa.
const dados = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    key: (i) => [...dados.keys()][i] ?? null,
    get length() { return dados.size; },
  },
};
// Object.keys(localStorage) lista as chaves guardadas, como no navegador.
globalThis.window.localStorage = new Proxy(globalThis.window.localStorage, {
  ownKeys: () => [...dados.keys()],
  getOwnPropertyDescriptor: (alvo, k) => (dados.has(k) ? { enumerable: true, configurable: true, value: dados.get(k) } : Reflect.getOwnPropertyDescriptor(alvo, k)),
});

const { readCache, writeCache, clearBrowserData, apagarSessaoDoSupabase, lerLegado, apagarLegado, ALLOWED_KEYS } =
  await import("../lib/armazenamento.js");

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(64)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};

conf("só a chave de cache das preferências é declarada", Object.keys(ALLOWED_KEYS), ["cache:preferencias"]);

writeCache("cache:preferencias", { "obras.modo": "squad" });
conf("guarda e devolve o cache declarado", readCache("cache:preferencias"), { "obras.modo": "squad" });
const envelope = JSON.parse(dados.get("cache:preferencias"));
conf("o cache vai num envelope com versão e validade", [envelope.version, typeof envelope.expiresAt], [1, "number"]);

writeCache("qualquer:coisa", 1);
conf("chave não declarada não é gravada", dados.has("qualquer:coisa"), false);
conf("... nem lida", readCache("qualquer:coisa"), null);

dados.set("cache:preferencias", JSON.stringify({ version: 1, expiresAt: Date.now() - 1, data: { velho: true } }));
conf("cache vencido é ignorado", readCache("cache:preferencias"), null);
conf("... e apagado", dados.has("cache:preferencias"), false);

dados.set("cache:preferencias", JSON.stringify({ version: 0, expiresAt: Date.now() + 1000, data: {} }));
conf("cache de outra versão é descartado", readCache("cache:preferencias"), null);

dados.set("cache:preferencias", "{isto não é json");
conf("cache corrompido não derruba a tela", readCache("cache:preferencias"), null);

writeCache("cache:preferencias", { a: 1 });
dados.set("sb-abc123-auth-token", "sessao");
dados.set("outra-coisa", "fica");
clearBrowserData();
conf("logout apaga o cache", dados.has("cache:preferencias"), false);
conf("... e não mexe no que não é dele", dados.get("outra-coisa"), "fica");

apagarSessaoDoSupabase();
conf("apagar a sessão tira a chave de auth do Supabase", dados.has("sb-abc123-auth-token"), false);
conf("... e só ela", dados.get("outra-coisa"), "fica");

dados.set("tkws.so.minhas", "1");
conf("lê a preferência antiga, para subir pro banco", lerLegado("tkws.so.minhas"), "1");
apagarLegado("tkws.so.minhas");
conf("... e apaga depois", dados.has("tkws.so.minhas"), false);
conf("chave que não é das antigas não é lida por essa porta", lerLegado("outra-coisa"), null);

console.log(falhas === 0 ? "\nOK — o armazenamento só guarda o que pode" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
