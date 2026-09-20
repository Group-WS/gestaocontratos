/* Taylor Made: o papel, o recorte, o filtro e a coluna Equipe.
 *
 * Roda com: node web/src/__testes__/taylor-made.test.mjs
 * A regra pura (quem ve o que) e' testada em acessos.test.mjs.
 *
 * Aqui e' a fiacao — e ela tem um jeito proprio de falhar. O recorte
 * "minhas obras" sao TRES chamadas espalhadas pelo App.jsx: a conta na
 * barra, o filtro "so' as minhas" da barra, e a lista do Inicio. Enquanto
 * as tres nao concordarem, a Taylor ve numero de um jeito e lista de
 * outro, e ninguem entende por que.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");
const pessoas = fs.readFileSync(path.join(aqui, "..", "lib", "pessoas.js"), "utf8");
const css = fs.readFileSync(path.join(aqui, "..", "estilos", "telas.css"), "utf8");
const sql = fs.readFileSync(path.join(aqui, "..", "..", "..", "supabase", "taylor-made.sql"), "utf8");

let f = 0;
const conf = (n, o, e = true) => {
  const ok = JSON.stringify(o) === JSON.stringify(e);
  if (!ok) f++;
  console.log(`${ok ? "ok    " : "FALHOU"}  ${n.padEnd(56)}${ok ? "" : `${JSON.stringify(o)} esperava ${JSON.stringify(e)}`}`);
};

console.log("=== o recorte, nos tres lugares ===");
conf("a regra antiga saiu do App.jsx", app.includes("const obraDoGC ="), false);
conf("as tres chamadas usam a mesma regra", (app.match(/obraDaPessoa\(o, usuario\)/g) || []).length, 3);
conf("... e nenhuma sobrou olhando so' o gc", /obraDoGC\(/.test(app), false);

console.log("\n=== a grafia, num lugar so' ===");
conf("o rotulo da tela e' 'Taylor Made'", /rotulo: "Taylor Made"/.test(pessoas));
conf("a coluna do banco segue 'tailor_made'", pessoas.includes('"tailor_made"'));
conf("o perfil novo existe", /id: "taylor", nome: "Taylor Made"/.test(pessoas));
/* Uma grafia so' na tela inteira. Dentro da obra o rotulo estava escrito
   a mao como "Tailor Made" (ingles) enquanto o filtro do Inicio dizia
   "Taylor Made" — a mesma pessoa, dois nomes, na mesma sessao. */
conf("nenhum rotulo com a grafia inglesa sobrou na tela",
  /rotulo="Tailor Made"/.test(app), false);
conf("o rotulo da obra sai de PAPEIS_DA_OBRA",
  app.includes('PAPEIS_DA_OBRA.find((x) => x.chave === "tailorMade").rotulo'));

console.log("\n=== a coluna Equipe ===");
conf("o componente existe", app.includes("function EquipeDaObra("));
conf("... e entra na linha da obra", app.includes("<EquipeDaObra obra={o} equipe={equipe} />"));
conf("a vaga vazia aparece, e nao some", app.includes('"a definir"'));
conf("... com estilo proprio, pra ler como lacuna", css.includes(".ini-papel.vago"));
conf("o 'GC Fulano' solto saiu", app.includes('className="ini-obra-gc">GC '), false);

console.log("\n=== o filtro ===");
conf("existe filtro por Taylor Made", app.includes('<span className="ini-filtro-rot">Taylor Made</span>'));
conf("a lista de Taylors sai das obras, nao da Equipe inteira",
  /const taylors = useMemo\(\(\) => \{[\s\S]{0,200}obras\.forEach/.test(app));
conf("o estado nasce ANTES do useMemo que o le'",
  app.indexOf("const [filtroTaylor") < app.indexOf("const listaObras = useMemo"));
conf("... e a lista depende dele", /\}, \[minhas, obras, temAtrasoPorCodigo, filtroTaylor\]\)/.test(app));
conf("o titulo diz qual recorte esta' na tela", app.includes('filtroTaylor ? "Obras da Taylor"'));

/* O SQL nao pode ASSUMIR o que nao foi rodado. Na primeira versao ele
   quebrou no Supabase com "function public.meu_perfil() does not exist":
   o rls-perfis.sql nunca foi aplicado, entao o corte por perfil nao
   existe no banco — a politica em vigor e' a do schema.sql, "to
   authenticated using (true)", e quem recorta por perfil hoje e' so' a
   tela. A parte que depende disso passou a se proteger sozinha. */
console.log("\n=== o SQL ===");
conf("o arquivo existe no repo", sql.length > 0);
conf("o perfil taylor entra na trava da coluna", /perfil in \([^)]*'taylor'\)/.test(sql));
conf("... e o canal, que nunca tinha entrado", /perfil in \([^)]*'canal'/.test(sql));
conf("minhas_obras passa a olhar tailor_made", sql.includes("lower(o.tailor_made)"));
conf("... e responsavel_executivo", sql.includes("lower(o.responsavel_executivo)"));
conf("o perfil taylor entra no recorte", /when 'taylor'/.test(sql));
conf("'obra sem GC todo mundo ve' continua valendo", sql.includes("o.gc is null"));
conf("a parte que depende do rls-perfis se protege sozinha",
  sql.includes("to_regprocedure('public.meu_perfil()') is null"));
conf("... e avisa em vez de quebrar o arquivo", sql.includes("raise notice"));
conf("a trava da coluna NAO depende disso e roda sempre",
  sql.indexOf("add constraint pessoa_perfil_check") < sql.indexOf("do $migra$"));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
