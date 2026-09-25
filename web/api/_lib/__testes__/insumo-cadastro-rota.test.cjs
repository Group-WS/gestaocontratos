/* A rota do Cadastro de Insumos (ADR-008), do envio do relatório ao fim.
 *
 * Roda com: node web/api/_lib/__testes__/insumo-cadastro-rota.test.cjs
 *
 * O Supabase aqui é de mentira, mas guarda estado: tabelas em memória, as
 * funções de gravação (`insumo_cadastro_gravar`, `insumo_cadastro_apagar`,
 * `insumo_itens_pedidos`) e o balde. O que se confere é o FLUXO que a rota
 * orquestra — as policies e os gatilhos de verdade são dos testes pgTAP
 * (supabase/tests/17-insumo-cadastro.sql).
 *
 * O relatório é montado no layout do Sienge (topo com "Tabela", cabeçalho
 * na linha 8, rodapé com data e "SIENGE / STARIAN").
 */

const express = require("express");
const path = require("node:path");
const XLSX = require("xlsx");
const { rotasDeInsumoCadastro } = require(path.join(__dirname, "..", "rotas", "insumoCadastro.js"));

/* ---------- o Supabase de mentira, com estado ---------- */

const banco = {
  insumo_cadastro: [],
  insumo_cadastro_importacao: [],
  insumo_tabela_ativa: [{ id: true, codigo: "1", nome: "TABELA WS BUILDING", atualizado_em: null, atualizado_por: null }],
  insumo_cadastro_historico: [],
  // A base de precos: uma linha por (codigo, descricao, unidade).
  insumo_preco: [{ id: 1, codigo: "900", descricao: "A" }, { id: 2, codigo: "900", descricao: "B" }, { id: 3, codigo: "77", descricao: "C" }],
};
const balde = new Map();
const pedidos = []; // itens de solicitações enviadas: { codigo, texto, status, obra_codigo, solicitacao_id, enviado_em }
let proximoId = 1;
let falharGravacoes = 0;

