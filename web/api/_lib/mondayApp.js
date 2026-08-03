/**
 * Backend do Confere — API do Monday.com + leitura de PDFs.
 * -----------------------------------------------------------
 * Fonte única, usada em dois lugares:
 *  - Produção (Vercel): web/api/[...path].js reexporta este app como
 *    função serverless — roda no mesmo domínio do frontend, sob /api/*.
 *  - Dev local: monday-proxy/server.js importa este mesmo arquivo e
 *    chama .listen() nele — é o que o proxy do Vite aponta em dev.
 *
 * Por que existe: o frontend roda no navegador, então qualquer token
 * ali fica visível pra quem inspecionar a página. Esse app guarda o
 * token do Monday como variável de ambiente (nunca no código) e expõe
 * só o que o Confere precisa.
 */

const express = require("express");
const cors = require("cors");

// Importa o miolo do pdf-parse em vez do index.js. O index tem um
// bloco "modo debug" que dispara quando `module.parent` é vazio: ele
// tenta ler um PDF de teste que não é publicado junto, e esse erro
// derruba o arquivo inteiro no carregamento. Localmente `module.parent`
// existe e o bloco dorme; no empacotamento da Vercel, não — daí todas
// as rotas quebravam, até as que não têm nada a ver com PDF.
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const app = express();
app.use(cors());
app.use(express.json());

const MONDAY_API_URL = "https://api.monday.com/v2";

function mondayToken() {
  return process.env.MONDAY_API_TOKEN;
}

// Cache em memória com TTL. A listagem de obras não muda a cada
// segundo — guardar a resposta por alguns segundos evita martelar a
// API do Monday (que tem orçamento de complexidade/rate-limit) e faz
// recarregar a página ficar instantâneo. Em serverless (Vercel), esse
// cache vale só enquanto a mesma instância da função estiver quente —
// não é garantido entre chamadas, mas ajuda quando acontece.
const CACHE_TTL_MS = 60_000;
const cache = new Map(); // chave -> { expira, data }

