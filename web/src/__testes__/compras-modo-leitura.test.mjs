/* Compras só muda item com a edição da obra habilitada.
 *
 * Roda com: node web/src/__testes__/compras-modo-leitura.test.mjs
 *
 * Quem grava é o salvamento automático, e ele só roda pra quem está com a
 * trava da obra. Em modo leitura a tela deixava marcar "solicitado", a marca
 * aparecia e sumia no F5 (15/09/2026). Aqui: toda mudança das Compras passa
 * por `mudar`, que não faz nada sem edição, e os botões travam.
 */
import fs from "node:fs";

const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const trecho = (a, b) => {
  const i = src.indexOf(a); const j = src.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error(`não achei no App.jsx: ${a}`);
  return src.slice(i, j);
};
const compras = trecho("function ComprasView(", "/* A situacao do produto no Sienge");
const linha = trecho("function LinhaCompra(", "MÓDULO CONTRATOS");
const escolha = trecho("function EscolhaSienge(", "function PedidoCompra(");

let f = 0;
const conf = (n, ok) => { if (!ok) f++; console.log(`${ok ? "ok  " : "FALHOU"} ${n}`); };

/* A definição inteira do `mudar`, até o `};` que fecha no mesmo recuo.
   Ela deixou de caber numa linha em 17/09/2026, quando passou a desviar a
   linha de aditivo pra outro endereço. */
const ini = compras.indexOf("const mudar = ");
const def = ini < 0 ? null : compras.slice(ini + "const mudar = ".length, compras.indexOf("\n  };", ini) + "\n  }".length);
// Uma verba com um item da planilha (índice 0) e um de aditivo (índice 1).
const obraFake = { categorias: [{}, { num: "27", itens: [{ desc: "Cuba" }, { desc: "cor papel", aditivo: "2450/1", id: "aditivo-a-g-i" }] }] };
const chamadas = (podeEditar, itemIdx) => {
  const planilha = [], aditivo = [];
  const mudar = new Function("podeEditar", "onItemChange", "onCompraAditivo", "obra", `return ${def};`)(
    podeEditar, (...a) => planilha.push(a), (...a) => aditivo.push(a), obraFake);
  mudar(1, itemIdx, { solicitado: true });
  return { planilha, aditivo };
};
conf("sem edição, marcar não muda nada", def && chamadas(false, 0).planilha.length === 0);
conf("com edição, marcar muda o item", def && chamadas(true, 0).planilha.length === 1);

/* A linha de ADITIVO grava no endereço dela, e nunca na planilha.
   `onItemChange` procura o item pelo índice; além do fim da planilha ele
   não acha nada, e o canal escolhido se perderia calado. */
const ad = def ? chamadas(true, 1) : { planilha: [1], aditivo: [] };
conf("aditivo com edição vai pro endereço do aditivo", ad.aditivo.length === 1 && ad.planilha.length === 0);
conf("aditivo grava pela verba e pelo id do item", ad.aditivo[0]?.[0] === "27" && ad.aditivo[0]?.[1] === "aditivo-a-g-i");
conf("aditivo sem edição não muda nada", def && chamadas(false, 1).aditivo.length === 0);
conf("nas Compras só `mudar` chama onItemChange", (compras.match(/onItemChange\(/g) || []).length === 1);
conf("o App passa a edição da obra pras Compras", /<ComprasView [^>]*podeEditar=\{edicao\.minha\}/.test(src));
const i = compras.indexOf("<LinhaCompra ");
conf("a linha recebe a edição", i >= 0 && compras.slice(i, compras.indexOf("/>", i)).includes("podeEditar={podeEditar}"));
conf("solicitado trava em modo leitura", linha.includes("disabled={!podeEditar || !podeMudarSolicitado(it)}"));
conf("comprado trava em modo leitura", linha.includes("disabled={!podeEditar || (!it.comprado && !podeMarcarComprado(it))}"));
conf("insumo do Sienge fica só pra consulta", linha.includes("somenteLeitura={!podeEditar}") && /somenteLeitura = false/.test(escolha));
/* O canal do lote virou UM menu "Definir canal" (22/09/2026; antes um
   ToggleGroup, e antes disso cinco botoes): marcar comprado, marcar
   solicitado, associar e o gatilho do menu — quatro travas, e a do canal
   tem que estar no botao que abre o menu. */
conf("canal e marcações em massa travam", (compras.match(/disabled=\{!podeEditar\}/g) || []).length >= 4
  && /<DropdownMenuTrigger asChild>\s*<Button variant="outline" size="sm" disabled=\{!podeEditar\}/.test(compras));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
