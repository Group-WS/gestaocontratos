/* Acrescentar item à mão no Executivo.
 *
 * Roda com: node web/src/__testes__/item-manual-executivo.test.mjs
 *
 * O cadastro manual sempre existiu (`onEscolher(null)` cria a linha em
 * branco), mas o botão só aparecia no "Nada encontrado". Com a busca dando
 * erro — um texto com aspas e vírgulas quebrava o filtro — ou trazendo
 * resultados que não serviam, quem precisava lançar o item ficava sem saída.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const busca = app.slice(app.indexOf("function BuscaInsumo("), app.indexOf("function SugestoesPreco("));
const { filtroDeBusca } = createRequire(import.meta.url)("../../api/_lib/rotas/insumos.js");

let f = 0;
const conf = (n, ok) => { if (!ok) f++; console.log(`${ok ? "ok  " : "FALHOU"} ${n}`); };

conf("o cadastro à mão fica fora de qualquer condição de resultado",
  /<\/CardContent>/.test(busca) && busca.lastIndexOf("onClick={cadastrarAMao}") > busca.lastIndexOf("lista.length > 0 &&"));
conf("o erro da busca não esconde o cadastro à mão", !/erro && [^\n]*cadastrarAMao/.test(busca) && busca.includes("Você pode cadastrar o item à mão"));
conf("o que foi digitado vira a descrição", busca.includes("descricao: texto, unidade: null, custo_unitario: null, codigo: null"));
conf("sem nada digitado, continua a linha em branco de sempre", busca.includes("texto ? {") && busca.includes(": null);"));
conf("o erro cru do banco não aparece mais na tela", !busca.includes("<AlertDescription>{erro}</AlertDescription>"));

/* O texto real que quebrou a busca (22/09/2026): aspas duplas, vírgulas e ponto. */
const termo = 'Kit automação cabeada, com 8 circuitos. Incluso: 01 tablet iPad 10"" e troca de até 3 Keypads no living.".';
const filtro = filtroDeBusca(termo, ["codigo", "descricao"]);
conf("a busca põe o termo entre aspas (vírgula não vira outro filtro)", filtro.startsWith('codigo.ilike."%'));
conf("... e escapa as aspas de dentro", filtro.includes('10\\"\\"') && !/[^\\]""/.test(filtro));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