function executar(tabela, q) {
  let linhas = banco[tabela];
  const casa = (l) => q.filtros.every(([op, c, v]) =>
    op === "eq" ? l[c] === v : op === "in" ? v.includes(l[c]) : op === "notnull" ? l[c] !== null && l[c] !== undefined : true);
  if (q.op === "insert") {
    const novas = [];
    for (const nova of [].concat(q.linhas)) {
      if (tabela === "insumo_cadastro" && linhas.some((l) => l.codigo === nova.codigo && l.descricao === nova.descricao)) {
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      const linha = { id: proximoId++, ativo: true, criado_em: new Date(Date.now() + proximoId).toISOString(),
        status: "enviado", gravadas: 0, apagados: 0, resumo: null, arquivo_caminho: null, conflitos: {},
        sienge_codigo: null, sienge_descricao: null, sienge_unidade: null, ...nova };
      linhas.push(linha);
      novas.push(linha);
    }
    return { data: novas, error: null };
  }
  const alvo = linhas.filter(casa);
  if (q.op === "update") {
    if (tabela === "insumo_cadastro" && (q.campos.codigo || q.campos.descricao)) {
      for (const l of alvo) {
        const final = { ...l, ...q.campos };
        if (linhas.some((o) => o.id !== l.id && o.codigo === final.codigo && o.descricao === final.descricao)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
      }
    }
    alvo.forEach((l) => Object.assign(l, q.campos));
    return { data: alvo, error: null };
  }
  if (q.op === "delete") {
    banco[tabela] = linhas.filter((l) => !alvo.includes(l));
    return { data: alvo, error: null };
  }
  let resultado = [...alvo];
  for (const [c, asc] of [...q.ordem].reverse()) {
    resultado.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
  }
  const total = resultado.length;
  if (q.faixa) resultado = resultado.slice(q.faixa[0], q.faixa[1] + 1);
  return { data: resultado, error: null, count: total };
}

function consulta(tabela) {
  const q = { op: "select", filtros: [], ordem: [], faixa: null };
  const fim = (unico) => {
    const r = executar(tabela, q);
    if (r.error) return Promise.resolve(r);
    if (unico) return Promise.resolve({ data: r.data[0] ?? null, error: null });
    return Promise.resolve(r);
  };
  const b = {
    select: () => b,
    insert: (linhas) => { q.op = "insert"; q.linhas = linhas; return b; },
    update: (campos) => { q.op = "update"; q.campos = campos; return b; },
    delete: () => { q.op = "delete"; return b; },
    eq: (c, v) => { q.filtros.push(["eq", c, v]); return b; },
    in: (c, v) => { q.filtros.push(["in", c, v]); return b; },
    not: (c) => { q.filtros.push(["notnull", c]); return b; },
    or: () => b,
    order: (c, o = {}) => { q.ordem.push([c === "codigo_num" ? "codigo" : c, o.ascending !== false]); return b; },
    range: (a, z) => { q.faixa = [a, z]; return b; },
    maybeSingle: () => fim(true),
    single: () => fim(true),
    then: (ok, erro) => fim(false).then(ok, erro),
  };
  return b;
}

const emUso = (l) => pedidos.some((p) => ["concluido", "parcial"].includes(p.status) && p.codigo === l.codigo && p.texto === l.descricao);

const rpcs = {
  insumo_cadastro_unidades: () => [...new Set(banco.insumo_cadastro.map((l) => l.unidade))].sort(),
  insumo_itens_pedidos: ({ p_codigo } = {}) => pedidos.filter((p) => !p_codigo || p.codigo === p_codigo),
  insumo_cadastro_gravar: ({ p_importacao, p_inserir, p_atualizar }) => {
    if (falharGravacoes > 0) { falharGravacoes -= 1; throw { code: "57014", message: "canceling statement" }; }
    let n = 0;
    for (const x of p_inserir) {
      if (banco.insumo_cadastro.some((l) => l.codigo === x.codigo && l.descricao === x.descricao)) continue;
      banco.insumo_cadastro.push({ id: proximoId++, ...x, ativo: true, origem: "sienge",
        sienge_codigo: x.codigo, sienge_descricao: x.descricao, sienge_unidade: x.unidade });
      n += 1;
    }
    for (const x of p_atualizar) {
      const l = banco.insumo_cadastro.find((i) => i.id === x.id && i.origem === "sienge");
      if (l) { Object.assign(l, x); n += 1; }
    }
    const imp = banco.insumo_cadastro_importacao.find((i) => i.id === p_importacao);
    imp.gravadas += n;
    return n;
  },
  insumo_cadastro_apagar: ({ p_importacao, p_ids }) => {
    const sai = banco.insumo_cadastro.filter((l) => p_ids.includes(l.id) && l.origem === "sienge" && !emUso(l));
    banco.insumo_cadastro = banco.insumo_cadastro.filter((l) => !sai.includes(l));
    banco.insumo_cadastro_importacao.find((i) => i.id === p_importacao).apagados += sai.length;
    return sai.length;
  },
};

const supabase = {
  from: consulta,
  rpc: async (nome, args) => {
    try { return { data: rpcs[nome](args || {}), error: null }; } catch (e) { return { data: null, error: e }; }
  },
  storage: {
    from: () => ({
      createSignedUploadUrl: async (caminho) => ({ data: { token: `t-${caminho}` }, error: null }),
      download: async (caminho) => (balde.has(caminho)
        ? { data: { arrayBuffer: async () => balde.get(caminho) }, error: null }
        : { data: null, error: { message: "Object not found" } }),
      remove: async (caminhos) => { caminhos.forEach((c) => balde.delete(c)); return { data: null, error: null }; },
    }),
  },
};

/* ---------- o app, com a portaria já vencida ---------- */

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, _res, proximo) => {
  req.usuario = { id: "u1", email: "admin@tkws.com.br" };
  req.pessoa = { perfil: req.headers["x-perfil"] || "admin", ativo: true };
  req.supabase = supabase;
  proximo();
});
app.use(rotasDeInsumoCadastro);

