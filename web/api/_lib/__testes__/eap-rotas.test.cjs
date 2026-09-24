/* As rotas da EAP fazem o que o navegador fazia — nem mais, nem menos.
 *
 * Roda com: node web/api/_lib/__testes__/eap-rotas.test.cjs
 *
 * Ate' 22/09/2026 estes comandos saiam do navegador (web/src/lib/eap.js e
 * web/src/lib/eapApropriacao.js falavam com o Supabase direto, VH-02).
 * Mudou o caminho, nao o que acontece — e e' isso que este teste segura.
 *
 * Tres travas que eram do front e agora vivem so' no servidor:
 *
 *  1. A versao padrao e' DOIS updates em sequencia: desmarca todas, marca
 *     uma. Invertendo a ordem, o indice unico parcial da tabela recusa e a
 *     EAP fica sem padrao.
 *  2. O upsert do mapa tem `onConflict: "versao_id,verba_num"`. Sem isso,
 *     trocar a folha de uma verba ja' ligada vira erro de chave repetida.
 *  3. Quem importou e quem ligou a verba vem do LOGIN (SEG-13), nunca do
 *     corpo do pedido — que, alias, e' recusado se vier com campo a mais.
 *  4. O REGISTRO (23/09/2026): cada gesto vira uma linha em
 *     `sienge_eap_evento`, e o codigo que SAI e' lido antes de escrever —
 *     e' o que separa "ligou" de "trocou". Registrar nunca derruba o gesto.
 *
 * O Supabase aqui e' de mentira: o que se confere e' QUAL comando a rota
 * manda, com quais filtros e em que ordem. Banco de verdade e' assunto dos
 * testes pgTAP.
 */

const express = require("express");
const path = require("node:path");
const { rotasDeEap } = require(path.join(__dirname, "..", "rotas", "eap.js"));

/* ---------- o Supabase de mentira ---------- */

const comandos = [];

const RESPOSTAS = {
  eap_grupo: [{ num: "20", nome: "Climatização / Exaustão", apelidos: ["clima"], analisar: true, motivo_na: null }],
  sienge_eap_versao: [{ id: 1, nome: "EAP INICIAL", padrao: true }],
  sienge_eap_item: [{ codigo: "04.001.001.001", descricao: "Climatização [MAT]", nivel: 4, unidade: "vb", folha: true }],
  // A verba 21 aponta pra um codigo que a versao nova nao tem: e' a orfa.
  sienge_eap_mapa: [
    { verba_num: "20", codigo: "04.001.001.001" },
    { verba_num: "21", codigo: "99.999.999.999" },
  ],
  sienge_eap_evento: [],
};

/* A linha que o `.maybeSingle()` devolve por tabela: e' assim que a rota
   descobre o nome da versao e o codigo que a verba tinha ANTES. */
const SEM_PERMISSAO = { ativo: false };

const UNICOS = {
  eap_grupo: { num: "17", apelidos: ["paredeverde", "jardimvertical"] },
  sienge_eap_versao: { id: 77, nome: "EAP INICIAL", padrao: false },
  sienge_eap_mapa: { codigo: "04.000.000.000" },
};

