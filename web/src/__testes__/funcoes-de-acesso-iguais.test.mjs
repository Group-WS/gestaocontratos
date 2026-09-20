/* As copias de admin_do_time() nao podem divergir.
 *
 * Roda com: node web/src/__testes__/funcoes-de-acesso-iguais.test.mjs
 *
 * A funcao que decide quem e' administrador esta escrita QUATRO vezes, em
 * quatro arquivos .sql. Hoje as quatro sao identicas — conferi. O problema
 * nao e' o estado de hoje: e' que `create or replace` faz a ultima a rodar
 * vencer, em silencio. Alguem acrescenta um perfil numa copia, esquece as
 * outras, e a partir dai quem e' administrador depende da ordem em que os
 * scripts foram colados no SQL Editor — que ninguem anota.
 *
 * Juntar as quatro num arquivo so' quebraria a propriedade que a pasta
 * tem hoje: cada .sql roda sozinho, num banco novo, sem dependencia
 * escondida. Entao em vez de juntar, este teste vigia: divergiu, apita.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const supabase = path.join(aqui, "..", "..", "..", "supabase");

const ARQUIVOS = [
  "admin-master.sql",
  "compradores.sql",
  "contrato-restrito.sql",
  "mao-de-obra-propria.sql",
];

/* Recorta o corpo da funcao, do cabecalho ate' o fechamento. Compara o
   texto normalizado: espaco a mais nao e' divergencia, palavra a mais e'. */
function corpoDaFuncao(arquivo) {
  const src = fs.readFileSync(path.join(supabase, arquivo), "utf8");
  const inicio = src.indexOf("create or replace function public.admin_do_time");
  if (inicio === -1) return null;
  const fim = src.indexOf("$$;", inicio);
  if (fim === -1) return null;
  return src.slice(inicio, fim + 3).replace(/\s+/g, " ").trim();
}

let falhas = 0;
const conf = (nome, ok) => {
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome}`);
  if (!ok) falhas++;
};

const corpos = ARQUIVOS.map((a) => [a, corpoDaFuncao(a)]);

for (const [arquivo, corpo] of corpos) {
  conf(`${arquivo} tem a funcao admin_do_time`, corpo !== null);
}

const referencia = corpos[0][1];
for (const [arquivo, corpo] of corpos.slice(1)) {
  conf(`${arquivo} esta igual a ${ARQUIVOS[0]}`, corpo === referencia);
}

/* O que a funcao PRECISA dizer, alem de estar igual em todo lugar: as
   quatro copias identicas e todas erradas passariam no teste acima. */
conf("admin_do_time aceita admin e master", /perfil in \('admin','master'\)/.test(referencia || ""));
conf("admin_do_time exige a pessoa ativa", /\bativo\b/.test(referencia || ""));

console.log(`\n${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
