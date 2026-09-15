/* Mão de obra própria (Gestão de compras): a conta da calculadora e a
 * equipe de partida, que tem que ser a mesma no app e no SQL.
 *
 * Roda com: node web/src/__testes__/mao-de-obra-propria.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "App.jsx"), "utf8");
const sql = fs.readFileSync(path.join(dir, "..", "..", "..", "supabase", "mao-de-obra-propria.sql"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const M = eval(`(function () {
  ${bloco("const PRESTADORES_PADRAO =", "\n];\n")}
  ${bloco("function custoEquipeInterna(")}
  ${bloco("function comparacaoEquipe(")}
  return { PRESTADORES_PADRAO, custoEquipeInterna, comparacaoEquipe };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

conf("montador 10 dias", M.custoEquipeInterna([{ diaria: 450, dias: 10, pessoas: 1 }]), 4500);
conf("dois auxiliares 10 dias somam com o montador",
  M.custoEquipeInterna([{ diaria: 450, dias: 10, pessoas: 1 }, { diaria: 385, dias: 10, pessoas: 2 }]), 12200);
conf("meio dia conta", M.custoEquipeInterna([{ diaria: 300, dias: 2.5, pessoas: 1 }]), 750);
conf("linha sem dias ainda não custa", M.custoEquipeInterna([{ diaria: 450, dias: 0, pessoas: 1 }]), 0);
conf("sem pessoas informadas vale uma", M.custoEquipeInterna([{ diaria: 350, dias: 4 }]), 1400);
const c = M.comparacaoEquipe(12200, 20000);
conf("economia contra o valor a contratar", c.diferenca, 7800);
conf("em porcentagem", c.pct, 39);
conf("custa a mais vira diferença negativa", M.comparacaoEquipe(25000, 20000).diferenca, -5000);
conf("sem valor a contratar não há porcentagem", M.comparacaoEquipe(1000, 0).pct, null);

// A equipe de partida é a mesma nos dois lugares (o app usa enquanto o SQL não roda).
const doSql = [...sql.matchAll(/\('([^']+)',\s*'([^']+)',\s*([\d.]+)\)/g)].map((m) => `${m[1]}|${m[2]}|${Number(m[3])}`);
const doApp = M.PRESTADORES_PADRAO.map((p) => `${p.especialidade}|${p.funcao}|${p.diaria}`);
conf("o SQL semeia a mesma equipe do app", doSql.join(";"), doApp.join(";"));
conf("os valores que ela passou", doApp.join(";"),
  "Marcenaria|Montador|450;Marcenaria|Auxiliar|385;Pintura|Pintor|450;Pintura|Ajudante|300;Gesseiro|Gesseiro|350;Pedreiro|Pedreiro|300");
conf("a tabela tem RLS e só administrador escreve",
  /enable row level security/.test(sql) && (sql.match(/public\.admin_do_time\(\)/g) || []).length >= 4, true);
conf("rodar de novo não duplica a equipe", /where not exists \(select 1 from public\.prestador_interno\)/.test(sql), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