function consulta(tabela) {
  const q = { filtros: {} };
  q.select = (colunas, opcoes) => { q.colunas = colunas; q.contagem = opcoes; return q; };
  q.maybeSingle = () => {
    comandos.push({ tabela, op: "select", colunas: q.colunas, filtros: { ...q.filtros }, unico: true });
    return Promise.resolve({ data: UNICOS[tabela] ?? null, error: null });
  };
  q.eq = (coluna, valor) => { q.filtros[coluna] = valor; return q; };
  q.order = () => q;
  q.single = () => {
    comandos.push({ tabela, op: "insert", linhas: q.linhas, colunas: q.colunas, unico: true });
    return Promise.resolve({ data: { id: 77 }, error: null });
  };
  q.insert = (linhas) => {
    q.linhas = linhas;
    const p = Promise.resolve({ data: null, error: null });
    // `.insert(...).select("id").single()` devolve a linha criada.
    p.select = q.select; p.single = q.single;
    if (!q.colunas) comandos.push({ tabela, op: "insert", linhas });
    return p;
  };
  q.upsert = (linha, opcoes) => {
    comandos.push({ tabela, op: "upsert", linha, opcoes });
    return Promise.resolve({ data: null, error: null });
  };
  q.update = (campos) => ({
    eq: (coluna, valor) => {
      comandos.push({ tabela, op: "update", campos, filtro: [coluna, valor] });
      const p = Promise.resolve({ data: null, error: null });
      // `.update(...).eq(...).select(...)` devolve as linhas gravadas; lista
      // vazia e' o RLS recusando em silencio.
      p.select = () => Promise.resolve({ data: SEM_PERMISSAO.ativo ? [] : [{ num: valor }], error: null });
      return p;
    },
  });
  q.delete = () => {
    const d = { filtros: {} };
    d.eq = (coluna, valor) => {
      d.filtros[coluna] = valor;
      const p = Promise.resolve({ data: null, error: null });
      p.eq = d.eq;
      comandos.push({ tabela, op: "delete", filtros: { ...d.filtros } });
      return p;
    };
    return d;
  };
  // Consulta sem `.single()`: e' aqui que o `await` cai.
  q.then = (ok, erro) => {
    comandos.push({ tabela, op: "select", colunas: q.colunas, filtros: { ...q.filtros } });
    const linhas = RESPOSTAS[tabela] || [];
    // `select(col, { count: "exact", head: true })` conta em vez de trazer.
    const resposta = q.contagem?.head ? { data: null, count: linhas.length, error: null } : { data: linhas, error: null };
    return Promise.resolve(resposta).then(ok, erro);
  };
  return q;
}

/* ---------- o app, com a portaria ja' vencida ---------- */

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, _res, proximo) => {
  // `exigirLogin` e `exigirMembro` param na porta quando o pedido ja' foi
  // conferido — e' assim que o mondayApp.js evita conferir duas vezes.
  req.usuario = { id: "u1", email: "quem@chamou.com.br" };
  req.pessoa = { perfil: "admin", ativo: true };
  req.supabase = { from: consulta };
  proximo();
});
app.use(rotasDeEap);

