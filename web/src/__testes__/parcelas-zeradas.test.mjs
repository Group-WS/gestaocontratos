/* Coluna zerada na planilha nao vale zero: vale o custo do item.
 *
 * Roda com: node web/src/__testes__/parcelas-zeradas.test.mjs
 *
 * Bug da obra 2195, verba 31 (Itens Decorativos), itens 16.4, 16.5 e 16.7 —
 * o enxoval e os vasos. O Executivo mostrava R$ 2.535,45 e a Conf.
 * Executivo mostrava R$ 0,00 nos mesmos itens: o Executivo imprime
 * `it.custo` direto, e a Conf. passa por `parcelasDaPlanilha`.
 *
 * Esses itens vem da planilha com `totalMaterial: 0` e `totalMO: 0` —
 * colunas PRESENTES e zeradas — e `custo` preenchido. O chute que existia
 * para a coluna ausente (`null`) nao disparava, e a funcao devolvia zero
 * afirmando (`estimado: false`) que aquele zero era o numero da planilha.
 * O item atravessava verba, liberacao e Plano de Compras valendo nada.
 *
 * O que nao pode voltar a quebrar:
 *   1. coluna zerada cai no mesmo chute da coluna ausente, com `estimado`;
 *   2. quem TEM divisao na planilha continua intocado, e sem `estimado`;
 *   3. um lado zerado e o outro com valor NAO e' chute: a planilha disse.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

const M = eval(`(function () {
  const ehProduto = (it) => it.tipo === "produto";
  ${bloco("function parcelasDaPlanilha(")}
  return { parcelasDaPlanilha };
})()`);

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(74)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};
const p = (it) => M.parcelasDaPlanilha(it);

// ---------- o bug: colunas presentes e zeradas, custo preenchido ----------
const enxoval = { tipo: "produto", codigo: "16.4", desc: "Enxoval", qtdExecutivo: 1, custo: 2535.45, totalMaterial: 0, totalMO: 0 };
conf("16.4 enxoval · produto zerado vale o custo em material",
  p(enxoval), { material: 2535.45, mo: 0, estimado: true });
conf("16.7 vasos · produto zerado vale o custo em material",
  p({ ...enxoval, codigo: "16.7", desc: "Vasos Plantas", custo: 1000 }), { material: 1000, mo: 0, estimado: true });
conf("serviço zerado vale o custo em mão de obra",
  p({ tipo: "servico", codigo: "03.1", custo: 3000, totalMaterial: 0, totalMO: 0 }), { material: 0, mo: 3000, estimado: true });
conf("custo unitário zerado (custoMaterial/custoMO) também cai no chute",
  p({ tipo: "produto", qtdExecutivo: 5, custo: 900, custoMaterial: 0, custoMO: 0, totalMaterial: null, totalMO: null }),
  { material: 900, mo: 0, estimado: true });

// ---------- o que já funcionava continua funcionando ----------
conf("coluna ausente continua caindo no chute",
  p({ tipo: "produto", custo: 500, totalMaterial: null, totalMO: null }), { material: 500, mo: 0, estimado: true });
conf("divisão da planilha é respeitada, sem estimar",
  p({ tipo: "produto", custo: 300, totalMaterial: 200, totalMO: 100 }), { material: 200, mo: 100, estimado: false });
conf("material zerado com MO preenchida é resposta da planilha, não chute",
  p({ tipo: "servico", custo: 4000, totalMaterial: 0, totalMO: 4000 }), { material: 0, mo: 4000, estimado: false });
conf("MO zerada com material preenchido é resposta da planilha, não chute",
  p({ tipo: "produto", custo: 500, totalMaterial: 500, totalMO: 0 }), { material: 500, mo: 0, estimado: false });
conf("unitário × quantidade continua valendo",
  p({ tipo: "produto", qtdExecutivo: 3, custoMaterial: 50, custoMO: 10, totalMaterial: null, totalMO: null }),
  { material: 150, mo: 30, estimado: false });

// ---------- item que de fato não tem preço ----------
conf("item sem custo nenhum continua zerado (só passa a sair marcado)",
  p({ tipo: "produto", custo: 0, totalMaterial: 0, totalMO: 0 }), { material: 0, mo: 0, estimado: true });

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
