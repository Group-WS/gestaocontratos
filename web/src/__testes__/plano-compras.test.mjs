/* Testes da seleção do Plano de Compras.
 *
 * Roda com: node web/src/__testes__/plano-compras.test.mjs
 *
 * Guardam duas decisões:
 *
 *   1. Um item tem DUAS parcelas, não um destino. O Spot de R$ 362 é
 *      R$ 182 de material (Compras) + R$ 180 de mão de obra (Contratos).
 *      Antes o app carimbava "produto" e mandava os R$ 362 pra Compras,
 *      sumindo com a mão de obra: na 2519 são 88 itens e R$ 1,5 mi.
 *   2. Quando a planilha não trouxe as colunas (importação por PDF), o
 *      app cai no palpite antigo — produto é tudo material — mas marca a
 *      linha como estimada, pra ninguém ler palpite como número lançado.
 */
const src = (await import("fs")).readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

/* Recorta PEÇAS NOMEADAS do App.jsx pra rodar de verdade.

   Não fatiar intervalo. Este teste já quebrou duas vezes cortando "de X
   até Y": primeiro quando CategoriaBlock foi substituído, depois quando
   um componente novo apareceu entre parcelasDoItem e GrupoPlano — nas
   duas o eval recebeu JSX e morreu com "Unexpected token '<'", que não
   diz nada sobre a causa.

   Pedaço nomeado só quebra quando a função que ele nomeia some de fato,
   e aí o erro diz qual. */
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  const f = src.indexOf(fim, i);
  if (f === -1) throw new Error(`não achei o fim de: ${assinatura}`);
  return src.slice(i, f + fim.length);
};
const ate = (assinatura, terminador) => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  const f = src.indexOf(terminador, i);
  if (f === -1) throw new Error(`não achei o fim de: ${assinatura}`);
  return src.slice(i, f + terminador.length);
};

const codigo = [
  src.match(/^const ehProduto = .*$/m)[0],
  src.match(/^const VERBAS_MAT_MO_SEMPRE = .*$/m)[0],
  bloco("const ehVerbaMatMoSempre = ", ";\n"),
  bloco("function seriaMatMaisMoDaEmpresa("),
  src.match(/^const VERBAS_MO_CONTRATADA = .*$/m)[0],
  bloco("const separaMOautomatico = ", ";\n"),
  bloco("function parcelasDoItem("),
  bloco("function parcelasDaPlanilha("),
].join("\n");

