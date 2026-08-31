/* O Azure recusa na VOLTA e escreve o motivo na URL. Se a tela nao ler
   isso, o login parece simplesmente nao funcionar -- foi o que aconteceu
   em producao no dia 31/08. */
import { readFileSync } from "node:fs";
import assert from "node:assert";

const fonte = readFileSync(new URL("../AuthGate.jsx", import.meta.url), "utf8");
const i = fonte.indexOf("export function erroDaVolta");
const j = fonte.indexOf("\nfunction LoginScreen");
const { erroDaVolta } = await import(
  "data:text/javascript," + encodeURIComponent(fonte.slice(i, j)));

const casos = [
  ["https://x.app/?error=invalid_request&error_description=AADSTS50194%3A+Application+is+not+configured+as+a+multi-tenant+application.",
   /Azure Tenant URL/, "50194 vira instrucao de conserto"],
  ["https://x.app/#error_description=AADSTS50194%3A+multi-tenant",
   /Azure Tenant URL/, "le tambem do hash, nao so' da query"],
  ["https://x.app/?error_description=AADSTS90002%3A+Tenant+%27986a40c7%27+not+found.",
   /Directory \(tenant\) ID/, "90002 explica a troca dos dois GUIDs"],
  ["https://x.app/?error_description=AADSTS50011%3A+redirect_uri+mismatch",
   /Redirect URIs/, "50011 fala de endereco de retorno"],
  ["https://x.app/?error_description=AADSTS7000215%3A+Invalid+client+secret",
   /Client Secret/, "segredo invalido fala de gerar outro"],
  ["https://x.app/?error=access_denied", /negado/, "recusa do usuario"],
  ["https://x.app/?error_description=Coisa+nunca+vista",
   /Coisa nunca vista/, "codigo desconhecido aparece cru, nao some"],
  ["https://x.app/", null, "sem erro na URL, nada a mostrar"],
  ["https://x.app/#access_token=abc&type=bearer", null, "volta BOA nao vira erro"],
  ["nao-e-url", null, "URL quebrada nao derruba a tela"],
];

let ok = 0;
for (const [url, esperado, nome] of casos) {
  const r = erroDaVolta(url);
  if (esperado === null) assert.strictEqual(r, null, nome);
  else assert.match(r, esperado, nome);
  console.log("ok  ", nome);
  ok++;
}
console.log(`\nOK — ${ok} casos`);
