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
};

function consulta(tabela) {
  const q = { filtros: {} };
  q.select = (colunas) => { q.colunas = colunas; return q; };
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
      return Promise.resolve({ data: null, error: null });
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
    return Promise.resolve({ data: RESPOSTAS[tabela] || [], error: null }).then(ok, erro);
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

  console.log("\n— o que o select pede —");
  const selects = comandos.filter((c) => c.op === "select" || (c.op === "insert" && c.colunas));
  conf("nenhum select(\"*\") (SQL-32)", selects.some((c) => c.colunas === "*"), false);
  conf("toda consulta lista as colunas", selects.every((c) => typeof c.colunas === "string" && c.colunas.length > 0), true);

  servidor.close();
  console.log(falhas ? `\n${falhas} falharam` : "\ntodos passaram");
  process.exit(falhas ? 1 : 0);
});
