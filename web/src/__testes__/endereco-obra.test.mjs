/* O endereço da obra: qual aparece, e quem corrige.
 *
 * Roda com: node web/src/__testes__/endereco-obra.test.mjs
 *
 * O gravado na obra (corrigido por administrador) manda; sem ele, o que a
 * obra já tem; sem nenhum, o do cadastro do Sienge. Só administrador e admin
 * master veem o lápis.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "App.jsx"), "utf8");
const lib = fs.readFileSync(path.join(dir, "..", "lib", "obras.js"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const { enderecoResolvido } = eval(`(function () { ${bloco("function enderecoResolvido(")} return { enderecoResolvido }; })()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(52)} ${String(o).slice(0, 26).padEnd(26)} ${ok ? "" : "esperava " + e}`); };

conf("o corrigido na obra manda", enderecoResolvido("Rua Velha, 1", "Rua Nova, 2", "Rua Sienge, 3"), "Rua Nova, 2");
conf("sem o da obra, fica o que já tinha", enderecoResolvido("Rua Velha, 1", null, "Rua Sienge, 3"), "Rua Velha, 1");
conf("sem nenhum, vem o do Sienge", enderecoResolvido("—", null, "Rua Sienge, 3"), "Rua Sienge, 3");
conf("traço conta como vazio", enderecoResolvido("—", "—", "Rua Sienge, 3"), "Rua Sienge, 3");
conf("sem nada em lugar nenhum, fica como está", enderecoResolvido("—", null, undefined), "—");
conf("só administrador e admin master veem o lápis", /<EnderecoDaObra obra=\{obra\} podeEditar=\{souAdmin\}/.test(src), true);
conf("souAdmin é administrador ou admin master", /const souAdmin = migracaoPendente \|\| ehAdministrador\(eu\);/.test(src), true);
conf("a lib grava a coluna endereco da obra", /export async function definirEndereco[\s\S]*?\.update\(\{ endereco:/.test(lib), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
