/* Nenhuma rota do backend responde a quem nao esta logado.
 *
 * Roda com: node web/api/_lib/__testes__/rotas-exigem-login.test.cjs
 *
 * Ate' 20/09/2026 todas as rotas eram abertas: sem login e com CORS
 * liberado pra qualquer site. Quem soubesse a URL criava solicitacao de
 * compra no Sienge de producao, com a credencial do servidor.
 *
 * Este teste sobe o backend de verdade numa porta livre e bate em cada
 * rota sem token, e depois com um token falso. Nenhuma pode responder
 * outra coisa que nao 401. Ele NAO lista as rotas a mao: le as que o
 * Express registrou. Rota nova entra no teste sozinha — que e' justamente
 * a rota que alguem esqueceria de proteger.
 */

// A verificacao de token precisa de URL e chave pra existir. Aqui sao
// falsas de proposito: nenhum pedido deste teste deve chegar ao Supabase —
// todos tem que ser barrados antes.
process.env.SUPABASE_URL = "https://nao-existe.supabase.co";
process.env.SUPABASE_ANON_KEY = "chave-falsa";

const path = require("node:path");
const app = require(path.join(__dirname, "..", "mondayApp.js"));

// O [auth] loga cada recusa com console.error. Num teste que so' faz
// recusar, isso e' ruido — o resultado e' o que conta.
console.error = () => {};

/* Toda rota que o Express conhece, com o metodo — inclusive as dos
   routers de _lib/rotas/, montados sem prefixo (o caminho inteiro fica na
   propria rota). Parametro de rota (`:buildingId`) vira um valor qualquer:
   o que se testa e' a porta. */
function rotasRegistradas() {
  const achar = (pilha) => pilha.flatMap((camada) => {
    if (camada.route) {
      return Object.keys(camada.route.methods).map((metodo) => ({
        metodo: metodo.toUpperCase(),
        caminho: camada.route.path.replace(/:[^/]+/g, "1"),
      }));
    }
    if (camada.name === "router" && camada.handle && camada.handle.stack) return achar(camada.handle.stack);
    return [];
  });
  return achar(app._router.stack);
}

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(58)} ${String(obtido).padEnd(5)} ${ok ? "" : "esperava " + esperado}`);
};

const servidor = app.listen(0, async () => {
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const rotas = rotasRegistradas();

  conf("o backend registrou rotas (senao o teste nao prova nada)", rotas.length > 0, true);

  for (const { metodo, caminho } of rotas) {
    const semToken = await fetch(base + caminho, { method: metodo });
    conf(`sem token     ${metodo} ${caminho}`, semToken.status, 401);
  }

  // Token presente mas invalido: a verificacao tem que ir alem de "tem
  // alguma coisa no cabecalho". Aqui o Supabase e' falso, entao a
  // verificacao falha — e falhar tem que ser recusar, nunca liberar.
  const { metodo, caminho } = rotas.find((r) => r.metodo === "POST") || rotas[0];
  const tokenFalso = await fetch(base + caminho, {
    method: metodo,
    headers: { Authorization: "Bearer isto-nao-e-um-token" },
  });
  conf(`token falso   ${metodo} ${caminho}`, tokenFalso.status, 401);

  servidor.close();
  console.log(falhas === 0 ? "\nOK — nenhuma rota aberta" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
});
