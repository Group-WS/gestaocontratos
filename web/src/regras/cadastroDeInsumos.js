/**
 * Cadastro de Insumos — as regras que a ADR-008 decidiu (23/09/2026).
 *
 * RN-086 — Só o administrador mantém o cadastro de insumos.
 * RN-087 — Insumo com solicitação enviada ao Sienge não se apaga.
 * RN-088 — A importação só aceita o relatório da tabela ativa.
 * RN-089 — Insumo em "vb" não entra no cadastro.
 *
 * Fichas: docs/regras-de-negocio/RN-086 a RN-089.
 * Garantia no banco: supabase/insumo-cadastro.sql (RN-086 nas policies,
 * RN-087 no gatilho que recusa apagar insumo em uso).
 *
 * Funções puras: não leem banco, sessão nem relógio. Quem busca os dados e
 * grava é o fluxo (a rota /api/insumo-cadastro e a tela Configurações).
 */

/* ---------- RN-086 · só o administrador mantém o cadastro ---------- */

/** RN-086 — os perfis que criam, editam, apagam e importam insumos. */
export const PERFIS_QUE_MANTEM_O_CADASTRO = Object.freeze(["master", "admin"]);

/** RN-086 — esta pessoa pode manter o cadastro de insumos? */
export function podeManterCadastroDeInsumos(pessoa) {
  return !!pessoa && PERFIS_QUE_MANTEM_O_CADASTRO.includes(pessoa.perfil) && pessoa.ativo !== false;
}

/* ---------- RN-087 · em uso no Sienge não se apaga ---------- */

/**
 * RN-087 — as solicitações que contam como "enviadas ao Sienge": a que
 * entrou inteira e a que entrou com algum item recusado. "Enviando" (sem
 * resposta), "falhou" e "abandonado" não deixaram nada certo no Sienge.
 */
export const STATUS_QUE_CONTAM_COMO_ENVIADA = Object.freeze(["concluido", "parcial"]);

/**
 * RN-087 — os itens enviados ao Sienge, a partir das solicitações gravadas.
 *
 * Cada item do corpo enviado leva o insumo em `productId` (o código) e o
 * texto em `notes`. Solicitação fora de `STATUS_QUE_CONTAM_COMO_ENVIADA` não
 * entra.
 *
 * @param {Array<{status?: string, obra_codigo?: string, solicitacao_id?: number|null,
 *   enviado_em?: string|null, payload?: {itens?: Array<{productId?: unknown, notes?: unknown}>}}>} solicitacoes
 * @returns {Array<{codigo: string, texto: string, obraCodigo: string|null, solicitacaoId: number|null, enviadoEm: string|null}>}
 */
export function itensEnviadosAoSienge(solicitacoes) {
  const itens = [];
  for (const s of Array.isArray(solicitacoes) ? solicitacoes : []) {
    if (!STATUS_QUE_CONTAM_COMO_ENVIADA.includes(s?.status)) continue;
    const doCorpo = Array.isArray(s?.payload?.itens) ? s.payload.itens : [];
    for (const i of doCorpo) {
      if (i?.productId === undefined || i?.productId === null) continue;
      itens.push({
        codigo: String(i.productId),
        texto: i.notes === undefined || i.notes === null ? "" : String(i.notes),
        obraCodigo: s.obra_codigo ?? null,
        solicitacaoId: s.solicitacao_id ?? null,
        enviadoEm: s.enviado_em ?? null,
      });
    }
  }
  return itens;
}

/**
 * RN-087 — onde este insumo foi pedido ao Sienge.
 *
 * O insumo está em uso quando algum item enviado tem o MESMO código e o
 * MESMO texto que ele (decisão de 23/09/2026: os outros registros do mesmo
 * código continuam apagáveis). O texto é comparado exatamente como está.
 */
export function usosDoInsumo(insumo, itensEnviados) {
  if (!insumo) return [];
  const codigo = String(insumo.codigo ?? "");
  const texto = String(insumo.descricao ?? "");
  return (Array.isArray(itensEnviados) ? itensEnviados : [])
    .filter((i) => i.codigo === codigo && i.texto === texto);
}

/** RN-087 — este insumo pode ser apagado? (não pode, se foi pedido ao Sienge) */
export function podeApagarInsumo(insumo, itensEnviados) {
  return usosDoInsumo(insumo, itensEnviados).length === 0;
}

/* ---------- RN-088 · só o relatório da tabela ativa ---------- */

const codigoDaTabela = (t) => String(t?.codigo ?? "").trim();
const nomeDaTabela = (t) => String(t?.nome ?? "").replace(/\s+/g, " ").trim().toUpperCase();

/**
 * RN-088 — o relatório é da tabela de preços ativa?
 *
 * - `"confere"`: código e nome batem (o nome sem diferença de caixa ou de
 *   espaço sobrando);
 * - `"so_o_nome_mudou"`: mesmo código, outro nome — a prévia avisa e só
 *   segue com a confirmação do admin;
 * - `"outra"`: outro código — recusado;
 * - `"sem_tabela"`: o relatório não diz a tabela, ou não há tabela ativa —
 *   recusado.
 */
export function conferirTabela(doRelatorio, ativa) {
  if (!codigoDaTabela(doRelatorio) || !codigoDaTabela(ativa)) return "sem_tabela";
  if (codigoDaTabela(doRelatorio) !== codigoDaTabela(ativa)) return "outra";
  return nomeDaTabela(doRelatorio) === nomeDaTabela(ativa) ? "confere" : "so_o_nome_mudou";
}

/** RN-088 — com este resultado, a importação pode seguir? (`confirmouNome`: o admin aceitou o nome novo) */
export function tabelaPermiteImportar(resultado, { confirmouNome = false } = {}) {
  if (resultado === "confere") return true;
  if (resultado === "so_o_nome_mudou") return confirmouNome === true;
  return false;
}

/* ---------- RN-089 · "vb" fica fora ---------- */

/** RN-089 — a unidade é "vb" (valor fechado: taxa, alvará, IPTU)? */
export function unidadeEmVb(unidade) {
  return String(unidade ?? "").trim().toLowerCase() === "vb";
}

/** RN-089 — esta linha do relatório entra no cadastro? */
export function entraNoCadastro(linha) {
  return !!linha && !unidadeEmVb(linha.unidade);
}
