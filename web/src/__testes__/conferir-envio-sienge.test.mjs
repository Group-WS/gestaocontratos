/* Conferir um envio pendente do Sienge.
 *
 * Roda com: node web/src/__testes__/conferir-envio-sienge.test.mjs
 *
 * A rota GET /api/sienge/solicitacao/:id devolve `existe`, o cabeçalho e
 * `itensDisponiveis: false` — a API do Sienge não lista os itens de uma
 * solicitação. A tela contava `dados.itens.length`, estourava TypeError e a
 * pendência nunca se encerrava, justo quando a solicitação EXISTE.
 */
import fs from "node:fs";
const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const rota = fs.readFileSync(new URL("../../api/_lib/mondayApp.js", import.meta.url), "utf8");

let f = 0;
const conf = (n, ok) => { if (!ok) f++; console.log(`${ok ? "ok  " : "FALHOU"} ${n}`); };

conf("a rota não devolve lista de itens", /itensDisponiveis: false/.test(rota) && !/\bitens:\s*\[/.test(rota.slice(rota.indexOf('"/api/sienge/solicitacao/:id"'))));
conf("a tela não conta itens que não vieram", !app.includes("const n = dados.itens.length;"));
conf("... e só usa a lista quando ela existe", app.includes("Array.isArray(dados.itens) ? dados.itens : null"));
conf("sem a lista, fica 'parcial' — não afirma que tudo entrou", app.includes('status: todos ? "concluido" : "parcial", ok: todos'));
conf("o aviso de não reenviar continua", app.includes("NÃO reenvie o que já está lá."));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