const { parcelasDoItem } = eval(`(function () {
  // Sem padrao da empresa: aqui se testa o que a planilha decide.
  const padraoDaDescricao = () => null;
  // Sem nome de verba nestes fixtures (só "num"), então esta função
  // nunca precisa resolver apelido nenhum — ver os "cat" abaixo.
  const verbaPorNome = () => null;
  ${src.match(/^const ALOC_MAT = .*$/m)[0]}
  ${codigo}
  return { parcelasDoItem };
})()`);

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(52)} ${String(obtido).padEnd(10)} ${ok ? "" : "esperava " + esperado}`);
};

// o item do exemplo da Priscila — verba real dele é Iluminação (05), que
// separa MAT/MO sozinha; sem essa verba na mão, as duas parcelas juntas
// virariam MO inteiro pela regra nova (ver plano-alocacao.test.mjs) e
// este arquivo pararia de testar o que se propõe: a leitura da PARCELA.
const iluminacao = { num: "05" };
const spot = {
  tipo: "produto", codigo: "5.12", desc: "Spot de Sobrepor Redondo Loyo Up MR16",
  qtdExecutivo: 1, custo: 362, custoMaterial: 182, custoMO: 180,
  totalMaterial: 182, totalMO: 180,
};

console.log("=== AS DUAS PARCELAS ===");
conf("material do spot", parcelasDoItem(spot, iluminacao).material, 182);
conf("mão de obra do spot", parcelasDoItem(spot, iluminacao).mo, 180);
conf("nada estimado quando a planilha trouxe", parcelasDoItem(spot, iluminacao).estimado, false);

// quantidade multiplica quando só veio o unitário
const semTotais = { ...spot, totalMaterial: null, totalMO: null, qtdExecutivo: 3 };
conf("total sai do unitário × quantidade", parcelasDoItem(semTotais, iluminacao).material, 546);

console.log("\n=== SEM AS COLUNAS (PDF): PALPITE DECLARADO ===");
const soTotal = { tipo: "produto", custo: 500, qtdExecutivo: 1, custoMaterial: null, custoMO: null, totalMaterial: null, totalMO: null };
conf("produto vira tudo material", parcelasDoItem(soTotal).material, 500);
conf("e nada de mão de obra", parcelasDoItem(soTotal).mo, 0);
conf("marcado como estimado", parcelasDoItem(soTotal).estimado, true);
const servico = { ...soTotal, tipo: "servico" };
conf("serviço vira tudo mão de obra", parcelasDoItem(servico).mo, 500);
conf("e nada de material", parcelasDoItem(servico).material, 0);

/* ---- O PLANO EM MODO LEITURA (17/09/2026) ----
 *
 * Ela trocou a alocação de itens da Automação com a obra travada por outra
 * pessoa. A tela mudou na hora, o salvamento automático NÃO roda sem a trava
 * (ele exige `edicao.minha`), e a correção sumia no F5. Do lado dela ficou
 * "MAS JÁ ESTÁ LANÇADO COMO MAT" — e o item continuava sem subir para as
 * Compras, porque no banco ele nunca virou MAT.
 *
 * Não existe aviso honesto depois do clique: mudança que não grava é pior
 * que mudança que não acontece, porque a tela mente por um F5 inteiro. Então
 * o caminho inteiro fica trancado, e a etiqueta diz por quê.
 */
const app = src;
conf("a etiqueta de alocação desabilita sem a trava", /<select value=\{aloc\}[\s\S]{0,200}disabled=\{!podeEditar\}/.test(app), true);
conf("... e diz que é modo leitura", /title=\{podeEditar[\s\S]{0,140}MODO_LEITURA_DICA\}/.test(app), true);
conf("a linha do plano recebe o modo leitura", /function LinhaPlano\(\{ item, cat, onAlocar, onSepararMO, onJuntarMO, onAprovar, podeEditar = true \}\)/.test(app), true);
conf("o grupo do plano também", /function GrupoPlano\(\{[^}]*podeEditar = true \}\)/.test(app), true);
conf("e a tela entrega o modo leitura ao grupo", app.includes("<GrupoPlano key={cat.num + cat.nome} cat={cat} itens={itens} podeEditar={podeEditar}"), true);
/* Segunda tranca: mesmo que a etiqueta escape, a ação não passa. */
conf("mudar alocação sem trava não chama o App", /if \(!podeEditar\) return;\s*\n\s*const i = indiceRealDoItem/.test(app), true);
conf("separar MO fica de fora sem a trava", app.includes("onSepararMO={podeEditar ? (codigo) => onSepararMO(cat.num, codigo) : null}"), true);
conf("juntar MO também", app.includes("onJuntarMO={podeEditar ? (codigo) => onJuntarMO(cat.num, codigo) : null}"), true);
conf("separar o grupo inteiro também", app.includes("onSepararGrupo={podeEditar ? () => onSepararGrupo(cat.num) : null}"), true);
conf("aprovar para compra também", /onClick=\{onAprovar\} disabled=\{!podeEditar\}/.test(app), true);

/* ---- O PLANO MOSTRA O BLOQUEADO (regra dela, 18/09/2026) ----
 *
 * "no plano de compras deve aparecer todos esses itens bloqueados, até a
 * liberacao do aprovado para compra. é importante ele aparecer já como
 * bloqueado, para usarmos esses dados para computar oque tem para contratar e
 * comprar no futuro." E: "só vai aparecer liberado lá oque foi aprovado para
 * compra".
 *
 * MÃO DE OBRA ENTROU NA REGRA. Até aqui ela era exceção — "nunca vai pra
 * compra, vai pra Contratos" —, mas com a aprovação valendo para a planilha
 * inteira, ela também espera o "aprovado para compra" antes de mostrar
 * destino. A linha continua na lista e continua contando no dinheiro: é dela
 * que sai a conta do que ainda há para contratar e comprar.
 */
conf("sem aprovação, o destino é BLOQUEADO",
  app.includes(`<span className="pill pill-bloqueado" title="Bloqueado até o administrador aprovar para compra, na Conf. Executivo">`), true);
conf("e vale para toda linha, inclusive mão de obra",
  app.includes("  if (!liberadoParaCompra(item)) {"), true);
conf("o rótulo antigo 'a liberar' saiu", /pill-wait" title="Ainda não liberado para compra/.test(app), false);
conf("a linha inteira fica clarinha até a aprovação",
  app.includes(`: !liberadoParaCompra(item) ? "row-estimativa"`), true);
/* Comprado continua ganhando do resto na leitura: quem abre o plano quer
   saber primeiro o que já resolveu. */
conf("comprado continua aparecendo primeiro", app.indexOf("if (item.comprado) {") < app.indexOf("if (!liberadoParaCompra(item)) {"), true);

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
