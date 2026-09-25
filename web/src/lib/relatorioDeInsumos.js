/**
 * O relatório "Insumos" do Sienge e o plano de importá-lo no Cadastro de
 * Insumos (ADR-008, 23/09/2026).
 * -----------------------------------------------------------
 * Duas funções puras, sem rede e sem banco — por isso moram aqui, testáveis:
 *
 *   lerRelatorioDeInsumos(linhas)  — confere o modelo e separa o que entra,
 *                                    o que fica de fora e por quê;
 *   planejarImportacao({...})      — compara o que entra com o cadastro de
 *                                    hoje e diz o que inserir, atualizar,
 *                                    perguntar e apagar.
 *
 * Quem lê o xlsx e grava é a rota (web/api/_lib/rotas/insumoCadastro.js):
 * ela entrega aqui as linhas cruas da aba (`sheet_to_json` com `header: 1`).
 *
 * O modelo do relatório (decisões dos itens 1 a 3 da ADR-008):
 *   - no topo, a linha "Tabela" com "N - NOME DA TABELA";
 *   - o cabeçalho com Código, Descrição e Unidade — achado pelo NOME, não
 *     pela posição, para uma mudança no topo do relatório não quebrar a
 *     leitura;
 *   - no rodapé, a data e a hora da geração e a marca "SIENGE".
 * A descrição é gravada EXATAMENTE como veio, espaços inclusive, e é ela,
 * junto do código, que identifica o insumo.
 */

import { entraNoCadastro, podeApagarInsumo, usosDoInsumo } from "../regras/cadastroDeInsumos.js";

/** Até quantas linhas cada lista da prévia devolve (o número total vem à parte). */
export const LIMITE_DA_LISTA = 500;

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const rotulo = (s) => semAcento(s).replace(/\s+/g, " ").trim().toLowerCase();
const vazio = (v) => v === undefined || v === null || String(v).trim() === "";
const chave = (codigo, descricao) => `${codigo}\u0000${descricao}`;
const juntarEspacos = (s) => String(s).replace(/\s+/g, " ").trim();

const DATA_DO_RODAPE = /^\s*(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2}):(\d{2})(?::(\d{2}))?\s*$/;
const TABELA_DO_TOPO = /^\s*(\d+)\s*-\s*(.+?)\s*$/;

/** "1 - TABELA WS BUILDING" -> { codigo: "1", nome: "TABELA WS BUILDING" }. */
export function separarTabela(texto) {
  const m = TABELA_DO_TOPO.exec(String(texto ?? ""));
  return m ? { codigo: m[1], nome: m[2] } : null;
}