async function mondayQuery(query, variables = {}) {
  const token = mondayToken();
  if (!token) throw new Error("MONDAY_API_TOKEN não configurado no ambiente.");

  const chave = JSON.stringify({ query, variables });
  const hit = cache.get(chave);
  if (hit && hit.expira > Date.now()) return hit.data;

  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Monday API error: ${msg}`);
  }
  cache.set(chave, { expira: Date.now() + CACHE_TTL_MS, data: json.data });
  return json.data;
}

/**
 * GET /api/monday/boards
 * GET /api/monday/boards?workspaceId=13339794
 * Lista os boards da conta (ou de um workspace específico) — use
 * isso pra descobrir o ID do board de obras / squad.
 */
app.get("/api/monday/boards", async (req, res) => {
  const { workspaceId } = req.query;
  try {
    const data = await mondayQuery(
      workspaceId
        ? `query ($workspaceId: [ID!]) {
            boards(workspace_ids: $workspaceId, limit: 50) { id name items_count }
          }`
        : `query { boards(limit: 50) { id name items_count } }`,
      workspaceId ? { workspaceId: [workspaceId] } : {}
    );
    res.json(data.boards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/monday/columns?boardId=XXXX
 * Lista as colunas de um board — use isso pra descobrir o ID da
 * coluna de Status e da coluna de GC responsável (People ou texto).
 */
app.get("/api/monday/columns", async (req, res) => {
  const { boardId } = req.query;
  if (!boardId) return res.status(400).json({ error: "boardId é obrigatório" });
  try {
    const data = await mondayQuery(
      `query ($boardId: [ID!]) {
        boards(ids: $boardId) {
          columns { id title type }
        }
      }`,
      { boardId: [boardId] }
    );
    res.json(data.boards[0]?.columns || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/monday/obras?boardId=XXXX&statusColumnId=status&gcColumnId=people&statusValue=Em execução&groupId=XXXX
 *
 * Retorna a listagem de obras do board, já no formato que o Confere
 * consome: [{ id, nome, status, gc }]
 *
 * statusColumnId / gcColumnId / statusValue são opcionais: sem eles,
 * a rota devolve TODOS os itens com TODAS as colunas, pra você
 * conseguir identificar visualmente o que é o quê antes de fixar
 * os IDs certos no .env ou na chamada do Confere.
 *
 * groupId é opcional: use se "squad" for um GRUPO (swimlane) dentro
 * do mesmo board de obras, em vez de um board separado.
 */
app.get("/api/monday/obras", async (req, res) => {
  const { boardId, statusColumnId, gcColumnId, statusValue, groupId } = req.query;
  if (!boardId) return res.status(400).json({ error: "boardId é obrigatório" });

  try {
    let items = [];
    let cursor = null;

    do {
      const data = await mondayQuery(
        cursor
          ? `query ($cursor: String!) {
              next_items_page(cursor: $cursor, limit: 100) {
                cursor
                items { id name group { id title } column_values { id type text } }
              }
            }`
          : groupId
          ? `query ($boardId: [ID!], $groupId: [String!]) {
              boards(ids: $boardId) {
                groups(ids: $groupId) {
                  title
                  items_page(limit: 100) {
                    cursor
                    items { id name group { id title } column_values { id type text } }
                  }
                }
              }
            }`
          : `query ($boardId: [ID!]) {
              boards(ids: $boardId) {
                items_page(limit: 100) {
                  cursor
                  items { id name group { id title } column_values { id type text } }
                }
              }
            }`,
        cursor ? { cursor } : groupId ? { boardId: [boardId], groupId: [groupId] } : { boardId: [boardId] }
      );

      const page = cursor
        ? data.next_items_page
        : groupId
        ? data.boards[0]?.groups[0]?.items_page
        : data.boards[0]?.items_page;
      items = items.concat(page.items);
      cursor = page.cursor;
    } while (cursor);

    const obras = items.map((it) => {
      const colMap = {};
      it.column_values.forEach((c) => { colMap[c.id] = c.text; });
      return {
        id: it.id,
        nome: it.name,
        grupo: it.group?.title,
        status: statusColumnId ? colMap[statusColumnId] : undefined,
        gc: gcColumnId ? colMap[gcColumnId] : undefined,
        colunas: statusColumnId && gcColumnId ? undefined : colMap, // debug: mostra tudo se ainda não sabemos os IDs
      };
    });

    const filtradas = statusValue
      ? obras.filter((o) => (o.status || "").toLowerCase() === statusValue.toLowerCase())
      : obras;

    res.json(filtradas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/monday/obras-execucao?workspaceId=13339790
 *
 * Cada board dentro do workspace é uma obra (ex: "2281 - TKWS").
 * Dentro do board, procura o grupo "Planejamento de obra" e lê a
 * coluna "GC responsável" do item que está lá.
 *
 * Parâmetros opcionais:
 *   grupoNome    — trecho (regex, case-insensitive) do título do grupo. Padrão: "planejamento"
 *   gcColunaNome — trecho (regex, case-insensitive) do título da coluna. Padrão: "gc respons"
 *
 * Devolve também `colunas` com TODAS as colunas do item encontrado —
 * use isso pra identificar o nome exato da coluna de status da obra
 * (ex: "Em execução"), que ainda não foi confirmado.
 */
app.get("/api/monday/obras-execucao", async (req, res) => {
  const {
    workspaceId,
    grupoNome = "planejamento",
    gcColunaNome = "g\\.?c.*respons", // casa "G.C Responsável" (com o ponto)
    debug, // ?debug=1 devolve também o objeto `colunas` cru pra inspeção
  } = req.query;
  if (!workspaceId) return res.status(400).json({ error: "workspaceId é obrigatório" });

  // Por padrão a listagem é ENXUTA (só id + nome dos boards): é o que a
  // sidebar precisa e tem complexidade mínima na API do Monday (rápido).
  // Com ?full=1 traz também colunas macro (GC, status, CMV) do item do
  // grupo "Planejamento" — mais pesado, use só quando precisar do detalhe.
  const full = req.query.full === "1" || req.query.full === "true";

  try {
    // Boards "Subelementos de ..." são metadados internos do Monday (subitens),
    // não são obras — ficam de fora da listagem.
    const isSubelementos = (nome) => /^subelementos de/i.test(nome);
    // separa "2256 - Ed.Bliss Campus" em código + nome
    const parseNome = (fullName) => {
      const m = fullName.match(/^\s*(\d{3,})\s*[-–]\s*(.+)$/);
      return { codigo: m ? m[1] : null, nome: m ? m[2].trim() : fullName };
    };

    if (!full) {
      const data = await mondayQuery(
        `query ($workspaceIds: [ID]) {
          boards(workspace_ids: $workspaceIds, limit: 200) { id name }
        }`,
        { workspaceIds: [workspaceId] }
      );
      const obras = data.boards
        .filter((b) => !isSubelementos(b.name))
        .map((b) => ({ boardId: b.id, ...parseNome(b.name), obra: b.name }));
      return res.json(obras);
    }

    // caminho completo (?full=1): colunas macro do item de "Planejamento"
    const data = await mondayQuery(
      `query ($workspaceIds: [ID]) {
        boards(workspace_ids: $workspaceIds, limit: 200) {
          id
          name
          columns { id title }
          groups {
            id
            title
            items_page(limit: 1) {
              items { id name column_values { id text } }
            }
          }
        }
      }`,
      { workspaceIds: [workspaceId] }
    );

    const grupoRegex = new RegExp(grupoNome, "i");
    const gcRegex = new RegExp(gcColunaNome, "i");
    const pick = (colunas, re) => {
      const key = Object.keys(colunas).find((k) => re.test(k));
      return key ? colunas[key] : null;
    };

    const obras = data.boards
      .filter((board) => !isSubelementos(board.name))
      .map((board) => {
        const colTitleById = {};
        board.columns.forEach((c) => { colTitleById[c.id] = c.title; });

        const grupo = board.groups.find((g) => grupoRegex.test(g.title));
        const item = grupo?.items_page?.items?.[0];

        const colunas = {};
        if (item) {
          item.column_values.forEach((cv) => {
            const title = colTitleById[cv.id] || cv.id;
            colunas[title] = cv.text;
          });
        }

        const { codigo, nome } = parseNome(board.name);
        const obra = {
          boardId: board.id,
          codigo,
          nome,
          obra: board.name,
          grupoEncontrado: grupo ? grupo.title : null,
          gcResponsavel: pick(colunas, gcRegex),
          statusObra: pick(colunas, /status\s*obra/i),
          statusAquisicao: pick(colunas, /status\s*aquisi/i),
          comercialResp: pick(colunas, /comercial\s*resp/i),
          localizacao: pick(colunas, /local/i),
          cmvOrcado: pick(colunas, /cmv\s*or[çc]ado/i),
          cmvLiberado: pick(colunas, /cmv\s*liberado/i),
          realizado: pick(colunas, /^realizado$/i),
          avanco: pick(colunas, /%\s*geral\s*de\s*avan/i),
        };
        if (debug) obra.colunas = colunas;
        return obra;
      });

    res.json(obras);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/monday/workspaces
 * Lista os workspaces da conta — use pra descobrir o ID do workspace
 * de cada squad (Sun / Moon / Comet).
 */
app.get("/api/monday/workspaces", async (req, res) => {
  try {
    const data = await mondayQuery(
      `query { workspaces(limit: 100) { id name kind } }`
    );
    res.json(data.workspaces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
 * LEITURA DO VENDIDO EM PDF
 * A proposta padrão (Group WS) vira texto e é varrida linha a linha:
 * verba = número (1..19) + NOME EM CAIXA + valor R$; item = código
 * "N.M" + descrição (pode quebrar em 2 linhas) + quantidade/unidade
 * (grudadas, ex "…RRT1,00vb0") + ambiente.
 * ============================================================ */

function parseBRLnum(s) {
  const n = Number(String(s).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : null;
}

// remove resíduo de valores/coluna que vazou pro fim da descrição (ex:
// item sem custo real, onde a linha de "-R$ -R$ -R$" acaba grudando).
function limparDescResidual(desc) {
  return String(desc || "").replace(/\s*[\d.,\-]*\s*R\$[\sR$\d.,\-]*$/i, "").trim();
}

function parseVendidoTexto(texto) {
  const linhas = texto.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() !== "");
  const reItem = /^(\d{1,2}\.\d+)/;
  const reVerba = /^([1-9]|1[0-9])$/; // 1..19 (exclui "0")
  // sem \b no final: a unidade costuma vir colada a um dígito de
  // placeholder de coluna (ex: "1,00vb0") — \b falha entre "b" e "0"
  // (os dois são caracteres de "palavra"). "und" antes de "un" pra não
  // truncar a unidade errada quando as duas casam no mesmo ponto.
  const reQtdUn = /(\d{1,4}(?:\.\d{3})*,\d{2})\s*(vb|und|un|m²|m2|pç|pc|kg|cj|par|vg)/i;

  const verbas = [];
  const itens = [];
  let i = 0;
  while (i < linhas.length && !/Descri[çc][aã]o/i.test(linhas[i])) i++;
  i++;
  let vAtual = null;
  while (i < linhas.length) {
    const t = linhas[i].trim();
    if (reVerba.test(t)) {
      const num = t.padStart(2, "0");
      const nome = (linhas[i + 1] || "").trim();
      let valor = null;
      let k = i + 2;
      for (; k <= i + 4 && k < linhas.length; k++) {
        if (/R\$/.test(linhas[k])) {
          const ns = (linhas[k].match(/[\d.]+,\d{2}/g) || []).map(parseBRLnum).filter((x) => x != null);
          if (ns.length) valor = Math.max(...ns);
          k++;
          break;
        }
      }
      vAtual = num;
      verbas.push({ num, nome, valor });
      i = k; // avança de vez para depois da linha do valor (não um deslocamento fixo)
      continue;
    }
    const mi = linhas[i].match(reItem);
    if (mi) {
      const codigo = mi[1];
      let resto = linhas[i].slice(mi[1].length);
      let j = i + 1;
      // linhas só numéricas (índice de linha, placeholder de coluna vazia
      // tipo "0" ou "0,000") são ruído de layout, não descrição — pula.
      const reLinhaSoNumero = /^\d+([.,]\d+)*$/;
      // marcadores do rodapé da proposta (condições de pagamento etc) —
      // o ÚLTIMO item do PDF não tem próximo item/verba pra parar, então
      // sem isso ele "engole" o rodapé inteiro dentro da descrição.
      const reRodape = /^(condi[çc][ãa]?[oõ]es de pagamento|observa[çc][oõ]es importantes|total turnkey|esta proposta [ée] v[áa]lida)/i;
      const jLimite = j + 10; // trava extra, caso o rodapé não use os marcadores acima
      while (!reQtdUn.test(resto) && j < linhas.length && j < jLimite && !reItem.test(linhas[j]) && !reVerba.test(linhas[j].trim())) {
        const lt = linhas[j].trim();
        if (reRodape.test(lt)) break;
        if (reLinhaSoNumero.test(lt)) { j++; continue; }
        resto += (resto ? " " : "") + lt;
        j++;
      }
      let qtd = null, un = null, amb = null, custo = null;
      const mq = resto.match(reQtdUn);
      if (mq) {
        qtd = parseBRLnum(mq[1]);
        un = mq[2];
        amb = resto.slice(mq.index + mq[0].length).replace(/^\s*0?\s*/, "").trim() || null;
        resto = resto.slice(0, mq.index).trim();
        // alguns modelos "elaborados" trazem um valor R$ colado depois do
        // ambiente (ex: "...Living2.519,00R$") — captura como custo, se houver.
        if (amb) {
          const mc = amb.match(/([\d.]+,\d{2})\s*R\$|R\$\s*([\d.]+,\d{2})/);
          if (mc) {
            custo = parseBRLnum(mc[1] || mc[2]);
            amb = (amb.slice(0, mc.index) + amb.slice(mc.index + mc[0].length)).trim() || null;
          }
        }
      }
      resto = limparDescResidual(resto.replace(/\s*0$/, "").trim());
      if (resto) itens.push({ verba: vAtual, codigo, desc: resto, qtd, un, ambiente: amb, custo });
      i = j;
      continue;
    }
    i++;
  }
  return { verbas, itens };
}

/**
 * POST /api/vendido/parse
 * Corpo = o arquivo PDF do Vendido (application/pdf). Devolve
 * { verbas: [{num, nome, valor}], itens: [{verba, codigo, desc, qtd, un, ambiente}] }.
 */
app.post("/api/vendido/parse", express.raw({ type: "*/*", limit: "30mb" }), async (req, res) => {
  try {
    if (!req.body || !req.body.length) return res.status(400).json({ error: "Envie o PDF no corpo da requisição." });
    const data = await pdfParse(req.body);
    const resultado = parseVendidoTexto(data.text);
    res.json({ paginas: data.numpages, ...resultado });
  } catch (err) {
    res.status(500).json({ error: "Falha ao ler o PDF: " + err.message });
  }
});

/* ============================================================
 * LEITURA DO EXECUTIVO EM PDF ("Composição de Custo")
 * Formato bem mais denso que o Vendido: cada verba/item tem uma linha
 * de índice sequencial, custo Material + Mão de Obra por item, e uma
 * linha de totais (Total Material / Total MO / Total Geral). Validado
 * contra um PDF real do time — os totais por verba batem exatamente
 * com os valores conhecidos.
 * ============================================================ */

function verbaDoCodigoServer(codigo) {
  const m = String(codigo || "").match(/^(\d{1,2})\./);
  return m ? m[1].padStart(2, "0") : null;
}

function parseExecutivoTexto(texto) {
  const linhas = texto.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() !== "");
  const reItemCod = /^(\d{1,2}\.\d+)$/;
  const reVerbaCod = /^([1-9]|1[0-9])$/;
  const reQtdUnLine = /^(\d{1,4}(?:\.\d{3})*,\d{2})\s*(vb|und|un|m²|m2|pç|pc|kg|cj|par|vg)$/i;
  const rsMatches = (l) => [...l.matchAll(/(-|[\d.]+,\d{2})\s*R\$/g)].map((m) => parseBRLnum(m[1]));
  const isCapsName = (l) => l.length > 3 && l === l.toUpperCase() && /[A-ZÀÂÃÉÊÍÓÔÕÚÇ]/.test(l);

  const verbas = [];
  const itens = [];
  let i = 0;
  while (i < linhas.length) {
    const t = linhas[i].trim();
    if (reVerbaCod.test(t) && linhas[i + 1] && isCapsName(linhas[i + 1].trim())) {
      const num = t.padStart(2, "0");
      const nome = linhas[i + 1].trim().replace(/0+$/, "").trim();
      let valor = null, j = i + 2;
      for (; j < Math.min(i + 8, linhas.length); j++) {
        const vals = rsMatches(linhas[j]);
        if (vals.length >= 3) { valor = vals[vals.length - 1]; j++; break; }
      }
      verbas.push({ num, nome, valor });
      i = j;
      continue;
    }
    const mi = t.match(reItemCod);
    if (mi) {
      const codigo = mi[1];
      let j = i + 1, descParts = [];
      const jLimite = j + 10; // mesma trava de segurança do parser do Vendido
      while (j < linhas.length && j < jLimite) {
        const lt = linhas[j].trim();
        if (reQtdUnLine.test(lt)) break;
        if (reItemCod.test(lt)) break;
        if (reVerbaCod.test(lt) && linhas[j + 1] && isCapsName(linhas[j + 1].trim())) break;
        if (lt === "0") { j++; continue; }
        descParts.push(lt);
        j++;
      }
      let qtd = null, un = null;
      if (j < linhas.length && reQtdUnLine.test(linhas[j].trim())) {
        const mq = linhas[j].trim().match(reQtdUnLine);
        qtd = parseBRLnum(mq[1]); un = mq[2]; j++;
      }
      let custoMaterial = null, custoMO = null, custoTotal = null;
      if (j < linhas.length) {
        const vals = rsMatches(linhas[j]);
        if (vals.length >= 2) { custoMaterial = vals[0]; custoMO = vals[1]; j++; }
      }
      if (j < linhas.length) {
        const vals = rsMatches(linhas[j]);
        if (vals.length >= 3) { custoTotal = vals[vals.length - 1]; j++; }
      }
      const descLimpa = limparDescResidual(descParts.join(" ").trim());
      itens.push({ verba: verbaDoCodigoServer(codigo), codigo, desc: descLimpa, qtd, un, custoMaterial, custoMO, custoTotal });
      i = j;
      continue;
    }
    i++;
  }
  return { verbas, itens };
}

/**
 * POST /api/executivo/parse
 * Corpo = o PDF do Executivo ("Composição de Custo"). Devolve
 * { verbas: [{num, nome, valor}], itens: [{verba, codigo, desc, qtd, un, custoMaterial, custoMO, custoTotal}] }.
 */
app.post("/api/executivo/parse", express.raw({ type: "*/*", limit: "30mb" }), async (req, res) => {
  try {
    if (!req.body || !req.body.length) return res.status(400).json({ error: "Envie o PDF no corpo da requisição." });
    const data = await pdfParse(req.body);
    const resultado = parseExecutivoTexto(data.text);
    res.json({ paginas: data.numpages, ...resultado });
  } catch (err) {
    res.status(500).json({ error: "Falha ao ler o PDF: " + err.message });
  }
});

module.exports = app;