/* ---------- o relatório do Sienge ---------- */

const V = null;
function relatorio(dados, { tabela = "1 - TABELA WS BUILDING", cabecalho = ["Código", "Descrição", V, V, V, V, "Unidade"] } = {}) {
  const linhas = [
    [V, V, V, V, V, V, V], [V, V, "Insumos", V, V, V, V], [V, V, V, V, V, V, V], [V, V, V, V, V, V, V],
    ["Tabela", V, V, tabela, V, V, V], ["BDI", V, V, "Não aplicar", V, "Encargos sociais", V], [V, V, V, V, V, V, V],
    cabecalho,
    ...dados.map(([c, d, u]) => [c, d, V, V, V, V, u]),
    [V, V, V, V, V, V, V],
    ["21/09/2026 - 21:12:13", V, V, V, "SIENGE / STARIAN", V, V],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), "Relatório");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/* ---------- as conferências ---------- */

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(66)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};

const servidor = app.listen(0, async () => {
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const pedir = async (metodo, caminho, corpo, perfil) => {
    const headers = {};
    if (corpo !== undefined) headers["Content-Type"] = "application/json";
    if (perfil) headers["x-perfil"] = perfil;
    const r = await fetch(base + caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };
  /* Envia um relatório como a tela faz: registra, "sobe" para o balde e pede a prévia. */
  const enviar = async (dados, opcoes) => {
    const reg = await pedir("POST", "/api/insumo-cadastro/importacoes", { nome: "cadastro de insumos ativos.xlsx" });
    balde.set(reg.corpo.assinatura.caminho, relatorio(dados, opcoes));
    const previa = await pedir("POST", `/api/insumo-cadastro/importacoes/${reg.corpo.id}/previa`);
    return { id: reg.corpo.id, assinatura: reg.corpo.assinatura, previa };
  };
  const importacao = (id) => banco.insumo_cadastro_importacao.find((i) => i.id === id);
  const insumo = (descricao) => banco.insumo_cadastro.find((l) => l.descricao === descricao);

  try {
    console.log("\n— RN-086: quem mantém o cadastro —");
    conf("o time lê a lista", (await pedir("GET", "/api/insumo-cadastro", undefined, "gc")).status, 200);
    const gcCria = await pedir("POST", "/api/insumo-cadastro", { codigo: "1", descricao: "X", unidade: "un" }, "gc");
    conf("quem não é admin não cria", [gcCria.status, gcCria.corpo.error.startsWith("RN-086")], [403, true]);
    conf("nem importa", (await pedir("POST", "/api/insumo-cadastro/importacoes", { nome: "a.xlsx" }, "geral")).status, 403);
    conf("nem troca a tabela ativa", (await pedir("PUT", "/api/insumo-cadastro/tabela-ativa", { codigo: "2", nome: "OUTRA" }, "mehoo")).status, 403);

    console.log("\n— o envio —");
    conf("só .xlsx", (await pedir("POST", "/api/insumo-cadastro/importacoes", { nome: "relatorio.pdf" })).status, 400);
    const primeiro = await enviar([
      [1, "IPTU", "vb"],
      [275, "AR CONDICIONADO / LG / SPLIT", "un"],
      [275, "AR CONDICIONADO", "un"],
      [406, "MOBILIA SOLTA - CADEIRA / EIFFEL", "un"],
      [406, "MOBILIA SOLTA - CADEIRA / EIFFEL", "un"],
      [406, "MOBILIA SOLTA - CADEIRA", "un"],
      [500, "LIVRE", "un"],
    ]);
    conf("o caminho no balde é gerado pelo servidor, nunca o nome original",
      primeiro.assinatura.caminho, `importacoes/${primeiro.id}.xlsx`);

    console.log("\n— a prévia —");
    conf("a prévia lê o arquivo do balde", primeiro.previa.status, 200);
    const r1 = primeiro.previa.corpo.resumo;
    conf("números: vb fora, repetida juntada, 5 entram", [r1.vb, r1.repetidas, r1.entram, r1.inserir], [1, 1, 5, 5]);
    conf("a tabela confere com a ativa (RN-088)", r1.tabelaConfere, "confere");
    conf("a data do relatório vem do rodapé", r1.geradoEm, "2026-09-21T21:12:13-03:00");
    conf("a prévia não grava nada", banco.insumo_cadastro.length, 0);
    conf("a importação fica em prévia, com a tabela", [importacao(primeiro.id).status, importacao(primeiro.id).tabela_codigo], ["previa", "1"]);

    console.log("\n— gravar —");
    const g1 = await pedir("POST", `/api/insumo-cadastro/importacoes/${primeiro.id}/aplicar`, { caminho: "manter" });
    conf("grava e conclui", [g1.status, g1.corpo.status], [200, "concluida"]);
    conf("o cadastro tem os 5", banco.insumo_cadastro.length, 5);
    conf("a importação conta o que gravou", [importacao(primeiro.id).status, importacao(primeiro.id).gravadas], ["concluida", 5]);
    conf("importação concluída não grava de novo", (await pedir("POST", `/api/insumo-cadastro/importacoes/${primeiro.id}/aplicar`, { caminho: "manter" })).status, 409);

    const lista = await pedir("GET", "/api/insumo-cadastro?passo=20");
    conf("a lista traz os registros e o total", [lista.corpo.itens.length, lista.corpo.total], [5, 5]);
    conf("passo fora de 20/50/100 é recusado", (await pedir("GET", "/api/insumo-cadastro?passo=7")).status, 400);

    console.log("\n— o CRUD —");
    const criado = await pedir("POST", "/api/insumo-cadastro", { codigo: "900", descricao: "  FEITO NA TELA  ", unidade: "un" });
    const comDetalhes = await pedir("GET", "/api/insumo-cadastro");
    conf("a lista diz quantos detalhes o insumo tem na base de preços", comDetalhes.corpo.itens.find((i) => i.codigo === "900")?.detalhes, 2);
    conf("o admin cria na tela (pontas do texto digitado saem)", [criado.status, criado.corpo.descricao, criado.corpo.origem], [200, "FEITO NA TELA", "tela"]);
    conf("mesmo código e descrição de novo é 409",
      (await pedir("POST", "/api/insumo-cadastro", { codigo: "900", descricao: "FEITO NA TELA", unidade: "un" })).status, 409);
    conf("código que não é número não passa", (await pedir("POST", "/api/insumo-cadastro", { codigo: "A1", descricao: "X", unidade: "un" })).status, 400);
    const ar = insumo("AR CONDICIONADO");
    const editado = await pedir("PATCH", `/api/insumo-cadastro/${ar.id}`, { descricao: "AR CONDICIONADO (CORRIGIDO)" });
    conf("editar um que veio do Sienge marca como editado", [editado.status, editado.corpo.editado], [200, true]);
    conf("edição sem campo nenhum é recusada", (await pedir("PATCH", `/api/insumo-cadastro/${ar.id}`, {})).status, 400);

    pedidos.push({ codigo: "406", texto: "MOBILIA SOLTA - CADEIRA / EIFFEL", status: "concluido", obra_codigo: "2450", solicitacao_id: 23488, enviado_em: null });
    pedidos.push({ codigo: "500", texto: "LIVRE", status: "falhou", obra_codigo: "2450", solicitacao_id: null, enviado_em: null });
    const eiffel = insumo("MOBILIA SOLTA - CADEIRA / EIFFEL");
    const usos = await pedir("GET", `/api/insumo-cadastro/${eiffel.id}/usos`);
    conf("RN-087 · a tela descobre onde o insumo foi pedido", usos.corpo.usos.map((u) => u.solicitacaoId), [23488]);
    const apagarEmUso = await pedir("DELETE", `/api/insumo-cadastro/${eiffel.id}`);
    conf("RN-087 · apagar o que foi pedido é bloqueado, e diz onde", [apagarEmUso.status, apagarEmUso.corpo.usos.length], [409, 1]);
    conf("... e ele continua lá", !!insumo("MOBILIA SOLTA - CADEIRA / EIFFEL"), true);

    console.log("\n— reimportar —");
    // O relatório novo: sem o LIVRE e sem a EIFFEL (pedida ao Sienge), e o AR volta com o texto do Sienge.
    const segundo = await enviar([
      [275, "AR CONDICIONADO / LG / SPLIT", "un"],
      [275, "AR CONDICIONADO", "un"],
      [406, "MOBILIA SOLTA - CADEIRA", "un"],
      [700, "NOVO", "m2"],
    ]);
    const r2 = segundo.previa.corpo.resumo;
    conf("prévia: 1 novo, 1 conflito, 1 sai, 1 fica por estar em uso",
      [r2.inserir, r2.conflitos, r2.sairiam, r2.ficamEmUso], [1, 1, 1, 1]);
    conf("o conflito mostra a edição e o relatório",
      segundo.previa.corpo.listas.conflitos.itens.map((c) => [c.atual.descricao, c.relatorio.descricao]),
      [["AR CONDICIONADO (CORRIGIDO)", "AR CONDICIONADO"]]);
    const semEscolha = await pedir("POST", `/api/insumo-cadastro/importacoes/${segundo.id}/aplicar`, { caminho: "apagar" });
    conf("sem escolher o conflito, não grava", [semEscolha.status, semEscolha.corpo.code], [422, "CONFLITOS"]);
    conf("... e nada mudou", !!insumo("NOVO"), false);
    const g2 = await pedir("POST", `/api/insumo-cadastro/importacoes/${segundo.id}/aplicar`,
      { caminho: "apagar", conflitos: { [ar.id]: "edicao" } });
    conf("com a escolha, grava", [g2.status, g2.corpo.status], [200, "concluida"]);
    conf("o novo entrou", !!insumo("NOVO"), true);
    conf("a edição da tela ficou", !!insumo("AR CONDICIONADO (CORRIGIDO)"), true);
    conf("caminho 'apagar': o que não veio saiu", !!insumo("LIVRE"), false);
    conf("RN-087 · o pedido ao Sienge ficou", !!insumo("MOBILIA SOLTA - CADEIRA / EIFFEL"), true);
    conf("o criado na tela ficou intocado", !!insumo("FEITO NA TELA"), true);
    conf("o resultado conta o que ficou em uso", g2.corpo.resumo.resultado.ficaramEmUso, 1);

    console.log("\n— RN-088: a tabela ativa —");
    const outra = await enviar([[275, "AR CONDICIONADO", "un"]], { tabela: "2 - TABELA OUTRA" });
    conf("relatório de outra tabela é recusado na prévia", [outra.previa.status, outra.previa.corpo.code], [422, "RN-088"]);
    conf("... e a importação fica recusada", importacao(outra.id).status, "recusado");
    const renomeada = await enviar([[275, "AR CONDICIONADO", "un"]], { tabela: "1 - TABELA WS BUILDING 2026" });
    conf("mesmo código, nome novo: a prévia avisa", renomeada.previa.corpo.resumo.tabelaConfere, "so_o_nome_mudou");
    conf("sem confirmar o nome, não grava",
      (await pedir("POST", `/api/insumo-cadastro/importacoes/${renomeada.id}/aplicar`, { caminho: "manter" })).status, 422);
    // O AR foi editado na tela: continua sendo conflito, e a escolha vai junto.
    conf("confirmando, grava",
      (await pedir("POST", `/api/insumo-cadastro/importacoes/${renomeada.id}/aplicar`,
        { caminho: "manter", confirmouNome: true, conflitos: { [ar.id]: "edicao" } })).corpo.status, "concluida");
    const trocaTabela = await pedir("PUT", "/api/insumo-cadastro/tabela-ativa", { codigo: "2", nome: "TABELA OUTRA" });
    conf("o admin troca a tabela ativa", [trocaTabela.status, banco.insumo_tabela_ativa[0].codigo], [200, "2"]);
    await pedir("PUT", "/api/insumo-cadastro/tabela-ativa", { codigo: "1", nome: "TABELA WS BUILDING" });

    console.log("\n— o modelo —");
    const semCabecalho = await enviar([[275, "AR", "un"]], { cabecalho: ["Cód", "Texto", V, V, V, V, "Un"] });
    conf("arquivo fora do modelo é recusado com o motivo",
      [semCabecalho.previa.status, semCabecalho.previa.corpo.erros.length], [422, 1]);
    const reg = await pedir("POST", "/api/insumo-cadastro/importacoes", { nome: "vazio.xlsx" });
    balde.set(reg.corpo.assinatura.caminho, Buffer.from("isto não é um xlsx"));
    const lixo = await pedir("POST", `/api/insumo-cadastro/importacoes/${reg.corpo.id}/previa`);
    conf("arquivo que não é planilha é recusado", lixo.status, 422);

    // Importações antigas, cada uma com o arquivo no balde: a próxima conclusão poda.
    for (let i = 1; i <= 14; i++) {
      const caminho = `importacoes/antiga-${i}.xlsx`;
      balde.set(caminho, Buffer.from("antigo"));
      banco.insumo_cadastro_importacao.push({ id: proximoId++, arquivo_nome: `antiga-${i}.xlsx`, arquivo_caminho: caminho,
        criado_em: `2026-01-${String(i).padStart(2, "0")}T12:00:00Z`, status: "concluida", gravadas: 0, apagados: 0, conflitos: {} });
    }
    const registrosAntes = banco.insumo_cadastro_importacao.length;

    console.log("\n— falha no meio e continuar —");
    const terceiro = await enviar([[275, "AR CONDICIONADO", "un"], [800, "OUTRO NOVO", "un"]]);
    falharGravacoes = 1;
    const parou = await pedir("POST", `/api/insumo-cadastro/importacoes/${terceiro.id}/aplicar`, { caminho: "manter", conflitos: { [ar.id]: "edicao" } });
    conf("a gravação que falha deixa a importação incompleta", [parou.status, parou.corpo.code, importacao(terceiro.id).status], [500, "INCOMPLETA", "incompleta"]);
    const continuar = await pedir("POST", `/api/insumo-cadastro/importacoes/${terceiro.id}/aplicar`, { caminho: "manter", conflitos: { [ar.id]: "edicao" } });
    conf("continuar termina de onde parou", [continuar.status, continuar.corpo.status, !!insumo("OUTRO NOVO")], [200, "concluida", true]);

    console.log("\n— a guarda dos arquivos —");
    const comArquivo = banco.insumo_cadastro_importacao.filter((i) => i.arquivo_caminho).length;
    conf("ficam só os 12 últimos arquivos", comArquivo, 12);
    conf("os mais antigos saem do balde", balde.has("importacoes/antiga-1.xlsx"), false);
    // +1: o terceiro relatório, enviado depois da contagem.
    conf("... e o registro de todas continua", banco.insumo_cadastro_importacao.length, registrosAntes + 1);

    console.log("\n— apagar o que não está em uso —");
    const novo = insumo("NOVO");
    conf("apagar um insumo livre", (await pedir("DELETE", `/api/insumo-cadastro/${novo.id}`)).status, 200);
    conf("id que não existe é 404", (await pedir("DELETE", "/api/insumo-cadastro/999999")).status, 404);
    conf("id que não é número não chega ao banco", (await pedir("DELETE", "/api/insumo-cadastro/abc")).status, 400);
  } catch (e) {
    falhas++;
    console.log("FALHOU com exceção:", e);
  } finally {
    servidor.close();
    console.log(falhas === 0 ? "\nOK — a rota do Cadastro de Insumos" : `\n${falhas} falha(s)`);
    process.exit(falhas === 0 ? 0 : 1);
  }
});