/** "21/09/2026 - 21:12:13" -> "2026-09-21T21:12:13-03:00" (o relatório sai no horário de Brasília). */
export function dataDoRodape(texto) {
  const m = DATA_DO_RODAPE.exec(String(texto ?? ""));
  if (!m) return null;
  const [, dia, mes, ano, hora, minuto, segundo = "00"] = m;
  return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}-03:00`;
}

const celulasDe = (linha) => (Array.isArray(linha) ? linha : []);
const primeiraPreenchida = (linha) => celulasDe(linha).find((c) => !vazio(c));

function acharCabecalho(linhas) {
  for (let i = 0; i < Math.min(linhas.length, 60); i++) {
    const rotulos = celulasDe(linhas[i]).map(rotulo);
    const iCod = rotulos.indexOf("codigo");
    const iDesc = rotulos.indexOf("descricao");
    const iUn = rotulos.indexOf("unidade");
    if (iCod >= 0 && iDesc >= 0 && iUn >= 0) return { indice: i, iCod, iDesc, iUn };
  }
  return null;
}

function acharTabela(linhas, ate) {
  for (let i = 0; i < ate; i++) {
    const celulas = celulasDe(linhas[i]);
    const iRotulo = celulas.findIndex((c) => rotulo(c) === "tabela");
    if (iRotulo < 0) continue;
    const valor = celulas.slice(iRotulo + 1).find((c) => !vazio(c));
    const tabela = separarTabela(valor);
    return tabela ? { ...tabela, texto: String(valor).trim() } : { codigo: "", nome: "", texto: String(valor ?? "").trim() };
  }
  return null;
}

function acharRodape(linhas, depoisDe) {
  for (let i = linhas.length - 1; i > depoisDe; i--) {
    const celulas = celulasDe(linhas[i]);
    const data = dataDoRodape(primeiraPreenchida(celulas));
    const marca = celulas.some((c) => /sienge/i.test(String(c ?? "")));
    if (data && marca) return { indice: i, geradoEm: data };
  }
  return null;
}

/**
 * Confere o modelo e separa as linhas.
 *
 * @param {unknown[][]} linhas as linhas cruas da primeira aba
 * @returns {{
 *   ok: boolean, erros: string[],
 *   tabela: {codigo: string, nome: string, texto: string} | null, geradoEm: string | null,
 *   registros: Array<{linhaExcel: number, codigo: string, descricao: string, unidade: string}>,
 *   resumo: {linhas: number, vb: number, vbCodigos: number, repetidas: number, fora: number, entram: number, codigos: number, pares: number},
 *   listas: {fora: object[], repetidas: object[], pares: object[]}
 * }}
 */
export function lerRelatorioDeInsumos(linhas) {
  const todas = Array.isArray(linhas) ? linhas : [];
  const erros = [];
  const cabecalho = acharCabecalho(todas);
  if (!cabecalho) erros.push("O cabeçalho com as colunas Código, Descrição e Unidade não foi encontrado.");
  const tabela = acharTabela(todas, cabecalho ? cabecalho.indice : Math.min(todas.length, 60));
  if (!tabela) erros.push('A linha "Tabela" do topo do relatório não foi encontrada.');
  else if (!tabela.codigo) erros.push(`A tabela do topo ("${tabela.texto}") não está no formato "número - nome".`);
  const rodape = acharRodape(todas, cabecalho ? cabecalho.indice : -1);
  if (!rodape) erros.push("O rodapé com a data de geração e a marca do Sienge não foi encontrado.");

  const resumoVazio = { linhas: 0, vb: 0, vbCodigos: 0, repetidas: 0, fora: 0, entram: 0, codigos: 0, pares: 0 };
  if (erros.length) {
    return { ok: false, erros, tabela, geradoEm: rodape?.geradoEm ?? null, registros: [],
      resumo: resumoVazio, listas: { fora: [], repetidas: [], pares: [] } };
  }

  const { iCod, iDesc, iUn } = cabecalho;
  const fora = [];
  const repetidas = [];
  const registros = [];
  const vistos = new Map();
  const codigosEmVb = new Set();
  let nLinhas = 0;
  let vb = 0;

  for (let i = cabecalho.indice + 1; i < rodape.indice; i++) {
    const celulas = celulasDe(todas[i]);
    if (celulas.every(vazio)) continue;
    nLinhas += 1;
    const linhaExcel = i + 1;
    const bruto = { codigo: celulas[iCod], descricao: celulas[iDesc], unidade: celulas[iUn] };
    const codigo = vazio(bruto.codigo) ? "" : String(bruto.codigo).trim();
    // A descrição fica como veio: é ela que identifica o insumo (item 2 da ADR-008).
    const descricao = vazio(bruto.descricao) ? "" : String(bruto.descricao);
    const unidade = vazio(bruto.unidade) ? "" : String(bruto.unidade);

    const motivo = !codigo ? "sem código"
      : !/^\d{1,10}$/.test(codigo) ? "código não é um número"
        : !descricao ? "sem descrição"
          : !unidade ? "sem unidade"
            : null;
    if (motivo) {
      fora.push({ linhaExcel, motivo, codigo, descricao, unidade });
      continue;
    }
    const linha = { linhaExcel, codigo, descricao, unidade };
    // RN-089 — "vb" (valor fechado) não entra no cadastro.
    if (!entraNoCadastro(linha)) {
      vb += 1;
      codigosEmVb.add(codigo);
      continue;
    }
    const k = chave(codigo, descricao);
    if (vistos.has(k)) {
      repetidas.push({ linhaExcel, igualALinha: vistos.get(k), codigo, descricao });
      continue;
    }
    vistos.set(k, linhaExcel);
    registros.push(linha);
  }

  // Parecidos: só o espaço difere. Entram como dois registros (item 3), mas a prévia avisa.
  const porTextoLimpo = new Map();
  for (const r of registros) {
    const k = chave(r.codigo, juntarEspacos(r.descricao));
    if (!porTextoLimpo.has(k)) porTextoLimpo.set(k, []);
    porTextoLimpo.get(k).push(r);
  }
  const pares = [...porTextoLimpo.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({ codigo: g[0].codigo, linhas: g.map(({ linhaExcel, descricao }) => ({ linhaExcel, descricao })) }));

  return {
    ok: true,
    erros: [],
    tabela,
    geradoEm: rodape.geradoEm,
    registros,
    resumo: {
      linhas: nLinhas,
      vb,
      vbCodigos: codigosEmVb.size,
      repetidas: repetidas.length,
      fora: fora.length,
      entram: registros.length,
      codigos: new Set(registros.map((r) => r.codigo)).size,
      pares: pares.length,
    },
    listas: { fora, repetidas, pares },
  };
}

/** O registro foi editado na tela depois de vir do Sienge? */
export function editadoNaTela(atual) {
  return atual.origem === "sienge" && (
    atual.codigo !== atual.sienge_codigo
    || atual.descricao !== atual.sienge_descricao
    || atual.unidade !== atual.sienge_unidade
  );
}

const valoresDe = (x) => ({ codigo: x.codigo, descricao: x.descricao, unidade: x.unidade });
const mesmosValores = (a, b) => a.codigo === b.codigo && a.descricao === b.descricao && a.unidade === b.unidade;

/**
 * O plano da importação: o relatório contra o cadastro de hoje.
 *
 * Regras que ele segue (itens 1, 4 e 5 da ADR-008):
 *   - o registro vindo do Sienge é reconhecido pelo código e pela descrição
 *     com que chegou (`sienge_codigo`, `sienge_descricao`), mesmo que tenha
 *     sido editado depois;
 *   - o que veio no relatório volta a Ativo = Sim;
 *   - registro editado na tela que o relatório traz diferente é CONFLITO:
 *     só segue com a escolha do admin ("relatorio" ou "edicao");
 *   - registro criado na tela nunca é tocado — nem quando o relatório traz
 *     o mesmo código e descrição (a linha do relatório fica de fora);
 *   - no caminho "apagar", sai o que veio do Sienge e não veio agora, menos
 *     o que já foi pedido ao Sienge (RN-087), que fica e é listado;
 *   - no caminho "manter", nada sai.
 *
 * @param {object} p
 * @param {Array<{codigo: string, descricao: string, unidade: string}>} p.registros o que entra (lerRelatorioDeInsumos)
 * @param {Array<object>} p.atuais o cadastro de hoje (id, codigo, descricao, unidade, ativo, origem, sienge_*)
 * @param {Array<object>} p.itensEnviados os itens enviados ao Sienge (RN-087)
 * @param {"apagar"|"manter"|null} [p.caminho] o caminho escolhido (null na prévia: calcula os dois)
 * @param {Record<string, "relatorio"|"edicao">} [p.conflitos] as escolhas do admin, por id
 */
export function planejarImportacao({ registros, atuais, itensEnviados, caminho = null, conflitos = {} }) {
  const porChaveDoSienge = new Map();
  const porChaveAtual = new Map();
  for (const a of Array.isArray(atuais) ? atuais : []) {
    if (a.origem === "sienge") porChaveDoSienge.set(chave(a.sienge_codigo, a.sienge_descricao), a);
    porChaveAtual.set(chave(a.codigo, a.descricao), a);
  }

  const inserir = [];
  const atualizar = [];
  const listaDeConflitos = [];
  const jaExistem = [];
  const vieram = new Set();
  let semMudanca = 0;
  let reativados = 0;

  for (const r of Array.isArray(registros) ? registros : []) {
    const k = chave(r.codigo, r.descricao);
    const doSienge = porChaveDoSienge.get(k);
    if (doSienge) {
      vieram.add(doSienge.id);
      const snapshot = { sienge_codigo: r.codigo, sienge_descricao: r.descricao, sienge_unidade: r.unidade };
      if (editadoNaTela(doSienge) && !mesmosValores(doSienge, r)) {
        // Voltar ao texto do relatório só dá se ninguém mais usa esse código + descrição.
        const ocupante = porChaveAtual.get(k);
        const podeUsarRelatorio = !ocupante || ocupante.id === doSienge.id;
        const pedida = conflitos?.[String(doSienge.id)] ?? null;
        const escolha = pedida === "relatorio" && !podeUsarRelatorio ? "edicao" : pedida;
        listaDeConflitos.push({ id: doSienge.id, atual: valoresDe(doSienge), relatorio: valoresDe(r), escolha, podeUsarRelatorio });
        if (escolha === "relatorio") atualizar.push({ id: doSienge.id, ...valoresDe(r), ...snapshot, ativo: true });
        else if (escolha === "edicao") atualizar.push({ id: doSienge.id, ...valoresDe(doSienge), ...snapshot, ativo: true });
        continue;
      }
      const mudou = !mesmosValores(doSienge, r) || doSienge.sienge_unidade !== r.unidade;
      if (mudou || doSienge.ativo !== true) {
        if (doSienge.ativo !== true) reativados += 1;
        atualizar.push({ id: doSienge.id, ...valoresDe(r), ...snapshot, ativo: true });
      } else {
        semMudanca += 1;
      }
      continue;
    }
    const mesmoTexto = porChaveAtual.get(k);
    if (mesmoTexto) {
      // Criado na tela (ou editado até ficar igual): intocado; a linha do relatório fica de fora.
      jaExistem.push({ id: mesmoTexto.id, codigo: r.codigo, descricao: r.descricao, origem: mesmoTexto.origem });
      continue;
    }
    inserir.push(valoresDe(r));
  }

  const naoVieram = (Array.isArray(atuais) ? atuais : [])
    .filter((a) => a.origem === "sienge" && !vieram.has(a.id));
  const sairiam = [];
  const ficamEmUso = [];
  for (const a of naoVieram) {
    // RN-087 — o que já foi pedido ao Sienge não sai, nem pela importação.
    if (podeApagarInsumo(a, itensEnviados)) sairiam.push({ id: a.id, ...valoresDe(a) });
    else ficamEmUso.push({ id: a.id, ...valoresDe(a), usos: usosDoInsumo(a, itensEnviados) });
  }

  return {
    inserir,
    atualizar,
    conflitos: listaDeConflitos,
    conflitosSemEscolha: listaDeConflitos.filter((c) => c.escolha !== "relatorio" && c.escolha !== "edicao").length,
    jaExistem,
    naoVieram: naoVieram.length,
    // No caminho "manter" nada sai; na prévia (sem caminho) a lista vale para o "apagar".
    apagar: caminho === "manter" ? [] : sairiam,
    ficamEmUso: caminho === "manter" ? [] : ficamEmUso,
    semMudanca,
    reativados,
  };
}

/** Corta uma lista para a prévia, dizendo quantas ficaram de fora do corte. */
export function cortar(lista, limite = LIMITE_DA_LISTA) {
  const itens = Array.isArray(lista) ? lista : [];
  return { itens: itens.slice(0, limite), total: itens.length };
}
