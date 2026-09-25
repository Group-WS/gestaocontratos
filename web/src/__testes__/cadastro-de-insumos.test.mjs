/* Cadastro de Insumos: a leitura do relatório do Sienge e o plano da importação.
 *
 * Roda com: node web/src/__testes__/cadastro-de-insumos.test.mjs
 *
 * O arquivo é montado em memória no MESMO layout do relatório "Insumos" do
 * Sienge (09/2026): título, linha "Tabela", BDI, cabeçalho na linha 8 com a
 * Descrição mesclada de B a F, dados e o rodapé com data e "SIENGE / STARIAN".
 * O leitor recebe o que a rota entrega: `sheet_to_json` com `header: 1`.
 *
 * Guarda as decisões da ADR-008:
 *   - modelo: cabeçalho pelos nomes, linha Tabela e rodapé obrigatórios;
 *   - chave Código + Descrição, texto exatamente como veio;
 *   - repetidas juntadas; pares que só diferem por espaço entram e são avisados;
 *   - linha incompleta fica de fora com o número da linha do Excel; "vb" fica de fora (RN-089);
 *   - reimportação: o que veio volta a Ativo, conflito só com escolha, criado
 *     na tela intocado, "apagar" respeita a RN-087 e "manter" não apaga nada.
 */
import XLSX from "xlsx";
import { lerRelatorioDeInsumos, planejarImportacao, separarTabela, dataDoRodape, editadoNaTela, cortar } from "../lib/relatorioDeInsumos.js";

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(78)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};

