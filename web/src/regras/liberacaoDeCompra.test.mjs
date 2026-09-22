/* RN-001 · Só o administrador libera a compra.
 *
 * Roda com: node web/src/regras/liberacaoDeCompra.test.mjs
 *
 * Os exemplos da ficha (docs/regras-de-negocio/RN-001-liberacao-de-compra.md),
 * um por um, mais os limites: perfil desativado, carimbo repetido na mesma
 * liberação em lote, valor antigo `true`, restauração de versão.
 */
import {
  podeLiberarCompra, ehLiberacaoPorAlocacao, liberacoesAcrescentadas, recusasDeLiberacao,
} from "./liberacaoDeCompra.js";

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(78)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};

const ADMIN = { perfil: "admin", ativo: true };
const MASTER = { perfil: "master", ativo: true };
const GC = { perfil: "gc", ativo: true };
const obra = (...itens) => [{ num: "05", itens }];
const item = (extra = {}) => ({ codigo: "5.1", desc: "Spot MR16", ...extra });
const carimbo = (por, extra = {}) => ({ em: "2026-09-21T13:00:00.000Z", por, ...extra });
const motivos = (r) => r.map((x) => x.motivo);

// ---------- quem libera ----------
conf("RN-001 · administrador libera", podeLiberarCompra(ADMIN), true);
conf("RN-001 · master libera", podeLiberarCompra(MASTER), true);
conf("RN-001 · GC não libera", podeLiberarCompra(GC), false);
conf("RN-001 · geral não libera", podeLiberarCompra({ perfil: "geral", ativo: true }), false);
conf("RN-001 · Mehoo não libera", podeLiberarCompra({ perfil: "mehoo", ativo: true }), false);
conf("RN-001 · administrador desativado não libera", podeLiberarCompra({ perfil: "admin", ativo: false }), false);
conf("RN-001 · sem perfil (sala de espera) não libera", podeLiberarCompra({ perfil: null }), false);
conf("RN-001 · sem pessoa não libera", podeLiberarCompra(null), false);

// ---------- exemplos da ficha ----------
const antes = obra(item(), item({ codigo: "5.2" }));

conf("RN-001 · GC libera um item → recusado (só o administrador)",
  motivos(recusasDeLiberacao({ antes, depois: obra(item({ liberadoCompra: carimbo("gc@x.com") }), item({ codigo: "5.2" })), pessoa: GC, email: "gc@x.com" })),
  ["so-administrador"]);

conf("RN-001 · administrador libera um item → liberado, no nome dele",
  recusasDeLiberacao({ antes, depois: obra(item({ liberadoCompra: carimbo("adm@x.com") }), item({ codigo: "5.2" })), pessoa: ADMIN, email: "adm@x.com" }),
  []);

conf("RN-001 · administrador grava a liberação no nome de outra pessoa → recusado",
  motivos(recusasDeLiberacao({ antes, depois: obra(item({ liberadoCompra: carimbo("diretor@x.com") }), item({ codigo: "5.2" })), pessoa: ADMIN, email: "adm@x.com" })),
  ["em-nome-de-outro"]);

conf("RN-001 · GC corrige a alocação (MO → material) → entra liberado, via alocação",
  recusasDeLiberacao({ antes, depois: obra(item({ liberadoCompra: carimbo("gc@x.com", { viaAlocacao: true }) }), item({ codigo: "5.2" })), pessoa: GC, email: "gc@x.com" }),
  []);

conf("RN-001 · ... mas a liberação via alocação é sempre em nome próprio",
  motivos(recusasDeLiberacao({ antes, depois: obra(item({ liberadoCompra: carimbo("adm@x.com", { viaAlocacao: true }) }), item({ codigo: "5.2" })), pessoa: GC, email: "gc@x.com" })),
  ["em-nome-de-outro"]);

conf("RN-001 · GC libera sem a aprovação do cliente → recusado",
  motivos(recusasDeLiberacao({
    antes,
    depois: obra(item({
      liberadoCompra: carimbo("gc@x.com"),
      liberadoSemCliente: carimbo("gc@x.com", { motivo: "aprovado por e-mail", autorizadoPor: "Diretoria" }),
    }), item({ codigo: "5.2" })),
    pessoa: GC, email: "gc@x.com",
  })).sort(),
  ["so-administrador", "so-administrador"]);

