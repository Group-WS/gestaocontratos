/* Sessão inválida não pode virar beco sem saída.
 *
 * Roda com: node web/src/__testes__/sessao.test.mjs
 *
 * "JWT issued at future": o relógio de quem gerou o token estava
 * adiantado, o servidor recebe um token que diz ter sido emitido daqui a
 * pouco e recusa — pra sempre. Acertar o relógio não resolve, porque o
 * token guardado continua ruim.
 *
 * O app confiava no que estava no localStorage: entrava achando que
 * estava logado, toda chamada ao banco falhava e não havia nem um botão
 * de sair na tela. Este teste guarda as duas decisões que consertam isso.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "AuthGate.jsx"), "utf8");
const bloco = (assinatura, fim = "\n};\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no AuthGate.jsx: ${assinatura}`);
  const f = src.indexOf(fim, i);
  if (f === -1) throw new Error(`não achei o fim de: ${assinatura}`);
  return src.slice(i, f + fim.length);
};
const { tokenPodre } = eval(`(function () {
  ${bloco("const tokenPodre =")}
  return { tokenPodre };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ---- o que derruba a sessão ---- */
// Cada um destes é irrecuperável: tentar de novo dá o mesmo erro.
conf("JWT issued at future", tokenPodre({ message: "JWT issued at future" }), true);
conf("token expirado", tokenPodre({ message: "JWT expired" }), true);
conf("claim inválido", tokenPodre({ message: "invalid claim: missing sub" }), true);
conf("sessão ausente", tokenPodre({ message: "Auth session missing!" }), true);
conf("401 sem mensagem", tokenPodre({ status: 401 }), true);
conf("403 sem mensagem", tokenPodre({ status: 403 }), true);

/* ---- e o que NÃO pode derrubar ---- */
// Derrubar por falha de rede tira a pessoa do trabalho por causa de um
// wi-fi que oscilou — e ela perde o que estava editando.
conf("erro de rede não derruba", tokenPodre({ message: "Failed to fetch" }), false);
conf("timeout não derruba", tokenPodre({ message: "network timeout" }), false);
conf("500 do servidor não derruba", tokenPodre({ status: 500, message: "internal error" }), false);
conf("erro vazio não derruba", tokenPodre({}), false);
conf("nulo não derruba", tokenPodre(null), false);

/* ---- a limpeza tem que alcançar o localStorage ---- */
// `signOut` sozinho não basta: com token inválido ele tenta avisar o
// servidor, leva erro e às vezes deixa a chave gravada. O F5 traz o mesmo
// token podre de volta.
conf("limpa o localStorage na mão", /localStorage[\s\S]{0,200}removeItem/.test(src), true);
conf("... nas chaves de auth do Supabase", /\^sb-\.\*-auth-token/.test(src), true);
conf("signOut é local (não depende do servidor)", /scope:\s*"local"/.test(src), true);

/* ---- e a sessão guardada precisa ser conferida no servidor ---- */
// getSession só lê o localStorage; quem pergunta ao servidor é getUser.
conf("valida com getUser, não só getSession", /getUser\(\)/.test(src), true);
conf("a tela explica o que houve", /sess[ãa]o anterior estava inv[áa]lida/i.test(src), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