/* ---------- as conferencias ---------- */

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(58)} ${JSON.stringify(obtido)}${ok ? "" : ` esperava ${JSON.stringify(esperado)}`}`);
};

const servidor = app.listen(0, async () => {
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const pedir = async (metodo, caminho, corpo) => {
    const r = await fetch(base + caminho, {
      method: metodo,
      headers: corpo === undefined ? {} : { "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };
  const ultimo = (op, tabela) => [...comandos].reverse().find((c) => c.op === op && (!tabela || c.tabela === tabela));

  console.log("\n— leitura —");
  conf("os grupos da casa saem de eap_grupo", (await pedir("GET", "/api/eap/grupos")).status, 200);
  conf("so' os grupos ativos, e na ordem", ultimo("select", "eap_grupo").filtros, { ativo: true });
  conf("as versoes saem de sienge_eap_versao", (await pedir("GET", "/api/eap/versoes")).status, 200);

  const versao = await pedir("GET", "/api/eap/versoes/1");
  conf("uma versao devolve itens e mapa", [versao.status, versao.corpo.itens.length, versao.corpo.mapa.length], [200, 1, 2]);
  conf("id que nao e' numero nao chega ao banco", (await pedir("GET", "/api/eap/versoes/abc")).status, 400);

  console.log("\n— apelido novo de verba —");
  const ensinou = await pedir("PUT", "/api/eap/grupos/17/apelidos", { apelido: "paisagismo" });
  conf("o nome do grupo vira apelido da verba", [ensinou.status, ensinou.corpo.apelidos], [200, ["paredeverde", "jardimvertical", "paisagismo"]]);
  conf("grava so' na verba do caminho", ultimo("update", "eap_grupo").filtro, ["num", "17"]);
  const antesRepetido = comandos.length;
  conf("apelido que ja' existe nao grava de novo",
    [(await pedir("PUT", "/api/eap/grupos/17/apelidos", { apelido: "paredeverde" })).status, comandos.slice(antesRepetido).some((c) => c.op === "update")],
    [200, false]);
  conf("apelido fora da forma comprimida e' recusado", (await pedir("PUT", "/api/eap/grupos/17/apelidos", { apelido: "Paisagismo" })).status, 400);
  conf("verba que nao e' de dois digitos e' recusada", (await pedir("PUT", "/api/eap/grupos/abc/apelidos", { apelido: "paisagismo" })).status, 400);
  SEM_PERMISSAO.ativo = true;
  conf("o RLS recusando vira 403", (await pedir("PUT", "/api/eap/grupos/17/apelidos", { apelido: "jardim" })).status, 403);
  SEM_PERMISSAO.ativo = false;

  console.log("\n— importacao —");
  const nova = await pedir("POST", "/api/eap/versoes", {
    versao: { nome: "EAP INICIAL", unidadeId: 9, obraModelo: "15 - OBRA MODELO", versaoOrcamento: "3 - 15/04/2026", dataBase: "2026-04-15" },
  });
  conf("a versao nasce e devolve o id", [nova.status, nova.corpo], [200, { id: 77 }]);
  conf("quem importou vem do login, nao do pedido", ultimo("insert", "sienge_eap_versao").linhas.importado_por, "quem@chamou.com.br");
  conf("planilha sem unidade construtiva nao grava", (await pedir("POST", "/api/eap/versoes", { versao: { nome: "x", obraModelo: null, versaoOrcamento: null, dataBase: null } })).status, 400);

  const bloco = [{ codigo: "04", descricao: "ACABAMENTOS", nivel: 1, unidade: null, folha: false }];
  conf("um bloco de itens entra de uma vez", (await pedir("POST", "/api/eap/versoes/77/itens", { itens: bloco })).status, 200);
  conf("o item grava na versao do caminho", ultimo("insert", "sienge_eap_item").linhas[0].versao_id, 77);
  conf("bloco vazio e' recusado", (await pedir("POST", "/api/eap/versoes/77/itens", { itens: [] })).status, 400);

  const heranca = await pedir("POST", "/api/eap/versoes/77/herdar", { herdarDe: 1 });
  conf("herda o que ainda existe", ultimo("insert", "sienge_eap_mapa").linhas, [{ versao_id: 77, verba_num: "20", codigo: "04.001.001.001", definido_por: "quem@chamou.com.br" }]);
  conf("e devolve quem perdeu o par", [heranca.status, heranca.corpo], [200, { orfaos: [{ verba: "21", codigo: "99.999.999.999" }] }]);

  console.log("\n— a versao padrao —");
  const antes = comandos.length;
  const padrao = await pedir("PUT", "/api/eap/versoes/77/padrao");
  const updates = comandos.slice(antes).filter((c) => c.op === "update");
  conf("dois updates, desmarcar ANTES de marcar", [padrao.status, updates.map((u) => [u.campos.padrao, u.filtro[0]])],
    [200, [[false, "padrao"], [true, "id"]]]);

  console.log("\n— o mapa verba -> folha —");
  conf("ligar a verba responde", (await pedir("PUT", "/api/eap/mapa", { versaoId: 77, verbaNum: "20", codigo: "04.001.001.001" })).status, 200);
  conf("o upsert diz qual e' a chave", ultimo("upsert").opcoes, { onConflict: "versao_id,verba_num" });
  conf("quem ligou vem do login", ultimo("upsert").linha.definido_por, "quem@chamou.com.br");
  conf("desligar apaga so' aquela verba daquela versao",
    [(await pedir("PUT", "/api/eap/mapa", { versaoId: 77, verbaNum: "20", codigo: null })).status, ultimo("delete").filtros],
    [200, { versao_id: 77, verba_num: "20" }]);
  conf("verba que chega como numero vira texto",
    [(await pedir("PUT", "/api/eap/mapa", { versaoId: 77, verbaNum: 20, codigo: "04.001.001.001" })).status, ultimo("upsert").linha.verba_num],
    [200, "20"]);
  conf("campo a mais no corpo e' recusado (o e-mail nao entra por aqui)",
    (await pedir("PUT", "/api/eap/mapa", { versaoId: 77, verbaNum: "20", codigo: "04.001.001.001", por: "outro@x.com" })).status, 400);

  console.log("\n— o registro: quem mexeu —");
  const evento = (n = 1) => [...comandos].reverse().filter((c) => c.tabela === "sienge_eap_evento" && c.op === "insert")[n - 1];

  await pedir("PUT", "/api/eap/mapa", { versaoId: 77, verbaNum: "20", codigo: "04.001.001.002" });
  conf("trocar a folha guarda o codigo que saiu e o que entrou",
    [evento().linhas.acao, evento().linhas.codigo_anterior, evento().linhas.codigo],
    ["trocou", "04.000.000.000", "04.001.001.002"]);
  conf("quem mexeu vem do login, nunca do pedido", evento().linhas.autor, "quem@chamou.com.br");
  conf("reconfirmar a MESMA folha nao vira linha",
    (await pedir("PUT", "/api/eap/mapa", { versaoId: 77, verbaNum: "20", codigo: "04.000.000.000" }), evento().linhas.codigo),
    "04.001.001.002");
  await pedir("PUT", "/api/eap/mapa", { versaoId: 77, verbaNum: "20", codigo: null });
  conf("desligar guarda o que a verba apontava", [evento().linhas.acao, evento().linhas.codigo_anterior], ["desligou", "04.000.000.000"]);
  conf("de onde veio o gesto entra na linha",
    (await pedir("PUT", "/api/eap/mapa", { versaoId: 77, verbaNum: "20", codigo: "04.001.001.001", obraCodigo: "2195" }), evento().linhas.obra_codigo),
    "2195");
  await pedir("PUT", "/api/eap/versoes/77/padrao");
  conf("tornar padrao vira linha", evento().linhas.acao, "tornou_padrao");

  const registro = await pedir("POST", "/api/eap/versoes/77/registro", { nItens: 130, nFolhas: 40, herdadas: 34, orfaos: ["21"] });
  conf("a importacao fecha em UMA linha, com os numeros",
    [registro.status, evento().linhas.acao, evento().linhas.detalhe],
    [200, "importou", { nItens: 130, nFolhas: 40, herdadas: 34, orfaos: ["21"], herdouDe: null }]);

  const excluida = await pedir("DELETE", "/api/eap/versoes/77");
  conf("excluir versao responde e registra ANTES de apagar",
    [excluida.status, evento().linhas.acao, evento().linhas.versao_nome],
    [200, "excluiu", "EAP INICIAL"]);
  conf("o delete e' da versao pedida", ultimo("delete", "sienge_eap_versao").filtros, { id: 77 });

  // A padrao e' a EAP com que TODA solicitacao sai: apagar sem querer a de
  // baixo do pe' de quem esta enviando e' o pior jeito de descobrir isso.
  UNICOS.sienge_eap_versao = { id: 77, nome: "EAP INICIAL", padrao: true };
  conf("a versao PADRAO nao se exclui", (await pedir("DELETE", "/api/eap/versoes/77")).status, 409);
  UNICOS.sienge_eap_versao = { id: 77, nome: "EAP INICIAL", padrao: false };

  console.log("\n— o que o select pede —");
  const selects = comandos.filter((c) => c.op === "select" || (c.op === "insert" && c.colunas));
  conf("nenhum select(\"*\") (SQL-32)", selects.some((c) => c.colunas === "*"), false);
  conf("toda consulta lista as colunas", selects.every((c) => typeof c.colunas === "string" && c.colunas.length > 0), true);

  servidor.close();
  console.log(falhas ? `\n${falhas} falharam` : "\ntodos passaram");
  process.exit(falhas ? 1 : 0);
});