conf("RN-001 · administrador libera sem o cliente, com motivo → liberado",
  recusasDeLiberacao({
    antes,
    depois: obra(item({
      liberadoCompra: carimbo("adm@x.com"),
      liberadoSemCliente: carimbo("adm@x.com", { motivo: "aprovado por e-mail", autorizadoPor: "Diretoria" }),
    }), item({ codigo: "5.2" })),
    pessoa: ADMIN, email: "adm@x.com",
  }),
  []);

const liberadaPorOutro = obra(item({ liberadoCompra: carimbo("adm@x.com") }), item({ codigo: "5.2" }));
const umaVezNoHistorico = (campo, c) => (campo === "liberadoCompra" && c.por === "adm@x.com" ? 1 : 0);
conf("RN-001 · restaurar versão traz de volta liberação que já existiu → passa",
  recusasDeLiberacao({ antes, depois: liberadaPorOutro, pessoa: GC, email: "gc@x.com", vezesNoHistorico: umaVezNoHistorico }),
  []);
conf("RN-001 · ... mas copiar o carimbo antigo para mais itens do que havia → recusado",
  motivos(recusasDeLiberacao({
    antes,
    depois: obra(item({ liberadoCompra: carimbo("adm@x.com") }), item({ codigo: "5.2", liberadoCompra: carimbo("adm@x.com") })),
    pessoa: GC, email: "gc@x.com", vezesNoHistorico: umaVezNoHistorico,
  })),
  ["so-administrador"]);

conf("RN-001 · substituir a planilha tira as liberações → a regra não impede",
  recusasDeLiberacao({ antes: liberadaPorOutro, depois: obra(item(), item({ codigo: "5.2" })), pessoa: GC, email: "gc@x.com" }),
  []);

conf("RN-001 · GC edita outro campo de item já liberado → nada muda na liberação",
  recusasDeLiberacao({
    antes: liberadaPorOutro,
    depois: obra(item({ liberadoCompra: carimbo("adm@x.com"), comprado: true }), item({ codigo: "5.2" })),
    pessoa: GC, email: "gc@x.com",
  }),
  []);

// ---------- limites ----------
const lote = carimbo("adm@x.com");
conf("RN-001 · liberação em lote: o mesmo carimbo em vários itens conta cada um",
  liberacoesAcrescentadas(obra(item({ liberadoCompra: lote }), item({ codigo: "5.2" })),
    obra(item({ liberadoCompra: lote }), item({ codigo: "5.2", liberadoCompra: lote }))).map((x) => x.aMais),
  [1]);
conf("RN-001 · GC copia o carimbo do administrador para outro item → recusado",
  motivos(recusasDeLiberacao({
    antes: obra(item({ liberadoCompra: lote }), item({ codigo: "5.2" })),
    depois: obra(item({ liberadoCompra: lote }), item({ codigo: "5.2", liberadoCompra: lote })),
    pessoa: GC, email: "gc@x.com",
  })),
  ["so-administrador"]);
conf("RN-001 · valor antigo `true` acrescentado por GC → recusado",
  motivos(recusasDeLiberacao({ antes, depois: obra(item({ liberadoCompra: true }), item({ codigo: "5.2" })), pessoa: GC, email: "gc@x.com" })),
  ["so-administrador"]);
conf("RN-001 · e-mail comparado sem caixa nem espaço",
  recusasDeLiberacao({ antes, depois: obra(item({ liberadoCompra: carimbo(" Adm@X.com ") }), item({ codigo: "5.2" })), pessoa: ADMIN, email: "adm@x.com" }),
  []);
conf("RN-001 · categorias ausentes ou malformadas não quebram",
  liberacoesAcrescentadas(null, [{ itens: null }, null]), []);
conf("RN-001 · via alocação exige o marcador verdadeiro",
  [ehLiberacaoPorAlocacao({ viaAlocacao: true }), ehLiberacaoPorAlocacao({ viaAlocacao: "sim" }), ehLiberacaoPorAlocacao(true)],
  [true, false, false]);

console.log(falhas === 0 ? "\nOK — RN-001 conforme a ficha" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
