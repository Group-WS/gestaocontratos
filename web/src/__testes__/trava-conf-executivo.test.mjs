/* A trava do "Concluir etapa" da Conf. Executivo.
 *
 * Roda com: node web/src/__testes__/trava-conf-executivo.test.mjs
 *
 * A regra (16/09/2026): para concluir a Conf. Executivo e ir para a
 * próxima etapa, só a Conferência técnica precisa estar 100% aprovada —
 * zero pendência. Divergência de número e "Entrou ou saiu" não travam.
 *
 * A divergência saiu porque o executivo passou a rever a planilha inteira
 * na tela "Liberar para Compra", item a item. O que cabe e o que é
 * compatível continua travando: é a pergunta que ninguém responde depois.
 *
 * Roda as funções de verdade do App.jsx, a regra do alerta técnico
 * inclusive. Só o cruzamento das planilhas é trocado por linhas prontas,
 * no formato que conferirExecutivoObra devolve.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const linhaDe = (a) => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei: ${a}`);
  return src.slice(i, src.indexOf("\n", i) + 1);
};
const regras = src.slice(src.indexOf("function semAcentos("), src.indexOf("// Palavras que aparecem em quase toda"));

/* Desde 18/09/2026 a trava conta pela MESMA régua da tela: `precisaConferir`
   sobre a lista que a planilha mostra (`itensParaLiberar`), e não mais pelo
   status do cruzamento. Eram duas réguas — a barra dizia 7 e a lista dizia 32
   na mesma obra. */
const M = eval(`(function () {
  ${regras}
  const cruzamentoExecutivo = (obra) => obra.cruzamento;
  // Vêm de lib/: a trava não depende delas.
  const padraoDaDescricao = () => null;
  const verbaPorNome = () => null;
  const eapPadrao = () => [];
  ${src.slice(src.indexOf("const ALOC_MAT ="), src.indexOf("/* =====[ FIM DO MODELO PURO"))}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  ${bloco("function liberadoParaCompra(")}
  ${bloco("function aprovadoPeloCliente(")}
  ${bloco("function pendenciaParaLiberar(")}
  ${bloco("function podeLiberarItem(")}
  ${bloco("function itensParaLiberar(")}
  ${linhaDe("const precisaConferir =")}
  ${linhaDe("const chaveDescricao =")}
  ${bloco("function linhaConfExecutivo(")}
  ${bloco("function pendenciasConfExecutivo(")}
  ${bloco("function bloqueioDaEtapa(")}
  return { bloqueioDaEtapa, pendenciasConfExecutivo };
})()`);

// Uma linha do cruzamento, no formato de conferirExecutivoObra.
const linha = (num, codigo, status, vendido, executivo) => ({
  codigo, status, motivo: null, verba: { num, nome: `Verba ${num}` },
  planilhaVendido: vendido ? { desc: vendido, qtdVendida: 1, un: "un", custo: 100 } : null,
  planilhaExecutivo: executivo ? { desc: executivo, qtdVendida: 1, un: "un", custo: 100 } : null,
});

/* A obra precisa das DUAS coisas agora: o cruzamento (que diz o que entrou
   sem ter sido vendido) e as categorias (a planilha que a tela mostra). É
   sobre a planilha que a régua roda — a mesma da tela, e é esse o ponto da
   mudança de 18/09/2026.

   `clienteAssinouEm` fica preenchido de propósito: sem ele a pendência de
   TODO item seria "falta o cliente", que não se resolve conferindo e por isso
   não entra nesta conta. */
const obra = (cruzamento, conferidos = []) => {
  const porVerba = new Map();
  cruzamento.forEach((l) => {
    const ex = l.planilhaExecutivo;
    if (!ex) return;
    if (!porVerba.has(l.verba.num)) porVerba.set(l.verba.num, { num: l.verba.num, nome: l.verba.nome, itens: [] });
    porVerba.get(l.verba.num).itens.push({
      desc: ex.desc, codigo: l.codigo, qtdExecutivo: 1, custoMaterial: 100,
      ...(conferidos.includes(l.codigo) ? { alertaConferido: { em: "2026-09-18", por: "eu" } } : {}),
    });
  });
  return { cruzamento, aprovacoes: new Set(), clienteAssinouEm: "2026-09-01", categorias: [...porVerba.values()] };
};
const trava = (o, etapa = "executivo_conferencia") => M.bloqueioDaEtapa(etapa, o);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(50)} ${String(o).padEnd(34)} ${ok ? "" : "esperava " + e}`); };

const conferida = linha("05", "5.1", "ok", "Spot Snello 7W 3000K", "Spot Snello 7W 3000K");
const divergente = linha("11", "11.2", "diferente", "Porcelanato 60x60", "Porcelanato 60x60");
// O par real da obra: o número bate, mas nenhum lado diz se é GN ou GLP.
const aquecedor = linha("28", "28.4", "ok", "Aquecedor a gás 45L Komeco Komeco Sacada", "Aquecedor a Gás KO 45DI Prime");
const entrou = linha("28", "28.9", "somente_um", null, "Televisor 55 polegadas");

console.log("=== O QUE TRAVA ===");
conf("tudo conferido: libera", trava(obra([conferida])), null);
conf("aquecedor sem GN/GLP trava", trava(obra([aquecedor])), "Falta conferir 1 produto");
conf("duas técnicas contam junto",
  trava(obra([aquecedor, linha("28", "28.5", "ok", "Aquecedor a gás 30L", "Aquecedor a Gás 30L")])),
  "Falta conferir 2 produtos");

/* MUDOU EM 18/09/2026, e é consequência de unificar a régua: o item que
   ENTROU no executivo sem ter sido vendido passou a travar a etapa. Ele já
   travava a LIBERAÇÃO (é um dos que pedem o "conferi"); o que estava errado
   era a barra da etapa contar outra coisa e dizer 7 onde a lista dizia 32. */
console.log("\n=== O QUE PASSOU A TRAVAR ===");
conf("'entrou sem ter sido vendido' trava", trava(obra([entrou])), "Falta conferir 1 produto");
conf("... e some quando alguém confere", trava(obra([entrou], ["28.9"])), null);

console.log("\n=== O QUE NÃO TRAVA ===");
/* A divergência de número saiu da trava em 16/09/2026: quem revê isso
   agora é o executivo, item a item, na planilha da conferência. */
conf("divergente sozinho não trava", trava(obra([conferida, divergente])), null);
conf("dois divergentes também não", trava(obra([divergente, linha("11", "11.3", "diferente", "Rodapé", "Rodapé")])), null);
conf("divergente não soma com a técnica", trava(obra([divergente, aquecedor])), "Falta conferir 1 produto");

console.log("\n=== O QUE LIBERA ===");
conf("conferir o alerta libera", trava(obra([aquecedor], ["28.4"])), null);
conf("conferir a técnica libera mesmo com divergente", trava(obra([divergente, aquecedor], ["28.4"])), null);

console.log("\n=== SÓ NA CONF. EXECUTIVO ===");
conf("outra etapa não tem essa trava", trava(obra([divergente]), "executivo"), null);
conf("sem obra não quebra", M.bloqueioDaEtapa("executivo_conferencia", null), null);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
