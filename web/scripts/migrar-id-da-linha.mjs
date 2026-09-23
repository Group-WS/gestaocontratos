/* MIGRAÇÃO: o id da linha do Executivo nas obras que já existem (ADR-007).
 *
 * Roda em dois passos, e só o segundo grava:
 *
 *   1. Ler e relatar (não grava nada):
 *        supabase db query --linked --agent=no -o json \
 *          "select obra_codigo, versao, editando_por, categorias from public.obra_dados" > obras.json
 *        node web/scripts/migrar-id-da-linha.mjs obras.json pasta-de-saida
 *      Imprime, por obra, quantas linhas casaram e o que ficou sem id
 *      (empate ou sem par), e escreve UM ARQUIVO POR OBRA na pasta
 *      (`<codigo>.sql`). Um arquivo só com todas passava do limite de
 *      tamanho da API do Supabase (413).
 *
 *   2. Depois de o dev revisar o relatório, um por obra:
 *        for f in pasta-de-saida/*.sql; do supabase db query --linked -f "$f"; done
 *
 * Cada gravação só vale se a obra não mudou desde a leitura (mesma
 * `versao`) e se ninguém está com a edição — senão não grava nada naquela
 * obra, e basta rodar os dois passos de novo depois. Rodar de novo é
 * seguro: linha que já tem id não é tocada.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { casarLinhasDaObra } from "../src/lib/idDaLinha.js";

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error("uso: node web/scripts/migrar-id-da-linha.mjs obras.json pasta-de-saida");
  process.exit(1);
}

const bruto = JSON.parse(readFileSync(entrada, "utf8"));
const linhas = Array.isArray(bruto) ? bruto : bruto.rows;
const literal = (texto) => `'${String(texto).replace(/'/g, "''")}'`;

mkdirSync(saida, { recursive: true });
let obrasMudadas = 0;
let totalCasadas = 0;
for (const o of linhas) {
  const categorias = typeof o.categorias === "string" ? JSON.parse(o.categorias) : o.categorias;
  const r = casarLinhasDaObra(categorias);
  totalCasadas += r.casadas;
  const pendentes = r.semPar.length + r.empates.length;
  const emEdicao = o.editando_por ? ` · EM EDIÇÃO por ${o.editando_por} (a gravação espera a trava sair)` : "";
  console.log(`obra ${o.obra_codigo}: ${r.casadas} casadas · ${r.empates.length} em empate · ${r.semPar.length} sem par${emEdicao}`);
  if (pendentes) {
    [...r.empates.map((x) => ({ ...x, motivo: "empate" })), ...r.semPar.map((x) => ({ ...x, motivo: "sem par" }))]
      .forEach((x) => console.log(`    verba ${x.verba} · ${x.motivo} · ${x.lado} · ${x.desc ?? "—"}${x.ambiente ? ` · ${x.ambiente}` : ""}`));
  }
  if (!r.mudou) continue;
  obrasMudadas += 1;
  writeFileSync(join(saida, `${o.obra_codigo}.sql`), [
    `-- Migração do id da linha do Executivo (ADR-007), obra ${o.obra_codigo}. Gerado por web/scripts/migrar-id-da-linha.mjs.`,
    "begin;",
    `update public.obra_dados set categorias = ${literal(JSON.stringify(r.categorias))}::jsonb`
      + ` where obra_codigo = ${literal(o.obra_codigo)} and versao = ${Number(o.versao)} and editando_por is null;`,
    "commit;",
  ].join("\n") + "\n");
}
console.log(`\n${linhas.length} obras lidas · ${obrasMudadas} a gravar · ${totalCasadas} linhas casadas`);
console.log(`gravações em ${saida}/ (um arquivo por obra) — nada foi gravado ainda.`);
