const assert = require("node:assert/strict");
const app = require("../mondayApp.js");

// Exercita os handlers com falhas de terceiros, sem rede nem banco de produção.
const originalFetch = global.fetch;
const originalError = console.error;
const originalToken = process.env.MONDAY_API_TOKEN;
const logs = [];
const privateDetail = "internal backend credentials and customer detail";
global.fetch = async () => { throw new Error(privateDetail); };
console.error = (value) => logs.push(value);
process.env.MONDAY_API_TOKEN = "synthetic-test-value";

(async () => {
  try {
    for (const path of ["/api/monday/obras-execucao", "/api/vendido/parse", "/api/executivo/parse", "/api/sienge/texto"]) {
      const route = app._router.stack.find((layer) => layer.route?.path === path).route;
      const handler = route.stack.at(-1).handle;
      let status;
      let payload;
      const res = {
        status(value) { status = value; return this; },
        json(value) { payload = value; return this; },
      };
      // O handler final recebe o que os middlewares ja' validaram: o
      // workspace (zValidator) e o PDF (validarPdf). Aqui chega um "PDF"
      // que o leitor recusa, pra exercitar a resposta de erro.
      await handler({
        valido: { query: { workspaceId: "13339794" } },
        pdf: Buffer.from("%PDF-1.4 invalid PDF"),
        body: Buffer.from("%PDF-1.4 invalid PDF"),
      }, res);
      assert.ok(status >= 400, path);
      assert.equal(typeof payload.error, "string", path);
      assert.match(payload.correlationId, /^[0-9a-f-]{36}$/, path);
      assert.ok(!JSON.stringify(payload).includes(privateDetail), path);
      assert.ok(!/Invalid PDF|xref|MONDAY_API_TOKEN|stack/i.test(payload.error), path);
      if (path === "/api/sienge/texto") assert.equal(payload.podeBase64, true);
    }
    assert.ok(logs.some((line) => JSON.parse(line).correlationId));
    assert.ok(!logs.join(" ").includes(privateDetail));
  } finally {
    global.fetch = originalFetch;
    console.error = originalError;
    if (originalToken === undefined) delete process.env.MONDAY_API_TOKEN;
    else process.env.MONDAY_API_TOKEN = originalToken;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
