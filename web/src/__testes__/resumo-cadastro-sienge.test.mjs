/* O resumo pra cadastro no Sienge (Compras, etapa Sienge, barra da seleção).
 *
 * Roda com: node web/src/__testes__/resumo-cadastro-sienge.test.mjs
 *
 * As colunas do template de detalhe do Sienge mais a quantidade. Vale o
 * que a tela mostra (mãe escolhida ou sugerida); o mesmo produto em dois
 * ambientes vira uma linha com a quantidade somada; o que não precisa de
 * cadastro (detalhe que já existe) ou não tem mãe vai pra outra aba.
 */
import fs from "node:fs";
import { codigoAuxiliarDe, descricaoSienge, limparTemplate, auxiliarEstavel } from "../lib/sienge.js";

const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const bloco = (a) => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei no App.jsx: ${a}`);
  return src.slice(i, src.indexOf("\n}\n", i) + 3);
};
const linha = (a) => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei no App.jsx: ${a}`);
  return src.slice(i, src.indexOf("\n", i) + 1);
};
const M = new Function("codigoAuxiliarDe", "descricaoSienge", "limparTemplate", "auxiliarEstavel", `
  ${linha("const CABECALHO_CADASTRO_SIENGE =")}
  ${bloco("function situacaoNoSienge(")}
  ${bloco("function descritivoDoItem(")}
  ${bloco("function auxiliaresDoGrupo(")}
  ${bloco("function textoComparavel(")}
  ${bloco("function resumoCadastroSienge(")}
  return { CABECALHO_CADASTRO_SIENGE, auxiliaresDoGrupo, resumoCadastroSienge };
`)(codigoAuxiliarDe, descricaoSienge, limparTemplate, auxiliarEstavel);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).slice(0, 40).padEnd(42)} ${ok ? "" : "esperava " + e}`); };

const CADEIRA = { codigo: "406", nome: "MOBILIA SOLTA - CADEIRA", variantes: [] };
const BASE = [CADEIRA];
const sugerida = { maes: [{ grupo: CADEIRA, score: 0.8 }], detalhes: [] };
const linhaDe = (chave, it) => ({ chave, it: { codigo: "24.3", desc: "Cadeira Eiffel", marca: "Rivatti", un: "un", ...it } });
const itens = [
  linhaDe("a", { ambiente: "Sala", qtdExecutivo: 2 }),
  linhaDe("b", { ambiente: "Varanda", qtdExecutivo: 3 }),
  linhaDe("c", { desc: "Cadeira Tulipa", detalheSienge: "MOBILIA SOLTA - CADEIRA / TULIPA", qtdExecutivo: 4 }),
  linhaDe("d", { desc: "Mesa lateral", qtdExecutivo: 1 }),
  linhaDe("e", { desc: "Banco", maeSienge: "406", codigoDetalheSienge: " 77 ", qtdExecutivo: 1.5 }),
  linhaDe("f", { desc: "Cadeira Tulipa", detalheSienge: "MOBILIA SOLTA - CADEIRA / TULIPA", ambiente: "Varanda", qtdExecutivo: 2 }),
  // mesma descrição do gerado pra "a" e "b", só com caixa e espaços diferentes
  linhaDe("g", { ambiente: "Quarto", qtdExecutivo: 1,
    descritivoSienge: descricaoSienge({ marca: "Rivatti", desc: "Cadeira Eiffel" }).toLowerCase().replace(/ /g, "  ") }),
];
const casamentos = new Map([["a", sugerida], ["b", sugerida], ["c", sugerida], ["f", sugerida], ["g", sugerida]]);
const r = M.resumoCadastroSienge(itens, casamentos, BASE, M.auxiliaresDoGrupo(itens, "2450"));

conf("as colunas que ela pediu", M.CABECALHO_CADASTRO_SIENGE.join(" | "),
  "Código auxiliar do insumo* | Descrição do insumo | Código do detalhe* | Código auxiliar do detalhe* | Descrição do detalhe* | Quantidade");
const eiffel = r.linhas.filter((l) => /EIFFEL/i.test(l.descricaoDetalhe));
conf("o mesmo produto em ambientes diferentes vira uma linha", eiffel.length, 1);
conf("... com a quantidade somada, sem ligar pra caixa e espaço", eiffel[0].quantidade, 6);
conf("a mãe sugerida vale", eiffel[0].maeCodigo, "406");
conf("... com o nome do insumo", eiffel[0].maeNome, "MOBILIA SOLTA - CADEIRA");
conf("detalhe novo diz que precisa cadastrar", eiffel[0].situacao, "detalhe novo (cadastrar)");
conf("detalhe novo leva código auxiliar", String(eiffel[0].codigoAuxDetalhe).length > 0, true);
const banco = r.linhas.find((l) => /BANCO/i.test(l.descricaoDetalhe));
conf("a mãe gravada no item vale sem sugestão", !!banco, true);
conf("código do detalhe digitado vai limpo", banco?.codigoDetalhe, "77");
const tulipa = r.linhas.find((l) => /TULIPA/i.test(l.descricaoDetalhe));
conf("detalhe já cadastrado também entra no resumo", tulipa?.situacao, "detalhe já cadastrado");
conf("... somando os iguais", tulipa?.quantidade, 6);
conf("... sem inventar código auxiliar", tulipa?.codigoAuxDetalhe, "");
conf("sem insumo mãe vai pra outra aba", r.semMae.some((l) => /Mesa/.test(l.item)), true);
conf("... e não entra no resumo", r.linhas.some((l) => /MESA/i.test(l.descricaoDetalhe)), false);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
