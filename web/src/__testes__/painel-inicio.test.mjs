/* O painel de início e a régua da obra (19/09/2026).
 *
 * Roda com: node web/src/__testes__/painel-inicio.test.mjs
 *
 * Avaliação do painel a pedido dela. Cinco ajustes, todos do mesmo tipo:
 * o código já sabia a resposta e a tela mostrava outra.
 *
 *   1. ORDEM. `resumoGeral` já ordenava as obras por urgência — atrasada
 *      primeiro, depois quem entrega antes — e a lista do Início saía na
 *      ordem de carregamento. A obra atrasada que entrega semana que vem
 *      podia estar embaixo de quatro que entregam ano que vem.
 *   3. ADITIVO NOS TOTAIS. `obraComprasStats` e `obraContratosStats` já
 *      usavam `categoriasComAditivos`; `resumoDaObra` — que alimenta o
 *      A COMPRAR e o A CONTRATAR do Início — usava a categoria crua. O
 *      mesmo aditivo aprovado contava numa tela e sumia na outra.
 *   4. ORÇAMENTO VIGENTE. A manchete mostrava o contrato original
 *      enquanto o card de Aditivos, na mesma tela, mostrava "+R$ X
 *      aprovado". Dois números contando histórias diferentes.
 *   5. CUSTO. `exec` era calculado só pra disparar o alerta: a tela dizia
 *      quanto a obra valia e nunca quanto estava custando.
 *   6. ENTREGAS. A data existia por obra; "o que entrega nos próximos
 *      meses" se respondia lendo obra por obra.
 */
const app = (await import("fs")).readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

const dashboard = (await import("fs")).readFileSync(new URL("../features/dashboard/DashboardPage.jsx", import.meta.url), "utf8");

const bloco = (assinatura, fim = "\n}\n") => {
  const i = app.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return app.slice(i, app.indexOf(fim, i) + fim.length);
};
const { ordemDeUrgencia } = eval(`(function(){ ${bloco("function ordemDeUrgencia(")}; return { ordemDeUrgencia }; })()`);

let falhas = 0;
const conf = (nome, obtido, esperado = true) => {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(56)} ${ok ? "" : `${obtido} (esperava ${esperado})`}`);
};

console.log("=== 1. A ORDEM É UMA SÓ, E A LISTA USA ELA ===");
const atrasada = { temAtraso: true, dataEntrega: "2027-01-01" };
const cedo = { temAtraso: false, dataEntrega: "2026-10-01" };
const tarde = { temAtraso: false, dataEntrega: "2026-12-01" };
const semData = { temAtraso: false, dataEntrega: null };
conf("atrasada vem antes de quem entrega antes", ordemDeUrgencia(atrasada, cedo) < 0);
conf("quem entrega antes vem primeiro", ordemDeUrgencia(cedo, tarde) < 0);
conf("sem data vai pro fim", ordemDeUrgencia(semData, tarde) > 0);
conf("... mesmo contra outra sem data ser estável", ordemDeUrgencia(semData, semData) !== 0);
// a ordenação de verdade, na ordem que a tela vai mostrar
const ordenadas = [tarde, semData, atrasada, cedo].sort(ordemDeUrgencia);
conf("a fila sai atrasada > cedo > tarde > sem data",
  ordenadas.map((o) => (o.temAtraso ? "atrasada" : o.dataEntrega || "semData")).join(","),
  "atrasada,2026-10-01,2026-12-01,semData");
// e o resumo usa a MESMA função, em vez de repetir a regra
conf("resumoGeral usa a função nomeada", app.includes("linhas: linhas.sort((a, b) => ordemDeUrgencia("));
conf("a lista do Início usa a lista ordenada", dashboard.includes("{tableRows.map((row) =>"));
conf("... e o contador também", dashboard.includes("{tableRows.length}</Badge>"));
conf("o array cru não é mais renderizado", app.includes("{(minhas.length ? minhas : obras).map("), false);

console.log("\n=== 3. ADITIVO APROVADO CONTA NOS DOIS LADOS ===");
const resumo = bloco("function resumoDaObra(o, hoje = new Date(), filtroItem = null) {");
conf("resumoDaObra enxerga os aditivos", resumo.includes("categoriasComAditivos(o.categorias, o.aditivos).forEach"));
conf("... e não usa mais a categoria crua", /\(o\.categorias \|\| \[\]\)\.forEach\(\(cat\)/.test(resumo), false);

console.log("\n=== 4 e 5. O ORÇAMENTO É O DE HOJE, E O CUSTO APARECE ===");
conf("o vigente soma o aditivo aprovado", app.includes("const vigente = vendido + adit.saldo;"));
conf("a manchete mostra o vigente", app.includes(`label: "Orçamento vigente", value: fmtCompactBRL(vigente),`));
conf("o contrato original fica no subtítulo", app.includes("contrato {fmtBRL(vendido)}"));
conf("o custo executivo ganhou célula", app.includes(`label: "Custo executivo", value: exec ? fmtCompactBRL(exec) : "—",`));
conf("vermelho só quando passa do vigente", app.includes(`tone: acimaDoVendido ? "danger" : "brand",`));
/* O custo sai do rollup da verba, e em obra vinda do banco ele chega
   vazio: a #2498 mostrava orçamento e custo zerados ao lado de R$ 2,18 mi
   de material e mão de obra na mesma régua. */
conf("o custo tem de onde sair quando o rollup falha",
  app.includes("|| ((totals.totalProdutos || 0) + (contratos.totalServicos || 0));"));
/* Sem contrato lançado não existe régua — e sem régua não existe estouro.
   Sem esta guarda, toda obra sem contrato acusava estouro do valor cheio. */
conf("sem contrato lançado não acusa estouro", app.includes("const acimaDoVendido = vigente > 0 && exec > vigente;"));
conf("... e o subtítulo não inventa contrato", app.includes(`: vigente > 0 ? "conforme contrato" : "sem valor de contrato lançado"`));
// a conta e o texto do alerta têm que falar da MESMA régua
conf("... e o texto diz qual é a régua", app.includes("O executivo passou do orçamento vigente em"));
// a seta nunca usada era o resto deste mesmo desenho
conf("a seta morta saiu", app.includes("const ArrowRightIcon"), false);

console.log("\n=== 6. ENTREGAS PRÓXIMAS ===");
conf("existe a conta das entregas", dashboard.includes("const deliveries = [...filtered]"));
conf("olha 90 dias à frente", dashboard.includes("row.days <= 90"));
conf("a mais próxima primeiro", dashboard.includes("sort((a, b) => a.days - b.days)"));
conf("obra sem data fica de fora", dashboard.includes("row.days !== null"));
conf("cada entrega abre a obra", dashboard.includes("onClick={() => onOpen(row.id)}"));
conf("o que já venceu se distingue", dashboard.includes("critical={row.days < 0}"));

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
