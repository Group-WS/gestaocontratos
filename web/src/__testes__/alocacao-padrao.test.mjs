/* Alocação padrão da empresa, por descrição.
 *
 * Roda com: node web/src/__testes__/alocacao-padrao.test.mjs
 *
 * "Anotação de responsabilidade técnica – RRT" é mão de obra em toda obra
 * que a casa faz. Corrigir isso obra a obra é refazer a mesma decisão pra
 * sempre — e basta esquecer uma vez pra o valor cair na coluna errada e o
 * contrato nascer menor do que deveria.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Roda as funções REAIS da lib, sem o import do supabase — o node não
   resolve caminho sem extensão (quem resolve é o Vite), e trazer o
   cliente do banco pra dentro do teste seria pedir rede pra testar uma
   comparação de texto. */
const src = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "alocacaoPadrao.js"), "utf8");
const puro = src
  .slice(src.indexOf("let registro"))
  .split("export async function")[0]
  .replace(/export /g, "");
const { normalizarDesc, definirPadroes, padraoDaDescricao } =
  eval(`(function () { ${puro}
    return { normalizarDesc, definirPadroes, padraoDaDescricao };
  })()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. a mesma descrição vem escrita de vários jeitos ---- */
// Entre planilhas o mesmo item aparece com caixa, acento e espaço
// diferentes. Se as três não casarem, o padrão não serve pra nada.
conf("acento não separa", normalizarDesc("Caçambas de entulho"), normalizarDesc("Cacambas de entulho"));
conf("caixa não separa", normalizarDesc("CAÇAMBAS DE ENTULHO"), normalizarDesc("Caçambas de entulho"));
conf("espaço dobrado não separa", normalizarDesc("Caçambas  de  entulho"), normalizarDesc("Caçambas de entulho"));
conf("espaço na ponta não separa", normalizarDesc("  Caçambas de entulho "), normalizarDesc("Caçambas de entulho"));
conf("descrição vazia não vira chave", normalizarDesc("   "), "");

/* ---- 2. o registro responde pelas variações ---- */
definirPadroes([
  { descricao: "Anotação de responsabilidade técnica – RRT", alocacao: "MO" },
  { descricao: "Caçambas de entulho", alocacao: "MO" },
  { descricao: "Proteção de pisos, paredes, esquadrias e superfícies sensíveis", alocacao: "MAT" },
]);

conf("acha pelo texto exato", padraoDaDescricao("Caçambas de entulho"), "MO");
conf("acha sem acento", padraoDaDescricao("Cacambas de entulho"), "MO");
conf("acha em caixa alta", padraoDaDescricao("CAÇAMBAS DE ENTULHO"), "MO");
conf("acha com espaço sobrando", padraoDaDescricao(" Caçambas  de entulho "), "MO");
conf("RRT é mão de obra", padraoDaDescricao("Anotação de responsabilidade técnica – RRT"), "MO");
conf("proteção de pisos é material", padraoDaDescricao("Proteção de pisos, paredes, esquadrias e superfícies sensíveis"), "MAT");

/* ---- 3. o que a empresa nunca decidiu continua indefinido ---- */
// Devolver um chute aqui seria pior que devolver nada: a tela trataria
// palpite como decisão da casa.
conf("descrição desconhecida devolve null", padraoDaDescricao("Bancada de mármore"), null);
conf("descrição vazia devolve null", padraoDaDescricao(""), null);
conf("undefined devolve null", padraoDaDescricao(undefined), null);
// Descrições parecidas não podem se confundir — "Limpeza de obra" e
// "Limpeza de obra final" são serviços diferentes, com preços diferentes.
definirPadroes([{ descricao: "Limpeza de obra", alocacao: "MO" }]);
conf("não casa por prefixo", padraoDaDescricao("Limpeza de obra final"), null);
conf("casa só o exato", padraoDaDescricao("Limpeza de obra"), "MO");

/* ---- 4. redefinir substitui, não acumula ---- */
definirPadroes([{ descricao: "Caçambas de entulho", alocacao: "MAT" }]);
conf("recarregar troca o valor", padraoDaDescricao("Caçambas de entulho"), "MAT");
conf("... e some o que saiu da tabela", padraoDaDescricao("Limpeza de obra"), null);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