const V = null;
/* O relatório como o Sienge gera. `dados`: [codigo, descricao, unidade]. */
function relatorio(dados, { tabela = "1 - TABELA WS BUILDING", rodape = ["21/09/2026 - 21:12:13", V, V, V, "SIENGE / STARIAN", V, V], cabecalho = ["Código", "Descrição", V, V, V, V, "Unidade"] } = {}) {
  const topo = [
    [V, V, V, V, V, V, V],
    [V, V, "Insumos", V, V, V, V],
    [V, V, V, V, V, V, V],
    [V, V, V, V, V, V, V],
    tabela === null ? [V, V, V, V, V, V, V] : ["Tabela", V, V, tabela, V, V, V],
    ["BDI", V, V, "Não aplicar", V, "Encargos sociais", V],
    [V, V, V, V, V, V, V],
    cabecalho,
  ];
  const corpo = dados.map(([c, d, u]) => [c, d, V, V, V, V, u]);
  const linhas = [...topo, ...corpo, [V, V, V, V, V, V, V], ...(rodape ? [rodape] : [])];
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws["!merges"] = corpo.map((_, i) => ({ s: { r: 8 + i, c: 1 }, e: { r: 8 + i, c: 5 } }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  const lido = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  return XLSX.utils.sheet_to_json(lido.Sheets[lido.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: true });
}

// ---------- pedaços do modelo ----------
conf("separa a tabela do topo", separarTabela("1 - TABELA WS BUILDING"), { codigo: "1", nome: "TABELA WS BUILDING" });
conf("tabela sem número não é tabela", separarTabela("TABELA WS BUILDING"), null);
conf("data do rodapé, no horário de Brasília", dataDoRodape("21/09/2026 - 21:12:13"), "2026-09-21T21:12:13-03:00");
conf("rodapé sem data não é rodapé", dataDoRodape("SIENGE / STARIAN"), null);

// ---------- o modelo ----------
const DADOS = [
  [1, "CONSULTA DE VIABILIDADE / Plafon De Sobrepor Eco Branco LORENA", "vb"],
  [1, "CONSULTA DE VIABILIDADE", "vb"],
  [5, "IPTU", "vb"],
  [275, "AR CONDICIONADO / LG / ARTCOLL / DUAL INVERTER 22.000 BTUS / CINZA", "un"],
  [275, "AR CONDICIONADO / LG / ARTCOLL / DUAL INVERTER 22.000 BTUS /  CINZA", "un"],
  [275, "AR CONDICIONADO", "un"],
  [362, "TELEVISOR / LG / SMART TV LED 70\" ", "un"],
  [362, "TELEVISOR / LG / SMART TV LED 70\" ", "un"],
  [362, "TELEVISOR", "un"],
  [183, "FERRAMENTAS ELÉTRICAS | LINHA BATERIA (ACESSÓRIOS) - KIT DE PONTAS PHILIPS / FENDA (10 PEÇAS)", "un"],
  [406, "MOBILIA SOLTA - CADEIRA", V],
  ["ABC", "CÓDIGO ERRADO", "un"],
  [V, "SEM CÓDIGO", "un"],
  [410, V, "un"],
];
const r = lerRelatorioDeInsumos(relatorio(DADOS));
conf("o relatório do Sienge passa no modelo", [r.ok, r.erros], [true, []]);
conf("a tabela vem do topo", r.tabela, { codigo: "1", nome: "TABELA WS BUILDING", texto: "1 - TABELA WS BUILDING" });
conf("a data vem do rodapé", r.geradoEm, "2026-09-21T21:12:13-03:00");

const semCabecalho = lerRelatorioDeInsumos(relatorio(DADOS, { cabecalho: ["Cód", "Texto", V, V, V, V, "Un"] }));
conf("sem o cabeçalho Código/Descrição/Unidade, recusa", [semCabecalho.ok, semCabecalho.erros.length], [false, 1]);
const cabecalhoSemAcento = lerRelatorioDeInsumos(relatorio(DADOS, { cabecalho: ["CODIGO", "DESCRICAO", V, V, V, V, "UNIDADE"] }));
conf("o cabeçalho é achado pelo nome, sem acento e em caixa alta também", cabecalhoSemAcento.ok, true);
const semTabela = lerRelatorioDeInsumos(relatorio(DADOS, { tabela: null }));
conf("sem a linha Tabela, recusa", [semTabela.ok, semTabela.erros[0]], [false, 'A linha "Tabela" do topo do relatório não foi encontrada.']);
const tabelaSemNumero = lerRelatorioDeInsumos(relatorio(DADOS, { tabela: "TABELA WS BUILDING" }));
conf("tabela fora do formato número - nome, recusa", tabelaSemNumero.ok, false);
const semRodape = lerRelatorioDeInsumos(relatorio(DADOS, { rodape: null }));
conf("sem o rodapé do Sienge, recusa", [semRodape.ok, semRodape.erros[0]], [false, "O rodapé com a data de geração e a marca do Sienge não foi encontrado."]);
const rodapeSemMarca = lerRelatorioDeInsumos(relatorio(DADOS, { rodape: ["21/09/2026 - 21:12:13", V, V, V, "OUTRO SISTEMA", V, V] }));
conf("rodapé sem a marca do Sienge, recusa", rodapeSemMarca.ok, false);
conf("planilha vazia não passa", lerRelatorioDeInsumos([]).ok, false);

// ---------- as linhas ----------
conf("contagem das linhas de dados", r.resumo.linhas, DADOS.length);
conf("RN-089 · vb fica de fora, com os códigos contados", [r.resumo.vb, r.resumo.vbCodigos], [3, 2]);
conf("linha incompleta fica de fora, com o número da linha do Excel e o motivo",
  r.listas.fora.map((f) => [f.linhaExcel, f.motivo]),
  [[19, "sem unidade"], [20, "código não é um número"], [21, "sem código"], [22, "sem descrição"]]);
conf("repetida literal é juntada e diz com qual linha", r.listas.repetidas.map((x) => [x.linhaExcel, x.igualALinha]), [[16, 15]]);
conf("o texto fica exatamente como veio, espaço no fim inclusive",
  r.registros.some((x) => x.descricao === "TELEVISOR / LG / SMART TV LED 70\" "), true);
conf("espaço a mais no meio não é repetida: entra como outro registro",
  r.registros.filter((x) => x.codigo === "275").length, 3);
conf("... e vira aviso de par parecido", r.listas.pares.map((p) => [p.codigo, p.linhas.map((l) => l.linhaExcel)]), [["275", [12, 13]]]);
conf("nome com ' / ' dentro entra inteiro", r.registros.some((x) => x.codigo === "183" && x.descricao.includes("PHILIPS / FENDA")), true);
conf("entram", [r.resumo.entram, r.resumo.codigos], [6, 3]);
conf("o código vira texto", typeof r.registros[0].codigo, "string");

// ---------- o plano ----------
const IMPORTADO = (id, codigo, descricao, unidade, extra = {}) => ({
  id, codigo, descricao, unidade, ativo: true, origem: "sienge",
  sienge_codigo: codigo, sienge_descricao: descricao, sienge_unidade: unidade, ...extra,
});
const NA_TELA = (id, codigo, descricao, unidade) => ({
  id, codigo, descricao, unidade, ativo: true, origem: "tela", sienge_codigo: null, sienge_descricao: null, sienge_unidade: null,
});
const REG = (codigo, descricao, unidade = "un") => ({ codigo, descricao, unidade });

const primeira = planejarImportacao({ registros: r.registros, atuais: [], itensEnviados: [] });
conf("primeira importação: tudo entra", [primeira.inserir.length, primeira.atualizar.length, primeira.apagar.length], [6, 0, 0]);

const igual = planejarImportacao({ registros: [REG("275", "AR CONDICIONADO")], atuais: [IMPORTADO(1, "275", "AR CONDICIONADO", "un")], itensEnviados: [] });
conf("reimportar igual não mexe em nada", [igual.inserir.length, igual.atualizar.length, igual.semMudanca], [0, 0, 1]);

const unidadeNova = planejarImportacao({ registros: [REG("275", "AR CONDICIONADO", "pc")], atuais: [IMPORTADO(1, "275", "AR CONDICIONADO", "un")], itensEnviados: [] });
conf("unidade mudou no Sienge (sem edição na tela): atualiza", unidadeNova.atualizar.map((a) => [a.id, a.unidade, a.sienge_unidade]), [[1, "pc", "pc"]]);

const voltou = planejarImportacao({ registros: [REG("275", "AR CONDICIONADO")], atuais: [IMPORTADO(1, "275", "AR CONDICIONADO", "un", { ativo: false })], itensEnviados: [] });
conf("o que veio no relatório volta a Ativo = Sim", [voltou.atualizar.map((a) => a.ativo), voltou.reativados], [[true], 1]);

const EDITADO = IMPORTADO(7, "275", "AR CONDICIONADO (CORRIGIDO)", "un", { sienge_descricao: "AR CONDICIONADO" });
conf("registro editado na tela é reconhecido", editadoNaTela(EDITADO), true);
conf("registro criado na tela não conta como editado", editadoNaTela(NA_TELA(8, "1", "X", "un")), false);
const conflito = planejarImportacao({ registros: [REG("275", "AR CONDICIONADO")], atuais: [EDITADO], itensEnviados: [] });
conf("editado na tela e diferente do relatório: conflito sem escolha, nada gravado",
  [conflito.conflitos.length, conflito.conflitosSemEscolha, conflito.atualizar.length, conflito.inserir.length], [1, 1, 0, 0]);
const usaRelatorio = planejarImportacao({ registros: [REG("275", "AR CONDICIONADO")], atuais: [EDITADO], itensEnviados: [], conflitos: { 7: "relatorio" } });
conf("escolha 'relatório': volta ao texto do Sienge", usaRelatorio.atualizar.map((a) => a.descricao), ["AR CONDICIONADO"]);
const mantemEdicao = planejarImportacao({ registros: [REG("275", "AR CONDICIONADO")], atuais: [EDITADO], itensEnviados: [], conflitos: { 7: "edicao" } });
conf("escolha 'edição': fica o texto da tela, ativo volta a Sim",
  mantemEdicao.atualizar.map((a) => [a.descricao, a.sienge_descricao, a.ativo]), [["AR CONDICIONADO (CORRIGIDO)", "AR CONDICIONADO", true]]);
const ocupado = planejarImportacao({
  registros: [REG("275", "AR CONDICIONADO")],
  atuais: [EDITADO, NA_TELA(9, "275", "AR CONDICIONADO", "un")],
  itensEnviados: [], conflitos: { 7: "relatorio" },
});
conf("texto do relatório já usado por outro registro: 'relatório' não dá, fica a edição",
  [ocupado.conflitos[0].podeUsarRelatorio, ocupado.conflitos[0].escolha, ocupado.atualizar[0].descricao], [false, "edicao", "AR CONDICIONADO (CORRIGIDO)"]);

const manual = planejarImportacao({ registros: [REG("999", "INSUMO FEITO NA TELA")], atuais: [NA_TELA(3, "999", "INSUMO FEITO NA TELA", "un")], itensEnviados: [] });
conf("criado na tela com o mesmo texto: intocado, a linha do relatório fica de fora",
  [manual.inserir.length, manual.atualizar.length, manual.jaExistem.map((j) => j.id)], [0, 0, [3]]);

const EM_USO = { codigo: "406", texto: "MOBILIA SOLTA - CADEIRA / TOK STOK / CADEIRA EIFFEL BRANCA", obraCodigo: "2450", solicitacaoId: 23488, enviadoEm: null };
const atuaisParaApagar = [
  IMPORTADO(10, "406", "MOBILIA SOLTA - CADEIRA / TOK STOK / CADEIRA EIFFEL BRANCA", "un"),
  IMPORTADO(11, "406", "MOBILIA SOLTA - CADEIRA / ETEL / PAULISTANO", "un"),
  IMPORTADO(12, "275", "AR CONDICIONADO", "un"),
  NA_TELA(13, "777", "SÓ NA TELA", "un"),
];
const apagar = planejarImportacao({ registros: [REG("275", "AR CONDICIONADO")], atuais: atuaisParaApagar, itensEnviados: [EM_USO], caminho: "apagar" });
conf("caminho 'apagar': sai o que veio do Sienge e não veio agora", apagar.apagar.map((a) => a.id), [11]);
conf("RN-087 · o que foi pedido ao Sienge fica, e diz onde", apagar.ficamEmUso.map((a) => [a.id, a.usos[0].solicitacaoId]), [[10, 23488]]);
conf("o criado na tela não sai nem pela importação", apagar.apagar.concat(apagar.ficamEmUso).some((a) => a.id === 13), false);
conf("quantos não vieram (só os do Sienge)", apagar.naoVieram, 2);
const manter = planejarImportacao({ registros: [REG("275", "AR CONDICIONADO")], atuais: atuaisParaApagar, itensEnviados: [EM_USO], caminho: "manter" });
conf("caminho 'manter': nada sai", [manter.apagar.length, manter.ficamEmUso.length, manter.naoVieram], [0, 0, 2]);
conf("na prévia (sem caminho), a lista de saída vale para o 'apagar'",
  planejarImportacao({ registros: [], atuais: atuaisParaApagar, itensEnviados: [] }).apagar.length, 3);

// ---------- o corte da prévia ----------
conf("a lista da prévia é cortada, com o total à parte", cortar([1, 2, 3], 2), { itens: [1, 2], total: 3 });

console.log(falhas === 0 ? "\nOK — leitura e plano do Cadastro de Insumos" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
