import React, { useState, useMemo, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2, XCircle,
  Search, Building2, ClipboardList, ShoppingCart, ArrowUpRight,
  ArrowDownRight, Minus, Check, Link2, PackageSearch, Bell, Sparkles,
  ArrowLeftRight, ArrowDown, CornerDownRight,
  LayoutGrid, FileText, Download, SlidersHorizontal, X, Upload, Clock, Copy, GitCompare, Plus,
  Lock, BookOpen, ShieldCheck, Play, Archive, RotateCcw, Sparkle, Package, Trash2, LogOut, DollarSign,
  MapPin
} from "lucide-react";
import { listarObras, iniciarObra, concluirObra, reabrirObra, definirGC, definirTailorMade,
  definirResponsavelExecutivo, faltandoNaTela } from "./lib/obras";
import { listarPessoas, salvarPessoa, excluirPessoa, garantirPessoa, nomeDoEmail, CARGOS,
  PERFIS, perfilDe, podeVerModulo, obrasPermitidas, podeEditar as perfilEdita, migracaoDePerfilFeita,
  podeGerenciarPessoas, temAcesso, estaPendente, pendentes, ehOUltimoAdmin } from "./lib/pessoas";
import { mensagemDoDia } from "./lib/mensagemDoDia";
import { STATUS_ADITIVO, CONDICOES_PADRAO, novoItem, novoGrupo, novoDocumento,
  parseNum as parseNumAd, totalItem, totalGrupo, totalSecao, totaisDoDocumento,
  rotuloSaldo, numeroAditivo, proximaSeq, linkPipefy, pipefyPendente } from "./lib/aditivoDoc";
import { listarAditivos, criarAditivo, salvarAditivo, excluirAditivo } from "./lib/aditivos";
import { LOGO_WS, RODAPE_WS } from "./lib/marcaWS";
import { subgrupoDe } from "./lib/catalogoModelo.js";
import { listarSiengeObras, marcarStatusSienge } from "./lib/siengeObra.js";
import { definirEapPadrao, eapAtual, carregarEapDoBanco } from "./lib/eap";
import Catalogo from "./Catalogo";
import { padraoDaDescricao, carregarAlocacoesDoBanco, salvarAlocacaoPadrao } from "./lib/alocacaoPadrao";
import { MODELOS_ESCOPO, modelosPorGrupo, modeloSugerido } from "./lib/escopos";
import {
  ratearParcelas, ajustarQtdParcelas, sugerirDatas, somaParcelas, parcelasPadrao,
} from "./lib/parcelas";
import { descricaoSienge, codigoAuxiliarDe, sortearAuxiliares, agruparPorMae, acharMaes, ordenarDetalhes, podeAssociarSozinho, cobertura, lerListaDeProdutos, lerListaDeProdutosPDF, lerCotacaoPDF, montarTemplateSienge, faltaNoTemplate, norm as normSienge } from "./lib/sienge";
import { parsePedidoSienge, parsePedidoSiengeExcel, conferirComSienge } from "./lib/siengePedido";
import { listarPrecos, contarPrecos, salvarPrecos, sugerirPrecos, carregarTodosInsumos } from "./lib/insumos";
import { supabase, supabaseConfigurado } from "./lib/supabase";
import { carregarResumoDeVarias, carregarDadosObra, salvarDadosObra, pegarEdicao, liberarEdicao, MINUTOS_ATE_TRAVA_EXPIRAR } from "./lib/dadosObra";
import { subirArquivo, linkParaBaixar, linkParaArquivo, apagarArquivo, anexoRecuperavel, EXTENSOES_ACEITAS, tipoAceito } from "./lib/arquivos";

// O backend mora no mesmo domínio do site (função serverless da Vercel,
// em web/api/), então "/api/..." resolve sozinho — em dev pelo proxy do
// Vite, publicado pela própria Vercel. VITE_API_BASE só é necessária no
// caso raro de apontar pra um backend em outro domínio.
const API_BASE = import.meta.env.VITE_API_BASE || "";
const api = (path) => API_BASE + path;

/* ============================================================
   EAP PADRÃO
   A estrutura de verbas é sempre a mesma para toda obra — quando
   uma obra não tem nada lançado numa verba, ela ainda aparece,
   zerada, em vez de sumir da lista.
   ============================================================ */

/* A EAP oficial da empresa.

   "Execucao e Mao de Obra" SAIU: ela existia pra receber mao de obra
   solta, e mao de obra agora fica dentro do proprio grupo — a da
   iluminacao e da iluminacao. Grupo com esse nome que ainda venha de
   documento antigo nao e descartado: vai pro fim da lista marcado como
   fora do padrao, com o dinheiro dele contando no CMV do mesmo jeito. */
const EAP_CODIGO = [
  { num: "01", nome: "Arquitetura e Engenharia" },
  { num: "02", nome: "Serviços Complementares" },
  { num: "03", nome: "Civil" },
  { num: "04", nome: "Impermeabilização" },
  { num: "05", nome: "Instalações Elétricas e Iluminação" },
  { num: "06", nome: "Instalações Hidrosanitárias" },
  { num: "07", nome: "Instalações Preventivo de Incêndio" },
  { num: "08", nome: "Instalações de Comunicação e Dados" },
  { num: "09", nome: "Sistema de Gás" },
  { num: "10", nome: "Gesso e Drywall" },
  { num: "11", nome: "Revestimento Cerâmico" },
  { num: "12", nome: "Elementos em Madeira" },
  { num: "13", nome: "Piso Vinílico e Carpete" },
  { num: "14", nome: "Papel de Parede" },
  { num: "15", nome: "Rodapés e Boiseries" },
  { num: "16", nome: "Revestimentos Especiais" },
  { num: "17", nome: "Parede Verde" },
  { num: "18", nome: "Pintura" },
  { num: "19", nome: "Esquadrias" },
  { num: "20", nome: "Climatização / Exaustão" },
  { num: "21", nome: "Móveis Sob Medida" },
  { num: "22", nome: "Serralheria" },
  { num: "23", nome: "Vidros e Espelhos" },
  { num: "24", nome: "Móveis Soltos" },
  { num: "25", nome: "Estofados" },
  { num: "26", nome: "Pedras — Mármores e Granitos" },
  { num: "27", nome: "Louças, Metais e Equipamentos Especiais" },
  { num: "28", nome: "Eletroeletrônico" },
  { num: "29", nome: "Adega Climatizada" },
  { num: "30", nome: "Cortinas e Persianas" },
  { num: "31", nome: "Itens Decorativos" },
  { num: "33", nome: "Equipamentos de Lazer" },
  { num: "34", nome: "Mobiliário Corporativo" },
];


/* A EAP que esta valendo agora.

   O codigo e a SEMENTE, o banco e a fonte oficial. `definirEapPadrao`
   abaixo planta a semente no carregamento do modulo; quando a tabela
   `eap_grupo` responde, ela substitui. Se o banco falhar ou vier vazio, o
   app segue com a semente — ficar sem EAP e pior que ficar com uma
   desatualizada, porque sem grupo todo item importado e descartado. */
// Os acessores caem no código quando o banco ainda não respondeu.
//
// Isto já foi uma chamada `definirEapPadrao(...)` aqui em cima, no corpo
// do módulo — e derrubava o app inteiro: APELIDOS_CODIGO é declarado ~950
// linhas abaixo, e `const` não pode ser lido antes da declaração. O
// módulo lançava ReferenceError ao carregar e a tela ficava em branco. O
// build não pega isso, porque só quebra em execução.
//
// Como função, a leitura acontece depois do módulo inteiro carregar, e a
// ordem das declarações deixa de importar.
const eapPadrao = () => eapAtual()?.grupos || EAP_CODIGO;
const apelidosVerba = () => eapAtual()?.apelidos || APELIDOS_CODIGO;
const verbasNaoAnalisadas = () => eapAtual()?.naoAnalisadas || NAO_ANALISADAS_CODIGO;

function buildCategorias(overrides, extra) {
  const base = eapPadrao().map((c) => {
    const o = overrides.find((x) => x.num === c.num);
    if (!o) return { ...c, vendido: 0, executivo: 0 };
    return { ...c, vendido: o.vendido ?? 0, executivo: o.executivo ?? 0, itens: o.itens };
  });
  if (extra) base.push({ ...extra, foraDeEscopoCategoria: true, foraDaEapPadrao: true });
  return base;
}

const fmtBRL = (v) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCompactBRL = (v) => {
  if (v == null) return "—";
  if (Math.abs(v) >= 1000000) return `R$ ${(v / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m`;
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}mil`;
  return fmtBRL(v);
};


/* ============================================================
   INTEGRAÇÃO MONDAY
   A lista de obras vem dos workspaces do Monday (um workspace por
   squad; cada board é uma obra). O detalhe Vendido × Executivo por
   verba não existe no Monday — toda obra chega com a EAP zerada, e é
   populada pelos uploads reais (Vendido Contrato/Planilha, Executivo).
   ============================================================ */

const SQUADS = [
  { nome: "Squad Sun", workspaceId: "13339794" },
  { nome: "Squad Moon", workspaceId: "14451479" },
  { nome: "Squad Comet", workspaceId: "13339790" },
];

// "R$ 1.234,56" -> 1234.56 ; vazio -> null
// Converte valor pra número, entendendo o formato brasileiro em texto
// ("R$ 1.234,56" → 1234.56).
//
// Cuidado que custou caro: quando vem do Excel, o valor JÁ É número, e
// aí o ponto é a casa decimal, não separador de milhar. Convertendo pra
// texto e apagando os pontos, 223.38 virava 22338 — todos os custos de
// planilha Excel saíam inflados em milhões. Número entra e sai
// intocado; só texto passa pela conversão.
function parseBRL(txt) {
  if (txt == null || txt === "") return null;
  if (typeof txt === "number") return Number.isFinite(txt) ? txt : null;
  const n = Number(String(txt).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// converte uma obra vinda do Monday para o formato que o app consome —
// sempre com a EAP zerada; os uploads reais é que preenchem os dados.
function mondayObraParaApp(mo, squadNome) {
  // O código é a chave da obra aqui e no banco. Nem toda obra do Monday
  // tem um preenchido, e duas sem código colidiriam entre si — por isso
  // o boardId (único por board) serve de reserva.
  const codigo = mo.codigo || mo.boardId;
  return {
    id: codigo,
    codigo,
    nome: mo.nome,
    squad: squadNome,
    boardId: mo.boardId,
    endereco: mo.localizacao || "—",
    cliente: mo.comercialResp || "—",
    gc: mo.gcResponsavel || null,
    area: null,
    prazo: null,
    valorVendido: parseBRL(mo.cmvOrcado) || 0,
    categorias: buildCategorias([], null),
    semDetalhe: true,
  };
}

// busca as obras de UM squad (workspace) e já converte pro formato do app.
// Aborta em 25s pra não deixar o app preso caso o Monday esteja lento.
async function fetchSquadObras(squad) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(api(`/api/monday/obras-execucao?workspaceId=${squad.workspaceId}`), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Squad ${squad.nome}: HTTP ${res.status}`);
    const lista = await res.json();
    return lista.map((mo) => mondayObraParaApp(mo, squad.nome));
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
   LÓGICA DE STATUS / CÁLCULOS
   ============================================================ */

function categoriaStatus(cat) {
  if (cat.foraDeEscopoCategoria) return "critico";
  if (cat.vendido === 0 && cat.executivo === 0) return "vazio";
  if (cat.vendido === 0 && cat.executivo > 0) return "critico";
  if (cat.executivo === 0) return "pendente";
  const pct = ((cat.executivo - cat.vendido) / cat.vendido) * 100;
  if (pct > 15) return "critico";
  if (pct > 0) return "atencao";
  return "ok";
}

function itemAlertas(it) {
  const alertas = [];
  if (it.foraDeEscopo && it.statusEscopo !== "aprovado") alertas.push("escopo");
  if (it.excedeQtd) alertas.push("qtd");
  if (it.novoSemCorrespondencia) alertas.push("novo");
  return alertas;
}

const CONTRATO_STAGES = {
  solicitacao: { label: "Solicitação de contrato enviada", color: "var(--ink-3)", bg: "var(--panel)" },
  aprovacao: { label: "Aguardando aprovação do contrato", color: "var(--amber)", bg: "var(--amber-bg)" },
  contrato_gerado: { label: "Contrato gerado", color: "var(--blue)", bg: "var(--blue-bg)" },
  previsao_medicao: { label: "Previsão de medição lançada", color: "var(--blue)", bg: "var(--blue-bg)" },
  medicao_liberada: { label: "Medição liberada — NF anexada", color: "var(--green)", bg: "var(--green-bg)" },
};

function ContratoStatus({ item }) {
  if (item.foraDeEscopo && item.statusEscopo !== "aprovado") {
    return <span className="contrato-blocked">Bloqueado — aguardando aprovação de escopo</span>;
  }
  if (!item.statusContrato) return <span className="dim">Contrato ainda não solicitado</span>;
  const s = CONTRATO_STAGES[item.statusContrato];
  return <span className="contrato-pill" style={{ color: s.color, background: s.bg }}>{s.label}</span>;
}

const STATUS_META = {
  ok: { label: "Dentro do orçado", color: "var(--green)" },
  atencao: { label: "Acima do orçado", color: "var(--amber)" },
  critico: { label: "Estouro crítico", color: "var(--red)" },
  pendente: { label: "Ainda não detalhado", color: "var(--ink-3)" },
  vazio: { label: "Não se aplica a esta obra", color: "var(--ink-3)" },
};

function obraAlertCount(o) {
  return o.categorias.reduce((acc, c) => {
    const s = categoriaStatus(c);
    let n = s === "critico" ? 1 : 0;
    (c.itens || []).forEach((it) => { if (itemAlertas(it).length) n += 1; });
    return acc + n;
  }, 0);
}

/* Quanto de MATERIAL a obra tem, e quanto dele ja foi comprado.
 *
 * Duas coisas estavam erradas aqui, e as duas pelo mesmo motivo — este
 * calculo ficou parado no modelo antigo enquanto o resto do app mudou:
 *
 *   1. Filtrava por `it.tipo === "produto"`. O campo de UMA escolha, de
 *      novo: o item marcado como servico com material lancado ficava de
 *      fora, e o spot com as duas parcelas entrava inteiro.
 *   2. Somava `it.custo`, que inclui a mao de obra. O "% comprado" do
 *      Dashboard media compra contra um total que tinha contrato dentro.
 *
 * Agora e a PARCELA de material, a mesma base da tela de Compras de
 * Produtos — senao o Dashboard e a tela de compras dao numeros
 * diferentes pra mesma pergunta, e ninguem sabe em qual acreditar. */
function obraComprasStats(o) {
  let totalProdutos = 0, totalComprado = 0;
  /* Com os aditivos dentro. O que o Plano de Compras LISTA e o que o
     Dashboard CONTA tem que ser a mesma coisa — duas telas somando bases
     diferentes e' como a pessoa descobre que nao pode confiar em nenhuma
     das duas. */
  categoriasComAditivos(o.categorias, o.aditivos).forEach((c) => (c.itens || []).forEach((it) => {
    if (it.ehTitulo) return;
    const { material } = parcelasDoItem(it, c);
    if (material <= 0 && alocacaoDoItem(it, c) !== ALOC_MAT) return;
    totalProdutos += material;
    if (it.comprado) totalComprado += material;
  }));
  const pct = totalProdutos > 0 ? (totalComprado / totalProdutos) * 100 : 0;
  return { totalProdutos, totalComprado, falta: totalProdutos - totalComprado, pct };
}

/* O mesmo calculo de `obraComprasStats`, do lado da MAO DE OBRA — pra
   responder "quanto ja foi contratado", nao "quanto ja foi comprado".
   Contratado usa a mesma etapa que o resto do app usa pra saber se um
   servico ja foi solicitado (`contratoEtapa`), nao um campo novo. */
function obraContratosStats(o) {
  let totalServicos = 0, totalContratado = 0;
  categoriasComAditivos(o.categorias, o.aditivos).forEach((c) => (c.itens || []).forEach((it) => {
    if (it.ehTitulo) return;
    const { mo } = parcelasDoItem(it, c);
    if (mo <= 0 && alocacaoDoItem(it, c) !== ALOC_MO) return;
    totalServicos += mo;
    if (contratoEtapa(it) !== "nao_solicitado") totalContratado += mo;
  }));
  const pct = totalServicos > 0 ? (totalContratado / totalServicos) * 100 : 0;
  return { totalServicos, totalContratado, falta: totalServicos - totalContratado, pct };
}

function matchesFilter(it, filter, cat) {
  if (filter === "todos") return true;
  if (filter === "alerta") return itemAlertas(it).length > 0;
  /* Só quem tem material passa pelo fluxo de compras.

     Antes o teste era `it.tipo !== "produto"`. Como a alocação sai das
     PARCELAS e não desse campo, um item marcado como serviço mas com a
     coluna de material preenchida aparecia na lista como MAT e sumia ao
     filtrar "Liberado p/ compra" — a mesma tela dizendo as duas coisas. */
  if (alocacaoDoItem(it, cat) === ALOC_MO) return false;
  /* "Liberado" e "Aguardando" sairam.

     Eles liam `it.liberado`, que ficou inalcancavel quando o botao de
     incluir/tirar do plano deu lugar a coluna Destino. Filtro que sempre
     devolve a mesma coisa e pior que filtro nenhum: a pessoa clica,
     nada muda, e passa a desconfiar dos outros.

     No lugar entrou "Sem destino", que e a pergunta que a tela de fato
     responde agora — o que ainda ninguem disse por onde compra. */
  if (filter === "sem_destino") return !it.canalCompra && !it.comprado;
  if (filter === "comprado") return it.comprado === true;
  if (filter === "falta") return !it.comprado;
  return true;
}

/* Texto de um PDF — cru primeiro, base64 se o cru chegar corrompido.
 *
 * A Vercel mexe no corpo binario de alguns arquivos. A cotacao da
 * Macrosul (5,9 KB, quase toda ASCII) chegava corrompida e o leitor
 * acusava "bad XRef entry"; o MESMO arquivo, no MESMO codigo, passa por
 * HTTP local. Base64 atravessa qualquer camada que trate o corpo como
 * texto, ao custo de 33% a mais de bytes — por isso ele e' a segunda
 * tentativa, e nao a primeira. */
async function textoDoPDF(buf) {
  const cru = await fetch(api("/api/sienge/texto"), {
    method: "POST", headers: { "Content-Type": "application/pdf" }, body: buf,
  });
  if (cru.ok) return (await cru.json()).texto;

  const erro = await cru.json().catch(() => ({}));
  if (!erro.podeBase64) throw new Error(erro.error || `HTTP ${cru.status}`);

  const b64 = btoa(Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join(""));
  const res = await fetch(api("/api/sienge/texto"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdfBase64: b64 }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return (await res.json()).texto;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvCell(v) { return `"${String(v ?? "").replace(/"/g, '""')}"`; }

function exportVendidoCSV(obra) {
  const rows = [["Código", "Verba", "Valor Vendido (R$)"]];
  obra.categorias.forEach((c) => rows.push([c.num, c.nome, c.vendido.toFixed(2).replace(".", ",")]));
  rows.push(["", "TOTAL CONTRATO", obra.valorVendido.toFixed(2).replace(".", ",")]);
  const csv = rows.map((r) => r.map(csvCell).join(";")).join("\n");
  downloadFile(`vendido_obra_${obra.codigo}.csv`, csv, "text/csv;charset=utf-8;");
}

function exportExecutivoCSV(obra) {
  const rows = [["Verba", "Código", "Descrição", "Alocação", "Ambiente", "Qtd. Executivo", "Custo Total (R$)", "Destino"]];
  obra.categorias.forEach((cat) => (cat.itens || []).forEach((it) => {
    rows.push([
      cat.nome, it.codigo, it.desc, ROTULO_ALOC[alocacaoDoItem(it, cat)] || "—",
      it.ambiente || "", it.qtdExecutivo ?? it.qtdVendida ?? "", (it.custo ?? 0).toFixed(2).replace(".", ","),
      it.comprado ? "Comprado" : (it.canalCompra ? canalPorId(it.canalCompra)?.nome : "Sem destino"),
    ]);
  }));
  const csv = rows.map((r) => r.map(csvCell).join(";")).join("\n");
  downloadFile(`executivo_obra_${obra.codigo}.csv`, csv, "text/csv;charset=utf-8;");
}

/* ============================================================
   COMPONENTES PEQUENOS
   ============================================================ */



/* DASHBOARD DA OBRA

   Antes era uma grade de sete caixas do mesmo tamanho, todas gritando
   igual: quem abria nao sabia onde olhar primeiro. Agora sao tres
   perguntas, na ordem em que se faz:

     1. O executivo cabe no que foi vendido?
     2. Quanto ja foi comprado, e ate quando da pra comprar?
     3. Tem algo pedindo atencao?

   A ultima faixa fica VERDE E CURTA quando nao ha nada — painel que
   sempre mostra as mesmas seis caixas ensina a nao olhar pra ele. */
/* O nome cadastrado, com o e-mail como plano B. Alguem pode ter virado
   GC de uma obra antes de estar na Equipe — melhor "Priscila Wayhs"
   deduzido do e-mail que um e-mail cru no meio da tela. */
function nomeNaEquipe(equipe, email) {
  const p = (equipe || []).find((x) => x.email === String(email || "").toLowerCase());
  return p?.nome || nomeDoEmail(email);
}

/* Quem responde por UM papel da obra (GC, Tailor Made, Executivo...).
   Guarda o e-mail; mostra o nome. Generalizado a partir do que era só
   `GcDaObra` — os três papéis de "Equipe da obra" usam o mesmo
   componente, só trocando rótulo, valor e o que salvar.

   Sem ninguém no papel a obra continua visível pra todo mundo — de
   proposito enquanto os vinculos nao estao feitos, porque esconder o
   que nao tem dono deixaria obra viva fora da tela de todos. Mas fica
   DITO, senao vira silencio. */
function PapelDaObra({ obraId, valor: valorAtual, rotulo, vazio, equipe, podeEditar, prioridade, onDefinir }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(valorAtual || "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  useEffect(() => { setValor(valorAtual || ""); setEditando(false); }, [valorAtual, obraId]);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      await onDefinir(valor.trim() || null);
      setEditando(false);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setSalvando(false);
    }
  }

  if (!editando) {
    return (
      <>
        {valorAtual ? (
          <>
            <div className="dash-gc-nome">{nomeNaEquipe(equipe, valorAtual)}</div>
            <div className="dash-gc-email mono">{valorAtual}</div>
          </>
        ) : (
          <div className="dash-gc-vazio">{vazio}</div>
        )}
        {podeEditar && (
          <button className="btn-atalho dash-atalho" onClick={() => setEditando(true)}>
            {valorAtual ? `Trocar` : `Definir`}
          </button>
        )}
      </>
    );
  }

  /* ESCOLHER, e nao digitar. E-mail digitado erra, e um caractere trocado
     deixa a obra sem dono sem ninguem perceber. Quem tem o cargo certo
     (quando `prioridade` existe) vem primeiro; o resto continua na
     lista porque cargo nao e' cerca. */
  const daLista = [...(equipe || [])].filter((p) => p.ativo || p.email === valorAtual);
  daLista.sort((a, b) => {
    const prioA = prioridade ? prioridade.test(a.cargo || "") : false;
    const prioB = prioridade ? prioridade.test(b.cargo || "") : false;
    if (prioA !== prioB) return prioA ? -1 : 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  return (
    <>
      {daLista.length === 0 ? (
        <div className="dash-gc-vazio">
          Ninguém cadastrado na Equipe ainda — cadastre lá e o nome aparece aqui para escolher.
        </div>
      ) : (
        <select className="form-input" value={valor} autoFocus onChange={(e) => setValor(e.target.value)}>
          <option value="">— {vazio || `sem ${rotulo}`} —</option>
          {daLista.map((p) => (
            <option key={p.email} value={p.email}>
              {p.nome}{p.cargo ? ` · ${p.cargo}` : ""}{p.ativo ? "" : " (inativo)"}
            </option>
          ))}
        </select>
      )}
      {erro && <div className="dash-gc-vazio" style={{ color: "var(--red)" }}>{erro}</div>}
      <div className="dash-gc-acoes">
        <button className="btn-atalho" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        <button className="btn-atalho" onClick={() => { setValor(valorAtual || ""); setEditando(false); }}>cancelar</button>
      </div>
    </>
  );
}

/* A jornada de UMA obra, do contrato até a entrega — 5 marcos, mais alto
   nível que a esteira de 6 passos do painel geral (`esteiraDaObra`, que
   mistura CMV com cadernos). Tem dois marcos que a esteira não tem —
   Contrato (a obra existe) e Entrega (ela acabou) — por isso é derivada
   à parte, e não reaproveitada dali.

   "Entrega" nunca aparece feita aqui: esta tela só existe pra obra
   ATIVA, e o dia em que ela é arquivada ela sai daqui — o marco final
   é sempre o destino, nunca o "chegamos". */
function jornadaDaObra(obra) {
  const cad = obra.cadernos || {};
  const passos = [
    { chave: "contrato", nome: "Contrato", feito: etapaConcluida("vendido_contrato", obra) },
    { chave: "criativo", nome: "Criativo", feito: !!cad.criativo },
    { chave: "executivo", nome: "Executivo", feito: !!cad.projeto },
    { chave: "execucao", nome: "Execução da Obra", feito: !!obra.comprasLiberadas },
    { chave: "entrega", nome: "Entrega", feito: false },
  ];
  const i = passos.findIndex((p) => !p.feito);
  return { passos, atualIndex: i === -1 ? passos.length - 1 : i };
}

function JornadaStepper({ passos, atualIndex }) {
  return (
    <div className="jornada">
      {passos.map((p, i) => (
        <React.Fragment key={p.chave}>
          {i > 0 && <div className={`jornada-linha ${passos[i - 1].feito ? "feita" : ""}`} />}
          <div className="jornada-passo">
            <div className={`jornada-bola ${p.feito ? "feita" : i === atualIndex ? "atual" : ""}`}>
              {p.feito ? <Check size={14} /> : i === atualIndex ? <span className="jornada-ponto" /> : null}
            </div>
            <div className="jornada-nome">{p.nome}</div>
            <div className="jornada-status">{p.feito ? "Concluído" : i === atualIndex ? "Em andamento" : "Aguardando"}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function BarraFrente({ nome, pct }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="frente-linha">
      <div className="frente-nome">{nome}</div>
      <div className="frente-barra"><div className="frente-fill" style={{ width: `${p}%` }} /></div>
      <div className="frente-pct mono">{Math.round(p)}%</div>
    </div>
  );
}

function LinhaEquipe({ rotulo, valor, equipe, podeEditar, prioridade, onDefinir, obraId, vazio }) {
  const nome = valor ? nomeNaEquipe(equipe, valor) : null;
  const iniciais = (nome || "?").split(/\s+/).slice(0, 2).map((x) => x.charAt(0).toUpperCase()).join("") || "?";
  return (
    <div className="equipe-linha">
      <div className={`equipe-avatar ${valor ? "" : "vazio"}`}>{valor ? iniciais : "—"}</div>
      <div className="equipe-corpo">
        <div className="equipe-rotulo">{rotulo}</div>
        <PapelDaObra obraId={obraId} valor={valor} rotulo={rotulo} vazio={vazio} equipe={equipe}
          podeEditar={podeEditar} prioridade={prioridade} onDefinir={onDefinir} />
      </div>
    </div>
  );
}

function DashboardObra({ obra, totals, podeEditar, onDataEntrega, onIrParaCompras, onIrParaAditivos,
  onDefinirGC, onDefinirTailorMade, onDefinirExecutivo, tailorMade, responsavelExecutivo, equipe }) {
  // A data digitada so vale quando ela manda salvar. Campo de data que
  // grava sozinho a cada tecla dispara gravacao com ano pela metade —
  // "0002-11-20" chega no banco antes de "2026-11-20".
  const [rascunho, setRascunho] = useState(obra.dataEntrega || "");
  useEffect(() => { setRascunho(obra.dataEntrega || ""); }, [obra.dataEntrega, obra.id]);
  const sujo = rascunho !== (obra.dataEntrega || "");

  const vendido = obra.valorVendido || totals.totalVendido || 0;
  const exec = totals.totalExecutivo || 0;
  const acimaDoVendido = exec > vendido;

  const faltamEntrega = obra.dataEntrega ? diasAte(new Date(`${obra.dataEntrega}T12:00:00`)) : null;

  const contratos = useMemo(() => obraContratosStats(obra), [obra]);
  const jornada = useMemo(() => jornadaDaObra(obra), [obra]);

  /* "Projetos": quantos dos marcos de projeto já foram cumpridos — os
     MESMOS marcos que o painel geral já usa (`esteiraDaObra`), só que
     recortados pra fora CMV (financeiro) e "em execução" (que já tem
     barra própria, a de Execução). */
  const cad = obra.cadernos || {};
  const marcosProjeto = [!!cad.criativo, !!cad.especificacao, !!cad.marcenaria, !!cad.projeto];
  const pctProjetos = (marcosProjeto.filter(Boolean).length / marcosProjeto.length) * 100;
  const avancoGeral = Math.round((pctProjetos + (totals.pct || 0) + (contratos.pct || 0)) / 3);

  /* Aditivo aprovado muda o tamanho da obra, e ate agora ele so existia
     dentro do proprio modulo — quem abria o Dashboard via o orcamento
     original e nao sabia que tinha mudado. */
  const adit = useMemo(() => resumoAditivos(obra.aditivos), [obra.aditivos]);

  const avulsas = useMemo(() => (obra.categorias || [])
    .flatMap((c) => (c.itens || []).filter((it) => it.avulso)), [obra.categorias]);
  const avulsasAbertas = avulsas.filter((a) => !a.comprado).length;

  const resumo = useMemo(() => resumoDaObra(obra), [obra]);
  const criticosAtrasados = useMemo(() => passosCriticosAtrasados(obra).passos, [obra]);

  /* Pendências e alertas: as MESMAS regras que o painel geral usa —
     recortadas pra esta obra só, sem inventar regra nova nenhuma, e
     sem dono por linha (não temos esse controle hoje). */
  const pendencias = [];
  resumo.atrasos.forEach((v) => pendencias.push({
    tom: "ruim",
    txt: <>A compra de <b>{v.nome}</b> venceu há {-v.dias} {-v.dias === 1 ? "dia" : "dias"} — {fmtBRL(v.matFalta)}</>,
  }));
  if (criticosAtrasados.length) {
    const nomes = criticosAtrasados.map((p) => p.rotulo).join(", ");
    pendencias.push({
      tom: "ruim",
      txt: <>Entrega próxima e ainda não está em execução — {nomes} precisa{criticosAtrasados.length === 1 ? "" : "m"} estar pronto{criticosAtrasados.length === 1 ? "" : "s"}</>,
    });
  }
  if (acimaDoVendido) pendencias.push({
    tom: "ruim", txt: <>O executivo já passou do valor vendido em contrato em {fmtBRL(exec - vendido)}</>,
  });
  if (totals.criticos > 0) pendencias.push({
    tom: "ruim", txt: `${totals.criticos} ${totals.criticos === 1 ? "categoria em estouro crítico" : "categorias em estouro crítico"}`,
  });
  if (totals.itensAlerta > 0) pendencias.push({
    tom: "aviso", txt: `${totals.itensAlerta} ${totals.itensAlerta === 1 ? "item com alerta" : "itens com alerta"} de escopo ou quantidade`,
  });
  if (avulsasAbertas > 0) pendencias.push({
    tom: "aviso", txt: `${avulsasAbertas} ${avulsasAbertas === 1 ? "compra avulsa pendente" : "compras avulsas pendentes"}`,
  });
  if (!obra.dataEntrega) pendencias.push({ tom: "aviso", txt: "sem data de entrega — os prazos de compra não são calculados" });
  (obra.aditivos || []).filter(pipefyPendente).forEach((a) => pendencias.push({
    tom: "aviso", txt: <>O aditivo <b>{a.numero}</b> está aprovado e ainda sem a Solicitação de contrato no Pipefy</>,
  }));
  if (!obra.gc) pendencias.push({ tom: "aviso", txt: "esta obra está sem GC responsável" });

  return (
    <div className="dobra">
      <div className="dobra-regua">
        <InicioNum rot="AVANÇO GERAL" cor="var(--blue)" Icone={ArrowUpRight} valor={`${avancoGeral}%`} sub="da obra concluída" />
        <InicioNum rot="PRAZO PREVISTO" cor="var(--ink-2)" Icone={Clock}
          valor={faltamEntrega == null ? "—" : faltamEntrega < 0 ? `${-faltamEntrega} dias atrás` : `${faltamEntrega} dias`}
          sub={obra.dataEntrega ? `entrega em ${fmtData(obra.dataEntrega)}` : "sem data de entrega"} />
        <InicioNum rot="PENDÊNCIAS" cor="var(--red)" Icone={AlertTriangle} valor={pendencias.length}
          sub={pendencias.length ? "pedindo atenção" : "nada pedindo atenção"} />
        <InicioNum rot="ORÇAMENTO CONTRATADO" cor="var(--green)" Icone={DollarSign} valor={fmtCompactBRL(vendido)}
          sub="conforme contrato" />
      </div>

      {/* Data de entrega — editável aqui, é dela que sai todo prazo de
          compra da obra. Compacta de propósito: é ajuste raro, não é o
          motivo de alguém abrir esta tela. */}
      <div className="dobra-entrega">
        <Clock size={13} className="dim" />
        <span className="dobra-entrega-rot">Entrega prevista</span>
        <input className="entrega-input" type="date" value={rascunho} disabled={!podeEditar}
          onChange={(e) => setRascunho(e.target.value)} />
        {podeEditar && sujo && (
          <button className="btn-salvar-data" onClick={() => onDataEntrega(rascunho || null)}>Salvar</button>
        )}
      </div>

      <div className="dobra-card">
        <div className="ini-titulo"><LayoutGrid size={14} className="ini-titulo-icone" /> Jornada da obra</div>
        <div className="dobra-sub">Acompanhe as principais fases e o status atual da obra.</div>
        <JornadaStepper passos={jornada.passos} atualIndex={jornada.atualIndex} />
      </div>

      <div className="dobra-colunas">
        <div className="dobra-card">
          <div className="ini-titulo"><ArrowUpRight size={14} className="ini-titulo-icone" /> Progresso por frente</div>
          <div className="dobra-sub">Avanço por frente de trabalho.</div>
          <BarraFrente nome="Projetos" pct={pctProjetos} />
          <BarraFrente nome="Suprimentos" pct={totals.pct || 0} />
          <BarraFrente nome="Execução" pct={contratos.pct || 0} />
        </div>

        <div className="dobra-card">
          <div className="ini-titulo"><AlertTriangle size={14} className="ini-titulo-icone" /> Pendências e alertas
            {pendencias.length > 0 && <span className="ini-conta">{pendencias.length}</span>}
          </div>
          {pendencias.length === 0 ? (
            <div className="dash-alerta ok"><CheckCircle2 size={14} /> Nada pedindo atenção nesta obra.</div>
          ) : pendencias.map((a, i) => (
            <div key={i} className={`ini-alerta ${a.tom}`}>
              <AlertTriangle size={13} />
              <span>{a.txt}</span>
            </div>
          ))}
          <button className="btn-atalho dash-atalho" onClick={onIrParaCompras}>
            <Plus size={12} /> {avulsas.length ? `Compras avulsas (${avulsas.length})` : "Solicitar compra avulsa"}
          </button>
        </div>

        <div className="dobra-card">
          <div className="ini-titulo"><ShieldCheck size={14} className="ini-titulo-icone" /> Equipe da obra</div>
          <div className="dobra-sub">Principais responsáveis.</div>
          <LinhaEquipe obraId={obra.id} rotulo="GC responsável" valor={obra.gc} equipe={equipe} podeEditar={podeEditar}
            prioridade={/gc/i} vazio="sem GC — esta obra aparece para todo mundo"
            onDefinir={(email) => onDefinirGC(obra.codigo, email)} />
          <LinhaEquipe obraId={obra.id} rotulo="Tailor Made" valor={tailorMade} equipe={equipe} podeEditar={podeEditar}
            vazio="ainda não atribuído" onDefinir={(email) => onDefinirTailorMade(obra.codigo, email)} />
          <LinhaEquipe obraId={obra.id} rotulo="Executivo" valor={responsavelExecutivo} equipe={equipe} podeEditar={podeEditar}
            vazio="ainda não atribuído" onDefinir={(email) => onDefinirExecutivo(obra.codigo, email)} />
        </div>
      </div>

      {(adit.aprovados.length > 0 || adit.pendentes.length > 0) && (
        <div className="dobra-card dash-aditivos">
          <div className="ini-titulo"><FileText size={14} className="ini-titulo-icone" /> Aditivos</div>
          {adit.aprovados.length > 0 ? (
            <>
              <div className={`dash-adit-saldo mono ${adit.saldo < 0 ? "credito" : ""}`}>
                {adit.saldo >= 0 ? "+" : ""}{fmtBRL(adit.saldo)}
              </div>
              <div className="dash-adit-sub">
                {adit.aprovados.length} {adit.aprovados.length === 1 ? "aditivo aprovado" : "aditivos aprovados"} ·
                {" "}{fmtBRL(adit.adicao)} de adição e {fmtBRL(adit.supressao)} de supressão
              </div>
              <div className="dash-adit-lista">
                {adit.aprovados.map((a) => (
                  <div key={a.id} className="dash-adit-linha">
                    <span className="mono">{a.numero}</span>
                    <span className="dash-adit-desc">{a.descricao || "sem descrição"}</span>
                    <span className={`mono ${a.totalAdicao - a.totalSupressao < 0 ? "credito" : ""}`}>
                      {fmtBRL(a.totalAdicao - a.totalSupressao)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="dash-adit-sub">
              {adit.pendentes.length} {adit.pendentes.length === 1 ? "aditivo em rascunho" : "aditivos em rascunho"} —
              rascunho não entra no orçamento. Só o aprovado conta.
            </div>
          )}

          {/* Grupo aprovado sem verba tem dinheiro dentro e ficaria
              invisivel no CMV e no Plano de Compras. */}
          {adit.soltos.length > 0 && (
            <div className="dash-alerta aviso">
              <AlertTriangle size={13} />
              <span>
                <b>{adit.soltos.length}</b> {adit.soltos.length === 1 ? "grupo aprovado está" : "grupos aprovados estão"} sem
                verba da EAP — {fmtBRL(adit.soltos.reduce((a, x) => a + x.valor, 0))} que não entra no CMV nem no Plano de Compras.
              </span>
            </div>
          )}

          <button className="btn-atalho dash-atalho" onClick={onIrParaAditivos}>
            <FileText size={12} /> Ver os aditivos
          </button>
        </div>
      )}
    </div>
  );
}

// Seta discreta entre os dois numeros do topo — o vendido VIRA o executivo.
const ArrowRightIcon = () => <span className="dash-seta" aria-hidden="true">→</span>;



function SiengeMatch({ sienge }) {
  if (!sienge) return null;
  if (sienge.status === "match") {
    return (
      <div className="sienge-match sienge-match-green">
        <Link2 size={12} className="sienge-match-icon" />
        <div>
          <span className="sienge-eyebrow">INSUMO SIENGE</span>
          <div><span className="mono sienge-cod">Cód. {sienge.codigo}</span><span className="sienge-desc">{sienge.desc}</span></div>
        </div>
      </div>
    );
  }
  if (sienge.status === "parcial") {
    return (
      <div className="sienge-match sienge-match-amber">
        <PackageSearch size={12} className="sienge-match-icon" />
        <div>
          <span className="sienge-eyebrow">INSUMO SIENGE — correspondência parcial</span>
          <div><span className="mono sienge-cod">Cód. {sienge.codigo}</span><span className="sienge-desc">{sienge.desc}</span></div>
          <span className="sienge-note">a especificação (marca/modelo/capacidade) difere — revisar antes de vincular</span>
        </div>
      </div>
    );
  }
  return (
    <div className="sienge-match sienge-match-neutral">
      <PackageSearch size={12} className="sienge-match-icon" />
      <div>
        <span className="sienge-eyebrow">INSUMO SIENGE</span>
        <div><span className="sienge-desc">Nenhum insumo cadastrado corresponde a este item</span></div>
        <span className="sienge-note">sugerir cadastro de novo insumo</span>
      </div>
    </div>
  );
}

/* ============================================================
   ABA COMPARATIVO
   ============================================================ */

// tags/alertas comuns às duas linhas (produto e serviço)
function ItemTags({ item, alertas }) {
  return (
    <div className="item-tags">
      {alertas.includes("escopo") && <span className="chip chip-red"><XCircle size={11} /> Fora do escopo vendido</span>}
      {alertas.includes("qtd") && <span className="chip chip-red"><AlertTriangle size={11} /> Quantidade excede o vendido</span>}
      {alertas.includes("novo") && <span className="chip chip-blue">Novo item — sem código no vendido</span>}
      {item.foraDeEscopo && item.statusEscopo === "aprovado" && <span className="chip chip-green"><CheckCircle2 size={11} /> Aprovado — incluído no escopo</span>}
    </div>
  );
}

// estouro por item: o que foi de fato comprado passou o custo orçado
// no executivo pra aquele item — sinaliza item a item, não só por verba.
function itemEstourou(item) {
  return item.valorComprado != null && item.custo != null && item.valorComprado > item.custo;
}

/* ALOCACAO DE RECURSO — MAT, MO ou MAT/MO
   ------------------------------------------------------------
   A empresa chama material de MAT e mao de obra de MO. Um item do
   executivo nao e uma coisa OU outra: a planilha traz as duas colunas, e
   o mesmo spot de sobrepor tem R$ 182 de material e R$ 180 de mao de
   obra. Esse item e MAT/MO.

   Antes esta tela filtrava por `tipo` (produto/servico), que e um campo
   de UMA escolha so — nele o spot precisava mentir e virar "produto",
   escondendo os R$ 180. A alocacao sai das PARCELAS, que e a unica
   leitura capaz de dizer "os dois". */
const ALOC_MAT = "MAT", ALOC_MO = "MO", ALOC_AMBOS = "AMBOS";
/* A sigla e o que cabe na celula; o nome por extenso e o que a pessoa
   procura no filtro. Os dois em caixa alta, como a empresa padronizou.

   BARRA e MAIS querem dizer coisas diferentes, e e de proposito:
     MAT/MO  = material E mao de obra, os dois juntos — e o filtro que
               mostra tudo, o estado inicial da tela.
     MAT+MO  = esta LINHA carrega as duas parcelas ao mesmo tempo, ainda
               nao separadas.
   Antes os dois se chamavam "MAT/MO" e ficavam lado a lado na mesma
   fila de filtros, indistinguiveis. */
const ROTULO_ALOC = { MAT: "MAT", MO: "MO", AMBOS: "MAT+MO" };
const NOME_ALOC = { MAT: "MATERIAL (MAT)", MO: "MÃO DE OBRA (MO)", AMBOS: "MAT+MO" };

const ehProduto = (it) => it.tipo === "produto";

/* Verbas em que o fornecedor entrega material E mao de obra no mesmo
   pacote: serralheria, vidros/espelhos, estofados, cortinas/persianas e
   pedras/marmoraria. Nelas o item e MAT+MO por regra da empresa, mesmo
   quando a planilha preencheu uma coluna so — e nao se separa (e, pela
   regra nova, o valor inteiro conta como mao de obra). */
const VERBAS_MAT_MO_SEMPRE = new Set(["22", "23", "25", "30", "26"]);
const ehVerbaMatMoSempre = (num, nome) =>
  VERBAS_MAT_MO_SEMPRE.has((nome ? verbaPorNome(nome) : null) || num);

/* Regra da empresa: as duas parcelas preenchidas numa verba SEM split
   proprio deixou de ser "nao separado" e passou a contar inteiro como
   MAO DE OBRA. So isso — o pacote fechado (`ehVerbaMatMoSempre`) tem
   regra dele, e a linha separada por essa funcao.

   EXCECAO que importa: as verbas de `separaMOautomatico` (05, 20, 24,
   27, 28) tem split proprio — a empresa compra o material e contrata a
   mao de obra separadamente, e a importacao ja parte a linha em duas.
   Enquanto uma linha dessas ainda nao foi partida (importacao no meio
   do caminho, edicao manual que preencheu as duas colunas de novo), as
   duas parcelas juntas continuam sendo o sinal de "ainda falta separar"
   — nao "virou mao de obra". Se essa regra nova entrasse ali, o botao
   "separar MO" nunca apareceria pra essas cinco verbas de novo, e o
   material sumiria dentro da mao de obra antes de alguem clicar.

   `cru` sao as parcelas da PLANILHA (`parcelasDaPlanilha`), nunca as
   ja decididas — senao `parcelasDoItem` chamando isto entraria em
   looping. */
function seriaMatMaisMoDaEmpresa(cat, cru) {
  if (cat && ehVerbaMatMoSempre(cat.num, cat.nome)) return true;
  if (cru.material <= 0 || cru.mo <= 0) return false;
  return !(cat && separaMOautomatico(cat.num, cat.nome));
}

function alocacaoDoItem(it, cat) {
  // Correcao NESTA obra ganha de tudo. O que a planilha traz e uma
  // leitura, nao um decreto: item lancado inteiro na coluna de material
  // as vezes e servico, e so quem conhece a obra sabe.
  if (it.alocacaoManual) return it.alocacaoManual;
  // Linha que nasceu de uma separacao ja tem lado definido; deixar
  // qualquer regra mandar nela desfaria a separacao na tela.
  if (it.moSeparada) return ALOC_MAT;
  if (it.separadoDe) return ALOC_MO;
  /* Decisao da empresa pra essa descricao.

     "Anotacao de responsabilidade tecnica - RRT" e mao de obra em toda
     obra que a casa faz; "Cacambas de entulho" tambem. Decidido uma vez,
     vale sempre — e vem antes das regras de verba porque descricao e mais
     especifica que grupo. */
  const daEmpresa = padraoDaDescricao(it.desc);
  if (daEmpresa) return daEmpresa;
  // Avulso nao tem valor nenhum (so o pedido), entao quem declara a
  // alocacao e quem pediu — nao ha parcela pra deduzir dela.
  if (it.avulso) return it.alocacao || ALOC_MAT;
  const cru = parcelasDaPlanilha(it);
  if (seriaMatMaisMoDaEmpresa(cat, cru)) return ALOC_MO;
  // As duas parcelas preenchidas numa verba de split proprio: ainda nao
  // foi partida, e continua precisando aparecer como "falta separar".
  if (cru.material > 0 && cru.mo > 0) return ALOC_AMBOS;
  if (cru.mo > 0) return ALOC_MO;
  if (cru.material > 0) return ALOC_MAT;
  /* Nao deu pra classificar (nenhuma parcela tem valor): fica em MAT+MO,
     nunca vazio nem chutado — aqui nao e dinheiro que precisou de lado,
     e' item sem dado nenhum, e isso continua precisando aparecer como
     "falta resolver", nao se disfarcar de mao de obra decidida. */
  return ALOC_AMBOS;
}

/* Particao, nao sobreposicao: MAT sao os itens SO de material, MO os SO
   de mao de obra, MAT/MO os que tem as duas parcelas. As tres contas
   somadas dao o total da lista — se "MAT" tambem incluisse os MAT/MO os
   numeros dos chips nao fechariam com o da tela, e numero que nao fecha
   e numero em que ninguem confia. */
const FILTROS_ALOC = [
  { id: "todos", label: "MAT/MO" },
  { id: ALOC_MAT, label: NOME_ALOC.MAT, destino: "viram insumo no Sienge" },
  { id: ALOC_MO, label: NOME_ALOC.MO, destino: "viram contrato" },
  { id: ALOC_AMBOS, label: NOME_ALOC.AMBOS, destino: "carregam as duas parcelas na mesma linha" },
];
const casaAloc = (it, f, cat) => f === "todos" || alocacaoDoItem(it, cat) === f;

/* A etiqueta da alocacao — e, quando da pra corrigir, o proprio controle.

   E um <select> de verdade por cima da etiqueta, transparente: a pessoa
   clica onde ja estava olhando, o teclado navega e o leitor de tela
   anuncia. Um botao que cicla MAT -> MO -> MAT/MO seria menos codigo e
   obrigaria a passar pelas opcoes erradas ate chegar na certa.

   Corrigida na mao, a etiqueta ganha um ponto: valor que nao e mais o
   que a planilha disse nunca pode ficar calado na tela. */
/* Verbas em que a empresa SEMPRE compra o material e contrata a mao de
   obra: iluminacao, climatizacao, moveis soltos e loucas/metais. Nelas o
   item que vem com as duas parcelas ja nasce partido em dois.

   Indexado por numero CANONICO, resolvido pelo NOME. A EAP da empresa ja
   renumerou uma vez — eletrica saiu de 03 pra 05, climatizacao de 06 pra
   20 — e obra salva antes da troca guarda a numeracao velha. Casar por
   numero cru marcaria grupos errados sem nada na tela denunciar. */
const VERBAS_MO_CONTRATADA = new Set(["05", "20", "24", "27", "28"]);
const separaMOautomatico = (num, nome) =>
  VERBAS_MO_CONTRATADA.has((nome ? verbaPorNome(nome) : null) || num);

/* So faz sentido separar o que TEM mao de obra pra tirar, uma vez so, e
   fora das verbas de pacote fechado. Sem esse teste o botao aparecia em
   item de valor zero e nao fazia nada ao ser clicado. */
const podeSepararMO = (it, cat) =>
  !it.moSeparada && !it.separadoDe && !it.ehTitulo
  && !(cat && ehVerbaMatMoSempre(cat.num, cat.nome))
  && alocacaoDoItem(it, cat) === ALOC_AMBOS
  && parcelasDoItem(it, cat).mo > 0;

const codigoMOlivre = (usados, prefixo) => {
  let n = 1;
  while (usados.has(`${prefixo}.mo${n}`)) n += 1;
  return `${prefixo}.mo${n}`;
};

/* Parte um item MAT/MO em dois: ele mesmo, agora so com o material, e uma
   linha nova so com a mao de obra — mesma descricao, mesma quantidade, na
   MESMA verba, logo abaixo dele.

   A mao de obra da iluminacao e da iluminacao: tirar ela do grupo levava
   o valor pra longe de onde ele e conferido, e quem separava procurava a
   linha no grupo de origem, nao achava e concluia que nada tinha
   acontecido.

   Devolve { original, linhaMO } e nao grava nada. Os dois caminhos que
   separam (o botao e a importacao) passam por aqui de proposito: montar
   o item campo a campo em dois lugares ja congelou no tempo duas vezes
   neste app — quando o parser ganhou uma coluna nova, so um dos lados
   aprendeu a copiar. Por isso a linha nova sai de um espalhamento do
   item inteiro, e so depois os campos que NAO acompanham a mao de obra
   sao zerados. */
function partirMaoDeObra(item, cat, codigoNovo) {
  // Precisa do CATEGORIA inteira, nao so' do numero — e' o que deixa
  // `parcelasDoItem` reconhecer que esta verba tem split proprio e nao
  // aplicar por cima a regra nova de MAT+MO virar MO (ver `ehMatMoAutomatico`);
  // passando so' o numero essa checagem ficaria cega.
  const { mo } = parcelasDoItem(item, cat);
  if (mo <= 0 || item.moSeparada) return null;
  return {
    original: { ...item, moSeparada: { valor: mo, codigo: codigoNovo } },
    linhaMO: {
      ...item,
      codigo: codigoNovo,
      totalMaterial: 0, totalMO: mo, custo: mo,
      custoMaterial: null, custoMO: null,
      tipo: "servico",
      alocacaoManual: null,
      moSeparada: null,
      // Compra e do material; a mao de obra vira contrato. Levar junto o
      // que ja foi comprado faria a mesma compra aparecer duas vezes.
      sienge: null, contavel: false,
      comprado: false, valorComprado: null, qtdComprada: null,
      compraDecidida: false, liberado: false,
      separadoDe: { codigo: item.codigo, verba: cat.num, desc: item.desc },
    },
  };
}

/* Separa a MO das verbas em que ela e sempre contratada.

   `sonaVerba` limita a um grupo so — e o que o botao do grupo usa. Sem
   ele roda em todas, que e o caso da importacao. */
function separarMOnasVerbasDeContrato(categorias, soNaVerba) {
  let separados = 0;
  const cats = (categorias || []).map((c) => {
    if (soNaVerba ? c.num !== soNaVerba : !separaMOautomatico(c.num, c.nome)) return c;
    const usados = new Set((c.itens || []).map((it) => it.codigo));
    const itens = [];
    (c.itens || []).forEach((it) => {
      if (!podeSepararMO(it, c)) { itens.push(it); return; }
      const codigoNovo = codigoMOlivre(usados, c.num);
      const par = partirMaoDeObra(it, c, codigoNovo);
      if (!par) { itens.push(it); return; }
      usados.add(codigoNovo);
      // A linha de mao de obra entra LOGO ABAIXO da que a gerou: o par
      // se le junto, e ninguem precisa procurar a metade que sumiu.
      itens.push(par.original, par.linhaMO);
      separados += 1;
    });
    return { ...c, itens };
  });
  return separados ? { categorias: cats, separados } : { categorias, separados: 0 };
}

/* Devolve pro grupo de origem a mao de obra que foi separada pra fora.

   Ate agora a linha separada ia parar numa verba de "Execucao e Mao de
   Obra". A mao de obra da iluminacao e da iluminacao — o valor ficava
   longe de onde e conferido, e quem separava nao achava a linha. As obras
   que ja tinham separacoes se consertam sozinhas ao carregar, em vez de
   exigir que alguem desfaca e refaca uma a uma. */
function devolverMOaoGrupoDeOrigem(categorias) {
  const lista = categorias || [];
  const fora = [];
  const limpas = lista.map((c) => {
    const ficam = [], saem = [];
    (c.itens || []).forEach((it) => {
      if (it.separadoDe && it.separadoDe.verba && it.separadoDe.verba !== c.num) saem.push(it);
      else ficam.push(it);
    });
    if (!saem.length) return c;
    fora.push(...saem);
    return { ...c, itens: ficam };
  });
  if (!fora.length) return lista;

  return limpas.map((c) => {
    const meus = fora.filter((it) => it.separadoDe.verba === c.num);
    if (!meus.length) return c;
    const usados = new Set((c.itens || []).map((it) => it.codigo));
    const colocados = new Set();
    const itens = [];

    (c.itens || []).forEach((it) => {
      const filhas = meus.filter((m) => m.separadoDe.codigo === it.codigo);
      if (!filhas.length) { itens.push(it); return; }
      /* Copia em vez de mexer no objeto que veio: a outra ponta guarda o
         codigo da linha filha, e sem atualizar, "juntar de volta"
         procuraria uma linha que nao existe mais. Mutar o original
         mudaria o estado do React por baixo dele. */
      let pai = it;
      const novas = [];
      filhas.forEach((m) => {
        /* Codigo com prefixo da verba velha dentro de outra verba
           confunde mais do que ajuda — "32.mo1" no meio da 05. */
        const doGrupo = String(m.codigo || "").startsWith(`${c.num}.`);
        const codigo = doGrupo && !usados.has(m.codigo) ? m.codigo : codigoMOlivre(usados, c.num);
        usados.add(codigo);
        colocados.add(m);
        if (pai.moSeparada) pai = { ...pai, moSeparada: { valor: pai.moSeparada.valor, codigo } };
        novas.push({ ...m, codigo });
      });
      itens.push(pai, ...novas);
    });

    /* Orfa: a linha de origem sumiu (obra reimportada, por exemplo). Vai
       pro fim do grupo em vez de desaparecer com o valor dentro.
       Comparada por IDENTIDADE, nao por codigo — o codigo pode ter sido
       renumerado agora mesmo, e comparar por ele duplicava a linha. */
    meus.filter((m) => !colocados.has(m)).forEach((m) => {
      const codigo = usados.has(m.codigo) ? codigoMOlivre(usados, c.num) : m.codigo;
      usados.add(codigo);
      itens.push({ ...m, codigo });
    });
    return { ...c, itens };
  });
}

/* PRAZO DE COMPRA — ate quando o material TEM que estar comprado.
   ------------------------------------------------------------
   Conta pra tras a partir da data de entrega da obra. O que atrasa uma
   obra nao e o preco: e o item que leva 75 dias pra chegar e foi
   comprado com 40.

   Loucas e Metais tem DOIS prazos, por fornecedor: Docol 90 dias, Bracci
   30. Um numero so por grupo nao da conta, entao a regra e por
   fornecedor e o grupo mostra o MAIS APERTADO entre os que ele de fato
   tem — se ha uma peca Docol na verba, a data do grupo e a dela, senao a
   compra chega depois da obra entregue.

   Eletroeletronico ainda nao tem prazo definido: fica em branco pra ser
   preenchido na mao, como qualquer grupo sem regra. */
const PRAZOS_COMPRA = {
  "05": { dias: 30 },   // Instalacoes Eletricas e Iluminacao
  "20": { dias: 30 },   // Climatizacao / Exaustao
  "24": { dias: 75 },   // Moveis Soltos
  "27": { porFornecedor: [   // Loucas, Metais e Equipamentos Especiais
    { casa: /docol/i, nome: "Docol", dias: 90 },
    { casa: /bracci/i, nome: "Bracci", dias: 30 },
  ] },
};

// Grupo fora da EAP padrao nao tem numero canonico — entra pelo nome.
const PRAZOS_FORA_DO_PADRAO = [{ casa: /automa[çc]/i, dias: 30 }];

/* Devolve { dias, fornecedor, incerto } ou null quando o grupo nao tem
   regra.

   Grupo sem regra nao mostra nada — nem campo em branco pra preencher na
   mao. Vinte celulas vazias pedindo um numero que ninguem tem competem
   com as cinco que carregam a informacao de verdade, e a tela passa a
   parecer incompleta em vez de precisa. Grupo novo que precisar de prazo
   entra na tabela acima, que e uma linha. */
function prazoDoGrupo(cat, itens) {
  if (cat.foraDaEapPadrao) {
    const r = PRAZOS_FORA_DO_PADRAO.find((x) => x.casa.test(cat.nome || ""));
    return r ? { dias: r.dias } : null;
  }
  const regra = PRAZOS_COMPRA[verbaPorNome(cat.nome) || cat.num];
  if (!regra) return null;
  if (regra.dias != null) return { dias: regra.dias };

  const nosItens = regra.porFornecedor.filter((r) =>
    (itens || []).some((it) => r.casa.test(String(it.marca || it.fornecedor || it.especificacao || ""))));
  if (!nosItens.length) {
    /* Nenhum fornecedor reconhecido nas linhas. Vale o prazo MAIS LONGO
       da regra, marcado como incerto: errar pro lado da compra adiantada
       custa estoque; errar pro outro custa a entrega da obra. */
    const pior = regra.porFornecedor.reduce((a, b) => (b.dias > a.dias ? b : a));
    return { dias: pior.dias, fornecedor: pior.nome, incerto: true };
  }
  const pior = nosItens.reduce((a, b) => (b.dias > a.dias ? b : a));
  return { dias: pior.dias, fornecedor: pior.nome, varios: nosItens.length > 1 };
}

/* A data limite, contada pra tras a partir da entrega.

   O meio-dia no construtor nao e enfeite: `new Date("2026-12-15")` e
   meia-noite UTC, que no fuso de Santa Catarina cai no dia 14 — a data
   apareceria um dia mais cedo do que a pessoa digitou, todo dia. */
function dataLimiteCompra(dataEntrega, dias) {
  if (!dataEntrega || dias == null) return null;
  const d = new Date(`${dataEntrega}T12:00:00`);
  if (isNaN(d)) return null;
  d.setDate(d.getDate() - dias);
  return d;
}

// Dias inteiros entre hoje e a data, os dois zerados na meia-noite local
// — senao "faltam 3 dias" viraria 2 ou 4 conforme a hora do dia.
function diasAte(data, hoje = new Date()) {
  if (!data) return null;
  const a = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const b = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((a - b) / 86400000);
}

const fmtData = (d) => (d ? d.toLocaleDateString("pt-BR") : "—");

/* CANAIS DE COMPRA — por onde o produto e pedido.

   Sienge e o caminho formal, com cadastro de insumo. Mehoo, Automacao e
   Cortinas sao categorias de filtro: servem pra separar o que vai pra
   cada fornecedor na hora de mandar o pedido.

   Os simbolos sao DESENHADOS aqui, nao sao a marca de ninguem: sao
   iniciais em etiqueta colorida. Colar o logo do Sienge dentro do app
   seria usar marca alheia sem permissao, e uma sigla cumpre o papel — que
   e reconhecer o canal de relance numa lista de 200 linhas. */
const CANAIS_COMPRA = [
  { id: "sienge",   sigla: "SG", nome: "Sienge",               cor: "var(--blue)",   bg: "var(--blue-bg)" },
  { id: "mehoo",    sigla: "MH", nome: "Mehoo",                cor: "var(--purple)", bg: "#EFEAFB" },
  { id: "automacao",sigla: "AU", nome: "Automação",            cor: "var(--green)",  bg: "var(--green-bg)" },
  { id: "cortinas", sigla: "CP", nome: "Cortinas e Persianas", cor: "#B54708",       bg: "var(--amber-bg)" },
  { id: "gc",       sigla: "GC", nome: "GC",                    cor: "#2E7D8F",       bg: "#E2F0F3" },
  { id: "estoque",  sigla: "ES", nome: "Estoque",               cor: "#6B5E4A",       bg: "#EFEAE1" },
];
const canalPorId = (id) => CANAIS_COMPRA.find((c) => c.id === id) || null;

/* Em que pe' esta o contrato daquele servico. Mora aqui em cima, junto do
   modelo, porque o painel geral depende dele — e o painel geral tem
   teste, que so alcanca o que esta acima do marcador de fim do modelo. */
const contratoEtapa = (it) => it.statusContrato || "nao_solicitado";

/* A obra e' minha quando o GC dela sou eu. Sem GC ela nao e' de ninguem —
   e aparece pra todo mundo, que e' melhor do que sumir pra todo mundo. */
const obraDoGC = (o, email) => !!email && String(o.gc || "").toLowerCase() === String(email).toLowerCase();

/* ============================================================
   PAINEL GERAL DE COMPRAS E CONTRATACOES

   Uma linha por obra e um total por verba, somando TODAS as obras.
   Responde duas perguntas que so existem fora da obra:

     "quanto falta comprar, e tem obra atrasada?"
     "quanto tenho pra contratar de pintura nas proximas semanas?"

   A segunda e' a que muda o trabalho: sabendo o volume por verba com
   antecedencia, da pra chegar no fornecedor com previsao em vez de
   pedido urgente.
   ============================================================ */

/* Data em que a coisa PRECISA acontecer.

   Compra tem prazo proprio por verba (iluminacao 30 dias, moveis 75...),
   contado de tras pra frente a partir da entrega. Mao de obra nao tem
   prazo configurado — nao existe regra da casa dizendo "gesso se contrata
   com N dias" —, entao ela se ancora na entrega da obra. Quando a regra
   de MO existir, e' aqui que ela entra, e o resto da tela nao muda. */
function dataDeNecessidade(obra, cat, itens, aloc) {
  if (!obra.dataEntrega) return null;
  if (aloc === ALOC_MAT) {
    const p = prazoDoGrupo(cat, itens);
    if (p) return dataLimiteCompra(obra.dataEntrega, p.dias);
  }
  return new Date(`${obra.dataEntrega}T12:00:00`);
}

/**
 * Resumo de uma obra: quanto de material, quanto de mao de obra, o que
 * ja andou e quais grupos estao com a compra vencida.
 *
 * MAT feito e' `it.comprado`; MO feita e' qualquer etapa de contrato
 * fora de "nao_solicitado" — as duas definicoes ja usadas nas telas de
 * Compras e de Contratos. Inventar uma terceira aqui faria o painel
 * geral discordar da tela de onde o numero veio.
 */
function resumoDaObra(o, hoje = new Date()) {
  const verbas = new Map();
  let matTotal = 0, matFeito = 0, moTotal = 0, moFeito = 0;

  (o.categorias || []).forEach((cat) => {
    const itens = cat.itens || [];
    itens.forEach((it) => {
      if (it.ehTitulo) return;
      const { material, mo } = parcelasDoItem(it, cat);
      const aloc = alocacaoDoItem(it, cat);
      if (material <= 0 && mo <= 0) return;

      if (!verbas.has(cat.num)) {
        verbas.set(cat.num, {
          num: cat.num, nome: cat.nome, obra: o.codigo, obraNome: o.nome,
          mat: 0, matFalta: 0, mo: 0, moFalta: 0,
          quandoMat: dataDeNecessidade(o, cat, itens, ALOC_MAT),
          quandoMo: dataDeNecessidade(o, cat, itens, ALOC_MO),
          prazo: prazoDoGrupo(cat, itens),
        });
      }
      const v = verbas.get(cat.num);

      if (material > 0 || aloc === ALOC_MAT) {
        matTotal += material; v.mat += material;
        if (it.comprado) matFeito += material; else v.matFalta += material;
      }
      if (mo > 0 || aloc === ALOC_MO) {
        moTotal += mo; v.mo += mo;
        if (contratoEtapa(it) !== "nao_solicitado") moFeito += mo; else v.moFalta += mo;
      }
    });
  });

  /* Atraso e' prazo vencido COM compra pendente. Grupo ja comprado nao
     atrasa nada, mesmo com a data para tras — marcar ele de vermelho
     ensinaria a ignorar o vermelho. */
  const atrasos = [];
  const perto = [];
  verbas.forEach((v) => {
    if (!v.quandoMat || v.matFalta <= 0 || !v.prazo) return;
    const dias = diasAte(v.quandoMat, hoje);
    if (dias < 0) atrasos.push({ ...v, dias });
    else if (dias <= 15) perto.push({ ...v, dias });
  });
  atrasos.sort((a, b) => a.dias - b.dias);
  perto.sort((a, b) => a.dias - b.dias);

  return {
    codigo: o.codigo, nome: o.nome, id: o.id,
    dataEntrega: o.dataEntrega || null,
    faltamEntrega: o.dataEntrega ? diasAte(new Date(`${o.dataEntrega}T12:00:00`), hoje) : null,
    mat: { total: matTotal, feito: matFeito, falta: matTotal - matFeito,
      pct: matTotal > 0 ? (matFeito / matTotal) * 100 : 0 },
    mo: { total: moTotal, feito: moFeito, falta: moTotal - moFeito,
      pct: moTotal > 0 ? (moFeito / moTotal) * 100 : 0 },
    verbas: [...verbas.values()],
    atrasos, perto,
    semDados: matTotal === 0 && moTotal === 0,
  };
}

/**
 * Junta as obras: uma linha por obra, e o total por verba somando todas.
 *
 * `horizonteDias` recorta pelo que precisa acontecer ate la — vencido
 * entra sempre, porque atraso nao sai da conta por ser velho. Obra sem
 * data de entrega nao tem como ser recortada: ela fica de fora do
 * recorte e e' contada a parte, em vez de sumir calada.
 */
function resumoGeral(obras, { hoje = new Date(), horizonteDias = null } = {}) {
  const linhas = (obras || []).map((o) => resumoDaObra(o, hoje)).filter((L) => !L.semDados);
  const limite = horizonteDias == null ? null
    : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + horizonteDias);

  const dentro = (quando) => {
    if (limite == null) return true;
    if (!quando) return false;
    return quando <= limite;
  };

  const mat = new Map(), mo = new Map();
  let semData = 0;
  linhas.forEach((L) => {
    if (horizonteDias != null && !L.dataEntrega) {
      semData += L.mat.falta + L.mo.falta;
      return;
    }
    L.verbas.forEach((v) => {
      /* `obras` guarda o valor POR obra, não só quem participa — é o que
         permite expandir a linha do grupo e mostrar de qual obra vem
         cada pedaço do total, em vez de só a contagem. */
      const junta = (mapa, valor, quando) => {
        if (valor <= 0 || !dentro(quando)) return;
        if (!mapa.has(v.num)) mapa.set(v.num, { num: v.num, nome: v.nome, total: 0, obras: new Map() });
        const g = mapa.get(v.num);
        g.total += valor;
        const atual = g.obras.get(L.codigo) || { codigo: L.codigo, nome: L.nome, id: L.id, valor: 0 };
        atual.valor += valor;
        g.obras.set(L.codigo, atual);
      };
      junta(mat, v.matFalta, v.quandoMat);
      junta(mo, v.moFalta, v.quandoMo);
    });
  });

  const ordena = (m) => [...m.values()].sort((a, b) => b.total - a.total);
  const somar = (f) => linhas.reduce((a, L) => a + f(L), 0);
  return {
    linhas: linhas.sort((a, b) => {
      // Atrasada primeiro; depois quem entrega antes; sem data por ultimo.
      if ((b.atrasos.length > 0) - (a.atrasos.length > 0)) return (b.atrasos.length > 0) - (a.atrasos.length > 0);
      if (!a.dataEntrega) return 1;
      if (!b.dataEntrega) return -1;
      return a.dataEntrega < b.dataEntrega ? -1 : 1;
    }),
    aComprar: ordena(mat),
    aContratar: ordena(mo),
    semData,
    totais: {
      matTotal: somar((L) => L.mat.total), matFeito: somar((L) => L.mat.feito),
      moTotal: somar((L) => L.mo.total), moFeito: somar((L) => L.mo.feito),
      obrasAtrasadas: linhas.filter((L) => L.atrasos.length > 0).length,
    },
  };
}

/* Soma quantidade por UNIDADE, nunca tudo junto — 6 "un" + 3 "m²" somados
   crus dariam 9 de nada. Cada insumo/produto costuma vir numa unidade só,
   mas juntar obras diferentes as vezes mistura "un" com "cj", e a conta
   tem que continuar dizendo a verdade em vez de virar um número sem
   sentido. */
function acumularQtd(mapaQtds, it) {
  const qtd = it.qtdExecutivo ?? it.qtdVendida ?? null;
  if (!(qtd > 0)) return;
  const un = it.un || "un";
  mapaQtds.set(un, (mapaQtds.get(un) || 0) + qtd);
}

/**
 * O material a comprar por INSUMO — mesmo classificador do catálogo de
 * produtos (`subgrupoDe`), aplicado aos itens da obra, somando todas
 * elas. É o que responde "quanto falta comprar de colchão" sem precisar
 * abrir obra por obra.
 *
 * So cobre as verbas que ja tem regra de subgrupo (05, 27, 24, 30, 20,
 * 28, 32, 33 — ver SUBGRUPOS em catalogoModelo.js). O resto cai em "Sem
 * categoria", visivel e por ultimo — nunca escondido, pro que falta
 * classificar virar fila de trabalho, e nao sumir calado.
 */
function resumoPorInsumo(obras) {
  const grupos = new Map();
  (obras || []).forEach((o) => {
    (o.categorias || []).forEach((cat) => {
      (cat.itens || []).forEach((it) => {
        if (it.ehTitulo) return;
        const { material } = parcelasDoItem(it, cat);
        if (material <= 0 || it.comprado) return;
        const nome = subgrupoDe(it.desc, cat.num) || "Sem categoria";
        if (!grupos.has(nome)) grupos.set(nome, { num: null, nome, total: 0, qtds: new Map(), obras: new Map() });
        const g = grupos.get(nome);
        g.total += material;
        acumularQtd(g.qtds, it);
        const atual = g.obras.get(o.codigo) || { codigo: o.codigo, nome: o.nome, id: o.id, valor: 0, qtds: new Map() };
        atual.valor += material;
        acumularQtd(atual.qtds, it);
        g.obras.set(o.codigo, atual);
      });
    });
  });
  return [...grupos.values()].sort((a, b) => {
    if (a.nome === "Sem categoria") return 1;
    if (b.nome === "Sem categoria") return -1;
    return b.total - a.total;
  });
}

/**
 * O mesmo material a comprar, agora por PRODUTO — a descrição exata do
 * item (acento/caixa à parte), em vez da categoria. Onde `resumoPorInsumo`
 * responde "quanto falta de colchão" com uma classificação pronta, este
 * responde "quais produtos, exatamente" — sem depender de nenhuma regra
 * de subgrupo existir pra aquela verba. O preço de não classificar é
 * fragmentação (a mesma peça escrita diferente em duas obras vira duas
 * linhas) — é pra isso que a busca serve: digitar uma palavra junta tudo
 * que bate, mesmo em linhas separadas.
 */
function resumoPorProduto(obras) {
  const grupos = new Map();
  (obras || []).forEach((o) => {
    (o.categorias || []).forEach((cat) => {
      (cat.itens || []).forEach((it) => {
        if (it.ehTitulo) return;
        const { material } = parcelasDoItem(it, cat);
        if (material <= 0 || it.comprado) return;
        const nome = String(it.desc || "").replace(/\s+/g, " ").trim();
        if (!nome) return;
        const chave = semAcentos(nome);
        if (!grupos.has(chave)) grupos.set(chave, { num: null, nome, total: 0, qtds: new Map(), obras: new Map() });
        const g = grupos.get(chave);
        g.total += material;
        acumularQtd(g.qtds, it);
        const atual = g.obras.get(o.codigo) || { codigo: o.codigo, nome: o.nome, id: o.id, valor: 0, qtds: new Map() };
        atual.valor += material;
        acumularQtd(atual.qtds, it);
        g.obras.set(o.codigo, atual);
      });
    });
  });
  return [...grupos.values()].sort((a, b) => b.total - a.total);
}

/* ============================================================
   O ADITIVO DENTRO DO ORCAMENTO DA OBRA

   Aditivo APROVADO mexe no dinheiro; rascunho e reprovado nao. E' a
   unica regra que separa um documento em discussao de um compromisso
   assumido — e ela precisa valer nas tres telas, senao o Dashboard diz
   uma coisa e o Plano de Compras outra.
   ============================================================ */

const aditivoVale = (a) => a?.status === "aprovado";

/* A verba do grupo do aditivo.

   Explicita quando alguem escolheu na tela; senao, adivinhada pelo nome
   — e da' certo na maioria das vezes porque os nomes que a empresa
   escreve no aditivo SAO os nomes da EAP ("MOVEIS SOB MEDIDA", "GESSO E
   DRYWALL"). Mas adivinhacao e' palpite: por isso ela aparece no editor,
   escrita, pra poder ser corrigida antes de virar dinheiro em tres
   telas. */
function verbaDoGrupoAditivo(g) {
  return g?.verba || verbaPorNome(g?.nome) || null;
}

/**
 * O efeito dos aditivos aprovados, verba por verba.
 *
 * Adicao e supressao ficam SEPARADAS, e nao como um saldo so.
 *
 * Elas nao sao a mesma coisa com o sinal trocado: o que foi adicionado
 * precisa ser comprado, e o que foi suprimido some do escopo — nao vira
 * compra negativa. Guardadas juntas, a linha do Plano de Compras
 * significaria coisas diferentes dependendo do aditivo que a gerou.
 */
function aditivosPorVerba(aditivos) {
  const m = new Map();
  const pega = (num) => {
    if (!m.has(num)) m.set(num, { num, adicao: 0, supressao: 0, numeros: new Set() });
    return m.get(num);
  };
  (aditivos || []).filter(aditivoVale).forEach((a) => {
    ["adicao", "supressao"].forEach((secao) => {
      (a.doc?.[secao] || []).forEach((g) => {
        const num = verbaDoGrupoAditivo(g);
        const valor = totalGrupo(g);
        if (!num || valor <= 0) return;
        const v = pega(num);
        v[secao] += valor;
        v.numeros.add(a.numero);
      });
    });
  });
  m.forEach((v) => { v.saldo = v.adicao - v.supressao; });
  return m;
}

/* Grupo aprovado que nao achou verba nenhuma. Ele tem dinheiro dentro e
   ficaria invisivel se a tela so somasse o que casou — o tipo de silencio
   que faz o total da obra nao fechar sem ninguem saber por que. */
function aditivosSemVerba(aditivos) {
  const soltos = [];
  (aditivos || []).filter(aditivoVale).forEach((a) => {
    ["adicao", "supressao"].forEach((secao) => {
      (a.doc?.[secao] || []).forEach((g) => {
        const valor = totalGrupo(g);
        if (valor > 0 && !verbaDoGrupoAditivo(g)) {
          soltos.push({ numero: a.numero, secao, nome: g.nome || "(grupo sem nome)", valor });
        }
      });
    });
  });
  return soltos;
}

/**
 * As linhas de ADICAO viradas item de obra, pra entrarem no Plano de
 * Compras dentro da verba delas.
 *
 * So adicao. Supressao e' escopo que saiu — ela reduz o valor da verba,
 * e isso aparece no resumo do grupo, mas ela nao vira linha: uma linha
 * de compra negativa nao existe no mundo, e alguem tentaria comprar.
 *
 * O item nasce com `custo` e sem parcelas de material/mao de obra de
 * proposito: assim `alocacaoDoItem` decide MAT ou MO pelo mesmo caminho
 * de sempre — o padrao da empresa por descricao primeiro, as regras de
 * verba depois. Chutar a alocacao aqui criaria uma segunda verdade.
 */
function itensDeAditivo(aditivos) {
  const out = [];
  (aditivos || []).filter(aditivoVale).forEach((a) => {
    (a.doc?.adicao || []).forEach((g) => {
      const num = verbaDoGrupoAditivo(g);
      if (!num) return;
      (g.itens || []).forEach((it, k) => {
        const valor = totalItem(it);
        if (!String(it.desc ?? it.descricao ?? "").trim() && valor <= 0) return;
        /* Parcelas EXPLICITAS, e nao `custo` cru.

           `parcelasDaPlanilha` sem parcela nenhuma cai em `ehProduto`, que
           le `it.tipo` — campo que o aditivo nao tem. O valor inteiro ia
           parar em mao de obra, calado, e o material do aditivo nao
           aparecia pra comprar. Dizendo a parcela aqui, ela e' o que a
           pessoa escolheu na linha do aditivo, e nao um palpite. */
        const aloc = it.alocacao || ALOC_MAT;
        const parcelas = aloc === ALOC_MO ? { totalMaterial: 0, totalMO: valor }
          : aloc === ALOC_AMBOS ? { totalMaterial: valor / 2, totalMO: valor / 2 }
          : { totalMaterial: valor, totalMO: 0 };
        out.push({
          catNum: num,
          item: {
            ...parcelas,
            /* `codigo` porque a tabela do plano indexa a linha por ele —
               sem isso todas as linhas de aditivo teriam a mesma chave
               `undefined` e o React embaralharia as linhas ao editar. */
            codigo: `AD ${a.numero}.${g.num}.${k + 1}`,
            id: `aditivo-${a.id}-${g.id}-${it.id}`,
            desc: String(it.descricao || "").split("\n")[0].trim() || "(sem descrição)",
            descCompleta: it.descricao || "",
            ambiente: it.ambiente || "",
            qtdExecutivo: parseNumAd(it.qtd) || null,
            un: it.unidade || "",
            custo: valor,
            alocacaoManual: aloc,
            aditivo: a.numero,
            aditivoId: a.id,
          },
        });
      });
    });
  });
  return out;
}

/* As categorias da obra COM os itens de aditivo dentro do grupo de cada
   um. Derivado, nunca guardado: se isso entrasse em `obra.categorias` o
   proximo salvamento gravaria os itens de aditivo dentro da planilha, e
   na leitura seguinte eles apareceriam duas vezes — uma como planilha,
   outra como aditivo. */
function categoriasComAditivos(categorias, aditivos) {
  const extras = itensDeAditivo(aditivos);
  if (!extras.length) return categorias || [];
  const porVerba = new Map();
  extras.forEach((x) => {
    if (!porVerba.has(x.catNum)) porVerba.set(x.catNum, []);
    porVerba.get(x.catNum).push(x.item);
  });
  return (categorias || []).map((c) => {
    const meus = porVerba.get(c.num);
    return meus ? { ...c, itens: [...(c.itens || []), ...meus] } : c;
  });
}

/**
 * Os itens da obra achatados, prontos pra virar linha de SUPRESSAO.
 *
 * Supressao e' remocao do que ja existe — e o que existe esta na
 * planilha do executivo. Redigitar a descricao dali abre duas portas
 * para o erro: escrever diferente (e ai ninguem casa a supressao com a
 * linha que ela tira) e errar o valor unitario.
 *
 * O valor devolvido e' UNITARIO, porque e' o que a linha do aditivo pede.
 * E a alocacao vem junto: suprimir um item de material tira material, e
 * deixar isso pro padrao adivinhar seria jogar fora uma informacao que a
 * obra ja tem decidida.
 */
function itensParaSupressao(categorias) {
  const out = [];
  (categorias || []).forEach((cat) => {
    (cat.itens || []).forEach((it) => {
      if (it.ehTitulo) return;
      const { material, mo } = parcelasDoItem(it, cat);
      const total = material + mo;
      if (total <= 0) return;
      const qtd = it.qtdExecutivo ?? it.qtdVendida ?? null;
      const aloc = alocacaoDoItem(it, cat);
      out.push({
        chave: `${cat.num}-${it.codigo}`,
        desc: it.desc || "",
        ambiente: it.ambiente || "",
        catNum: cat.num,
        catNome: cat.nome,
        qtd: qtd && qtd > 0 ? qtd : 1,
        un: it.un || "un",
        // Sem quantidade, o total E' o unitario — dividir por nada
        // devolveria Infinity e a linha nasceria com valor absurdo.
        valorUnit: qtd && qtd > 0 ? total / qtd : total,
        alocacao: aloc,
      });
    });
  });
  return out;
}

/* Busca por pedaco de texto, sem acento e sem caixa: quem procura
   "bancada" tem que achar "BANCADA EM U" e "Bancada ilha". */
function acharNoExecutivo(itens, termo) {
  const t = String(termo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (t.length < 2) return [];
  const partes = t.split(/\s+/);
  return (itens || []).filter((x) => {
    const alvo = `${x.desc} ${x.ambiente} ${x.catNome}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return partes.every((pedaco) => alvo.includes(pedaco));
  }).slice(0, 6);
}

/**
 * O que UM canal de compra tem em UMA obra.
 *
 * Existe pro painel da Mehoo, mas nao e' dela: o mesmo recorte serve pra
 * qualquer canal, e amarrar a funcao a um fornecedor so faria a proxima
 * ser copia-e-cola desta.
 *
 * O prazo vem junto porque e' a pergunta seguinte de quem le a lista:
 * saber que ha oito itens da Mehoo nao ajuda sem saber ate quando.
 */
function itensDoCanal(obra, canalId) {
  const out = [];
  (obra.categorias || []).forEach((cat) => {
    const itens = cat.itens || [];
    itens.forEach((it) => {
      if (it.ehTitulo || it.canalCompra !== canalId) return;
      const { material, mo } = parcelasDoItem(it, cat);
      const prazo = prazoDoGrupo(cat, itens);
      out.push({
        it, cat,
        catNum: cat.num, catNome: cat.nome,
        material, mo,
        limite: prazo ? dataLimiteCompra(obra.dataEntrega, prazo.dias) : null,
        prazo,
      });
    });
  });
  // Mais apertado primeiro; sem prazo por ultimo, que e' o que nao cobra.
  return out.sort((a, b) => {
    if (!a.limite) return 1;
    if (!b.limite) return -1;
    return a.limite - b.limite;
  });
}

/**
 * O painel de um canal: uma linha por obra, so as que tem item dele.
 *
 * Obra sem nenhum item do canal fica de fora — uma lista com quinze obras
 * onde treze dizem "nenhum item" nao e' uma lista, e' um estorvo.
 */
function painelDoCanal(obras, canalId, hoje = new Date()) {
  const linhas = (obras || []).map((o) => {
    const itens = itensDoCanal(o, canalId);
    if (!itens.length) return null;
    const total = itens.reduce((a, r) => a + r.material, 0);
    const comprado = itens.filter((r) => r.it.comprado).reduce((a, r) => a + r.material, 0);
    const atrasados = itens.filter((r) => !r.it.comprado && r.limite && diasAte(r.limite, hoje) < 0).length;
    return {
      obra: o, itens, total, comprado,
      falta: total - comprado,
      nComprados: itens.filter((r) => r.it.comprado).length,
      atrasados,
      entrega: o.dataEntrega || null,
      faltamEntrega: o.dataEntrega ? diasAte(new Date(`${o.dataEntrega}T12:00:00`), hoje) : null,
    };
  }).filter(Boolean);

  // Atrasada primeiro; depois quem entrega antes; sem data por ultimo.
  linhas.sort((a, b) => {
    if ((b.atrasados > 0) - (a.atrasados > 0)) return (b.atrasados > 0) - (a.atrasados > 0);
    if (!a.entrega) return 1;
    if (!b.entrega) return -1;
    return a.entrega < b.entrega ? -1 : 1;
  });

  return {
    linhas,
    total: linhas.reduce((a, L) => a + L.total, 0),
    comprado: linhas.reduce((a, L) => a + L.comprado, 0),
    nItens: linhas.reduce((a, L) => a + L.itens.length, 0),
    atrasados: linhas.reduce((a, L) => a + L.atrasados, 0),
  };
}

/* O resumo que o Dashboard mostra: quantos, de que valor, e se algum
   grupo ficou sem verba. */
function resumoAditivos(aditivos) {
  const aprovados = (aditivos || []).filter(aditivoVale);
  const saldo = aprovados.reduce((a, x) => a + (x.totalAdicao - x.totalSupressao), 0);
  return {
    aprovados,
    pendentes: (aditivos || []).filter((a) => a.status === "rascunho"),
    saldo,
    adicao: aprovados.reduce((a, x) => a + x.totalAdicao, 0),
    supressao: aprovados.reduce((a, x) => a + x.totalSupressao, 0),
    soltos: aditivosSemVerba(aditivos),
  };
}

/* =====[ FIM DO MODELO PURO — daqui pra baixo tem JSX ]=====

   Os testes recortam o trecho ACIMA desta linha e rodam de verdade. JSX
   dentro do recorte quebra o eval com "Unexpected token '<'", que nao diz
   nada sobre a causa — ja aconteceu quatro vezes.

   Componente novo entra DEPOIS deste marcador. Funcao pura entra antes. */

function TagCanal({ id, comNome }) {
  const c = canalPorId(id);
  if (!c) return null;
  return (
    <span className="tag-canal" style={{ color: c.cor, background: c.bg }} title={`Compra por ${c.nome}`}>
      <b>{c.sigla}</b>{comNome ? ` ${c.nome}` : ""}
    </span>
  );
}

/* A coluna responde PRA ONDE O ITEM VAI, nao em que pe ele esta.

   Sao duas perguntas diferentes e elas nao cabem na mesma celula: destino
   (Sienge, Mehoo, Automacao, Cortinas, Contratos) muda uma vez; estagio
   (solicitado, pedido feito, recebido) muda toda semana. O estagio mora
   no funil de Compras de Produtos, que e onde ele e trabalhado.

   Mao de obra nao precisa que ninguem escolha: ela vai pra Contratos por
   definicao. Deixar "nao identificado" numa linha de MO era o app fingir
   nao saber uma coisa que ele sabe. */
function DestinoCompra({ item, aloc }) {
  /* Comprado ganha do canal na leitura: quem olha o plano quer saber
     primeiro o que ja resolveu. Sem isto a tela parecia que nada tinha
     sido comprado, mesmo com a compra marcada na tela de Compras. */
  if (item.comprado) {
    return (
      <span className="pill pill-ok status-pill" title={item.compradoEm
        ? `Comprado em ${new Date(item.compradoEm).toLocaleDateString("pt-BR")}${item.canalCompra ? ` por ${canalPorId(item.canalCompra)?.nome}` : ""}`
        : "Comprado"}>
        <Check size={11} /> comprado{item.canalCompra ? ` · ${canalPorId(item.canalCompra)?.sigla}` : ""}
      </span>
    );
  }
  if (item.canalCompra) return <TagCanal id={item.canalCompra} comNome />;
  if (aloc === ALOC_MO) {
    const etapa = item.statusContrato ? CONTRATO_STAGES[item.statusContrato]?.label : null;
    return (
      <span className="pill pill-contratos" title={etapa || "Mão de obra segue para Contratos"}>
        <Link2 size={10} /> Contratos{etapa ? ` · ${etapa.toLowerCase()}` : ""}
      </span>
    );
  }
  return <span className="pill pill-wait">não identificado</span>;
}

function TagAloc({ aloc, manual, onChange }) {
  // alocacaoDoItem nunca devolve vazio; se devolver, e defeito e tem que
  // gritar na tela, nao virar um tracinho discreto que ninguem investiga.
  if (!aloc) return <span className="aloc aloc-vazio" title="Item sem alocação de recurso — isto é um defeito, me avise">SEM ALOC.</span>;
  const etiqueta = (
    <span className={`aloc aloc-${String(aloc).toLowerCase()} ${manual ? "aloc-manual" : ""}`}
      title={manual ? "Alocação corrigida à mão — o valor deste item foi para esta coluna" : undefined}>
      {ROTULO_ALOC[aloc]}
    </span>
  );
  if (!onChange) return etiqueta;
  return (
    <span className="aloc-edit">
      {etiqueta}
      <select value={aloc} onChange={(e) => onChange(e.target.value)} aria-label="Alocação de recurso"
        title="Trocar a alocação. O valor do item vai junto pra coluna escolhida — o total não muda.">
        <option value={ALOC_MAT}>{NOME_ALOC.MAT}</option>
        <option value={ALOC_MO}>{NOME_ALOC.MO}</option>
        <option value={ALOC_AMBOS}>{NOME_ALOC.AMBOS}</option>
      </select>
    </span>
  );
}

/* Uma linha do plano, com MAT e MO lado a lado no MESMO item.

   Antes eram duas tabelas separadas dentro do grupo — "Produtos" e
   "Servicos / mao de obra". O item que tem as DUAS parcelas so aparecia
   na de produtos, e a mao de obra dele virava uma tarjinha embaixo da
   descricao. Na 2519 isso e 88 itens: quem fechava o plano via o
   material e tinha que cacar a mao de obra deles um a um.

   O que NAO mudou: MO continua indo pra Contratos, nao pra Compras. A
   linha so de MO nao ganha caixinha de compra — ela diz pra onde vai. */
function LinhaPlano({ item, cat, onAlocar, onSepararMO, onJuntarMO, onAprovar }) {
  const alertas = itemAlertas(item);
  const bloqueado = alertas.includes("escopo");
  const { material, mo, estimado, manual } = parcelasDoItem(item, cat);
  const aloc = alocacaoDoItem(item, cat);
  const compravel = aloc !== ALOC_MO;   // so quem tem material vai pra Compras

  return (
    /* A cor da linha diz o estado sem ocupar coluna nenhuma.

       Verde e comprado, amarelo e falta comprar. Os dois em tom bem
       claro de proposito: com 174 linhas, cor forte vira parede e para
       de informar. O verde e um tico mais presente que o amarelo porque
       ele e a excecao — a maioria falta comprar, e o que muda o dia e
       ver o que ja saiu.

       Mao de obra fica branca: ela nao e "falta comprar", ela vai pra
       Contratos. Pintar de amarelo criaria uma pendencia que nao existe.

       Alerta e avulso ganham da cor de status: um problema de escopo
       importa mais que o andamento da compra. */
    <tr className={
      item.aditivo ? "row-aditivo"
      : item.avulso ? "row-avulso"
      : alertas.length ? "row-alert"
      : item.comprado ? "row-comprado"
      : compravel ? "row-falta" : ""
    }>
      {/* A coluna "Compr." saiu.

          Ela era uma caixinha de marcar que dizia exatamente o que a
          coluna "Situação de compra", duas casas adiante, ja dizia por
          extenso, e num tracejado laranja que a distancia parecia
          alerta. Duas colunas pra mesma informacao, uma parecendo erro.

          O controle nao se perdeu: a propria situacao virou o botao. */}
      <td className="mono dim">{item.codigo}</td>
      <td>
        <div className="item-desc">{item.desc}</div>
        {item.aditivo
          ? <span className="tag-aditivo" title={item.descCompleta || undefined}>
              <FileText size={9} /> aditivo {item.aditivo}{item.ambiente ? ` · ${item.ambiente}` : ""}
            </span>
          : item.avulso
          ? <span className="tag-avulso" title={item.avulsoEm ? `Pedido em ${new Date(item.avulsoEm).toLocaleDateString("pt-BR")}` : undefined}>
              <Plus size={9} /> compra avulsa{item.avulsoPor ? ` · ${item.avulsoPor}` : ""}
            </span>
          : <ItemTags item={item} alertas={alertas} />}
        {item.avulso && item.avulsoObs && <div className="avulso-obs">{item.avulsoObs}</div>}
        {/* As duas pontas do vinculo aparecem, cada uma na sua linha.
            Item que se parte em dois e onde a conferencia de meses depois
            trava: sem a seta, sao duas linhas iguais em verbas diferentes
            e ninguem lembra se e separacao ou duplicata. */}
        {item.moSeparada && (
          <span className="tag-separado">
            {/* A linha separada esta logo abaixo, na mesma verba — nao ha
                mais pra onde mandar a pessoa. */}
            <CornerDownRight size={10} /> mão de obra de {fmtBRL(item.moSeparada.valor)} separada na linha abaixo
            {onJuntarMO && <button className="btn-juntar" onClick={onJuntarMO} title="Traz a mão de obra de volta para este item e apaga a linha separada">juntar de volta</button>}
          </span>
        )}
        {item.separadoDe && (
          <span className="tag-separado">
            <CornerDownRight size={10} /> mão de obra do item {item.separadoDe.codigo}
          </span>
        )}
        {item.contavel && <SiengeMatch sienge={item.sienge} />}
      </td>
      <td className="mono center dim">{item.ambiente}</td>
      <td className="mono center">
        {/* `qtdVendida` entra na conta: o leitor do executivo grava a
            quantidade nesse campo, e a tela so olhava `qtdExecutivo` — o
            numero vinha certo do arquivo e virava travessao na tabela. */}
        <span className={item.excedeQtd ? "qtd-bad" : ""}>{item.qtdExecutivo ?? item.qtdVendida ?? item.qtd ?? "—"}</span> <span className="unit">{item.un}</span>
      </td>
      <td className="center">
        <TagAloc aloc={aloc} manual={!!item.alocacaoManual} onChange={onAlocar} />
        {/* So faz sentido separar o que TEM as duas parcelas, e so uma
            vez. Item que ja mora na propria verba de mao de obra nao tem
            pra onde ir. */}
        {podeSepararMO(item, cat) && onSepararMO && (
          <button className="btn-separar" onClick={onSepararMO}
            title="Tira a mão de obra deste item e cria uma linha só dela logo abaixo, com a mesma descrição e quantidade. O total não muda.">
            <GitCompare size={9} /> separar MO
          </button>
        )}
      </td>
      <td className="mono right">
        {material > 0 ? fmtBRL(material) : <span className="dim">—</span>}
        {estimado && !manual && material > 0 && <span className="dim est-tag" title="A planilha não trouxe a coluna de material — assumido o custo total">est.</span>}
      </td>
      <td className="mono right">
        {mo > 0 ? fmtBRL(mo) : <span className="dim">—</span>}
        {estimado && !manual && mo > 0 && <span className="dim est-tag" title="A planilha não trouxe a coluna de mão de obra — assumido o custo total">est.</span>}
      </td>
      {/* O total sai da SOMA das duas colunas ao lado, nao de `item.custo`.

          Custo e o numero que veio da planilha e ele nao acompanha o que
          acontece depois: separada a mao de obra, a linha mostrava MAT
          R$ 1.832, MO vazia e total R$ 2.519 — os R$ 687 que tinham ido
          pra outra verba continuavam somando ali. Tres colunas na mesma
          linha que nao fecham entre si e o tipo de erro que faz a pessoa
          parar de confiar na tela inteira. */}
      <td className="mono right">
        {item.custo == null && material + mo === 0
          ? <span className="dim">a orçar</span>
          : fmtBRL(material + mo)}
      </td>
      <td className="center">
        {bloqueado
          ? <button className="btn-approve" onClick={onAprovar}><Check size={12} /> Aprovar p/ compra</button>
          : <DestinoCompra item={item} aloc={aloc} />}
      </td>
    </tr>
  );
}

/* ============================================================
   PLANO DE COMPRAS — o que vai ser comprado, e com que dinheiro
   ------------------------------------------------------------
   Um item do Executivo não é "produto OU serviço": ele tem até DUAS
   parcelas, e cada uma segue seu caminho.

     Spot de Sobrepor Loyo Up MR16   material R$ 182 -> Compras
                                     mão de obra R$ 180 -> Contratos

   O app decidia um destino só, pelo material ser maior que zero. Na
   planilha da 2519 isso são 88 itens com as duas parcelas: R$ 1,5 mi de
   mão de obra que nunca chegava em Contratos e ainda inflava o total de
   Compras. O mesmo dinheiro errado nos dois lados.
   ============================================================ */

// Quanto do item é material e quanto é mão de obra.
//
// A planilha traz as duas colunas. Quando não trouxe (importação por PDF,
// que perde coluna), o app cai no que sabia antes: produto era tudo
// material, serviço era tudo mão de obra — e a linha fica marcada como
// estimada, pra ninguém tratar palpite como número da planilha.
function parcelasDoItem(it, cat) {
  const daPlanilha = parcelasDaPlanilha(it);
  /* MO separada virou linha propria em outra verba. Continuar contando
     aqui seria contar o mesmo dinheiro nos dois lugares — e o total da
     obra subiria sozinho, sem ninguem ter gasto nada. */
  const base = it.moSeparada ? { ...daPlanilha, mo: 0, moSeparada: true } : daPlanilha;
  /* Decisao de gente move o dinheiro junto — seja a desta obra ou o
     padrao da empresa. Linha nascida de separacao fica fora: as parcelas
     dela ja foram definidas na hora de partir, e aplicar o padrao por
     cima devolveria o valor pra coluna errada. Avulso tambem fica fora:
     sem parcela nenhuma pra mover (`custo: null`), a regra do MAT+MO
     nao tem o que fazer nele. */
  const semRegraAutomatica = it.moSeparada || it.separadoDe || it.avulso;
  const decidida = it.alocacaoManual
    || (semRegraAutomatica ? null : padraoDaDescricao(it.desc))
    // MAT+MO virou MO por regra da empresa — mesma condicao de
    // `alocacaoDoItem`, pra dinheiro e rotulo nunca contarem coisas
    // diferentes sobre o mesmo item.
    || (semRegraAutomatica ? null : (seriaMatMaisMoDaEmpresa(cat, daPlanilha) ? ALOC_MO : null));
  if (!decidida) return base;
  /* Corrigiu a alocacao, o dinheiro acompanha — senao a correcao seria
     enfeite e a verba continuaria contando pro lado errado.

     O TOTAL do item nunca muda: o valor troca de coluna, MAT vira MO ou
     o contrario, e a soma MAT+MO do grupo fica identica. Nenhuma
     correcao aqui cria ou destroi dinheiro, e por isso nenhuma delas
     mexe no CMV.

     MAT/MO devolve a divisao que a planilha trouxe: e o jeito de
     desfazer, sem precisar lembrar dos numeros originais. */
  const total = base.material + base.mo;
  if (decidida === ALOC_MAT) return { ...base, material: total, mo: 0, manual: true };
  if (decidida === ALOC_MO) return { ...base, material: 0, mo: total, manual: true };
  return { ...base, manual: true };
}

function parcelasDaPlanilha(it) {
  const qtd = it.qtdExecutivo ?? it.qtdVendida ?? null;
  const mat = it.totalMaterial ?? (it.custoMaterial != null && qtd ? it.custoMaterial * qtd : null);
  const mo = it.totalMO ?? (it.custoMO != null && qtd ? it.custoMO * qtd : null);
  if (mat == null && mo == null) {
    return ehProduto(it)
      ? { material: it.custo || 0, mo: 0, estimado: true }
      : { material: 0, mo: it.custo || 0, estimado: true };
  }
  return { material: mat || 0, mo: mo || 0, estimado: false };
}

/* Ate quando o material deste grupo TEM que estar comprado.

   O numero que importa nao e "quantos dias leva", e "a partir de quando
   ja e tarde". Por isso a celula mostra a DATA e a contagem, nao o prazo
   de entrega do fornecedor: ninguem faz essa subtracao de cabeca no meio
   de uma conferencia de 200 itens.

   Grupo sem regra nasce em branco pra ser preenchido na mao — em dias, e
   nao em data, porque dia de antecedencia sobrevive a mudanca da data de
   entrega da obra, e data digitada nao. */
function PrazoCompra({ cat, itens, dataEntrega }) {
  const prazo = prazoDoGrupo(cat, itens);
  // Celula vazia, e nao ausente: sem ela as colunas MAT e MO dos grupos
  // sem regra deslizariam pra esquerda e a lista deixaria de ser lida
  // como coluna.
  if (!prazo) return <div className="grp-prazo" />;

  const limite = dataLimiteCompra(dataEntrega, prazo.dias);
  const faltam = diasAte(limite);
  const tom = faltam == null ? "" : faltam < 0 ? "prazo-vencido" : faltam <= 15 ? "prazo-perto" : "";
  const conta = faltam == null ? null
    : faltam < 0 ? `passou ${Math.abs(faltam)} ${Math.abs(faltam) === 1 ? "dia" : "dias"}`
    : faltam === 0 ? "é hoje"
    : `faltam ${faltam} ${faltam === 1 ? "dia" : "dias"}`;

  const porque = prazo.incerto
    ? `${prazo.dias} dias — nenhum fornecedor reconhecido nas linhas, então vale o prazo mais longo (${prazo.fornecedor})`
    : prazo.fornecedor
      ? `${prazo.dias} dias (${prazo.fornecedor})${prazo.varios ? " — o mais apertado do grupo" : ""}`
      : `${prazo.dias} dias antes da entrega`;

  return (
    <div className={`grp-prazo ${tom}`} title={porque}>
      <div className="grp-tot-rot">
        COMPRAR ATÉ
        {prazo.incerto && <span className="prazo-marca" title={porque}>?</span>}
      </div>
      {limite ? (
        <>
          <div className="grp-tot-val mono">{fmtData(limite)}</div>
          <div className="prazo-conta">{conta}</div>
        </>
      ) : (
        /* Sem data de entrega, mostra so a antecedencia. Repetir "falta a
           data de entrega" em quinze grupos era encher a tela com o mesmo
           recado — ele passou a ser um aviso unico, no topo. */
        <>
          <div className="grp-tot-val mono dim">{prazo.dias} dias</div>
          <div className="prazo-conta">antes da entrega</div>
        </>
      )}
    </div>
  );
}

function GrupoPlano({ cat, itens, expanded, onToggle, onItemChange, onAlocar, onSepararMO, onJuntarMO, onSepararGrupo, dataEntrega, aditivo }) {
  const mat = itens.reduce((a, it) => a + parcelasDoItem(it, cat).material, 0);
  const mo = itens.reduce((a, it) => a + parcelasDoItem(it, cat).mo, 0);
  const nAvulsos = itens.filter((it) => it.avulso).length;
  const nAditivo = itens.filter((it) => it.aditivo).length;
  // Quantos ainda tem as duas parcelas na mesma linha. E o que o botao do
  // grupo resolve de uma vez, pras obras salvas antes desta regra.
  const aSeparar = itens.filter((it) => podeSepararMO(it, cat)).length;

  return (
    <div className="grp-block" data-grp={cat.num}>
      {/* Era um <button> so. Virou div com o botao SO na parte esquerda:
          o campo de dias e o "x" de limpar sao controles, e controle
          dentro de botao nao e HTML valido — o clique de um come o do
          outro. A area de abrir continua sendo a maior parte da linha. */}
      <div className="grp-head">
        <button className="grp-toggle" onClick={onToggle}>
          <div className="grp-esq">
          {expanded ? <ChevronDown size={15} className="dim" /> : <ChevronRight size={15} className="dim" />}
          <span className="grp-num mono">{cat.num}</span>
          <span className="grp-nome">{cat.nome}</span>
          {cat.foraDeEscopoCategoria && <span className="chip chip-red"><XCircle size={11} /> Fora do escopo vendido</span>}
          <span className="grp-conta">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
          {nAvulsos > 0 && <span className="grp-avulsos"><Plus size={9} /> {nAvulsos} avulso{nAvulsos > 1 ? "s" : ""}</span>}
          {/* O que veio de aditivo fica dito no cabecalho: o total do
              grupo cresceu, e sem isso a pessoa procura na planilha uma
              linha que nunca esteve la. Supressao aparece junto porque
              ela nao vira item — se so a adicao aparecesse, o grupo
              pareceria ter crescido mais do que cresceu. */}
          {aditivo && (
            <span className="grp-aditivo" title={`Aditivo ${[...aditivo.numeros].join(", ")}`}>
              <FileText size={9} /> aditivo
              {aditivo.adicao > 0 && <b className="adit-mais"> +{fmtBRL(aditivo.adicao)}</b>}
              {aditivo.supressao > 0 && <b className="adit-menos"> −{fmtBRL(aditivo.supressao)}</b>}
            </span>
          )}
          </div>
        </button>
        <div className="grp-dir">
          <PrazoCompra cat={cat} itens={itens} dataEntrega={dataEntrega} />
          <div className="grp-tot">
            <div className="grp-tot-rot">MAT</div>
            <div className={`grp-tot-val mono ${mat > 0 ? "" : "dim"}`}>{mat > 0 ? fmtBRL(mat) : "—"}</div>
          </div>
          <div className="grp-tot">
            <div className="grp-tot-rot">MO</div>
            <div className={`grp-tot-val mono ${mo > 0 ? "" : "dim"}`}>{mo > 0 ? fmtBRL(mo) : "—"}</div>
          </div>
          {/* COMPROMETIDO SIENGE — a coluna existe, o numero ainda nao.

              Vazia a vista, e nao escondida ate ficar pronta: quem
              confere precisa saber que este numero VAI existir, senao
              planeja em cima do que tem hoje e refaz depois.

              O aviso "em desenvolvimento" mora UMA vez, no topo da tela,
              e nao em cada verba: repetido trinta vezes ele engrossava a
              coluna a ponto de ela parecer o cabecalho da tabela de itens
              logo abaixo — que tem "Destino" na mesma posicao. */}
          <div className="grp-tot grp-tot-wip" title="Quanto desta verba já está comprometido em pedidos no Sienge. Em desenvolvimento — o número virá da integração com o Sienge.">
            <div className="grp-tot-rot">SIENGE</div>
            <div className="grp-tot-val mono dim">—</div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="grp-itens">
          {/* Fora do cabecalho de proposito: ele e um <button>, e botao
              dentro de botao nao e HTML valido — o clique de um comeria o
              do outro. Aqui tambem fica melhor: separa depois de olhar. */}
          {aSeparar > 0 && onSepararGrupo && (
            <div className="grp-acao">
              <GitCompare size={12} className="dim" />
              <span>
                <b>{aSeparar}</b> {aSeparar === 1 ? "item tem" : "itens têm"} MAT e MO na mesma linha.
                {" "}Separar cria a linha de mão de obra logo abaixo, aqui mesmo, com a mesma descrição e quantidade.
              </span>
              <button className="btn-separar-grupo" onClick={onSepararGrupo}>Separar MO do grupo</button>
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th style={{ width: 62 }}>Cód.</th>
                <th>Descrição</th>
                <th style={{ width: 88 }}>Ambiente</th>
                <th style={{ width: 78 }} className="center">Qtd.</th>
                <th style={{ width: 72 }} className="center">Alocação</th>
                <th style={{ width: 100 }} className="right">MAT</th>
                <th style={{ width: 100 }} className="right">MO</th>
                <th style={{ width: 100 }} className="right">Total</th>
                <th style={{ width: 170 }} className="center">Destino</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => {
                const idx = (cat.itens || []).indexOf(it);
                return (
                  <LinhaPlano key={it.codigo} item={it} cat={cat}
                    onAlocar={(v) => onAlocar(it, idx, v)}
                    onSepararMO={onSepararMO ? () => onSepararMO(it.codigo) : null}
                    onJuntarMO={onJuntarMO ? () => onJuntarMO(it.codigo) : null}
                    onAprovar={() => onItemChange(idx, { statusEscopo: "aprovado" })}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* Pedido de compra avulsa.

   E o item que a obra precisa e o executivo nao tinha: quebrou, o cliente
   pediu depois, faltou. Aqui SO se registra o pedido — descricao,
   quantidade, em que verba cai e se e MAT, MO ou os dois.

   Valor nao entra de proposito. Quem descobre quanto custa e a compra,
   la na frente; um numero chutado agora entraria no total da verba como
   se fosse orcamento e sujaria a unica coisa que esta tela existe pra
   proteger, que e o CMV. Por isso o avulso nasce com `custo: null` e as
   somas de MAT e MO continuam sendo so o que veio da planilha. */
function FormAvulsa({ obra, onCriar }) {
  const verbas = obra.categorias.filter((c) => !c.foraDaEapPadrao);
  const [aberto, setAberto] = useState(false);
  const [verbaNum, setVerbaNum] = useState(verbas[0]?.num || "");
  const [desc, setDesc] = useState("");
  const [qtd, setQtd] = useState("");
  const [un, setUn] = useState("un");
  const [ambiente, setAmbiente] = useState("");
  const [aloc, setAloc] = useState(ALOC_MAT);

  function submit(e) {
    e.preventDefault();
    if (!desc.trim() || !verbaNum) return;
    const qtdNum = parseFloat(qtd.replace(/\./g, "").replace(",", "."));
    onCriar(verbaNum, {
      desc: desc.trim(),
      qtdExecutivo: isNaN(qtdNum) ? null : qtdNum,
      un: un.trim() || "un",
      ambiente: ambiente.trim() || "",
      alocacao: aloc,
      // `tipo` continua existindo pro resto do app (Compras e Contratos
      // ainda leem esse campo); a alocacao e que manda nesta tela.
      tipo: aloc === ALOC_MO ? "servico" : "produto",
      custo: null,
      avulso: true,
      // Ja nasce dentro do plano: quem pediu quer comprar, nao propor.
      compraDecidida: true,
      liberado: aloc !== ALOC_MO,
    });
    setDesc(""); setQtd(""); setAmbiente("");
    setAberto(false);
  }

  if (!aberto) {
    return (
      <button className="btn-avulsa" onClick={() => setAberto(true)}>
        <Plus size={14} /> Compra avulsa
      </button>
    );
  }

  return (
    <form className="form-solicitacao form-avulsa" onSubmit={submit}>
      <div className="form-solicitacao-title">Solicitar compra avulsa</div>
      <div className="form-avulsa-nota">
        Item que a obra precisa e o executivo não tinha. Aqui entra só o pedido —
        <b> o valor não</b>, porque quem descobre quanto custa é a compra. Nenhum total de verba muda.
      </div>
      <div className="form-row">
        <label className="form-label">Verba da EAP
          <select className="form-select" value={verbaNum} onChange={(e) => setVerbaNum(e.target.value)}>
            {verbas.map((c) => <option key={c.num} value={c.num}>{c.num} — {c.nome}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label className="form-label">Descrição
          <input className="form-input" type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Ex: Spot de sobrepor Loyo Up MR16" required autoFocus />
        </label>
      </div>
      <div className="form-row form-row-3">
        <label className="form-label">Qtd.
          <input className="form-input" type="text" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="1" />
        </label>
        <label className="form-label">Unidade
          <input className="form-input" type="text" value={un} onChange={(e) => setUn(e.target.value)} placeholder="un" />
        </label>
        <label className="form-label">Ambiente
          <input className="form-input" type="text" value={ambiente} onChange={(e) => setAmbiente(e.target.value)} placeholder="Living" />
        </label>
      </div>
      <div className="form-row">
        <span className="form-label" style={{ display: "block" }}>Alocação de recurso</span>
        <div className="aloc-escolha">
          {[
            { id: ALOC_MAT, rot: "MAT", sub: "só MATERIAL" },
            { id: ALOC_MO, rot: "MO", sub: "só MÃO DE OBRA" },
            { id: ALOC_AMBOS, rot: "MAT+MO", sub: "os dois" },
          ].map((o) => (
            <button key={o.id} type="button"
              className={`aloc-op ${aloc === o.id ? "ativo" : ""}`}
              onClick={() => setAloc(o.id)}>
              <span className={`aloc aloc-${String(o.id).toLowerCase()}`}>{o.rot}</span>
              <span className="aloc-op-sub">{o.sub}</span>
            </button>
          ))}
        </div>
        {aloc === ALOC_MO && (
          <div className="form-avulsa-aviso">
            Só MÃO DE OBRA vai para <b>Contratos</b>, não para Compras.
          </div>
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="btn-cancelar" onClick={() => setAberto(false)}>Cancelar</button>
        <button type="submit" className="btn-criar">Registrar pedido</button>
      </div>
    </form>
  );
}

const FILTERS = [
  { id: "todos", label: "Todos os itens" },
  { id: "sem_destino", label: "Sem destino" },
  { id: "comprado", label: "Já comprado" },
  { id: "falta", label: "Falta comprar" },
  { id: "alerta", label: "Com alerta" },
];

// PLANILHA DE COMPRA — a versão que o time libera pra valer.
//
// É aqui que a obra deixa de ser rascunho: aprovado, nada das etapas
// anteriores (Vendido Contrato, Vendido Planilha, Depara, Executivo)
// pode mais ser mexido. Compras e Contratos passam a trabalhar em cima
// de um número que não muda mais debaixo deles.
// Liberação da compra, com a porta de saída pro estouro.
//
// Passar do CMV não bloqueia — bloquear empurraria a obra pra fora da
// plataforma, e aí ninguém enxerga nada. O que muda é o preço de passar:
// exige justificativa escrita e o nome de quem autorizou, e isso fica
// gravado na obra. A decisão continua sendo de gente; o registro é que
// deixa de ser opcional.
function LiberacaoCompra({ obra, temItens, podeEditar, onLiberar }) {
  const [justificativa, setJustificativa] = useState("");
  const [aprovador, setAprovador] = useState("");

  const totalExecutivo = obra.categorias.reduce(
    (a, c) => a + (c.itensPlanilhaExecutivo || []).reduce((s, it) => s + (it.excluido ? 0 : (it.custo || 0)), 0), 0);
  const teto = cmvDaObra(obra)?.total || 0;
  const estouro = teto > 0 ? totalExecutivo - teto : 0;
  const acimaDoTeto = estouro > 0.01;

  /* Portão da assinatura do cliente.

     Comprar antes de o cliente aprovar o executivo é assumir, no nome da
     empresa, um risco que não é da equipe. Por isso bloqueia por padrão —
     mas não trava de vez: se o cliente assinou no papel e ninguém
     registrou, travar pararia a obra por um problema de digitação. Um
     superior libera com justificativa, e fica gravado quem foi. */
  const semAssinatura = !obra.clienteAssinouEm;
  const precisaExcecao = acimaDoTeto || semAssinatura;
  const faltaJustificar = precisaExcecao && (justificativa.trim().length < 15 || aprovador.trim().length < 3);
  const bloqueado = !temItens || !podeEditar || faltaJustificar;

  return (
    <div className={`aprovacao-box ${precisaExcecao ? "com-estouro" : ""}`}>
      {semAssinatura && (
        <div className="estouro-aviso bloqueio-assinatura">
          <Lock size={15} />
          <span>
            <b>O cliente ainda não aprovou o projeto executivo.</b> Esta planilha não deveria ser
            liberada antes disso — registre a assinatura na etapa <b>Aprovação do Cliente</b>.
            Se ela já aconteceu e só falta registrar, um superior pode liberar aqui, com justificativa.
          </span>
        </div>
      )}
      {acimaDoTeto && (
        <div className="estouro-aviso">
          <AlertTriangle size={15} />
          <span>
            O Executivo está <b>{fmtBRL(estouro)} acima</b> do CMV liberado ({fmtBRL(teto)}).
            Dá pra seguir, mas precisa de justificativa e de quem autorizou — fica registrado na obra.
          </span>
        </div>
      )}

      {precisaExcecao && (
        <div className="estouro-campos">
          <label>
            <span>{semAssinatura && acimaDoTeto ? "Por que liberar sem a assinatura do cliente e acima do CMV?"
              : semAssinatura ? "Por que liberar sem a aprovação do cliente registrada?"
              : "Por que o custo passou do CMV?"}</span>
            <textarea rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
              placeholder={semAssinatura
                ? "Ex: cliente assinou o executivo na reunião de 12/08, documento físico a caminho do escritório."
                : "Ex: cliente aprovou troca do ar-condicionado por modelo superior, com aditivo de contrato."} />
          </label>
          <label>
            <span>Autorizado por</span>
            <input value={aprovador} onChange={(e) => setAprovador(e.target.value)} placeholder="Nome de quem autorizou a exceção" />
          </label>
        </div>
      )}

      <div className="aprovacao-resumo">
        {!temItens
          ? "Importe o Executivo desta obra antes de liberar — sem itens não há o que comprar."
          : "Ao liberar, este vira o plano oficial de compra: Vendido, Depara e Executivo ficam congelados."}
      </div>

      <button className="btn-aprovar" disabled={bloqueado} onClick={() => {
        onLiberar(precisaExcecao
          ? { estouro: acimaDoTeto ? estouro : 0, semAssinatura,
              justificativa: justificativa.trim(), aprovador: aprovador.trim() }
          : null);
      }}>
        <ShieldCheck size={14} /> {precisaExcecao ? "Liberar com exceção registrada" : "Liberar plano de compras"}
      </button>
    </div>
  );
}

/* Traduz um indice da lista COM aditivo pro indice na planilha real.

   Devolve null quando o indice cai num item de aditivo: ele existe na
   tela, mas nao existe em `categorias`, e escrever nele criaria uma
   linha fantasma dentro da planilha. */
function indiceRealDoItem(obraCrua, catNum, itemIdx) {
  const cat = (obraCrua.categorias || []).findIndex((c) => c.num === catNum);
  if (cat < 0) return null;
  const reais = (obraCrua.categorias[cat].itens || []).length;
  if (itemIdx == null || itemIdx < 0 || itemIdx >= reais) return null;
  return { cat, item: itemIdx };
}

/* O Plano de Compras enxerga a obra COM os itens de aditivo dentro do
   grupo de cada um. Derivado aqui, e nunca gravado: se isso entrasse em
   `obra.categorias` o proximo salvamento gravaria o aditivo dentro da
   planilha, e na leitura seguinte ele apareceria duas vezes. */
function ComparativoView({ obra: obraCrua, expandedCats, toggleCat, updateItem, itemFilter, setItemFilter, tipoFilter, setTipoFilter, onLiberar, onReabrir, onCriarAvulsa, onSepararMO, onJuntarMO, onSepararGrupo, onAlocar, onIrParaDashboard, podeEditar }) {
  /* A obra COM os itens de aditivo dentro do grupo de cada um.

     Tem que ser a primeira linha: tudo nesta tela le `obra`, e uma copia
     derivada declarada no meio do componente deixa as linhas de cima
     lendo a obra sem aditivo — duas verdades no mesmo render. */
  const obra = useMemo(() => ({
    ...obraCrua,
    categorias: categoriasComAditivos(obraCrua.categorias, obraCrua.aditivos),
  }), [obraCrua]);
  const aditPorVerba = useMemo(() => aditivosPorVerba(obraCrua.aditivos), [obraCrua.aditivos]);

  const temItens = obra.categorias.some((c) => (c.itens || []).length > 0);

  /* "Só o vendido" nasce ligado.

     A EAP padrão tem 32 grupos e obra nenhuma vende os 32; além disso a
     proposta traz linhas com quantidade E valor zerados só pra nomear
     escopo (quadro decorativo, enxoval). Nenhuma das duas coisas tem o
     que comprar, e deixá-las na tela fazia a pessoa rolar por grupos e
     linhas vazias pra achar as que interessam. Continua dando pra ver
     tudo — é um clique, e o chip diz quantas estão escondidas. */
  const [soVendido, setSoVendido] = useState(true);

  // Achada pelo NOME: a EAP renumerou uma vez e obra salva antes da troca
  // guarda a numeracao velha, entao "32" cru nao serve.
  // Só vale avisar da data faltando se algum grupo de fato tem prazo.
  const temPrazos = useMemo(() => (obra.categorias || []).some((c) =>
    prazoDoGrupo(c, c.itens)), [obra.categorias]);

  // O placar da seleção. Sem ele a pessoa só descobre o tamanho do que
  // escolheu abrindo verba por verba — e o número que importa não é
  // quantos itens, é quanto de material vai pra compra.
  /* O placar do topo.

     Ele media `it.liberado` — um campo que ficou INALCANCAVEL quando o
     botao de incluir/tirar do plano saiu da tabela. Ninguem mais podia
     mudar, entao a barra mostrava R$ 500 numa obra de R$ 318 mil e a
     contagem vinha NaN, porque somava uma sugestao que nao existe mais.

     Agora ele le o que a tela de fato mostra: todo o material do plano,
     a mao de obra que segue pra Contratos, e quanto ja foi comprado. */
  const plano = useMemo(() => {
    let nItens = 0, materialNoPlano = 0, moForaDoPlano = 0, comprado = 0, nComprados = 0;
    (obra.categorias || []).forEach((cat) => (cat.itens || []).forEach((it) => {
      if (it.ehTitulo) return;
      const { material, mo } = parcelasDoItem(it, cat);
      if (material <= 0 && mo <= 0) return;
      materialNoPlano += material;
      moForaDoPlano += mo;
      nItens += 1;
      if (it.comprado) { comprado += material; nComprados += 1; }
    }));
    return { nItens, materialNoPlano, moForaDoPlano, comprado, nComprados };
  }, [obra]);

  /* O item que entra na tela.

     Três cortes, e cada um responde a uma pergunta diferente:
     `ehTitulo` é a linha que só nomeia um bloco dentro da verba e nunca
     foi compra; `itemFoiVendido` separa o que foi vendido do que entrou
     na proposta zerado; e os filtros de alocação e situação são o que a
     pessoa escolheu ver.

     Avulso passa por cima do corte do vendido: ele não veio da planilha,
     então não tem como "ter sido vendido" — é justamente por isso que
     ele existe. Escondê-lo aqui seria esconder o pedido de quem pediu. */
  const grupos = useMemo(() => obra.categorias.map((cat) => {
    const todos = (cat.itens || []).filter((it) => !it.ehTitulo);
    const base = soVendido ? todos.filter((it) => it.avulso || itemFoiVendido(it)) : todos;
    return { cat, itens: base.filter((it) => matchesFilter(it, itemFilter, cat) && casaAloc(it, tipoFilter, cat)) };
  }).filter((g) => g.itens.length > 0), [obra, soVendido, itemFilter, tipoFilter]);

  // Quantas linhas o "só o vendido" está escondendo. Sem esse número o
  // filtro vira uma caixa-preta: a pessoa não sabe se sumiram 3 linhas
  // ou 300, e passa a desconfiar do total.
  const ocultosNaoVendidos = useMemo(() => obra.categorias.reduce((a, c) =>
    a + (c.itens || []).filter((it) => !it.ehTitulo && !it.avulso && !itemFoiVendido(it)).length, 0), [obra]);

  // Conta na EAP inteira pra estampar no chip. Saber quanto é só MAT,
  // quanto é só MO e quanto tem as duas parcelas, antes de clicar, é o
  // que diz de qual lado começar.
  const todosItens = obra.categorias.flatMap((c) => (c.itens || [])
    .filter((it) => !it.ehTitulo && (!soVendido || it.avulso || itemFoiVendido(it)))
    .map((it) => [it, c]));
  const contaAloc = (a) => todosItens.filter(([it, c]) => alocacaoDoItem(it, c) === a).length;
  const contaPorAloc = {
    todos: todosItens.length,
    [ALOC_MAT]: contaAloc(ALOC_MAT),
    [ALOC_MO]: contaAloc(ALOC_MO),
    [ALOC_AMBOS]: contaAloc(ALOC_AMBOS),
  };

  return (
    <>
      {obra.comprasLiberadas ? (
        <div className="import-ok liberado-barra">
          <ShieldCheck size={14} />
          <span>Plano de Compras liberado — as etapas anteriores estão congeladas.</span>
          {/* Toda trava precisa de volta. Sem isso, um clique sem querer
              congela a obra inteira e só se resolve mexendo no banco —
              o que ninguém do time consegue fazer. */}
          {podeEditar && (
            <button className="btn-reabrir-etapa" onClick={() => {
              if (window.confirm(
                "Reabrir as etapas anteriores?\n\n" +
                "Vendido, Depara e Executivo voltam a aceitar alteração. " +
                "Use quando algo precisar ser corrigido depois da liberação.\n\n" +
                "Compras e contratações já feitas não são desfeitas."
              )) onReabrir();
            }}>
              <RotateCcw size={12} /> Reabrir etapas
            </button>
          )}
        </div>
      ) : (
        <div className="import-bar" style={{ marginBottom: 14 }}>
          <div className="import-info">
            <Lock size={14} />
            <span>Este é o plano que libera compras e contratações. Ao liberar, <b>as etapas anteriores são congeladas</b> e não podem mais ser alteradas.</span>
          </div>
        </div>
      )}
      {/* A avulsa fica no topo, junto do resumo — e uma acao sobre a obra
          inteira, nao sobre a lista filtrada abaixo. Continua disponivel
          DEPOIS da liberacao: e pra isso que ela serve, o item que quebrou
          ou que o cliente pediu depois aparece justamente quando o plano
          ja fechou. Trava-la junto com as etapas anteriores empurraria a
          compra pra fora da plataforma, o unico lugar onde ela fica
          registrada. */}
      {podeEditar && <FormAvulsa obra={obra} onCriar={onCriarAvulsa} />}

      {/* Um aviso, nao quinze. O prazo de compra de cada grupo depende
          desta data, e sem ela o alerta que evita comprar um item de 75
          dias com 40 simplesmente nao existe. */}
      {!obra.dataEntrega && temPrazos && (
        <div className="import-bar aviso-entrega">
          <div className="import-info">
            <Clock size={14} />
            <span>
              Alguns grupos já têm prazo de compra, mas falta a <b>data de entrega da obra</b> —
              sem ela não dá pra dizer até quando comprar.
            </span>
          </div>
          <button className="btn-atalho" onClick={onIrParaDashboard}>Definir no Dashboard</button>
        </div>
      )}

      {/* Uma vez, aqui em cima. Ver isto antes de descer pela lista e' o
          que evita alguem esperar um numero que ainda nao existe. */}
      {temItens && (
        <div className="plano-wip">
          <Clock size={12} />
          <span>A coluna <b>Sienge</b> no cabeçalho de cada verba vai mostrar o quanto já está
            comprometido em pedidos — <b>está em desenvolvimento</b> e por isso aparece vazia.</span>
        </div>
      )}

      {temItens && !obra.comprasLiberadas && (
        <div className="plano-barra">
          <div className="plano-num">
            <div className="plano-valor mono">{fmtBRL(plano.materialNoPlano)}</div>
            <div className="plano-rotulo">material no plano · {plano.nItens} {plano.nItens === 1 ? "item" : "itens"}</div>
          </div>
          {plano.moForaDoPlano > 0 && (
            <div className="plano-num plano-num-mo">
              <div className="plano-valor mono dim">{fmtBRL(plano.moForaDoPlano)}</div>
              <div className="plano-rotulo">de mão de obra — vai pra Contratos, não pra compra</div>
            </div>
          )}
          {/* Sem isto a tela parecia que nada tinha sido comprado, mesmo
              com a compra ja marcada la em Compras de Produtos. */}
          {plano.comprado > 0 && (
            <div className="plano-num plano-num-ok">
              <div className="plano-valor mono">{fmtBRL(plano.comprado)}</div>
              <div className="plano-rotulo">já comprado · {plano.nComprados} {plano.nComprados === 1 ? "item" : "itens"}</div>
            </div>
          )}
        </div>
      )}
      {/* Duas dimensões, duas filas. A de cima é a ALOCAÇÃO do recurso —
          MAT, MO ou os dois; a de baixo é em que pé o item está. */}
      <div className="filter-bar tipo-bar">
        <Package size={13} className="dim" />
        {FILTROS_ALOC.map((t) => (
          <button key={t.id} className={`filter-chip tipo-chip ${tipoFilter === t.id ? "active" : ""}`}
            onClick={() => setTipoFilter(t.id)} title={t.destino ? `Estes ${t.destino}` : undefined}>
            {t.label}
            <span className="tipo-chip-conta">{contaPorAloc[t.id]}</span>
          </button>
        ))}
        {tipoFilter !== "todos" && (
          <span className="tipo-bar-destino">
            {FILTROS_ALOC.find((t) => t.id === tipoFilter)?.destino}
          </span>
        )}
      </div>
      <div className="filter-bar">
        <SlidersHorizontal size={13} className="dim" />
        {FILTERS.map((f) => (
          <button key={f.id} className={`filter-chip ${itemFilter === f.id ? "active" : ""}`} onClick={() => setItemFilter(f.id)}>
            {f.label}
          </button>
        ))}
        <span className="filter-sep" />
        <button className={`filter-chip ${soVendido ? "active" : ""}`}
          onClick={() => setSoVendido((v) => !v)}
          title="Esconde as linhas que entraram na proposta só pra nomear escopo — quantidade e valor zerados">
          {soVendido ? "Só o vendido" : "Vendido e não vendido"}
          {soVendido && ocultosNaoVendidos > 0 && <span className="tipo-chip-conta">{ocultosNaoVendidos} ocultos</span>}
        </button>
      </div>

      {grupos.map(({ cat, itens }) => (
        <GrupoPlano key={cat.num + cat.nome} cat={cat} itens={itens}
          expanded={expandedCats.has(cat.num + obra.id)}
          onToggle={() => toggleCat(cat.num + obra.id)}
          onSepararMO={(codigo) => onSepararMO(cat.num, codigo)}
          onJuntarMO={(codigo) => onJuntarMO(cat.num, codigo)}
          onSepararGrupo={() => onSepararGrupo(cat.num)}
          dataEntrega={obra.dataEntrega}
          aditivo={aditPorVerba.get(cat.num)}
          /* Os itens de aditivo entram DEPOIS dos da planilha, entao um
             indice alem do fim da lista real e' aditivo — e ele nao mora
             na planilha. Sem esta trava, editar a linha de um aditivo
             gravaria um item novo dentro de `categorias`, no indice
             vazio: na leitura seguinte ele apareceria duas vezes, uma
             como planilha e outra como aditivo. */
          onItemChange={(itemIdx, patch) => {
            const i = indiceRealDoItem(obraCrua, cat.num, itemIdx);
            if (i == null) return;
            updateItem(obraCrua.categorias.indexOf(obraCrua.categorias[i.cat]), i.item, patch);
          }}
          onAlocar={(it, itemIdx, v) => {
            const i = indiceRealDoItem(obraCrua, cat.num, itemIdx);
            if (i == null) return;
            onAlocar(i.cat, i.item, it, v);
          }}
        />
      ))}
      {temItens && grupos.length === 0 && (
        <div className="compras-empty">
          <SlidersHorizontal size={26} className="dim" />
          <div className="compras-empty-title">Nenhum item com esses filtros</div>
          <div className="compras-empty-sub">Nenhum item da EAP combina "{FILTROS_ALOC.find((t) => t.id === tipoFilter)?.label}" com "{FILTERS.find((f) => f.id === itemFilter)?.label}"{soVendido ? " dentro do que foi vendido" : ""}.</div>
        </div>
      )}
      {/* A legenda antiga explicava as cores da barra vendido × executivo,
          que saiu junto com a tabela velha — ficou nomeando cor que a tela
          não tem mais. Aqui a dúvida é outra: o que cada sigla quer dizer
          e pra onde o item vai depois daqui. */}
      <div className="legend">
        <div className="legend-item"><span className="legend-quadro q-falta" /> Falta comprar</div>
        <div className="legend-item"><span className="legend-quadro q-comprado" /> Já comprado</div>
        <div className="legend-item"><span className="aloc aloc-mat">MAT</span> MATERIAL — vai pra Compras</div>
        <div className="legend-item"><span className="aloc aloc-mo">MO</span> MÃO DE OBRA — vai pra Contratos</div>
        <div className="legend-item"><span className="aloc aloc-ambos">MAT+MO</span> As duas parcelas ainda na mesma linha — dá pra separar</div>
        <div className="legend-item"><span className="aloc aloc-mat aloc-manual">MAT</span> O ponto marca alocação corrigida à mão</div>
        <div className="legend-item"><span className="tag-avulso"><Plus size={9} /> avulsa</span> Pedido fora do executivo, ainda sem valor</div>
      </div>

      {!obra.comprasLiberadas && (
        <LiberacaoCompra obra={obra} temItens={temItens} podeEditar={podeEditar} onLiberar={onLiberar} />
      )}
    </>
  );
}

/* ============================================================
   ABA VENDIDO
   ============================================================ */

// quebra um CSV em linhas de células (aceita ; ou , como separador)
function parseCSVLinhas(texto) {
  const sep = (texto.match(/;/g) || []).length >= (texto.match(/,/g) || []).length ? ";" : ",";
  return texto.split(/\r?\n/).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()));
}

// dado um conjunto de linhas (array de arrays), extrai { "01": valor, ... }
// procurando, em cada linha, um código de verba (01–19) + um valor monetário.
function extrairVerbasValor(linhas) {
  const mapa = {};
  linhas.forEach((cells) => {
    if (!Array.isArray(cells)) return;
    let num = null;
    for (const c of cells) {
      const m = String(c).trim().match(/^(0?[1-9]|1[0-9])$/);
      if (m) { num = m[1].padStart(2, "0"); break; }
    }
    if (!num || num in mapa) return;
    // pega o maior valor monetário da linha (o vendido costuma ser o total)
    let valor = null;
    cells.forEach((c) => {
      const v = parseBRL(c);
      if (v != null && v > 0 && (valor == null || v > valor)) valor = v;
    });
    if (valor != null) mapa[num] = valor;
  });
  return mapa;
}

// VENDIDO CONTRATO — o PDF da proposta, como ela é hoje: valor só por
// verba (subtotal), item traz apenas descrição/ambiente/quantidade —
// nunca valor por item (o contrato é fechado por verba, não por item).
async function lerContratoPDF(file) {
  const buf = await file.arrayBuffer();
  const res = await fetch(api("/api/vendido/parse"), {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: buf,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const mapa = mapearVerbasPeloNome(data.verbas);
  const valores = {};
  (data.verbas || []).forEach((v) => { if (v.valor != null) valores[mapa[v.num] || v.num] = v.valor; });
  const itens = (data.itens || []).map((it) => ({
    num: mapa[it.verba] || it.verba, codigo: it.codigo, desc: limparQtdColada(it.desc),
    qtdVendida: it.qtd, un: it.un, ambiente: it.ambiente,
    // veio colada na descrição: a separação é palpite, marca pra conferir
    qtdColada: !!it.qtdColada,
    // o contrato não traz valor por item (é fechado por verba), então
    // aqui "não foi vendido" se resume a não ter quantidade
    ehTitulo: ehLinhaDeTitulo(it.qtd, null, null),
  }));
  return { valores, itens, diagnostico: data.diagnostico, paginas: data.paginas,
           gruposNaoReconhecidos: (data.verbas || []).filter((v) => !mapa[v.num]).map((v) => v.nome) };
}

// Traduz a numeração do documento pra numeração da EAP, usando o nome de
// cada verba. Aplicado nos dois lados de propósito: assim nenhum
// documento precisa numerar "certo" pra conferência funcionar — basta
// escrever o nome do grupo, que é o que todos escrevem igual.
function mapearVerbasPeloNome(verbas) {
  const mapa = {};
  (verbas || []).forEach((v) => {
    const eap = verbaPorNome(v.nome);
    if (eap) mapa[v.num] = eap;
  });
  return mapa;
}

// VENDIDO PLANILHA em PDF — usa o MESMO motor denso do Executivo (não
// o motor simples do Contrato): a Planilha "elaborada" tem layout
// denso (custo material/mão de obra por item, linhas de índice,
// placeholders), igual ao Composição de Custo — o parser simples do
// Contrato quebra nesse formato (número de coluna vaza pra descrição).
// Marca não dá pra extrair de PDF de forma confiável — fica só no Excel.
async function lerPlanilhaPDF(file) {
  const buf = await file.arrayBuffer();
  const res = await fetch(api("/api/executivo/parse"), {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: buf,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const mapa = mapearVerbasPeloNome(data.verbas);
  const itens = (data.itens || []).map((it) => {
    const temUnit = it.custoMaterial != null || it.custoMO != null;
    const custoUnitario = temUnit ? (it.custoMaterial || 0) + (it.custoMO || 0) : null;
    const custo = it.custoTotal != null ? it.custoTotal : null;
    return {
      num: mapa[it.verba] || it.verba, codigo: it.codigo, desc: limparQtdColada(it.desc),
      qtdVendida: it.qtd, un: it.un, ambiente: null,
      custoUnitario, custo, marca: null,
      ehTitulo: ehLinhaDeTitulo(it.qtd, custo, custoUnitario),
    };
  });
  return { itens };
}

// EXECUTIVO em PDF ("Composição de Custo") — traz Custo Material +
// Custo Mão de Obra por item. Regra de negócio: se tem custo de
// material, é PRODUTO (→ Compras/Sienge); senão é SERVIÇO (→ Contratos).
async function lerExecutivoPDF(file) {
  const buf = await file.arrayBuffer();
  const res = await fetch(api("/api/executivo/parse"), {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: buf,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const mapa = mapearVerbasPeloNome(data.verbas);
  const itens = (data.itens || []).map((it) => {
    const tipo = (it.custoMaterial || 0) > 0 ? "produto" : "servico";
    const temUnit = it.custoMaterial != null || it.custoMO != null;
    const custoUnitario = temUnit ? (it.custoMaterial || 0) + (it.custoMO || 0) : null;
    const custo = it.custoTotal != null ? it.custoTotal : null;
    const ehTitulo = ehLinhaDeTitulo(it.qtd, custo, custoUnitario);
    return {
      num: mapa[it.verba] || it.verba, codigo: it.codigo, desc: limparQtdColada(it.desc),
      tipo, ambiente: null, qtdExecutivo: it.qtd, un: it.un,
      custo,
      custoMaterial: it.custoMaterial ?? null, custoMO: it.custoMO ?? null,
      totalMaterial: it.custoMaterial != null && it.qtd ? it.custoMaterial * it.qtd : null,
      totalMO: it.custoMO != null && it.qtd ? it.custoMO * it.qtd : null,
      ehTitulo,
      // linha sem quantidade e sem valor não foi vendida — não é produto
      // pra comprar nem serviço pra contratar
      contavel: tipo === "produto" && !ehTitulo,
      sienge: tipo === "produto" && !ehTitulo ? { status: "nao_encontrado" } : undefined,
      liberado: false, comprado: false, valorComprado: null, statusContrato: null,
      // campos "simples", no formato da Planilha (Vendido/Executivo) —
      // pra exibir na Planilha Executivo e pro depara Planilha × Planilha:
      qtdVendida: it.qtd, custoUnitario,
    };
  });
  return { itens };
}

// Linha que nomeia um conjunto, não um item.
//
// Na planilha elas vêm com quantidade 0 e valor vazio, e os itens de
// verdade aparecem logo abaixo: "17.1 Quadros decorativos" (0 · —)
// seguido de 17.2, 17.3…, ou "17.10 Enxoval" (0 · —) seguido dos jogos
// de cama. Comparar esses títulos não faz sentido — não são produto,
// e puxá-los pro depara só gera divergência inventada.
//
// Precisa dos DOIS zerados: item com quantidade e sem preço ainda é
// item (preço a definir), e item com preço e sem quantidade também.
function ehLinhaDeTitulo(qtd, custo, custoUnitario) {
  const semQtd = qtd == null || qtd === 0;
  const semValor = !custo && !custoUnitario;
  return semQtd && semValor;
}

// Mantém as colunas de custo coerentes depois de uma edição na tela.
//
// As cinco colunas se explicam: total de material = material × qtd, e
// custo total = total material + total mão de obra. Sem recalcular, quem
// corrige o custo unitário veria o total antigo do lado — e acreditaria
// nele.
//
// Só recalcula o que DEPENDE do que foi mexido: se a pessoa digitou o
// total direto, o total é o que ela digitou, não o que a conta daria.
function recalcularCustos(item, patch) {
  const mexeu = (campo) => Object.prototype.hasOwnProperty.call(patch, campo);
  const it = { ...item };
  const qtd = it.qtdVendida;

  // Registra que o executivo mexeu neste item — é o que a planilha
  // marcava de amarelo na mão. Guardamos o valor ORIGINAL do que veio do
  // arquivo, pra poder mostrar de onde saiu e pra onde foi.
  it.alteradoExecutivo = true;
  it.original = it.original || {
    qtdVendida: item.qtdVendida, custoMaterial: item.custoMaterial,
    custoMO: item.custoMO, totalMaterial: item.totalMaterial,
    totalMO: item.totalMO, custo: item.custo,
  };
  // Mexeu na quantidade e não tocou no preço? É o caso que a Priscila
  // apontou: "o executivo altera e não recalcula preço".
  const mexeuEmValor = mexeu("custoMaterial") || mexeu("custoMO") || mexeu("totalMaterial") || mexeu("totalMO") || mexeu("custo");
  if (mexeu("qtdVendida") && !mexeuEmValor) it.precoNaoRevisado = true;
  if (mexeuEmValor) it.precoNaoRevisado = false;

  if (mexeu("custoMaterial") || mexeu("qtdVendida")) {
    if (it.custoMaterial != null && qtd) it.totalMaterial = it.custoMaterial * qtd;
  }
  if (mexeu("custoMO") || mexeu("qtdVendida")) {
    if (it.custoMO != null && qtd) it.totalMO = it.custoMO * qtd;
  }
  if (!mexeu("custo")) {
    if (it.totalMaterial != null || it.totalMO != null) it.custo = (it.totalMaterial || 0) + (it.totalMO || 0);
  }
  if (!mexeu("custoUnitario") && (it.custoMaterial != null || it.custoMO != null)) {
    it.custoUnitario = (it.custoMaterial || 0) + (it.custoMO || 0);
  }
  it.ehTitulo = ehLinhaDeTitulo(it.qtdVendida, it.custo, it.custoUnitario);
  return it;
}

// Tira a quantidade que vazou pro fim da descrição.
//
// Lendo do PDF, a coluna de quantidade às vezes gruda no texto:
// "Quadros decorativos 0,000", "Enxoval- 0,000". Além de feio, a
// comparação passa a ver um número onde deveria ver só a descrição.
//
// Só remove número no formato de quantidade (0,000) no fim da linha —
// medida de produto ("2,66X4,35M", "0,80x1,60m") termina com letra e
// não é tocada.
function limparQtdColada(desc) {
  return String(desc || "")
    .replace(/\s+\d{1,3},\d{3}\s*$/, "")
    .replace(/[\s\-–—:]+$/, "")
    .trim();
}

// deduz o nº da verba (01–32) a partir do código do item, ex: "6.2" -> "06"
function verbaDoCodigo(codigo) {
  const m = String(codigo || "").match(/^(\d{1,2})[.\-]/);
  return m ? m[1].padStart(2, "0") : null;
}

// Descobre a verba da EAP pelo NOME do grupo escrito no documento.
//
// Esta é a chave certa. O contrato chama de "6 CLIMATIZAÇÃO/ EXAUSTÃO" e
// a planilha de "7 CLIMATIZAÇÃO/ EXAUSTÃO" — o número briga, o nome não.
// Confiar no número fazia os itens de climatização da planilha caírem em
// "Móveis Sob Medida", e o contrato ficar sem par.
//
// Casa por palavra distintiva, não por texto exato, porque a grafia varia
// ("Pedras — Mármores e Granitos" × "MARMORARIA", acento, barra, caixa).
// Os apelidos são comparados sobre o nome COMPRIMIDO (sem acento, sem
// espaço, sem pontuação), pra aguentar as variações que aparecem de
// verdade: "ELETRO ELETRÔNICOS", "Eletroeletrônico", "ELETRO-ELETRONICO"
// viram todos "eletroeletronico".
//
// São radicais, não palavras inteiras — "climatiza" cobre climatização e
// climatizacao; "persian" cobre persiana e persianas.
const APELIDOS_CODIGO = {
  "01": ["arquitetura", "engenharia", "projetoarquitetonico"],
  "02": ["servicoscomplementar", "complementar"],
  "03": ["civil", "alvenaria", "demolicao"],
  "04": ["impermeabiliza"],
  "05": ["instalacaoeletrica", "instalacoeseletric", "eletrica", "eletric", "iluminacao", "luminotecnic"],
  "06": ["hidrosanitar", "hidraulic", "hidro"],
  "07": ["preventivodeincendio", "preventivo", "incendio", "sprinkler"],
  "08": ["comunicacaoedados", "cabeamento", "cabeacaoestruturada", "dados", "redelogica"],
  "09": ["sistemadegas", "gas", "glp"],
  "10": ["gesso", "drywall", "forro"],
  "11": ["revestimentoceramic", "ceramic", "porcelanato", "azulejo"],
  "12": ["elementosemmadeira", "madeira", "deck"],
  "13": ["pisovinilic", "vinilic", "carpete"],
  // "papeldeparede" contém "parede": por isso a Parede Verde (17) NÃO pode
  // ter "parede" solto como apelido, senão papel de parede cai lá.
  "14": ["papeldeparede", "papelparede"],
  "15": ["rodape", "boiserie"],
  "16": ["revestimentoespecial"],
  // "paisagismo" saiu daqui: PROJETO PAISAGISMO é serviço de projeto
  // (verba 01), não o jardim vertical construído.
  "17": ["paredeverde", "jardimvertical"],
  "18": ["pintura", "pintor"],
  "19": ["esquadria"],
  "20": ["climatiza", "exausta", "arcondicionado"],
  "21": ["marcenaria", "sobmedida", "moveisplanejado"],
  "22": ["serralheria", "serralher", "metalon"],
  "23": ["vidracaria", "vidro", "espelho"],
  "24": ["moveissolto", "solto"],
  "25": ["estofado", "estofaria", "tapecaria"],
  "26": ["marmoraria", "marmore", "granito", "pedra"],
  "27": ["louca", "metaissanitario", "equipamentoespecial", "metais"],
  "28": ["eletroeletronic", "eletrodomestic", "eletronic", "eletro"],
  // "adegaclimatizada" contém "climatiza" (verba 20). O apelido longo vem
  // primeiro de propósito: o desempate é por tamanho, e sem ele toda adega
  // seria classificada como climatização.
  "29": ["adegaclimatizada", "adega"],
  "30": ["cortina", "persian"],
  "31": ["decorativo", "decoracao"],
};

// comprime pra comparar: sem acento, sem espaço, sem pontuação
function comprimirNome(s) {
  return normTxt(s).replace(/\s+/g, "");
}

function verbaPorNome(nome) {
  if (!nome) return null;
  const comprimido = comprimirNome(nome);
  if (!comprimido) return null;

  // 1) apelido conhecido — o mais longo ganha, porque é o mais
  //    específico ("eletroeletronic" antes de "eletro", "sobmedida"
  //    antes de "medida"). Sem isso um nome casaria com duas verbas.
  let achado = null;
  let melhor = 0;
  Object.entries(apelidosVerba()).forEach(([num, apelidos]) => {
    apelidos.forEach((ap) => {
      if (ap.length > melhor && comprimido.includes(ap)) { achado = num; melhor = ap.length; }
    });
  });
  if (achado) return achado;

  // 2) rede de segurança: compara o nome do grupo com o nome da verba na
  //    EAP pelo mesmo motor do depara. Cobre grafia que eu não previ,
  //    sem precisar cadastrar apelido novo a cada planilha diferente.
  let melhorSim = 0;
  eapPadrao().forEach((c) => {
    const s = similaridade(nome, c.nome);
    if (s > melhorSim) { melhorSim = s; achado = c.num; }
  });
  return melhorSim >= 0.5 ? achado : null;
}

// Acha o índice da coluna cujo cabeçalho casa com algum dos padrões.
//
// `ignorar` pula colunas já atribuídas a outro campo e CONTINUA
// procurando — não desiste na primeira. Isso importa no Executivo, onde
// "Custo Total Material" aparece antes de "Custo Total": sem seguir
// adiante, o custo total do item nunca seria encontrado.
//
// O cabeçalho vem com quebra de linha e espaço sobrando ("Custo Total\n
// Material", " Custo Total "), então normalizamos antes de comparar.
function acharColuna(headerRow, padroes, ignorar) {
  for (let i = 0; i < headerRow.length; i++) {
    if (ignorar && ignorar.has(i)) continue;
    const h = String(headerRow[i] || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (padroes.some((p) => p.test(h))) return i;
  }
  return -1;
}

// Lê o arquivo de texto respeitando o acento.
//
// CSV exportado do Excel no Windows costuma vir em Windows-1252, não em
// UTF-8. Lendo como UTF-8, "Brasília" vira "Bras�lia" e o símbolo de
// diâmetro (Ø) some — descrição corrompida além de feia, atrapalha a
// comparação, porque as palavras deixam de casar entre os documentos.
//
// Tenta UTF-8 primeiro (o formato correto); se aparecer o caractere de
// substituição, refaz em Windows-1252.
async function lerTextoComAcento(file) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("windows-1252").decode(buf);
  } catch {
    return utf8;
  }
}

// VENDIDO PLANILHA — documento mais elaborado (Excel), com colunas
// nomeadas: código/verba, descrição, marca, custo, quantidade, ambiente.
// Lê por CABEÇALHO (não por posição fixa), pra aguentar variação de layout.
async function lerPlanilhaExcel(file, opts) {
  const { preferirAba, evitarAba } = opts || {};
  let abas;
  // .xlsm é Excel com macro — é o formato do "Composição de Custo" da
  // casa. Sem ele na lista, o arquivo caía no caminho de texto simples e
  // nada era lido. .xlsb entra junto pelo mesmo motivo.
  if (/\.(xlsx|xlsm|xlsb|xls)$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    abas = wb.SheetNames.map((nome) => ({
      nome, linhas: XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, blankrows: false }),
    }));
  } else {
    abas = [{ nome: null, linhas: parseCSVLinhas(await lerTextoComAcento(file)) }];
  }

  /* Um .xlsm de "Composição de Custo" de verdade tem VÁRIAS abas — capa
     de aprovação, planilha orçamentária, contrato (que aqui não conta:
     Contrato é PDF, não Excel), executivo, controle de compras... Ler só
     a primeira aba (era o que este código fazia) quebra sempre que ela
     não é a de dados: "Aprovação CEO" na frente de "Planilha
     Orçamentária" fez a importação inteira dizer "não encontrei
     colunas" com a aba certa bem ao lado.

     A prova real de que uma aba é a certa não é o cabeçalho bater, é
     sair item de verdade — então roda o extrator em CADA aba e fica só
     com as que produziram algo. Quando mais de uma aba do mesmo arquivo
     produz itens (ex.: Orçamentária E Executivo no mesmo .xlsm),
     `preferirAba`/`evitarAba` desempatam pelo nome — sem isso, importar
     Vendido Planilha corre o risco de trazer a aba do Executivo. */
  const candidatas = abas
    .map(({ nome, linhas }) => ({ nome, ...extrairItensDaPlanilha(linhas) }))
    .filter((c) => c.itens.length > 0);
  if (candidatas.length === 0) return { itens: [] };
  if (candidatas.length > 1) {
    const bate = (nome, padrao) => !!(padrao && nome && padrao.test(nome));
    const preferidas = preferirAba ? candidatas.filter((c) => bate(c.nome, preferirAba)) : [];
    if (preferidas.length) return preferidas[0];
    const semEvitar = evitarAba ? candidatas.filter((c) => !bate(c.nome, evitarAba)) : candidatas;
    return semEvitar[0] || candidatas[0];
  }
  return candidatas[0];
}

// A extração de verdade, isolada por aba — lerPlanilhaExcel roda isto
// em cada aba do arquivo e escolhe qual resultado usar.
function extrairItensDaPlanilha(linhas) {
  // acha a linha de cabeçalho: a primeira que tem "descri" e (marca ou custo/valor)
  let headerIdx = -1;
  for (let i = 0; i < linhas.length; i++) {
    const row = linhas[i].map((c) => String(c || "").toLowerCase());
    const temDesc = row.some((h) => /descri/.test(h));
    const temMarcaOuCusto = row.some((h) => /marca|custo|valor/.test(h));
    if (temDesc && temMarcaOuCusto) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return { itens: [] };

  /* Cabeçalho de DUAS linhas.

     No criativo da 2405 os títulos são quebrados em duas alturas:

       linha 0   ... Qtd. | un | Custo    | Custo       | Custo Total | Custo Total | Custo
       linha 1                   Material | Mão de Obra | Material    | Mão de Obra | Total

     Lendo só a primeira, cinco colunas viram "Custo"/"Custo Total" e ficam
     indistinguíveis — foi o que fez o app dizer "faltam Custo Material e
     Mão de Obra" num arquivo Excel que tinha as duas.

     Junta a linha seguinte quando ela é continuação: sem código de item na
     primeira coluna, rótulos curtos e nenhum valor. Linha de dado não
     satisfaz as três condições ao mesmo tempo. */
  const ehContinuacaoDeCabecalho = (row) => {
    if (!row) return false;
    const cels = row.map((c) => String(c ?? "").trim());
    if (/^\d/.test(cels[0] || "")) return false;
    const preenchidas = cels.filter((c) => c !== "" && c !== "0");
    if (preenchidas.length === 0) return false;
    return preenchidas.every((c) => c.length <= 22 && !/^[\d.,\s]+$/.test(c) && !/^R\$/.test(c));
  };

  let header = linhas[headerIdx];
  if (ehContinuacaoDeCabecalho(linhas[headerIdx + 1])) {
    const seg = linhas[headerIdx + 1];
    const largura = Math.max(header.length, seg.length);
    const juntos = [];
    for (let j = 0; j < largura; j++) {
      const a = String(header[j] ?? "").trim();
      const b = String(seg[j] ?? "").trim();
      juntos[j] = [a, b].filter((x) => x && x !== "0").join(" ");
    }
    header = juntos;
    headerIdx += 1;  // a continuação não é dado; os itens começam depois dela
  }
  // O criativo e o executivo usam o MESMO cabeçalho — Item, Descrição,
  // Código/especificação/Obs., Fornecedor, Ambiente, Qtd., un, e as cinco
  // colunas de custo. Ler tudo aqui mantém as duas telas com a mesma
  // informação, que é o que permite compará-las de verdade.
  //
  // A ordem de reserva importa: "Item" e "Código / especificação" as duas
  // casariam com padrão de código, então o número do item é reservado
  // primeiro e a especificação pega o que sobrou.
  const usadasIdent = new Set();
  const reservarIdent = (p) => { const i = acharColuna(header, p, usadasIdent); if (i >= 0) usadasIdent.add(i); return i; };
  const iCod = reservarIdent([/^item$/, /^c[oó]d\.?$/, /^c[oó]digo$/]);
  const iDesc = reservarIdent([/^descri/]);
  const iEspec = reservarIdent([/especifica/, /^c[oó]d/, /obs/]);
  const iMarca = reservarIdent([/fornecedor/, /marca/]);
  const iAmb = reservarIdent([/ambiente/, /local/]);
  // "quant" solto casa com QUALQUER coluna que contenha a palavra, e
  // "Memorial de Levantamento Quantitativo" é texto descritivo, não
  // número — vinha antes de "Qtd." na planilha real da 2517 e roubava a
  // coluna, então toda quantidade saía errada silenciosamente. "qtd"
  // primeiro, sozinho: é abreviação rara demais pra aparecer por acaso
  // em outra coisa. "quant" só entra se "qtd" não achar nada.
  const iQtdEstrito = reservarIdent([/qtd/]);
  const iQtd = iQtdEstrito >= 0 ? iQtdEstrito : reservarIdent([/quant/]);
  const iUn = reservarIdent([/^un\b/, /^un\.?$/, /unidade/]);
  const iVerba = reservarIdent([/verba/, /grupo/, /eap/]);
  // --- Colunas de custo ---
  //
  // O Executivo separa material de mão de obra, e unitário de total:
  //   Custo Material | Custo Mão de Obra | Custo Total Material |
  //   Custo Total Mão de Obra | Custo Total
  //
  // A ordem de busca importa: "Custo Total Material" contém "custo
  // total", então as específicas têm que ser achadas ANTES das genéricas,
  // senão o total do material seria lido como custo total do item.
  const usadas = new Set(usadasIdent);
  const reservar = (padroes) => {
    const i = acharColuna(header, padroes, usadas);
    if (i >= 0) usadas.add(i);
    return i;
  };
  const iTotalMaterial = reservar([/custo total mat/]);
  const iTotalMO = reservar([/custo total m[aã]o/]);
  const iMaterial = reservar([/custo mat/, /^material$/]);
  const iMO = reservar([/custo m[aã]o/, /^m[aã]o de obra$/]);
  // "Venda" entra aqui, não em custo genérico: numa Composição de Custo
  // real a aba tem uma coluna "CUSTOS" (o gasto da empresa) SEPARADA da
  // "VENDA" (o que o cliente paga) — sem "venda" aqui, "CUSTOS" casava
  // primeiro por conter a palavra "custo", e a Vendido Planilha herdava
  // o custo interno da empresa em vez do valor vendido ao cliente.
  const iCustoTotal = reservar([/custo total/, /^total$/, /^custo$/, /^valor$/, /venda/]);

  // Vendido Planilha usa outro vocabulário (unitário/preço) — segue valendo.
  const iCustoUnit = reservar([/unit[aá]rio/, /vlr\.? unit/, /pre[çc]o unit/, /^pre[çc]o$/]);
  const iCustoGenerico = reservar([/custo/, /valor/, /preç/]);

  const itens = [];
  // Nome do último grupo que passou — a planilha marca os grupos numa
  // linha própria ("7 | CLIMATIZAÇÃO/ EXAUSTÃO"), e os itens vêm abaixo
  // ("7.1", "7.2"). O NOME é o que casa entre os documentos; o número
  // não, porque a planilha numera diferente do contrato.
  let grupoAtual = null;
  for (let i = headerIdx + 1; i < linhas.length; i++) {
    const row = linhas[i];
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const codigo = iCod >= 0 ? String(row[iCod] ?? "").trim() : null;
    const desc = iDesc >= 0 ? String(row[iDesc] ?? "").trim() : "";
    if (!desc) continue;

    // Linha de grupo: código inteiro, sem ponto ("7", não "7.1").
    if (codigo && /^\d{1,2}$/.test(codigo)) { grupoAtual = desc; continue; }
    // Ordem de confiança pra decidir a verba:
    //   1) o NOME do grupo, casado com a EAP — é o único dado que os dois
    //      documentos escrevem igual ("CLIMATIZAÇÃO/ EXAUSTÃO" nos dois)
    //   2) a coluna de verba, se a planilha tiver uma
    //   3) o prefixo do código — último recurso, porque a numeração da
    //      planilha não acompanha a EAP (climatização vem como 7, não 6)
    // O NÚMERO cru do arquivo só serve quando o nome não resolve E o
    // grupo do arquivo tem o mesmo nome do grupo padrão de mesmo número.
    // Fora disso ele mente: a planilha numera climatização como 7, e 7 no
    // padrão da empresa é Preventivo de Incêndio.
    const porNome = verbaPorNome(grupoAtual);
    const num = porNome
      || (iVerba >= 0 ? String(row[iVerba] ?? "").trim().padStart(2, "0") : null)
      || verbaDoCodigo(codigo);

    // Grupo que não casa com o padrão NÃO é descartado. Antes havia um
    // `continue` aqui: o item sumia da importação sem contagem nem aviso,
    // e o total da planilha vinha menor que o do arquivo sem ninguém
    // perceber. Agora ele viaja marcado e é agrupado no fim da lista, que
    // é o que a regra da empresa pede.
    const foraDoPadrao = !porNome;
    if (!num && !grupoAtual) continue;
    const qtdVal = iQtd >= 0 ? parseBRL(row[iQtd]) : null;
    const col = (i) => (i >= 0 ? parseBRL(row[i]) : null);
    // célula de texto: o Excel guarda 0 onde o campo está vazio, e "0"
    // na tela é pior que vazio — parece dado
    const texto = (v) => {
      if (v == null || v === 0) return null;
      const t = String(v).replace(/\s+/g, " ").trim();
      return t && t !== "0" ? t : null;
    };

    // Custos do Executivo, quando a planilha os traz separados
    const custoMaterial = col(iMaterial);
    const custoMO = col(iMO);
    let totalMaterial = col(iTotalMaterial);
    let totalMO = col(iTotalMO);
    // total = unitário × qtd, quando a planilha só traz um dos dois
    if (totalMaterial == null && custoMaterial != null && qtdVal) totalMaterial = custoMaterial * qtdVal;
    if (totalMO == null && custoMO != null && qtdVal) totalMO = custoMO * qtdVal;

    let custoUnitario = iCustoUnit >= 0 ? parseBRL(row[iCustoUnit]) : null;
    let custo = iCustoTotal >= 0 ? parseBRL(row[iCustoTotal]) : (iCustoUnit < 0 && iCustoGenerico >= 0 ? parseBRL(row[iCustoGenerico]) : null);

    // Sem coluna de custo total, ele é a soma de material + mão de obra —
    // é assim que o Executivo fecha o valor do item.
    if (custo == null && (totalMaterial != null || totalMO != null)) custo = (totalMaterial || 0) + (totalMO || 0);
    if (custoUnitario == null && (custoMaterial != null || custoMO != null)) custoUnitario = (custoMaterial || 0) + (custoMO || 0);
    if (custoUnitario == null && custo != null && qtdVal) custoUnitario = custo / qtdVal;
    if (custo == null && custoUnitario != null && qtdVal) custo = custoUnitario * qtdVal;

    itens.push({
      num, codigo: codigo || null, desc, ehTitulo: ehLinhaDeTitulo(qtdVal, custo, custoUnitario),
      // Marca de origem pra quem não casou com o padrão: é por ela que o
      // item é agrupado no fim da lista, com o nome do grupo como veio no
      // arquivo, em vez de sumir.
      ...(foraDoPadrao ? { foraDoPadrao: true, grupoOriginal: grupoAtual } : {}),
      custoMaterial, custoMO, totalMaterial, totalMO,
      // "tem custo de material" é o que separa produto de serviço
      tipo: custoMaterial != null || totalMaterial != null
        ? ((custoMaterial || totalMaterial || 0) > 0 ? "produto" : "servico")
        : undefined,
      ambiente: texto(row[iAmb]),
      marca: texto(row[iMarca]),
      especificacao: texto(row[iEspec]),
      qtdVendida: qtdVal,
      un: iUn >= 0 ? String(row[iUn] ?? "").trim() || null : null,
      custoUnitario, custo,
    });
  }
  return { itens };
}

// Um botão de importar reutilizável (Contrato PDF / Planilha Excel),
// cada um com seu próprio arquivo aceito e sua própria mensagem.
function ImportButton({ label, accept, dica, onFile, congelado, onLimpar, temConteudo, oQueLimpa, onReabrir, compraLiberada }) {
  const inputRef = useRef(null);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function aoEscolher(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // permite subir o MESMO arquivo de novo
    if (!file) return;
    setErro(null); setOk(null); setCarregando(true);
    try {
      const msg = await onFile(file);
      setOk(msg);
    } catch (err) {
      setErro("Não consegui ler o arquivo: " + err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="import-card">
      <div className="import-bar">
        <div className="import-info">
          {congelado ? <Lock size={14} /> : <Upload size={14} />}
          {/* Dizer "está congelada" sem dizer como sair é beco sem saída:
              o botão de reabrir mora em OUTRA aba, e quem chega aqui pra
              trocar um arquivo errado não tem como adivinhar isso. */}
          <span>{congelado
            ? (compraLiberada
                ? <>Plano de Compras já liberado — esta etapa está congelada. Para <b>substituir ou remover</b> este documento, reabra as etapas.</>
                : "Modo leitura — habilite a edição desta obra para importar ou remover.")
            : dica}</span>
        </div>
        <button className="btn-import" onClick={() => inputRef.current && inputRef.current.click()} disabled={carregando || congelado}>
          <Upload size={13} /> {carregando ? "Lendo…" : label}
        </button>
        <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={aoEscolher} />
        {/* Subir o arquivo errado tem que ter volta. Sem isto, o unico
            jeito de desfazer era subir outro por cima — e se o certo
            ainda nao existisse, a obra ficava com dado errado. */}
        {congelado && compraLiberada && onReabrir && (
          <button className="btn-reabrir-etapa" onClick={() => {
            if (window.confirm(
              "Reabrir as etapas anteriores?\n\n" +
              "Vendido, Depara e Executivo voltam a aceitar alteração. " +
              "Use quando algo precisar ser corrigido depois da liberação.\n\n" +
              "Compras e contratações já feitas não são desfeitas."
            )) onReabrir();
          }}>
            <RotateCcw size={12} /> Reabrir etapas
          </button>
        )}
        {onLimpar && temConteudo && !congelado && (
          <button className="btn-limpar-import" disabled={carregando} onClick={() => {
            if (window.confirm(
              `Remover ${oQueLimpa || "os dados importados"}?\n\n` +
              "Some tudo que veio deste documento nesta obra. As outras etapas não são tocadas.\n\n" +
              "Não dá pra desfazer — depois é só subir o arquivo de novo."
            )) { setOk(null); setErro(null); onLimpar(); }
          }}>
            <Trash2 size={13} /> Remover
          </button>
        )}
      </div>
      {ok && <div className="import-ok"><CheckCircle2 size={14} /> {ok}</div>}
      {erro && <div className="import-erro"><AlertTriangle size={14} /> {erro}</div>}
    </div>
  );
}

// hook pequeno pra controlar quais verbas estão expandidas numa tabela
function useAbertos() {
  const [abertos, setAbertos] = useState(() => new Set());
  const toggle = (num) => setAbertos((p) => { const n = new Set(p); n.has(num) ? n.delete(num) : n.add(num); return n; });
  return [abertos, toggle];
}

/* Vendido x nao vendido, nos dois niveis em que isso existe.

   GRUPO nao vendido: a EAP padrao tem 32 grupos e toda obra mostra os 32.
   Obra nenhuma vende tudo — a que nao tem nada em Sistema de Gas nao
   "esqueceu" o grupo, ela simplesmente nao vendeu aquilo. Ver quais
   ficaram vazios e informacao, nao falha.

   ITEM nao vendido: linha que existe no documento com quantidade E valor
   zerados. E o caso dos quadros decorativos e do enxoval — entram na
   proposta pra nomear o escopo, mas nao foram vendidos. */
const itemFoiVendido = (it) => {
  const qtd = it.qtdVendida ?? it.qtd;
  return !ehLinhaDeTitulo(qtd, it.custo, it.custoUnitario);
};
// Grupo com qualquer item veio no documento — foi vendido. Antes exigia
// que ALGUM item tivesse quantidade, e o contrato traz verba fechada
// ("1,00 vb") ou nem isso: Arquitetura e Engenharia, cheia de itens,
// aparecia como não vendida.
const grupoFoiVendido = (itens) => (itens || []).length > 0;

const FILTROS_VENDA = [
  { id: "todos", label: "Todos os grupos" },
  { id: "vendido", label: "Só o vendido" },
  { id: "nao_vendido", label: "Só o não vendido" },
];

/* Distribui os itens importados pelas verbas, e leva pro FIM da lista o
   que não pertence a nenhum grupo do padrão.

   Antes cada importador fazia `porVerba[c.num]` direto. Item cujo grupo
   não casava com a EAP tinha sido descartado ainda na leitura do arquivo,
   então nunca chegava aqui — o total da planilha vinha menor que o do
   arquivo, calado. A regra da empresa é o contrário: o que não está no
   padrão é acrescido no final. */
function aplicarItensNasVerbas(categorias, itens, campo) {
  const padrao = {};
  const fora = new Map();
  (itens || []).forEach((it) => {
    if (it.foraDoPadrao) {
      const chave = it.grupoOriginal || "Grupo não identificado";
      if (!fora.has(chave)) fora.set(chave, []);
      fora.get(chave).push(it);
    } else if (it.num) {
      (padrao[it.num] = padrao[it.num] || []).push(it);
    }
  });

  const base = categorias
    .filter((c) => !c.foraDaEapPadrao)
    .map((c) => (padrao[c.num] ? { ...c, [campo]: padrao[c.num] } : c));

  // grupos fora do padrão que já existiam de outra importação continuam
  const jaFora = categorias.filter((c) => c.foraDaEapPadrao);
  const extras = [];
  fora.forEach((lista, nome) => {
    const existente = jaFora.find((c) => c.nome === nome);
    extras.push(existente
      ? { ...existente, [campo]: lista }
      : { num: "—", nome, vendido: 0, executivo: 0, foraDaEapPadrao: true, foraDeEscopoCategoria: true, [campo]: lista });
  });
  // Um grupo cru que ficou "fora" numa importação antiga (ex.: a EAP
  // ainda não tinha "Sonorização") não pode sobreviver pra sempre: se o
  // nome já casa com um padrão novo, os itens dele já foram pra `base`
  // com o nome certo, e mantê-lo aqui duplicaria o valor no CMV — foi
  // o que aconteceu com "AUTOMAÇÃO - CONTROL 4" somando junto de "33
  // Automação". Só carrega adiante o que continua genuinamente fora.
  jaFora.forEach((c) => {
    if (fora.has(c.nome)) return;
    if (verbaPorNome(c.nome)) return;
    extras.push(c);
  });

  return [...base, ...extras];
}

/* Encaixa as categorias salvas no padrao ATUAL da EAP.

   Obra salva guarda as proprias categorias. Quando a EAP da empresa foi
   para 32 grupos, as obras antigas continuaram exibindo os 19 antigos com
   a numeracao velha — o padrao novo so valia para importacao nova, e a
   mesma obra mostrava "03 Instalacoes Eletricas" onde o padrao diz "03
   Civil".

   O encaixe e por NOME, nao por numero: e o nome que sobrevive as duas
   numeracoes (mesma razao do depara). Casar por numero moveria o conteudo
   de eletrica para Civil sem nada na tela denunciar.

   Grupo salvo que nao casa com nenhum padrao NAO e descartado: vai para o
   fim da lista, marcado, do jeito que a regra da empresa pede. Grupo do
   padrao sem nada na obra aparece vazio — e o "nao vendido" do filtro. */
function normalizarCategorias(salvas) {
  const lista = Array.isArray(salvas) ? salvas : [];
  if (!lista.length) return lista;

  const juntar = (a, b) => {
    const arr = (k) => [...(a[k] || []), ...(b[k] || [])];
    return {
      ...a,
      vendido: (a.vendido || 0) + (b.vendido || 0),
      executivo: (a.executivo || 0) + (b.executivo || 0),
      itens: arr("itens"), itensContrato: arr("itensContrato"),
      itensPlanilha: arr("itensPlanilha"), itensPlanilhaExecutivo: arr("itensPlanilhaExecutivo"),
    };
  };

  const porNum = new Map();
  const fora = [];
  lista.forEach((c) => {
    // Só o nome decide. Sem nome reconhecido, o grupo vai pro fim — nunca
    // se assume que o número salvo significa a mesma coisa hoje.
    //
    // Tenta casar SEMPRE, mesmo quando a categoria já veio marcada
    // `foraDaEapPadrao` — a EAP pode ter ganhado um grupo novo depois que
    // essa obra foi salva (foi o caso de Sonorização/Automação: a obra
    // guardava "AUTOMAÇÃO - CONTROL 4" fora do padrão, e mesmo depois da
    // EAP aprender o nome, esta função continuava tratando como fora pra
    // sempre — a categoria antiga nunca se aposentava, e um import novo
    // que já casava certo duplicava o valor no CMV). Confiar só na flag
    // salva trava a classificação no dia em que a obra foi salva.
    const canon = verbaPorNome(c.nome);
    if (!canon) { fora.push(c); return; }
    const ja = porNum.get(canon);
    porNum.set(canon, ja ? juntar(ja, c) : c);
  });

  const base = eapPadrao().map((e) => {
    const c = porNum.get(e.num);
    if (!c) return { ...e, vendido: 0, executivo: 0 };
    // guarda de onde veio, pra dar pra auditar a migração depois
    return { ...c, num: e.num, nome: e.nome, ...(c.num !== e.num ? { numAntigo: c.num } : {}) };
  });

  return [...base, ...fora.map((c) => ({ ...c, foraDaEapPadrao: true, foraDeEscopoCategoria: true }))];
}

/* Recalcula o que e DERIVADO das categorias.

   `valorVendido` e `semDetalhe` nascem do cadastro do Monday: o primeiro
   do campo cmvOrcado (quase sempre vazio), o segundo sempre true. Os dois
   so eram corrigidos no momento da importacao — ao reabrir a obra salva,
   voltavam ao estado do Monday e o cabecalho mostrava R$ 0,00 e "so
   cadastro do Monday" numa obra com planilha, executivo e compras. */
function derivadosDasCategorias(categorias, obra) {
  const cats = (categorias || []).length ? categorias : (obra?.categorias || []);
  const valorVendido = cats.reduce((a, c) => a + (c.vendido || 0), 0);
  const temConteudo = cats.some((c) =>
    (c.vendido || 0) > 0 || (c.executivo || 0) > 0 ||
    (c.itens || []).length || (c.itensContrato || []).length ||
    (c.itensPlanilha || []).length || (c.itensPlanilhaExecutivo || []).length);
  return {
    // sem contrato importado o total fica 0; nesse caso preserva o do Monday
    valorVendido: valorVendido > 0 ? valorVendido : (obra?.valorVendido || 0),
    semDetalhe: !temConteudo,
  };
}

/* ---- VENDIDO CONTRATO — menu próprio ----
   O PDF da proposta, como ele é hoje: valor por verba (fechado), item
   só com descrição/ambiente/quantidade (nunca valor por item). Fica
   separado da Planilha de propósito — depois os dois vão ser
   conferidos um contra o outro. */
function VendidoContratoView({ obra, onImportContrato, onLimpar, onReabrir, onEditarItem, podeEditar }) {
  const congelado = obra.comprasLiberadas || !podeEditar;
  const [abertos, toggle] = useAbertos();
  const [filtroVenda, setFiltroVenda] = useState("todos");
  const [verTexto, setVerTexto] = useState(null);
  const todasVerbas = obra.categorias.filter((c) => !c.foraDaEapPadrao);

  // A estrutura da EAP nao muda com o filtro — o que muda e quais grupos
  // dela aparecem. Grupo continua sendo grupo, item continua dentro dele.
  const vendidas = todasVerbas.filter((c) => grupoFoiVendido(c.itensContrato));
  const verbas = filtroVenda === "vendido" ? vendidas
    : filtroVenda === "nao_vendido" ? todasVerbas.filter((c) => !grupoFoiVendido(c.itensContrato))
    : todasVerbas;
  const contaVenda = {
    todos: todasVerbas.length,
    vendido: vendidas.length,
    nao_vendido: todasVerbas.length - vendidas.length,
  };

  async function aoImportar(file) {
    const { valores, itens, diagnostico, paginas, gruposNaoReconhecidos } = await lerContratoPDF(file);
    const n = Object.keys(valores).length;
    /* Contrato SEM valor por verba é normal, não é falha.

       A própria dica desta tela diz que o contrato traz só descrição e
       quantidade. Ainda assim o leitor abortava a importação inteira
       quando nenhuma verba tinha R$ — e o contrato da 2506, que não tem
       um único cifrão no documento, era recusado com 17 verbas e 187
       itens perfeitamente lidos. O erro só faz sentido quando não veio
       NADA. */
    if (n === 0 && itens.length === 0) {
      throw new Error("Não encontrei verbas nem itens neste PDF. Me manda o arquivo que eu ajusto o leitor.");
    }
    onImportContrato(valores, itens);

    // Presta contas da leitura. O que o leitor NÃO conseguiu ler precisa
    // aparecer aqui, não semanas depois na conferência: um item perdido no
    // meio do PDF não deixa rastro nenhum sozinho.
    const d = diagnostico || {};
    const alertas = [];
    if ((d.semQtd || []).length) alertas.push(`${d.semQtd.length} sem quantidade (${d.semQtd.slice(0, 6).join(", ")}${d.semQtd.length > 6 ? "…" : ""})`);
    // Quantidade que veio colada na descrição: foi lida, mas a separação é
    // um palpite. Precisa aparecer com os códigos pra serem conferidos.
    if ((d.qtdDuvidosa || []).length) alertas.push(`${d.qtdDuvidosa.length} com quantidade colada na descrição, confira (${d.qtdDuvidosa.slice(0, 8).join(", ")}${d.qtdDuvidosa.length > 8 ? "…" : ""})`);
    if ((d.semDescricao || []).length) alertas.push(`${d.semDescricao.length} sem descrição legível`);
    if ((d.itensForaDeVerba || []).length) alertas.push(`${d.itensForaDeVerba.length} fora de qualquer grupo`);
    // Quantidade que o leitor se recusou a adivinhar: a descrição veio
    // colada no número no PDF, e chutar onde separa já produziu "164
    // unidades" onde eram 4. Estes itens precisam de conferência à mão.
    if ((d.qtdDuvidosa || []).length) alertas.push(`${d.qtdDuvidosa.length} com quantidade ilegível — preencher à mão (${d.qtdDuvidosa.slice(0, 6).join(", ")}${d.qtdDuvidosa.length > 6 ? "…" : ""})`);
    if ((d.suspeitas || []).length) alertas.push(`${d.suspeitas.length} suspeito${d.suspeitas.length > 1 ? "s" : ""} na releitura: ${d.suspeitas.slice(0, 3).map((x) => `${x.codigo} (${x.motivo})`).join("; ")}`);
    if ((gruposNaoReconhecidos || []).length) alertas.push(`grupo fora do padrão: ${gruposNaoReconhecidos.join(", ")}`);

    const verbasTxt = n === 0
      ? "sem valor por verba (contrato fechado)"
      : `${n} verba${n > 1 ? "s" : ""} com valor`;
    const base = `“${file.name}” — ${paginas || "?"} páginas lidas · ${verbasTxt} · ${itens.length} itens.`;

    /* A quantidade colada é o alerta que mais importa, porque é o único que
       produz um número ERRADO em vez de vazio — e número errado ninguém
       revisa, ele parece legítimo. Vem primeiro e nomeado. */
    if ((d.qtdDuvidosa || []).length) {
      const cods = d.qtdDuvidosa;
      return `${base}\n\n⚠️ ${cods.length} ${cods.length === 1 ? "item veio" : "itens vieram"} com a quantidade colada na descrição no PDF — a separação é um palpite e pode estar errada. CONFIRA a quantidade destes: ${cods.join(", ")}. Dá pra corrigir clicando na célula.` +
        (alertas.length > 1 ? `\n\nOutros pontos: ${alertas.filter((x) => !x.includes("colada")).join(" · ")}.` : "");
    }
    return alertas.length
      ? `${base} ATENÇÃO: ${alertas.join(" · ")}. Confira estes antes de seguir.`
      : `${base} Todos os itens vieram com grupo e quantidade.`;
  }

  return (
    <>
      <DetalheTexto item={verTexto} onFechar={() => setVerTexto(null)} />

      <ImportButton congelado={congelado} label="Importar Contrato (PDF)" accept=".pdf"
        onLimpar={onLimpar} oQueLimpa="os itens e valores do Contrato"
        onReabrir={onReabrir} compraLiberada={obra.comprasLiberadas}
        temConteudo={obra.categorias.some((c) => (c.itensContrato || []).length)}
        dica={<>Suba o <b>Vendido Contrato</b> — o PDF da proposta, exatamente como ele é hoje. Traz só <b>descrição e quantidade</b> (o contrato é fechado por verba, sem valor por item).</>}
        onFile={aoImportar} />

      <div className="flat-panel">
        <div className="flat-panel-header">
          <div>
            <div className="flat-panel-title">Verbas conforme contrato / proposta {obra.codigo}/00</div>
            <div className="flat-panel-sub">Descrição e quantidade por item, dentro de cada grupo — sem valores. Clique na verba pra expandir.</div>
          </div>
          <button className="btn-download" onClick={() => exportVendidoCSV(obra)}><Download size={13} /> Baixar tabela (.csv)</button>
        </div>

        {/* O filtro esconde grupos, nunca reorganiza: a ordem da EAP é a
            mesma nos três estados. */}
        <div className="filter-bar venda-bar">
          <ClipboardList size={13} className="dim" />
          {FILTROS_VENDA.map((f) => (
            <button key={f.id} className={`filter-chip tipo-chip ${filtroVenda === f.id ? "active" : ""}`}
              onClick={() => setFiltroVenda(f.id)}>
              {f.label}
              <span className="tipo-chip-conta">{contaVenda[f.id]}</span>
            </button>
          ))}
        </div>

        <div className="vend-list">
          {verbas.map((c) => {
            const itens = c.itensContrato || [];
            const temItens = itens.length > 0;
            const aberto = abertos.has(c.num);
            return (
              <div key={c.num} className="vend-grupo">
                <button className="vend-head" onClick={() => temItens && toggle(c.num)} style={{ cursor: temItens ? "pointer" : "default" }}>
                  {temItens ? (aberto ? <ChevronDown size={14} className="dim" /> : <ChevronRight size={14} className="dim" />) : <span style={{ width: 14, display: "inline-block", flexShrink: 0 }} />}
                  <span className="vend-num mono">{c.num}</span>
                  <span className="vend-nome">{c.nome}</span>
                  {temItens && <span className="vend-count">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>}
                  {/* Grupo da EAP em que esta obra não vendeu nada. Não é
                      falha nem dado faltando — é o escopo da obra. */}
                  {!grupoFoiVendido(itens) && <span className="vend-nao-vendido">não vendido</span>}
                  {temItens && grupoFoiVendido(itens) && itens.filter((it) => !itemFoiVendido(it)).length > 0 && (
                    <span className="vend-nao-vendido leve">
                      {itens.filter((it) => !itemFoiVendido(it)).length} sem venda
                    </span>
                  )}
                </button>
                {aberto && temItens && (
                  <table className="vend-itens">
                    <thead>
                      <tr>
                        <th style={{ width: 62 }}>Cód.</th>
                        <th>Descrição</th>
                        <th style={{ width: 150 }}>Ambiente</th>
                        <th style={{ width: 104 }} className="center">Qtd. vendida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, i) => (
                        <tr key={it.codigo || i}>
                          <td className="mono dim">{it.codigo || "—"}</td>
                          {/* Editáveis: o leitor de PDF acerta a maioria, nunca
                              todas. Sem poder corrigir na tela, cada linha
                              torta virava uma rodada minha de conserto — e a
                              obra ficava parada esperando deploy. */}
                          <td className="col-desc"><CelulaTexto texto={it.desc} linhas={2}
                            onVerTudo={(t) => setVerTexto({ rotulo: "Descrição", texto: t })}
                            onEditar={onEditarItem ? (v) => onEditarItem(c.num, it.codigo, { desc: v }) : undefined}
                            congelado={congelado} /></td>
                          <td className="mono center dim col-amb"><CelulaTexto texto={it.ambiente} linhas={1}
                            onVerTudo={(t) => setVerTexto({ rotulo: "Ambiente", texto: t })}
                            onEditar={onEditarItem ? (v) => onEditarItem(c.num, it.codigo, { ambiente: v }) : undefined}
                            congelado={congelado} /></td>
                          {/* Quantidade que veio colada na descrição: foi lida
                              por palpite. Marcada na própria linha, porque o
                              aviso da importação some quando a pessoa sai da
                              tela — e o número errado fica. */}
                          <td className={`mono center col-qtd ${it.qtdColada && !it.editadoNaMao ? "qtd-palpite" : ""}`}
                            title={it.qtdColada && !it.editadoNaMao ? "No PDF esta quantidade estava colada na descrição — confira e corrija se precisar" : undefined}>
                            {/* Valor e unidade lado a lado, cada um com seu
                                espaço. Antes o botão de editar ocupava 100% da
                                célula e a unidade vinha depois, empurrada pra
                                fora dos 92px: aparecia "1 v", "30 u". */}
                            <div className="qtd-celula">
                              <CelulaEditavel valor={it.qtdVendida} formato="numero"
                                onSalvar={onEditarItem ? (v) => onEditarItem(c.num, it.codigo, { qtdVendida: v }) : undefined}
                                congelado={congelado} />
                              <span className="unit">{it.un || ""}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// Avisa quando o que foi importado veio pobre — o caso típico é ter
// subido o PDF em vez do Excel.
//
// Sem isso a pessoa vê uma tabela cheia de "—" e conclui que o sistema
// não leu direito. Leu: o PDF é que não tem essas colunas. Dizer isso na
// hora, com o número de itens afetados, evita a caçada ao bug errado.
function AvisoPDFPobre({ itens }) {
  const total = (itens || []).length;
  if (total === 0) return null;

  const faltando = [];
  const semNada = (campo) => itens.every((it) => it[campo] == null);
  if (semNada("marca")) faltando.push("Fornecedor");
  if (semNada("ambiente")) faltando.push("Ambiente");
  if (semNada("especificacao")) faltando.push("Código / especificação");
  if (semNada("custoMaterial") && semNada("custoMO")) faltando.push("Custo Material e Mão de Obra");

  if (faltando.length === 0) return null;

  return (
    <div className="aviso-pobre">
      <AlertTriangle size={15} />
      <div>
        <b>Faltam colunas nos {total} itens importados:</b> {faltando.join(" · ")}.
        <div className="aviso-pobre-sub">
          Isso acontece quando o arquivo subiu em <b>PDF</b> — essas colunas existem na planilha,
          mas um PDF não guarda colunas, só texto na página. Suba o <b>Excel</b> do mesmo documento
          e elas vêm junto.
        </div>
      </div>
    </div>
  );
}

/* ---- VENDIDO PLANILHA — menu próprio ----
   Documento mais elaborado (Excel ou PDF), com marca e custo por item.
   Não mexe no valor por verba (esse é do Contrato) — mostra o total dos
   itens da própria planilha, pra depois conferir contra o Contrato. */
function VendidoPlanilhaView({ obra, onImportPlanilha, onLimpar, onReabrir, podeEditar }) {
  const congelado = obra.comprasLiberadas || !podeEditar;
  const [abertos, toggle] = useAbertos();
  const [verTexto, setVerTexto] = useState(null);
  const [filtroVenda, setFiltroVenda] = useState("todos");
  const todasVerbas = obra.categorias.filter((c) => !c.foraDaEapPadrao);

  // Mesma leitura do Vendido Contrato: a EAP inteira sempre aparece, e o
  // filtro só decide quais grupos dela ficam à vista.
  const vendidas = todasVerbas.filter((c) => grupoFoiVendido(c.itensPlanilha));
  const verbas = filtroVenda === "vendido" ? vendidas
    : filtroVenda === "nao_vendido" ? todasVerbas.filter((c) => !grupoFoiVendido(c.itensPlanilha))
    : todasVerbas;
  const contaVenda = {
    todos: todasVerbas.length,
    vendido: vendidas.length,
    nao_vendido: todasVerbas.length - vendidas.length,
  };

  // O total é sempre o da planilha inteira — filtro é lente, não recorte:
  // um subtotal que muda conforme o filtro vira número errado no print.
  const totalPlanilha = todasVerbas.reduce((a, c) => a + (c.itensPlanilha || []).reduce((s, it) => s + (it.custo || 0), 0), 0);

  async function aoImportar(file) {
    const ehPDF = /\.pdf$/i.test(file.name);
    // Evita a aba do Executivo quando o mesmo .xlsm traz as duas — Vendido
    // Planilha e Executivo não são o mesmo documento, mesmo vindo juntos.
    const { itens } = ehPDF ? await lerPlanilhaPDF(file) : await lerPlanilhaExcel(file, { evitarAba: /execut/i });
    if (itens.length === 0) {
      throw new Error(ehPDF
        ? "Não encontrei itens com quantidade nesse PDF. Me manda o arquivo que eu calibro o leitor."
        : "Não encontrei colunas de Descrição + Marca/Custo nessa planilha. Me manda o arquivo que eu calibro o leitor pro seu layout.");
    }
    onImportPlanilha(itens);
    const temCusto = itens.some((it) => it.custo != null);
    return `“${file.name}” importado — ${itens.length} itens${temCusto ? " (com custo)" : ""}.`;
  }

  return (
    <>
      <ImportButton congelado={congelado} label="Importar Planilha (Excel ou PDF)" accept=".xlsx,.xlsm,.xlsb,.xls,.csv,.pdf"
        onLimpar={onLimpar} oQueLimpa="os itens do Vendido Planilha"
        onReabrir={onReabrir} compraLiberada={obra.comprasLiberadas}
        temConteudo={obra.categorias.some((c) => (c.itensPlanilha || []).length)}
        dica={<>Suba o <b>Vendido Planilha</b> — de preferência o <b>Excel</b>. Do PDF só saem descrição, quantidade e o valor total; fornecedor, ambiente, especificação e a separação material/mão de obra existem como coluna e não sobrevivem à conversão.</>}
        onFile={aoImportar} />

      <DetalheTexto item={verTexto} onFechar={() => setVerTexto(null)} />

      <AvisoPDFPobre itens={verbas.flatMap((c) => c.itensPlanilha || [])} />

      <div className="flat-panel">
        <div className="flat-panel-header">
          <div>
            <div className="flat-panel-title">Itens da planilha de venda — {obra.codigo}/00</div>
            <div className="flat-panel-sub">Descrição, marca e custo por item, conforme a planilha. Clique na verba pra expandir.</div>
          </div>
        </div>

        <div className="filter-bar venda-bar">
          <ClipboardList size={13} className="dim" />
          {FILTROS_VENDA.map((f) => (
            <button key={f.id} className={`filter-chip tipo-chip ${filtroVenda === f.id ? "active" : ""}`}
              onClick={() => setFiltroVenda(f.id)}>
              {f.label}
              <span className="tipo-chip-conta">{contaVenda[f.id]}</span>
            </button>
          ))}
        </div>

        <div className="vend-list">
          {verbas.map((c) => {
            const itens = c.itensPlanilha || [];
            const temItens = itens.length > 0;
            const aberto = abertos.has(c.num);
            const subtotal = itens.reduce((a, it) => a + (it.custo || 0), 0);
            return (
              <div key={c.num} className="vend-grupo">
                <button className="vend-head" onClick={() => temItens && toggle(c.num)} style={{ cursor: temItens ? "pointer" : "default" }}>
                  {temItens ? (aberto ? <ChevronDown size={14} className="dim" /> : <ChevronRight size={14} className="dim" />) : <span style={{ width: 14, display: "inline-block", flexShrink: 0 }} />}
                  <span className="vend-num mono">{c.num}</span>
                  <span className="vend-nome">{c.nome}</span>
                  {temItens && <span className="vend-count">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>}
                  {!grupoFoiVendido(itens) && <span className="vend-nao-vendido">não vendido</span>}
                  {temItens && itens.filter((it) => !itemFoiVendido(it)).length > 0 && (
                    <span className="vend-nao-vendido leve">
                      {itens.filter((it) => !itemFoiVendido(it)).length} sem venda
                    </span>
                  )}
                  <span className="vend-val mono">{temItens ? fmtBRL(subtotal) : "—"}</span>
                </button>
                {aberto && temItens && (
                  /* Mesmas colunas do Executivo, na mesma ordem da
                     planilha de origem — os dois documentos usam o mesmo
                     cabeçalho, e manter o padrão é o que deixa comparar
                     um com o outro sem procurar onde cada coisa está. */
                  <table className="vend-itens exec-itens">
                    <thead>
                      <tr>
                        <th style={{ width: 46 }}>Item</th>
                        <th>Descrição</th>
                        <th style={{ width: 130 }}>Código / especif. / Obs.</th>
                        <th style={{ width: 96 }}>Fornecedor</th>
                        <th style={{ width: 80 }}>Ambiente</th>
                        <th style={{ width: 54 }} className="center">Qtd.</th>
                        <th style={{ width: 38 }} className="center">Un.</th>
                        <th style={{ width: 88 }} className="right">Custo<br />Material</th>
                        <th style={{ width: 88 }} className="right">Custo<br />Mão de Obra</th>
                        <th style={{ width: 96 }} className="right">Custo Total<br />Material</th>
                        <th style={{ width: 96 }} className="right">Custo Total<br />Mão de Obra</th>
                        <th style={{ width: 100 }} className="right">Custo<br />Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, i) => (
                        <tr key={it.codigo || i} className={it.ehTitulo ? "linha-titulo" : ""}>
                          <td className="mono dim">{it.codigo || "—"}</td>
                          <td>
                            <CelulaTexto texto={it.desc} onVerTudo={(t) => setVerTexto({ rotulo: "Descrição", texto: t })} />
                            {it.ehTitulo && <span className="tag-na">N/A — título, não entra na conferência</span>}
                          </td>
                          <td className="dim">
                            <CelulaTexto texto={it.especificacao} onVerTudo={(t) => setVerTexto({ rotulo: "Código / especificação / Obs.", texto: t })} />
                          </td>
                          <td className="dim"><span className="celula-corte" style={{ WebkitLineClamp: 2 }}>{it.marca || "—"}</span></td>
                          <td className="dim"><span className="celula-corte" style={{ WebkitLineClamp: 2 }}>{it.ambiente || "—"}</span></td>
                          <td className="mono center">{it.qtdVendida ?? "—"}</td>
                          <td className="mono center dim">{it.un || "—"}</td>
                          <td className="mono right dim">{it.custoMaterial != null ? fmtBRL(it.custoMaterial) : "—"}</td>
                          <td className="mono right dim">{it.custoMO != null ? fmtBRL(it.custoMO) : "—"}</td>
                          <td className="mono right">{it.totalMaterial != null ? fmtBRL(it.totalMaterial) : "—"}</td>
                          <td className="mono right">{it.totalMO != null ? fmtBRL(it.totalMO) : "—"}</td>
                          <td className="mono right forte">{it.custo != null ? fmtBRL(it.custo) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>

        <div className="vend-total"><span className="total-label">Total da planilha</span><span className="mono total-value">{fmtBRL(totalPlanilha)}</span></div>
      </div>
    </>
  );
}

/* ============================================================
   CONFERÊNCIA — Vendido Contrato × Vendido Planilha
   Cruza os dois documentos por código de item e classifica cada um:
   bate (mesmo item, qtd e descrição conferem), alteração/conferência
   (descrição diverge — marca/especificação, revisar) ou divergente
   (quantidade muito diferente, ou item só existe num dos dois lados).
   Comparação heurística por texto — não é 100% infalível, é ponto de
   partida pra revisão humana.
   ============================================================ */

// Baixa a caixa e tira os acentos, sem tocar na pontuação. (NFD separa a
// letra do acento; filtramos os marcadores combinantes por code point, em
// vez de regex, pra evitar problema de caractere invisível na faixa
// Unicode.)
function semAcentos(s) {
  return String(s || "").toLowerCase().normalize("NFD")
    .split("").filter((ch) => { const cp = ch.codePointAt(0); return cp < 0x0300 || cp > 0x036f; }).join("");
}

function normTxt(s) {
  return semAcentos(s).replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/* ============================================================
   ALERTA DE CONFERÊNCIA TÉCNICA
   ------------------------------------------------------------
   Coisas que batem em custo e quantidade e ainda assim dão errado na
   obra: a mesa que não passa no elevador, a banqueta na altura errada,
   a base de monocomando incompatível, o ar-condicionado que não
   conversa com a infraestrutura da planta.

   As regras são por CATEGORIA e MEDIDA — nunca por nome de modelo,
   coleção ou fornecedor. Nome de produto muda a cada obra; "mesa maior
   que 1 m" não muda.

   Na dúvida, alerta. Um alerta a mais custa uma conferência; um a menos
   custa desmontar móvel dentro do apartamento.
   ============================================================ */

// Converte as medidas achadas na descrição para METROS.
//
// As regras saem do jeito como as planilhas são escritas de verdade:
// "300x120" é centímetro, "2,40" é metro, "45cm" é 0,45. Número solto
// acima de 20 só faz sentido como centímetro — não existe mesa de 45 m.
//
// IMPORTANTE: recebe o texto com a PONTUAÇÃO INTACTA (só sem acento e em
// minúscula), não o `normTxt`. A medida é o único lugar da descrição em
// que a vírgula significa alguma coisa, e o `normTxt` troca pontuação por
// espaço: "0,42m" virava "0 42m", lido como 42 metros e descartado por
// grande demais — daí o "sem medida" numa descrição que tinha medida.
// Pior era o silêncio: "Mesa de jantar redonda 1,40m" virava 1 m e
// passava batido, justo a mesa redonda, que não biparte.
//
// Ponto de milhar ("18.000 BTU") vira número grande e cai no filtro de
// 6 m lá embaixo — por isso não precisa de tratamento próprio.
function medidasEmMetros(texto) {
  const num = (s) => parseFloat(String(s).replace(",", "."));
  const paraMetro = (n, unidade) => {
    if (!Number.isFinite(n)) return null;
    if (unidade === "mm") return n / 1000;
    if (unidade === "cm") return n / 100;
    if (unidade === "m") return n;
    return n > 20 ? n / 100 : n; // solto: acima de 20 só pode ser cm
  };

  const achados = [];
  let resto = texto;

  // "3,00 x 1,20 m" / "300x120" — a unidade final, quando existe, vale
  // para os dois lados do par
  resto = resto.replace(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\b/gi, (_, a, b, un) => {
    const u = un && un.toLowerCase();
    achados.push(paraMetro(num(a), u));
    achados.push(paraMetro(num(b), u));
    return " ";
  });

  // "45cm", "2,40m"
  resto = resto.replace(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/gi, (_, a, un) => {
    achados.push(paraMetro(num(a), un.toLowerCase()));
    return " ";
  });

  // Número que CONTA alguma coisa não mede nada. "Sofá Living 3 lugares"
  // virava 3 metros e disparava o alerta de peça grande pelo motivo
  // errado; "cooktop 5 bocas" e "cassete 4 vias" tinham o mesmo destino.
  // Some antes do palpite do número solto — os pares e as unidades
  // explícitas ("2,40 m") já foram lidos acima e não passam por aqui.
  resto = resto.replace(
    /\b\d+(?:[.,]\d+)?\s*(lugares?|assentos?|portas?|gavetas?|bocas?|vias?|pecas?|modulos?|nichos?|prateleiras?)\b/gi,
    " "
  );

  // número solto que sobrou
  const reSolto = /\b(\d+(?:[.,]\d+)?)\b/g;
  let m;
  while ((m = reSolto.exec(resto)) !== null) achados.push(paraMetro(num(m[1]), null));

  // acima de 6 m não é móvel: é código, ano, potência — descarta
  return achados.filter((v) => Number.isFinite(v) && v > 0 && v <= 6);
}

const ALERTA_MESA_MEDIDA =
  "verificar se precisa ser bipartida e se passa no elevador, portas e circulacao.";
const ALERTA_MESA_SEM_MEDIDA =
  "sem medida na descricao: verificar dimensao e se passa no elevador, portas e circulacao (pode precisar ser bipartida).";

// Acima disto, a peça precisa ser olhada antes de subir. Fica em 1,00 m
// de propósito, mesmo sendo um corte que gera confêrencia: um alerta a
// mais custa uma medida conferida, um a menos custa desmontar móvel
// dentro do apartamento.
const MESA_GRANDE_M = 1.0;

// Tipos de mesa que são pequenos POR DEFINIÇÃO. Só valem quando a
// descrição não trouxe medida nenhuma: aí o tipo responde no lugar dela,
// em vez de mandar toda "Mesa Lateral Fulana" pra conferência. Se a
// medida estiver escrita, ela manda — mesa de centro de 1,20 m alerta
// igual, o nome não a torna pequena.
const MESA_PEQUENA_POR_TIPO = [
  "lateral", "cabeceira", "canto", "apoio", "centro", "recanto",
];

// Quando não há nem medida nem tipo, sobra o qualificador de altura:
// "Mesa Class Alta", "Mesa Class Média", "Mesa Starck Baixa". No catálogo
// isso é o trio de mesas de apoio de alturas diferentes, e sem esta pista
// as três voltam pra conferência a cada obra.
//
// "alta" é a duvidosa das três — mesa alta também é mesa de bar, que é
// grande. Por isso o qualificador só vale como "pequena" quando não há
// nada de bar por perto; com bar na descrição, volta a alertar.
const MESA_QUALIFICADOR_ALTURA = /\b(alta|media|baixa)\b/;
const MESA_DE_BAR = ["bar", "bistro", "pub", "bancada", "banqueta", "alto padrao"];

function mesaPequenaPeloNome(t) {
  if (MESA_PEQUENA_POR_TIPO.some((p) => t.includes(p))) return true;
  return MESA_QUALIFICADOR_ALTURA.test(t) && !MESA_DE_BAR.some((p) => t.includes(p));
}

// ESTOFADO — mesma pergunta da mesa, resposta pior. A mesa às vezes
// biparte; sofá e chaise raramente têm essa saída, e o que não passa
// volta pro fornecedor.
const ALERTA_ESTOFADO_MEDIDA =
  "conferir se passa no elevador, portas e curva de escada — sofa raramente e bipartido.";
const ALERTA_ESTOFADO_SEM_MEDIDA =
  "sem medida na descricao: conferir dimensao e o acesso (elevador, portas, curva de escada) antes de fechar.";

// Peça de sentar que é pequena por definição. Banqueta fica de fora de
// propósito: ela já tem regra própria (altura contra a bancada), que
// roda antes desta.
const ESTOFADO_PEQUENO_POR_TIPO = ["cadeira", "poltrona", "puff", "pufe", "banco"];
const ESTOFADO = ["sofa", "chaise", "namoradeira", "estofado", "recamier", ...ESTOFADO_PEQUENO_POR_TIPO];

/* Palavra inteira, não pedaço de palavra.

   As pistas de estofado são curtas e colidem: "sofa" acha SOFANI (que é
   fornecedor), "banco" acharia "bancos" e qualquer coisa que comece
   igual. Nas pistas longas ("climatizacao") o substring não incomoda;
   aqui incomoda. O `s?` no fim aceita o plural sem abrir a porta pro
   resto. */
function temPalavra(t, palavras) {
  return palavras.some((p) => new RegExp(`\\b${p}s?\\b`).test(t));
}

// "mesa" aparece em coisas que não são o móvel: luminária DE MESA, cuba
// com "mesa para torneira", espelho de mesa. Iam todas pra conferência
// de elevador sem ter o que conferir.
//
// A lista é de OUTROS PRODUTOS, não de palavras soltas: só desarma a
// pista fraca ("mesa"). "jantar" e "tampo" continuam valendo sozinhos,
// senão uma bancada de pedra descrita com cuba — que é justamente o que
// não passa no elevador — sairia da regra calada.
const NAO_E_MOVEL_DE_MESA = [
  "luminaria", "abajur", "lustre", "pendente", "arandela",
  "cuba", "torneira", "monocomando", "ducha",
  "espelho", "ventilador", "relogio",
  "toalha", "jogo americano",
];

function ehMovelDeMesa(t) {
  if (/\bjantar\b|\btampo\b/.test(t)) return true;
  if (!t.includes("mesa")) return false;
  return !NAO_E_MOVEL_DE_MESA.some((p) => t.includes(p));
}
const ALERTA_BANQUETA =
  "conferir a altura da banqueta com a altura da bancada.";
const ALERTA_RECORTE_CUBA =
  "conferir se o recorte da pedra bate com a cuba efetivamente comprada (modelo, medida e tipo de instalacao) antes de liberar o corte.";
const ALERTA_BASE_MONOCOMANDO =
  "conferir a base do monocomando no apartamento (deca, docol ou outra) e a compatibilidade do acabamento.";
const ALERTA_CLIMATIZACAO =
  "conferir na planta tecnica se a infraestrutura e split, vrf ou cassete, e validar compatibilidade com os equipamentos vendidos nesta verba.";
const ALERTA_CLIMATIZACAO_MAO_DE_OBRA =
  "conferir se a mao de obra contratada corresponde ao tipo de equipamento e ao ponto de infraestrutura previsto na planta.";

// Devolve { escopo, texto } do primeiro alerta que casar, ou null.
//
// O escopo decide ONDE o alerta aparece, e sai da natureza da pergunta:
//
//   "item"  — a resposta muda de linha pra linha. Cada mesa tem a sua
//             medida, cada banqueta a sua altura. Vai na linha.
//   "grupo" — a resposta é uma só pra verba inteira. A planta tem UMA
//             infraestrutura de climatização, não uma por aparelho.
//             Repetir isso em cada linha ocupa cinco vezes o espaço e
//             faz a pessoa parar de ler na segunda.
function alertaConferenciaTecnica(descricao) {
  const t = normTxt(descricao);
  if (!t) return null;
  const tem = (...palavras) => palavras.some((p) => t.includes(p));
  const doItem = (texto) => ({ escopo: "item", texto });

  // 1 — MESA / JANTAR / TAMPO: passa no elevador? precisa ser bipartida?
  if (ehMovelDeMesa(t)) {
    // Do texto com pontuação, não do `t`: ver medidasEmMetros.
    const medidas = medidasEmMetros(semAcentos(descricao));
    if (medidas.length > 0) {
      return Math.max(...medidas) > MESA_GRANDE_M ? doItem(ALERTA_MESA_MEDIDA) : null;
    }
    // Sem medida escrita, quem responde é o nome.
    if (mesaPequenaPeloNome(t)) return null;
    return doItem(ALERTA_MESA_SEM_MEDIDA);
  }

  // 2 — BANQUETA: altura tem que casar com a da bancada. Vem antes do
  // estofado de propósito — a pergunta dela é outra.
  if (tem("banqueta")) return doItem(ALERTA_BANQUETA);

  // 3 — ESTOFADO: mesma conta da mesa, com o mesmo corte de 1,00 m.
  // Sofá de dois lugares já passa de 1,60 m, então quase sempre cai — o
  // que está certo: ele não biparte, e o que não sobe volta pro
  // fornecedor. Cadeira, poltrona e puff são pequenos por definição.
  if (temPalavra(t, ESTOFADO)) {
    const medidas = medidasEmMetros(semAcentos(descricao));
    if (medidas.length > 0) {
      return Math.max(...medidas) > MESA_GRANDE_M ? doItem(ALERTA_ESTOFADO_MEDIDA) : null;
    }
    if (temPalavra(t, ESTOFADO_PEQUENO_POR_TIPO)) return null;
    return doItem(ALERTA_ESTOFADO_SEM_MEDIDA);
  }

  // 4 — PEDRA COM RECORTE PRA CUBA. A marcenaria da planilha vem como
  // valor fechado ("Marcenaria [MAT]"), sem peça pra medir — mas a
  // bancada de pedra vem descrita, e é onde o erro custa caro: furo
  // errado em granito não tem conserto, refaz a peça.
  if (temPalavra(t, ["recorte"]) && temPalavra(t, ["cuba"])) return doItem(ALERTA_RECORTE_CUBA);

  // 5 — BASE DO MONOCOMANDO: só a base embutida na parede. Torneira,
  // bica e monocomando de mesa não têm esse problema.
  if (tem("base") && tem("monocomando", "registro", "chuveiro", "ducha", "pressao")) {
    const ehDeMesa = tem("torneira", "bica", "de mesa", "lavatorio", "cozinha", "pia");
    const ehEmbutida = /base[^.]*\b(registro|pressao|embut)/.test(t);
    if (!ehDeMesa || ehEmbutida) return doItem(ALERTA_BASE_MONOCOMANDO);
  }

  // 6 — CLIMATIZAÇÃO. "split" solto entra de propósito: na planilha real
  // aparece "Ar condicionao Split hi wall" — com o erro de digitação, é
  // só o "split" que sobra pra reconhecer o item.
  if (tem("ar condicionado", "ar-condicionado", "arcondicionado", "evaporadora", "condensadora", "split")) {
    // Mão de obra de instalação não é o equipamento: a pergunta ali é se
    // o serviço contratado casa com o aparelho, não qual é a infra.
    if (tem("mao de obra", "instalacao")) return doItem(ALERTA_CLIMATIZACAO_MAO_DE_OBRA);
    return { escopo: "grupo", texto: ALERTA_CLIMATIZACAO };
  }

  return null;
}

/* ============================================================
   ALERTAS DE CONJUNTO
   ------------------------------------------------------------
   Estes não olham um item: olham o que a verba tem JUNTO. A pergunta
   deles não cabe numa linha — "3000K e 4000K no mesmo lugar" só existe
   quando os dois estão lá, e nenhuma das duas linhas está errada
   sozinha.

   Por isso eles ficam calados quando está tudo coerente. Na 2519 os
   quatro itens com temperatura declarada são todos 4000K, e a regra não
   diz nada — que é o comportamento certo.
   ============================================================ */

const ACABAMENTOS = [
  "cromado", "escovado", "acetinado", "grafite", "dourado", "black",
  "preto", "fosco", "polido", "niquel", "bronze", "champanhe",
];

// Só louça e metal entram na conta de acabamento. Pedra também é descrita
// como "escovado" ("Siena Escovado"), e comparar acabamento de granito com
// acabamento de torneira geraria divergência onde não há.
const LOUCA_METAL = [
  "cuba", "torneira", "monocomando", "ducha", "chuveiro", "registro",
  "misturador", "valvula",
];

/**
 * Alertas que valem pra verba inteira, a partir das linhas dela.
 *
 * Recebe [{ desc, ambiente }] e devolve os textos que se aplicam.
 */
function alertasDeConjunto(itens) {
  const out = [];
  const linhas = (itens || []).map((i) => ({
    t: normTxt(i.desc),
    amb: String(i.ambiente || "").trim(),
  }));

  // 1 — TEMPERATURA DE COR MISTURADA. A faixa evita confundir com
  // código ou potência: fora de 2000K–7000K não é temperatura de luz.
  const temps = new Set();
  linhas.forEach(({ t }) => {
    const m = t.match(/\b(\d{4})\s*k\b/);
    if (!m) return;
    const k = Number(m[1]);
    if (k >= 2000 && k <= 7000) temps.add(k);
  });
  if (temps.size > 1) {
    const lista = [...temps].sort((a, b) => a - b).join("K, ");
    out.push(`temperaturas de cor diferentes nesta verba (${lista}K) — conferir se a mistura e proposital.`);
  }

  // 2 — FITA DE LED SEM FONTE. Cada trecho de fita precisa da sua; o
  // que falta só aparece na instalação, com o forro já fechado.
  const fitas = linhas.filter(({ t }) => /\bfita\b/.test(t) && /\bled\b/.test(t)).length;
  const fontes = linhas.filter(({ t }) => temPalavra(t, ["fonte", "driver", "transformador"])).length;
  if (fitas > 0 && fontes < fitas) {
    out.push(`${fitas} ${fitas === 1 ? "trecho" : "trechos"} de fita de led e ${fontes} ${fontes === 1 ? "fonte" : "fontes"} nesta verba — conferir se cada trecho tem a sua.`);
  }

  // 3 — ACABAMENTO MISTURADO DENTRO DO MESMO AMBIENTE. Entre ambientes
  // a diferença é normal (cozinha inox, lavabo grafite); no mesmo
  // banheiro é que ela não casa. Sem a coluna Ambiente preenchida esta
  // regra simplesmente não fala — melhor calada do que comparando a
  // obra inteira e acusando o que é intencional.
  const porAmbiente = new Map();
  linhas.forEach(({ t, amb }) => {
    if (!amb || !temPalavra(t, LOUCA_METAL)) return;
    const achados = ACABAMENTOS.filter((a) => temPalavra(t, [a]));
    if (achados.length === 0) return;
    if (!porAmbiente.has(amb)) porAmbiente.set(amb, new Set());
    achados.forEach((a) => porAmbiente.get(amb).add(a));
  });
  const misturados = [...porAmbiente.entries()].filter(([, s]) => s.size > 1);
  if (misturados.length > 0) {
    const detalhe = misturados.map(([amb, s]) => `${amb} (${[...s].join(", ")})`).join("; ");
    out.push(`acabamentos diferentes de louca/metal no mesmo ambiente: ${detalhe} — conferir se casam.`);
  }

  return out;
}

// Palavras que aparecem em quase toda descrição sem distinguir nada, ou
// que são rótulo e não conteúdo ("Cor: Branco" — o que importa é branco).
const PALAVRAS_VAZIAS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "com", "para", "por", "a", "o", "as", "os",
  "um", "uma", "no", "na", "nos", "nas", "ao", "aos", "sem", "sob", "ou",
  "cod", "codigo", "ref", "referencia", "cor", "modelo", "tipo", "marca", "linha",
]);

// Quebra a descrição em palavras comparáveis.
//
// O detalhe que faz toda a diferença: na planilha, marca e código vêm
// grudados — "SnelloPD03000LED3Y". Comparando palavra a palavra, isso é
// UMA palavra, e ela não é igual a "Snello" do contrato; o par se perde
// justamente onde é mais óbvio pra um humano. Separar nas fronteiras
// (minúscula→MAIÚSCULA, letra→dígito, dígito→letra) desfaz a emenda:
// "Snello PD 03000 LED 3 Y". Aí "Snello" reencontra "Snello".
//
// A separação tem que acontecer ANTES de baixar a caixa, senão a pista
// da maiúscula se perde.
function tokenizar(s) {
  const separado = String(s || "")
    .replace(/([a-zà-ÿ])([A-ZÀ-Ý])/g, "$1 $2")
    .replace(/([A-Za-zÀ-ÿ])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-zÀ-ÿ])/g, "$1 $2");
  return normTxt(separado)
    .split(" ")
    // fragmentos de 1 letra ("Y", "3") sobram da separação e, por serem
    // raros, ganhariam peso alto sem significar nada.
    .filter((w) => w.length > 1 && !PALAVRAS_VAZIAS.has(w));
}

// Duas palavras são a mesma coisa? Igualdade, ou uma começando a outra —
// cobre abreviação e código que continua na marca ("snell" / "snello").
function tokensCasam(a, b) {
  if (a === b) return 1;
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
  if (curto.length >= 4 && longo.startsWith(curto)) return 0.9;
  return 0;
}

// Medidas com unidade — 14W, 3000K, 1m, IP65.
//
// Elas têm poder de veto. "Embutido recuado 14W" e "Embutido recuado 7W"
// compartilham quase toda a descrição, mas são luminárias diferentes: o
// número é o produto. Sem veto, a semelhança das palavras aprovava o par
// — e aprovar item errado calado é pior que apontar divergência à toa,
// porque o erro só aparece na obra.
//
// Número solto NÃO conta: "Suíte 02" e "Cod. 4473" são lugar e código,
// não especificação.
const RE_MEDIDA = /(\d+(?:[.,]\d+)?)\s*(btu|w|kg|k|va|v|mm|cm|m|lm|ip|hz|pol)(?![a-z0-9])/gi;

function medidas(s) {
  const mapa = new Map(); // unidade -> Set de valores
  const texto = String(s || "");
  for (const m of texto.matchAll(RE_MEDIDA)) {
    const valor = parseFloat(m[1].replace(",", "."));
    const unidade = m[2].toLowerCase();
    if (!Number.isFinite(valor)) continue;
    if (!mapa.has(unidade)) mapa.set(unidade, new Set());
    mapa.get(unidade).add(valor);
  }
  return mapa;
}

// Só reprova quando os DOIS lados declaram a mesma unidade e discordam.
// Se o contrato não diz a potência e a planilha diz, isso é detalhamento,
// não divergência.
function medidasConflitam(a, b) {
  const ma = medidas(a);
  const mb = medidas(b);
  for (const [unidade, valoresA] of ma) {
    const valoresB = mb.get(unidade);
    if (!valoresB || !valoresB.size) continue;
    const temEmComum = [...valoresA].some((v) => valoresB.has(v));
    if (!temEmComum) return true;
  }
  return false;
}

// Peso de cada palavra: quanto mais rara dentro do conjunto comparado,
// mais ela vale. Numa verba de luminárias, "luminaria" está em todas e
// não ajuda a decidir nada; "recuado" aparece em poucas e é justamente
// o que separa um item do outro. Sem isso, ruído e sinal pesam igual.
function construirPeso(...listas) {
  const freq = new Map();
  let total = 0;
  listas.forEach((lista) => (lista || []).forEach((it) => {
    total += 1;
    new Set(tokenizar(it.desc)).forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
  }));
  return (w) => Math.log((total + 1) / ((freq.get(w) || 0) + 1)) + 1;
}

// Os três números que governam a conferência. Ficam juntos de propósito:
// mexer num sem olhar os outros foi exatamente o que fez tapete parear
// com espelho — o teto de medida ficou ACIMA do mínimo de pareamento, e
// virou passaporte em vez de barreira. A ordem tem que valer sempre:
//
//     LIMIAR_PAREAR  <  TETO_MEDIDA_CONFLITANTE  <  LIMIAR_OK
//
const LIMIAR_PAREAR = 0.34;             // abaixo disso são itens diferentes, nem compara
const TETO_MEDIDA_CONFLITANTE = 0.55;   // medida briga: pareia pra revisão, nunca aprova
const LIMIAR_OK = 0.6;                  // acima disso, considera a mesma descrição

// A primeira pergunta que uma pessoa faz não é "quantas palavras batem",
// é "isso é sequer a mesma coisa?". Tapete e espelho morrem aí, por mais
// parecido que seja o resto da linha (ambos têm medida, ambiente,
// fornecedor).
//
// Nestes documentos, o que o item É está nas primeiras palavras; o resto
// qualifica. "Torneira Lóggica Cromado" é uma torneira. "Bancada Com
// Recorte Para Cuba" é uma bancada — não uma cuba, mesmo citando cuba.
// Por isso o tipo só vale quando aparece no COMEÇO do outro lado: aceitar
// em qualquer posição fazia torneira parear com bancada de granito, só
// porque a bancada menciona o furo para torneira.
//
// Duas palavras de folga (e não uma) porque a planilha às vezes põe a
// categoria na frente: "Luminária Pendente Snello" ainda casa com
// "Pendente Snello".
const PALAVRAS_DE_CABECA = 2;

function mesmoTipo(wa, wb) {
  if (!wa.length || !wb.length) return false;
  const comeco = (lista) => lista.slice(0, PALAVRAS_DE_CABECA);
  const apareceNoComeco = (palavra, lista) => comeco(lista).some((x) => tokensCasam(palavra, x) > 0);
  return apareceNoComeco(wa[0], wb) || apareceNoComeco(wb[0], wa);
}

// Semelhança entre duas descrições, com as palavras pesadas. Combina
// Jaccard com CONTENÇÃO (quanto do lado menor está dentro do maior).
// Contenção resolve o caso comum "a Planilha tem mais detalhe":
// "Embutido recuado 14W" × "Embutido recuado 14W Cod. 4473 | Cor:
// Branco" é o mesmo item, só que mais especificado.
function similaridade(a, b, peso = () => 1) {
  const wa = Array.from(new Set(tokenizar(a)));
  const wb = Array.from(new Set(tokenizar(b)));
  if (!wa.length || !wb.length) return 0;
  if (!mesmoTipo(wa, wb)) return 0;

  // cada palavra de um lado casa com no máximo uma do outro
  const gasto = new Set();
  let pesoInter = 0;
  wa.forEach((x) => {
    let melhor = 0, alvo = null;
    wb.forEach((y) => {
      if (gasto.has(y)) return;
      const s = tokensCasam(x, y);
      if (s > melhor) { melhor = s; alvo = y; }
    });
    if (alvo) { gasto.add(alvo); pesoInter += peso(x) * melhor; }
  });

  const pesoA = wa.reduce((t, w) => t + peso(w), 0);
  const pesoB = wb.reduce((t, w) => t + peso(w), 0);
  const pesoUniao = pesoA + pesoB - pesoInter;
  const jaccard = pesoUniao > 0 ? pesoInter / pesoUniao : 0;
  const menorPeso = Math.min(pesoA, pesoB);
  const contencao = menorPeso > 0 ? pesoInter / menorPeso : 0;
  // descrição curta demais não sustenta contenção (1 palavra em comum
  // de 1 daria nota cheia)
  const bruta = Math.min(wa.length, wb.length) < 2 ? jaccard : Math.max(jaccard, contencao);

  // Medida divergente é TETO sobre a nota real, nunca uma nota fixa.
  // Como teto, ela derruba "14W × 7W" de 1.00 pra 0.55 — o par continua
  // visível pra você conferir, mas não passa como aprovado. Como nota
  // fixa (o erro anterior), ela ERGUIA pares sem nada em comum até
  // acima do mínimo de pareamento — foi assim que tapete virou par de
  // espelho: os dois têm medida em metros, e medidas diferentes.
  return medidasConflitam(a, b) ? Math.min(bruta, TETO_MEDIDA_CONFLITANTE) : bruta;
}

// "06.01" e "6.1" são o mesmo item escrito de dois jeitos. Zero à
// esquerda cai; zero à direita fica, porque 6.10 é outro item que não 6.1.
function normCodigo(c) {
  if (c == null) return null;
  const s = String(c).trim().replace(/,/g, ".");
  if (!s) return null;
  return s.split(".").map((p) => p.replace(/^0+(?=\d)/, "")).join(".") || null;
}

// Três respostas, não duas: bate, não bate, ou não dá pra comparar.
// Quando um dos lados não traz quantidade (o contrato costuma não trazer),
// isso não é divergência — é ausência de informação, e tratar como
// divergência enchia a tela de alarme falso.
function compararQtd(a, b) {
  if (a == null || b == null) return "sem_dado";
  return Math.abs(a - b) < 0.01 ? "bate" : "difere";
}

// Motor de cruzamento — por DESCRIÇÃO, não por código.
//
// O código de item não serve de chave aqui: o "9.9.2" do contrato não é
// necessariamente o "9.9.2" da planilha, porque cada arquivo é formatado
// de um jeito. Parear por código produzia comparações erradas com cara
// de certas. O código entra só como desempate, quando duas candidatas
// empatam na descrição.
//
// Estratégia: calcula a semelhança de todos os pares possíveis, e vai
// fechando do par mais parecido pro menos, cada item usado uma vez só.
// Assim o casamento óbvio é decidido antes de sobrar item pra forçar
// par duvidoso.
function cruzarItens(itensA, itensB, qtdA, qtdB) {
  const listaA = itensA || [];
  const listaB = itensB || [];
  const peso = construirPeso(listaA, listaB);

  // Comparar todo mundo com todo mundo numa obra grande seria centenas
  // de milhares de contas e travaria a tela. Mas dois itens sem NENHUMA
  // palavra em comum nunca vão parear (similaridade exige tipo em
  // comum), então basta olhar os que dividem ao menos uma palavra.
  const indice = new Map();
  listaB.forEach((it, j) => {
    new Set(tokenizar(it.desc)).forEach((w) => {
      if (!indice.has(w)) indice.set(w, []);
      indice.get(w).push(j);
    });
  });

  const candidatos = [];
  listaA.forEach((ia, i) => {
    const possiveis = new Set();
    new Set(tokenizar(ia.desc)).forEach((w) => (indice.get(w) || []).forEach((j) => possiveis.add(j)));
    possiveis.forEach((j) => {
      const ib = listaB[j];
      const sim = similaridade(ia.desc, ib.desc, peso);
      if (sim < LIMIAR_PAREAR) return;
      const mesmoCodigo = normCodigo(ia.codigo) && normCodigo(ia.codigo) === normCodigo(ib.codigo);
      candidatos.push({ i, j, sim, desempate: sim + (mesmoCodigo ? 0.001 : 0) });
    });
  });
  candidatos.sort((x, y) => y.desempate - x.desempate);

  const pares = [];
  const usadoA = new Set();
  const usadoB = new Set();
  candidatos.forEach(({ i, j, sim }) => {
    if (usadoA.has(i) || usadoB.has(j)) return;
    usadoA.add(i); usadoB.add(j);
    pares.push({ codigo: listaA[i].codigo || listaB[j].codigo, a: listaA[i], b: listaB[j], sim });
  });

  // sobras: existem de um lado só
  listaA.forEach((it, i) => { if (!usadoA.has(i)) pares.push({ codigo: it.codigo, a: it, b: null }); });
  listaB.forEach((it, j) => { if (!usadoB.has(j)) pares.push({ codigo: it.codigo, a: null, b: it }); });

  return pares.map((entry) => {
    const { a, b, sim } = entry;
    if (!a || !b) return { ...entry, status: "somente_um" };

    const qtd = compararQtd(qtdA(a), qtdB(b));
    const descBate = sim >= LIMIAR_OK;

    if (descBate && qtd !== "difere") return { ...entry, status: "ok", qtdCmp: qtd };
    const motivoBase = qtd === "difere" && !descBate ? "ambos" : qtd === "difere" ? "qtd" : "desc";
    return { ...entry, status: "diferente", motivoBase, qtdCmp: qtd };
  });
}

function motivoDiferenca(e) {
  if (e.motivoBase === "qtd") return "Quantidade diferente";
  if (e.motivoBase === "desc") return "Descrição diverge — revisar";
  return "Quantidade e descrição divergem";
}

// Acha, dentro da verba, o item do criativo que corresponde a este item
// do executivo — pra coluna "Vendido (criativo)" e a diferença.
//
// Usa o mesmo motor do depara: os dois documentos descrevem o mesmo
// produto com palavras diferentes, e o código não serve de chave (o
// "3.4" de um não é o "3.4" do outro).
function casarComCriativo(item, itensCriativo) {
  const base = itensCriativo || [];
  if (base.length === 0) return null;
  const peso = construirPeso(base, [item]);

  let melhor = null;
  let melhorSim = 0;
  base.forEach((c) => {
    const s = similaridade(item.desc, c.desc, peso);
    if (s > melhorSim) { melhorSim = s; melhor = c; }
  });
  if (!melhor || melhorSim < LIMIAR_OK) return null;

  return {
    qtd: melhor.qtdVendida, custo: melhor.custo, custoUnitario: melhor.custoUnitario,
    custoMaterial: melhor.custoMaterial ?? null, custoMO: melhor.custoMO ?? null,
  };
}

// Junta os itens de todas as verbas numa lista só, carimbando de onde
// cada um veio.
//
// Por que a obra inteira e não verba a verba: a numeração da verba muda
// de um documento pro outro, igual ao código do item. O mesmo
// ar-condicionado aparece como 06.6.2 no contrato e 07.7.2 na planilha —
// comparando verba contra verba eles nunca se encontram, e os dois
// aparecem como "só existe num lado". Quem confere na mão mapeia pelo
// significado ("climatização é climatização"), não pelo número.
function juntarItens(categorias, campo) {
  const out = [];
  (categorias || []).filter(naoEhVerbaPadrao).forEach((c) => {
    // linhas de título (quantidade e valor zerados) ficam de fora: não
    // são produto, e comparar título com item gera divergência inventada
    (c[campo] || []).filter((it) => !it.ehTitulo).forEach((it) => out.push({ ...it, verbaNum: c.num, verbaNome: c.nome }));
  });
  return out;
}

// Descobre se a planilha numera as verbas deslocada em relação ao
// contrato (que segue a EAP).
//
// Numa obra real, a planilha estava +1: climatização caiu em "Móveis Sob
// Medida" e marcenaria em "Serralheria". Não dá pra fixar "+1" no
// código, porque a próxima planilha pode vir com outro deslocamento ou
// nenhum — então medimos, usando os itens que já pareamos: neles
// sabemos a verba dos DOIS lados, e a diferença entre elas é a resposta.
//
// Só aplica se a maioria confortável dos pares concordar. Ficando na
// dúvida, não mexe: verba errada é ruim, verba embaralhada é pior.
function detectarDeslocamentoVerba(pares) {
  const difs = new Map();
  let total = 0;
  pares.forEach(({ a, b }) => {
    if (!a || !b) return;
    const na = Number(a.verbaNum), nb = Number(b.verbaNum);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) return;
    total += 1;
    const d = nb - na;
    difs.set(d, (difs.get(d) || 0) + 1);
  });
  if (total < 4) return 0;
  let melhor = 0, votos = 0;
  difs.forEach((qtd, d) => { if (qtd > votos) { votos = qtd; melhor = d; } });
  return votos / total >= 0.6 ? melhor : 0;
}

// A verba usada pra agrupar o resultado na tela.
//
// O contrato manda, porque segue a EAP. Quando o item só existe na
// planilha, desfazemos o deslocamento medido antes de acreditar no
// número dela.
function verbaDaLinha(a, b, deslocamento = 0, categorias = []) {
  if (a) return { num: a.verbaNum, nome: a.verbaNome };
  if (!b) return { num: null, nome: null };
  if (!deslocamento) return { num: b.verbaNum, nome: b.verbaNome };

  const corrigido = String(Number(b.verbaNum) - deslocamento).padStart(2, "0");
  const cat = categorias.find((c) => c.num === corrigido);
  return cat ? { num: cat.num, nome: cat.nome } : { num: b.verbaNum, nome: b.verbaNome };
}

// cruza a obra inteira (Vendido Contrato × Vendido Planilha)
function conferirObra(categorias) {
  const contrato = juntarItens(categorias, "itensContrato");
  const planilha = juntarItens(categorias, "itensPlanilha");
  const cruzado = cruzarItens(contrato, planilha, (x) => x.qtdVendida, (x) => x.qtdVendida);
  const deslocamento = detectarDeslocamentoVerba(cruzado);
  const linhas = cruzado
    .map((e) => {
      if (e.status === "somente_um") return { ...e, motivo: e.a && !e.b ? "Item do contrato não encontrado na planilha" : "Item da planilha não encontrado no contrato" };
      if (e.status === "ok") return { ...e, motivo: null };
      return { ...e, motivo: motivoDiferenca(e) };
    })
    .map(({ a, b, ...rest }) => ({ ...rest, contrato: a, planilha: b, verba: verbaDaLinha(a, b, deslocamento, categorias) }));
  return { linhas, deslocamento };
}

// cruza a obra inteira (Vendido Planilha × Planilha Executivo)
function conferirExecutivoObra(categorias) {
  const vendido = juntarItens(categorias, "itensPlanilha");
  const executivo = juntarItens(categorias, "itensPlanilhaExecutivo");
  const cruzado = cruzarItens(vendido, executivo, (x) => x.qtdVendida, (x) => x.qtdVendida);
  const deslocamento = detectarDeslocamentoVerba(cruzado);
  const linhas = cruzado
    .map((e) => {
      if (e.status === "somente_um") return { ...e, motivo: e.a && !e.b ? "Está na planilha vendida, mas não na planilha executivo" : "ACRESCENTADO NO EXECUTIVO — não foi vendido ao cliente" };
      if (e.status === "ok") return { ...e, motivo: null };
      return { ...e, motivo: motivoDiferenca(e) };
    })
    .map(({ a, b, ...rest }) => ({ ...rest, planilhaVendido: a, planilhaExecutivo: b, verba: verbaDaLinha(a, b, deslocamento, categorias) }));
  return { linhas, deslocamento };
}

// meta compartilhada pelas duas conferências: OK fica neutro (branco/sem
// destaque), diferente em vermelho, presente só num lado em amarelo.
const DEPARA_META = {
  ok: { label: "OK — bate", sub: "mesmo item, qtd. e descrição", color: "var(--ink-2)", bg: "transparent", Icon: CheckCircle2 },
  diferente: { label: "Diferente", sub: "existe nos dois, mas diverge — revisar", color: "var(--red)", bg: "var(--red-bg)", Icon: XCircle },
  somente_um: { label: "Só aparece em um", sub: "presente em só uma das fontes", color: "var(--amber)", bg: "var(--amber-bg)", Icon: AlertTriangle },
};

// O Executivo tem um quarto estado que o Depara não tem: a linha em que
// número e valor batem perfeitamente e mesmo assim precisa de olhar.
// Chamar isso de "Só aparece em um" era mentira — o item está nos dois
// documentos, idêntico. O que falta ali não é conferir número, é conferir
// se cabe, se é compatível, se conversa com a planta.
// Os rótulos do Depara falam de DIVERGÊNCIA — é só isso que aquela etapa
// faz. O Executivo faz duas coisas: compara números e levanta alerta
// técnico. "Só aparece em um" numa linha idêntica nos dois documentos era
// falso; aqui os nomes dizem o que a pessoa precisa FAZER com a linha.
const EXEC_META = {
  ok: { label: "Conferido", sub: "item, qtd. e valor batem", color: "var(--ink-2)", bg: "transparent", Icon: CheckCircle2 },
  diferente: { label: "Divergente", sub: "está nos dois, mas o número mudou", color: "var(--red)", bg: "var(--red-bg)", Icon: XCircle },
  somente_um: { label: "Entrou ou saiu", sub: "está em só um dos documentos", color: "var(--amber)", bg: "var(--amber-bg)", Icon: AlertTriangle },
  conferencia_tecnica: {
    label: "Conferência técnica", sub: "número bate — falta olhar medida e compatibilidade",
    color: "#B54708", bg: "#FFF4E5", Icon: AlertTriangle,
  },
};

// componente genérico da tela de conferência — recebe as linhas já
// cruzadas e normalizadas ({codigo, catNum, catNome, status, motivo,
// a, b}) e desenha os 3 cards-filtro + a lista lado a lado. Reutilizado
// por Vendido (Contrato×Planilha) e Executivo (Executivo×Planilha).
// uma linha do depara: mostra A×B e, se diverge, os botões Aprovar/Editar.
// Editar só habilita os campos da coluna B (planilha) DESSA linha — o
// resto da tabela continua travado.
function ConfRow({ l, m, colALabel, colBLabel, vazioALabel, vazioBLabel, aprovado, onAprovar, onEditar, selecionavel, selecionado, onToggleSelecionar }) {
  const [editando, setEditando] = useState(false);
  const [desc, setDesc] = useState(l.b?.desc || "");
  const [qtd, setQtd] = useState(l.b?.qtd != null ? String(l.b.qtd).replace(".", ",") : "");
  const [valor, setValor] = useState(l.b?.valor != null ? String(l.b.valor).replace(".", ",") : "");

  function salvar() {
    const qtdNum = parseFloat(qtd.replace(/\./g, "").replace(",", "."));
    const valorNum = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    onEditar({ desc: desc.trim(), qtdVendida: isNaN(qtdNum) ? null : qtdNum, custo: isNaN(valorNum) ? null : valorNum });
    setEditando(false);
  }

  return (
    <div className={`conf-row ${l.alertaTecnico ? "com-alerta" : ""}`} style={{ background: l.alertaTecnico ? undefined : m.bg }}>
      <div className="conf-row-top">
        {selecionavel && <input type="checkbox" className="conf-check" checked={selecionado} onChange={onToggleSelecionar} aria-label="Selecionar linha" />}
        <span className="mono dim conf-codigo">{l.catNum}.{l.codigo || "—"}</span>
        <span className="conf-badge" style={{ color: m.color, background: m.bg === "transparent" ? "var(--panel)" : m.bg }}><m.Icon size={12} /> {m.label}</span>
        {aprovado && <span className="conf-badge" style={{ color: "var(--green)", background: "var(--green-bg)" }}><CheckCircle2 size={12} /> Aprovado</span>}
        {l.naoVendido && <span className="conf-badge nao-vendido"><AlertTriangle size={12} /> Não foi vendido</span>}
      </div>
      <div className="conf-cols">
        <div className="conf-col">
          <div className="conf-col-label">{colALabel}</div>
          {l.a ? (
            <>
              <div className="conf-desc">{l.a.desc}</div>
              <div className="conf-meta mono">{l.a.qtd ?? "—"} {l.a.un || ""} · {l.a.extra || "—"}</div>
              <div className="conf-meta mono">{l.a.valor != null ? fmtBRL(l.a.valor) : "—"}</div>
            </>
          ) : <div className="conf-vazio">— {vazioALabel} —</div>}
        </div>
        <div className="conf-col">
          <div className="conf-col-label">{colBLabel}</div>
          {editando ? (
            <div className="conf-edit">
              <input className="form-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição" />
              <div className="conf-edit-row">
                <input className="form-input" style={{ width: 70 }} value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="Qtd." />
                <input className="form-input" style={{ width: 90 }} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor" />
              </div>
              <div className="conf-edit-actions">
                <button type="button" className="btn-cancelar" onClick={() => setEditando(false)}>Cancelar</button>
                <button type="button" className="btn-criar" onClick={salvar}>Salvar</button>
              </div>
            </div>
          ) : l.b ? (
            <>
              <div className="conf-desc">{l.b.desc}</div>
              <div className="conf-meta mono">{l.b.qtd ?? "—"} {l.b.un || ""} · {l.b.extra || "—"}</div>
              <div className="conf-meta mono">{l.b.valor != null ? fmtBRL(l.b.valor) : "—"}</div>
            </>
          ) : <div className="conf-vazio">— {vazioBLabel} —</div>}
        </div>
      </div>
      {l.alertaTecnico && (
        <div className="conf-motivo">
          <span className="alerta-conf">⚠️ <b>Alerta de conferência técnica:</b></span>{" "}
          <span>{l.alertaTecnico}</span>
        </div>
      )}
      {l.motivo && <div className="conf-motivo">{l.motivo}</div>}
      {l.status !== "ok" && !editando && (
        <div className="conf-acoes">
          <button type="button" className="btn-editar-linha" onClick={() => setEditando(true)}><SlidersHorizontal size={12} /> Editar planilha</button>
          {!aprovado && <button type="button" className="btn-aprovar-linha" onClick={onAprovar}><CheckCircle2 size={12} /> Aprovar</button>}
        </div>
      )}
    </div>
  );
}

function ConferenciaGenerica({ linhas, naoAnalisadas = [], meta, alertasPorVerba, colALabel, colBLabel, vazioALabel, vazioBLabel, vazioTitulo, vazioSub, aprovacoes, onAprovarLinha, onEditarB, escopo }) {
  const [filtro, setFiltro] = useState("todos");
  const [selecionados, setSelecionados] = useState(() => new Set());
  // Tudo começa recolhido: com 185 linhas, abrir sozinho enterra a visão
  // geral e a pessoa perde a noção de quanto falta. O contador de
  // pendências no cabeçalho já diz onde precisa entrar.
  const [manual, setManual] = useState(() => new Map());

  if (linhas.length === 0) {
    return (
      <div className="compras-empty">
        <GitCompare size={30} className="dim" />
        <div className="compras-empty-title">{vazioTitulo}</div>
        <div className="compras-empty-sub">{vazioSub}</div>
      </div>
    );
  }

  const cnt = (st) => linhas.filter((l) => l.status === st).length;
  const visiveis = filtro === "todos" ? linhas : linhas.filter((l) => l.status === filtro);
  const chave = (l) => `${l.catNum}:${l.codigo}`;
  const pendentesVisiveis = visiveis.filter((l) => l.status !== "ok");

  // Agrupa por verba, na ordem em que as verbas aparecem — é assim que
  // a conferência acontece na prática: abre a verba, olha o que o
  // contrato diz e o que a planilha diz, decide, passa pra próxima.
  const porVerba = new Map();
  visiveis.forEach((l) => {
    if (!porVerba.has(l.catNum)) porVerba.set(l.catNum, { num: l.catNum, nome: l.catNome, itens: [] });
    porVerba.get(l.catNum).itens.push(l);
  });
  const grupos = Array.from(porVerba.values());
  const estaAberto = (g) => manual.get(g.num) === true;
  const toggle = (g) => setManual((p) => new Map(p).set(g.num, !estaAberto(g)));

  const toggleSel = (k) => setSelecionados((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const selecionarTodasPendentes = () => setSelecionados(new Set(pendentesVisiveis.map(chave)));
  const limparSelecao = () => setSelecionados(new Set());
  const aprovarSelecionados = () => {
    selecionados.forEach((k) => {
      const idx = k.lastIndexOf(":");
      onAprovarLinha && onAprovarLinha(k.slice(0, idx), k.slice(idx + 1));
    });
    setSelecionados(new Set());
  };

  return (
    <>
      <div className="conf-stats">
        {Object.entries(meta).map(([st, m]) => (
          <button key={st} className={`conf-stat ${filtro === st ? "active" : ""}`} style={{ borderColor: filtro === st ? m.color : undefined }} onClick={() => setFiltro(filtro === st ? "todos" : st)}>
            <div className="conf-stat-num" style={{ color: m.color }}>{cnt(st)}</div>
            <div className="conf-stat-label">{m.label}</div>
            <div className="conf-stat-sub">{m.sub}</div>
          </button>
        ))}
      </div>

      <div className="compras-filtros">
        <button className={`cfiltro ${filtro === "todos" ? "active" : ""}`} onClick={() => setFiltro("todos")}>Todos <span className="cbadge">{linhas.length}</span></button>
      </div>

      {onAprovarLinha && pendentesVisiveis.length > 0 && (
        <div className="selecao-massa">
          {selecionados.size === 0 ? (
            <button type="button" className="btn-editar-linha" onClick={selecionarTodasPendentes}>Selecionar todas as pendências visíveis ({pendentesVisiveis.length})</button>
          ) : (
            <>
              <span className="selecao-massa-texto">{selecionados.size} selecionada{selecionados.size > 1 ? "s" : ""}</span>
              <button type="button" className="btn-cancelar" onClick={limparSelecao}>Limpar</button>
              <button type="button" className="btn-aprovar-linha" onClick={aprovarSelecionados}><CheckCircle2 size={12} /> Aprovar selecionadas</button>
            </>
          )}
        </div>
      )}

      <div className="vend-list">
        {grupos.map((g) => {
          const { num, nome, itens } = g;
          const aberto = estaAberto(g);
          const pend = itens.filter((l) => l.status !== "ok").length;
          const alertaGrupo = alertasPorVerba ? alertasPorVerba.get(num) : null;
          return (
            <div key={num} className="vend-grupo">
              <button className="vend-head" onClick={() => toggle(g)}>
                {aberto ? <ChevronDown size={14} className="dim" /> : <ChevronRight size={14} className="dim" />}
                <span className="vend-num mono">{num}</span>
                <span className="vend-nome">{nome}</span>
                {/* Marca a verba com alerta técnico mesmo fechada — senão
                    o aviso fica escondido atrás de um clique que ninguém
                    sabe que precisa dar. */}
                {alertaGrupo && <span className="vend-alerta-mark" title="Esta verba tem alerta de conferência técnica"><AlertTriangle size={12} /></span>}
                <span className="vend-count">{itens.length} {itens.length === 1 ? "linha" : "linhas"}</span>
                <span className={`vend-pend ${pend === 0 ? "ok" : ""}`}>
                  {pend === 0 ? "tudo conferido" : `${pend} pendente${pend > 1 ? "s" : ""}`}
                </span>
              </button>
              {aberto && alertaGrupo && (
                <div className="grupo-alerta">
                  <AlertTriangle size={14} />
                  <div>
                    <b>
                      {alertaGrupo.length === 1
                        ? "Alerta de conferência técnica — vale para toda a verba:"
                        : `${alertaGrupo.length} alertas de conferência técnica nesta verba:`}
                    </b>{" "}
                    {alertaGrupo.length === 1 ? (
                      <span>{alertaGrupo[0]}</span>
                    ) : (
                      <ul className="grupo-alerta-lista">
                        {alertaGrupo.map((texto) => <li key={texto}>{texto}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              {aberto && (
                <div className="compras-list">
                  {itens.map((l, i) => {
                    const k = chave(l);
                    return (
                      <ConfRow key={`${l.codigo}-${i}`} l={l} m={meta[l.status]}
                        colALabel={colALabel} colBLabel={colBLabel} vazioALabel={vazioALabel} vazioBLabel={vazioBLabel}
                        aprovado={aprovacoes ? aprovacoes.has(`${escopo}:${k}`) : false}
                        onAprovar={() => onAprovarLinha && onAprovarLinha(l.catNum, l.codigo)}
                        onEditar={(patch) => onEditarB && onEditarB(l.catNum, l.codigo, patch)}
                        selecionavel={l.status !== "ok" && !!onAprovarLinha}
                        selecionado={selecionados.has(k)}
                        onToggleSelecionar={() => toggleSel(k)} />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {naoAnalisadas.map((c) => (
          <div key={c.num} className="vend-grupo na">
            <div className="vend-head na">
              <span style={{ width: 14, display: "inline-block", flexShrink: 0 }} />
              <span className="vend-num mono">{c.num}</span>
              <span className="vend-nome">{c.nome}</span>
              <span className="vend-na-motivo">{motivoVerbaNaoAnalisada(c.num, c.nome)}</span>
              <span className="vend-pend na">N/A</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Verbas que não entram no depara — cada uma por um motivo próprio, e o
// motivo aparece na tela. Elas continuam listadas como "N/A": some da
// conferência é diferente de ficar explícito que não foi analisado.
const NAO_ANALISADAS_CODIGO = {
  "01": "Padrão em toda obra — não muda de contrato pra contrato",
  "02": "Padrão em toda obra — não muda de contrato pra contrato",
  "21": "Móveis sob medida não são conferidos item a item nesta etapa",
};
/* Resolve pelo NOME, não pelo número.

   A EAP oficial da empresa renumerou tudo: Móveis Sob Medida saiu de 07
   pra 21, Execução e Mão de Obra saiu de 17 pra 32. Só que 07 e 17 não
   ficaram vagos — viraram Preventivo de Incêndio e Parede Verde.

   Uma regra indexada por número passaria a marcar N/A justamente esses
   dois, e voltaria a conferir item a item os móveis sob medida, sem que
   nada na tela mudasse de aparência. Pior ainda: as obras JÁ SALVAS
   guardam suas categorias com a numeração antiga, então o mesmo "07"
   significa uma coisa numa obra velha e outra numa nova.

   O nome do grupo é o que não muda entre as duas numerações — é a mesma
   razão pela qual o depara casa por nome e não por código. */
const ehVerbaNaoAnalisada = (num, nome) => {
  const canonico = (nome ? verbaPorNome(nome) : null) || num;
  return Object.prototype.hasOwnProperty.call(verbasNaoAnalisadas(), canonico);
};
const motivoVerbaNaoAnalisada = (num, nome) => {
  const canonico = (nome ? verbaPorNome(nome) : null) || num;
  return verbasNaoAnalisadas()[canonico];
};
const naoEhVerbaPadrao = (c) => !c.foraDaEapPadrao && !ehVerbaNaoAnalisada(c.num, c.nome);

// CMV LIBERADO — o teto de custo que sai desta conferência.
//
// É o depara que libera o CMV pra equipe, então o número precisa estar
// aqui, não escondido numa planilha à parte. O valor que vale é o da
// PLANILHA (é o que o depara define como versão final), somado por verba
// e no total.
//
// Enquanto houver linha pendente, o número aparece como provisório: um
// item ainda em discussão pode entrar ou sair, e tratar isso como
// definitivo é o tipo de erro que só aparece quando o dinheiro acabou.
// Valor de venda e margem NÃO entram aqui: esta tela é usada pela equipe
// de obra, e valor de venda não é divulgado pra ela. O que a equipe
// precisa é do teto de custo — quanto pode gastar, no total e por grupo.
// Calcula o CMV. Separado da tela de propósito: a trava que libera o
// Executivo precisa decidir pelo MESMO número que a pessoa está vendo —
// se cada um calculasse do seu jeito, o botão travaria com o painel
// mostrando valor, e ninguém entenderia por quê.
function calcularCMV(linhas, categorias) {
  const porVerba = new Map();
  let total = 0;
  let pendentes = 0;

  (linhas || []).forEach((l) => {
    if (l.status !== "ok") pendentes += 1;
    const v = l.b?.valor;
    if (v == null) return;
    total += v;
    const atual = porVerba.get(l.catNum) || { num: l.catNum, nome: l.catNome, valor: 0 };
    atual.valor += v;
    porVerba.set(l.catNum, atual);
  });

  // As verbas fora da conferência entram no CMV mesmo assim.
  //
  // "Não conferimos item a item" não é o mesmo que "não custa dinheiro":
  // móveis sob medida sozinhos dão R$ 141 mil numa obra. Como elas não
  // geram linha de depara, o valor vem direto da planilha — sem isso o
  // CMV sai menor que o custo real, que é o pior erro possível num teto
  // de gastos.
  (categorias || []).forEach((c) => {
    if (c.foraDaEapPadrao || !ehVerbaNaoAnalisada(c.num, c.nome)) return;
    const valor = (c.itensPlanilha || []).reduce((a, it) => a + (it.custo || 0), 0);
    if (valor <= 0) return;
    total += valor;
    porVerba.set(c.num, { num: c.num, nome: c.nome, valor, foraDaConferencia: true });
  });

  /* Grupo FORA do padrão da EAP também entra no CMV.

     Ficava de fora, e era dinheiro sumindo em silêncio: no criativo da
     2405 o grupo AUTOMAÇÃO — que não existe na EAP oficial de 32 grupos —
     tem R$ 24.317,00, e o CMV vinha R$ 24.317,00 menor que a planilha.
     Nada na tela dizia que aquele valor tinha sido descartado.

     A regra da empresa é acrescentar no final o que não está no padrão.
     Acrescentar inclui a conta: um teto de gastos que não conta parte do
     gasto é pior que não ter teto, porque parece confiável.

     Aparece marcado, pra ninguém confundir com verba do padrão. */
  (categorias || []).forEach((c) => {
    if (!c.foraDaEapPadrao) return;
    const valor = (c.itensPlanilha || []).reduce((a, it) => a + (it.custo || 0), 0);
    if (valor <= 0) return;
    total += valor;
    porVerba.set(`fora:${c.nome}`, { num: c.num || "—", nome: c.nome, valor, foraDoPadrao: true });
  });

  const grupos = Array.from(porVerba.values()).sort((a, b) => String(a.num).localeCompare(String(b.num)));
  return { total, pendentes, grupos };
}

/* O CMV do jeito que as telas seguintes devem enxergar.

   O valor gravado manda. Quando ele falta MAS o depara já foi aprovado, a
   obra passou por uma versão do app que ainda não salvava o CMV: ele
   existiu, foi aprovado com nome e data, e se perdeu no primeiro reload.
   Mandar refazer a liberação seria pedir de novo uma decisão que já foi
   tomada — e, pior, uma decisão que congela etapas.

   Então recalcula da mesma fonte que a liberação usou: as categorias, que
   sempre foram salvas. `calcularCMV` é pura, então o número que sai aqui é
   o mesmo que saiu no dia da aprovação. `recuperado` marca essa origem,
   pra tela poder dizer de onde veio em vez de fingir que estava lá. */
function cmvDaObra(obra) {
  if (obra?.cmvLiberado > 0) {
    return { total: obra.cmvLiberado, grupos: null, recuperado: false };
  }
  if (!obra?.deparaAprovado) return null;

  const { linhas } = conferirObra(obra.categorias || []);
  const mapeadas = linhas.map((item) => ({
    catNum: item.verba.num, catNome: item.verba.nome, status: item.status,
    b: item.planilha ? { valor: item.planilha.custo } : null,
  }));
  const { total, grupos } = calcularCMV(mapeadas, obra.categorias);
  return total > 0 ? { total, grupos, recuperado: true } : null;
}

function ResumoCMV({ linhas, categorias }) {
  const { total, pendentes, grupos } = calcularCMV(linhas, categorias);

  return (
    <div className="cmv-painel">
      <div className="cmv-topo">
        <div className="cmv-bloco">
          <div className="cmv-rotulo">CMV liberado {pendentes > 0 && <span className="cmv-provisorio">provisório</span>}</div>
          <div className="cmv-valor mono">{fmtBRL(total)}</div>
          <div className="cmv-sub">
            {pendentes > 0
              ? `${pendentes} ${pendentes === 1 ? "linha ainda pendente" : "linhas ainda pendentes"} — o valor pode mudar`
              : "todas as linhas conferidas"}
          </div>
        </div>
      </div>

      {grupos.length > 0 && (
        <div className="cmv-grupos">
          <div className="cmv-grupos-titulo">CMV liberado por grupo</div>
          {grupos.map((g) => (
            <div key={g.num} className="cmv-linha">
              <span className="cmv-linha-num mono">{g.num}</span>
              <span className="cmv-linha-nome">
                {g.nome}
                {/* entra no valor, mas não passou por conferência item a
                    item — quem lê o número precisa saber a diferença */}
                {g.foraDaConferencia && <span className="cmv-tag-na">sem conferência</span>}
                {/* Entra no CMV, mas fica dito: é grupo que a planilha
                    trouxe e a EAP da empresa não tem. */}
                {g.foraDoPadrao && <span className="cmv-tag-fora">fora do padrão da EAP</span>}
              </span>
              <span className="cmv-linha-barra">
                <span style={{ width: total > 0 ? `${(g.valor / total) * 100}%` : 0 }} />
              </span>
              <span className="cmv-linha-valor mono">{fmtBRL(g.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// DEPARA CONTRATO × PLANILHA — junta as duas fontes numa versão única.
// Branco = OK, vermelho = diferente entre as duas, amarelo = só existe
// numa. Precisa ser aprovado (revisão explícita) pra liberar o Executivo.
function DeparaContratoPlanilhaView({ obra, onAprovar, onEditarPlanilha, onAprovarLinha, podeEditar }) {
  // Vem da obra e é gravado no banco. Antes era useState local: as
  // aprovações valiam só na sessão e sumiam no F5.
  const aprovacoes = obra.aprovacoes || new Set();
  const toggleAprovacao = (catNum, codigo) => onAprovarLinha("depara", catNum, codigo);

  const { linhasBrutas, deslocamento } = useMemo(() => {
    const { linhas, deslocamento } = conferirObra(obra.categorias);
    return {
      deslocamento,
      linhasBrutas: linhas.map((item) => ({
        codigo: item.codigo, catNum: item.verba.num, catNome: item.verba.nome, status: item.status, motivo: item.motivo,
        a: item.contrato ? { desc: item.contrato.desc, qtd: item.contrato.qtdVendida, un: item.contrato.un, extra: item.contrato.ambiente, valor: null } : null,
        b: item.planilha ? { desc: item.planilha.desc, qtd: item.planilha.qtdVendida, un: item.planilha.un, extra: item.planilha.marca, valor: item.planilha.custo } : null,
      })),
    };
  }, [obra]);

  const naoAnalisadas = useMemo(
    () => obra.categorias.filter((c) => !c.foraDaEapPadrao && ehVerbaNaoAnalisada(c.num, c.nome)),
    [obra]
  );

  /* Vendido Contrato é OPCIONAL: uma obra pode chegar aqui só com a
     Planilha (ex.: começou direto do Executivo e agora quer um CMV de
     referência). Sem contrato nenhum, TODA linha da planilha vira
     "só aparece em um" — não por divergência real, é que não existe
     nada do outro lado pra comparar. Exigir aprovação linha a linha
     nesse caso seria fazer ela clicar centenas de vezes numa
     comparação que nunca teve ponto de partida. */
  const contratoVazio = useMemo(
    () => juntarItens(obra.categorias, "itensContrato").length === 0,
    [obra]
  );

  // linha aprovada manualmente entra de vez no bucket "OK — bate"
  // (o motivo/badge "Aprovado" continua aparecendo pra diferenciar de
  // um match automático).
  const linhas = useMemo(() => linhasBrutas.map((l) => (
    aprovacoes.has(`depara:${l.catNum}:${l.codigo}`) ? { ...l, status: "ok", motivo: null } : l
  )), [linhasBrutas, aprovacoes]);

  if (linhas.length === 0) {
    return (
      <div className="compras-empty">
        <GitCompare size={30} className="dim" />
        <div className="compras-empty-title">Nada pra conferir ainda</div>
        <div className="compras-empty-sub">Importe o Vendido Contrato e o Vendido Planilha desta obra — assim que os dois tiverem itens, o depara aparece aqui automaticamente.</div>
      </div>
    );
  }

  const pendentes = linhas.filter((l) => l.status !== "ok" && !(contratoVazio && !l.a));
  const { total: cmvTotal } = calcularCMV(linhas, obra.categorias);

  // O que precisa estar pronto pra liberar. As duas condições são
  // diferentes: sem pendência quer dizer "conferido"; CMV maior que zero
  // quer dizer "tem valor apurado". Dá pra conferir tudo e mesmo assim o
  // CMV vir zerado — planilha sem coluna de custo, por exemplo — e aí
  // liberar seria abrir a obra pra comprar contra um teto inexistente.
  const cmvApurado = cmvTotal > 0;
  const podeLiberar = pendentes.length === 0 && cmvApurado && podeEditar;

  return (
    <>
      <ResumoCMV linhas={linhas} categorias={obra.categorias} />

      {/* A liberação fica no topo, junto do CMV: é a decisão que esta
          tela existe pra tomar, e no rodapé de 185 linhas ela sumia.
          O botão desabilitado com o motivo ao lado comunica o que falta
          melhor do que um botão ativo que recusa o clique. */}
      {obra.deparaAprovado ? (
        <div className="import-ok"><ShieldCheck size={14} /> CMV liberado — Executivo e etapas seguintes abertos.</div>
      ) : (
        <div className="liberacao-barra">
          <div className="liberacao-texto">
            {!cmvApurado ? (
              <><Lock size={15} /> <span>
                <b>CMV ainda não apurado.</b> O Executivo abre quando esta conferência produzir um valor —
                confira se a <b>Planilha</b> subiu com a coluna de custo.
              </span></>
            ) : pendentes.length === 0 ? (
              <><CheckCircle2 size={15} /> <span>
                {contratoVazio && <>Sem Vendido Contrato importado — o CMV sai direto da Planilha. </>}
                Tudo conferido. Liberar o CMV de <b>{fmtBRL(cmvTotal)}</b> abre o Executivo e as etapas seguintes.
              </span></>
            ) : (
              <><Lock size={15} /> <span>
                <b>{pendentes.length}</b> {pendentes.length === 1 ? "linha pendente" : "linhas pendentes"} de aprovação.
                O CMV só é liberado quando não sobrar nenhuma — o valor final vira o que está na <b>Planilha</b>.
              </span></>
            )}
          </div>
          <button className="btn-aprovar" disabled={!podeLiberar} onClick={() => {
            if (window.confirm(
              `Liberar o CMV de ${fmtBRL(cmvTotal)}?\n\n` +
              "Este vira o teto de custo da obra, e o Executivo e as etapas seguintes abrem para a equipe."
            )) onAprovar(cmvTotal);
          }}>
            <ShieldCheck size={14} /> Liberar CMV
          </button>
        </div>
      )}

      {deslocamento !== 0 && (
        <div className="aviso-deslocamento">
          A planilha numera as verbas <b>{deslocamento > 0 ? `${deslocamento} à frente` : `${-deslocamento} atrás`}</b> do contrato —
          os itens que só existem na planilha foram reposicionados na verba correta da EAP.
        </div>
      )}
      <ConferenciaGenerica linhas={linhas} naoAnalisadas={naoAnalisadas} meta={DEPARA_META}
        colALabel="Contrato" colBLabel="Planilha"
        vazioALabel="não está no contrato" vazioBLabel="não está na planilha"
        vazioTitulo="Nada pra conferir ainda" vazioSub=""
        aprovacoes={aprovacoes} onAprovarLinha={obra.comprasLiberadas || !podeEditar ? undefined : toggleAprovacao} escopo="depara"
        onEditarB={obra.comprasLiberadas || !podeEditar ? undefined : ((catNum, codigo, patch) => onEditarPlanilha(catNum, codigo, patch))} />
    </>
  );
}

// CONF. EXECUTIVO — depara Vendido Planilha × Planilha Executivo.
function ExecutivoConferenciaView({ obra, onEditarPlanilhaExecutivo, onAprovarLinha, podeEditar }) {
  // Vem da obra e é gravado no banco. Antes era useState local: as
  // aprovações valiam só na sessão e sumiam no F5.
  const aprovacoes = obra.aprovacoes || new Set();
  const toggleAprovacao = (catNum, codigo) => onAprovarLinha("exec", catNum, codigo);

  const linhasBrutas = useMemo(() => conferirExecutivoObra(obra.categorias).linhas.map((item) => {
    const desc = item.planilhaExecutivo?.desc || item.planilhaVendido?.desc;

    // Acrescentado no executivo sem ter sido vendido: televisor, máquina
    // de lavar. Bate valor e quantidade porque não há com o que comparar
    // — mas é justamente o caso de olhar, porque alguém vai pagar.
    const soNoExecutivo = !item.planilhaVendido && !!item.planilhaExecutivo;
    const alerta = alertaConferenciaTecnica(desc);
    const alertaTecnico = alerta && alerta.escopo === "item" ? alerta.texto : null;
    const alertaGrupo = alerta && alerta.escopo === "grupo" ? alerta.texto : null;

    let status = item.status;
    let motivo = item.motivo;
    // Alerta de item tira do verde mesmo com tudo batendo: o problema dele
    // não é de número, é de caber e de ser compatível. Mas não vira
    // "diferente" nem "só aparece em um" — nenhuma das duas é verdade.
    // Divergência real é mais urgente e continua mandando no status.
    if (alertaTecnico && status === "ok") { status = "conferencia_tecnica"; motivo = null; }

    return {
      codigo: item.codigo, catNum: item.verba.num, catNome: item.verba.nome,
      status, motivo, alertaTecnico, alertaGrupo,
      // Guardados pra alimentar os alertas de conjunto, que precisam ver
      // as linhas da verba juntas — não uma de cada vez.
      desc,
      ambiente: item.planilhaExecutivo?.ambiente || item.planilhaVendido?.ambiente || null,
      naoVendido: soNoExecutivo,
      a: item.planilhaVendido ? { desc: item.planilhaVendido.desc, qtd: item.planilhaVendido.qtdVendida, un: item.planilhaVendido.un, extra: item.planilhaVendido.marca, valor: item.planilhaVendido.custo } : null,
      b: item.planilhaExecutivo ? { desc: item.planilhaExecutivo.desc, qtd: item.planilhaExecutivo.qtdVendida, un: item.planilhaExecutivo.un, extra: item.planilhaExecutivo.marca, valor: item.planilhaExecutivo.custo } : null,
    };
  }), [obra]);

  const naoAnalisadas = useMemo(
    () => obra.categorias.filter((c) => !c.foraDaEapPadrao && ehVerbaNaoAnalisada(c.num, c.nome)),
    [obra]
  );

  const linhas = useMemo(() => linhasBrutas.map((l) => (
    aprovacoes.has(`exec:${l.catNum}:${l.codigo}`) ? { ...l, status: "ok", motivo: null } : l
  )), [linhasBrutas, aprovacoes]);

  /* Os alertas da verba, de duas origens.

     A primeira vem de um item que fala pelo grupo — a climatização é
     uma só na planta, então repetir a pergunta em cada aparelho ocupa
     cinco vezes o espaço e faz parar de ler na segunda linha.

     A segunda só existe olhando as linhas juntas: temperatura de cor
     misturada, fita sem fonte, acabamento que não casa. Nenhuma delas
     cabe numa linha sozinha. */
  const alertasPorVerba = useMemo(() => {
    const m = new Map();
    const porVerba = new Map();
    linhasBrutas.forEach((l) => {
      if (!porVerba.has(l.catNum)) porVerba.set(l.catNum, []);
      porVerba.get(l.catNum).push(l);
      if (l.alertaGrupo && !m.has(l.catNum)) m.set(l.catNum, [l.alertaGrupo]);
    });
    porVerba.forEach((linhas, num) => {
      const doConjunto = alertasDeConjunto(linhas);
      if (doConjunto.length === 0) return;
      m.set(num, [...(m.get(num) || []), ...doConjunto]);
    });
    return m;
  }, [linhasBrutas]);

  return (
    <ConferenciaGenerica linhas={linhas} naoAnalisadas={naoAnalisadas} meta={EXEC_META}
      alertasPorVerba={alertasPorVerba}
      colALabel="Planilha (vendido)" colBLabel="Planilha (executivo)"
      vazioALabel="não está na planilha vendida" vazioBLabel="não está na planilha executivo"
      vazioTitulo="Nada pra conferir ainda"
      vazioSub="Importe a Vendido Planilha e a Planilha Executivo desta obra — o depara aparece aqui automaticamente."
      aprovacoes={aprovacoes} onAprovarLinha={obra.comprasLiberadas || !podeEditar ? undefined : toggleAprovacao} escopo="exec"
      onEditarB={obra.comprasLiberadas || !podeEditar ? undefined : ((catNum, codigo, patch) => onEditarPlanilhaExecutivo(catNum, codigo, patch))} />
  );
}

// Bloqueio de fase: mostra enquanto o Depara Contrato×Planilha não foi
// aprovado — o Executivo só libera depois dessa aprovação.
//
// `onComecarSemDepara` é o atalho pra obra sem Vendido nenhum (só
// cadastro do Monday): não existe com o que montar o Depara, então
// exigi-lo travaria a obra pra sempre. Só é passado pelo chamador
// quando faz sentido (obra sem detalhe algum, e em modo de edição) —
// aqui o componente só decide SE mostra o botão, não quando.
function FaseBloqueada({ onIrParaDepara, onComecarSemDepara }) {
  return (
    <div className="compras-empty">
      <Lock size={30} className="dim" />
      <div className="compras-empty-title">Aguardando a liberação do CMV</div>
      <div className="compras-empty-sub">Esta etapa abre quando o CMV desta obra for liberado no Depara Contrato × Planilha — é ele que define o teto de custo com que a equipe vai trabalhar daqui pra frente.</div>
      <button className="btn-nova-solicitacao" onClick={onIrParaDepara}>Ir para o Depara</button>
      {onComecarSemDepara && (
        <>
          <div className="compras-empty-sub" style={{ marginTop: 18 }}>
            Esta obra ainda não tem Vendido Contrato nem Vendido Planilha — não há com o que montar essa comparação.
          </div>
          <button className="btn-cancelar" onClick={onComecarSemDepara}>
            Começar direto pelo Executivo, sem CMV por enquanto
          </button>
        </>
      )}
    </div>
  );
}

/* ============================================================
   ABA EXECUTIVO — Caderno de Especificação + Planilha Executivo
   ============================================================ */

// CADERNO DE ESPECIFICAÇÃO — só upload + download, sem leitura/parse.
// É o PDF com tudo que foi aprovado de produto com o cliente.
// Adicionar item pelo banco de insumos, em vez de linha em branco.
//
// Digitando, busca no Banco de Preços e traz descrição, unidade e custo
// unitário já preenchidos — sobra só a quantidade. Assim o item entra
// com o nome que o Sienge conhece (o que faz a compra casar depois) e
// com um preço de referência, em vez de nascer vazio e ser preenchido
// de memória.
function BuscaInsumo({ onEscolher, onCancelar }) {
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (termo.trim().length < 3) { setLista([]); return; }
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(() => {
      listarPrecos({ busca: termo, limite: 12 })
        .then((r) => { if (vivo) { setLista(r); setErro(null); } })
        .catch((e) => { if (vivo) setErro(e.message || String(e)); })
        .finally(() => { if (vivo) setBuscando(false); });
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [termo]);

  return (
    <div className="busca-insumo">
      <div className="busca-insumo-topo">
        <Search size={13} className="dim" />
        <input
          autoFocus
          placeholder="Buscar insumo no banco de preços — ex: spot embutir, fita led, torneira…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onCancelar(); }}
        />
        <button className="clear-btn" onClick={onCancelar}><X size={13} /></button>
      </div>

      {erro && <div className="busca-insumo-vazio">{erro}</div>}
      {!erro && termo.trim().length > 0 && termo.trim().length < 3 && (
        <div className="busca-insumo-vazio">Digite ao menos 3 letras.</div>
      )}
      {!erro && buscando && <div className="busca-insumo-vazio">Buscando…</div>}
      {!erro && !buscando && termo.trim().length >= 3 && lista.length === 0 && (
        <div className="busca-insumo-vazio">
          Nada encontrado. <button className="link-inline" onClick={() => onEscolher(null)}>Criar item em branco</button>
        </div>
      )}

      {lista.map((p, i) => (
        <button key={i} className="busca-insumo-linha" onClick={() => onEscolher(p)}>
          <span className="mono busca-insumo-cod">{p.codigo}</span>
          <span className="busca-insumo-desc">{p.descricao}</span>
          <span className="mono busca-insumo-preco">{fmtBRL(p.custo_unitario)}</span>
          <span className="busca-insumo-un">/{p.unidade || "un"}</span>
        </button>
      ))}
    </div>
  );
}

// Sugestões de preço vindas do banco do Sienge — o que foi realmente
// pago em compras parecidas.
//
// Mostra e deixa a pessoa escolher; não preenche sozinho de propósito.
// A mesma descrição pode aparecer com preços bem diferentes, e ver a
// faixa é justamente o que revela quando um deles está fora da curva.
function SugestoesPreco({ descricao, onUsar }) {
  const [abertas, setAbertas] = useState(false);
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);

  async function buscar() {
    setAbertas(true);
    if (lista) return;
    try {
      setLista(await sugerirPrecos(descricao));
    } catch (e) {
      setErro(e.message || String(e));
    }
  }

  if (!abertas) {
    return (
      <button className="btn-sugestao" onClick={buscar}>
        <PackageSearch size={11} /> ver preços de referência
      </button>
    );
  }

  return (
    <div className="sugestoes">
      <div className="sugestoes-titulo">
        Últimas compras parecidas
        <button className="clear-btn" onClick={() => setAbertas(false)}><X size={11} /></button>
      </div>
      {erro && <div className="sugestoes-vazio">{erro}</div>}
      {!erro && lista === null && <div className="sugestoes-vazio">Buscando…</div>}
      {!erro && lista && lista.length === 0 && (
        <div className="sugestoes-vazio">Nada parecido no banco de preços.</div>
      )}
      {!erro && lista && lista.map((p, i) => (
        <button key={i} className="sugestao-linha" onClick={() => onUsar(p.custo_unitario)}>
          <span className="mono sugestao-preco">{fmtBRL(p.custo_unitario)}</span>
          <span className="sugestao-un">/{p.unidade || "un"}</span>
          <span className="sugestao-desc">{p.descricao}</span>
          <span className="mono sugestao-data">{p.data_ref ? p.data_ref.split("-").reverse().join("/") : ""}</span>
        </button>
      ))}
    </div>
  );
}

// Célula que vira campo ao clicar. O que veio da planilha pode ser
// corrigido aqui, e o que faltou pode ser lançado na mão — nem tudo
// chega pronto do arquivo (na planilha real, lâmpadas e fontes vêm com
// quantidade e sem custo nenhum).
/* Andar pelas células com Tab e Enter, como numa planilha.

   Cada célula editável carrega `data-cel="linha:coluna"`. Navegar é achar a
   coordenada vizinha no DOM e clicar nela — o editor já abre com `autoFocus`.

   Por que pelo DOM e não por refs: são 15 colunas em 3 componentes
   diferentes (`CelulaEditavel`, `CelulaTexto`) dentro de uma lista de verbas
   que abre e fecha. Passar ref por essa árvore inteira exigiria reescrever a
   tabela toda; a coordenada no DOM resolve com duas linhas e sobrevive a
   qualquer mudança de layout.

   A ordem de tabulação é a ordem VISUAL das células editáveis — as colunas
   calculadas (Vendido, Diferença) não têm `data-cel` e por isso são puladas
   sozinhas, sem precisar de lista de exceção. */
function irParaCelula(direcao, coord) {
  if (!coord) return;
  const celulas = Array.from(document.querySelectorAll("[data-cel]"));
  const atual = celulas.findIndex((el) => el.dataset.cel === coord);
  if (atual < 0) return;

  const [linha, coluna] = coord.split(":").map(Number);
  let alvo = null;

  if (direcao === "proxima") alvo = celulas[atual + 1];
  else if (direcao === "anterior") alvo = celulas[atual - 1];
  else if (direcao === "abaixo") {
    // Mesma coluna, linha de baixo. Se a linha seguinte não tiver aquela
    // coluna editável, cai na primeira célula dela — melhor que não sair
    // do lugar.
    alvo = celulas.find((el) => el.dataset.cel === `${linha + 1}:${coluna}`)
        || celulas.find((el) => el.dataset.cel?.startsWith(`${linha + 1}:`));
  }
  if (!alvo) return;

  // O clique abre o editor; o scroll garante que a célula esteja visível
  // quando ela está fora da área rolada horizontalmente.
  alvo.scrollIntoView({ block: "nearest", inline: "nearest" });
  alvo.click();
}

/* Máscara de dinheiro: centavos da direita pra esquerda.

   Digitando 1 2 3 4 5 6 o campo vai formando
     0,01 → 0,12 → 1,23 → 12,34 → 123,45 → 1.234,56

   É o comportamento de caixa de banco, e resolve duas coisas de uma vez.
   Não exige digitar vírgula nem ponto — quem lança trinta valores seguidos
   só digita dígito. E fecha a armadilha do `parseBRL`, que apaga TODOS os
   pontos: digitar "1234.56" com o ponto do teclado numérico virava 123456,
   um valor cem vezes maior, sem nenhum aviso. */
function mascaraMoeda(bruto) {
  const digitos = String(bruto || "").replace(/\D/g, "").slice(0, 15);
  if (!digitos) return { texto: "", valor: null };
  const valor = Number(digitos) / 100;
  return {
    texto: valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    valor,
  };
}

/* Quantidade NÃO usa a máscara de centavos.

   Ali "12" tem que virar 12, não 0,12 — a mesma regra que ajuda no dinheiro
   atrapalharia na quantidade. Aqui o filtro só impede caractere inválido e
   uma segunda vírgula; o valor é interpretado quando a pessoa sai da célula. */
function mascaraNumero(bruto) {
  const limpo = String(bruto || "").replace(/[^\d,]/g, "");
  const partes = limpo.split(",");
  const texto = partes.length > 1 ? `${partes[0]},${partes.slice(1).join("").slice(0, 4)}` : partes[0];
  return { texto, valor: texto === "" ? null : parseBRL(texto) };
}

function CelulaEditavel({ valor, onSalvar, formato = "moeda", congelado, coord, onNavegar, alinhar }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");

  const ehTexto = formato === "texto";
  const mascarar = formato === "moeda" ? mascaraMoeda : mascaraNumero;

  function abrir() {
    if (congelado) return;
    setTexto(valor == null ? "" : (ehTexto ? String(valor) : semear(valor)));
    setEditando(true);
  }

  /* Semeia o campo a partir do valor, em CENTAVOS.

     A primeira versão fazia `String(valor).replace(/\D/g, "")` e jogava fora
     a POSIÇÃO da vírgula: só acertava por acidente quando o número já tinha
     exatamente duas casas. R$ 2,50 virava 0,25 e R$ 16.000,00 virava 160,00 —
     e como o valor é gravado ao sair da célula, bastava ABRIR e FECHAR sem
     digitar nada pra estragar o número. Foi o que produziu aquele
     R$ 1.243.582.636.622,99 na verba 05.

     Multiplicar por 100 e arredondar é o único caminho que preserva a
     grandeza: 2.5 -> 250 -> "2,50". */
  function semear(v) {
    if (formato === "moeda") return mascaraMoeda(String(Math.round(v * 100))).texto;
    // quantidade guarda o número como está, só troca o separador decimal
    return String(v).replace(".", ",");
  }

  function salvar() {
    setEditando(false);
    const limpo = texto.trim();
    const novo = limpo === "" ? null : (ehTexto ? limpo : mascarar(limpo).valor);
    if (novo !== valor) onSalvar(novo);
    return novo;
  }

  if (editando) {
    return (
      <input
        className={`celula-input ${ehTexto ? "texto" : "mono"} ${alinhar || ""}`}
        autoFocus
        value={texto}
        onChange={(e) => setTexto(ehTexto ? e.target.value : mascarar(e.target.value).texto)}
        onBlur={salvar}
        onKeyDown={(e) => {
          // Tab e Enter salvam e SEGUEM: é o que faz lançar valor em série
          // ser rápido. Sem isso cada célula custa um clique.
          if (e.key === "Tab") { e.preventDefault(); salvar(); onNavegar?.(e.shiftKey ? "anterior" : "proxima", coord); return; }
          if (e.key === "Enter") { e.preventDefault(); salvar(); onNavegar?.("abaixo", coord); return; }
          if (e.key === "Escape") setEditando(false);
        }}
      />
    );
  }

  const mostrar = valor == null || valor === ""
    ? "—"
    : formato === "moeda" ? fmtBRL(valor) : String(valor);

  return (
    <button
      data-cel={coord || undefined}
      className={`celula-valor ${ehTexto ? "texto" : "mono"} ${alinhar || ""} ${congelado ? "travada" : ""}`}
      onClick={abrir}
      title={congelado ? "Congelado pela liberação de compra" : (onNavegar ? "Clique para editar · Tab e Enter andam pelas células" : "Clique para editar")}
    >
      {mostrar}
    </button>
  );
}

// Texto longo na célula: corta com reticências, e o "i" abre o inteiro.
//
// As descrições trazem o link do produto colado no texto — há trechos de
// 357 caracteres sem um espaço. Deixar isso solto estica a linha e
// desmonta a tabela. Cortar resolve a vista, mas some com a informação;
// por isso o "i" mostra tudo, selecionável e com botão de copiar (o
// código do produto é justamente o que se copia pra comprar).
function CelulaTexto({ texto, linhas = 2, onVerTudo, onEditar, congelado, coord, onNavegar }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const editavel = !!onEditar && !congelado;
  const [alvo, cortado] = useCortado(texto);

  const salvar = () => {
    setEditando(false);
    const v = rascunho.trim();
    if (v !== (texto || "")) onEditar(v || null);
  };

  if (editando) {
    return (
      <textarea
        className="celula-input texto multi"
        autoFocus
        rows={2}
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Tab") { e.preventDefault(); salvar(); onNavegar?.(e.shiftKey ? "anterior" : "proxima", coord); return; }
          // Enter salva e desce. Quem precisar de varias linhas usa Shift+Enter.
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); salvar(); onNavegar?.("abaixo", coord); return; }
          if (e.key === "Escape") setEditando(false);
        }}
      />
    );
  }

  const abrir = () => { if (!editavel) return; setRascunho(texto || ""); setEditando(true); };

  return (
    <div className="celula-texto">
      <span
        ref={alvo}
        data-cel={editavel ? coord : undefined}
        onClick={abrir}
        className={`celula-corte ${editavel ? "editavel" : ""}`}
        style={{ WebkitLineClamp: linhas }}
        title={editavel ? "Clique para editar · Tab e Enter andam pelas células" : undefined}
      >
        {texto || (editavel ? <span className="dim">clique para preencher</span> : "\u2014")}
      </span>
      {cortado && onVerTudo && (
        <button className="btn-info" title="Ver texto completo" onClick={() => onVerTudo(texto)}>i</button>
      )}
    </div>
  );
}

/* Diz se o conteúdo do elemento não coube no espaço que ele tem.

   O critério antes era contar letras (">60 caracteres"). Mas o corte é
   visual: numa coluna de 130px um texto de 45 caracteres já estoura as
   duas linhas e some, e nenhum "i" aparecia pra recuperá-lo. Contagem de
   letras não sabe a largura da coluna, o tamanho da fonte nem o tamanho
   da janela — medir o elemento sabe.

   Observa o redimensionamento porque a mesma célula cabe numa tela larga
   e não cabe numa estreita; o "i" precisa aparecer e sumir junto. */
function useCortado(dependencia) {
  const alvo = useRef(null);
  const [cortado, setCortado] = useState(false);

  useLayoutEffect(() => {
    const el = alvo.current;
    if (!el) { setCortado(false); return; }
    const medir = () => setCortado(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dependencia]);

  return [alvo, cortado];
}

// Painel com o conteúdo inteiro de um item — pra ler e copiar.
function DetalheTexto({ item, onFechar }) {
  const [copiado, setCopiado] = useState(false);
  if (!item) return null;

  const copiar = () => {
    navigator.clipboard?.writeText(item.texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    });
  };

  return (
    <div className="detalhe-fundo" onClick={onFechar}>
      <div className="detalhe-caixa" onClick={(e) => e.stopPropagation()}>
        <div className="detalhe-topo">
          <span>{item.rotulo}</span>
          <button className="clear-btn" onClick={onFechar}><X size={14} /></button>
        </div>
        <textarea className="detalhe-texto" readOnly value={item.texto} onFocus={(e) => e.target.select()} />
        <div className="detalhe-acoes">
          <button className="btn-editar-linha" onClick={copiar}>
            <Copy size={12} /> {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// SALDO DO EXECUTIVO — o que saiu, o que entrou, e se ainda cabe.
//
// Quem edita precisa ver o efeito da própria edição contra o teto, na
// hora. Sem isso, o estouro só aparece no fechamento, quando o dinheiro
// já foi gasto.
//
// O item excluído continua contando como "retirado": some da soma mas
// não some da vista — quem olhar depois precisa saber que existiu e
// quanto valia.
/* Movimento de UMA verba contra o que foi vendido nela.

   Uma verba acima do vendido NÃO é estouro do CMV. O CMV é o total da
   obra — uma verba a mais compensa outra a menos, e é comum a conta
   fechar com metade das verbas acima. Quem dá o veredito do CMV é o
   SaldoExecutivo lá em cima ("Ainda cabe" / "Acima do CMV").

   Aqui a cor mede só o PESO do movimento. Pintar tudo de vermelho fazia
   "+R$ 13,96 numa verba de R$ 39 mil" (0,03%) gritar igual a "+R$ 2.468
   numa de R$ 32 mil" (7,6%) — e como a maioria das verbas mexe alguns
   centavos, a tela inteira ficava vermelha e ninguém achava o que
   importava. */
const PESO_ARREDONDAMENTO = 0.01; // até 1% é ruído de conversão/centavo
const PESO_RELEVANTE = 0.10;      // acima de 10% vale parar e olhar

function deltaVerba(subtotal, base) {
  const dif = subtotal - base;
  // Menos de um centavo é igual. "R$ 0,00 vs. vendido" repetido em verde
  // por metade da lista era ruído puro.
  if (Math.abs(dif) < 0.01) return { tom: "igual", texto: "igual ao vendido" };
  if (dif < 0) return { tom: "sobra", texto: `${fmtBRL(-dif)} sobrando` };

  const prop = base > 0 ? dif / base : 1;
  const tom = prop < PESO_ARREDONDAMENTO ? "leve" : prop < PESO_RELEVANTE ? "medio" : "alto";
  // A porcentagem é o que torna o número legível: sem ela, R$ 13,96 e
  // R$ 2.468 parecem o mesmo tipo de problema.
  const pct = (prop * 100).toLocaleString("pt-BR", { maximumFractionDigits: prop < 0.01 ? 2 : 1 });
  return { tom, texto: `+${fmtBRL(dif)} acima (${pct}%)` };
}

function SaldoExecutivo({ categorias, cmvLiberado, recuperado }) {
  let atual = 0, retirado = 0, acrescido = 0, nExcluidos = 0, nNovos = 0;

  (categorias || []).forEach((c) => {
    (c.itensPlanilhaExecutivo || []).forEach((it) => {
      const valor = it.custo || 0;
      const base = it.vendido?.custo ?? null;
      if (it.excluido) {
        retirado += base ?? valor;
        nExcluidos += 1;
        return;
      }
      atual += valor;
      if (base == null) { acrescido += valor; if (valor > 0) nNovos += 1; }
      else if (valor > base) acrescido += valor - base;
      else if (valor < base) retirado += base - valor;
    });
  });

  // Sem CMV liberado não há teto, e portanto não há saldo. Mas o que a
  // equipe já mexeu continua sendo informação útil — some o veredito, não
  // o painel. Antes isto era `return null` e a faixa inteira desaparecia.
  if (!cmvLiberado || cmvLiberado <= 0) {
    return (
      <div className="saldo-exec sem-cmv">
        <div className="saldo-bloco">
          <div className="saldo-rotulo">Executivo hoje</div>
          <div className="saldo-valor mono">{fmtBRL(atual)}</div>
        </div>
        <div className="saldo-bloco destaque">
          <div className="saldo-rotulo">CMV liberado</div>
          <div className="saldo-valor mono dim">ainda não liberado</div>
        </div>
        <div className="saldo-mov">
          <span className="saldo-mov-item"><ArrowDownRight size={12} /> retirado {fmtBRL(retirado)}{nExcluidos > 0 && ` · ${nExcluidos} exclu${nExcluidos > 1 ? "ídos" : "ído"}`}</span>
          <span className="saldo-mov-item"><ArrowUpRight size={12} /> acrescido {fmtBRL(acrescido)}{nNovos > 0 && ` · ${nNovos} nov${nNovos > 1 ? "os" : "o"}`}</span>
        </div>
      </div>
    );
  }

  const sobra = cmvLiberado - atual;
  const estourou = sobra < 0;

  return (
    <div className={`saldo-exec ${estourou ? "estourou" : ""}`}>
      <div className="saldo-bloco">
        <div className="saldo-rotulo">CMV liberado</div>
        <div className="saldo-valor mono">{fmtBRL(cmvLiberado)}</div>
      </div>
      <div className="saldo-bloco">
        <div className="saldo-rotulo">Executivo hoje</div>
        <div className="saldo-valor mono">{fmtBRL(atual)}</div>
      </div>
      <div className="saldo-bloco destaque">
        <div className="saldo-rotulo">{estourou ? "Acima do CMV" : "Ainda cabe"}{recuperado ? " · recalculado" : ""}</div>
        <div className="saldo-valor mono" style={{ color: estourou ? "var(--red)" : "var(--green)" }}>
          {estourou ? "−" : ""}{fmtBRL(Math.abs(sobra))}
        </div>
      </div>
      <div className="saldo-mov">
        <span className="saldo-mov-item"><ArrowDownRight size={12} /> retirado {fmtBRL(retirado)}{nExcluidos > 0 && ` · ${nExcluidos} exclu${nExcluidos > 1 ? "ídos" : "ído"}`}</span>
        <span className="saldo-mov-item"><ArrowUpRight size={12} /> acrescido {fmtBRL(acrescido)}{nNovos > 0 && ` · ${nNovos} nov${nNovos > 1 ? "os" : "o"}`}</span>
      </div>
    </div>
  );
}

// Os três cadernos do Executivo. São só arquivo: sobem, ficam guardados
// e a equipe baixa pra consultar — nada é lido do PDF. A planilha, essa
// sim, é lida (vem logo abaixo, na mesma tela).
const CADERNOS_EXECUTIVO = [
  { chave: "criativo", titulo: "Projeto Criativo", sub: "A proposta criativa que deu origem ao executivo." },
  { chave: "especificacao", titulo: "Caderno de Especificação", sub: "Tudo que foi aprovado de produto junto ao cliente." },
  { chave: "marcenaria", titulo: "Caderno de Marcenaria", sub: "Projeto e detalhamento dos móveis sob medida." },
  { chave: "projeto", titulo: "Caderno de Projeto Executivo", sub: "Pranchas e detalhamentos do projeto executivo." },
];

// Uma linha por caderno, não um bloco. São três anexos de consulta que
// quase nunca mudam — ocupavam meia tela pra dizer "nenhum arquivo".
function CadernoSlot({ titulo, arquivo, chave, obraCodigo, usuario, onImportar, congelado }) {
  const inputRef = useRef(null);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState(null);   // "ver" | "baixar" | null

  async function aoEscolher(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErro(null);
    /* Era so PDF. O Projeto Criativo chega em Word, e caderno digitalizado
       chega em imagem — recusar aqui empurrava a pessoa a converter o
       arquivo pra conseguir anexar. */
    if (!tipoAceito(file.name)) { setErro(`Tipo não aceito. Vale: ${EXTENSOES_ACEITAS.replace(/,/g, " ")}`); return; }

    // Sem banco (modo local) segue o `blob:` de antes: some ao fechar a
    // aba, mas anexar continua funcionando pra quem roda sem Supabase.
    if (!supabaseConfigurado) {
      onImportar({ nome: file.name, url: URL.createObjectURL(file), tamanhoKB: Math.round(file.size / 1024) });
      return;
    }

    setEnviando(true);
    try {
      const info = await subirArquivo({ obraCodigo, chave, file, por: usuario });
      onImportar(info, arquivo?.caminho || null);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function abrir(baixar) {
    if (arquivo?.url) { window.open(arquivo.url, "_blank"); return; }
    setErro(null);
    setOcupado(baixar ? "baixar" : "ver");
    try {
      window.open(await linkParaArquivo(arquivo.caminho, { baixar }), "_blank");
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(null);
    }
  }

  // Anexo de antes de o app guardar o arquivo: só o nome ficou gravado.
  // Dizer isso é melhor do que oferecer um "Baixar" que não baixa nada.
  const perdido = arquivo && !anexoRecuperavel(arquivo);

  return (
    <div className="caderno-slot">
      <BookOpen size={14} className={arquivo ? "" : "dim"} />
      <span className="caderno-slot-titulo">{titulo}</span>
      {arquivo ? (
        <>
          <span className="caderno-slot-arquivo">{arquivo.nome} · {arquivo.tamanhoKB} KB</span>
          {perdido ? (
            <span className="caderno-slot-vazio">arquivo não guardado — anexe de novo</span>
          ) : (
            <>
              <button className="caderno-acao" onClick={() => abrir(false)} disabled={!!ocupado}>
                <Search size={12} /> {ocupado === "ver" ? "Abrindo…" : "Ver"}
              </button>
              <button className="caderno-acao" onClick={() => abrir(true)} disabled={!!ocupado}>
                <Download size={12} /> {ocupado === "baixar" ? "Baixando…" : "Baixar"}
              </button>
            </>
          )}
        </>
      ) : (
        <span className="caderno-slot-vazio">sem arquivo</span>
      )}
      {!congelado && (
        <button className="caderno-acao" disabled={enviando} onClick={() => inputRef.current && inputRef.current.click()}>
          <Upload size={12} /> {enviando ? "Enviando…" : arquivo ? "Trocar" : "Anexar"}
        </button>
      )}
      <input ref={inputRef} type="file" accept={EXTENSOES_ACEITAS} style={{ display: "none" }} onChange={aoEscolher} />
      {erro && <span className="caderno-erro">{erro}</span>}
    </div>
  );
}

// PLANILHA EXECUTIVO — extrai só descrição, quantidade e valores
// (unitário e total) por item, dentro de cada grupo — igual à Vendido
// Planilha. Por trás, também alimenta o Comparativo/Compras/Contratos
// (produto × serviço classificado pelo custo de material).
function ExecutivoView({ obra, usuario, onImportCaderno, onImportPlanilhaExecutivo, onEditarItem, onAdicionarItem, onPuxarDoCriativo, onIrParaDepara, onLimparExecutivo, onReabrir, podeEditar }) {
  const congelado = obra.comprasLiberadas || !podeEditar;
  // Resolve o CMV uma vez: gravado quando existe, recalculado do depara
  // quando a obra foi liberada antes de o app aprender a salvar.
  const cmv = useMemo(() => cmvDaObra(obra), [obra]);
  const cmvValor = cmv?.total ?? 0;
  const itensBase = obra.categorias.reduce((a, c) => a + (c.itensPlanilha || []).length, 0);
  const temBase = itensBase > 0;
  const temExecutivo = obra.categorias.some((c) => (c.itensPlanilhaExecutivo || []).length > 0);
  const [abertos, toggle] = useAbertos();
  // Os cadernos começam recolhidos: são três blocos que empurravam a
  // planilha pra fora da tela, e na maior parte do tempo ninguém precisa
  // deles abertos. Abrem sozinhos enquanto nenhum foi anexado, pra não
  // esconder que a etapa existe.
  const anexados = CADERNOS_EXECUTIVO.filter((c) => (obra.cadernos || {})[c.chave]).length;
  // sempre fechado: sao tres anexos de consulta, nao a tarefa da tela
  const [cadernosAbertos, setCadernosAbertos] = useState(false);
  // qual verba está com a busca de insumo aberta
  // Onde a busca de insumo está aberta: { verba, depois } — `depois` é o
  // índice da linha abaixo da qual inserir, ou null pra acrescentar no fim.
  const [buscandoEm, setBuscandoEm] = useState(null);
  // texto completo aberto no painel de leitura ({rotulo, texto})
  const [verTexto, setVerTexto] = useState(null);
  const [filtroVenda, setFiltroVenda] = useState("todos");
  const todasVerbas = obra.categorias.filter((c) => !c.foraDaEapPadrao);
  const vendidas = todasVerbas.filter((c) => grupoFoiVendido(c.itensPlanilhaExecutivo));
  const verbas = filtroVenda === "vendido" ? vendidas
    : filtroVenda === "nao_vendido" ? todasVerbas.filter((c) => !grupoFoiVendido(c.itensPlanilhaExecutivo))
    : todasVerbas;
  const contaVenda = {
    todos: todasVerbas.length,
    vendido: vendidas.length,
    nao_vendido: todasVerbas.length - vendidas.length,
  };

  /* Os totais somam TODAS as verbas, nunca as filtradas.

     O filtro é lente de visualização, não recorte de escopo: ver "só o
     vendido" não pode mudar o total da obra nem o saldo contra o CMV. Um
     total que muda conforme o filtro é a forma mais rápida de alguém
     comprar contra um número que não existe. */
  const somar = (campo) => todasVerbas.reduce((a, c) => a + (c.itensPlanilhaExecutivo || []).reduce((s, it) => s + (it.excluido ? 0 : (it[campo] || 0)), 0), 0);
  const total = somar("custo");
  const totalMaterial = somar("totalMaterial");
  const totalMO = somar("totalMO");

  async function aoImportar(file) {
    const ehPDF = /\.pdf$/i.test(file.name);
    // Prefere a aba do Executivo quando o mesmo .xlsm traz Orçamentária E
    // Executivo juntas — senão a primeira que produzir itens ganha, e
    // pode não ser a certa pra esta importação.
    const { itens } = ehPDF ? await lerExecutivoPDF(file) : await lerPlanilhaExcel(file, { preferirAba: /execut/i });
    if (itens.length === 0) throw new Error("Não encontrei itens nesse arquivo. Me manda ele que eu calibro o leitor.");
    onImportPlanilhaExecutivo(itens);
    return `“${file.name}” importado — ${itens.length} itens.`;
  }

  return (
    <>
      <div className="flat-panel">
        <button className="cadernos-head" onClick={() => setCadernosAbertos((v) => !v)}>
          {cadernosAbertos ? <ChevronDown size={14} className="dim" /> : <ChevronRight size={14} className="dim" />}
          <div className="cadernos-head-texto">
            <div className="flat-panel-title">Cadernos do Executivo</div>
            <div className="flat-panel-sub">Arquivos de consulta da equipe — nada é lido do PDF.</div>
          </div>
          <span className="cadernos-resumo">
            {anexados === 0 ? "nenhum anexado" : `${anexados} de ${CADERNOS_EXECUTIVO.length} anexado${anexados > 1 ? "s" : ""}`}
          </span>
        </button>
        {cadernosAbertos && (
          <div className="caderno-lista">
            {CADERNOS_EXECUTIVO.map((c) => (
              <CadernoSlot key={c.chave} titulo={c.titulo} chave={c.chave}
                arquivo={(obra.cadernos || {})[c.chave]}
                obraCodigo={obra.codigo} usuario={usuario}
                congelado={congelado}
                onImportar={(info, anterior) => onImportCaderno(c.chave, info, anterior)} />
            ))}
          </div>
        )}
      </div>

      {temBase && !congelado && (
        <div className="import-card">
          <div className="import-bar">
            <div className="import-info">
              <Copy size={14} />
              <span>
                {temExecutivo ? (
                  <>Precisa <b>recomeçar</b>? Puxar o criativo de novo troca o Executivo atual pelos {itensBase} itens da planilha original.</>
                ) : (
                  <>Comece pela <b>planilha do criativo</b> ({itensBase} itens já conferidos no depara) e edite a partir dela —
                  o que vier de lá fica marcado, e cada alteração aparece lado a lado com o valor de origem.</>
                )}
              </span>
            </div>
            <button className="btn-import" onClick={() => {
              // Recomeçar joga fora o que já foi lançado aqui. Perguntar
              // custa um clique; refazer custa a tarde.
              if (temExecutivo && !window.confirm(
                "Puxar a planilha do criativo de novo?\n\n" +
                "Tudo que já foi lançado ou editado no Executivo desta obra será trocado pelos itens originais do criativo.\n\n" +
                "Não dá para desfazer."
              )) return;
              onPuxarDoCriativo();
            }}>
              <Copy size={13} /> {temExecutivo ? "Recomeçar do criativo" : "Puxar do criativo"}
            </button>
          </div>
        </div>
      )}

      <ImportButton congelado={congelado} label={temExecutivo ? "Substituir Planilha Executivo" : "Importar Planilha Executivo"} accept=".pdf,.xlsx,.xlsm,.xlsb,.xls,.csv"
        onLimpar={onLimparExecutivo} oQueLimpa="os itens da Planilha Executivo"
        onReabrir={onReabrir} compraLiberada={obra.comprasLiberadas}
        temConteudo={temExecutivo}
        dica={<>Suba a <b>Planilha Executivo</b> — de preferência o <b>Excel</b>. Do PDF só saem descrição, quantidade e valor total; fornecedor, ambiente, especificação e a separação material/mão de obra são colunas e não sobrevivem à conversão.</>}
        onFile={aoImportar} />

      <DetalheTexto item={verTexto} onFechar={() => setVerTexto(null)} />

      <SaldoExecutivo categorias={obra.categorias} cmvLiberado={cmvValor} recuperado={cmv?.recuperado} />

      <AvisoPDFPobre itens={verbas.flatMap((c) => c.itensPlanilhaExecutivo || [])} />

      <div className="flat-panel">
        <div className="flat-panel-header">
          <div>
            <div className="flat-panel-title">Itens da planilha executivo — {obra.codigo}/00</div>
            <div className="flat-panel-sub">Descrição, quantidade e valores por item, conforme a planilha. Clique na verba pra expandir.</div>
          </div>
        </div>

        <div className="filter-bar venda-bar">
          <ClipboardList size={13} className="dim" />
          {FILTROS_VENDA.map((f) => (
            <button key={f.id} className={`filter-chip tipo-chip ${filtroVenda === f.id ? "active" : ""}`}
              onClick={() => setFiltroVenda(f.id)}>
              {f.label}
              <span className="tipo-chip-conta">{contaVenda[f.id]}</span>
            </button>
          ))}
        </div>

        <div className="vend-list">
          {verbas.map((c) => {
            const itens = c.itensPlanilhaExecutivo || [];
            const temItens = itens.length > 0;
            const aberto = abertos.has(c.num);
            const subtotal = itens.reduce((a, it) => a + (it.excluido ? 0 : (it.custo || 0)), 0);
            // quanto essa verba valia no criativo — a referência do movimento
            /* O vendido do grupo vem do CRIATIVO INTEIRO, não dos itens que
               casaram.

               Antes somava `it.vendido?.custo` — e `it.vendido` só existe
               quando o pareamento por descrição achou o item correspondente.
               Item removido no executivo, item novo, ou item cujo nome mudou
               o bastante pra não casar: todos entravam com ZERO na base.

               Na verba 05 isso significou comparar R$ 26.345,88 contra
               R$ 22.248,95 em vez de contra os R$ 39.905,50 que realmente
               foram vendidos. A tela dizia "+R$ 4.096,93 acima" numa verba
               que está R$ 13.559,62 ABAIXO do vendido — inverteu o sinal de
               uma economia e transformou em estouro. */
            const baseVerba = (c.itensPlanilha || []).reduce((a, it) => a + (it.custo || 0), 0);
            const delta = temItens && baseVerba > 0 ? deltaVerba(subtotal, baseVerba) : null;
            return (
              <div key={c.num} className="vend-grupo">
                {/* abre mesmo sem itens: é onde se lança item manual */}
                <button className="vend-head" onClick={() => toggle(c.num)}>
                  {aberto ? <ChevronDown size={14} className="dim" /> : <ChevronRight size={14} className="dim" />}
                  <span className="vend-num mono">{c.num}</span>
                  <span className="vend-nome">{c.nome}</span>
                  {temItens && <span className="vend-count">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>}
                  {/* O vendido fica à vista: sem ele, "acima" e "abaixo" são
                      afirmações sem referência na tela. */}
                  {temItens && baseVerba > 0 && (
                    <span className="vend-base mono" title="Valor vendido deste grupo no criativo — a referência da comparação">
                      vendido {fmtBRL(baseVerba)}
                    </span>
                  )}
                  {delta && (
                    <span className={`vend-delta tom-${delta.tom}`}
                      title="Movimento desta verba em relação ao que foi vendido nela. Uma verba acima não é estouro do CMV — o CMV é o total da obra, e está no resumo acima.">
                      {delta.texto}
                    </span>
                  )}
                  <span className="vend-val mono">{temItens ? fmtBRL(subtotal) : "—"}</span>
                </button>
                {aberto && temItens && (
                  <div className="exec-scroll">
                  <table className="vend-itens exec-itens exec-editavel">
                    <thead>
                      <tr>
                        <th style={{ width: 72 }}>Item</th>
                        <th style={{ minWidth: 220 }}>Descrição</th>
                        <th style={{ width: 112 }}>Código / especif.</th>
                        <th style={{ width: 86 }}>Fornecedor</th>
                        <th style={{ width: 76 }}>Ambiente</th>
                        <th style={{ width: 48 }} className="center">Qtd.</th>
                        <th style={{ width: 34 }} className="center">Un.</th>
                        <th style={{ width: 78 }} className="right">Custo<br />Material</th>
                        <th style={{ width: 78 }} className="right">Custo<br />Mão de Obra</th>
                        <th style={{ width: 86 }} className="right">Custo Total<br />Material</th>
                        <th style={{ width: 86 }} className="right">Custo Total<br />Mão de Obra</th>
                        <th style={{ width: 92 }} className="right">Custo<br />Total</th>
                        <th style={{ width: 88 }} className="right col-vendido">Vendido<br />(criativo)</th>
                        <th style={{ width: 78 }} className="right col-diferenca">Diferença</th>
                        <th style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, i) => {
                        const editar = (campo) => (novo) => onEditarItem(c.num, i, { [campo]: novo });
                        // Coordenada da célula na planilha: linha da lista + posição
                        // visual da coluna. É o que Tab e Enter seguem.
                        const cel = (col) => `${i}:${col}`;
                        const nav = irParaCelula;
                        const linha = (
                          <tr key={it.codigo || i} className={`${it.ehTitulo ? "linha-titulo" : ""} ${it.excluido ? "linha-excluida" : it.alteradoExecutivo ? "linha-alterada" : ""} ${it.substitui || it.substituiDesc ? "linha-substituta" : ""} ${it.substituidoPorDesc ? "linha-saiu-por-troca" : ""} ${buscandoEm?.verba === c.num && buscandoEm?.substituindo === i ? "linha-saindo" : ""}`}>
                            {/* O "+" mora aqui, na coluna congelada.
                                Ele estava na ÚLTIMA das 15 colunas, e a tabela
                                rola na horizontal — pra achar o botão era
                                preciso passar por dez colunas. Na primeira, ele
                                acompanha a rolagem e está sempre à vista. */}
                            <td className="mono dim col-item">
                              <span className="col-item-cod">{it.codigo || "—"}</span>
                              {!congelado && !it.excluido && (
                                <span className="col-item-acoes">
                                  <button
                                    className="btn-linha-inserir"
                                    title={`Inserir item abaixo do ${it.codigo || "item"}`}
                                    onClick={() => setBuscandoEm({ verba: c.num, depois: i })}
                                  >
                                    <Plus size={12} />
                                  </button>
                                  {/* Substituir: exclui este e encaixa o escolhido
                                      logo abaixo, ligado a ele. */}
                                  <button
                                    className="btn-linha-substituir"
                                    title={`Substituir ${it.codigo || "este item"} por outro`}
                                    onClick={() => setBuscandoEm({ verba: c.num, depois: i, substituindo: i })}
                                  >
                                    <ArrowLeftRight size={12} />
                                  </button>
                                </span>
                              )}
                            </td>
                            <td>
                              <CelulaTexto texto={it.desc} congelado={congelado} coord={cel(0)} onNavegar={nav}
                                onEditar={(v) => onEditarItem(c.num, i, { desc: v })}
                                onVerTudo={(t) => setVerTexto({ rotulo: "Descrição", texto: t })} />
                              {it.excluido && !it.substituidoPorDesc && <span className="tag-excluido">removido</span>}
                              {/* O par da substituição. Cada lado aponta pro outro,
                                  então a linha se explica sem precisar procurar. */}
                              {/* O par se explica pela barra e pelo recuo. As
                                  etiquetas ficam curtas: repetir a descrição
                                  inteira do outro lado dobrava o texto da linha
                                  justamente onde já havia texto demais. */}
                              {it.substituidoPorDesc && (
                                <span className="tag-troca" title={`Substituído por: ${it.substituidoPorDesc}`}>
                                  <ArrowDown size={10} /> trocado
                                </span>
                              )}
                              {it.substituiDesc && (
                                <span className="tag-troca" title={`Entrou no lugar de: ${it.substituiDesc}`}>
                                  <CornerDownRight size={10} /> entrou no lugar
                                </span>
                              )}
                              {it.ehTitulo && <span className="tag-na">N/A — título, não entra na conferência</span>}
                              {/* "alterado no executivo" saiu daqui: a barra amarela
                                  na lateral da linha já diz isso, e a etiqueta
                                  aparecia em quase toda linha — repetida assim, ela
                                  parava de informar e só ocupava espaço. */}
                              {it.precoNaoRevisado && <span className="tag-preco"><AlertTriangle size={10} /> preço não revisado</span>}
                              {/* Só no hover: em trinta linhas seguidas, trinta
                                  links iguais viram textura, não ação. */}
                              {it.precoNaoRevisado && !obra.comprasLiberadas && (
                                <span className="so-no-hover">
                                  <SugestoesPreco descricao={it.desc} onUsar={(v) => onEditarItem(c.num, i, { custoMaterial: v })} />
                                </span>
                              )}
                            </td>
                            <td className="dim">
                              <CelulaTexto texto={it.especificacao} congelado={congelado} coord={cel(1)} onNavegar={nav}
                                onEditar={(v) => onEditarItem(c.num, i, { especificacao: v })}
                                onVerTudo={(t) => setVerTexto({ rotulo: "Código / especificação / Obs.", texto: t })} />
                            </td>
                            <td className="dim"><CelulaTexto texto={it.marca} congelado={congelado} coord={cel(2)} onNavegar={nav} onEditar={(v) => onEditarItem(c.num, i, { marca: v })} onVerTudo={(t) => setVerTexto({ rotulo: "Fornecedor", texto: t })} /></td>
                            <td className="dim"><CelulaTexto texto={it.ambiente} congelado={congelado} coord={cel(3)} onNavegar={nav} onEditar={(v) => onEditarItem(c.num, i, { ambiente: v })} onVerTudo={(t) => setVerTexto({ rotulo: "Ambiente", texto: t })} /></td>
                            <td className="center"><CelulaEditavel valor={it.qtdVendida} formato="numero" congelado={congelado} onSalvar={editar("qtdVendida")} coord={cel(4)} onNavegar={nav} alinhar="centro" /></td>
                            <td className="center"><CelulaEditavel valor={it.un} formato="texto" congelado={congelado} onSalvar={editar("un")} coord={cel(5)} onNavegar={nav} alinhar="centro" /></td>
                            <td className="right"><CelulaEditavel valor={it.custoMaterial} congelado={congelado} onSalvar={editar("custoMaterial")} coord={cel(6)} onNavegar={nav} /></td>
                            <td className="right"><CelulaEditavel valor={it.custoMO} congelado={congelado} onSalvar={editar("custoMO")} coord={cel(7)} onNavegar={nav} /></td>
                            <td className="right"><CelulaEditavel valor={it.totalMaterial} congelado={congelado} onSalvar={editar("totalMaterial")} coord={cel(8)} onNavegar={nav} /></td>
                            <td className="right"><CelulaEditavel valor={it.totalMO} congelado={congelado} onSalvar={editar("totalMO")} coord={cel(9)} onNavegar={nav} /></td>
                            <td className="right forte"><CelulaEditavel valor={it.custo} congelado={congelado} onSalvar={editar("custo")} coord={cel(10)} onNavegar={nav} /></td>
                            {/* Referência, não é editável: fundo próprio e tom
                                apagado, pra não competir com as colunas em que
                                se digita. */}
                            <td className="mono right col-vendido">{it.vendido?.custo != null ? fmtBRL(it.vendido.custo) : <span className="dim">—</span>}</td>
                            {/* A coluna do veredito. É a única aqui que muda de
                                cor, e é o que se procura ao varrer a lista. */}
                            <td className="mono right col-diferenca">
                              {(() => {
                                const base = it.vendido?.custo;
                                // Sem referência não há o que comparar — o traço
                                // diz "não sei", que é diferente de "não mudou".
                                if (base == null || it.custo == null) return <span className="dim">—</span>;
                                const d = it.custo - base;
                                // Zero é resposta, não ausência: mostra 0,00 pra
                                // se distinguir do traço de sem-referência.
                                if (Math.abs(d) < 0.01) return <span className="dif-igual">{fmtBRL(0)}</span>;
                                return <span className={d > 0 ? "dif-acima" : "dif-abaixo"}>{d > 0 ? "+" : ""}{fmtBRL(d)}</span>;
                              })()}
                            </td>
                            <td className="center col-acoes">
                              {!congelado && (
                                <div className="linha-acoes">
                                  <button
                                    className={`btn-linha-excluir ${it.excluido ? "desfazer" : ""}`}
                                    title={it.excluido ? "Trazer de volta" : "Excluir do executivo"}
                                    onClick={() => onEditarItem(c.num, i, { excluido: !it.excluido })}
                                  >
                                    {it.excluido ? <RotateCcw size={13} /> : <X size={13} />}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                        /* A busca abre AQUI, como linha da tabela.

                           Antes ela aparecia no rodapé, depois de trinta
                           linhas: clicava-se no item de cima e a tela pedia
                           pra procurar lá embaixo, sem nada indicando de qual
                           item se tratava. Abrindo no lugar, a linha que sai
                           fica logo acima, vermelha, e a que entra nasce
                           exatamente onde vai ficar. */
                        const buscaAqui = buscandoEm?.verba === c.num && buscandoEm?.depois === i;
                        if (!buscaAqui) return linha;
                        return (
                          <React.Fragment key={`${it.codigo || i}-busca`}>
                            {linha}
                            <tr className="linha-busca">
                              <td colSpan={15}>
                                <div className="busca-na-linha">
                                  <CornerDownRight size={14} className="dim" />
                                  <div className="busca-na-linha-campo">
                                    <div className="busca-na-linha-titulo">
                                      {buscandoEm.substituindo != null
                                        ? <>Substituindo <b>{it.desc}</b> — escolha o que entra no lugar</>
                                        : <>Novo item abaixo de <b>{it.codigo || it.desc}</b></>}
                                    </div>
                                    <BuscaInsumo
                                      onCancelar={() => setBuscandoEm(null)}
                                      onEscolher={(insumo) => { onAdicionarItem(c.num, insumo, buscandoEm.depois, buscandoEm.substituindo ?? null); setBuscandoEm(null); }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
                {/* Só o "no fim da verba" abre aqui embaixo. Quem clicou no
                    + ou no ⇄ de uma linha vê a busca dentro da tabela, na
                    posição em que o item vai entrar. */}
                {aberto && !congelado && (
                  buscandoEm?.verba === c.num && buscandoEm?.depois == null ? (
                    <BuscaInsumo
                      onCancelar={() => setBuscandoEm(null)}
                      onEscolher={(insumo) => { onAdicionarItem(c.num, insumo, null, null); setBuscandoEm(null); }}
                    />
                  ) : buscandoEm?.verba === c.num ? null : (
                    <button className="btn-add-item" onClick={() => setBuscandoEm({ verba: c.num, depois: null })}>
                      <Plus size={12} /> Adicionar item no fim desta verba
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
        <div className="vend-total">
          <span className="total-label">Total da planilha executivo</span>
          <span className="exec-total-parcelas mono">
            material {fmtBRL(totalMaterial)} · mão de obra {fmtBRL(totalMO)}
          </span>
          <span className="mono total-value">{fmtBRL(total)}</span>
        </div>

        {/* Fechamento: de onde partiu, o que mudou, onde chegou — a conta
            que a pessoa faria na mão ao terminar de editar.

            Aparece SEMPRE. Antes era `obra.cmvLiberado > 0 && (...)`: sem
            CMV liberado o bloco inteiro sumia da tela, sem uma linha
            explicando por quê. Quem pediu o fechamento e não o via
            concluía que ele nunca tinha sido feito — e estava certo em
            concluir, porque a tela não dava outra informação. Faltando o
            dado, o lugar dele continua ali e diz o que falta. */}
        <div className="fechamento">
          <div className="fechamento-linha">
            <span className="fechamento-rotulo">CMV liberado</span>
            <span className="mono fechamento-valor">
              {cmvValor > 0 ? fmtBRL(cmvValor) : "—"}
            </span>
          </div>
          <div className="fechamento-linha">
            <span className="fechamento-rotulo">Alterações do executivo</span>
            <span className="mono fechamento-valor" style={cmvValor > 0 ? { color: total - cmvValor > 0 ? "var(--red)" : "var(--green)" } : undefined}>
              {cmvValor > 0
                ? `${total - cmvValor > 0 ? "+" : ""}${fmtBRL(total - cmvValor)}`
                : "—"}
            </span>
          </div>
          <div className="fechamento-linha final">
            <span className="fechamento-rotulo">
              {cmvValor > 0
                ? (total > cmvValor ? "Saldo final — acima do CMV" : "Saldo final — ainda cabe")
                : "Saldo final"}
            </span>
            <span className="mono fechamento-valor" style={cmvValor > 0 ? { color: total > cmvValor ? "var(--red)" : "var(--green)" } : undefined}>
              {cmvValor > 0 ? fmtBRL(cmvValor - total) : "—"}
            </span>
          </div>
          {!(cmvValor > 0) && (
            <div className="fechamento-aviso">
              <AlertTriangle size={13} />
              <span>
                O <b>CMV desta obra ainda não foi liberado</b> — sem ele não existe teto pra comparar,
                e o saldo não tem como ser calculado. A liberação acontece no Depara Contrato × Planilha.
              </span>
              {onIrParaDepara && (
                <button type="button" className="btn-reabrir-etapa" onClick={onIrParaDepara}>Ir para o Depara</button>
              )}
            </div>
          )}
          {/* Diz de onde veio o número em vez de fingir que sempre esteve
              gravado. Some sozinho na próxima gravação da obra, quando o
              valor recuperado finalmente vai pro banco. */}
          {cmv?.recuperado && (
            <div className="fechamento-aviso recuperado">
              <RotateCcw size={13} />
              <span>
                Este CMV foi <b>recalculado a partir do depara aprovado</b> — a obra foi liberada por uma
                versão anterior do app, que ainda não gravava esse valor. A conta é a mesma da liberação.
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ============================================================
   TOPO / SIDEBAR
   ============================================================ */

function TopBar({ onInicio }) {
  return (
    <header className="topbar">
      {/* A marca leva pro Inicio. E' o que todo site faz, e por isso e' o
          primeiro lugar onde a pessoa clica quando se perde — deixa-la
          inerte gasta um clique de descoberta que ninguem tem. */}
      <button className="topbar-brand" onClick={onInicio} title="Ir para o Início">
        <img
          className="brand-logo"
          src="/logo.png"
          alt="Group WS"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <span className="brand-word">GESTÃO DE OBRAS TKWS</span>
      </button>
      {/* A busca do topo saiu.

          Ela nunca teve handler: digitar ali nao fazia nada, e o "⌘K" ao
          lado prometia um atalho que tambem nao existia. Campo que aceita
          texto e ignora e' pior que campo nenhum — a pessoa tenta, nao
          acontece nada, e passa a desconfiar do resto da tela.

          Quem procura obra tem o filtro da barra lateral, que funciona. */}
      <div className="topbar-right">
        {/* A estrelinha saiu: era um botao sem onClick nenhum. Botao que
            nao faz nada nao e' neutro — a pessoa clica, nada acontece, e
            passa a duvidar do resto dos botoes da tela. */}
        <button className="icon-btn bell"><Bell size={16} /><span className="notif-dot">1</span></button>
        <div className="avatar">PW</div>
      </div>
    </header>
  );
}

const CHAVE_SIDEBAR = "confere:sidebar-recolhida";
const CHAVE_MINHAS = "tkws.so.minhas";
const CHAVE_SQUADS = "tkws.squads.fechados";
const CHAVE_OBRAS_ABERTAS = "confere:obras-abertas";

/* A obra: tres volumes e a linha do chao.

   Vem do desenho que ela mandou — traco fino, volumes angulares em
   perspectiva, linha de terreno atravessando. O original tem ainda as
   linhas tracejadas de construcao e uma diagonal longa; as duas viram
   borrao em 16px, entao ficaram de fora. O que sobrevive da reducao sao
   os tres blocos de alturas diferentes e o chao — e' o suficiente pra
   ler "obra" e pra nao se confundir com o predinho generico de antes.

   Traco 1.25 e nao 2: o desenho dela e' de linha fina, e engrossar aqui
   perderia justamente o que o diferencia dos outros icones do menu. */
function IconeObra({ size = 16, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}
      stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" aria-hidden="true"
      vectorEffect="non-scaling-stroke">
      {/* torre alta, topo inclinado */}
      <path d="M7.4 19V7.1l5.1-2.6V19" />
      {/* volume do meio */}
      <path d="M12.5 19V8.4l4 1.9V19" />
      {/* bloco baixo, com o vinco do telhado */}
      <path d="M16.5 19v-4.3l2.6 1.2V19" />
      {/* a linha do terreno */}
      <path d="M3.5 19h17" strokeLinecap="round" />
    </svg>
  );
}

/* O monograma da Mehoo: o duplo O.

   A marca e' "MEHOO" por extenso, num sans geometrico bem fino — e nome
   por extenso nao cabe em 16px. O que sobrevive da reducao e' o par de
   Os: e' o unico traco da marca que ainda se reconhece pequeno, e as
   letras finas viram um borrao nesse tamanho.

   Em currentColor, e nao no preto da marca: a Mehoo e' um canal do menu
   como os outros, e o icone tem que acender junto quando o item esta
   ativo. O Sienge e' o contrario — la o vermelho E' o reconhecimento. */
function IconeMehoo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.6">
      <ellipse cx="8.4" cy="12" rx="5.6" ry="6.2" />
      <ellipse cx="15.6" cy="12" rx="5.6" ry="6.2" />
    </svg>
  );
}

/* O "S" do Sienge, aproximado.

   Desenhado aqui, e nao baixado: o logo oficial nao esta no projeto, e um
   <img> de URL externa numa barra lateral quebra quando o site de la sai
   do ar. E' uma aproximacao — duas meias-luas encaixadas com o quadrado
   vago no meio, no vermelho da marca. Tendo o SVG oficial, e' so trocar
   o miolo desta funcao.

   Ela recebe `size` porque a barra usa 16px e a tira recolhida tambem —
   um <img> de tamanho fixo destoaria dos outros icones, que sao todos
   traço de 16. */
function IconeSienge({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 3.5H12a5.2 5.2 0 0 0 0 10.4h-.9V10h4.1a5.2 5.2 0 0 0 5.2-5.2v-1a.3.3 0 0 0-.3-.3z" fill="#E30613" />
      <path d="M3.5 20.5H12a5.2 5.2 0 0 0 0-10.4h.9V14H8.8a5.2 5.2 0 0 0-5.2 5.2v1a.3.3 0 0 0 .3.3z" fill="#B3000F" />
    </svg>
  );
}

/* Os cinco modulos, num lugar so: a barra os desenha em duas formas —
   lista com descricao quando aberta, tira de icones quando recolhida — e
   duas copias do mesmo elenco sairiam do ar uma da outra no primeiro
   modulo novo. */
const MODULOS = [
  { id: "inicio", nome: "Início", sub: "o resumo de tudo", Icone: LayoutGrid },
  { id: "novas", nome: "Novas obras", sub: "vindas do Monday", Icone: Sparkle },
  { id: "a_contratar", nome: "Gestão de compras e contratações", sub: "todas as obras", Icone: ClipboardList },
  { id: "aditivos", nome: "Aditivos", sub: "supressão e adição por obra", Icone: FileText },
  { id: "mehoo", nome: "Mehoo", sub: "a obra pelo lado do fornecedor", Icone: IconeMehoo },
  { id: "equipe", nome: "Equipe e acessos", sub: "quem é quem, e o que cada um vê", Icone: ShieldCheck },
  { id: "catalogo", nome: "Catálogo TKWS", sub: "o que a casa especifica", Icone: BookOpen },
  { id: "gerador", nome: "Gerador de códigos Sienge", sub: "associa uma lista avulsa", Icone: IconeSienge },
  { id: "precos", nome: "Banco de Preços", sub: "insumos do Sienge", Icone: DollarSign },
  // Por ultimo: e' o que se abre com menos frequencia — obra concluida
  // ja saiu do dia a dia, e ela estava no meio do caminho do que nao saiu.
  { id: "arquivo", nome: "Arquivo", sub: "obras concluídas", Icone: Archive },
];

/* Um simbolo por squad, pra barra recolhida.

   Com 62px de largura nao cabe "SQUAD COMET", e sem nada as obras de
   tres squads viram uma coluna unica de predinhos iguais. O simbolo e' a
   unica coisa que separa os grupos ali. */
function IconeSquad({ nome, size = 13 }) {
  const t = String(nome || "").toLowerCase();
  if (t.includes("moon")) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.5 15.6A8.6 8.6 0 0 1 9 4.1a1 1 0 0 0-1.4-1.2 10.5 10.5 0 1 0 14 14 1 1 0 0 0-1.1-1.3z" />
    </svg>;
  }
  if (t.includes("sun")) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 1.4v3M12 19.6v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1.4 12h3M19.6 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
        stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
    </svg>;
  }
  if (t.includes("comet")) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="16.5" cy="7.5" r="4" />
      <path d="M12.6 10.8 2.9 20.5a1 1 0 0 0 1.1 1.6l7.5-3a1 1 0 0 0 .5-.4l2.2-3.6z" opacity=".75" />
    </svg>;
  }
  return <Building2 size={size} />;
}

function Sidebar({ obras, selected, onSelect, modulo, onModulo, novasCount, arquivoCount, usuario, equipe, onSair, modulos = MODULOS, pendentesCount = 0 }) {
  /* Início sai da lista dobrável de módulos e vira botão fixo no topo —
     o resto de `modulos` (permissão já aplicada por quem chama) segue
     exatamente como antes, só sem o Início duplicado dentro dele. */
  const inicioModulo = modulos.find((m) => m.id === "inicio");
  const outrosModulos = modulos.filter((m) => m.id !== "inicio");
  /* Guardado, como o resto da barra: quem trabalha so nas suas obras nao
     quer reativar o filtro a cada F5. */
  const [soMinhas, setSoMinhas] = useState(() => {
    try { return localStorage.getItem(CHAVE_MINHAS) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_MINHAS, soMinhas ? "1" : "0"); } catch { /* modo anonimo */ }
  }, [soMinhas]);

  const nMinhas = obras.filter((o) => obraDoGC(o, usuario)).length;

  const [menuPerfil, setMenuPerfil] = useState(false);
  /* Fecha clicando em QUALQUER lugar, e com Esc. Antes so' fechava
     clicando de novo no proprio perfil — ninguem procura o botao que
     abriu pra fechar, procura o vazio ao lado. */
  const menuRef = useRef(null);
  const perfilRef = useRef(null);
  useEffect(() => {
    if (!menuPerfil) return;
    const fora = (e) => {
      if (menuRef.current?.contains(e.target) || perfilRef.current?.contains(e.target)) return;
      setMenuPerfil(false);
    };
    const esc = (e) => { if (e.key === "Escape") setMenuPerfil(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menuPerfil]);
  const meuNome = (equipe || []).find((p) => p.email === usuario)?.nome || nomeDoEmail(usuario);
  const iniciais = (meuNome || usuario || "?").split(/\s+/).slice(0, 2)
    .map((x) => x.charAt(0).toUpperCase()).join("") || "?";

  /* Quais squads estao dobrados. Guardado, porque quem trabalha num squad
     so nao quer dobrar os outros a cada F5. */
  const [fechados, setFechados] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(CHAVE_SQUADS) || "[]")); } catch { return new Set(); }
  });
  const alternarSquad = (nome) => setFechados((g) => {
    const n = new Set(g);
    n.has(nome) ? n.delete(nome) : n.add(nome);
    try { localStorage.setItem(CHAVE_SQUADS, JSON.stringify([...n])); } catch { /* modo anonimo */ }
    return n;
  });
  // Guarda a escolha: quem recolhe quer a tela larga, e ter que recolher
  // de novo a cada F5 e o tipo de atrito que faz a pessoa desistir do
  // recurso.
  const [recolhida, setRecolhida] = useState(() => {
    try { return localStorage.getItem(CHAVE_SIDEBAR) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_SIDEBAR, recolhida ? "1" : "0"); } catch { /* modo anonimo */ }
  }, [recolhida]);

  /* "Obras" dobra dentro da propria barra — nasce ABERTA (o oposto dos
     modulos, de proposito: obra e' o que se abre o dia inteiro, modulo e'
     o que se abre de vez em quando, mesma razao de `modulosAbertos` mais
     abaixo). Guardado, pra quem prefere a barra mais enxuta nao ter que
     fechar de novo a cada F5. */
  const [obrasAbertas, setObrasAbertas] = useState(() => {
    try { return localStorage.getItem(CHAVE_OBRAS_ABERTAS) !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_OBRAS_ABERTAS, obrasAbertas ? "1" : "0"); } catch { /* modo anonimo */ }
  }, [obrasAbertas]);

  /* Modulos nascem SEMPRE fechados, e essa escolha nao e' guardada.

     E' o contrario do resto da barra de proposito: modulo se abre pra ir
     a um lugar e nao se volta pra ele, entao deixar aberto de ontem so
     rouba as linhas que a lista de obras usa hoje. Abrir e' um clique. */
  const [modulosAbertos, setModulosAbertos] = useState(false);
  const alternarModulos = () => setModulosAbertos((v) => !v);

  /* O rotulo do hover, quando a barra esta recolhida.

     Um listener so', delegado na barra inteira, em vez de handler em cada
     um dos vinte botoes. Ele le o proprio `title` do botao — que ja
     existe e ja esta certo em todos — e tira o atributo enquanto o mouse
     esta em cima, pra nao aparecerem dois rotulos: o meu e o do
     navegador, que demora um segundo e fica por cima. */
  const [dica, setDica] = useState(null);
  const barraRef = useRef(null);

  useEffect(() => {
    const el = barraRef.current;
    if (!el) { setDica(null); return; }
    let alvo = null;

    /* A dica valia SO' com a barra recolhida. Mas a tira de modulos e'
       de icones tambem com a barra aberta — nove escudos, caixas e
       cifroes sem rotulo — e ali a pessoa ficava com o `title` do
       navegador, que demora quase um segundo. Foi assim que a Equipe
       ficou impossivel de achar: ela existia, no sexto icone, sem nome
       em lugar nenhum ate alguem abrir o grupo. */
    const entrar = (e) => {
      const b = e.target.closest("[title]");
      if (!b || !el.contains(b) || b === alvo) return;
      if (!recolhida && !b.closest(".nav-tira")) return;
      sair();
      const t = b.getAttribute("title");
      if (!t) return;
      alvo = b;
      b.dataset.tituloGuardado = t;
      b.removeAttribute("title");
      const r = b.getBoundingClientRect();
      setDica({ texto: t, x: r.right + 10, y: r.top + r.height / 2 });
    };
    const sair = () => {
      if (alvo?.dataset.tituloGuardado) {
        alvo.setAttribute("title", alvo.dataset.tituloGuardado);
        delete alvo.dataset.tituloGuardado;
      }
      alvo = null;
      setDica(null);
    };

    el.addEventListener("mouseover", entrar);
    el.addEventListener("mouseleave", sair);
    window.addEventListener("scroll", sair, true);
    return () => {
      el.removeEventListener("mouseover", entrar);
      el.removeEventListener("mouseleave", sair);
      window.removeEventListener("scroll", sair, true);
      sair();
    };
    /* `[recolhida]`, e nao sem lista.

       Sem lista, o efeito se reinstala a cada render — e mostrar a dica
       E' um render. A limpeza rodava logo em seguida e apagava a dica que
       tinha acabado de aparecer: o listener funcionava (chegava a tirar o
       title do botao) e nada aparecia na tela.

       `modulosAbertos` entra junto porque abrir o grupo troca a tira de
       icones por lista com nome: os botoes sao outros, e o listener
       precisa reinstalar pra alcancar os novos. */
  }, [recolhida, modulosAbertos]);



  const [search, setSearch] = useState("");
  const [onlyAlert, setOnlyAlert] = useState(false);
  const [squadFilter, setSquadFilter] = useState("todos");

  const squads = Array.from(new Set(obras.map((o) => o.squad || "Outras obras"))).sort();

  const filtered = obras.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${o.nome} ${o.codigo} ${o.cliente}`.toLowerCase().includes(q);
    const matchesAlert = !onlyAlert || obraAlertCount(o) > 0;
    const matchesSquad = squadFilter === "todos" || (o.squad || "Outras obras") === squadFilter;
    /* Obra SEM GC passa no filtro de propósito: enquanto os vínculos não
       estiverem todos feitos, esconder o que não tem dono deixaria obra
       viva fora da tela de todo mundo. */
    const matchesGC = !soMinhas || !usuario || !o.gc || obraDoGC(o, usuario);
    return matchesSearch && matchesAlert && matchesSquad && matchesGC;
  });

  const groups = {};
  filtered.forEach((o) => {
    const key = o.squad || "Outras obras";
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  });
  const groupNames = Object.keys(groups).sort();

  return (
    <aside className={`sidebar ${recolhida ? "recolhida" : ""}`} ref={barraRef}>
      {dica && (
        <div className="dica-lateral" style={{ left: dica.x, top: dica.y, transform: "translateY(-50%)" }}>
          {dica.texto}
        </div>
      )}
      {/* No TOPO, não no rodapé: recolher é uma decisão que se toma ao
          chegar, e no pé da lista o botão ficava abaixo da dobra em tela
          pequena — existia e ninguém achava. */}
      <button
        className="sidebar-toggle"
        onClick={() => setRecolhida((v) => !v)}
        title={recolhida ? "Expandir menu" : "Recolher menu"}
      >
        {recolhida ? <ChevronRight size={15} /> : <><ChevronLeft size={14} /> <span>Recolher</span></>}
      </button>

      <div className="sidebar-scroll">
        {/* Início e Obras SEMPRE visíveis, no topo — é o que se abre o dia
            inteiro. O resto dos módulos continua dobrado lá embaixo, sem
            mudar em nada (ver `nav-modulos` mais abaixo). */}
        <div className="nav-list nav-list-topo">
          {inicioModulo && (
            <button className={`nav-item ${modulo === "inicio" ? "active" : ""}`}
              onClick={() => onModulo("inicio")} title={inicioModulo.nome}>
              <inicioModulo.Icone size={16} className="nav-icon" />
              <div className="nav-item-text">
                <div className="nav-item-name">{inicioModulo.nome}</div>
              </div>
            </button>
          )}
          <button className="nav-item nav-item-obras" onClick={() => setObrasAbertas((v) => !v)}
            title={obrasAbertas ? "Recolher Obras" : "Abrir Obras"}>
            <Building2 size={16} className="nav-icon" />
            <div className="nav-item-text">
              <div className="nav-item-name">Obras</div>
            </div>
            <span className="nav-count">{obras.length}</span>
            {obrasAbertas
              ? <ChevronDown size={13} className="dim nav-item-chevron" />
              : <ChevronRight size={13} className="dim nav-item-chevron" />}
          </button>
        </div>
        {obrasAbertas && <>
        <div className="obra-search">
          <Search size={13} className="dim" />
          <input placeholder="Filtrar por nome, código, cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="clear-btn" onClick={() => setSearch("")}><X size={12} /></button>}
        </div>

        {/* OS TRES FILTROS NUMA LINHA SO.

            Eram tres formas diferentes pra mesma funcao — chip solto,
            linha de chips, botao de largura inteira com borda — e juntos
            comiam 260px antes da primeira obra aparecer. Numa lista de
            quarenta obras, isso e' a lista inteira empurrada pra fora da
            tela por controles que quase sempre estao no padrao. */}
        <div className="squad-filter">
          <button className={`squad-chip ${soMinhas ? "active" : ""}`}
            onClick={() => setSoMinhas((v) => !v)}
            title={usuario ? `Obras em que ${nomeDoEmail(usuario)} é o GC` : "Entre para filtrar pelas suas obras"}>
            <ShieldCheck size={11} /> Minhas{nMinhas > 0 ? ` · ${nMinhas}` : ""}
          </button>
          <button className={`squad-chip ${onlyAlert ? "active alerta" : ""}`} onClick={() => setOnlyAlert((v) => !v)}
            title="Só as obras com alerta">
            <AlertTriangle size={11} /> Alertas
          </button>
          <span className="chip-sep" />
          {/* "Todos" e' o estado PADRAO — ele deixou de ser o elemento
              mais escuro da barra. Preto so' quando alguem escolheu
              alguma coisa; senao o que grita e' "nada esta filtrado". */}
          <button className={`squad-chip neutro ${squadFilter === "todos" ? "on" : ""}`} onClick={() => setSquadFilter("todos")}>Todos</button>
          {squads.map((s) => (
            <button key={s} className={`squad-chip ${squadFilter === s ? "active" : ""}`} onClick={() => setSquadFilter(s)}
              title={s}>{s.replace(/^Squad\s+/i, "")}</button>
          ))}
        </div>

        <button className={`alert-toggle escondido ${onlyAlert ? "active" : ""}`} onClick={() => setOnlyAlert((v) => !v)}>
          <AlertTriangle size={12} /> Somente com alertas
        </button>

        <div className="scroll-list">
          {obras.length === 0 && (
            <div className="no-results">
              Nenhuma obra iniciada ainda.
              {novasCount > 0 && <> Veja <button className="link-inline" onClick={() => onModulo("novas")}>Novas obras</button>.</>}
            </div>
          )}
          {obras.length > 0 && filtered.length === 0 && <div className="no-results">Nenhuma obra encontrada.</div>}
          {groupNames.map((squadName) => (
            <div key={squadName} className="squad-group">
              {/* O rotulo do squad virou botao: dobrar o que nao se esta
                  tocando e' o jeito mais curto de caber quarenta obras
                  numa coluna. A obra ABERTA nunca fica escondida — dobrar
                  o squad dela faria a barra parar de dizer onde voce
                  esta. */}
              {/* Fecha qualquer um, inclusive o da obra aberta. Tentei
                  segurar o squad da obra atual aberto pra barra nunca
                  parar de dizer onde a pessoa esta — mas isso virou um
                  squad que nao fecha, e um botao que nao faz o que diz e'
                  pior que a informacao que ele protegia. */}
              <button className="squad-group-label" onClick={() => alternarSquad(squadName)}
                title={fechados.has(squadName) ? `Abrir ${squadName}` : `Recolher ${squadName}`}>
                {fechados.has(squadName) ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                {/* Só aparece na barra recolhida, onde o nome não cabe. */}
                <span className="squad-simbolo"><IconeSquad nome={squadName} /></span>
                <span>{squadName} · {groups[squadName].length}</span>
                {/* O ponto avisa que a obra aberta esta ai dentro. */}
                {fechados.has(squadName) && (groups[squadName] || []).some((o) => o.id === selected) && (
                  <span className="squad-tem-aberta" title="A obra aberta está neste squad" />
                )}
              </button>
              {!fechados.has(squadName) && (
              <div className="nav-list">
                {groups[squadName].map((o) => {
                  const alertCount = obraAlertCount(o);
                  const active = selected === o.id;
                  return (
                    <button key={o.id} className={`nav-item ${active ? "active" : ""}`} onClick={() => onSelect(o.id)}
                      /* O numero na frente: e' por ele que a obra e'
                         chamada em pedido, contrato e Sienge, e e' o que a
                         pessoa esta procurando quando passa o mouse. */
                      title={`#${o.codigo} · ${o.nome}`}>
                      <IconeObra size={16} className="nav-icon" />
                      {/* Recolhida, o predio nao informa nada: num app de
                          obra tudo e' predio, e seis linhas viravam seis
                          icones iguais. O CENTRO DE CUSTO e' como a obra
                          e' chamada em pedido, contrato, Sienge e aditivo
                          — quatro digitos cabem nos 62px e dispensam o
                          hover. */}
                      <span className="nav-cod mono">{o.codigo}</span>
                      <div className="nav-item-text">
                        <div className="nav-item-name">{o.nome}</div>
                        {/* A area nunca vem preenchida do Monday, e o "m²"
                            sozinho parecia dado faltando. O squad existe
                            sempre. */}
                        <div className="nav-item-sub mono">#{o.codigo} · {o.squad || "sem squad"}</div>
                      </div>
                      {alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
                    </button>
                  );
                })}
              </div>
              )}
            </div>
          ))}
        </div>
        </>}

        {/* Os modulos ocupavam dez linhas — cinco itens de duas linhas cada
            — e empurravam a lista de obras pra fora da tela. Obra e' o
            que se abre o dia inteiro; modulo e' o que se abre de vez em
            quando. Recolhido eles viram uma tira de icones: uma linha, e
            tudo continua a um clique. */}
        {/* Os modulos moram no PE da barra, colados embaixo. Antes eles
            vinham logo depois da lista de obras e sobrava um vazio grande
            embaixo deles — pareciam soltos no meio da coluna. */}
        <div className="nav-modulos">
        <button className="nav-group-toggle" onClick={alternarModulos}
          title={modulosAbertos ? "Recolher módulos" : "Abrir módulos"}>
          <span>MÓDULOS</span>
          {!modulosAbertos && novasCount > 0 && <span className="nav-badge nav-badge-novo">{novasCount}</span>}
          {modulosAbertos ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {modulosAbertos ? (
          <div className="nav-list">
            {outrosModulos.map((m) => (
              <button key={m.id} className={`nav-item ${modulo === m.id ? "active" : ""}`}
                onClick={() => onModulo(m.id)} title={m.nome}>
                <m.Icone size={16} className="nav-icon" />
                <div className="nav-item-text">
                  <div className="nav-item-name">{m.nome}</div>
                  <div className="nav-item-sub">{m.sub}</div>
                </div>
                {m.id === "novas" && novasCount > 0 && <span className="nav-badge nav-badge-novo">{novasCount}</span>}
                {m.id === "equipe" && pendentesCount > 0 && <span className="nav-badge nav-badge-espera">{pendentesCount}</span>}
                {m.id === "arquivo" && arquivoCount > 0 && <span className="nav-count">{arquivoCount}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="nav-tira">
            {outrosModulos.map((m) => (
              <button key={m.id} className={`nav-tira-item ${modulo === m.id ? "active" : ""}`}
                onClick={() => onModulo(m.id)} title={m.nome}>
                <m.Icone size={16} />
                {m.id === "novas" && novasCount > 0 && <span className="nav-tira-badge">{novasCount}</span>}
                {m.id === "equipe" && pendentesCount > 0 && <span className="nav-tira-badge espera">{pendentesCount}</span>}
              </button>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Era um retrato: nome e e-mail escritos no codigo, e um chevron
          que nao abria nada. Quem entrasse com outra conta via "Priscila
          Wayhs" ali — e nao tinha como sair. */}
      <div className="sidebar-footer">
        {menuPerfil && (
          <div className="perfil-menu" ref={menuRef}>
            <div className="perfil-cab">
              <div className="avatar avatar-sm">{iniciais}</div>
              <div className="perfil-cab-txt">
                <div className="perfil-cab-nome">{meuNome || "Não identificado"}</div>
                <div className="perfil-cab-email">{usuario || "sem sessão"}</div>
              </div>
            </div>
            <div className="perfil-sep" />
            <button className="perfil-sair" onClick={onSair}>
              <LogOut size={14} /> Sair
            </button>
          </div>
        )}
        <button ref={perfilRef} className={`profile ${menuPerfil ? "aberto" : ""}`} onClick={() => setMenuPerfil((v) => !v)}
          title={usuario || "Não identificado"}>
          <div className="avatar avatar-sm">{iniciais}</div>
          <div className="profile-text">
            <div className="profile-name">{meuNome || "Não identificado"}</div>
            <div className="profile-email">{usuario || "sem sessão"}</div>
          </div>
          {menuPerfil ? <ChevronDown size={14} className="dim" /> : <ChevronRight size={14} className="dim" />}
        </button>
      </div>
    </aside>
  );
}



/* APROVAÇÃO DO CLIENTE — o portão entre conferir e comprar.

   Sem este registro o Plano de Compras não libera. Não é burocracia: é
   o que separa "a equipe conferiu" de "o cliente concordou com o que vai
   ser comprado no nome dele". Comprar antes disso é assumir um risco que
   não é da equipe.

   O anexo é a prova. Se uma compra for questionada meses depois, o
   documento assinado precisa estar aqui dentro — não no e-mail de alguém
   que talvez nem trabalhe mais aqui. */
function AssinaturaClienteView({ obra, usuario, onRegistrar, onRemover, podeEditar }) {
  const jaAssinou = !!obra.clienteAssinouEm;
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erroArq, setErroArq] = useState(null);
  const [baixando, setBaixando] = useState(false);
  const inputRef = useRef(null);
  const congelado = obra.comprasLiberadas || !podeEditar;

  /* O documento sobe ANTES de a aprovação ser registrada.

     A ordem importa: se o upload falhar, o registro não acontece e a
     pessoa vê o motivo, em vez de ficar com uma aprovação registrada
     apontando pra um documento que nunca foi guardado. */
  async function registrar() {
    if (!window.confirm(
      `Registrar a aprovação do cliente em ${new Date(data + "T12:00:00").toLocaleDateString("pt-BR")}?\n\n` +
      "Isto libera o Plano de Compras para ser aprovado.\n\n" +
      (arquivo ? `Documento: ${arquivo.name}` : "ATENÇÃO: sem documento anexado.")
    )) return;

    setErroArq(null);
    if (!arquivo) { onRegistrar({ data, obs, arq: null }); return; }

    setEnviando(true);
    try {
      const arq = supabaseConfigurado
        ? await subirArquivo({ obraCodigo: obra.codigo, chave: "assinatura-cliente", file: arquivo, por: usuario })
        : { nome: arquivo.name, tamanhoKB: Math.round(arquivo.size / 1024), url: URL.createObjectURL(arquivo) };
      onRegistrar({ data, obs, arq });
    } catch (err) {
      setErroArq(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function baixarDocumento(arq) {
    if (arq.url) { window.open(arq.url, "_blank"); return; }
    setBaixando(true);
    try {
      window.open(await linkParaBaixar(arq.caminho), "_blank");
    } catch (err) {
      setErroArq(err.message);
    } finally {
      setBaixando(false);
    }
  }

  if (jaAssinou) {
    const arq = obra.clienteAssinaturaArq;
    return (
      <div className="assinatura-ok">
        <div className="assinatura-selo"><ShieldCheck size={22} /></div>
        <div className="assinatura-corpo">
          <div className="assinatura-titulo">Projeto executivo aprovado pelo cliente</div>
          <div className="assinatura-linha">
            Assinado em <b>{new Date(obra.clienteAssinouEm + "T12:00:00").toLocaleDateString("pt-BR")}</b>
            {obra.clienteAssinaturaPor && <> · registrado por <b>{obra.clienteAssinaturaPor}</b></>}
          </div>
          {obra.clienteAssinaturaObs && <div className="assinatura-obs">{obra.clienteAssinaturaObs}</div>}
          {arq && (
            <div className="assinatura-arq">
              <FileText size={13} /> {arq.nome}
              {arq.tamanhoKB ? <span className="dim"> · {arq.tamanhoKB} KB</span>
                : arq.tamanho ? <span className="dim"> · {(arq.tamanho / 1024).toFixed(0)} KB</span> : null}
              {anexoRecuperavel(arq)
                ? <button className="caderno-acao" onClick={() => baixarDocumento(arq)} disabled={baixando}>
                    <Download size={12} /> {baixando ? "Abrindo…" : "Baixar"}
                  </button>
                /* Registro de antes de o app guardar o arquivo: ficou o
                   nome, não a prova. Some quando um novo for anexado. */
                : <span className="assinatura-sem-arq"><AlertTriangle size={13} /> só o nome ficou guardado</span>}
            </div>
          )}
          {!arq && <div className="assinatura-sem-arq"><AlertTriangle size={13} /> Registrado sem o documento anexado.</div>}
          {erroArq && <div className="assinatura-sem-arq"><AlertTriangle size={13} /> {erroArq}</div>}
        </div>
        {!congelado && (
          <button className="btn-limpar-import" onClick={() => {
            if (window.confirm(
              "Remover o registro de aprovação do cliente?\n\n" +
              "O Plano de Compras volta a ficar bloqueado até um novo registro."
            )) onRemover();
          }}><Trash2 size={13} /> Remover</button>
        )}
      </div>
    );
  }

  return (
    <div className="assinatura-form">
      <div className="import-bar" style={{ marginBottom: 14 }}>
        <div className="import-info">
          <Lock size={14} />
          <span>O <b>Plano de Compras não libera</b> enquanto o cliente não aprovar o projeto executivo. Registre aqui a assinatura.</span>
        </div>
      </div>

      <div className="flat-panel">
        <div className="flat-panel-header">
          <div>
            <div className="flat-panel-title">Registrar aprovação do cliente</div>
            <div className="flat-panel-sub">Data em que o cliente assinou, mais o documento assinado.</div>
          </div>
        </div>

        <div className="assinatura-campos">
          <label className="campo">
            <span className="campo-rotulo">Data da assinatura</span>
            <input type="date" value={data} disabled={congelado}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setData(e.target.value)} />
          </label>

          <label className="campo campo-largo">
            <span className="campo-rotulo">Observação <span className="dim">(opcional)</span></span>
            <input type="text" value={obs} disabled={congelado} placeholder="ex: assinado na reunião de 12/08, com ressalva no item 7.3"
              onChange={(e) => setObs(e.target.value)} />
          </label>

          <div className="campo campo-largo">
            <span className="campo-rotulo">Documento assinado</span>
            <div className="assinatura-upload">
              <button className="btn-import" disabled={congelado} onClick={() => inputRef.current?.click()}>
                <Upload size={13} /> {arquivo ? "Trocar arquivo" : "Anexar documento"}
              </button>
              <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setArquivo(f); }} />
              {arquivo
                ? <span className="assinatura-arq"><FileText size={13} /> {arquivo.name} <span className="dim">· {(arquivo.size / 1024).toFixed(0)} KB</span></span>
                : <span className="dim">Nenhum arquivo escolhido</span>}
            </div>
          </div>
        </div>

        <div className="assinatura-acoes">
          {!arquivo && (
            <span className="assinatura-aviso">
              <AlertTriangle size={13} /> Sem o documento anexado o registro vale, mas fica sem prova.
            </span>
          )}
          {erroArq && <span className="assinatura-aviso"><AlertTriangle size={13} /> {erroArq}</span>}
          <button className="btn-liberar" disabled={congelado || !data || enviando} onClick={registrar}>
            <ShieldCheck size={14} /> {enviando ? "Guardando documento…" : "Registrar aprovação"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* A esteira da obra em dois niveis.

   Antes eram oito abas numa fila so, todas com o mesmo peso visual: o
   contrato que se le uma vez no comeco ficava do lado do diario que se
   usa todo dia, e nada dizia onde a obra estava. Agora o primeiro nivel
   separa por MOMENTO (planejar / executar) e o segundo mostra a fila
   daquele momento, com o que ja foi cumprido marcado.

   ETAPAS_PLANEJAMENTO esta na ordem real do processo — e essa ordem que
   define o "anterior" de cada etapa. */
const GRUPOS_OBRA = [
  { id: "dashboard", label: "Visão geral", icon: LayoutGrid },
  { id: "planejamento", label: "Planejamento", icon: ClipboardList },
  { id: "execucao", label: "Execução", icon: Building2 },
  // Sem etapas: nao e' esteira, e' o armario da obra. Por isso ele nao
  // mostra progresso "0/2" — nao ha nada a concluir aqui.
  { id: "arquivos", label: "Documentos", icon: Archive },
];

const ETAPAS_PLANEJAMENTO = [
  { id: "vendido_contrato", label: "Vendido Contrato", icon: FileText },
  { id: "vendido_planilha", label: "Vendido Planilha", icon: FileText },
  { id: "vendido_conferencia", label: "Depara Contrato × Planilha", icon: GitCompare },
  { id: "executivo", label: "Executivo", icon: BookOpen },
  { id: "executivo_conferencia", label: "Conf. Executivo", icon: GitCompare },
  { id: "assinatura_cliente", label: "Aprovação do Cliente", icon: ShieldCheck },
  { id: "comparativo", label: "Plano de Compras", icon: LayoutGrid },
  { id: "compras", label: "Compras de Produtos", icon: ShoppingCart },
];

const ETAPAS_EXECUCAO = [
  { id: "contratos", label: "Contratos", icon: Link2 },
  { id: "diario", label: "Diário de Obra", icon: BookOpen },
];

const ETAPAS_POR_GRUPO = { planejamento: ETAPAS_PLANEJAMENTO, execucao: ETAPAS_EXECUCAO };

/* Etapas que usam o botão genérico de concluir.

   Fora dela ficam Depara, Aprovação do Cliente e Plano de Compras: cada
   uma já tem seu ato próprio (liberar o CMV, registrar a assinatura,
   liberar as compras), que grava quem e quando. Um segundo botão criaria
   duas verdades sobre o mesmo fato. */
const ETAPAS_COM_CONCLUSAO = new Set([
  "vendido_contrato", "vendido_planilha", "executivo", "executivo_conferencia", "compras", "contratos",
]);

/* Uma etapa esta concluida quando alguem disse que esta.

   Tres delas nao usam o botao generico, porque ja tinham um ato proprio
   que grava quem e quando — registrar de novo criaria duas verdades
   sobre o mesmo fato:
     Depara            -> liberacao do CMV
     Aprovacao Cliente -> registro da assinatura
     Plano de Compras  -> liberacao das compras */
function etapaConcluida(id, obra) {
  if (id === "vendido_conferencia") return !!obra.deparaAprovado;
  if (id === "assinatura_cliente") return !!obra.clienteAssinouEm;
  if (id === "comparativo") return !!obra.comprasLiberadas;
  return !!(obra.etapasConcluidas || {})[id];
}

function quemConcluiu(id, obra) {
  if (id === "vendido_conferencia") return { por: obra.cmvLiberadoPor, em: obra.cmvLiberadoEm };
  if (id === "assinatura_cliente") return { por: obra.clienteAssinaturaPor, em: obra.clienteAssinouEm };
  return (obra.etapasConcluidas || {})[id] || {};
}

function TabBar({ tab, onChange, obra, grupo, onGrupo }) {
  const etapas = ETAPAS_POR_GRUPO[grupo] || [];

  return (
    <div className="nav-obra">
      <div className="nav-grupos">
        {GRUPOS_OBRA.map((g) => {
          const Icon = g.icon;
          const lista = ETAPAS_POR_GRUPO[g.id];
          const feitas = lista ? lista.filter((e) => etapaConcluida(e.id, obra)).length : 0;
          return (
            <button key={g.id} className={`nav-grupo ${grupo === g.id ? "active" : ""}`} onClick={() => onGrupo(g.id)}>
              <Icon size={15} /> {g.label}
              {lista && <span className="nav-grupo-progresso">{feitas}/{lista.length}</span>}
            </button>
          );
        })}
      </div>

      {etapas.length > 0 && (
        <div className="tabbar">
          {etapas.map((t, i) => {
            const Icon = t.icon;
            const feita = etapaConcluida(t.id, obra);
            // Travada enquanto a etapa anterior nao foi cumprida: a esteira
            // so anda pra frente, e pular etapa e o que gera compra sem
            // conferencia.
            const anterior = etapas[i - 1];
            const travada = grupo === "planejamento" && anterior && !etapaConcluida(anterior.id, obra);
            return (
              <button key={t.id}
                className={`tab ${tab === t.id ? "active" : ""} ${feita ? "feita" : ""} ${travada ? "travada" : ""}`}
                onClick={() => onChange(t.id)}
                title={travada ? `Conclua "${anterior.label}" primeiro` : undefined}>
                {feita ? <CheckCircle2 size={14} className="tab-check" /> : <Icon size={14} />}
                {t.label}
                {travada && <Lock size={11} className="dim" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MÓDULO COMPRAS → SIENGE
   Visão do comprador: só os PRODUTOS liberados, recortados pelo que
   falta a ação dele (lançar no Sienge). O fluxo do produto é:
   liberado p/ compra → lançado no Sienge → comprado.
   ============================================================ */

// achata os produtos de todas as verbas, guardando os índices pra edição

/* Tudo que e MATERIAL na obra.

   A lista era `it.tipo === "produto"` — o mesmo campo de UMA escolha que
   ja tinha escondido a mao de obra do spot na tela de Contratos. Aqui o
   erro e o espelho: item marcado como servico com material lancado nunca
   aparecia pra comprar.

   Entra quem TEM parcela de material, e o valor que viaja e a PARCELA. */
function produtosMAT(obra) {
  const out = [];
  (obra.categorias || []).forEach((cat, catIdx) => {
    (cat.itens || []).forEach((it, itemIdx) => {
      if (it.ehTitulo) return;
      const { material } = parcelasDoItem(it, cat);
      const aloc = alocacaoDoItem(it, cat);
      if (material <= 0 && aloc !== ALOC_MAT) return;
      out.push({ it, catIdx, itemIdx, catNum: cat.num, catNome: cat.nome, material, aloc,
        chave: `${catIdx}-${itemIdx}` });
    });
  });
  return out;
}

/* GERADOR DE CÓDIGOS SIENGE — avulso, sem obra e sem gravar nada.

   Mesma associação da tela de Compras de Produtos, mas solta: sobe uma
   lista qualquer de produtos, ela casa com os insumos já cadastrados e
   diz quais não existem — com a descrição no padrão pronta pra copiar.

   NADA e' guardado. O arquivo e' lido na memoria e some ao sair da tela,
   de proposito: isto e uma ferramenta de consulta pra quem esta
   cadastrando no Sienge, nao um cadastro paralelo. Guardar criaria uma
   segunda verdade sobre quais insumos existem, e a verdade e' o Sienge. */
function GeradorSiengeView() {
  const [baseSienge, setBaseSienge] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [linhas, setLinhas] = useState(null);   // o que veio do arquivo
  const [arquivo, setArquivo] = useState(null);
  const [escolhas, setEscolhas] = useState(() => new Map());
  /* A mae escolhida por linha.

     Ela TEM que existir na base: o Sienge nao aceita insumo que nao esta
     la, e o template so serve pra cadastrar DETALHE dentro de um insumo
     que ja existe. Por isso a escolha e' sempre um item da base — nunca
     texto digitado. */
  const [maesEscolhidas, setMaesEscolhidas] = useState(() => new Map());
  /* O fornecedor vale pro arquivo inteiro: a cotacao e' de uma casa so, e
     digitar o mesmo nome em cada linha seria repetir a mesma informacao
     dezenas de vezes. Ele abre o detalhe gerado. */
  const [fornecedor, setFornecedor] = useState("");
  /* ...mas nem toda planilha e' de uma casa so'. A planilha de detalhes
     da obra traz UM fornecedor POR LINHA, numa coluna lateral. Sao dois
     mundos diferentes: cotacao (um fornecedor) e planilha de detalhes
     (varios). O modo diz de qual estamos falando. */
  const [modoForn, setModoForn] = useState("mesmo");
  // Fornecedor e ambiente tem o mesmo formato; se o palpite trocou os
  // dois, um clique desfaz — mais rapido que arrumar a planilha.
  const [trocado, setTrocado] = useState(false);
  /* O descritivo gerado e' um bom palpite, nao uma sentenca: o Sienge tem
     manias que o arquivo nao conta (abreviacao da casa, ordem de cor e
     modelo). Editado a mao, o texto manda — mas so ate a pessoa desfazer,
     e dai ele volta a acompanhar o fornecedor que estiver la em cima. */
  const [descritos, setDescritos] = useState(() => new Map());
  /* Os dois codigos do template. O auxiliar sai do arquivo; o codigo do
     detalhe o arquivo nunca traz — quem numera e' o Sienge, e a base que
     eu carrego nao guarda o numero do detalhe, so a descricao. Deixar os
     dois digitaveis aqui e' o que permite baixar o CSV pronto em vez de
     baixar, abrir no Excel e completar do lado de fora. */
  const [codAux, setCodAux] = useState(() => new Map());
  // Quais auxiliares foram SORTEADOS: numero inventado tem que se
  // anunciar, senao vira dado de verdade na cabeca de quem confere.
  const [auxSorteado, setAuxSorteado] = useState(() => new Set());
  const [codDet, setCodDet] = useState(() => new Map());

  // A base carrega sozinha: sem ela a tela nao faz nada, e pedir um
  // clique pra habilitar a unica funcao da tela e' cerimonia.
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    carregarTodosInsumos()
      .then((b) => { if (vivo) { setBaseSienge(b); if (!b.length) setErro("A base de insumos do Sienge está vazia — importe o relatório em Banco de Preços."); } })
      .catch((e) => { if (vivo) setErro(`Não consegui ler a base de insumos: ${e.message || e}`); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  const grupos = useMemo(() => (baseSienge ? agruparPorMae(baseSienge) : null), [baseSienge]);

  const casados = useMemo(() => {
    if (!grupos || !linhas) return [];
    return linhas.map((l, i) => {
      const maes = acharMaes(l.desc, grupos);
      const melhor = maes[0] || null;
      return { i, ...l, maes, detalhes: melhor ? ordenarDetalhes(l.desc, melhor.grupo) : [] };
    });
  }, [grupos, linhas]);

  async function lerArquivo(file) {
    if (!file) return;
    setErro(null);
    try {
      let lidas;
      if (/\.pdf$/i.test(file.name)) {
        /* PDF passa pelo servidor so pra virar texto — quem interpreta e
           o cliente, igual ao leitor de pedido do Sienge. */
        const texto = await textoDoPDF(await file.arrayBuffer());
        /* Dois formatos de PDF, e a ordem importa: o "Insumos Orcados" do
           Sienge tem estrutura conhecida e e' testado primeiro. Nao sendo
           ele, tenta como cotacao de fornecedor — que e' o caso solto,
           onde cada fornecedor faz do seu jeito. */
        lidas = lerListaDeProdutosPDF(texto);
        if (!lidas.length) lidas = lerCotacaoPDF(texto);
        if (!lidas.length) throw new Error("Não reconheci este PDF — nem como \"Insumos Orçados\" do Sienge, nem como cotação de fornecedor. Me manda o arquivo que eu ajusto o leitor.");
      } else {
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const brutas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
        lidas = lerListaDeProdutos(brutas);
        if (!lidas.length) throw new Error("Não achei descrição de produto neste arquivo. Se tiver cabeçalho, a coluna pode se chamar Descrição, Insumo, Produto ou Item; se não tiver, eu procuro sozinho a coluna com as descrições — mas aqui não encontrei nenhuma. Me manda o arquivo que eu ajusto o leitor.");
      }
      /* Sorteio na LEITURA, e nao na hora de montar o CSV: assim o numero
         que a pessoa ve na tela e' o mesmo que sai no arquivo, e ele nao
         muda a cada re-render. */
      const sorteados = sortearAuxiliares(lidas);
      setLinhas(lidas);
      setArquivo(file.name);
      setEscolhas(new Map());
      setCodAux(sorteados);
      setAuxSorteado(new Set(sorteados.keys()));
      setCodDet(new Map());
      setDescritos(new Map());
      /* O modo se escolhe pelo ARQUIVO. Quem sobe uma planilha com dois
         ou mais fornecedores na coluna quer os dois ou mais; deixar o
         padrao em "mesmo fornecedor" faria ela subir o arquivo, nao ver
         diferenca nenhuma, e concluir que a funcao nao existe. */
      const fornsLidos = new Set(lidas.map((l) => l.fornecedor).filter(Boolean));
      setModoForn(fornsLidos.size > 1 ? "planilha" : "mesmo");
      setTrocado(false);
    } catch (e) {
      setErro(`Não consegui ler o arquivo: ${e.message || e}`);
      setLinhas(null);
    }
  }

  /* desc == null e' a escolha POSITIVA de "cadastrar como detalhe novo".
     Nao e' o mesmo que clicar de novo na variante ja marcada, mas as duas
     terminam igual: sem variante escolhida, a linha vai pra planilha. */
  const escolher = (i, desc) => setEscolhas((m) => {
    const n = new Map(m);
    if (desc == null || n.get(i) === desc) n.delete(i); else n.set(i, desc);
    return n;
  });

  const comMae = (c) => maesEscolhidas.has(c.i) || c.maes.length > 0;

  /* Os campos laterais, ja' considerando a troca. */
  const lateraisDe = useCallback((c) => (trocado
    ? { fornecedor: c.ambiente, ambiente: c.fornecedor }
    : { fornecedor: c.fornecedor, ambiente: c.ambiente }), [trocado]);

  const geradoDe = useCallback((c) => descricaoSienge({
    fornecedor: modoForn === "planilha" ? lateraisDe(c).fornecedor : fornecedor,
    marca: c.marca, desc: c.desc, modelo: c.modelo,
    cor: c.cor, especificacao: c.especificacao, codigo: c.codigo,
  }), [fornecedor, modoForn, lateraisDe]);

  /* Quais fornecedores a planilha trouxe. Serve de prova: se aqui
     aparecer "Living, Dormitório", o palpite pegou a coluna errada e o
     botao de trocar esta' logo do lado. */
  const fornsDaPlanilha = useMemo(() => {
    const v = (linhas || []).map((l) => lateraisDe(l).fornecedor).filter(Boolean);
    return [...new Set(v)];
  }, [linhas, lateraisDe]);
  const temLaterais = useMemo(
    () => (linhas || []).some((l) => l.ambiente || l.fornecedor), [linhas]);
  const descritoDe = useCallback((c) => {
    const meu = descritos.get(c.i);
    return meu != null ? meu : geradoDe(c);
  }, [descritos, geradoDe]);
  const auxDe = useCallback((c) => {
    const meu = codAux.get(c.i);
    return meu != null ? meu : codigoAuxiliarDe(c);
  }, [codAux]);
  const detDe = useCallback((c) => codDet.get(c.i) || "", [codDet]);
  const achados = casados.filter(comMae).length;
  const semMae = casados.length - achados;

  /* O template do Sienge so interessa pro que NAO existe la — o resto ja
     esta cadastrado e reimportar criaria duplicata. Item onde a pessoa
     escolheu uma variante tambem sai fora: escolher significa "e' este
     que ja existe". */
  const paraCadastrar = useMemo(() => casados
    .filter((c) => !escolhas.get(c.i))
    .map((c) => {
      const esc = maesEscolhidas.get(c.i);
      const mae = (esc ? (grupos || []).find((g) => g.codigo === esc) : null) || c.maes[0]?.grupo || null;
      return {
        i: c.i,
        maeCodigo: mae?.codigo || "",
        maeNome: mae?.nome || "",
        codigoDetalhe: detDe(c),
        codigoAuxDetalhe: auxDe(c),
        descricaoDetalhe: descritoDe(c),
        produtoFiscal: "",
      };
    }), [casados, escolhas, maesEscolhidas, grupos, descritoDe, auxDe, detDe]);

  const incompletas = paraCadastrar.filter((l) => faltaNoTemplate(l).length).length;

  function baixarTemplate() {
    const csv = montarTemplateSienge(paraCadastrar);
    downloadFile(
      `sienge-importacao-detalhes-${(arquivo || "lista").replace(/\.[^.]+$/, "")}.csv`,
      csv, "text/csv;charset=utf-8;");
  }

  /* A conferencia e' pra LER, nao pra importar: aqui cabe o que ajuda a
     pessoa a conferir — quantidade e unidade inclusive. O template do
     Sienge nao muda por causa disso; la a regra da casa proibe coluna
     nova, e sao arquivos com destinos diferentes. */
  function baixarResultado() {
    const cab = [["Descrição do arquivo", "Qtd.", "Un.", "Marca", "Insumo mãe (cód.)", "Insumo mãe", "Variante escolhida", "Situação", "Descrição pra cadastrar"]];
    const corpo = casados.map((c) => {
      const esc = maesEscolhidas.get(c.i);
      const mae = (esc ? (grupos || []).find((g) => g.codigo === esc) : null) || c.maes[0]?.grupo;
      const escolhida = escolhas.get(c.i) || null;
      return [
        c.desc,
        // Numero de verdade, nao texto: assim a coluna soma no Excel.
        typeof c.qtd === "number" ? c.qtd : "",
        c.un || "",
        c.marca || "", mae?.codigo || "", mae?.nome || "", escolhida || "",
        !mae ? "cadastrar" : escolhida ? "associado" : "escolher variante",
        !mae || !escolhida ? descritoDe(c) : "",
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([...cab, ...corpo]);
    ws["!cols"] = [{ wch: 52 }, { wch: 7 }, { wch: 6 }, { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 48 }, { wch: 18 }, { wch: 56 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Códigos Sienge");
    XLSX.writeFile(wb, `codigos-sienge-${(arquivo || "lista").replace(/\.[^.]+$/, "")}.xlsx`);
  }

  return (
    <>
      <div className="ger-topo">
        <label className="btn-doc">
          <Upload size={13} /> {linhas ? "Trocar arquivo" : "Subir lista de produtos"}
          <input type="file" accept=".xlsx,.xlsm,.xls,.csv,.pdf" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; lerArquivo(f); }} />
        </label>
        {linhas && (
          <div className="ger-forn">
            <div className="ger-modo">
              <button className={modoForn === "mesmo" ? "on" : ""}
                onClick={() => setModoForn("mesmo")}>Mesmo fornecedor</button>
              <button className={modoForn === "planilha" ? "on" : ""}
                onClick={() => setModoForn("planilha")}
                disabled={!temLaterais}
                title={temLaterais ? "Cada linha usa o fornecedor da própria coluna"
                  : "Esta planilha não trouxe uma coluna de fornecedor"}>
                Vários fornecedores
              </button>
            </div>
            {modoForn === "mesmo" ? (
              <input className="form-input" type="text" value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                placeholder="ex: Macrosul"
                title="Abre o descritivo de todas as linhas" />
            ) : (
              <span className="ger-forn-lidos">
                {fornsDaPlanilha.length
                  ? <>{fornsDaPlanilha.length} da planilha: <b>{fornsDaPlanilha.slice(0, 3).join(", ")}</b>
                      {fornsDaPlanilha.length > 3 && `, +${fornsDaPlanilha.length - 3}`}</>
                  : "nenhum fornecedor lido"}
                <button className="ger-trocar-col" onClick={() => setTrocado((v) => !v)}
                  title="Fornecedor e ambiente têm o mesmo formato — se vieram trocados, isto desfaz">
                  trocar com ambiente
                </button>
              </span>
            )}
          </div>
        )}
        <span className="ger-info">
          {carregando ? "Carregando a base do Sienge…"
            : baseSienge ? `${baseSienge.length.toLocaleString("pt-BR")} insumos cadastrados no Sienge`
            : "Base do Sienge indisponível"}
          {arquivo && ` · ${arquivo}`}
        </span>
        {linhas && <button className="btn-doc" onClick={baixarResultado}><Download size={13} /> Conferência (Excel)</button>}
        {linhas && paraCadastrar.length > 0 && (
          <button className="btn-doc btn-template" onClick={baixarTemplate}
            title="Template de importação de detalhes do Sienge, em CSV — sobe direto lá">
            <Download size={13} /> Template Sienge para cadastro de detalhe ({paraCadastrar.length})
          </button>
        )}
      </div>

      {/* Colado no cartao de propósito: nada pode entrar no meio dos
          dois, nem um aviso de erro, senao a emenda abre. */}
      {!linhas && (
        <div className="sg-formatos">
          <dl>
            <div>
              <dt>Excel ou CSV</dt>
              <dd>uma coluna de descrição basta. Marca, modelo, cor e código entram na descrição
                gerada, se existirem.</dd>
            </div>
            <div>
              <dt>Sem cabeçalho serve</dt>
              <dd>acho sozinho a coluna das descrições e, junto dela, modelo, quantidade e unidade.
                Título de grupo não vira produto.</dd>
            </div>
            <div>
              <dt>PDF</dt>
              <dd>o relatório “Insumos Orçados” do Sienge, ou cotação de fornecedor.</dd>
            </div>
          </dl>
          <p className="sg-formatos-nota">Nada é guardado: o arquivo é lido aqui e some quando você sair.</p>
        </div>
      )}

      {erro && <div className="aviso-migracao"><AlertTriangle size={14} /> <span>{erro}</span></div>}

      {linhas && (
        <>
          <div className="ger-placar">
            <div className="cf-bloco ok"><div className="cf-n">{achados}</div><div className="cf-rot">já existem no Sienge</div></div>
            <div className={`cf-bloco ${semMae ? "ruim" : "ok"}`}><div className="cf-n">{semMae}</div><div className="cf-rot">precisam ser cadastrados</div></div>
            <div className="cf-bloco aviso"><div className="cf-n">{paraCadastrar.length}</div><div className="cf-rot">vão pra planilha</div></div>
          </div>
          {/* O template exige tres campos, e um deles o Sienge e' quem
              numera. Dizer QUANTAS linhas vao sair incompletas, antes de
              baixar, evita a pessoa subir o arquivo e ser recusada la. */}
          {incompletas > 0 && (
            <div className="aviso-migracao">
              <AlertTriangle size={14} />
              <span>
                <b>{incompletas}</b> {incompletas === 1 ? "linha vai sair incompleta" : "linhas vão sair incompletas"} no
                template — o Sienge exige código do insumo, código do detalhe e código auxiliar, e o
                <b> código do detalhe é ele quem numera</b>. Baixe, preencha as colunas vazias e suba.
              </span>
            </div>
          )}
          <div style={{ display: "none" }}>
          </div>

          <div className="grp-block">
            <div className="grp-itens">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Produto do arquivo</th>
                    <th style={{ width: 320 }}>Insumo no Sienge</th>
                  </tr>
                </thead>
                <tbody>
                  {casados.map((c) => (
                    <LinhaGerador key={c.i} linha={c} escolhida={escolhas.get(c.i)}
                      onEscolher={(d) => escolher(c.i, d)}
                      grupos={grupos}
                      maeEscolhida={maesEscolhidas.get(c.i)}
                      descrito={descritoDe(c)}
                      aux={auxDe(c)} codDet={detDe(c)} auxSorteado={auxSorteado.has(c.i)}
                      onAux={(v) => {
                        setCodAux((m) => new Map(m).set(c.i, v));
                        setAuxSorteado((g) => { const n = new Set(g); n.delete(c.i); return n; });
                      }}
                      onCodDet={(v) => setCodDet((m) => new Map(m).set(c.i, v))}
                      editado={descritos.has(c.i)}
                      onDescrito={(txt) => setDescritos((m) => {
                        const n = new Map(m);
                        if (txt == null) n.delete(c.i); else n.set(c.i, txt);
                        return n;
                      })}
                      onMae={(cod) => setMaesEscolhidas((m) => {
                        const n = new Map(m);
                        cod ? n.set(c.i, cod) : n.delete(c.i);
                        return n;
                      })} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* Uma linha do gerador: escolher a MAE, depois a variante.

   A mae vem SEMPRE da base — o Sienge nao aceita insumo que nao existe
   la, e o template so cadastra detalhe DENTRO de um insumo existente.
   Por isso nao ha campo de texto livre aqui: ou e' uma das candidatas,
   ou e' uma achada na busca, e as duas saem da mesma base. */
function LinhaGerador({ linha, escolhida, onEscolher, grupos, maeEscolhida, onMae, descrito, editado, onDescrito, aux, codDet, onAux, onCodDet, auxSorteado }) {
  const [buscando, setBuscando] = useState(false);
  const [termo, setTermo] = useState("");

  const candidatas = linha.maes.map((x) => x.grupo);
  const mae = (maeEscolhida ? (grupos || []).find((g) => g.codigo === maeEscolhida) : null)
    || candidatas[0] || null;

  /* A busca varre a base inteira, nao so as candidatas: quando o
     casamento automatico nao acha nada, e' aqui que a pessoa resolve. */
  const achadas = useMemo(() => {
    const t = normSienge(termo);
    if (t.length < 2) return [];
    return (grupos || [])
      .filter((g) => normSienge(g.nome).includes(t) || String(g.codigo).includes(t))
      .slice(0, 8);
  }, [termo, grupos]);

  return (
    <tr className={mae ? (escolhida ? "row-comprado" : "") : "row-falta"}>
      <td className="mono dim">{linha.i + 1}</td>
      <td>
        <div className="item-desc">{linha.desc}</div>
        {/* Tudo que a planilha trouxe sobre o item, logo abaixo do nome:
            fornecedor e ambiente na frente, porque sao o que situa a
            linha, e a especificacao depois, que e' o texto longo. */}
        {(linha.fornecedor || linha.ambiente || linha.marca || linha.codigo
          || linha.qtd != null || linha.especificacao) && (
          <div className="det-espec">
            {linha.fornecedor && <span className="det-forn">{linha.fornecedor}</span>}
            {linha.ambiente && <span className="det-amb">{linha.ambiente}</span>}
            <span>
              {[linha.qtd != null ? `${linha.qtd} ${linha.un || ""}`.trim() : null,
                linha.marca, linha.modelo, linha.cor, linha.codigo,
                linha.especificacao].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}
      </td>
      <td>
        <div className="detalhe-cel">
          {/* A MAE, sempre da base. */}
          {mae ? (
            <div className={`mae-cel casa-${escolhida ? "exato" : "aproximado"}`}>
              <span className="casa-bola" />
              <div className="mae-txt">
                <span className="mae-cod mono">{mae.codigo}</span>
                <span className="mae-nome">{mae.nome}</span>
              </div>
              {candidatas.length > 1 && !buscando && (
                <>
                  <ChevronDown size={12} className="mae-seta" />
                  <select className="mae-sel" value={mae.codigo}
                    onChange={(e) => onMae(e.target.value)}
                    aria-label="Insumo mãe no Sienge">
                    {candidatas.map((g) => (
                      <option key={g.codigo} value={g.codigo}>{g.codigo} · {g.nome}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          ) : (
            <div className="casa casa-sem"><span className="casa-bola" /> sem insumo mãe — escolha um</div>
          )}

          {/* Procurar outra: e' o caminho quando o casamento automatico
              erra ou nao acha, e ele nao pode faltar — sem ele a pessoa
              fica presa com a sugestao errada. */}
          {!buscando ? (
            <button className="ger-trocar" onClick={() => setBuscando(true)}>
              <Search size={10} /> {mae ? "trocar o insumo mãe" : "procurar o insumo mãe"}
            </button>
          ) : (
            <div className="ger-busca">
              <input className="form-input" autoFocus value={termo} placeholder="nome ou código do insumo…"
                onChange={(e) => setTermo(e.target.value)} />
              {achadas.map((g) => (
                <button key={g.codigo} className="det-opcao"
                  onClick={() => { onMae(g.codigo); setBuscando(false); setTermo(""); }}>
                  <span className="mono det-falta">{g.codigo}</span>
                  <span className="det-opcao-txt">{g.nome}</span>
                  <span className="det-bate">{g.variantes.length}</span>
                </button>
              ))}
              {termo.length >= 2 && achadas.length === 0 && (
                <span className="dim" style={{ fontSize: 11 }}>Nenhum insumo com esse nome na base do Sienge.</span>
              )}
              <button className="ger-trocar" onClick={() => { setBuscando(false); setTermo(""); }}>cancelar</button>
            </div>
          )}

          {/* A ESCOLHA. Antes ela era invisivel: quem marcava uma variante
              tirava a linha da planilha sem nada dizer isso, e quem nao
              marcava nada mandava a linha pra planilha tambem sem nada
              dizer. Agora as opcoes sao um radio so — as que ja existem no
              Sienge e a nova — e a marcada e' a que vale. */}
          <div className="det-escolha">
            <div className="det-escolha-rot">
              qual descrição vai pra planilha
              <span className={escolhida ? "det-selo-fora" : "det-selo-vai"}>
                {escolhida ? "já cadastrada — fica de fora" : "a nova, abaixo"}
              </span>
            </div>

            {mae && ordenarDetalhes(linha.desc, mae).slice(0, 4).map((d, k) => (
              <button key={d.insumo.descricao + k}
                className={`det-opcao ${escolhida === d.insumo.descricao ? "escolhida" : ""}`}
                onClick={() => onEscolher(d.insumo.descricao)} title={d.insumo.descricao}>
                <span className="det-radio" />
                <span className="det-opcao-txt">{d.insumo.detalhe}</span>
                {d.faltaram.length > 0
                  ? <span className="det-falta">falta {d.faltaram.slice(0, 3).join(", ")}</span>
                  : <span className="det-bate">bate tudo</span>}
              </button>
            ))}

            <div className={`det-nova ${escolhida ? "fora" : "escolhida"}`}>
              <button className={`det-opcao ${escolhida ? "" : "escolhida"}`}
                onClick={() => onEscolher(null)}
                title="Usar a descrição gerada — é ela que preenche o template do Sienge">
                <span className="det-radio" />
                <span className="det-opcao-txt">cadastrar como detalhe novo</span>
                {editado && <span className="det-falta">editada à mão</span>}
              </button>
              <div className="padrao-cel">
                {/* Textarea, e nao um <code> com botao de editar: quem confere
                    cinquenta linhas nao quer dois cliques por linha. */}
                <textarea className="padrao-txt padrao-edit" value={descrito} rows={2}
                  spellCheck={false} aria-label="Descrição do detalhe no Sienge"
                  onChange={(e) => onDescrito(e.target.value)} />
                <div className="padrao-acoes">
                  <button className="btn-copiar" title="Copiar pra colar no cadastro do Sienge"
                    onClick={() => navigator.clipboard?.writeText(descrito)}><Copy size={11} /></button>
                  {editado && (
                    <button className="btn-copiar" title="Voltar ao descritivo gerado"
                      onClick={() => onDescrito(null)}><RotateCcw size={11} /></button>
                  )}
                </div>
              </div>
              {/* Os dois codigos que o template exige e que a descricao
                  nao carrega. Ficam aqui embaixo, e nao numa coluna
                  propria, porque so valem pra linha que vai ser
                  cadastrada — quem escolheu variante nao preenche nada. */}
              <div className="det-codigos">
                <label>
                  cód. do detalhe
                  <input className="form-input" value={codDet} placeholder="o Sienge numera"
                    onChange={(e) => onCodDet(e.target.value)} />
                </label>
                <label>
                  cód. auxiliar {auxSorteado && <span className="det-sorteado">sorteado</span>}
                  <input className={`form-input ${aux ? "" : "vazio"} ${auxSorteado ? "sorteado" : ""}`}
                    value={aux} placeholder="referência do fornecedor"
                    onChange={(e) => onAux(e.target.value)} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function PedidoCompra({ obra, canal, itens, usuario }) {
  const c = canalPorId(canal);
  const hoje = new Date().toLocaleDateString("pt-BR");

  // O prazo mais apertado entre as verbas do pedido: e a data que manda.
  const prazo = useMemo(() => {
    if (!obra.dataEntrega) return null;
    let melhor = null;
    [...new Set(itens.map((r) => r.catNum))].forEach((num) => {
      const cat = (obra.categorias || []).find((x) => x.num === num);
      const p = cat && prazoDoGrupo(cat, cat.itens);
      if (!p) return;
      const d = dataLimiteCompra(obra.dataEntrega, p.dias);
      if (d && (!melhor || d < melhor)) melhor = d;
    });
    return melhor;
  }, [obra, itens]);
  const faltam = prazo ? diasAte(prazo) : null;

  return (
    <div className="doc-escopo pedido-doc" id="doc-pedido">
      <div className="doc-banda">Pedido de compra — {c ? c.nome : "sem canal"}</div>
      <div className="doc-cab">
        <div><span className="doc-rot">Obra</span> {obra.codigo} · {obra.nome}</div>
        {obra.endereco && <div><span className="doc-rot">Endereço</span> {obra.endereco}</div>}
        <div><span className="doc-rot">Solicitado por</span> {usuario || "—"} em {hoje}</div>
        <div><span className="doc-rot">Itens</span> {itens.length} {itens.length === 1 ? "produto" : "produtos"}</div>
        {prazo && (
          <div className={faltam < 0 ? "pedido-vencido" : faltam <= 15 ? "pedido-perto" : ""}>
            <span className="doc-rot">Comprar até</span> {fmtData(prazo)}
            {faltam != null && (faltam < 0
              ? ` — venceu há ${Math.abs(faltam)} ${Math.abs(faltam) === 1 ? "dia" : "dias"}`
              : faltam === 0 ? " — é hoje" : ` — faltam ${faltam} ${faltam === 1 ? "dia" : "dias"}`)}
          </div>
        )}
        {obra.dataEntrega && (
          <div><span className="doc-rot">Entrega da obra</span> {new Date(`${obra.dataEntrega}T12:00:00`).toLocaleDateString("pt-BR")}</div>
        )}
      </div>

      <h3 className="doc-h">Insumos</h3>
      <table className="doc-tab">
        <thead>
          <tr>
            <th style={{ width: 52 }}>Verba</th>
            <th>Descrição</th>
            <th style={{ width: 78 }}>Ambiente</th>
            <th style={{ width: 62 }} className="center">Qtd.</th>
            <th style={{ width: 46 }}>Un.</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((r, k) => (
            <tr key={k}>
              <td className="mono">{r.catNum}</td>
              <td>
                <div>{r.it.desc}</div>
                {/* A especificacao e o que evita o fornecedor mandar a
                    peca parecida — e a pergunta que ele faria por telefone. */}
                {r.it.especificacao && <div className="ped-espec">{r.it.especificacao}</div>}
                {r.it.detalheSienge && <div className="ped-sienge">Sienge: {r.it.detalheSienge}</div>}
              </td>
              <td>{r.it.ambiente || "—"}</td>
              <td className="center mono">{r.it.qtdExecutivo ?? r.it.qtdVendida ?? "—"}</td>
              <td className="mono">{r.it.un || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="doc-rodape">
        Gerado pelo Gestão de Obras TKWS em {hoje}. Quantidades conforme projeto executivo aprovado.
      </div>
    </div>
  );
}

/* Excel do pedido — uso INTERNO, entao leva valor.
 *
 * A folha que vai pro fornecedor nao mostra o custo do executivo: e o
 * nosso teto, e entregar isso antes da proposta e abrir o jogo sozinho.
 * A planilha e pra dentro de casa, pra conferir contra o que voltar. */
function baixarPedidoExcel(obra, canal, itens, usuario) {
  const c = canalPorId(canal);
  const cab = [
    ["PEDIDO DE COMPRA"],
    ["Obra", `${obra.codigo} · ${obra.nome}`],
    ["Endereço", obra.endereco || ""],
    ["Canal", c ? c.nome : "sem canal"],
    ["Solicitado por", usuario || ""],
    ["Data", new Date().toLocaleDateString("pt-BR")],
    ["Entrega da obra", obra.dataEntrega ? new Date(`${obra.dataEntrega}T12:00:00`).toLocaleDateString("pt-BR") : ""],
    [],
    ["Verba", "Grupo", "Cód.", "Descrição", "Especificação", "Ambiente", "Qtd.", "Un.", "Material (R$)", "Insumo Sienge", "Status"],
  ];
  const linhas = itens.map((r) => [
    r.catNum, r.catNome, r.it.codigo || "", r.it.desc || "", r.it.especificacao || "",
    r.it.ambiente || "", r.it.qtdExecutivo ?? r.it.qtdVendida ?? "", r.it.un || "",
    r.material, r.it.detalheSienge || "", r.it.comprado ? "comprado" : "pendente",
  ]);
  const total = itens.reduce((a, r) => a + r.material, 0);
  const ws = XLSX.utils.aoa_to_sheet([...cab, ...linhas, [], ["", "", "", "TOTAL", "", "", "", "", total]]);
  ws["!cols"] = [{ wch: 7 }, { wch: 26 }, { wch: 8 }, { wch: 48 }, { wch: 30 }, { wch: 14 }, { wch: 7 }, { wch: 6 }, { wch: 14 }, { wch: 40 }, { wch: 11 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pedido");
  XLSX.writeFile(wb, `pedido-${c ? c.id : "sem-canal"}-obra-${obra.codigo}.xlsx`);
}

function ComprasView({ obra, onItemChange, usuario }) {
  const [etapa, setEtapa] = useState("todos");
  const [sel, setSel] = useState(() => new Set());
  const [abertos, setAbertos] = useState(() => new Set());
  const [baseSienge, setBaseSienge] = useState(null);
  const [resultado, setResultado] = useState(null);
  // O pedido so existe na tela enquanto imprime; fora disso ele nao ocupa
  // espaco nem confunde com a lista de trabalho.
  const [pedido, setPedido] = useState(null);
  // O que o Sienge diz que foi lancado — vem do PDF que a pessoa sobe.
  const [doSienge, setDoSienge] = useState(null);
  const [lendoPdf, setLendoPdf] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erroBase, setErroBase] = useState(null);

  const rows = useMemo(() => produtosMAT(obra), [obra]);

  const visiveis = useMemo(() => {
    if (etapa === "todos") return rows;
    if (etapa === "sienge") return rows.filter((r) => r.it.canalCompra === "sienge");
    if (etapa === "sem_canal") return rows.filter((r) => !r.it.canalCompra);
    return rows.filter((r) => r.it.canalCompra === etapa);
  }, [rows, etapa]);

  const porVerba = useMemo(() => {
    const m = new Map();
    visiveis.forEach((r) => {
      if (!m.has(r.catNum)) m.set(r.catNum, { num: r.catNum, nome: r.catNome, itens: [], total: 0 });
      const g = m.get(r.catNum);
      g.itens.push(r); g.total += r.material;
    });
    return [...m.values()];
  }, [visiveis]);

  /* A base agrupada por MAE: o codigo do Sienge se repete, e debaixo de
     cada um moram as variantes. Agrupar uma vez custa uma passada; fazer
     por linha custaria 126 x 10.507. */
  const grupos = useMemo(() => (baseSienge ? agruparPorMae(baseSienge) : null), [baseSienge]);

  // Casa uma vez e guarda: refazer a cada render seria 200 x 2.700
  // comparacoes por tecla digitada.
  const casamentos = useMemo(() => {
    if (!grupos) return new Map();
    const m = new Map();
    rows.forEach((r) => {
      const maes = acharMaes(r.it.desc, grupos);
      const melhor = maes[0] || null;
      // Sem mae provavel nao ha o que escolher: e caso de cadastrar.
      m.set(r.chave, { maes, detalhes: melhor ? ordenarDetalhes(r.it.desc, melhor.grupo) : [] });
    });
    return m;
  }, [grupos, rows]);

  const selecionados = rows.filter((r) => sel.has(r.chave));

  /* A conferencia so olha o canal Sienge: e o unico que passa por la. */
  const confronto = useMemo(() => {
    if (!doSienge) return null;
    const doCanal = rows.filter((r) => r.it.canalCompra === "sienge");
    return conferirComSienge(doCanal, doSienge.itens, cobertura);
  }, [doSienge, rows]);

  // Pra tabela dizer, linha a linha, se aquilo chegou no Sienge.
  const lancados = useMemo(() => {
    const m = new Map();
    (confronto?.confirmados || []).forEach((c) => m.set(c.chave, c.sienge));
    return m;
  }, [confronto]);
  const totalSel = selecionados.reduce((a, r) => a + r.material, 0);

  const alternar = (c) => setSel((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const alternarGrupo = (g) => setSel((p) => {
    const n = new Set(p);
    const todosDentro = g.itens.every((r) => n.has(r.chave));
    g.itens.forEach((r) => (todosDentro ? n.delete(r.chave) : n.add(r.chave)));
    return n;
  });
  const abrir = (num) => setAbertos((p) => { const n = new Set(p); n.has(num) ? n.delete(num) : n.add(num); return n; });
  const selecionarTudo = () => setSel(new Set(visiveis.map((r) => r.chave)));

  function definirCanal(canal) {
    selecionados.forEach((r) => onItemChange(r.catIdx, r.itemIdx, { canalCompra: canal }));
    setSel(new Set());
  }

  /* Associa em massa — mas SO o que bate inteiro.

     Aceitar a melhor sugestao de qualquer jeito seria rapido e errado: a
     linha de 9.000 BTUs viraria a de 18.000 sem ninguem olhar, e o erro
     so aparece quando o equipamento chega na obra. O que ficou faltando
     alguma palavra continua na tela pra ser escolhido a mao, e a tela diz
     quantos foram. */
  function associarSelecionados() {
    let certos = 0, revisar = 0;
    selecionados.forEach((r) => {
      const c = casamentos.get(r.chave);
      const mae = c?.maes?.[0];
      const melhor = c?.detalhes?.[0];
      if (!mae || !podeAssociarSozinho(c.detalhes)) { revisar += 1; return; }
      onItemChange(r.catIdx, r.itemIdx, {
        maeSienge: mae.grupo.codigo,
        detalheSienge: melhor.insumo.descricao,
      });
      certos += 1;
    });
    setResultado({ certos, revisar });
    setSel(new Set());
  }

  /* A base carrega sozinha ao entrar na etapa do Sienge.

     Antes as colunas de comparacao so existiam depois de clicar em
     "Associar insumos" — a pessoa chegava na etapa, via a tabela sem a
     informacao que ela veio buscar, e tinha que descobrir que havia um
     botao. A comparacao E a etapa; esconder ela atras de um clique era
     pedir uma confirmacao pra fazer o obvio. */
  useEffect(() => {
    if (etapa !== "sienge" || baseSienge || carregando) return;
    associar();
  }, [etapa]);

  /* Le o PDF do Sienge e confere contra o que esta na tela.

     A pergunta e uma so: faltou lancar alguma compra? O Sienge e onde a
     compra existe de verdade — enquanto ela nao estiver la, ela nao foi
     feita, por mais marcada que esteja aqui.

     Da pra subir mais de um arquivo (a solicitacao em aberto e o pedido)
     e eles se somam, porque a conferencia nao liga de qual documento a
     linha veio: ela so quer saber se o produto esta em algum. */
  /* Varios arquivos de uma vez.

     A conferencia junta tudo num monte so — a solicitacao em aberto e o
     pedido respondem a mesma pergunta ("isto esta no Sienge?") — mas
     ELES SAO LIDOS UM A UM, e um que falha nao derruba os outros: a tela
     diz qual arquivo deu problema e fica com o que deu certo. Abortar o
     lote inteiro por causa de um faria a pessoa recomecar a selecao. */
  async function lerArquivosSienge(files) {
    const lista = [...(files || [])];
    if (!lista.length) return;
    setLendoPdf(true); setErroBase(null);
    const falhas = [];
    for (const file of lista) {
      try {
        await lerUmArquivoSienge(file);
      } catch (e) {
        falhas.push(`${file.name}: ${e.message || e}`);
      }
    }
    setLendoPdf(false);
    if (falhas.length) setErroBase(`Não consegui ler ${falhas.length === 1 ? "um arquivo" : `${falhas.length} arquivos`} — ${falhas.join(" · ")}`);
  }

  async function lerUmArquivoSienge(file) {
    {
      let doc;
      if (/\.(xlsx|xlsm|xlsb|xls|csv)$/i.test(file.name)) {
        /* Excel nao passa pelo servidor: os dados ja vem em colunas, e
           mandar a planilha inteira pra uma funcao serverless so pra
           voltar com o mesmo conteudo seria uma ida e volta a toa. */
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
        doc = parsePedidoSiengeExcel(linhas);
      } else {
        const buf = await file.arrayBuffer();
        doc = parsePedidoSienge(await textoDoPDF(buf));
      }
      if (!doc.itens.length) throw new Error("Não encontrei nenhum insumo neste arquivo. Me manda ele que eu ajusto o leitor.");
      /* Mesmo arquivo de novo SUBSTITUI, nao soma.

         Subir duas vezes duplicaria cada linha, e a conferencia passaria
         a confirmar produtos com a copia — dando por lancado o que nao
         foi. Reimportar um export corrigido e o caso comum, entao a
         troca e o comportamento certo. */
      const marca = { nome: file.name, numero: doc.numero, obra: doc.obraCodigo, n: doc.itens.length };
      setDoSienge((antes) => {
        const docs = (antes?.docs || []).filter((d) => d.nome !== file.name);
        const itens = (antes?.itens || []).filter((i) => i.arquivo !== file.name);
        return {
          docs: [...docs, marca],
          itens: [...itens, ...doc.itens.map((i) => ({ ...i, arquivo: file.name }))],
        };
      });
    }
  }

  async function associar() {
    setCarregando(true); setErroBase(null);
    try {
      const base = await carregarTodosInsumos();
      setBaseSienge(base);
      if (!base.length) setErroBase("A base de insumos do Sienge está vazia — importe o relatório em Banco de Preços.");
    } catch (e) {
      setErroBase(`Não consegui ler a base de insumos: ${e.message || e}`);
    } finally { setCarregando(false); }
  }

  if (rows.length === 0) {
    return (
      <div className="compras-empty">
        <ShoppingCart size={30} className="dim" />
        <div className="compras-empty-title">Esta obra ainda não tem material no executivo</div>
        <div className="compras-empty-sub">Quando o executivo for carregado, tudo que tem parcela de material aparece aqui pra você escolher por onde comprar.</div>
      </div>
    );
  }

  const conta = (f) => rows.filter(f).length;
  const soma = (f) => rows.filter(f).reduce((a, r) => a + r.material, 0);
  const etapas = [
    { id: "todos", rot: "Tudo", n: rows.length, v: soma(() => true) },
    { id: "sem_canal", rot: "Sem canal", n: conta((r) => !r.it.canalCompra), v: soma((r) => !r.it.canalCompra) },
    ...CANAIS_COMPRA.map((c) => ({
      id: c.id, rot: c.nome, canal: c.id,
      n: conta((r) => r.it.canalCompra === c.id),
      v: soma((r) => r.it.canalCompra === c.id),
      // Quantos daquele canal ja foram comprados — e o que diz se o canal
      // esta andando ou parado.
      feitos: conta((r) => r.it.canalCompra === c.id && r.it.comprado),
    })),
  ];

  return (
    <>
      <div className="mo-topo">
        <div className="mo-num">
          <div className="mo-num-val mono">{fmtBRL(soma(() => true))}</div>
          <div className="mo-num-rot">de material no executivo · {rows.length} produtos</div>
        </div>
        <div className="mo-num">
          <div className="mo-num-val mono dim">{fmtBRL(soma((r) => !!r.it.canalCompra))}</div>
          <div className="mo-num-rot">já com canal definido</div>
        </div>
        <div className="mo-num">
          <div className="mo-num-val mono">{fmtBRL(soma((r) => !r.it.canalCompra))}</div>
          <div className="mo-num-rot">ainda sem canal</div>
        </div>
        <div className="mo-num mo-num-ok">
          <div className="mo-num-val mono">{fmtBRL(soma((r) => r.it.comprado))}</div>
          <div className="mo-num-rot">já comprado · vai pro Dashboard</div>
        </div>
      </div>

      {/* O funil. Cada chip e um estagio, e o numero embaixo diz quanto
          dinheiro esta parado ali — que e o que decide por onde comecar. */}
      <div className="funil">
        {etapas.map((e, i) => (
          <React.Fragment key={e.id}>
            <button className={`funil-no ${etapa === e.id ? "ativo" : ""}`} onClick={() => setEtapa(e.id)}>
              {e.canal && <TagCanal id={e.canal} />}
              <div className="funil-n">{e.n}</div>
              <div className="funil-rot">{e.rot}</div>
              <div className="funil-v mono">{fmtCompactBRL(e.v)}</div>
              {e.canal && e.n > 0 && (
                <div className={`funil-feitos ${e.feitos === e.n ? "tudo" : ""}`}>
                  {e.feitos === e.n ? <><Check size={9} /> tudo comprado</> : `${e.feitos} de ${e.n} comprados`}
                </div>
              )}
            </button>
            {i === 1 && <ChevronRight size={14} className="pipe-arrow dim" />}
          </React.Fragment>
        ))}
      </div>

      {etapa === "sienge" && (
        <div className="assoc-barra">
          <PackageSearch size={15} className="dim" />
          <span>
            {carregando ? "Procurando na base do Sienge…"
              : baseSienge
                ? `${baseSienge.length.toLocaleString("pt-BR")} insumos cadastrados no Sienge. Escolha a mãe e a variante em cada linha, ou selecione e associe em massa.`
                : "Base do Sienge não carregada."}
          </span>
          {/* Subir o PDF do Sienge e' o passo que fecha a conferencia:
              ate' aqui a tela diz o que DEVERIA ser comprado; o PDF diz o
              que de fato foi lancado. Depois isso vem pela API. */}
          <label className="btn-doc btn-pdf-sienge">
            <Upload size={13} /> {lendoPdf ? "Lendo…" : "Subir relatórios do Sienge"}
            {/* `multiple`: a solicitacao em aberto e o pedido sao dois
                arquivos que respondem a mesma pergunta. Um por clique
                obrigava a repetir o caminho da pasta. */}
            <input type="file" multiple accept=".xlsx,.xlsm,.xls,.csv,.pdf" style={{ display: "none" }} disabled={lendoPdf}
              onChange={(e) => { const fs = e.target.files; e.target.value = ""; lerArquivosSienge(fs); }} />
          </label>
          <button className="btn-doc" onClick={associar} disabled={carregando}>
            <PackageSearch size={13} /> {carregando ? "Procurando…" : "Recarregar base"}
          </button>
        </div>
      )}

      {/* O aviso ficava no FIM da pagina, depois de quinze grupos: quando
          a leitura do arquivo falhava, a tela parecia nao ter feito nada. */}
      {erroBase && <div className="aviso-migracao"><AlertTriangle size={14} /> <span>{erroBase}</span></div>}

      {confronto && (
        <div className="confronto">
          <div className="confronto-topo">
            <PackageSearch size={15} />
            <span className="cf-docs">
              Conferência com o Sienge —{" "}
              {doSienge.docs.map((d) => (
                <span className="cf-doc" key={d.nome}>
                  {d.nome} <b>{d.n}</b>{d.numero ? ` · nº ${d.numero}` : ""}
                  {/* Tirar um arquivo sem recomecar: as vezes so um deles
                      estava errado, e refazer a selecao inteira e caro. */}
                  <button className="cf-doc-x" title="Tirar este arquivo da conferência"
                    onClick={() => setDoSienge((a2) => {
                      const docs = a2.docs.filter((x) => x.nome !== d.nome);
                      return docs.length
                        ? { docs, itens: a2.itens.filter((i) => i.arquivo !== d.nome) }
                        : null;
                    })}><X size={10} /></button>
                </span>
              ))}
            </span>
            <button className="btn-voltar" onClick={() => setDoSienge(null)}><X size={13} /> Limpar</button>
          </div>
          <div className="confronto-placar">
            <div className="cf-bloco ok">
              <div className="cf-n">{confronto.confirmados.length}</div>
              <div className="cf-rot">confirmados no Sienge</div>
            </div>
            {/* O numero que motiva tudo: alguem achou que pediu e nao pediu. */}
            <div className={`cf-bloco ${confronto.faltaLancar.length ? "ruim" : "ok"}`}>
              <div className="cf-n">{confronto.faltaLancar.length}</div>
              <div className="cf-rot">falta lançar no Sienge</div>
            </div>
            <div className={`cf-bloco ${confronto.naoListados.length ? "aviso" : "ok"}`}>
              <div className="cf-n">{confronto.naoListados.length}</div>
              <div className="cf-rot">no Sienge e não na planilha</div>
            </div>
          </div>

          {confronto.faltaLancar.length > 0 && (
            <div className="cf-lista">
              <div className="cf-tit ruim">Falta lançar no Sienge</div>
              {confronto.faltaLancar.map((r) => (
                <div className="cf-linha" key={r.chave}>
                  <span className="mono dim">{r.catNum}</span>
                  <span className="cf-desc">{r.it.desc}</span>
                  <span className="mono">{fmtBRL(r.material)}</span>
                </div>
              ))}
            </div>
          )}
          {confronto.naoListados.length > 0 && (
            <div className="cf-lista">
              {/* Aparece em vez de sumir: pode ser compra que nasceu fora
                  da planilha, ou a mesma coisa escrita diferente — e as
                  duas coisas alguem precisa ver. */}
              <div className="cf-tit aviso">Não listado aqui — está no Sienge e não na planilha</div>
              {confronto.naoListados.map((s, k) => (
                <div className="cf-linha" key={k}>
                  <span className="mono dim">{s.codigo}</span>
                  <span className="cf-desc">{s.descricao}</span>
                  <span className="mono dim">{s.qtdPrevista ?? "—"} {s.un}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {resultado && (
        <div className={`assoc-resultado ${resultado.revisar ? "parcial" : "ok"}`}>
          {resultado.revisar ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          <span>
            <b>{resultado.certos}</b> {resultado.certos === 1 ? "associado" : "associados"} automaticamente
            {resultado.revisar > 0 && <> · <b>{resultado.revisar}</b> {resultado.revisar === 1 ? "ficou" : "ficaram"} pra escolher à mão, porque faltou casar alguma palavra</>}
          </span>
          <button className="aviso-x" onClick={() => setResultado(null)} aria-label="Fechar"><X size={13} /></button>
        </div>
      )}

      <div className="sel-barra-topo">
        <button className="btn-sel-tudo" onClick={selecionarTudo}>
          <Check size={12} /> Selecionar os {visiveis.length} desta etapa
        </button>
        {sel.size > 0 && <button className="btn-limpar-sel-claro" onClick={() => setSel(new Set())}>Limpar seleção</button>}
      </div>

      {porVerba.length === 0 && <div className="empty-note">Nada nesta etapa.</div>}
      {porVerba.map((g) => {
        const aberto = abertos.has(g.num);
        const nSel = g.itens.filter((r) => sel.has(r.chave)).length;
        return (
          <div className="grp-block" key={g.num}>
            <div className="grp-head">
              <button className="mo-check" onClick={() => alternarGrupo(g)}
                title={nSel === g.itens.length ? "Tirar o grupo da seleção" : "Selecionar a verba inteira"}
                aria-label="Selecionar verba">
                {nSel === g.itens.length ? <Check size={13} /> : nSel > 0 ? <Minus size={13} /> : null}
              </button>
              <button className="grp-toggle" onClick={() => abrir(g.num)}>
                <div className="grp-esq">
                  {aberto ? <ChevronDown size={15} className="dim" /> : <ChevronRight size={15} className="dim" />}
                  <span className="grp-num mono">{g.num}</span>
                  <span className="grp-nome">{g.nome}</span>
                  <span className="grp-conta">{g.itens.length} {g.itens.length === 1 ? "produto" : "produtos"}</span>
                  {nSel > 0 && <span className="grp-avulsos">{nSel} selecionados</span>}
                </div>
              </button>
              <div className="grp-dir">
                <div className="grp-tot">
                  <div className="grp-tot-rot">MATERIAL</div>
                  <div className="grp-tot-val mono">{fmtBRL(g.total)}</div>
                </div>
              </div>
            </div>
            {aberto && (
              <div className="grp-itens">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 34 }} />
                      <th style={{ width: 62 }}>Cód.</th>
                      <th>Descrição</th>
                      <th style={{ width: 74 }} className="center">Qtd.</th>
                      <th style={{ width: 104 }} className="right">Material</th>
                      <th style={{ width: 112 }} className="center">Canal</th>
                      <th style={{ width: 104 }} className="center">Status</th>
                      {doSienge && <th style={{ width: 122 }} className="center">Lançado Sienge</th>}
                      {/* A mae virou a primeira linha do detalhe: eram
                          duas colunas contando a mesma historia, e a
                          tabela so cabia rolando pro lado. */}
                      {baseSienge && <th style={{ width: 300 }}>Insumo no Sienge</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {g.itens.map((r) => (
                      <LinhaCompra key={r.chave} row={r} selecionado={sel.has(r.chave)}
                        onSelecionar={() => alternar(r.chave)}
                        casamento={casamentos.get(r.chave)}
                        mostrarSienge={!!baseSienge}
                        lancado={doSienge ? lancados.get(r.chave) || null : undefined}
                        onItemChange={(patch) => onItemChange(r.catIdx, r.itemIdx, patch)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {pedido && (
        <div className="pedido-wrap">
          <div className="pedido-topo naoimprime">
            <span>Pedido pronto — a impressão já abriu. Feche a prévia quando terminar.</span>
            <button className="btn-doc" onClick={() => window.print()}><FileText size={13} /> Imprimir de novo</button>
            <button className="btn-voltar" onClick={() => setPedido(null)}><X size={13} /> Fechar</button>
          </div>
          <PedidoCompra obra={obra} canal={pedido.canal} itens={pedido.itens} usuario={usuario} />
        </div>
      )}

      {/* A escolha do canal fica na barra da selecao: e uma decisao sobre
          o LOTE, nao sobre uma linha. Marcar 40 produtos e ter que
          escolher o canal 40 vezes e a mesma decisao repetida 40 vezes. */}
      {selecionados.length > 0 && (
        <div className="mo-escopo-barra">
          <div>
            <div className="mo-escopo-val mono">{fmtBRL(totalSel)}</div>
            <div className="mo-escopo-rot">
              {selecionados.length} {selecionados.length === 1 ? "produto selecionado" : "produtos selecionados"}
            </div>
          </div>
          <div className="canal-escolha">
            {/* O pedido sai de qualquer canal — inclusive de quem ainda
                nao tem um: as vezes a lista e pra pedir cotacao antes de
                decidir por onde comprar. */}
            <button className="btn-associar-sel" onClick={() => {
              const canal = etapa === "todos" || etapa === "sem_canal" ? selecionados[0]?.it.canalCompra || null : etapa;
              setPedido({ canal, itens: selecionados });
              setTimeout(() => window.print(), 150);
            }} title="Abre a impressão do navegador — escolha Salvar como PDF">
              <FileText size={13} /> PDF
            </button>
            <button className="btn-associar-sel" onClick={() => baixarPedidoExcel(
              obra,
              etapa === "todos" || etapa === "sem_canal" ? selecionados[0]?.it.canalCompra : etapa,
              selecionados, usuario)
            } title="Baixa a planilha do pedido — leva o valor, porque é uso interno">
              <Download size={13} /> Excel
            </button>
            {/* Concluir em massa nao tem risco de casar errado: e a
                pessoa afirmando que comprou o que ela mesma selecionou. */}
            {selecionados.some((r) => r.it.canalCompra) && (
              <button className="btn-associar-sel" onClick={() => {
                const comCanal = selecionados.filter((r) => r.it.canalCompra);
                const desmarcar = comCanal.every((r) => r.it.comprado);
                comCanal.forEach((r) => onItemChange(r.catIdx, r.itemIdx, {
                  comprado: !desmarcar,
                  compradoEm: desmarcar ? null : new Date().toISOString(),
                }));
                setSel(new Set());
              }} title="Marca os selecionados que já têm canal — entra no total do Dashboard">
                <Check size={13} /> {selecionados.filter((r) => r.it.canalCompra).every((r) => r.it.comprado)
                  ? "Desmarcar comprado" : "Marcar comprado"}
              </button>
            )}
            {etapa === "sienge" && baseSienge && (
              <button className="btn-associar-sel" onClick={associarSelecionados}
                title="Aceita a variante que bate inteiro; o que faltou palavra fica pra escolher à mão">
                <PackageSearch size={13} /> Associar {selecionados.length}
              </button>
            )}
            {CANAIS_COMPRA.map((c) => (
              <button key={c.id} className="btn-canal" onClick={() => definirCanal(c.id)}
                title={`Marcar os selecionados como compra por ${c.nome}`}>
                <TagCanal id={c.id} comNome />
              </button>
            ))}
            <button className="btn-canal btn-canal-limpar" onClick={() => definirCanal(null)}
              title="Tirar o canal dos selecionados">tirar canal</button>
          </div>
        </div>
      )}
    </>
  );
}

function LinhaCompra({ row, selecionado, onSelecionar, casamento, mostrarSienge, lancado, onItemChange }) {
  const { it, material } = row;
  const padrao = descricaoSienge({
    marca: it.marca, desc: it.desc, modelo: it.modelo, cor: it.cor, codigo: it.codigoFornecedor,
  });

  // A mae escolhida: a que o casamento sugeriu, ou a que a pessoa trocou.
  const maeAtual = (casamento?.maes || []).find((x) => x.grupo.codigo === it.maeSienge)
    || (casamento?.maes || [])[0] || null;
  const detalhes = maeAtual
    ? (maeAtual.grupo.codigo === casamento?.maes?.[0]?.grupo.codigo
        ? casamento.detalhes
        : ordenarDetalhes(it.desc, maeAtual.grupo))
    : [];
  const escolhido = it.detalheSienge;
  /* Verde e mae achada COM detalhe que bate; laranja e mae achada e
     detalhe por escolher; vermelho e nem mae. Sao tres perguntas
     diferentes e cada uma manda pra um lado: comprar, conferir, cadastrar. */
  const status = !maeAtual ? "sem" : (escolhido || detalhes[0]?.score >= 0.95) ? "exato" : "aproximado";

  return (
    <tr className={selecionado ? "linha-sel" : it.comprado ? "row-comprado" : "row-falta"}>
      <td className="center">
        <button className="mo-check mo-check-tab" onClick={onSelecionar} aria-label="Selecionar produto">
          {selecionado && <Check size={13} />}
        </button>
      </td>
      <td className="mono dim">{it.codigo}</td>
      <td>
        <div className="item-desc">{it.desc}</div>
        {it.ambiente && <span className="dim" style={{ fontSize: 10.5 }}>{it.ambiente}</span>}
        {/* A especificacao distingue duas pecas de mesmo nome — sem ela,
            "Cuba de apoio" e todas as cubas de apoio que existem. */}
        {it.especificacao && <div className="det-espec">{it.especificacao}</div>}
      </td>
      <td className="mono center">{it.qtdExecutivo ?? it.qtdVendida ?? "—"} <span className="unit">{it.un}</span></td>
      <td className="mono right">{fmtBRL(material)}</td>
      <td className="center">
        {it.canalCompra ? <TagCanal id={it.canalCompra} comNome /> : <span className="pill pill-wait">—</span>}
      </td>
      <td className="center">
        {/* Sem canal nao ha o que concluir: concluir o que ninguem sabe
            por onde vai comprar seria marcar comprado no escuro. */}
        {!it.canalCompra ? <span className="dim">—</span> : (
          <button className={`pill pill-btn ${it.comprado ? "pill-ok" : "pill-wait"}`}
            onClick={() => onItemChange({ comprado: !it.comprado, compradoEm: it.comprado ? null : new Date().toISOString() })}
            title={it.comprado
              ? `Comprado${it.compradoEm ? ` em ${new Date(it.compradoEm).toLocaleDateString("pt-BR")}` : ""} — clique pra desfazer`
              : "Marcar como comprado — entra no total do Dashboard"}>
            {it.comprado ? <><Check size={11} /> comprado</> : "pendente"}
          </button>
        )}
      </td>

      {/* Lancado no Sienge: a confirmacao de que a compra existe DE FATO.
          So aparece depois que o relatorio e' subido — antes disso a
          coluna prometeria uma resposta que ninguem tem. */}
      {lancado !== undefined && (
        <td className="center">
          {lancado ? (
            <span className="pill pill-ok" title={lancado.descricao}>
              <Check size={11} /> {lancado.codigo || "sim"}
            </span>
          ) : (
            <span className="pill pill-falta" title="Está no plano e não apareceu no relatório do Sienge">
              não lançado
            </span>
          )}
        </td>
      )}

      {mostrarSienge && (
        <td>
          {/* MAE em cima, variantes embaixo, na MESMA celula.

              Eram duas colunas contando a mesma historia — e a tabela so
              cabia rolando pro lado, que e o oposto de ler uma lista. A
              mae e' o cabecalho natural das opcoes que vem logo abaixo. */}
          {!casamento ? <span className="dim">—</span> : !maeAtual ? (
            <div className="casa casa-sem"><span className="casa-bola" /> não existe no Sienge</div>
          ) : (
            <div className={`mae-cel casa-${status}`}>
              <span className="casa-bola" />
              <div className="mae-txt">
                <span className="mae-cod mono">{maeAtual.grupo.codigo}</span>
                <span className="mae-nome">{maeAtual.grupo.nome}</span>
              </div>
              {/* Trocar so faz sentido com mais de uma candidata; com uma
                  so, a setinha prometeria uma escolha que nao existe. */}
              {casamento.maes.length > 1 && (
                <>
                  <ChevronDown size={12} className="mae-seta" />
                  <select className="mae-sel" value={maeAtual.grupo.codigo}
                    onChange={(e) => onItemChange({ maeSienge: e.target.value, detalheSienge: null })}
                    aria-label="Insumo mãe no Sienge"
                    title="Que coisa é, antes de qual variante">
                    {casamento.maes.map((x) => (
                      <option key={x.grupo.codigo} value={x.grupo.codigo}>
                        {x.grupo.codigo} · {x.grupo.nome}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
          {!maeAtual ? (
            <div className="padrao-cel">
              <code className="padrao-txt">{padrao || "—"}</code>
              <button className="btn-copiar" onClick={() => navigator.clipboard?.writeText(padrao)}
                title="Copiar pra colar no cadastro do Sienge"><Copy size={11} /></button>
            </div>
          ) : (
            <div className="detalhe-cel">
              {/* As opcoes ja cadastradas debaixo desta mae, ordenadas.
                  Mostrar o que FALTOU casar e o que permite decidir: "62%"
                  nao ajuda ninguem a escolher entre duas condensadoras. */}
              {detalhes.slice(0, 4).map((d, k) => (
                <button key={d.insumo.descricao + k}
                  className={`det-opcao ${escolhido === d.insumo.descricao ? "escolhida" : ""}`}
                  onClick={() => onItemChange({
                    detalheSienge: escolhido === d.insumo.descricao ? null : d.insumo.descricao,
                    maeSienge: maeAtual.grupo.codigo,
                  })}
                  title={d.insumo.descricao}>
                  <span className="det-opcao-txt">{d.insumo.detalhe}</span>
                  {d.faltaram.length > 0
                    ? <span className="det-falta">falta {d.faltaram.slice(0, 3).join(", ")}</span>
                    : <span className="det-bate">bate tudo</span>}
                </button>
              ))}
              {detalhes.length === 0 && <span className="dim">sem variante cadastrada</span>}
              {/* Nenhuma serve: gera o descritivo pra cadastrar na mao. */}
              <details className="det-gerar">
                <summary>nenhuma serve — gerar descritivo</summary>
                <div className="padrao-cel">
                  <code className="padrao-txt">{padrao || "—"}</code>
                  <button className="btn-copiar" onClick={() => navigator.clipboard?.writeText(padrao)}
                    title="Copiar pra colar no cadastro do Sienge"><Copy size={11} /></button>
                </div>
              </details>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

/* ============================================================
   MÓDULO CONTRATOS
   Andamento do fluxo de contratos dos SERVIÇOS:
   não solicitado → solicitação → aprovação → contrato → previsão
   de medição → medição/NF.
   ============================================================ */

const CONTRATO_PIPELINE = [
  { id: "nao_solicitado", curto: "Não solicitado", color: "var(--ink-3)" },
  { id: "solicitacao", curto: "Solicitação", color: "var(--ink-3)" },
  { id: "aprovacao", curto: "Aprovação", color: "var(--amber)" },
  { id: "contrato_gerado", curto: "Contrato", color: "var(--blue)" },
  { id: "previsao_medicao", curto: "Prev. medição", color: "var(--blue)" },
  { id: "medicao_liberada", curto: "Medição / NF", color: "var(--green)" },
];
const PROXIMA_ETAPA = { nao_solicitado: "solicitacao", solicitacao: "aprovacao", aprovacao: "contrato_gerado", contrato_gerado: "previsao_medicao", previsao_medicao: "medicao_liberada" };

const contratoBloqueado = (it) => it.foraDeEscopo && it.statusEscopo !== "aprovado";

function ContratosRow({ row, onItemChange }) {
  const { it, catNum, catNome } = row;
  const bloqueado = contratoBloqueado(it);
  const prox = PROXIMA_ETAPA[contratoEtapa(it)];
  return (
    <div className="compras-row">
      <div className="compras-row-main">
        <div className="compras-desc">{it.desc}</div>
        <div className="compras-meta mono">{catNum} · {catNome} · {it.qtdExecutivo ?? "—"} {it.un}</div>
      </div>
      <div className="compras-custo mono">{fmtBRL(it.custo)}</div>
      <div className="contrato-etapa-cell"><ContratoStatus item={it} /></div>
      <div className="compras-acao">
        {bloqueado ? (
          <span className="dim" style={{ fontSize: 11 }}>bloqueado</span>
        ) : prox ? (
          <button className="btn-avancar" onClick={() => onItemChange({ statusContrato: prox })}><ArrowUpRight size={13} /> Avançar etapa</button>
        ) : (
          <span className="pill pill-ok"><Check size={12} /> Concluído</span>
        )}
      </div>
    </div>
  );
}

// Botão + formulário pra criar uma solicitação de contrato do zero
// (serviço que não veio do executivo importado — digitado na hora).
function NovaSolicitacaoForm({ obra, onCriar }) {
  const verbas = obra.categorias.filter((c) => !c.foraDaEapPadrao);
  const [aberto, setAberto] = useState(false);
  const [verbaNum, setVerbaNum] = useState(verbas[0]?.num || "");
  const [desc, setDesc] = useState("");
  const [qtd, setQtd] = useState("");
  const [un, setUn] = useState("vb");
  const [custo, setCusto] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!desc.trim() || !verbaNum) return;
    const custoNum = parseFloat(custo.replace(/\./g, "").replace(",", "."));
    const qtdNum = parseFloat(qtd.replace(/\./g, "").replace(",", "."));
    onCriar(verbaNum, {
      desc: desc.trim(), tipo: "servico",
      custo: isNaN(custoNum) ? null : custoNum,
      qtdExecutivo: isNaN(qtdNum) ? null : qtdNum,
      un: un.trim() || null,
      statusContrato: "solicitacao",
    });
    setDesc(""); setCusto(""); setQtd("");
    setAberto(false);
  }

  if (!aberto) {
    return (
      <button className="btn-nova-solicitacao" onClick={() => setAberto(true)}>
        <Plus size={14} /> Nova solicitação de contrato
      </button>
    );
  }

  return (
    <form className="form-solicitacao" onSubmit={submit}>
      <div className="form-solicitacao-title">Nova solicitação de contrato</div>
      <div className="form-row">
        <label className="form-label">Verba
          <select className="form-select" value={verbaNum} onChange={(e) => setVerbaNum(e.target.value)}>
            {verbas.map((c) => <option key={c.num} value={c.num}>{c.num} — {c.nome}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label className="form-label">Descrição do serviço
          <input className="form-input" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Instalação de cortinas" required autoFocus />
        </label>
      </div>
      <div className="form-row form-row-3">
        <label className="form-label">Qtd.<input className="form-input" type="text" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="1" /></label>
        <label className="form-label">Unidade<input className="form-input" type="text" value={un} onChange={(e) => setUn(e.target.value)} placeholder="vb" /></label>
        <label className="form-label">Custo estimado (R$)<input className="form-input" type="text" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" /></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-cancelar" onClick={() => setAberto(false)}>Cancelar</button>
        <button type="submit" className="btn-criar">Criar solicitação</button>
      </div>
    </form>
  );
}

/* Tudo que e MAO DE OBRA na obra.

   Antes a lista era `it.tipo !== "produto"` — o campo de UMA escolha so.
   O spot de sobrepor, que tem R$ 182 de material e R$ 180 de mao de obra,
   era carimbado "produto" e os R$ 180 dele nunca chegavam aqui. Agora
   entra quem TEM parcela de mao de obra, seja ela a linha inteira ou
   metade dela, e o valor que viaja e a PARCELA, nao o custo do item.

   Material nao entra: ele vira compra, e ja tem tela propria. */
function servicosMO(obra) {
  const out = [];
  (obra.categorias || []).forEach((cat, catIdx) => {
    (cat.itens || []).forEach((it, itemIdx) => {
      if (it.ehTitulo) return;
      const { mo } = parcelasDoItem(it, cat);
      const aloc = alocacaoDoItem(it, cat);
      if (mo <= 0 && aloc !== ALOC_MO) return;
      out.push({ it, catIdx, itemIdx, catNum: cat.num, catNome: cat.nome, mo, aloc,
        chave: `${catIdx}-${itemIdx}` });
    });
  });
  return out;
}

/* ESCOPO DE CONTRATACAO

   Nasce da selecao de servicos da Dashboard MO: a soma da mao de obra
   deles e o ORCADO, e e contra ele que a proposta do fornecedor e
   comparada. Quem pede o escopo passa a saber se estourou antes de
   mandar, nao depois de receber.

   O texto do modelo e COPIADO pra dentro do escopo, nao referenciado. O
   que a empresa contrata hoje nao pode mudar porque alguem editou o
   modelo amanha — contrato assinado e um retrato, nao um link. */
function FormNovoEscopo({ obra, servicos, onCriar, onCancelar }) {
  const verbas = [...new Set(servicos.map((s) => s.catNum))];
  const sugerido = verbas.length === 1 ? modeloSugerido(verbaPorNome(servicos[0].catNome) || servicos[0].catNum) : null;
  const [modelo, setModelo] = useState(sugerido || "");
  const [fornecedor, setFornecedor] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const orcado = servicos.reduce((a, s) => a + s.mo, 0);
  const grupos = useMemo(() => modelosPorGrupo(), []);

  function submit(e) {
    e.preventDefault();
    if (!modelo) return;
    const m = MODELOS_ESCOPO[modelo];
    onCriar({
      modelo, nome: m.nome, banda: m.banda, modo: m.modo || "medicao",
      fornecedor: fornecedor.trim() || null, inicio: inicio || null, fim: fim || null,
      orcado,
      servicos: servicos.map((s) => ({ catNum: s.catNum, catNome: s.catNome, codigo: s.it.codigo, desc: s.it.desc, mo: s.mo })),
      // copia, nao referencia
      itens: JSON.parse(JSON.stringify(m.itens || [])),
      medicoes: JSON.parse(JSON.stringify(m.medicoes || [])),
      // Modelo parcelado ja nasce com as quatro parcelas divididas sobre o
      // orcado. Escopo aberto com a tabela de pagamento em branco e uma
      // conta que alguem vai ter que fazer na mao depois.
      parcelas: (m.modo === "parcelado")
        ? ajustarQtdParcelas(parcelasPadrao(), 4, orcado)
        : [],
      venc1: "", intervalo: "30",
      garantia: [...(m.garantia || [])],
      crono: JSON.parse(JSON.stringify(m.crono || [])),
      obs: String(m.obs || "").split("\n").map((t) => t.trim()).filter(Boolean),
    });
  }

  return (
    <form className="form-solicitacao form-escopo" onSubmit={submit}>
      <div className="form-solicitacao-title">Novo escopo de contratação</div>
      <div className="form-avulsa-nota">
        <b>{servicos.length}</b> {servicos.length === 1 ? "serviço" : "serviços"} de{" "}
        {verbas.length === 1 ? "1 verba" : `${verbas.length} verbas`} ·
        orçado em <b>{fmtBRL(orcado)}</b> de mão de obra.
      </div>
      <div className="form-row">
        <label className="form-label">Modelo de escopo
          <select className="form-select" value={modelo} onChange={(e) => setModelo(e.target.value)} required>
            <option value="">Escolha o modelo…</option>
            {grupos.map((g) => (
              <optgroup key={g.grupo} label={g.grupo}>
                {g.itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {sugerido && modelo === sugerido && <div className="form-dica">Sugerido pela verba dos serviços selecionados.</div>}
      </div>
      <div className="form-row">
        <label className="form-label">Fornecedor
          <input className="form-input" type="text" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}
            placeholder="Deixe em branco se ainda não definiu" />
        </label>
      </div>
      <div className="form-row form-row-3">
        <label className="form-label">Início<input className="form-input" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
        <label className="form-label">Fim<input className="form-input" type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
        <span />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-cancelar" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="btn-criar">Abrir escopo</button>
      </div>
    </form>
  );
}

/* O escopo aberto: a conta em cima, a folha embaixo.

   A conta nao vai pro papel — ela e pra quem decide assinar, nao pro
   fornecedor. O CSS de impressao esconde tudo menos a folha. */
function EscopoAberto({ escopo, obra, podeEditar, onMudar, onVoltar, onApagar }) {
  const dif = escopo.valorContrato != null ? escopo.valorContrato - escopo.orcado : null;
  const [valorTxt, setValorTxt] = useState(
    escopo.valorContrato != null ? mascaraMoeda(String(Math.round(escopo.valorContrato * 100))).texto : ""
  );
  const somaMed = (escopo.medicoes || []).reduce((a, m) => a + (parseFloat(String(m.p).replace(",", ".")) || 0), 0);

  return (
    <>
      <div className="escopo-topo naoimprime">
        <button className="btn-voltar" onClick={onVoltar}><ChevronLeft size={14} /> Voltar</button>
        <div className="escopo-titulo">
          <div className="escopo-nome">{escopo.nome}</div>
          <div className="escopo-banda">{escopo.fornecedor || "sem fornecedor"} · {escopo.servicos.length} {escopo.servicos.length === 1 ? "serviço" : "serviços"}</div>
        </div>
        <button className="btn-doc" onClick={() => baixarEscopoWord(escopo, obra)} title="Baixa um .doc que o Word abre editável">
          <Download size={13} /> Word
        </button>
        <button className="btn-doc" onClick={() => window.print()} title="Abre a impressão do navegador — escolha Salvar como PDF">
          <FileText size={13} /> PDF
        </button>
        {podeEditar && (
          <button className="btn-apagar-escopo" onClick={onApagar} title="Apagar este escopo">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="escopo-conta naoimprime">
        <div className="ec-bloco">
          <div className="ec-rot">Orçado no executivo</div>
          <div className="ec-val mono">{fmtBRL(escopo.orcado)}</div>
          <div className="ec-sub">{escopo.servicos.length} {escopo.servicos.length === 1 ? "serviço" : "serviços"}</div>
        </div>
        <div className="ec-bloco">
          <div className="ec-rot">Valor do contrato</div>
          {podeEditar ? (
            <input className="ec-input mono" type="text" placeholder="0,00" value={valorTxt}
              onChange={(e) => {
              const m = mascaraMoeda(e.target.value);
              setValorTxt(m.texto);
              /* Mudou o total, as parcelas redividem. Deixar o valor novo
                 em cima da divisao velha e a forma mais silenciosa de o
                 contrato somar diferente do que ele diz que vale. */
              const base = m.valor ?? escopo.orcado;
              onMudar({
                valorContrato: m.valor,
                ...(escopo.modo === "parcelado" && (escopo.parcelas || []).length
                  ? { parcelas: ratearParcelas(escopo.parcelas, base, true) }
                  : {}),
              });
            }} />
          ) : <div className="ec-val mono">{escopo.valorContrato != null ? fmtBRL(escopo.valorContrato) : "—"}</div>}
          <div className="ec-sub">o que o fornecedor cobrou</div>
        </div>
        <div className={`ec-bloco ec-dif ${dif == null ? "" : dif > 0 ? "ruim" : "ok"}`}>
          <div className="ec-rot">Diferença</div>
          <div className="ec-val mono">{dif == null ? "—" : `${dif > 0 ? "+" : ""}${fmtBRL(dif)}`}</div>
          <div className="ec-sub">
            {dif == null ? "lance o valor da proposta"
              : dif > 0 ? `${((dif / escopo.orcado) * 100).toFixed(0)}% acima do orçado`
              : dif === 0 ? "exatamente no orçado"
              : `${((-dif / escopo.orcado) * 100).toFixed(0)}% abaixo do orçado`}
          </div>
        </div>
      </div>

      {somaMed !== 100 && (escopo.medicoes || []).length > 0 && (
        <div className="aviso-migracao naoimprime">
          <AlertTriangle size={14} />
          <span>Os percentuais das medições somam <b>{somaMed}%</b>, não 100% — alguém paga a mais ou o fornecedor fica sem receber.</span>
        </div>
      )}

      <div className="escopo-campos naoimprime">
        <label className="form-label">Fornecedor
          <input className="form-input" type="text" value={escopo.fornecedor || ""} disabled={!podeEditar}
            onChange={(e) => onMudar({ fornecedor: e.target.value || null })} placeholder="—" />
        </label>
        <label className="form-label">Início
          <input className="form-input" type="date" value={escopo.inicio || ""} disabled={!podeEditar}
            onChange={(e) => onMudar({ inicio: e.target.value || null })} />
        </label>
        <label className="form-label">Fim
          <input className="form-input" type="date" value={escopo.fim || ""} disabled={!podeEditar}
            onChange={(e) => onMudar({ fim: e.target.value || null })} />
        </label>
      </div>

      {escopo.modo === "parcelado" && podeEditar && (
        <div className="parc-controles naoimprime">
          <div className="dash-rot">Parcelas</div>
          <div className="parc-linha">
            <label className="form-label">Quantas
              <input className="form-input" type="number" min="1" max="60"
                value={(escopo.parcelas || []).length || 1}
                onChange={(e) => onMudar({
                  parcelas: ajustarQtdParcelas(escopo.parcelas, Number(e.target.value), escopo.valorContrato ?? escopo.orcado),
                })} />
            </label>
            <label className="form-label">1º vencimento
              <input className="form-input" type="date" value={escopo.venc1 || ""}
                onChange={(e) => onMudar({ venc1: e.target.value })} />
            </label>
            <label className="form-label">Intervalo (dias)
              <input className="form-input" type="number" min="0" value={escopo.intervalo || "30"}
                onChange={(e) => onMudar({ intervalo: e.target.value })} />
            </label>
            {/* Vencimento cai sempre na sexta: a casa paga fornecedor
                nesse dia, e data no meio da semana volta pro financeiro
                pra ser remarcada. */}
            <button className="btn-doc" disabled={!escopo.venc1}
              onClick={() => onMudar({ parcelas: sugerirDatas(escopo.parcelas, escopo.venc1, escopo.intervalo) })}
              title={escopo.venc1 ? "Preenche os vencimentos de tantos em tantos dias, sempre numa sexta" : "Informe o 1º vencimento primeiro"}>
              <Clock size={13} /> Sugerir datas
            </button>
          </div>
        </div>
      )}

      <DocumentoEscopo escopo={escopo} obra={obra} podeEditar={podeEditar} onMudar={onMudar} />
    </>
  );
}

/* O escopo como DOCUMENTO, nao como formulario.

   O gerador de escopos da casa acerta nisso: a pessoa ve a folha que vai
   virar contrato, edita o texto ali mesmo e manda imprimir. Formulario
   com campos separados obriga a imaginar o resultado; folha mostra.

   PDF sai do window.print() com CSS de impressao — mesmo caminho do
   gerador. Word sai como HTML com o MIME do Word: abre editavel, que e
   o que a equipe faz depois (ajusta uma clausula, manda pro fornecedor). */
function DocumentoEscopo({ escopo, obra, podeEditar, onMudar }) {
  const base = escopo.valorContrato ?? escopo.orcado;
  const linhas = (t) => String(t || "").split("\n").filter(Boolean);

  return (
    <div className="doc-escopo" id="doc-escopo">
      <div className="doc-banda">{escopo.banda}</div>

      <div className="doc-cab">
        <div><span className="doc-rot">Obra</span> {obra.nome}</div>
        {obra.endereco && <div><span className="doc-rot">Endereço</span> {obra.endereco}</div>}
        <div><span className="doc-rot">Contratado</span> {escopo.fornecedor || "—"}</div>
        <div>
          <span className="doc-rot">Período</span>{" "}
          {escopo.inicio ? new Date(`${escopo.inicio}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
          {" a "}
          {escopo.fim ? new Date(`${escopo.fim}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
        </div>
        <div><span className="doc-rot">Valor</span> {escopo.valorContrato != null ? fmtBRL(escopo.valorContrato) : "a definir"}</div>
      </div>

      <h3 className="doc-h">1. Escopo dos serviços</h3>
      <div className="doc-itens">
        {(escopo.itens || []).map((i, k) => (
          i.tipo === "grupo" ? <div className="doc-grupo" key={k}>{i.d}</div>
          : i.tipo === "nota" ? <div className="doc-nota" key={k}>{i.d}</div>
          : (
            <div className="doc-item" key={k}>
              <span className="doc-qtd">{i.q} {i.u}</span>
              {/* Editavel na folha: e aqui que a equipe ajusta a clausula
                  pro caso da obra, sem sair pro Word antes da hora. */}
              <span className="doc-desc" contentEditable={podeEditar} suppressContentEditableWarning
                onBlur={(e) => {
                  const novo = e.currentTarget.innerText.trim();
                  if (novo === i.d) return;
                  onMudar({ itens: escopo.itens.map((x, n) => (n === k ? { ...x, d: novo } : x)) });
                }}>{i.d}</span>
              {i.amb && <span className="doc-amb">{i.amb}</span>}
            </div>
          )
        ))}
      </div>

      <h3 className="doc-h">2. {escopo.modo === "parcelado" ? "Forma de pagamento — parcelas" : "Forma de pagamento — medições"}</h3>
      {escopo.modo === "parcelado" ? (
        <table className="doc-tab">
          <thead><tr><th>Parcela</th><th style={{ width: 96 }}>Vencimento</th><th className="right" style={{ width: 110 }}>Valor</th><th style={{ width: 60 }}>Via</th></tr></thead>
          <tbody>
            {(escopo.parcelas || []).map((p, k) => (
              <tr key={k}>
                <td>{p.rot}</td>
                <td className="mono">{p.venc ? new Date(`${p.venc}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="right mono">{fmtBRL(Number(String(p.v).replace(",", ".")) || 0)}</td>
                <td>{p.via}</td>
              </tr>
            ))}
            {/* A soma fica no papel de proposito: e a linha que o
                fornecedor confere antes de assinar. */}
            <tr className="doc-total">
              <td colSpan={2}>Total</td>
              <td className="right mono"><b>{fmtBRL(somaParcelas(escopo.parcelas))}</b></td>
              <td />
            </tr>
          </tbody>
        </table>
      ) : (
      <table className="doc-tab">
        <thead><tr><th>Etapa</th><th className="center">%</th><th className="right">Valor</th><th>Via</th><th>Condição</th></tr></thead>
        <tbody>
          {(escopo.medicoes || []).map((m, k) => {
            const pct = parseFloat(String(m.p).replace(",", ".")) || 0;
            return (
              <tr key={k}>
                <td>{m.rot}</td>
                <td className="center mono">{m.p}%</td>
                <td className="right mono">{fmtBRL((base * pct) / 100)}</td>
                <td>{m.via}</td>
                <td className="doc-cond" contentEditable={podeEditar} suppressContentEditableWarning
                  onBlur={(e) => {
                    const novo = e.currentTarget.innerText.trim();
                    if (novo === m.cond) return;
                    onMudar({ medicoes: escopo.medicoes.map((x, n) => (n === k ? { ...x, cond: novo } : x)) });
                  }}>{m.cond}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      )}

      {(escopo.garantia || []).length > 0 && <>
        <h3 className="doc-h">3. Garantia</h3>
        <ul className="doc-ul">{escopo.garantia.map((g, k) => <li key={k}>{typeof g === "string" ? g : g.t}</li>)}</ul>
      </>}
      {(escopo.crono || []).length > 0 && <>
        <h3 className="doc-h">4. Cronograma</h3>
        <ul className="doc-ul">{escopo.crono.map((c, k) => <li key={k}>{typeof c === "string" ? c : (c.t || c.d)}</li>)}</ul>
      </>}
      {(escopo.obs || []).length > 0 && <>
        <h3 className="doc-h">{(escopo.crono || []).length ? 5 : 4}. Observações</h3>
        <ul className="doc-ul">{escopo.obs.map((o, k) => <li key={k}>{typeof o === "string" ? o : o.t}</li>)}</ul>
      </>}

      <div className="doc-rodape">
        Serviços deste escopo: {escopo.servicos.map((s) => `${s.catNum} ${s.desc}`).join(" · ")}
      </div>
    </div>
  );
}

/* Word de verdade, nao PDF renomeado.

   Word abre HTML como documento editavel quando o MIME e o dele. E o que
   a equipe precisa depois: ajustar uma clausula e mandar pro fornecedor
   sem ter que redigitar o escopo inteiro. O window.print() resolve o PDF,
   mas PDF ninguem edita. */
function baixarEscopoWord(escopo, obra) {
  const doc = document.getElementById("doc-escopo");
  if (!doc) return;
  const html = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">
<style>
 body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #111; }
 h3 { font-size: 12pt; margin: 18pt 0 6pt; border-bottom: 1px solid #999; padding-bottom: 3pt; }
 table { width: 100%; border-collapse: collapse; margin: 6pt 0; }
 th, td { border: 1px solid #bbb; padding: 5pt 7pt; font-size: 10pt; text-align: left; vertical-align: top; }
 th { background: #eee; }
 .doc-banda { font-size: 14pt; font-weight: bold; margin-bottom: 10pt; }
 .doc-rot { font-weight: bold; }
 .doc-grupo { font-weight: bold; margin: 10pt 0 4pt; }
 .doc-qtd { font-weight: bold; margin-right: 8pt; }
 .doc-item { margin-bottom: 5pt; }
 .center { text-align: center; } .right { text-align: right; }
</style></head><body>${doc.innerHTML}</body></html>`;
  const nome = `escopo-${(escopo.nome || "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase()}-${obra.codigo}.doc`;
  downloadFile(nome, html, "application/msword");
}


/* DASHBOARD MO — a base de orcado de um escopo.

   Quem pede um escopo precisa saber, ANTES de mandar pro fornecedor,
   quanto aquele conjunto de servicos valia no executivo. Selecionando os
   servicos aqui, a soma da mao de obra deles vira o teto: chegando a
   proposta, da pra dizer na hora se estourou.

   O contrato pode juntar verbas diferentes — o mesmo fornecedor as vezes
   pega gesso e pintura — entao a selecao atravessa os grupos. */
function DashboardMO({ obra, onItemChange, onCriarSolicitacao, onCriarEscopo, onMudarEscopo, onApagarEscopo, podeEditar }) {
  const [filtro, setFiltro] = useState("todos");
  const [abrindoEscopo, setAbrindoEscopo] = useState(false);
  const [escopoAberto, setEscopoAberto] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [abertos, setAbertos] = useState(() => new Set());

  const rows = useMemo(() => servicosMO(obra), [obra]);
  /* De qual escopo cada servico faz parte.

     A lupa fica na LINHA, nao numa lista separada em cima: o escopo e
     sobre aqueles servicos, e procurar por ele numa segunda lista e
     desfazer o vinculo que a pessoa acabou de criar. */
  const escopoDoServico = useMemo(() => {
    const m = new Map();
    (obra.escopos || []).forEach((e) => (e.servicos || []).forEach((sv) => m.set(`${sv.catNum}|${sv.codigo}`, e)));
    return m;
  }, [obra.escopos]);
  const naoBloq = rows.filter((r) => !contratoBloqueado(r.it));
  const bloqueados = rows.filter((r) => contratoBloqueado(r.it));

  const totalMO = naoBloq.reduce((a, r) => a + r.mo, 0);
  const contratado = naoBloq.filter((r) => contratoEtapa(r.it) !== "nao_solicitado").reduce((a, r) => a + r.mo, 0);
  const cntEtapa = (id) => naoBloq.filter((r) => contratoEtapa(r.it) === id).length;
  const somaEtapa = (id) => naoBloq.filter((r) => contratoEtapa(r.it) === id).reduce((a, r) => a + r.mo, 0);

  const visiveis = filtro === "todos" ? naoBloq : naoBloq.filter((r) => contratoEtapa(r.it) === filtro);
  const porVerba = useMemo(() => {
    const m = new Map();
    visiveis.forEach((r) => {
      if (!m.has(r.catNum)) m.set(r.catNum, { num: r.catNum, nome: r.catNome, itens: [], total: 0 });
      const g = m.get(r.catNum);
      g.itens.push(r); g.total += r.mo;
    });
    return [...m.values()];
  }, [visiveis]);

  const selecionados = naoBloq.filter((r) => sel.has(r.chave));
  const orcado = selecionados.reduce((a, r) => a + r.mo, 0);
  const verbasNaSelecao = new Set(selecionados.map((r) => r.catNum)).size;

  const alternar = (chave) => setSel((p) => { const n = new Set(p); n.has(chave) ? n.delete(chave) : n.add(chave); return n; });
  const alternarGrupo = (g) => setSel((p) => {
    const n = new Set(p);
    const todosDentro = g.itens.every((r) => n.has(r.chave));
    g.itens.forEach((r) => (todosDentro ? n.delete(r.chave) : n.add(r.chave)));
    return n;
  });
  const abrir = (num) => setAbertos((p) => { const n = new Set(p); n.has(num) ? n.delete(num) : n.add(num); return n; });

  if (rows.length === 0) {
    return (
      <div className="compras-empty">
        <FileText size={30} className="dim" />
        <div className="compras-empty-title">Esta obra ainda não tem mão de obra no executivo</div>
        <div className="compras-empty-sub">Quando o executivo for carregado, todos os serviços aparecem aqui com o valor de MO — que é a base de orçado de cada escopo. Ou crie uma solicitação avulsa abaixo.</div>
        <NovaSolicitacaoForm obra={obra} onCriar={onCriarSolicitacao} />
      </div>
    );
  }

  if (escopoAberto) {
    const e = (obra.escopos || []).find((x) => x.id === escopoAberto);
    if (!e) return null;
    return <EscopoAberto escopo={e} obra={obra} podeEditar={podeEditar}
      onMudar={(patch) => onMudarEscopo(e.id, patch)}
      onVoltar={() => setEscopoAberto(null)}
      onApagar={() => {
        if (window.confirm(`Apagar o escopo "${e.nome}"?\n\nOs serviços continuam na obra — some só o documento.`)) {
          onApagarEscopo(e.id);
          setEscopoAberto(null);
        }
      }} />;
  }

  if (abrindoEscopo) {
    return <FormNovoEscopo obra={obra} servicos={selecionados}
      onCancelar={() => setAbrindoEscopo(false)}
      onCriar={(dados) => {
        const id = onCriarEscopo(dados);
        setAbrindoEscopo(false);
        setSel(new Set());
        setEscopoAberto(id);
      }} />;
  }

  return (
    <>
      <div className="mo-topo">
        <div className="mo-num">
          <div className="mo-num-val mono">{fmtBRL(totalMO)}</div>
          <div className="mo-num-rot">de mão de obra no executivo · {naoBloq.length} serviços</div>
        </div>
        <div className="mo-num">
          <div className="mo-num-val mono dim">{fmtBRL(contratado)}</div>
          <div className="mo-num-rot">já em processo de contratação</div>
        </div>
        <div className="mo-num">
          <div className="mo-num-val mono">{fmtBRL(totalMO - contratado)}</div>
          <div className="mo-num-rot">ainda a contratar</div>
        </div>
        <NovaSolicitacaoForm obra={obra} onCriar={onCriarSolicitacao} />
      </div>

      <div className="pipeline">
        {CONTRATO_PIPELINE.map((st, i) => (
          <React.Fragment key={st.id}>
            <button className={`pipe-node ${filtro === st.id ? "active" : ""}`}
              style={filtro === st.id ? { borderColor: st.color } : undefined}
              onClick={() => setFiltro(filtro === st.id ? "todos" : st.id)}>
              <div className="pipe-count" style={{ color: st.color }}>{cntEtapa(st.id)}</div>
              <div className="pipe-label">{st.curto}</div>
              <div className="pipe-val mono">{fmtCompactBRL(somaEtapa(st.id))}</div>
            </button>
            {i < CONTRATO_PIPELINE.length - 1 && <ChevronRight size={14} className="pipe-arrow dim" />}
          </React.Fragment>
        ))}
      </div>

      {bloqueados.length > 0 && (
        <div className="compras-alerta">
          <AlertTriangle size={16} />
          <span><b>{bloqueados.length} {bloqueados.length === 1 ? "serviço bloqueado" : "serviços bloqueados"}</b> — aguardando aprovação de escopo antes de solicitar contrato</span>
        </div>
      )}

      {porVerba.length === 0 && <div className="empty-note">Nada nesta etapa.</div>}
      {porVerba.map((g) => {
        const aberto = abertos.has(g.num);
        const nSel = g.itens.filter((r) => sel.has(r.chave)).length;
        return (
          <div className="grp-block" key={g.num}>
            <div className="grp-head">
              <button className="mo-check" onClick={() => alternarGrupo(g)}
                title={nSel === g.itens.length ? "Tirar o grupo da seleção" : "Selecionar o grupo inteiro"}
                aria-label="Selecionar grupo">
                {nSel === g.itens.length ? <Check size={13} /> : nSel > 0 ? <Minus size={13} /> : null}
              </button>
              <button className="grp-toggle" onClick={() => abrir(g.num)}>
                <div className="grp-esq">
                  {aberto ? <ChevronDown size={15} className="dim" /> : <ChevronRight size={15} className="dim" />}
                  <span className="grp-num mono">{g.num}</span>
                  <span className="grp-nome">{g.nome}</span>
                  <span className="grp-conta">{g.itens.length} {g.itens.length === 1 ? "serviço" : "serviços"}</span>
                  {nSel > 0 && <span className="grp-avulsos">{nSel} no escopo</span>}
                </div>
              </button>
              <div className="grp-dir">
                <div className="grp-tot">
                  <div className="grp-tot-rot">MÃO DE OBRA</div>
                  <div className="grp-tot-val mono">{fmtBRL(g.total)}</div>
                </div>
              </div>
            </div>
            {aberto && (
              <div className="grp-itens">
                <div className="compras-list">
                  {g.itens.map((r) => {
                    const esc = escopoDoServico.get(`${r.catNum}|${r.it.codigo}`);
                    return (
                      <div className={`mo-linha ${sel.has(r.chave) ? "sel" : ""} ${esc ? "com-escopo" : ""}`} key={r.chave}>
                        <button className="mo-check" onClick={() => alternar(r.chave)} aria-label="Selecionar serviço">
                          {sel.has(r.chave) && <Check size={13} />}
                        </button>
                        <ContratosRow row={r} onItemChange={(patch) => onItemChange(r.catIdx, r.itemIdx, patch)} />
                        <div className="mo-valor mono">{fmtBRL(r.mo)}</div>
                        {esc ? (
                          <button className="btn-lupa" onClick={() => setEscopoAberto(esc.id)}
                            title={`Ver o escopo "${esc.nome}"${esc.fornecedor ? ` — ${esc.fornecedor}` : ""}`}>
                            <Search size={14} />
                          </button>
                        ) : <span className="btn-lupa-vazio" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* A barra de escopo so existe quando ha selecao. Ela e o unico
          lugar da tela onde o numero que importa aparece somado: e contra
          ele que a proposta do fornecedor vai ser comparada. */}
      {selecionados.length > 0 && (
        <div className="mo-escopo-barra">
          <div>
            <div className="mo-escopo-val mono">{fmtBRL(orcado)}</div>
            <div className="mo-escopo-rot">
              orçado em {selecionados.length} {selecionados.length === 1 ? "serviço" : "serviços"}
              {verbasNaSelecao > 1 ? ` de ${verbasNaSelecao} verbas` : ""}
            </div>
          </div>
          {podeEditar && (
            <button className="btn-abrir-escopo" onClick={() => setAbrindoEscopo(true)}>
              <FileText size={13} /> Abrir escopo
            </button>
          )}
          <button className="btn-limpar-sel" onClick={() => setSel(new Set())}>Limpar seleção</button>
        </div>
      )}
    </>
  );
}

/* ============================================================
   MÓDULO GESTÃO DE COMPRAS E CONTRATAÇÕES
   O painel que existe FORA da obra: todas as obras lado a lado,
   e o volume por verba somando todas elas.
   ============================================================ */

const HORIZONTES = [
  { dias: null, rot: "Tudo" },
  { dias: 28, rot: "4 semanas" },
  { dias: 56, rot: "8 semanas" },
  { dias: 84, rot: "12 semanas" },
];

/* MAT azul, MO roxo. O crachá de alocação usa azul e CINZA, e cinza não
   lê como cor num painel — as duas metades precisam pesar igual aqui. */
const COR_MAT = "var(--blue)";
const COR_MO = "var(--purple)";

function GcBarra({ pct, cor }) {
  return (
    <div className="gc-track" title={`${Math.round(pct)}%`}>
      <div className="gc-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: cor }} />
    </div>
  );
}

function GcTotal({ rot, feito, total, cor, legenda }) {
  const pct = total > 0 ? (feito / total) * 100 : 0;
  return (
    <div className="gc-total">
      <div className="gc-total-rot" style={{ color: cor }}>{rot}</div>
      <div className="gc-total-val mono">{fmtBRL(total - feito)}</div>
      <div className="gc-total-sub">{legenda}</div>
      <GcBarra pct={pct} cor={cor} />
      <div className="gc-total-pe">
        <span className="mono">{fmtBRL(feito)}</span> de <span className="mono">{fmtBRL(total)}</span>
        <b> · {Math.round(pct)}%</b>
      </div>
    </div>
  );
}

/* A lista por verba somando todas as obras. É o pedido central: saber o
   volume de pintura das próximas semanas antes de precisar dele. */
/* `busca`/`onBusca` sao opcionais: so a lista por insumo tem filtro de
   texto, a por verba nao pediu. `onAbrir` e' o que faz a obra da linha
   expandida ser clicavel — sem ele a linha so mostra, nao navega. `abas`
   e' opcional tambem: {valor, onMudar, opcoes:[{id,label}]} — quando
   existe mais de um jeito de agrupar a MESMA lista (por categoria, por
   produto), o alternador fica junto do titulo, "la em cima". */
function GcPorVerba({ titulo, Icone, grupos, cor, vazio, busca, onBusca, buscaPlaceholder, onAbrir, abas }) {
  const total = grupos.reduce((a, g) => a + g.total, 0);
  const max = grupos.length ? grupos[0].total : 1;
  return (
    <div className="gc-bloco">
      <div className="gc-bloco-head">
        <Icone size={15} style={{ color: cor }} />
        <span className="gc-bloco-titulo">{titulo}</span>
        {abas && (
          <div className="gc-abas">
            {abas.opcoes.map((op) => (
              <button key={op.id} type="button" className={`gc-aba ${abas.valor === op.id ? "on" : ""}`}
                onClick={() => abas.onMudar(op.id)}>{op.label}</button>
            ))}
          </div>
        )}
        <span className="gc-bloco-total mono" style={{ color: cor }}>{fmtBRL(total)}</span>
      </div>
      {onBusca && (
        <div className="gc-busca">
          <Search size={13} className="dim" />
          <input value={busca} onChange={(e) => onBusca(e.target.value)}
            placeholder={buscaPlaceholder || "Buscar…"} />
          {busca && (
            <button type="button" className="gc-busca-limpar" onClick={() => onBusca("")} aria-label="Limpar busca">
              <X size={13} />
            </button>
          )}
        </div>
      )}
      {grupos.length === 0 ? (
        <div className="empty-note">{busca ? `Nada encontrado para "${busca}".` : vazio}</div>
      ) : (
        <div className="gc-list">
          {grupos.map((g) => (
            <GcLinhaVerba key={g.num ?? g.nome} g={g} cor={cor} max={max} onAbrir={onAbrir} />
          ))}
        </div>
      )}
    </div>
  );
}

/* A linha some fechada e mostra "N obras" — abrir ela e' a resposta pra
   "de qual obra vem esse total", sem precisar ir obra por obra. */
/* "6 un" quando so tem uma unidade; "6 un · 3 cj" quando mistura —
   nunca finge que é uma coisa só. Sem quantidade nenhuma (fora do
   subgrupo, ou planilha sem a coluna), some — não vira "0 un". */
function fmtQtds(qtds) {
  if (!qtds || qtds.size === 0) return "";
  return [...qtds.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([un, q]) => `${Number.isInteger(q) ? q : q.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${un}`)
    .join(" · ");
}

function GcLinhaVerba({ g, cor, max, onAbrir }) {
  const [aberto, setAberto] = useState(false);
  const porObra = useMemo(
    () => [...g.obras.values()].sort((a, b) => b.valor - a.valor),
    [g.obras]);
  const qtdTxt = g.qtds && fmtQtds(g.qtds);
  return (
    <div className="gc-verba">
      <button type="button" className="gc-row gc-row-clic" onClick={() => setAberto((x) => !x)}>
        <ChevronRight size={13} className={`gc-chevron ${aberto ? "aberto" : ""}`} />
        {g.num != null && <span className="gc-num mono">{g.num}</span>}
        <span className="gc-nome">{g.nome}</span>
        <span className="gc-obras">{g.obras.size} {g.obras.size === 1 ? "obra" : "obras"}</span>
        <GcBarra pct={(g.total / max) * 100} cor={cor} />
        {g.qtds && <span className="gc-qtd mono dim">{qtdTxt}</span>}
        <span className="gc-val mono">{fmtBRL(g.total)}</span>
      </button>
      {aberto && (
        <div className="gc-verba-obras">
          {porObra.map((o) => (
            <button key={o.codigo} type="button" className="gc-verba-obra"
              onClick={() => onAbrir && onAbrir(o.id)} disabled={!onAbrir}>
              <span className="mono dim">#{o.codigo}</span>
              <span className="gc-verba-obra-nome">{o.nome}</span>
              {o.qtds && <span className="mono dim gc-verba-obra-qtd">{fmtQtds(o.qtds)}</span>}
              <span className="mono">{fmtBRL(o.valor)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GcLinhaObra({ L, onAbrir }) {
  const [aberto, setAberto] = useState(false);
  const atrasada = L.atrasos.length > 0;
  const entrega = L.dataEntrega
    ? new Date(`${L.dataEntrega}T12:00:00`).toLocaleDateString("pt-BR")
    : null;

  return (
    <>
      <tr className={atrasada ? "gc-obra atrasada" : "gc-obra"}>
        <td>
          <button className="gc-obra-nome" onClick={() => onAbrir(L.id)} title="Abrir esta obra">
            <span className="mono dim">#{L.codigo}</span> {L.nome}
          </button>
        </td>
        <td className="center">
          {entrega ? (
            <span className={L.faltamEntrega < 0 ? "gc-venceu" : ""}>
              {entrega}
              <span className="gc-dias">{L.faltamEntrega < 0
                ? `${-L.faltamEntrega} d atrás`
                : `em ${L.faltamEntrega} d`}</span>
            </span>
          ) : <span className="gc-sem-data">sem data</span>}
        </td>
        {/* O flex vai num <div>, nunca no proprio <td>: celula de tabela
            com display:flex deixa de se comportar como celula, e as duas
            colunas de valor caem uma embaixo da outra. */}
        <td>
          <div className="gc-cel-barra">
            <GcBarra pct={L.mat.pct} cor={COR_MAT} />
            <span className="gc-cel-txt mono">{fmtBRL(L.mat.falta)}</span>
          </div>
        </td>
        <td>
          <div className="gc-cel-barra">
            <GcBarra pct={L.mo.pct} cor={COR_MO} />
            <span className="gc-cel-txt mono">{fmtBRL(L.mo.falta)}</span>
          </div>
        </td>
        <td className="center">
          {atrasada ? (
            <button className="gc-selo atraso" onClick={() => setAberto((x) => !x)}>
              <AlertTriangle size={11} /> {L.atrasos.length} atrasada{L.atrasos.length > 1 ? "s" : ""}
            </button>
          ) : L.perto.length > 0 ? (
            <button className="gc-selo perto" onClick={() => setAberto((x) => !x)}>
              <Clock size={11} /> {L.perto.length} perto do prazo
            </button>
          ) : <span className="dim">—</span>}
        </td>
      </tr>
      {aberto && (
        <tr className="gc-detalhe">
          <td colSpan={5}>
            {[...L.atrasos.map((v) => ({ ...v, tipo: "atraso" })),
              ...L.perto.map((v) => ({ ...v, tipo: "perto" }))].map((v) => (
              <div key={v.num + v.tipo} className={`gc-prazo ${v.tipo}`}>
                <span className="mono">{v.num}</span>
                <span className="gc-prazo-nome">{v.nome}</span>
                <span className="gc-prazo-quando">
                  comprar até {v.quandoMat.toLocaleDateString("pt-BR")}
                  {v.prazo?.fornecedor ? ` (${v.prazo.fornecedor}, ${v.prazo.dias} d)` : ` (${v.prazo.dias} d antes da entrega)`}
                  {v.dias < 0 ? ` — venceu há ${-v.dias} dias` : ` — faltam ${v.dias} dias`}
                </span>
                <span className="mono gc-prazo-val">{fmtBRL(v.matFalta)}</span>
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

/* O FILTRO DE OBRAS — o mesmo nos tres paineis.

   Cada tela tinha inventado o seu: chips aqui, nada ali, "escolha a obra"
   acola. Tres jeitos de fazer a mesma coisa e' tres coisas pra aprender,
   e a que a pessoa usou ontem nao ajuda na de hoje.

   Comecou como uma fileira de chips, um por obra. Com as seis de hoje
   dava certo; com as quarenta e poucas que existem seria um muro de
   texto ocupando meia tela — e o filtro que ninguem le e' o filtro que
   ninguem usa.

   Entao: botao que diz quantas estao escolhidas, e uma lista com busca
   por tras. A lista rola; a busca acha por nome OU por codigo, porque
   quem trabalha nisso pensa em "2506" tanto quanto em "Salt". */
/* Escolher UMA obra.
 *
 * Espelha o FiltroObras de proposito. Ele ja resolve "achar uma obra
 * entre quarenta" — busca, Escape, clique fora, lista rolavel — e esta
 * na MESMA tela, quarenta pixels acima. Um grid de cartoes ao lado dele
 * seria uma segunda gramatica pro mesmo gesto, e a que nao escala.
 *
 * Agrupa por squad porque e' assim que ela procura obra: primeiro a
 * equipe, depois o nome. */
function EscolherObra({ obras, numeroDe, onEscolher, onFechar }) {
  const [busca, setBusca] = useState("");
  const caixa = useRef(null);

  useEffect(() => {
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) onFechar(); };
    const esc = (e) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [onFechar]);

  const grupos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const achadas = t
      ? obras.filter((o) => `${o.codigo} ${o.nome} ${o.squad || ""}`.toLowerCase().includes(t))
      : obras;
    const por = {};
    achadas.forEach((o) => { (por[o.squad || "Outras obras"] ||= []).push(o); });
    Object.values(por).forEach((l) => l.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    return Object.keys(por).sort((a, b) => a.localeCompare(b, "pt-BR")).map((k) => [k, por[k]]);
  }, [obras, busca]);

  const quantas = grupos.reduce((n, [, l]) => n + l.length, 0);

  return (
    <div className="fo-menu fo-menu-dir" ref={caixa}>
      <input className="form-input fo-busca" autoFocus value={busca}
        placeholder="nome, código ou squad…" onChange={(e) => setBusca(e.target.value)} />

      <div className="fo-lista eo-lista">
        {quantas === 0 && <div className="empty-note">Nenhuma obra com esse nome ou código.</div>}
        {grupos.map(([squad, lista]) => (
          <div key={squad}>
            <div className="eo-squad"><IconeSquad nome={squad} size={11} /> {squad}</div>
            {lista.map((o) => (
              <button key={o.codigo} className="fo-item eo-item" onClick={() => onEscolher(o)}>
                <span className="mono dim">#{o.codigo}</span>
                <span className="fo-nome">{o.nome}</span>
                {/* O numero e' confirmacao, nao criterio de escolha:
                    fica na coluna da direita, apagado. */}
                <span className="eo-num mono">{numeroDe(o)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FiltroObras({ obras, escolhidas, onMudar }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const achadas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return obras;
    return obras.filter((o) => `${o.codigo} ${o.nome}`.toLowerCase().includes(t));
  }, [obras, busca]);

  const alternar = (cod) => {
    const n = new Set(escolhidas);
    n.has(cod) ? n.delete(cod) : n.add(cod);
    onMudar(n);
  };

  const rotulo = escolhidas.size === 0
    ? `Todas as ${obras.length} obras`
    : escolhidas.size === 1
      ? (obras.find((o) => escolhidas.has(o.codigo))?.nome || "1 obra")
      : `${escolhidas.size} de ${obras.length} obras`;

  return (
    <div className="fo-caixa" ref={caixa}>
      <button className={`fo-btn ${escolhidas.size ? "on" : ""}`} onClick={() => setAberto((x) => !x)}>
        <Building2 size={13} />
        <span className="fo-rot">{rotulo}</span>
        <ChevronDown size={13} />
      </button>

      {aberto && (
        <div className="fo-menu">
          <input className="form-input fo-busca" autoFocus value={busca}
            placeholder="nome ou código da obra…" onChange={(e) => setBusca(e.target.value)} />

          <div className="fo-acoes">
            <button onClick={() => onMudar(new Set())} disabled={escolhidas.size === 0}>Todas</button>
            {/* "Marcar as encontradas" e' o que torna a busca util: filtrar
                por "Salt" e marcar as tres de uma vez, em vez de tres
                cliques mirados numa lista de quarenta. */}
            <button onClick={() => onMudar(new Set([...escolhidas, ...achadas.map((o) => o.codigo)]))}
              disabled={!busca.trim() || achadas.length === 0}>
              Marcar as {achadas.length} encontradas
            </button>
          </div>

          <div className="fo-lista">
            {achadas.length === 0 && <div className="empty-note">Nenhuma obra com esse nome ou código.</div>}
            {achadas.map((o) => (
              <button key={o.codigo} className={`fo-item ${escolhidas.has(o.codigo) ? "on" : ""}`}
                onClick={() => alternar(o.codigo)} title={o.nome}>
                <span className="fo-check">{escolhidas.has(o.codigo) && <Check size={11} />}</span>
                <span className="mono dim">#{o.codigo}</span>
                <span className="fo-nome">{o.nome}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* As escolhidas ficam a vista e sao removiveis com um clique. Ate
          seis; passando disso o resumo cabe melhor que a fileira. */}
      {escolhidas.size > 0 && escolhidas.size <= 6 && (
        <div className="fo-marcadas">
          {obras.filter((o) => escolhidas.has(o.codigo)).map((o) => (
            <button key={o.codigo} className="fo-tag" onClick={() => alternar(o.codigo)}
              title="Tirar do filtro">
              <span className="mono">#{o.codigo}</span> <X size={10} />
            </button>
          ))}
        </div>
      )}
      {escolhidas.size > 6 && (
        <button className="fo-limpar" onClick={() => onMudar(new Set())}>limpar filtro</button>
      )}
    </div>
  );
}

function GestaoComprasView({ obras, carregando, erro, onAbrir }) {
  const [horizonte, setHorizonte] = useState(null);
  /* Vazio quer dizer TODAS. Guardar o conjunto das escolhidas, e nao um
     "todas: sim/nao" separado, evita o estado impossivel de estar em
     "todas" com obra marcada. */
  const [escolhidas, setEscolhidas] = useState(() => new Set());

  /* A lista de chips sai do resumo SEM filtro: ela precisa continuar
     inteira depois de filtrar, senao quem escolhe uma obra perde o
     caminho de volta pras outras. */
  const comDados = useMemo(
    () => resumoGeral(obras, {}).linhas.map((L) => ({ codigo: L.codigo, nome: L.nome })),
    [obras]);

  const visiveis = useMemo(
    () => (escolhidas.size ? obras.filter((o) => escolhidas.has(String(o.codigo))) : obras),
    [obras, escolhidas]);
  const r = useMemo(() => resumoGeral(visiveis, { horizonteDias: horizonte }), [visiveis, horizonte]);
  const t = r.totais;

  const [buscaInsumo, setBuscaInsumo] = useState("");
  /* Duas leituras do mesmo material: por categoria (pronta, mas só cobre
     quem já tem regra de subgrupo) e por produto (a descrição exata,
     sempre disponível, mais linhas). A mesma busca serve pras duas —
     trocar a visão não deveria obrigar a digitar de novo. */
  const [visaoInsumo, setVisaoInsumo] = useState("categoria");
  /* Nenhuma das duas respeita o horizonte de cima (ainda) — a data de
     necessidade e' calculada por verba, nao por item, e juntar as duas
     coisas exigiria recalcular data item a item. Por enquanto as listas
     mostram tudo que falta comprar, sem recorte de prazo. */
  const porInsumo = useMemo(() => resumoPorInsumo(visiveis), [visiveis]);
  const porProduto = useMemo(() => resumoPorProduto(visiveis), [visiveis]);
  const gruposInsumo = visaoInsumo === "produto" ? porProduto : porInsumo;
  const gruposInsumoFiltrado = useMemo(() => {
    const alvo = semAcentos(buscaInsumo).trim();
    return alvo ? gruposInsumo.filter((g) => semAcentos(g.nome).includes(alvo)) : gruposInsumo;
  }, [gruposInsumo, buscaInsumo]);

  if (carregando) return <div className="empty-note">Carregando as obras…</div>;

  return (
    <>
      {erro && <div className="aviso-migracao"><AlertTriangle size={14} /> <span>{erro}</span></div>}

      <div className="gc-topo">
        <div className="gc-horizonte">
          <span className="gc-horizonte-rot">Preciso resolver nas</span>
          {HORIZONTES.map((h) => (
            <button key={h.rot} className={`gc-chip ${horizonte === h.dias ? "on" : ""}`}
              onClick={() => setHorizonte(h.dias)}>{h.rot}</button>
          ))}
        </div>
        <span className="gc-topo-info">
          {r.linhas.length} {r.linhas.length === 1 ? "obra" : "obras"}
          {escolhidas.size > 0 ? " no filtro" : " com planilha"}
          {t.obrasAtrasadas > 0 && <b className="gc-topo-alerta"> · {t.obrasAtrasadas} com compra atrasada</b>}
        </span>
      </div>

      {comDados.length > 1 && (
        <div className="gc-obras-filtro">
          <span className="gc-horizonte-rot">Obras</span>
          <FiltroObras obras={comDados} escolhidas={escolhidas} onMudar={setEscolhidas} />
        </div>
      )}

      <div className="gc-totais">
        <GcTotal rot="A COMPRAR — MATERIAL" cor={COR_MAT} legenda="ainda não comprado"
          feito={t.matFeito} total={t.matTotal} />
        <GcTotal rot="A CONTRATAR — MÃO DE OBRA" cor={COR_MO} legenda="ainda não solicitado"
          feito={t.moFeito} total={t.moTotal} />
      </div>

      {/* O que ela mais pediu vem primeiro: o volume por verba, somando
          todas as obras, é o que permite chegar no fornecedor com
          previsão em vez de pedido urgente. */}
      <GcPorVerba titulo="Mão de obra a contratar, por verba" Icone={FileText}
        grupos={r.aContratar} cor={COR_MO} onAbrir={onAbrir}
        vazio={horizonte ? "Nada a contratar dentro desse prazo." : "Nada a contratar."} />
      <GcPorVerba titulo="Material a comprar, por verba" Icone={ShoppingCart}
        grupos={r.aComprar} cor={COR_MAT} onAbrir={onAbrir}
        vazio={horizonte ? "Nada a comprar dentro desse prazo." : "Nada a comprar."} />
      {/* Mesma pergunta, outro corte: nao "quanto falta na verba 27" e
          sim "quanto falta comprar de colchão" — pra isso a linha precisa
          ser o insumo, e nao o grupo da EAP. "Por categoria" ainda so
          cobre as verbas que já têm regra de subgrupo (resto cai em "Sem
          categoria", visível); "Por produto" usa a descrição exata do
          item, sempre disponível, ao custo de mais linhas parecidas —
          é pra isso que a busca serve. */}
      <GcPorVerba
        titulo={visaoInsumo === "produto" ? "Material a comprar, por produto" : "Material a comprar, por insumo"}
        Icone={Package}
        grupos={gruposInsumoFiltrado} cor={COR_MAT} onAbrir={onAbrir}
        busca={buscaInsumo} onBusca={setBuscaInsumo}
        buscaPlaceholder={visaoInsumo === "produto" ? "Buscar produto — ex: colchão" : "Buscar insumo — ex: colchão"}
        vazio="Nada a comprar."
        abas={{
          valor: visaoInsumo, onMudar: setVisaoInsumo,
          opcoes: [{ id: "categoria", label: "Por categoria" }, { id: "produto", label: "Por produto" }],
        }} />

      {r.semData > 0 && (
        <div className="gc-nota-semdata">
          <AlertTriangle size={13} />
          <span>
            <b>{fmtBRL(r.semData)}</b> ficou fora do recorte por estar em obra <b>sem data de entrega</b>.
            Sem a data não há como saber se cai nessas semanas — preencha a entrega no Dashboard da obra.
          </span>
        </div>
      )}

      <div className="gc-bloco">
        <div className="gc-bloco-head">
          <Building2 size={15} />
          <span className="gc-bloco-titulo">Obra por obra</span>
        </div>
        <div className="grp-itens gc-tabela">
          <table>
            <thead>
              <tr>
                <th>Obra</th>
                <th style={{ width: 130 }} className="center">Entrega</th>
                <th style={{ width: 190 }}>Comprado · falta</th>
                <th style={{ width: 190 }}>Contratado · falta</th>
                <th style={{ width: 130 }} className="center">Prazos</th>
              </tr>
            </thead>
            <tbody>
              {r.linhas.length === 0 && (
                <tr><td colSpan={5}><div className="empty-note">Nenhuma obra ativa tem planilha carregada ainda.</div></td></tr>
              )}
              {r.linhas.map((L) => <GcLinhaObra key={L.codigo} L={L} onAbrir={onAbrir} />)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   MÓDULO ADITIVOS
   Supressão, adição e o saldo entre as duas — guardado por obra,
   numerado, com status, e com o documento aparecendo do lado
   enquanto se digita.

   A pré-visualização ao vivo não é enfeite: o documento vai pro
   cliente, e o que se digita num formulário nunca se parece com
   o que sai impresso. Ver enquanto escreve é o que evita mandar
   o PDF e só então descobrir a linha torta.
   ============================================================ */

const dataBR = (iso) => {
  if (!iso) return "";
  const [a, m, d] = String(iso).split("-");
  return `${d}/${m}/${a}`;
};
const numBR = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Linhas de cabeçalho da descrição ("Inclui neste projeto:", "Descrição
   Técnica:") vêm em negrito no modelo da empresa. */
const CHEFES = /^\s*(inclui neste projeto|descri[çc][ãa]o t[ée]cnica|material|ferragens)/i;

function DescricaoDoc({ texto }) {
  return String(texto || "").split("\n").map((l, i) => (
    <React.Fragment key={i}>
      {CHEFES.test(l) ? <span className="ad-dt1">{l}</span> : l}
      {"\n"}
    </React.Fragment>
  ));
}

function SecaoDoc({ grupos, titulo, classe }) {
  const usados = (grupos || []).filter((g) => g.nome.trim() || (g.itens || []).some((i) => i.descricao.trim()));
  if (!usados.length) return null;
  return (
    <div className={classe}>
      <div className="ad-sectitle">{titulo}</div>
      <table className="ad-dt">
        <thead>
          <tr>
            <th className="c-cod">Item</th><th>Descrição</th><th className="c-amb">Ambiente</th>
            <th className="c-qtd">Qtd</th><th className="c-un">Un.</th>
            <th className="c-vu">V. unit.</th><th className="c-vt">Total</th>
          </tr>
        </thead>
        <tbody>
          {usados.map((g) => (
            <React.Fragment key={g.id}>
              <tr className="g">
                <td className="c-cod">{g.num}</td>
                <td colSpan={5}>{g.nome}</td>
                <td className="c-vt">{fmtBRL(totalGrupo(g))}</td>
              </tr>
              {(g.itens || []).map((it, ii) => (
                (!it.descricao.trim() && !parseNumAd(it.valor)) ? null : (
                  <tr key={it.id}>
                    <td className="c-cod">{g.num}.{ii + 1}</td>
                    <td className="ad-desc"><DescricaoDoc texto={it.descricao} /></td>
                    <td className="c-amb">{it.ambiente}</td>
                    <td className="c-qtd">{numBR(parseNumAd(it.qtd))}</td>
                    <td className="c-un">{it.unidade}</td>
                    <td className="c-vu">{fmtBRL(parseNumAd(it.valor))}</td>
                    <td className="c-vt">{fmtBRL(totalItem(it))}</td>
                  </tr>
                )
              ))}
            </React.Fragment>
          ))}
          <tr className="tot">
            <td colSpan={6}>Total {titulo}</td>
            <td className="c-vt">{fmtBRL(totalSecao(usados))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DocumentoAditivo({ doc, numero }) {
  const t = totaisDoDocumento(doc);
  const vazio = !(doc.supressao || []).some((g) => g.nome.trim() || g.itens.some((i) => i.descricao.trim()))
    && !(doc.adicao || []).some((g) => g.nome.trim() || g.itens.some((i) => i.descricao.trim()));

  return (
    <div className="ad-page" id="doc-aditivo">
      <img className="ad-brandbar" src={LOGO_WS} alt="" />
      <div className="ad-inner">
        <div className="ad-dochead">
          <div className="t">Proposta de Aditivo{numero ? ` ${numero}` : ""}</div>
          <div className="meta">
            <div><b>Cliente:</b> {doc.cliente || "—"}</div>
            <div><b>Proposta:</b> {doc.proposta || "—"}</div>
            <div><b>Data:</b> {dataBR(doc.data) || "—"}</div>
          </div>
        </div>

        {vazio ? (
          <div className="ad-docwarn">Preencha ao menos um grupo com itens para o documento aparecer aqui.</div>
        ) : (
          <>
            <SecaoDoc grupos={doc.supressao} titulo="supressão" classe="ad-sec-sup" />
            <SecaoDoc grupos={doc.adicao} titulo="adição" classe="ad-sec-adi" />
          </>
        )}

        <div className="ad-saldo">
          <div className="l"><span>Total supressão</span><b>{fmtBRL(t.supressao)}</b></div>
          <div className="l"><span>Total adição</span><b>{fmtBRL(t.adicao)}</b></div>
          <div className={`l f ${t.saldo < 0 ? "credito" : ""}`}>
            <span>{rotuloSaldo(t.saldo)}</span><b>{fmtBRL(t.saldo)}</b>
          </div>
        </div>

        {String(doc.cond || "").trim() && (
          <div className="ad-cond">
            <h4>Condições de pagamento:</h4>
            <p>{doc.cond}</p>
          </div>
        )}

        {/* A clausula de prevalencia.

            Texto fixo, em toda proposta de aditivo: aditivo mexe no que
            ja tinha sido aprovado, e sem isso escrito duas versoes
            assinadas do mesmo escopo ficariam valendo ao mesmo tempo.

            Pequena e cinza de proposito. Ela precisa ESTAR no documento,
            nao competir com ele — o que o cliente le e' o que muda e
            quanto custa. */}
        <div className="ad-prevalencia">
          As alterações deste aditivo substituem e alteram diretamente o que havia sido aprovado
          anteriormente. Portanto, para todos os efeitos, passa a ser considerada válida a última
          aprovação realizada neste aditivo, prevalecendo sobre as aprovações anteriores.
        </div>
      </div>
      <div className="ad-pagefoot"><img src={RODAPE_WS} alt="" /></div>
    </div>
  );
}

/* A busca no executivo, embaixo do campo de descrição.

   Aparece sozinha enquanto a pessoa digita e some assim que ela escolhe —
   ou nunca aparece, se ela preferir escrever à mão. Digitar continua
   sendo o caminho: obra sem executivo carregado, item que não está na
   planilha, descrição que ela quer diferente. */
function BuscaExecutivo({ itens, termo, ativo, onEscolher }) {
  const achados = useMemo(() => (ativo ? acharNoExecutivo(itens, termo) : []), [itens, termo, ativo]);
  if (!achados.length) return null;
  return (
    <div className="ad-busca">
      <div className="ad-busca-rot">no executivo da obra</div>
      {achados.map((x) => (
        <button key={x.chave} className="ad-busca-item" onClick={() => onEscolher(x)} title={x.desc}>
          <span className="mono dim">{x.catNum}</span>
          <span className="ad-busca-desc">{x.desc}</span>
          {x.ambiente && <span className="ad-busca-amb">{x.ambiente}</span>}
          <span className="mono ad-busca-qtd">{x.qtd} {x.un}</span>
          <span className="mono ad-busca-val">{fmtBRL(x.valorUnit)}</span>
        </button>
      ))}
    </div>
  );
}

/* O editor. Formulário à esquerda, documento à direita. */
function GrupoAditivo({ sec, g, gi, onMudar, onRemover, onMover, onOutraSecao, doExecutivo }) {
  const setG = (k, v) => onMudar({ ...g, [k]: v });
  const palpite = useMemo(() => (g.verba ? null : verbaPorNome(g.nome)), [g.verba, g.nome]);
  const palpiteVerba = palpite ? eapPadrao().find((c) => c.num === palpite) : null;
  const setI = (iid, k, v) => onMudar({ ...g, itens: g.itens.map((i) => (i.id === iid ? { ...i, [k]: v } : i)) });
  /* Pegar do executivo preenche a linha INTEIRA, alocacao inclusive: a
     obra ja decidiu se aquilo e material ou mao de obra, e deixar o
     padrao adivinhar de novo jogaria essa decisao fora. */
  const escolherDoExecutivo = (iid, x) => {
    const brl = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    onMudar({
      ...g,
      // Grupo ainda sem nome herda o da verba do item — e' quase sempre
      // o que a pessoa ia digitar em seguida.
      nome: g.nome.trim() || (x.catNome || "").toUpperCase(),
      verba: g.verba || x.catNum,
      itens: g.itens.map((i) => (i.id === iid ? {
        ...i,
        descricao: x.desc,
        ambiente: x.ambiente || i.ambiente,
        qtd: brl(x.qtd),
        unidade: x.un || i.unidade,
        valor: brl(x.valorUnit),
        alocacao: x.alocacao === ALOC_AMBOS ? "AMBOS" : x.alocacao,
        doExecutivo: x.chave,
      } : i)),
    });
  };
  const addItem = () => onMudar({ ...g, itens: [...g.itens, novoItem()] });
  const delI = (iid) => onMudar({ ...g, itens: g.itens.filter((i) => i.id !== iid) });
  const dupI = (iid) => {
    const k = g.itens.findIndex((i) => i.id === iid);
    const copia = { ...g.itens[k], id: Math.random().toString(36).slice(2, 9) };
    onMudar({ ...g, itens: [...g.itens.slice(0, k + 1), copia, ...g.itens.slice(k + 1)] });
  };

  return (
    <div className="ad-grupo">
      <div className="ad-gh">
        <input className="ad-num" value={g.num} onChange={(e) => setG("num", e.target.value)} title="Nº do grupo" />
        <input className="ad-gnome" placeholder="NOME DO GRUPO (ex.: MÓVEIS SOB MEDIDA)"
          value={g.nome} onChange={(e) => setG("nome", e.target.value)} />
        {/* A verba e' o que faz este grupo virar dinheiro no orcamento da
            obra. Adivinhada pelo nome — e escrita aqui justamente pra
            poder ser corrigida antes de aparecer em tres telas. */}
        <select className="ad-verba" value={g.verba || ""} onChange={(e) => setG("verba", e.target.value || null)}
          title="Verba da EAP onde este grupo entra">
          <option value="">{palpiteVerba ? `auto: ${palpiteVerba.num} ${palpiteVerba.nome}` : "sem verba — não entra no orçamento"}</option>
          {eapPadrao().map((c) => <option key={c.num} value={c.num}>{c.num} · {c.nome}</option>)}
        </select>
        <span className="ad-sub mono">{fmtBRL(totalGrupo(g))}</span>
        <button className="ad-icon" title="Mover para cima" onClick={() => onMover(-1)}>↑</button>
        <button className="ad-icon" title="Mover para baixo" onClick={() => onMover(1)}>↓</button>
        <button className="ad-icon del" title="Excluir grupo" onClick={onRemover}><Trash2 size={12} /></button>
      </div>

      <div className="ad-itens">
        {g.itens.map((it) => (
          <div key={it.id} className="ad-item">
            <div className="ad-item-topo">
              <span className="ad-item-cod mono">{g.num}.{g.itens.indexOf(it) + 1}</span>
              <span className="ad-item-tot mono">{fmtBRL(totalItem(it))}</span>
              {/* Copiar pra outra seção é o gesto do dia: quase todo aditivo
                  suprime uma versão do móvel e adiciona outra, quase igual. */}
              <button className="ad-icon" title={`Copiar para ${sec === "supressao" ? "adição" : "supressão"}`}
                onClick={() => onOutraSecao(it)}><Copy size={11} /></button>
              <button className="ad-icon" title="Duplicar item" onClick={() => dupI(it.id)}><Plus size={11} /></button>
              <button className="ad-icon del" title="Excluir item" onClick={() => delI(it.id)}><X size={11} /></button>
            </div>
            <textarea className="form-input ad-desc-in" rows={2}
              placeholder={doExecutivo?.length ? "Descrição — ou digite pra buscar no executivo" : "Descrição do item"}
              value={it.descricao} onChange={(e) => setI(it.id, "descricao", e.target.value)} />
            {/* So na supressao, e so enquanto a linha nao foi resolvida.
                Supressao e' remocao do que ja existe: redigitar a
                descricao da planilha abre duas portas pro erro — escrever
                diferente (e ai ninguem casa a supressao com a linha que
                ela tira) e errar o valor unitario. */}
            <BuscaExecutivo itens={doExecutivo} termo={it.descricao} ativo={!it.doExecutivo}
              onEscolher={(x) => escolherDoExecutivo(it.id, x)} />
            <div className="ad-item-campos">
              <label>Ambiente<input className="form-input" value={it.ambiente}
                onChange={(e) => setI(it.id, "ambiente", e.target.value)} /></label>
              <label>Qtd<input className="form-input" inputMode="decimal" value={it.qtd}
                onChange={(e) => setI(it.id, "qtd", e.target.value)} /></label>
              <label>Un.<input className="form-input" list="ad-unidades" value={it.unidade}
                onChange={(e) => setI(it.id, "unidade", e.target.value)} /></label>
              <label>Valor unitário<input className="form-input" inputMode="decimal" placeholder="0,00"
                value={it.valor} onChange={(e) => setI(it.id, "valor", e.target.value)} /></label>
              {/* MAT ou MO decide de que lado do orcamento este item cai
                  quando o aditivo for aprovado — Plano de Compras ou
                  Contratos. Sem escolha, tudo caia em mao de obra. */}
              <label>Alocação
                <select className="form-input" value={it.alocacao || "MAT"}
                  onChange={(e) => setI(it.id, "alocacao", e.target.value)}>
                  <option value="MAT">MATERIAL (MAT)</option>
                  <option value="MO">MÃO DE OBRA (MO)</option>
                  <option value="AMBOS">MAT+MO</option>
                </select>
              </label>
            </div>
          </div>
        ))}
        <button className="ad-addbtn" onClick={addItem}><Plus size={12} /> Adicionar item</button>
      </div>
    </div>
  );
}

function SecaoEditor({ sec, titulo, grupos, total, onMudar, onCopiarPara, doExecutivo }) {
  const trocar = (gid, novo) => onMudar(grupos.map((g) => (g.id === gid ? novo : g)));
  const remover = (gid) => onMudar(grupos.filter((g) => g.id !== gid));
  const mover = (gid, d) => {
    const i = grupos.findIndex((g) => g.id === gid), j = i + d;
    if (j < 0 || j >= grupos.length) return;
    const a = [...grupos];
    [a[i], a[j]] = [a[j], a[i]];
    onMudar(a);
  };

  return (
    <div className={`ad-card ${sec === "supressao" ? "sup" : ""}`}>
      <div className="ad-card-h">
        <span>{titulo}</span>
        <span className="ad-card-tot mono">{fmtBRL(total)}</span>
      </div>
      <div className="ad-card-b">
        {grupos.length === 0 && <div className="empty-note">Nenhum grupo — esta seção não aparece no documento.</div>}
        {grupos.map((g, gi) => (
          <GrupoAditivo key={g.id} sec={sec} g={g} gi={gi} doExecutivo={doExecutivo}
            onMudar={(novo) => trocar(g.id, novo)}
            onRemover={() => remover(g.id)}
            onMover={(d) => mover(g.id, d)}
            onOutraSecao={(it) => onCopiarPara(g, it)} />
        ))}
        <button className="ad-addbtn" onClick={() => onMudar([...grupos, novoGrupo(grupos.length + 1)])}>
          <Plus size={12} /> Adicionar grupo de {titulo.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

function EditorAditivo({ aditivo, obra, usuario, doExecutivo, onVoltar, onSalvo }) {
  const [doc, setDoc] = useState(aditivo.doc);
  const [descricao, setDescricao] = useState(aditivo.descricao);
  const [status, setStatus] = useState(aditivo.status);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [sujo, setSujo] = useState(false);

  const t = totaisDoDocumento(doc);
  const mexer = (novo) => { setDoc(novo); setSujo(true); };
  const campo = (k, v) => mexer({ ...doc, [k]: v });

  /* Copiar um item pra outra seção: procura o grupo de mesmo nome, e cria
     um se não existir. É o gesto do dia — quase todo aditivo suprime uma
     versão do móvel e adiciona outra quase igual. */
  const copiarPara = (sec, grupo, item) => {
    const outra = sec === "supressao" ? "adicao" : "supressao";
    const lista = [...(doc[outra] || [])];
    const nome = grupo.nome.trim().toUpperCase();
    let alvo = nome ? lista.find((g) => g.nome.trim().toUpperCase() === nome) : null;
    const copia = { ...item, id: Math.random().toString(36).slice(2, 9) };
    if (alvo) {
      lista[lista.indexOf(alvo)] = { ...alvo, itens: [...alvo.itens, copia] };
    } else {
      lista.push({ id: Math.random().toString(36).slice(2, 9), num: String(lista.length + 1), nome: grupo.nome, itens: [copia] });
    }
    mexer({ ...doc, [outra]: lista });
  };

  async function salvar(extra = {}) {
    setSalvando(true); setErro(null);
    try {
      const salvo = await salvarAditivo(aditivo.id, { descricao, status, doc, usuario, ...extra });
      onSalvo(salvo);
      setSujo(false);
    } catch (e) {
      setErro(`Não consegui salvar: ${e.message || e}`);
    } finally {
      setSalvando(false);
    }
  }

  /* O nome do arquivo sai do titulo da pagina — e' assim que todo
     navegador batiza o "Salvar como PDF". Sem isso o arquivo nascia
     "Gestao de Obras TKWS — Vendido x Executivo.pdf", e a pessoa que
     precisa anexar esse PDF no Pipefy depois teria que caçar qual dos
     cinco arquivos de mesmo nome e' o aditivo certo.

     A barra do numero vira hifen: "2256/1" abriria pasta no nome do
     arquivo. */
  function imprimir() {
    const antes = document.title;
    const obraNome = (obra?.nome || doc.cliente || "").replace(/[\\/:*?"<>|]/g, "-").trim();
    document.title = `${aditivo.numero.replace("/", "-")} Aditivo${obraNome ? ` - ${obraNome}` : ""}`;
    const devolver = () => { document.title = antes; window.removeEventListener("afterprint", devolver); };
    window.addEventListener("afterprint", devolver);
    window.print();
    // Rede de seguranca: navegador que nao dispare `afterprint` deixaria
    // o titulo trocado na aba pra sempre.
    setTimeout(devolver, 4000);
  }

  async function mudarStatus(novo) {
    setStatus(novo);
    setSalvando(true); setErro(null);
    try {
      onSalvo(await salvarAditivo(aditivo.id, { descricao, status: novo, doc, usuario }));
      setSujo(false);
    } catch (e) {
      setErro(`Não consegui salvar o status: ${e.message || e}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="ad-topo naoimprime">
        <button className="btn-doc" onClick={onVoltar}><ChevronLeft size={13} /> Aditivos da obra</button>
        <span className="ad-numero mono">{aditivo.numero}</span>
        <input className="form-input ad-titulo" value={descricao} placeholder="Do que se trata este aditivo"
          onChange={(e) => { setDescricao(e.target.value); setSujo(true); }} />
        <div className="ad-status-sel">
          {STATUS_ADITIVO.map((s) => (
            <button key={s.id} className={`ad-tag ${s.id} ${status === s.id ? "on" : ""}`}
              onClick={() => mudarStatus(s.id)} disabled={salvando}>{s.nome}</button>
          ))}
        </div>
        <button className={`btn-doc ${sujo ? "btn-template" : ""}`} onClick={() => salvar()} disabled={salvando || !sujo}>
          {salvando ? "Salvando…" : sujo ? "Salvar" : "Salvo"}
        </button>
        <button className="btn-doc" onClick={imprimir} title="Abre a impressão do navegador — escolha Salvar como PDF">
          <Download size={13} /> PDF
        </button>
      </div>

      {erro && <div className="aviso-migracao naoimprime"><AlertTriangle size={14} /> <span>{erro}</span></div>}

      {status === "aprovado" && (
        <div className="naoimprime">
          <PipefyAditivo a={{ ...aditivo, status, descricao, doc }} obraNome={obra?.nome} usuario={usuario}
            onMarcar={(v) => { const novo = { ...doc, pipefy: v }; setDoc(novo); salvar({ doc: novo }); }} />
        </div>
      )}

      <div className="ad-wrap">
        <div className="ad-form naoimprime">
          <div className="ad-card">
            <div className="ad-card-h"><span>Cabeçalho</span></div>
            <div className="ad-card-b ad-cab">
              <label className="ad-largo">Cliente / Obra
                <input className="form-input" value={doc.cliente} onChange={(e) => campo("cliente", e.target.value)} /></label>
              <label>Nº da proposta
                <input className="form-input" value={doc.proposta} onChange={(e) => campo("proposta", e.target.value)} /></label>
              <label>Data
                <input className="form-input" type="date" value={doc.data || ""} onChange={(e) => campo("data", e.target.value)} /></label>
            </div>
          </div>

          <SecaoEditor sec="supressao" titulo="Supressão" grupos={doc.supressao || []} total={t.supressao}
            doExecutivo={doExecutivo}
            onMudar={(g) => mexer({ ...doc, supressao: g })}
            onCopiarPara={(g, it) => copiarPara("supressao", g, it)} />
          <SecaoEditor sec="adicao" titulo="Adição" grupos={doc.adicao || []} total={t.adicao}
            onMudar={(g) => mexer({ ...doc, adicao: g })}
            onCopiarPara={(g, it) => copiarPara("adicao", g, it)} />

          <div className="ad-card">
            <div className="ad-card-h"><span>Fechamento</span></div>
            <div className="ad-card-b">
              <div className="ad-resumo"><span>Total supressão</span><b className="mono">{fmtBRL(t.supressao)}</b></div>
              <div className="ad-resumo"><span>Total adição</span><b className="mono">{fmtBRL(t.adicao)}</b></div>
              <div className="ad-resumo forte">
                <span>{rotuloSaldo(t.saldo)}</span>
                <b className={`mono ${t.saldo < 0 ? "ad-credito" : ""}`}>{fmtBRL(t.saldo)}</b>
              </div>
              <label className="ad-largo" style={{ marginTop: 10, display: "block" }}>Condições de pagamento
                <textarea className="form-input" rows={3} value={doc.cond || ""}
                  onChange={(e) => campo("cond", e.target.value)} /></label>
              {/* A observacao e' INTERNA: ela nao sai no documento. E' onde
                  fica o porque da reprovacao, o que ainda falta combinar,
                  o nome de quem pediu — coisa que ajuda o time e nao vai
                  pro cliente. */}
              <label className="ad-largo" style={{ marginTop: 10, display: "block" }}>
                Observação <span className="ad-interno">interna — não sai no PDF</span>
                <textarea className="form-input" rows={3} value={doc.observacao || ""}
                  placeholder="por que foi reprovado, o que falta combinar, quem pediu…"
                  onChange={(e) => campo("observacao", e.target.value)} /></label>
            </div>
          </div>
        </div>

        {/* O documento, do lado, atualizando a cada tecla. */}
        <div className="ad-prev">
          <div className="ad-prev-h naoimprime">Pré-visualização</div>
          <div className="ad-prev-box">
            <DocumentoAditivo doc={doc} numero={aditivo.numero} />
          </div>
        </div>
      </div>

      <datalist id="ad-unidades">
        {["un", "m²", "m", "ml", "vb", "pç", "cj", "kg", "h"].map((u) => <option key={u} value={u} />)}
      </datalist>
    </>
  );
}

/* A cobranca do Pipefy.

   Aparece assim que o aditivo e' aprovado e so sai quando alguem marcar
   que enviou. Nao envia sozinho: o formulario tem captcha, e metade dos
   campos obrigatorios (closer, hunter, indicador, Neolix, parcelamento,
   data de pagamento, dois anexos) o app nao sabe. Card errado no fluxo
   comercial e' pior que card nenhum.

   O que ele faz e' tirar o trabalho chato do caminho: abre o formulario
   com "Aditivo" ja marcado e o valor preenchido, e deixa a vista o resto
   que a pessoa vai precisar digitar. */
function PipefyAditivo({ a, obraNome, usuario, onMarcar, compacto }) {
  const saldo = a.totalAdicao - a.totalSupressao;
  const feito = a.doc?.pipefy?.em;
  const resumo = [
    `Obra: ${obraNome || a.obraCodigo}`,
    `Aditivo: ${a.numero}`,
    `Valor: ${fmtBRL(saldo)}${saldo < 0 ? " (crédito para o cliente)" : ""}`,
    a.descricao ? `Do que se trata: ${a.descricao}` : null,
  ].filter(Boolean).join("\n");

  if (feito) {
    return (
      <div className={`pf-ok ${compacto ? "compacto" : ""}`}>
        <CheckCircle2 size={12} />
        <span>Pipefy enviado{a.doc.pipefy.por ? ` por ${a.doc.pipefy.por}` : ""} em {new Date(feito).toLocaleDateString("pt-BR")}</span>
        <button className="pf-desfazer" onClick={() => onMarcar(null)}>desfazer</button>
      </div>
    );
  }

  return (
    <div className={`pf-box ${compacto ? "compacto" : ""}`}>
      <div className="pf-topo">
        <AlertTriangle size={13} />
        <span><b>Falta a Solicitação de contrato no Pipefy.</b> Aditivo aprovado obriga abrir o card.</span>
      </div>
      {!compacto && (
        <div className="pf-dados">
          <pre>{resumo}</pre>
          <button className="btn-copiar" title="Copiar pra colar no formulário"
            onClick={() => navigator.clipboard?.writeText(resumo)}><Copy size={11} /></button>
        </div>
      )}
      <div className="pf-acoes">
        <a className="btn-doc btn-template" href={linkPipefy(saldo)} target="_blank" rel="noopener noreferrer">
          <ArrowUpRight size={13} /> Abrir o formulário
        </a>
        <button className="btn-doc" onClick={() => onMarcar({ em: new Date().toISOString(), por: usuario || null })}>
          Já enviei
        </button>
      </div>
      {!compacto && (
        <div className="pf-nota">
          O link já vai com <b>Aditivo</b> marcado e o valor preenchido. O resto — obra, closer, hunter,
          indicador, Neolix, parcelamento, data de pagamento e os dois anexos — o app não tem como saber,
          e chutar criaria um card errado no comercial.
        </div>
      )}
    </div>
  );
}

/* Uma linha da lista.

   Aprovar e reprovar acontecem AQUI, sem abrir o documento: a decisao e'
   sobre um aditivo que a pessoa ja conhece, e obrigar a entrar, esperar
   carregar e voltar pra cada um transformava uma decisao de um segundo
   em quatro cliques.

   A observacao mora dentro do documento salvo (`doc.observacao`), e nao
   numa coluna nova: sem ela a tabela precisaria de mais um `alter table`,
   e migracao e' o passo que trava — este modulo ja custou tres. */
function LinhaAditivo({ a, usuario, obraNome, mostrarObra, onAbrir, onExcluir, onSalvo, onErro }) {
  const [obs, setObs] = useState(a.doc?.observacao || "");
  const [salvando, setSalvando] = useState(false);
  const saldo = a.totalAdicao - a.totalSupressao;

  async function gravar(campos) {
    setSalvando(true);
    try {
      onSalvo(await salvarAditivo(a.id, { usuario, ...campos }));
    } catch (e) {
      onErro(`Não consegui salvar: ${e.message || e}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <tr>
      <td className="mono"><b>{a.numero}</b></td>
      {mostrarObra && (
        <td><div className="ad-linha-obra">{obraNome || <span className="mono dim">#{a.obraCodigo}</span>}</div></td>
      )}
      <td>
        <button className="ad-linha-desc" onClick={onAbrir}>
          {a.descricao || <span className="dim">sem descrição — clique para abrir</span>}
        </button>
        <div className="ad-linha-data">
          {dataBR(a.doc?.data)}
          {a.atualizadoPor ? ` · por ${a.atualizadoPor}` : ""}
        </div>
        {/* Salva ao sair do campo, e nao a cada tecla: gravar por tecla
            manda uma requisicao por letra digitada. */}
        <textarea className="ad-obs" rows={1} value={obs} placeholder="observação…"
          onChange={(e) => setObs(e.target.value)}
          onBlur={() => { if (obs !== (a.doc?.observacao || "")) gravar({ doc: { ...a.doc, observacao: obs } }); }} />
        {a.status === "aprovado" && (
          <PipefyAditivo a={a} obraNome={obraNome} usuario={usuario} compacto
            onMarcar={(v) => gravar({ doc: { ...a.doc, observacao: obs, pipefy: v } })} />
        )}
      </td>
      <td className="right mono">{fmtBRL(a.totalSupressao)}</td>
      <td className="right mono">{fmtBRL(a.totalAdicao)}</td>
      <td className={`right mono ${saldo < 0 ? "ad-credito" : ""}`}>
        <b>{fmtBRL(saldo)}</b>
        <div className="ad-linha-data">{rotuloSaldo(saldo)}</div>
      </td>
      <td className="center">
        <div className="ad-status-sel ad-status-lista">
          {STATUS_ADITIVO.map((st) => (
            <button key={st.id}
              className={`ad-tag ${st.id} ${a.status === st.id ? "on" : ""} ${st.id === "aprovado" && pipefyPendente(a) ? "cobra" : ""}`}
              disabled={salvando} onClick={() => gravar({ status: st.id })}
              title={st.id === "rascunho" ? "Volta para rascunho — sai do orçamento"
                : st.id === "aprovado" ? "Aprovar — passa a contar no Dashboard, no CMV e no Plano de Compras"
                : "Reprovar — não entra no orçamento"}>
              {st.nome}
            </button>
          ))}
        </div>
      </td>
      <td className="center">
        <button className="ad-icon" title="Abrir" onClick={onAbrir}><Search size={12} /></button>
        <button className="ad-icon del" title="Excluir" onClick={onExcluir}><Trash2 size={12} /></button>
      </td>
    </tr>
  );
}

function AditivosView({ obras, usuario }) {
  /* Vazio quer dizer TODAS — o mesmo contrato do filtro dos outros
     paineis. Antes esta tela abria pedindo pra escolher uma obra, e ate
     escolher nao mostrava nada: quem so queria ver o que existe tinha
     que adivinhar em qual obra procurar. */
  const [escolhidas, setEscolhidas] = useState(() => new Set());
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [abertoId, setAbertoId] = useState(null);
  /* O executivo da obra escolhida. Ele nao vem junto da lista de obras
     (que chega do Monday com a EAP vazia), entao e' carregado aqui — e
     so quando alguem escolhe a obra, porque e' um JSONB gordo. */
  const [doExecutivo, setDoExecutivo] = useState([]);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    listarAditivos()
      .then((l) => { if (vivo) setLista(l); })
      .catch((e) => { if (vivo) setErro(`Não consegui carregar os aditivos: ${e.message || e}`); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  /* Uma obra escolhida e' o modo de TRABALHO: da' pra criar aditivo, e o
     executivo dela e' carregado pra busca de supressao. Nenhuma ou varias
     e' o modo de LEITURA — ve tudo, cria nada, porque aditivo nasce
     dentro de uma obra e o numero sai do centro de custo dela. */
  const [escolhendo, setEscolhendo] = useState(false);
  const uma = escolhidas.size === 1 ? [...escolhidas][0] : null;
  const obra = obras.find((o) => String(o.codigo) === String(uma)) || null;

  useEffect(() => {
    if (!uma) { setDoExecutivo([]); return; }
    let vivo = true;
    carregarDadosObra(uma)
      .then((d) => { if (vivo) setDoExecutivo(itensParaSupressao(normalizarCategorias(d?.categorias || []))); })
      .catch(() => { if (vivo) setDoExecutivo([]); });   // sem executivo, digita a mao
    return () => { vivo = false; };
  }, [uma]);

  const visiveis = useMemo(
    () => (escolhidas.size ? lista.filter((a) => escolhidas.has(String(a.obraCodigo))) : lista),
    [lista, escolhidas]);
  const daObra = useMemo(
    () => (uma ? lista.filter((a) => String(a.obraCodigo) === String(uma)) : []),
    [lista, uma]);
  const nomeDaObra = (cod) => obras.find((o) => String(o.codigo) === String(cod))?.nome || "";
  const aberto = lista.find((a) => a.id === abertoId) || null;

  const trocar = (salvo) => setLista((l) => l.map((a) => (a.id === salvo.id ? salvo : a)));

  async function novo(alvo) {
    const o = alvo || obra;
    if (!o) return;
    setErro(null);
    setEscolhendo(false);
    try {
      const seq = proximaSeq(lista.filter((a) => String(a.obraCodigo) === String(o.codigo)));
      const criado = await criarAditivo({
        obraCodigo: o.codigo, seq, descricao: "",
        doc: novoDocumento(o), usuario,
      });
      setLista((l) => [criado, ...l]);
      /* Focar o filtro na obra escolhida nao e' cosmetico: e' o que faz o
         executivo dela carregar, e sem executivo a busca de supressao
         abre vazia. */
      setEscolhidas(new Set([String(o.codigo)]));
      setAbertoId(criado.id);
    } catch (e) {
      setErro(`Não consegui criar o aditivo: ${e.message || e}`);
    }
  }

  async function excluir(a) {
    if (!window.confirm(`Excluir o aditivo ${a.numero}? Isso não pode ser desfeito.`)) return;
    try {
      await excluirAditivo(a.id);
      setLista((l) => l.filter((x) => x.id !== a.id));
    } catch (e) {
      setErro(`Não consegui excluir: ${e.message || e}`);
    }
  }

  if (aberto) {
    return <EditorAditivo aditivo={aberto} obra={obra} usuario={usuario} doExecutivo={doExecutivo}
      onVoltar={() => setAbertoId(null)} onSalvo={trocar} />;
  }

  return (
    <>
      {erro && <div className="aviso-migracao"><AlertTriangle size={14} /> <span>{erro}</span></div>}

      <div className="gc-obras-filtro">
        <span className="gc-horizonte-rot">Obras</span>
        <FiltroObras obras={obras.map((o) => ({ codigo: String(o.codigo), nome: o.nome }))}
          escolhidas={escolhidas} onMudar={setEscolhidas} />
      </div>

      <div className="ad-cab-obra">
            {obra ? (
              <div>
                <div className="ad-cab-nome">{obra.nome}</div>
                <div className="ad-cab-sub">centro de custo <b className="mono">{obra.codigo}</b> · próximo será <b className="mono">{numeroAditivo(obra.codigo, proximaSeq(daObra))}</b></div>
              </div>
            ) : (
              <div>
                <div className="ad-cab-nome">{visiveis.length} {visiveis.length === 1 ? "aditivo" : "aditivos"}</div>
                <div className="ad-cab-sub">em {new Set(visiveis.map((a) => String(a.obraCodigo))).size} obra(s)</div>
              </div>
            )}
        {/* O botao existe SEMPRE. Criar exige uma obra — o numero sai do
            centro de custo dela — mas exigir que ela adivinhasse isso no
            filtro escondeu a funcao inteira. Agora o proprio botao
            pergunta, e pergunta do jeito que o resto do app pergunta. */}
        <div className="fo-caixa">
          <button className="btn-doc btn-template"
            onClick={() => (obra ? novo(obra) : setEscolhendo((v) => !v))}>
            <Plus size={13} /> Novo aditivo
          </button>
          {escolhendo && !obra && (
            <EscolherObra obras={obras}
              numeroDe={(o) => numeroAditivo(o.codigo, proximaSeq(lista.filter((a) => String(a.obraCodigo) === String(o.codigo))))}
              onEscolher={novo} onFechar={() => setEscolhendo(false)} />
          )}
        </div>
      </div>

          {carregando ? <div className="empty-note">Carregando…</div>
            : visiveis.length === 0 ? (
              <div className="empty-note">
                {escolhidas.size ? "Nenhum aditivo nesta seleção." : "Nenhum aditivo ainda em obra nenhuma."}
              </div>
            ) : (
            <div className="grp-block">
              <div className="grp-itens">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>Nº</th>
                      {/* A obra so aparece quando ha mais de uma na tela:
                          com uma so, ela ja esta escrita no cabecalho. */}
                      {!obra && <th style={{ width: 190 }}>Obra</th>}
                      <th>Do que se trata</th>
                      <th style={{ width: 120 }} className="right">Supressão</th>
                      <th style={{ width: 120 }} className="right">Adição</th>
                      <th style={{ width: 140 }} className="right">Saldo</th>
                      <th style={{ width: 210 }} className="center">Status</th>
                      <th style={{ width: 90 }} className="center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((a) => (
                      <LinhaAditivo key={a.id} a={a} usuario={usuario}
                        obraNome={nomeDaObra(a.obraCodigo)} mostrarObra={!obra}
                        onAbrir={() => setAbertoId(a.id)}
                        onExcluir={() => excluir(a)}
                        onSalvo={trocar}
                        onErro={setErro} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
    </>
  );
}

/* ============================================================
   SALA DE ESPERA
   Quem entrou pelo link e ainda não tem perfil. Não mostra NADA
   da empresa — nem contagem, nem nome de obra, nem valor.

   Ver docs/SPEC-acessos.md §3.
   ============================================================ */
function SalaDeEspera({ usuario, pessoa, onSair, onRecarregar }) {
  /* Estilo proprio, e nao as classes do app: esta tela aparece ANTES do
     app existir na arvore, e depender da folha dele seria depender de
     algo que a pessoa nesta tela nao tem direito de carregar. */
  const caixa = {
    width: "100%", maxWidth: 400, background: "#fff", border: "1px solid #e5e2dd",
    borderRadius: 16, padding: "34px 30px", boxSizing: "border-box", textAlign: "center",
  };
  const botao = {
    border: "1px solid #e5e2dd", background: "#fff", borderRadius: 10, padding: "10px 16px",
    fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", color: "#1a1a1a",
  };
  const suspenso = pessoa?.ativo === false;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#F4F3F1", fontFamily: "Inter, system-ui, sans-serif", padding: 20 }}>
      <div style={caixa}>
        <img src="/logo.png" alt="Group WS" style={{ width: 54, height: 46, objectFit: "cover", objectPosition: "top center" }}
          onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <div style={{ fontWeight: 700, letterSpacing: "0.05em", fontSize: 13, color: "#1a1a1a", margin: "6px 0 22px" }}>
          GESTÃO DE OBRAS TKWS
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>
          {suspenso ? "Seu acesso está suspenso" : "Seu acesso está em análise"}
        </div>
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.55 }}>
          {suspenso
            ? "Sua conta existe, mas foi desativada. Fale com a coordenação para reativar."
            : <>Você entrou com <b style={{ color: "#1a1a1a" }}>{usuario}</b>. Um administrador precisa
               definir o que você vai acessar — já avisamos. Assim que liberarem, é só recarregar.</>}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
          {!suspenso && (
            <button style={{ ...botao, background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a" }}
              onClick={onRecarregar}>Já liberaram, recarregar</button>
          )}
          <button style={botao} onClick={onSair}>Sair</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   INÍCIO
   A tela que abre. Antes o app caía direto dentro de uma obra —
   a primeira da lista, escolhida por ordem alfabética, que quase
   nunca é a que pede atenção hoje.

   O que ela responde, nesta ordem: o tamanho do que está em jogo,
   o que está vencendo, e o que é meu.
   ============================================================ */

/* Uma celula da regua. Nao e' cartao: cartao aqui em cima competia com
   os cartoes de "Pedindo atencao" logo abaixo, e quatro caixas brancas
   iguais nao dizem qual delas pede acao. */
/* Nome com "Entregue" (do Sienge, tipo "Le Magestic (Entregue 2018)")
   é obra encerrada, ponto — não importa o código. */
const ENTREGUE_RE = /entregue/i;

/* O status de uma obra do histórico do Sienge, pra colorir o painel.
 *
 * A ordem importa, do sinal mais confiável pro mais fraco:
 *   1. Marcação MANUAL (`status_manual`) — alguém olhou e corrigiu, e
 *      isso vale mais que qualquer regra, inclusive o que vem depois.
 *   2. O que o Confere já sabe (`registro`, a tabela que o time de fato
 *      acompanha) — se ela está marcada "concluida" ou "ativa" aqui
 *      dentro, é essa a resposta.
 *   3. Sinais indiretos, só quando nem o Confere nunca ouviu falar
 *      dessa obra (histórico antigo, de antes deste app existir): o
 *      nome dizendo "Entregue", ou o código ser antigo demais (<=1500)
 *      pra ainda estar em obra hoje.
 * Sem cruzar com o Monday ao vivo por enquanto — decisão dela, pra não
 * travar o painel numa integração que ainda não existe pra esse recorte.
 */
function statusSienge(row, registro) {
  if (row.status_manual) return row.status_manual;
  const conf = registro.get(String(row.codigo));
  if (conf?.situacao) return conf.situacao === "concluida" ? "finalizada" : "ativa";
  if (ENTREGUE_RE.test(row.nome || "")) return "finalizada";
  if (Number(row.codigo) <= 1500) return "finalizada";
  return "ativa";
}

/* Estado -> cidade -> obras, só com quem tem os dois preenchidos —
   sem endereço não há onde desenhar o pino. Cidade em ordem alfabética
   (lista longa, achar é o que importa); estado pelo total, o maior
   primeiro, pra abrir já mostrando onde tem mais obra. */
function agruparPorLocalizacao(siengeObras, registro) {
  const porEstado = new Map();
  (siengeObras || []).forEach((r) => {
    if (!r.cidade || !r.estado) return;
    if (!porEstado.has(r.estado)) porEstado.set(r.estado, new Map());
    const porCidade = porEstado.get(r.estado);
    if (!porCidade.has(r.cidade)) porCidade.set(r.cidade, []);
    porCidade.get(r.cidade).push({ codigo: r.codigo, nome: r.nome, status: statusSienge(r, registro) });
  });
  return [...porEstado.entries()]
    .map(([estado, porCidade]) => {
      const cidades = [...porCidade.entries()]
        .map(([cidade, obras]) => ({
          cidade,
          obras: obras.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
          ativas: obras.filter((o) => o.status === "ativa").length,
          finalizadas: obras.filter((o) => o.status === "finalizada").length,
        }))
        .sort((a, b) => a.cidade.localeCompare(b.cidade, "pt-BR"));
      return { estado, cidades, total: cidades.reduce((a, c) => a + c.obras.length, 0) };
    })
    .sort((a, b) => b.total - a.total);
}

/* Painel "Onde estão as obras": estado -> cidade -> obra, sem despejar
   as ~540 de uma vez — só o estado escolhido mostra cidade, só a cidade
   escolhida mostra as obras dela, coloridas por status. */
function PainelLocalizacao({ dados, carregando, onToggleStatus }) {
  const [estado, setEstado] = useState(null);
  const [cidadesAbertas, setCidadesAbertas] = useState(() => new Set());
  const grupo = dados.find((g) => g.estado === estado) || null;

  /* Os dados chegam depois (fetch assíncrono) — sem isto o painel
     carrega e fica sem nenhum estado selecionado até alguém clicar. */
  useEffect(() => {
    if (!estado && dados.length) setEstado(dados[0].estado);
  }, [dados, estado]);

  const alternarCidade = (cidade) => setCidadesAbertas((prev) => {
    const n = new Set(prev);
    if (n.has(cidade)) n.delete(cidade); else n.add(cidade);
    return n;
  });

  if (carregando || dados.length === 0) {
    return (
      <div className="gc-bloco loc-bloco">
        <div className="gc-bloco-head">
          <MapPin size={15} />
          <span className="gc-bloco-titulo">Onde estão as obras</span>
        </div>
        <div className="empty-note">
          {carregando ? "Carregando…" : "Ainda sem dados — falta rodar o SQL de importação do Sienge (supabase/sienge_obra.sql)."}
        </div>
      </div>
    );
  }

  return (
    <div className="gc-bloco loc-bloco">
      <div className="gc-bloco-head">
        <MapPin size={15} />
        <span className="gc-bloco-titulo">Onde estão as obras</span>
        <span className="loc-legenda">
          <span className="loc-legenda-item"><i className="loc-dot ativa" />ativa</span>
          <span className="loc-legenda-item"><i className="loc-dot finalizada" />finalizada</span>
        </span>
      </div>
      <div className="loc-estados">
        {dados.map((g) => (
          <button key={g.estado} type="button" className={`gc-chip ${estado === g.estado ? "on" : ""}`}
            onClick={() => setEstado(g.estado)}>
            {g.estado} <span className="dim">· {g.total}</span>
          </button>
        ))}
      </div>
      {grupo && (
        <div className="loc-cidades">
          {grupo.cidades.map((c) => {
            const aberta = cidadesAbertas.has(c.cidade);
            return (
              <div key={c.cidade} className="loc-cidade">
                <button type="button" className="loc-cidade-head" onClick={() => alternarCidade(c.cidade)}>
                  <ChevronRight size={12} className={`gc-chevron ${aberta ? "aberto" : ""}`} />
                  <span className="loc-cidade-nome">{c.cidade}</span>
                  <span className="loc-cidade-conta">
                    {c.ativas > 0 && <span className="loc-conta ativa">{c.ativas}</span>}
                    {c.finalizadas > 0 && <span className="loc-conta finalizada">{c.finalizadas}</span>}
                  </span>
                </button>
                {aberta && (
                  <div className="loc-obras">
                    {c.obras.map((o) => (
                      <button key={o.codigo} type="button" className={`loc-obra-chip ${o.status}`}
                        onClick={() => onToggleStatus(o.codigo, o.status)}
                        title={`#${o.codigo} — clique pra marcar como ${o.status === "finalizada" ? "ativa" : "finalizada"}`}>
                        {o.status === "finalizada" && <Check size={9} />} {o.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* A esteira da obra: os passos em ordem, cada um sabendo se já foi
   cumprido, mais a frase do que falta AGORA. As duas coisas juntas —
   não só a frase (escondia o histórico, "de onde veio" desaparecia) e
   não só os passos. O NOME de cada passo fica escrito no próprio chip
   — bolinha sem letra parecia igual pra feito e pendente; risco de
   confundir "concluído" com "faltando" é pior que ocupar mais espaço.
   `rotulo` é o nome completo (pro title); `curto` é o que cabe no chip.
   Caderno conta como feito quando o arquivo é anexado (mesma regra da
   aba Executivo). CMV usa `deparaAprovado`, não só `cmvLiberado > 0`:
   uma obra pode ter liberado com valor zerado numa planilha estranha,
   e o que importa pra fase é "a decisão foi tomada", não o valor. */
function esteiraDaObra(o) {
  const cad = o.cadernos || {};
  const passos = [
    { chave: "criativo", curto: "Criativo", rotulo: "Criativo", feito: !!cad.criativo },
    { chave: "cmv", curto: "CMV", rotulo: "CMV liberado", feito: !!o.deparaAprovado },
    { chave: "especificacao", curto: "Especificação", rotulo: "Caderno de Especificação", feito: !!cad.especificacao },
    { chave: "marcenaria", curto: "Marcenaria", rotulo: "Caderno de Marcenaria", feito: !!cad.marcenaria },
    { chave: "projeto", curto: "Executivo", rotulo: "Caderno de Projeto Executivo", feito: !!cad.projeto },
    { chave: "execucao", curto: "Em execução", rotulo: "Em execução (compras liberadas)", feito: !!o.comprasLiberadas },
  ];
  const faltando = passos.find((p) => !p.feito);
  if (!faltando) return { passos, texto: "Em execução", tom: "roxo" };
  // Todos os cadernos prontos, só falta liberar as compras — não é bem
  // "aguardando Em execução" (lê estranho), é o marco antes dela.
  if (faltando.chave === "execucao") return { passos, texto: "Pronta para Compras", tom: "azul" };
  return { passos, texto: `Aguardando ${faltando.rotulo}` };
}

/* Mesma regra dos 90 dias, mas devolvendo QUAIS passos estão pendentes —
   usado tanto pro texto do alerta (que hoje cita sempre "Criativo, CMV"
   fixo, errado) quanto pro selo vermelho no card específico do Executivo. */
function passosCriticosAtrasados(o) {
  if (!o.dataEntrega || o.comprasLiberadas) return { dias: null, passos: [] };
  const entrega = new Date(`${o.dataEntrega}T12:00:00`);
  const dias = Math.round((entrega - new Date()) / 86400000);
  if (dias > 90) return { dias, passos: [] };
  const passos = esteiraDaObra(o).passos.filter((p) => p.chave !== "execucao" && !p.feito);
  return { dias, passos };
}

function InicioNum({ rot, valor, sub, cor, Icone, onClick }) {
  const Tag = onClick ? "button" : "div";
  const tom = cor || "var(--ink-3)";
  return (
    <Tag className={`ini-cel ${onClick ? "clicavel" : ""}`} onClick={onClick}>
      {Icone && (
        <div className="ini-cel-icone" style={{ color: tom, background: `color-mix(in srgb, ${tom} 14%, white)` }}>
          <Icone size={16} />
        </div>
      )}
      <div className="ini-cel-corpo">
        <div className="ini-cel-rot">{rot}</div>
        <div className="ini-cel-val">{valor}</div>
        <div className="ini-cel-sub">{sub}</div>
      </div>
    </Tag>
  );
}

function InicioView({ obras, novas, carregando, usuario, equipe, nPendentes = 0, onAbrirObra, onModulo, dadosLocalizacao = [], localizacaoCarregando = false, onToggleLocalizacao }) {
  const r = useMemo(() => resumoGeral(obras), [obras]);
  const t = r.totais;

  const semEntrega = obras.filter((o) => !o.dataEntrega && (o.categorias || []).some((c) => (c.itens || []).length));
  const meuNome = (equipe || []).find((p) => p.email === usuario)?.nome || nomeDoEmail(usuario);
  const meuCargo = (equipe || []).find((p) => p.email === usuario)?.cargo || "";
  /* Coordenação enxerga o painel inteiro, mesmo que por acaso também
     esteja marcada como GC de alguma obra — "Suas obras" é um recorte
     pra quem acompanha só a própria carteira, não pra quem coordena
     todo mundo. */
  const minhas = meuCargo === "Coordenação" ? [] : obras.filter((o) => obraDoGC(o, usuario));
  const semGC = obras.filter((o) => !o.gc);

  /* Aditivo aprovado sem o card do Pipefy: e' compromisso assumido que o
     comercial ainda nao viu. */
  const pipefyAberto = obras.flatMap((o) => (o.aditivos || []).filter(pipefyPendente).map((a) => ({ a, o })));

  /* Regra da empresa: Criativo, CMV, os três cadernos (Especificação,
     Marcenaria, Projeto Executivo) — tudo isso precisa estar pronto até
     90 dias antes da entrega, porque é o que abre a contratação de mão
     de obra. Passou dessa marca sem estar "em execução" (comprasLiberadas)
     é risco real no prazo — mesmo cálculo de dias que o resto do painel
     já usa (`entrega - hoje`), só que contra 90, não contra 0. */
  const atrasadas90 = obras
    .map((o) => ({ o, ...passosCriticosAtrasados(o) }))
    .filter(({ passos }) => passos.length > 0);

  /* Uma lista so, ordenada pelo que dói primeiro. Cada linha leva ao
     lugar de resolver — aviso que nao tem para onde ir vira paisagem. */
  const atencao = [];
  r.linhas.forEach((L) => {
    L.atrasos.forEach((v) => atencao.push({
      tom: "ruim",
      txt: <>Em <b>#{L.codigo} {L.nome}</b>, a compra de <b>{v.nome}</b> venceu há {-v.dias} dias — {fmtBRL(v.matFalta)}</>,
      ir: () => onAbrirObra(L.id),
    }));
  });
  atrasadas90.forEach(({ o, dias, passos }) => {
    const nomes = passos.map((p) => p.rotulo).join(", ");
    const verbo = passos.length === 1 ? "precisa estar pronto" : "precisam estar prontos";
    atencao.push({
      tom: "ruim",
      txt: dias < 0
        ? <><b>#{o.codigo} {o.nome}</b> já passou da data de entrega e ainda não está em execução — {nomes} {verbo} há {90 - dias} dias</>
        : <><b>#{o.codigo} {o.nome}</b> entrega em {dias} {dias === 1 ? "dia" : "dias"} e ainda não está em execução — {nomes} {verbo} até 90 dias antes da entrega</>,
      ir: () => onAbrirObra(o.id),
    });
  });
  pipefyAberto.forEach(({ a, o }) => atencao.push({
    tom: "aviso",
    txt: <>O aditivo <b>{a.numero}</b> de <b>{o.nome}</b> está aprovado e ainda sem a Solicitação de contrato no Pipefy</>,
    ir: () => onModulo("aditivos"),
  }));
  semEntrega.forEach((o) => atencao.push({
    tom: "aviso",
    txt: <><b>#{o.codigo} {o.nome}</b> não tem data de entrega — sem ela nenhum prazo de compra é calculado</>,
    ir: () => onAbrirObra(o.id),
  }));
  if (semGC.length) atencao.push({
    tom: "info",
    txt: <><b>{semGC.length}</b> {semGC.length === 1 ? "obra está" : "obras estão"} sem GC responsável</>,
    ir: () => onAbrirObra(semGC[0].id),
  });
  if (novas.length) atencao.push({
    tom: "info",
    txt: <><b>{novas.length}</b> obras do Monday ainda não foram iniciadas aqui</>,
    ir: () => onModulo("novas"),
  });
  /* A fila vem PRIMEIRO na lista: e' gente parada esperando pra
     trabalhar, e o custo de demorar e' de outra pessoa, nao de quem le.
     So' o administrador ve — pra quem nao pode liberar, isso seria um
     aviso sem para onde ir. */
  if (nPendentes > 0) atencao.unshift({
    tom: "aviso",
    txt: <><b>{nPendentes}</b> {nPendentes === 1 ? "pessoa está aguardando" : "pessoas estão aguardando"} liberação de acesso</>,
    ir: () => onModulo("equipe"),
  });

  return (
    <>
      {/* Centralizada, com o avatar ao lado — o formato do portal da
          empresa. Encostada a esquerda e em duas linhas ela competia com
          os numeros logo abaixo; centralizada ela vira o cumprimento que
          e', e o olho desce direto pro que importa.

          Nome em cheio, recado em cinza: o nome ancora, a frase muda todo
          dia. Uma frase nova a cada F5 deixaria de ser recado e viraria
          ruido, entao o indice sai da DATA — o time todo ve a mesma. */}
      {/* O nome ancora, a data acompanha, o recado vem embaixo em corpo
          menor. Sem avatar: num app onde so' existe uma pessoa logada, as
          iniciais nao dizem nada que o nome ao lado ja nao diga. */}
      <div className="ini-topo">
        <div className="ini-nome-linha">
          <span className="ini-nome">{meuNome || "Olá"}</span>
          {/* So a PRIMEIRA letra: capitalize no CSS subia tambem os "de",
              virando "Domingo, 30 De Agosto De 2026". */}
          <span className="ini-data">{(() => {
            const d = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
            return d.charAt(0).toUpperCase() + d.slice(1);
          })()}</span>
        </div>
        <div className="ini-recado">{mensagemDoDia()}</div>
      </div>

      {carregando && <div className="empty-note">Carregando as obras…</div>}

      <div className="ini-regua">
        <InicioNum rot="OBRAS ATIVAS" Icone={Building2} valor={obras.length}
          sub={`${r.linhas.length} com planilha carregada`} />
        <InicioNum rot="A COMPRAR" cor="var(--blue)" Icone={ShoppingCart} valor={fmtBRL(t.matTotal - t.matFeito)}
          sub={`de ${fmtBRL(t.matTotal)} em material`} onClick={() => onModulo("a_contratar")} />
        <InicioNum rot="A CONTRATAR" cor="var(--purple)" Icone={ClipboardList} valor={fmtBRL(t.moTotal - t.moFeito)}
          sub={`de ${fmtBRL(t.moTotal)} em mão de obra`} onClick={() => onModulo("a_contratar")} />
        <InicioNum rot="MINHAS OBRAS" cor="var(--green)" Icone={ShieldCheck} valor={minhas.length}
          sub={minhas.length ? "onde você é o GC" : "nenhuma atribuída a você"} />
      </div>

      <div className="ini-colunas">
        <div>
          <div className="ini-titulo">
            <AlertTriangle size={14} className="ini-titulo-icone" />
            Pedindo atenção
            {atencao.length > 0 && <span className="ini-conta">{atencao.length}</span>}
          </div>
          {atencao.length === 0 ? (
            <div className="dash-alerta ok"><CheckCircle2 size={14} /> Nada pedindo atenção agora.</div>
          ) : atencao.map((a, i) => (
            <button key={i} className={`ini-alerta ${a.tom}`} onClick={a.ir}>
              <AlertTriangle size={13} />
              <span>{a.txt}</span>
              <ChevronRight size={13} className="ini-seta" />
            </button>
          ))}
        </div>

        <div>
          <div className="ini-titulo ini-titulo-linha">
            <span className="ini-titulo-esq">
              <Building2 size={14} className="ini-titulo-icone" />
              {minhas.length ? "Suas obras" : "Obras ativas"}
              <span className="ini-conta">{(minhas.length ? minhas : obras).length}</span>
            </span>
            <button type="button" className="ini-link-finalizadas" onClick={() => onModulo("arquivo")}>
              Finalizadas <ChevronRight size={12} />
            </button>
          </div>
          {(minhas.length ? minhas : obras).map((o) => {
            const L = r.linhas.find((x) => x.codigo === o.codigo);
            const esteira = esteiraDaObra(o);
            const executivoAtrasado = passosCriticosAtrasados(o).passos.some((p) => p.chave === "projeto");
            const nomeGC = o.gc ? ((equipe || []).find((p) => p.email === o.gc)?.nome || nomeDoEmail(o.gc)) : null;
            return (
              <button key={o.id} className="ini-obra" onClick={() => onAbrirObra(o.id)}>
                <div className="ini-obra-id">
                  <div className="ini-obra-nome"><span className="mono dim">#{o.codigo}</span> {o.nome}</div>
                  <div className="ini-obra-sub">
                    {o.squad}
                    {o.dataEntrega
                      ? ` · entrega ${new Date(`${o.dataEntrega}T12:00:00`).toLocaleDateString("pt-BR")}`
                      : " · sem data de entrega"}
                  </div>
                  <div className="ini-esteira">
                    {esteira.passos.map((p) => {
                      const alerta = p.chave === "projeto" && executivoAtrasado;
                      return (
                        <span key={p.chave} className={`ini-passo-chip ${p.feito ? "on" : ""} ${alerta ? "atrasado" : ""}`}
                          title={`${p.rotulo}: ${p.feito ? "feito" : alerta ? "pendente — passou do prazo de 90 dias antes da entrega" : "pendente"}`}>
                          {p.feito ? <Check size={9} /> : alerta ? <AlertTriangle size={9} /> : null} {p.curto}
                        </span>
                      );
                    })}
                  </div>
                  <span className={`ini-fase-pilula ${esteira.tom || ""}`}>{esteira.texto}</span>
                </div>
                {/* Duas barras sem legenda ninguém decifra de relance —
                    o número já diz sozinho. GC bem pequeno: é contexto
                    de apoio, não o que a linha existe pra responder. */}
                {L ? (
                  <div className="ini-obra-resumo">
                    {nomeGC && <div className="ini-obra-gc">GC {nomeGC}</div>}
                    <div className="ini-obra-pct">{Math.round(L.mat.pct)}% comprado</div>
                  </div>
                ) : (
                  <div className="ini-obra-resumo">
                    {nomeGC && <div className="ini-obra-gc">GC {nomeGC}</div>}
                    <span className="ini-obra-vazia">sem planilha</span>
                  </div>
                )}
                {L && L.atrasos.length > 0 && <span className="gc-selo atraso">{L.atrasos.length}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <PainelLocalizacao dados={dadosLocalizacao} carregando={localizacaoCarregando} onToggleStatus={onToggleLocalizacao} />
    </>
  );
}

/* ============================================================
   EQUIPE
   Quem é quem, e o que cada um faz. Existe pra que atribuir o GC
   de uma obra seja ESCOLHER de uma lista — e-mail digitado erra,
   e um caractere trocado deixa a obra sem dono sem ninguém ver.
   ============================================================ */

/* O painel de acesso de UMA pessoa.

   Duas perguntas, nessa ordem: o que ela abre (módulos) e quais obras ela
   enxerga. A segunda tem o caso do GC embutido — "só as minhas" se
   atualiza sozinha quando a obra troca de responsável, e é por isso que
   ela existe em vez de a coordenação remarcar a lista a cada troca. */
function AcessoDaPessoa({ p, obras, pessoas, onSalvar, onFechar }) {
  const [perfil, setPerfil] = useState(p.perfil || "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");

  /* As obras do GC saem do campo `gc` da propria obra — o mesmo que o
     Dashboard grava. Um vinculo, dois caminhos pra chegar nele; dois
     campos seriam duas verdades. */
  const [minhas, setMinhas] = useState(
    () => new Set(obras.filter((o) => String(o.gc || "").toLowerCase() === p.email).map((o) => String(o.codigo))));

  const achadas = obras.filter((o) => {
    const t = busca.trim().toLowerCase();
    return !t || `${o.codigo} ${o.nome} ${o.squad}`.toLowerCase().includes(t);
  });

  /* Nunca pode haver zero administradores: sem admin ninguem mais entra,
     e a saida seria mexer no banco a mao. */
  const tirandoOUltimoAdmin = ehOUltimoAdmin(pessoas, p.email) && perfil !== "admin";

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      await onSalvar({ ...p, perfil: perfil || null }, perfil === "gc" ? [...minhas] : null);
      onFechar();
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="ac-painel">
      <div className="ac-bloco-t">Acesso de {p.nome}</div>

      <div className="ac-regras">
        <label className={`ac-regra ${!perfil ? "on" : ""}`}>
          <input type="radio" name={`perfil-${p.email}`} checked={!perfil} onChange={() => setPerfil("")} />
          <div>
            <b>Sem acesso</b>
            <div className="ac-nota">Entra e vê só a sala de espera. É o estado de quem acabou de chegar pelo link.</div>
          </div>
        </label>
        {PERFIS.map((x) => (
          <label key={x.id} className={`ac-regra ${perfil === x.id ? "on" : ""}`}>
            <input type="radio" name={`perfil-${p.email}`} checked={perfil === x.id}
              onChange={() => setPerfil(x.id)} />
            <div>
              <b>{x.nome}</b>
              <div className="ac-nota">{x.resumo}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Só o GC precisa da lista: os outros perfis não têm obra a
          escolher, e mostrá-la neles sugeriria que têm. */}
      {perfil === "gc" && (
        <>
          <div className="ac-sub">
            Obras em que {p.nome.split(" ")[0]} é o GC
            <button className="ac-link" onClick={() => setMinhas(new Set())}>limpar</button>
          </div>
          <div className="ac-nota ac-nota-forte">
            Isto grava o <b>GC responsável</b> de cada obra — o mesmo campo do Dashboard.
            Marcar aqui tira a obra de quem era o responsável antes.
          </div>
          <div className="ac-lista">
            <div className="ac-lista-topo">
              <input className="form-input" value={busca} placeholder="filtrar obra…"
                onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="ac-lista-itens">
              {achadas.map((o) => {
                const outro = o.gc && String(o.gc).toLowerCase() !== p.email ? o.gc : null;
                return (
                  <label key={o.codigo} className={`ac-obra ${minhas.has(String(o.codigo)) ? "on" : ""}`}>
                    <input type="checkbox" checked={minhas.has(String(o.codigo))}
                      onChange={(e) => setMinhas((g) => {
                        const n = new Set(g);
                        e.target.checked ? n.add(String(o.codigo)) : n.delete(String(o.codigo));
                        return n;
                      })} />
                    <span className="mono dim">#{o.codigo}</span>
                    <span className="ac-obra-nome">{o.nome}</span>
                    {outro && <span className="ac-obra-squad">hoje é de {nomeDoEmail(outro)}</span>}
                  </label>
                );
              })}
              {achadas.length === 0 && <div className="empty-note">Nenhuma obra com esse nome.</div>}
            </div>
            <div className="ac-nota">{minhas.size} de {obras.length} marcadas</div>
          </div>
        </>
      )}

      {tirandoOUltimoAdmin && (
        <div className="ac-nota ac-nota-forte">
          <b>{p.nome} é o último administrador.</b> Promova outra pessoa antes de tirar este perfil —
          sem administrador, ninguém mais consegue liberar acesso.
        </div>
      )}
      {erro && <div className="cad-erro cad-erro-larga">{erro}</div>}
      <div className="cad-acoes">
        <button className="btn-doc btn-template" disabled={salvando || tirandoOUltimoAdmin} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar acesso"}
        </button>
        <button className="btn-doc" onClick={onFechar}>cancelar</button>
      </div>
    </div>
  );
}

function EquipeView({ pessoas, obras, carregando, erro, usuario, migracaoPendente, onSalvar, onSalvarAcesso, onExcluir }) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("GC");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [editando, setEditando] = useState(null);
  const [acessoDe, setAcessoDe] = useState(null);

  /* Cargo digitado uma vez vira sugestao pra proxima pessoa: a lista se
     configura pelo uso, sem tela de cadastro de cargo. */
  const cargosConhecidos = useMemo(() => {
    const usados = (pessoas || []).map((p) => (p.cargo || "").trim()).filter(Boolean);
    return [...new Set([...CARGOS, ...usados])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pessoas]);

  const obrasDe = (e) => obras.filter((o) => String(o.gc || "").toLowerCase() === e).length;
  const pode = email.trim().includes("@") && !salvando;

  async function salvar() {
    setSalvando(true); setAviso(null);
    try {
      await onSalvar({ email: email.trim().toLowerCase(), nome: nome.trim(), cargo, por: usuario });
      setEmail(""); setNome(""); setEditando(null);
    } catch (e) {
      setAviso(e.message || String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(p) {
    try {
      await onSalvar({ ...p, ativo: !p.ativo, por: usuario });
    } catch (e) {
      setAviso(e.message || String(e));
    }
  }

  async function remover(p) {
    const n = obrasDe(p.email);
    if (n > 0) {
      setAviso(`${p.nome} é GC de ${n} ${n === 1 ? "obra" : "obras"}. Troque o GC dessas obras antes de excluir, ou marque como inativo.`);
      return;
    }
    if (!window.confirm(`Excluir ${p.nome} da equipe?`)) return;
    try {
      await onExcluir(p.email);
    } catch (e) {
      setAviso(e.message || String(e));
    }
  }

  /* Quem esta esperando vem PRIMEIRO, num grupo proprio. Misturado por
     cargo, o pendente sumiria no meio de quem ja tem acesso — e o
     trabalho do administrador e' exatamente esvaziar essa fila. */
  const porCargo = {};
  const fila = pessoas.filter(estaPendente);
  pessoas.filter((p) => !estaPendente(p))
    .forEach((p) => { (porCargo[p.cargo || "Sem cargo"] ||= []).push(p); });
  const cargos = Object.keys(porCargo).sort();
  if (fila.length) porCargo["Aguardando liberação"] = fila;
  const ordem = fila.length ? ["Aguardando liberação", ...cargos] : cargos;

  return (
    <>
      {erro && <div className="aviso-migracao"><AlertTriangle size={14} /> <span>{erro}</span></div>}
      {aviso && <div className="aviso-migracao"><AlertTriangle size={14} /> <span>{aviso}</span></div>}

      {/* A tela nao pode so' esconder o botao de acesso: sem dizer por
          que, some uma funcao e parece defeito. */}
      {migracaoPendente && (
        <div className="eq-migracao">
          <ShieldCheck size={15} />
          <div>
            <b>A parte de perfis ainda não está ligada.</b>
            <div>
              Falta rodar <code>supabase/perfis.sql</code> no Supabase (SQL Editor). Enquanto isso,
              dá pra cadastrar, editar e desativar pessoas normalmente — só não dá pra atribuir
              perfil, porque as colunas não existem no banco ainda.
            </div>
          </div>
        </div>
      )}

      <div className="cad-box eq-form">
        <div className="cad-h"><span>{editando ? `Editando ${editando}` : "Adicionar pessoa"}</span></div>
        <div className="cad-campos eq-campos">
          {/* E-mail e' a CHAVE: e' com ele que o login se identifica, e e'
              o que liga a pessoa as obras dela. Por isso ele nao muda em
              edicao — mudar criaria uma segunda pessoa e a primeira
              ficaria com as obras. */}
          <label className="cad-largo">E-mail
            <input className="form-input" type="email" value={email} placeholder="nome.sobrenome@groupws.com.br"
              disabled={!!editando}
              onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Nome
            <input className="form-input" value={nome} placeholder={email ? nomeDoEmail(email) : "como aparece na tela"}
              onChange={(e) => setNome(e.target.value)} /></label>
          {/* As sugestoes eram um `datalist`, que o navegador desenha
              como caixa de texto comum: sete opcoes existiam e nenhuma
              aparecia. Agora sao botoes -- e o campo continua aceitando
              qualquer texto, porque cargo de empresa muda e ninguem quer
              abrir codigo pra criar um. */}
          <label className="cad-largo">Cargo
            <input className="form-input" value={cargo} placeholder="clique numa sugestão ou escreva o seu"
              onChange={(e) => setCargo(e.target.value)} />
            <div className="cargo-chips">
              {cargosConhecidos.map((c) => (
                <button key={c} type="button"
                  className={`cargo-chip ${cargo === c ? "on" : ""}`}
                  onClick={() => setCargo(cargo === c ? "" : c)}>{c}</button>
              ))}
            </div>
          </label>
        </div>
        <div className="cad-acoes">
          <button className="btn-doc btn-template" disabled={!pode} onClick={salvar}>
            {salvando ? "Salvando…" : editando ? "Salvar" : "Adicionar"}
          </button>
          {editando && (
            <button className="btn-doc" onClick={() => { setEditando(null); setEmail(""); setNome(""); setCargo("GC"); }}>
              cancelar
            </button>
          )}
          <span className="cad-nota">
            Sem nome, o e-mail vira o nome: <b>{nomeDoEmail(email) || "priscila.wayhs@… → Priscila Wayhs"}</b>
          </span>
        </div>
      </div>

      {carregando ? <div className="empty-note">Carregando…</div>
        : pessoas.length === 0 ? (
          <div className="compras-empty">
            <ShieldCheck size={30} className="dim" />
            <div className="compras-empty-title">Ninguém cadastrado ainda</div>
            {/* O painel de acesso vive DENTRO da linha de cada pessoa, e
                sem ninguem cadastrado ele nao existe em lugar nenhum da
                tela. Dizer o caminho aqui e' o que evita procurar uma
                tela de permissoes que nunca vai aparecer sozinha. */}
            <div className="compras-empty-sub">
              Comece por você: cadastre seu e-mail acima, depois clique em <b>acesso</b> na sua
              linha e marque <b>Administrador</b>. É lá, na linha de cada pessoa, que se define
              quais <b>módulos</b> ela abre e quais <b>obras</b> ela enxerga.
              <br /><br />
              Enquanto ninguém estiver cadastrado, <b>todo mundo vê tudo</b> — é o que impede
              alguém de ficar trancado do lado de fora antes de existir um administrador.
            </div>
          </div>
        ) : ordem.map((c) => (
          <div key={c} className={`arq-bloco ${c === "Aguardando liberação" ? "eq-fila" : ""}`}>
            <div className="arq-bloco-h">
              <span className="arq-bloco-tit">{c}</span>
              <span className="arq-bloco-n">{porCargo[c].length}</span>
            </div>
            {porCargo[c].map((p) => {
              const n = obrasDe(p.email);
              return (
                <div key={p.email} className={`arq-linha ${p.ativo ? "" : "eq-inativo"}`}>
                  <div className="eq-avatar">{(p.nome || p.email).slice(0, 2).toUpperCase()}</div>
                  <div className="arq-id">
                    <div className="arq-titulo">{p.nome}{!p.ativo && <span className="eq-tag-inativo">inativo</span>}</div>
                    <div className="arq-sub mono">{p.email}</div>
                  </div>
                  <span className="eq-obras">{resumoAcesso(p, obras)}</span>
                  <div className="arq-acoes">
                    {/* Sem as colunas no banco esse botao so' sabe
                        falhar. Oferecer e' pior do que nao ter: ela
                        clicou e levou um erro do Postgres na cara. */}
                    {!migracaoPendente && (
                      <button className="caderno-acao" onClick={() => setAcessoDe(acessoDe === p.email ? null : p.email)}>
                        <ShieldCheck size={12} /> acesso
                      </button>
                    )}
                    <button className="caderno-acao" onClick={() => {
                      setEditando(p.email); setEmail(p.email); setNome(p.nome); setCargo(p.cargo || "");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}>editar</button>
                    {/* Quem sai da empresa vira INATIVO, nao sumido: as
                        obras que ele tocou continuam apontando pra ele. */}
                    <button className="caderno-acao" onClick={() => alternarAtivo(p)}>
                      {p.ativo ? "desativar" : "reativar"}
                    </button>
                    <button className="ad-icon del" title="Excluir" onClick={() => remover(p)}><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
            {porCargo[c].some((p) => p.email === acessoDe) && (
              <AcessoDaPessoa p={porCargo[c].find((p) => p.email === acessoDe)} obras={obras}
                pessoas={pessoas} onSalvar={onSalvarAcesso} onFechar={() => setAcessoDe(null)} />
            )}
          </div>
        ))}
    </>
  );
}

/* O que a linha diz sobre o acesso, em uma frase. Sem isso, saber quem
   ve o que exige abrir uma a uma — e a tela deixa de responder a
   pergunta que ela existe pra responder. */
function resumoAcesso(p, obras) {
  const perfil = perfilDe(p);
  if (!perfil) return "aguardando liberação";
  if (perfil.id !== "gc") return perfil.nome;
  const n = (obras || []).filter((o) => String(o.gc || "").toLowerCase() === p.email).length;
  return `GC · ${n} ${n === 1 ? "obra" : "obras"}`;
}

/* ============================================================
   ARQUIVOS DA OBRA
   O armário: tudo que foi anexado, num lugar só, com Ver e Baixar.

   Antes dava pra anexar e não dava pra rever: o caderno subia na aba do
   Executivo e sumia de vista, e quem precisava dele depois — o
   fornecedor, o GC, a conferência de meses depois — não tinha onde
   procurar.
   ============================================================ */

/* De onde o arquivo veio. Não é etiqueta escolhida a mão: é o lugar do
   app que o guardou, e por isso não tem como ficar errada. */
const FASES_ARQUIVO = [
  { id: "executivo", nome: "Executivo", cor: "var(--blue)", bg: "var(--blue-bg)" },
  { id: "cliente", nome: "Aprovação do Cliente", cor: "var(--green)", bg: "var(--green-bg)" },
  { id: "outros", nome: "Outros", cor: "var(--ink-2)", bg: "var(--panel)" },
];
const faseArquivo = (id) => FASES_ARQUIVO.find((f) => f.id === id) || FASES_ARQUIVO[2];

/* Junta tudo que a obra tem guardado, venha de onde vier.

   Os cadernos moram num mapa (uma chave fixa cada, porque são sempre os
   mesmos quatro); os avulsos numa lista (a mesma obra tem N do mesmo
   tipo). Quem lê a tela não quer saber disso. */
const avulsosDaObra = (obra) => (Array.isArray(obra?.arquivos) ? obra.arquivos : []);

function arquivosDaObra(obra) {
  const out = [];

  CADERNOS_EXECUTIVO.forEach((c) => {
    const a = (obra.cadernos || {})[c.chave];
    if (a) out.push({ ...a, id: `caderno-${c.chave}`, titulo: c.titulo, fase: "executivo", fixo: c.chave });
  });

  if (obra.clienteAssinaturaArq) {
    out.push({
      ...obra.clienteAssinaturaArq,
      id: "assinatura-cliente",
      titulo: "Aprovação assinada pelo cliente",
      fase: "cliente",
      fixo: "assinatura",
    });
  }

  /* Array.isArray, e nao `|| []`: a coluna do banco ja existia guardando
     `{}`, e `{} || []` devolve o objeto. Foi assim que esta tela derrubou
     o app inteiro na primeira subida. */
  avulsosDaObra(obra).forEach((a) => out.push({ ...a, fase: a.fase || "outros" }));

  return out;
}

function ArquivoLinha({ a, podeEditar, onExcluir }) {
  const [ocupado, setOcupado] = useState(null);
  const [erro, setErro] = useState(null);
  const f = faseArquivo(a.fase);
  const perdido = !anexoRecuperavel(a);

  async function abrir(baixar) {
    if (a.url) { window.open(a.url, "_blank"); return; }
    setErro(null); setOcupado(baixar ? "baixar" : "ver");
    try {
      window.open(await linkParaArquivo(a.caminho, { baixar }), "_blank");
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="arq-linha">
      <FileText size={15} className={perdido ? "dim" : ""} />
      <div className="arq-id">
        <div className="arq-titulo">{a.titulo || a.nome}</div>
        <div className="arq-sub">
          {a.titulo && a.nome !== a.titulo ? `${a.nome} · ` : ""}
          {a.tamanhoKB ? `${a.tamanhoKB} KB · ` : ""}
          {a.em ? new Date(a.em).toLocaleDateString("pt-BR") : "data não registrada"}
          {a.por ? ` · ${a.por}` : ""}
        </div>
        {erro && <div className="arq-erro">{erro}</div>}
      </div>

      <span className="arq-fase" style={{ color: f.cor, background: f.bg }}>{f.nome}</span>

      {perdido ? (
        /* Anexo de antes de o app guardar arquivo: só o nome ficou
           gravado. Dizer isso é melhor que oferecer um "Baixar" que abre
           nada e faz a pessoa achar que o sistema quebrou. */
        <span className="arq-perdido">arquivo não guardado — anexe de novo</span>
      ) : (
        <div className="arq-acoes">
          <button className="caderno-acao" onClick={() => abrir(false)} disabled={!!ocupado}>
            <Search size={12} /> {ocupado === "ver" ? "Abrindo…" : "Ver"}
          </button>
          <button className="caderno-acao" onClick={() => abrir(true)} disabled={!!ocupado}>
            <Download size={12} /> {ocupado === "baixar" ? "Baixando…" : "Baixar"}
          </button>
          {/* Só o avulso se apaga aqui. Caderno e assinatura têm dono na
              esteira, e sumir com eles por esta tela deixaria a etapa de
              lá dizendo que tem anexo quando não tem mais. */}
          {podeEditar && !a.fixo && (
            <button className="ad-icon del" title="Excluir arquivo" onClick={() => onExcluir(a)}><Trash2 size={13} /></button>
          )}
        </div>
      )}
    </div>
  );
}

function ArquivosObraView({ obra, usuario, podeEditar, onArquivos }) {
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [fase, setFase] = useState("outros");

  const todos = useMemo(() => arquivosDaObra(obra), [obra]);
  const porFase = FASES_ARQUIVO
    .map((f) => ({ f, itens: todos.filter((a) => a.fase === f.id) }))
    .filter((g) => g.itens.length > 0);
  const guardados = todos.filter((a) => anexoRecuperavel(a)).length;

  async function subir(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErro(null);
    if (!supabaseConfigurado) { setErro("Sem banco configurado — o arquivo não teria onde ficar guardado."); return; }
    /* Conferir aqui, e nao deixar o Storage recusar: a mensagem de la nao
       diz qual e' o problema, e a pessoa fica sem saber se e' o arquivo,
       a internet ou o sistema. */
    if (!tipoAceito(file.name)) { setErro(`Tipo não aceito. Vale: ${EXTENSOES_ACEITAS.replace(/,/g, " ")}`); return; }
    if (file.size > 50 * 1024 * 1024) { setErro(`"${file.name}" tem ${Math.round(file.size / 1024 / 1024)} MB — o limite é 50 MB por arquivo.`); return; }
    setEnviando(true);
    try {
      const info = await subirArquivo({ obraCodigo: obra.codigo, chave: "avulso", file, por: usuario });
      onArquivos([...avulsosDaObra(obra), {
        ...info,
        id: `arq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        titulo: titulo.trim() || file.name,
        fase,
      }]);
      setTitulo("");
    } catch (err) {
      setErro(err.message || String(err));
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(a) {
    if (!window.confirm(`Excluir "${a.titulo || a.nome}"? Isso não pode ser desfeito.`)) return;
    setErro(null);
    try {
      if (a.caminho) await apagarArquivo(a.caminho);
      onArquivos(avulsosDaObra(obra).filter((x) => x.id !== a.id));
    } catch (err) {
      setErro(err.message || String(err));
    }
  }

  return (
    <>
      <div className="arq-topo">
        <div>
          <div className="arq-topo-n mono">{todos.length}</div>
          <div className="arq-topo-rot">
            {todos.length === 1 ? "arquivo nesta obra" : "arquivos nesta obra"}
            {guardados < todos.length && ` · ${todos.length - guardados} sem o arquivo guardado`}
          </div>
        </div>
        {podeEditar && (
          <div className="arq-subir">
            <input className="form-input" value={titulo} placeholder="nome do arquivo (opcional)"
              onChange={(e) => setTitulo(e.target.value)} />
            <select className="form-input" value={fase} onChange={(e) => setFase(e.target.value)}
              title="Em que fase este arquivo entra">
              {FASES_ARQUIVO.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <button className="btn-doc btn-template" disabled={enviando}
              onClick={() => inputRef.current && inputRef.current.click()}>
              <Upload size={13} /> {enviando ? "Enviando…" : "Anexar arquivo"}
            </button>
            <input ref={inputRef} type="file" accept={EXTENSOES_ACEITAS} style={{ display: "none" }} onChange={subir} />
          </div>
        )}
      </div>

      {erro && <div className="aviso-migracao"><AlertTriangle size={14} /> <span>{erro}</span></div>}

      {todos.length === 0 ? (
        <div className="compras-empty">
          <Archive size={30} className="dim" />
          <div className="compras-empty-title">Nenhum arquivo ainda</div>
          <div className="compras-empty-sub">
            Os cadernos anexados na aba <b>Executivo</b> e a aprovação assinada do cliente
            aparecem aqui sozinhos. Qualquer outro arquivo da obra pode ser anexado por este botão.
          </div>
        </div>
      ) : porFase.map(({ f, itens }) => (
        <div key={f.id} className="arq-bloco">
          <div className="arq-bloco-h">
            <span className="arq-bloco-tit">{f.nome}</span>
            <span className="arq-bloco-n">{itens.length}</span>
          </div>
          {itens.map((a) => (
            <ArquivoLinha key={a.id} a={a} podeEditar={podeEditar} onExcluir={excluir} />
          ))}
        </div>
      ))}
    </>
  );
}

/* ============================================================
   PAINEL DA MEHOO
   A obra vista pelo lado de quem fornece: quando entrega, quais
   cadernos consultar, e o que exatamente foi mandado pra eles.
   ============================================================ */

/* Baixar, sem anexar. Este painel e' de consulta: quem sobe caderno e' a
   equipe da obra, na aba do Executivo, e ter dois lugares que gravam o
   mesmo arquivo e' como um deles fica desatualizado. */
function CadernoBaixar({ titulo, arquivo }) {
  const [ocupado, setOcupado] = useState(null);   // "ver" | "baixar" | null
  const [erro, setErro] = useState(null);

  async function abrir(baixar) {
    if (arquivo?.url) { window.open(arquivo.url, "_blank"); return; }
    setErro(null); setOcupado(baixar ? "baixar" : "ver");
    try {
      window.open(await linkParaArquivo(arquivo.caminho, { baixar }), "_blank");
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setOcupado(null);
    }
  }

  const perdido = arquivo && !anexoRecuperavel(arquivo);
  return (
    <div className="mh-caderno">
      <BookOpen size={13} className={arquivo ? "" : "dim"} />
      <span className="mh-caderno-tit">{titulo}</span>
      {!arquivo ? <span className="mh-caderno-vazio">sem arquivo</span>
        : perdido ? <span className="mh-caderno-vazio">arquivo não guardado — a equipe precisa anexar de novo</span>
        : (
          <>
            <span className="mh-caderno-arq">{arquivo.nome} · {arquivo.tamanhoKB} KB</span>
            <button className="caderno-acao" onClick={() => abrir(false)} disabled={!!ocupado}>
              <Search size={12} /> {ocupado === "ver" ? "Abrindo…" : "Ver"}
            </button>
            <button className="caderno-acao" onClick={() => abrir(true)} disabled={!!ocupado}>
              <Download size={12} /> {ocupado === "baixar" ? "Baixando…" : "Baixar"}
            </button>
          </>
        )}
      {erro && <span className="mh-caderno-vazio">{erro}</span>}
    </div>
  );
}

function ObraMehoo({ L, canal }) {
  const [aberto, setAberto] = useState(false);
  const o = L.obra;
  const pct = L.total > 0 ? (L.comprado / L.total) * 100 : 0;

  return (
    <div className="mh-obra">
      <button className="mh-obra-head" onClick={() => setAberto((v) => !v)}>
        {aberto ? <ChevronDown size={15} className="dim" /> : <ChevronRight size={15} className="dim" />}
        <div className="mh-obra-id">
          <div className="mh-obra-nome"><span className="mono dim">#{o.codigo}</span> {o.nome}</div>
          {/* Squad na mesma linha do endereco: quem atende a Mehoo precisa
              saber com qual equipe falar, e isso nao custa uma linha nova. */}
          <div className="mh-obra-sub">
            <span className="mh-squad">
              <IconeSquad nome={o.squad} size={11} />
              {o.squad || "sem squad"}
            </span>
            {o.endereco && o.endereco !== "—" && <span className="mh-obra-end">· {o.endereco}</span>}
          </div>
        </div>

        {/* A data de entrega e' a primeira pergunta de quem fornece. */}
        <div className="mh-entrega">
          <div className="mh-rot">Entrega da obra</div>
          {L.entrega ? (
            <div className={`mh-entrega-val mono ${L.faltamEntrega < 0 ? "venceu" : ""}`}>
              {new Date(`${L.entrega}T12:00:00`).toLocaleDateString("pt-BR")}
              <span className="mh-dias">{L.faltamEntrega < 0
                ? `${-L.faltamEntrega} d atrás` : `em ${L.faltamEntrega} d`}</span>
            </div>
          ) : <div className="mh-sem">sem data</div>}
        </div>

        <div className="mh-num">
          <div className="mh-rot">Itens</div>
          <div className="mh-num-val mono">{L.itens.length}</div>
        </div>
        <div className="mh-num mh-num-larga">
          <div className="mh-rot">Falta comprar</div>
          <div className="mh-num-val mono">{fmtBRL(L.falta)}</div>
          <div className="gc-track"><div className="gc-fill" style={{ width: `${pct}%`, background: canal.cor }} /></div>
        </div>
        {L.atrasados > 0 && (
          <span className="gc-selo atraso"><AlertTriangle size={11} /> {L.atrasados} fora do prazo</span>
        )}
      </button>

      {aberto && (
        <div className="mh-corpo">
          <div className="mh-cadernos">
            <div className="mh-sub">Cadernos do Executivo</div>
            {CADERNOS_EXECUTIVO.map((c) => (
              <CadernoBaixar key={c.chave} titulo={c.titulo} arquivo={(o.cadernos || {})[c.chave]} />
            ))}
          </div>

          <div className="grp-itens mh-tabela">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 46 }}>Verba</th>
                  <th>Item</th>
                  <th style={{ width: 78 }} className="center">Qtd.</th>
                  <th style={{ width: 110 }} className="right">Material</th>
                  <th style={{ width: 150 }} className="center">Comprar até</th>
                  <th style={{ width: 110 }} className="center">Situação</th>
                </tr>
              </thead>
              <tbody>
                {L.itens.map((r) => {
                  const dias = r.limite ? diasAte(r.limite) : null;
                  return (
                    <tr key={r.catNum + r.it.codigo} className={r.it.comprado ? "row-comprado" : "row-falta"}>
                      <td className="mono dim">{r.catNum}</td>
                      <td>
                        <div className="item-desc">{r.it.desc}</div>
                        <div className="mh-item-sub">
                          {[r.catNome, r.it.ambiente, r.it.marca, r.it.codigoFornecedor].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="center mono">{r.it.qtdExecutivo ?? r.it.qtdVendida ?? "—"} {r.it.un || ""}</td>
                      <td className="right mono">{fmtBRL(r.material)}</td>
                      <td className="center">
                        {r.limite ? (
                          <span className={dias < 0 ? "gc-venceu" : dias <= 15 ? "mh-perto" : ""}>
                            {r.limite.toLocaleDateString("pt-BR")}
                            <span className="gc-dias">{dias < 0 ? `passou ${-dias} d` : `faltam ${dias} d`}</span>
                          </span>
                        ) : <span className="dim">—</span>}
                      </td>
                      <td className="center">
                        {r.it.comprado
                          ? <span className="chip chip-green"><Check size={11} /> comprado</span>
                          : <span className="dim">a comprar</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MehooView({ obras, carregando, erro }) {
  const canal = canalPorId("mehoo");
  // Vazio quer dizer TODAS, igual aos outros dois paineis.
  const [escolhidas, setEscolhidas] = useState(() => new Set());

  /* A lista de chips sai do painel SEM filtro: ela precisa continuar
     inteira depois de filtrar, senao quem escolhe uma obra perde o
     caminho de volta pras outras. */
  const comItens = useMemo(
    () => painelDoCanal(obras, "mehoo").linhas.map((L) => ({ codigo: String(L.obra.codigo), nome: L.obra.nome })),
    [obras]);

  const visiveis = useMemo(
    () => (escolhidas.size ? obras.filter((o) => escolhidas.has(String(o.codigo))) : obras),
    [obras, escolhidas]);
  const p = useMemo(() => painelDoCanal(visiveis, "mehoo"), [visiveis]);

  if (carregando) return <div className="empty-note">Carregando as obras…</div>;

  return (
    <>
      {erro && <div className="aviso-migracao"><AlertTriangle size={14} /> <span>{erro}</span></div>}

      {comItens.length > 1 && (
        <div className="gc-obras-filtro mh-filtro">
          <span className="gc-horizonte-rot">Obras</span>
          <FiltroObras obras={comItens} escolhidas={escolhidas} onMudar={setEscolhidas} />
        </div>
      )}

      <div className="gc-totais">
        <GcTotal rot="MATERIAL DA MEHOO" cor={canal.cor} legenda="ainda não comprado"
          feito={p.comprado} total={p.total} />
        <div className="gc-total">
          <div className="gc-total-rot" style={{ color: canal.cor }}>OBRAS COM ITENS DA MEHOO</div>
          <div className="gc-total-val mono">{p.linhas.length}</div>
          <div className="gc-total-sub">{p.nItens} {p.nItens === 1 ? "item" : "itens"} no total</div>
          {p.atrasados > 0 && (
            <div className="gc-total-pe"><b className="gc-topo-alerta">{p.atrasados} {p.atrasados === 1 ? "item fora do prazo" : "itens fora do prazo"}</b></div>
          )}
        </div>
      </div>

      {p.linhas.length === 0 ? (
        <div className="compras-empty">
          <ShoppingCart size={30} className="dim" />
          <div className="compras-empty-title">Nenhum item da Mehoo ainda</div>
          <div className="compras-empty-sub">
            Os itens aparecem aqui quando alguém escolhe <b>Mehoo</b> como canal em
            <b> Compras de Produtos</b>, dentro da obra.
          </div>
        </div>
      ) : p.linhas.map((L) => <ObraMehoo key={L.obra.codigo} L={L} canal={canal} />)}
    </>
  );
}

/* ============================================================
   BANCO DE PREÇOS POR INSUMO
   O que foi realmente pago, vindo do relatório de pedidos do Sienge.
   ============================================================ */

// O relatório do Sienge é lido NO NAVEGADOR, não no servidor.
//
// Motivo: a Vercel corta requisições acima de 4,5 MB, e esse relatório
// tem 19 MB — ele nunca chegaria lá. Lendo aqui não há envio, não há
// limite de tamanho nem de tempo, e o arquivo não sai da máquina.
//
// A biblioteca de PDF é pesada e só serve pra isso, então entra por
// import dinâmico: quem nunca abre o Banco de Preços não paga por ela.
async function extrairTextoPDF(file, onProgresso) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const partes = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    partes.push(conteudo.items.map((i) => i.str).join("\n"));
    if (onProgresso && p % 50 === 0) onProgresso(p, doc.numPages);
  }
  return partes.join("\n");
}

async function lerSiengePDF(file, onProgresso) {
  const texto = await extrairTextoPDF(file, onProgresso);
  return parseSiengeTexto(texto);
}

// Mesma lógica do backend, aqui no navegador. Guarda a compra mais
// RECENTE de cada (código + descrição + unidade): o relatório é
// histórico, então a mesma coisa aparece dezenas de vezes.
//
// Duas regras que decidem a qualidade do resultado:
//  - linhas em "vb" saem fora: é valor fechado de serviço, não preço
//    unitário ("TRANSPORTE /vb" ia de R$ 1 a R$ 12.605)
//  - a chave inclui a DESCRIÇÃO, não só o código: no Sienge o código é
//    caixa genérica ("DECORATIVOS OBRAS" cobre R$ 15 a R$ 3.845)
function parseSiengeTexto(texto) {
  const linhas = texto.split("\n").map((s) => s.trim());
  const paraISO = (br) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || "");
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  };

  let data = null;
  let fornecedor = null;
  const mapa = new Map();
  let descartadosVb = 0;

  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i] === "Data" && paraISO(linhas[i + 1])) data = paraISO(linhas[i + 1]);
    if (linhas[i] === "Fornecedor") fornecedor = linhas[i + 1] || null;

    const m = /^(\d{1,6})\s*-\s*(.+)$/.exec(linhas[i]);
    if (!m) continue;

    const qtd = linhas[i + 1];
    const unidade = (linhas[i + 2] || "").toLowerCase().trim();
    const bruto = linhas[i + 3];
    if (!/^[\d.,]+$/.test(qtd || "") || !/^[\d.,]+$/.test(bruto || "")) continue;
    const preco = parseBRL(bruto);
    if (!(preco > 0)) continue;
    if (unidade === "vb") { descartadosVb += 1; continue; }

    const descricao = m[2].replace(/\s+/g, " ").trim();
    const chave = `${m[1]}|${descricao}|${unidade}`;
    const atual = mapa.get(chave);
    if (!atual || (data && data > atual.dataRef)) {
      mapa.set(chave, { codigo: m[1], descricao, unidade, custoUnitario: preco, dataRef: data, fornecedor });
    }
  }

  return { precos: Array.from(mapa.values()).filter((p) => p.dataRef), descartadosVb };
}

// Versão Excel/CSV do mesmo relatório: lê por cabeçalho, igual às outras
// planilhas, e aplica as mesmas regras (fora "vb", mais recente ganha).
async function lerSiengeExcel(file) {
  let linhas;
  if (/\.(xlsx|xlsm|xlsb|xls)$/i.test(file.name)) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
  } else {
    linhas = parseCSVLinhas(await lerTextoComAcento(file));
  }

  let headerIdx = -1;
  for (let i = 0; i < Math.min(linhas.length, 40); i++) {
    const row = (linhas[i] || []).map((c) => String(c || "").toLowerCase());
    if (row.some((h) => /insumo|descri/.test(h)) && row.some((h) => /pre[çc]o|valor|custo/.test(h))) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error("Não encontrei as colunas de Insumo e Preço nessa planilha.");

  const header = linhas[headerIdx];
  const usadas = new Set();
  const reservar = (p) => { const i = acharColuna(header, p, usadas); if (i >= 0) usadas.add(i); return i; };
  const iCod = reservar([/^c[oó]d/, /^insumo$/]);
  const iDesc = reservar([/descri/, /insumo/]);
  const iUn = reservar([/^un\b/, /unidade/]);
  const iPreco = reservar([/pre[çc]o unit/, /custo unit/, /^pre[çc]o$/, /valor unit/, /^custo$/]);
  const iData = reservar([/data/, /dt\./, /refer/]);
  const iForn = reservar([/fornecedor/, /marca/]);

  const mapa = new Map();
  for (let i = headerIdx + 1; i < linhas.length; i++) {
    const row = linhas[i];
    if (!row) continue;
    const descricao = String(row[iDesc] ?? "").replace(/\s+/g, " ").trim();
    const preco = parseBRL(row[iPreco]);
    if (!descricao || !(preco > 0)) continue;
    const unidade = String(row[iUn] ?? "").toLowerCase().trim();
    if (unidade === "vb") continue; // valor fechado, não é preço unitário

    const dataRef = normalizarData(row[iData]);
    if (!dataRef) continue;
    const codigo = String(row[iCod] ?? "").trim() || "—";
    const chave = `${codigo}|${descricao}|${unidade}`;
    const atual = mapa.get(chave);
    if (!atual || dataRef > atual.dataRef) {
      mapa.set(chave, { codigo, descricao, unidade, custoUnitario: preco, dataRef, fornecedor: iForn >= 0 ? String(row[iForn] ?? "").trim() || null : null });
    }
  }
  return { precos: Array.from(mapa.values()) };
}

// aceita Date (do Excel) ou texto "dd/mm/aaaa" e devolve "aaaa-mm-dd"
function normalizarData(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v).trim());
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v).trim());
  return iso ? iso[0] : null;
}

function BancoPrecosView() {
  const [busca, setBusca] = useState("");
  const [precos, setPrecos] = useState([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [importando, setImportando] = useState(null);
  const inputRef = useRef(null);

  async function recarregar(termo = busca) {
    setCarregando(true);
    setErro(null);
    try {
      const [lista, qtd] = await Promise.all([listarPrecos({ busca: termo }), contarPrecos()]);
      setPrecos(lista);
      setTotal(qtd);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { recarregar(""); }, []);

  // espera a digitação parar antes de consultar o banco
  useEffect(() => {
    const t = setTimeout(() => recarregar(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  async function aoEscolher(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErro(null);
    setImportando("Lendo o arquivo…");
    try {
      const ehPDF = /\.pdf$/i.test(file.name);
      const { precos: lidos, descartadosVb } = ehPDF
        ? await lerSiengePDF(file, (p, t) => setImportando(`Lendo página ${p} de ${t}…`))
        : await lerSiengeExcel(file);
      if (!lidos || lidos.length === 0) throw new Error("Não encontrei preços nesse arquivo.");
      await salvarPrecos(lidos, (feitas, tot) => setImportando(`Gravando ${feitas} de ${tot}…`));
      setImportando(null);
      await recarregar();
      setErro(null);
      alert(`${lidos.length} insumos importados.${descartadosVb ? ` ${descartadosVb} linhas em "vb" foram ignoradas — valor fechado não serve de preço unitário.` : ""}`);
    } catch (err) {
      setImportando(null);
      setErro(err.message || String(err));
    }
  }

  return (
    <>
      <div className="import-card">
        <div className="import-bar">
          <div className="import-info">
            <Upload size={14} />
            <span>Suba o <b>Relação de Pedidos de Compra</b> do Sienge (PDF ou Excel). É o preço realmente pago; linhas em <b>vb</b> são ignoradas, porque valor fechado não serve de referência unitária.</span>
          </div>
          <button className="btn-import" disabled={!!importando} onClick={() => inputRef.current && inputRef.current.click()}>
            <Upload size={13} /> {importando || "Importar do Sienge"}
          </button>
          <input ref={inputRef} type="file" accept=".pdf,.xlsx,.xlsm,.xlsb,.xls,.csv" style={{ display: "none" }} onChange={aoEscolher} />
        </div>
        {erro && <div className="import-erro"><AlertTriangle size={14} /> {erro}</div>}
      </div>

      <div className="flat-panel">
        <div className="flat-panel-header">
          <div>
            <div className="flat-panel-title">Preços por insumo{total > 0 && ` — ${total.toLocaleString("pt-BR")} cadastrados`}</div>
            <div className="flat-panel-sub">Última compra de cada insumo. Reimportar atualiza os preços sem duplicar.</div>
          </div>
        </div>

        <div style={{ padding: "0 16px 12px" }}>
          <div className="obra-search obra-search-wide" style={{ marginBottom: 0 }}>
            <Search size={13} className="dim" />
            <input placeholder="Buscar por código ou descrição…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {busca && <button className="clear-btn" onClick={() => setBusca("")}><X size={12} /></button>}
          </div>
        </div>

        {carregando ? (
          <div className="empty-note">Carregando…</div>
        ) : precos.length === 0 ? (
          <div className="empty-note">
            {total === 0
              ? "Nenhum preço cadastrado ainda — importe o relatório do Sienge acima."
              : "Nenhum insumo encontrado com esse termo."}
          </div>
        ) : (
          <table className="vend-itens">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Código</th>
                <th>Descrição</th>
                <th style={{ width: 52 }} className="center">Un.</th>
                <th style={{ width: 110 }} className="right">Custo unit.</th>
                <th style={{ width: 92 }} className="center">Data ref.</th>
                <th style={{ width: 170 }}>Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              {precos.map((p, i) => (
                <tr key={`${p.codigo}-${i}`}>
                  <td className="mono dim">{p.codigo}</td>
                  <td>{p.descricao}</td>
                  <td className="mono center dim">{p.unidade || "—"}</td>
                  <td className="mono right forte">{fmtBRL(p.custo_unitario)}</td>
                  <td className="mono center dim">{p.data_ref ? p.data_ref.split("-").reverse().join("/") : "—"}</td>
                  <td className="dim">{p.fornecedor || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ============================================================
   NOVAS OBRAS / ARQUIVO
   O Monday diz o que existe; estas telas decidem o que entra e o
   que sai da operação do dia a dia.
   ============================================================ */

function ObraCard({ o, acao, children }) {
  return (
    <div className="obra-card">
      <div className="obra-card-info">
        <div className="obra-card-nome">{o.nome}</div>
        <div className="obra-card-sub mono">
          #{o.codigo}
          {o.squad && <> · {o.squad}</>}
          {o.cliente && o.cliente !== "—" && <> · {o.cliente}</>}
        </div>
        {children}
      </div>
      {acao}
    </div>
  );
}

/* Cadastrar obra na mao.

   O Monday e' a fonte, mas ele nao e' a unica: obra que entrou fora do
   fluxo comercial, obra antiga que precisa ser conferida agora, obra de
   teste. Sem esta porta, a unica saida era criar o board la so pra ela
   aparecer aqui.

   Tres campos, porque tres bastam: o resto (endereco, cliente, GC, valor
   vendido) a obra ganha quando os documentos subirem. */
function CadastroManualObra({ onCriar, salvando, jaExistem, equipe = [], usuario }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [squad, setSquad] = useState(SQUADS[0].nome);
  // Quem cadastra costuma ser quem vai tocar; trocar e' um campo.
  const [gc, setGc] = useState(usuario || "");
  const [erro, setErro] = useState(null);

  const cod = codigo.trim();
  /* Quatro digitos: o centro de custo E' o numero da obra, e ele vira o
     prefixo do aditivo ("2405/1") e a chave de tudo que e' guardado. */
  const codigoOk = /^\d{4}$/.test(cod);
  const repetido = codigoOk && jaExistem.has(cod);
  const pode = nome.trim() && codigoOk && !repetido && !salvando;

  async function criar() {
    setErro(null);
    try {
      await onCriar({ nome: nome.trim(), codigo: cod, squad, gc: gc.trim() || null });
      setNome(""); setCodigo(""); setAberto(false);
    } catch (e) {
      setErro(e.message || String(e));
    }
  }

  if (!aberto) {
    return (
      <button className="btn-doc cad-abrir" onClick={() => setAberto(true)}>
        <Plus size={13} /> Cadastrar obra manualmente
      </button>
    );
  }

  return (
    <div className="cad-box">
      <div className="cad-h">
        <span>Cadastrar obra manualmente</span>
        <button className="ad-icon" onClick={() => setAberto(false)}><X size={13} /></button>
      </div>
      <div className="cad-campos">
        <label className="cad-largo">Nome da obra
          <input className="form-input" value={nome} placeholder="ex: Ed. Meraki, 602"
            onChange={(e) => setNome(e.target.value)} /></label>
        <label>Centro de custo
          <input className="form-input mono" value={codigo} placeholder="2510" inputMode="numeric" maxLength={4}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          {cod && !codigoOk && <span className="cad-erro">são 4 dígitos</span>}
          {repetido && <span className="cad-erro">já existe uma obra {cod}</span>}
        </label>
        <label>Squad
          <select className="form-input" value={squad} onChange={(e) => setSquad(e.target.value)}>
            {SQUADS.map((s) => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
          </select></label>
        {/* E-mail, e nao nome: e' a identidade que o login da', e e' o
            unico jeito de "minhas obras" saber quais sao as minhas. */}
        <label className="cad-largo">GC responsável
          <select className="form-input" value={gc} onChange={(e) => setGc(e.target.value)}>
            <option value="">— definir depois —</option>
            {(equipe || []).filter((p) => p.ativo).map((p) => (
              <option key={p.email} value={p.email}>{p.nome}{p.cargo ? ` · ${p.cargo}` : ""}</option>
            ))}
          </select>
        </label>
      </div>
      {erro && <div className="cad-erro cad-erro-larga">{erro}</div>}
      <div className="cad-acoes">
        <button className="btn-doc btn-template" disabled={!pode} onClick={criar}>
          {salvando ? "Criando…" : "Criar e abrir"}
        </button>
        <span className="cad-nota">
          Ela nasce ativa e vazia — endereço, cliente e valor vendido entram quando os documentos subirem.
        </span>
      </div>
    </div>
  );
}

function NovasObrasView({ obras, onStart, onCriarManual, salvando, semBanco, codigosUsados, equipe, usuario }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtradas = obras.filter((o) => !q || `${o.nome} ${o.codigo} ${o.squad}`.toLowerCase().includes(q));

  const grupos = {};
  filtradas.forEach((o) => { (grupos[o.squad || "Outras obras"] ||= []).push(o); });
  const nomes = Object.keys(grupos).sort();

  return (
    <>
      <div className="secao-intro">
        <p>
          Estas obras existem no Monday mas ainda não foram iniciadas aqui. Ao dar start,
          a obra passa a ser gravada no banco — a partir daí, o que você fizer dentro dela
          (PDFs, conferências, aprovações) fica salvo e não se perde ao recarregar.
        </p>
      </div>

      {semBanco && (
        <div className="aviso-banco">
          Banco de dados não configurado neste ambiente — o start não vai gravar nada.
        </div>
      )}

      <CadastroManualObra onCriar={onCriarManual} salvando={salvando === "manual"} jaExistem={codigosUsados}
        equipe={equipe} usuario={usuario} />

      {obras.length > 0 && (
        <div className="obra-search obra-search-wide">
          <Search size={13} className="dim" />
          <input placeholder="Filtrar por nome, código, squad..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="clear-btn" onClick={() => setSearch("")}><X size={12} /></button>}
        </div>
      )}

      {obras.length === 0 && (
        <div className="vazio-box">
          <Sparkle size={26} className="dim" />
          <div className="vazio-titulo">Nenhuma obra nova</div>
          <div className="vazio-sub">Todas as obras do Monday já foram iniciadas ou concluídas aqui.</div>
        </div>
      )}

      {obras.length > 0 && filtradas.length === 0 && <div className="no-results">Nenhuma obra encontrada.</div>}

      {nomes.map((squad) => (
        <div key={squad} className="obra-card-grupo">
          <div className="squad-group-label">{squad} · {grupos[squad].length}</div>
          {grupos[squad].map((o) => (
            <ObraCard
              key={o.id}
              o={o}
              acao={
                <button className="btn-start" disabled={salvando === o.id || semBanco} onClick={() => onStart(o)}>
                  {salvando === o.id ? "Iniciando…" : <><Play size={13} /> Dar start</>}
                </button>
              }
            />
          ))}
        </div>
      ))}
    </>
  );
}

function ArquivoView({ obras, onReabrir, salvando }) {
  return (
    <>
      <div className="secao-intro">
        <p>Obras concluídas. Ficam guardadas para consulta e saem da lista do dia a dia.</p>
      </div>

      {obras.length === 0 && (
        <div className="vazio-box">
          <Archive size={26} className="dim" />
          <div className="vazio-titulo">Arquivo vazio</div>
          <div className="vazio-sub">Nenhuma obra foi concluída ainda.</div>
        </div>
      )}

      {obras.map((o) => (
        <ObraCard
          key={o.id}
          o={o}
          acao={
            <button className="btn-reabrir" disabled={salvando === o.id} onClick={() => onReabrir(o)}>
              {salvando === o.id ? "Reabrindo…" : <><RotateCcw size={13} /> Reabrir</>}
            </button>
          }
        />
      ))}
    </>
  );
}

// Uma obra por vez, uma pessoa por vez.
//
// Sem isso, duas pessoas na mesma obra gravariam por cima uma da outra
// sem nenhuma das duas perceber — o último a salvar apagaria o trabalho
// do outro em silêncio. Quem clica em "Habilitar edição" fica com ela;
// os demais continuam vendo tudo, só não alteram.
//
// A trava expira sozinha por inatividade. Sem esse prazo, alguém que
// fechasse o navegador no meio deixaria a obra travada para sempre.
/* Uma barra só, no topo, com as duas decisões da etapa.

   Antes eram dois blocos distantes: o estado da edição em cima e o
   "Concluir etapa" lá no fim da página, depois de trinta e duas verbas —
   quem quisesse avançar tinha que rolar até o fim pra descobrir que o
   botão existia. E são a mesma pergunta: "posso mexer?" e "já terminei?".

   Minimalista de propósito: o estado é um ponto colorido e uma palavra;
   as ações são texto. O único botão cheio é o de avançar, porque é a
   única coisa aqui que empurra a obra pra frente. */
function BarraEtapa({ edicao, salvando, carregando, onHabilitar, onFinalizar,
                      etapaId, obra, onConcluir, onReabrirEtapa }) {
  const mostraEtapa = !!etapaId && !!onConcluir;
  const feita = mostraEtapa && etapaConcluida(etapaId, obra);
  const { por: porQuem, em } = mostraEtapa ? quemConcluiu(etapaId, obra) : {};
  const congelado = obra.comprasLiberadas || !edicao.minha;

  let estado;
  if (carregando) {
    estado = <span className="be-estado"><span className="be-ponto carregando" /> Carregando…</span>;
  } else if (edicao.por) {
    const desde = edicao.desde ? new Date(edicao.desde).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
    estado = (
      <span className="be-estado" title={`Libera sozinho após ${MINUTOS_ATE_TRAVA_EXPIRAR} min sem alteração`}>
        <Lock size={13} /> <b>{edicao.por}</b> está editando{desde ? ` desde ${desde}` : ""}
      </span>
    );
  } else if (edicao.minha) {
    estado = (
      <span className="be-estado">
        <span className="be-ponto editando" /> Editando
        {/* "salvo" so quando salvou INTEIRO. Enquanto falta coluna no
            banco a palavra vira "salvo em parte", senao a tela garante
            uma coisa que nao aconteceu. */}
        <span className={`be-salvo ${salvando === "parcial" ? "be-parcial" : ""}`}>
          {salvando === "salvando" ? "salvando…" : salvando === "salvo" ? "salvo" : salvando === "parcial" ? "salvo em parte" : ""}
        </span>
        <button className="be-link" onClick={onFinalizar} disabled={salvando === "salvando"}>finalizar</button>
      </span>
    );
  } else {
    estado = (
      <span className="be-estado">
        <span className="be-ponto" /> Modo leitura
        <button className="be-link" onClick={onHabilitar}>habilitar edição</button>
      </span>
    );
  }

  return (
    <div className={`barra-etapa ${feita ? "feita" : ""}`}>
      {estado}
      <div className="be-dir">
        {mostraEtapa && (feita ? (
          <>
            <span className="be-feita">
              <CheckCircle2 size={14} /> Concluída
              {porQuem && <> por <b>{porQuem}</b></>}
              {em && <> · {new Date(em).toLocaleDateString("pt-BR")}</>}
            </span>
            {!congelado && <button className="be-link" onClick={() => onReabrirEtapa(etapaId)}>reabrir</button>}
          </>
        ) : (
          <button className="be-avancar" disabled={congelado} onClick={() => onConcluir(etapaId)}
            title="Marca esta etapa como cumprida e libera a próxima">
            <Play size={13} /> Concluir etapa
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

export default function App() {
  const [obras, setObras] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avisoMonday, setAvisoMonday] = useState(null);
  /* Abre no INICIO, e nao dentro de uma obra. O app caia na primeira da
     lista, escolhida por ordem alfabetica — que quase nunca e' a que pede
     atencao hoje, e obrigava a fechar o que abriu antes de comecar. */
  const [modulo, setModulo] = useState("inicio");
  // Registro das obras no nosso banco: código -> { situacao, ... }.
  // É isso que decide quem aparece na sidebar (ativa), quem está no
  // Arquivo (concluida) e quem ainda é só sugestão do Monday (ausente).
  const [registro, setRegistro] = useState(() => new Map());
  const [erroBanco, setErroBanco] = useState(null);
  const [siengeObras, setSiengeObras] = useState([]);
  const [siengeCarregando, setSiengeCarregando] = useState(true);
  useEffect(() => {
    let vivo = true;
    listarSiengeObras()
      .then((l) => { if (vivo) setSiengeObras(l); })
      .catch(() => {})
      .finally(() => { if (vivo) setSiengeCarregando(false); });
    return () => { vivo = false; };
  }, []);
  // Coluna que o banco ainda nao tem. Fica visivel ate a migracao rodar —
  // salvar pela metade em silencio e pior que nao salvar.
  const [migracao, setMigracao] = useState(null);
  const [salvandoObra, setSalvandoObra] = useState(null);
  // null = nenhuma aba aberta: a obra abre mostrando só o cabeçalho e o
  // resumo. Antes a aba ficava onde a pessoa tinha parado na obra
  // ANTERIOR, então trocar de obra caía direto numa tela de trabalho de
  // outra — sem contexto nenhum.
  const [tab, setTab] = useState(null);
  // Grupo da esteira (dashboard / planejamento / execucao). A obra abre no
  // Dashboard: e o resumo, e e a unica tela onde ele aparece agora.
  const [grupo, setGrupo] = useState("dashboard");
  const [itemFilter, setItemFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [eapDoBanco, setEapDoBanco] = useState(null);

  // Busca a EAP oficial uma vez, no arranque. Falha aqui não é fatal: o
  // padrão do código continua valendo, e a tela diz de onde veio.
  useEffect(() => {
    let vivo = true;
    carregarEapDoBanco()
      .then((r) => { if (vivo && r) setEapDoBanco(r); })
      .catch((e) => console.warn("EAP do banco indisponível, usando a do código:", e.message || e));
    // Alocacoes que a empresa ja decidiu, por descricao. Falhando, o app
    // segue lendo as parcelas da planilha — que e o que fazia antes.
    carregarAlocacoesDoBanco()
      .catch((e) => console.warn("Alocações padrão indisponíveis:", e.message || e));
    return () => { vivo = false; };
  }, []);
  const [expandedCats, setExpandedCats] = useState(() => new Set(["022519", "062519"]));

  // Quem está usando o app. Vira o dono da trava de edição e assina as
  // alterações — sem isso não dá pra dizer "fulano está editando".
  const [usuario, setUsuario] = useState(null);
  // Estado da edição da obra aberta: quem tem a trava e se há algo por salvar.
  const [edicao, setEdicao] = useState({ minha: false, por: null, desde: null });
  const [salvando, setSalvando] = useState(null);
  const [carregandoDados, setCarregandoDados] = useState(false);

  useEffect(() => {
    if (!supabaseConfigurado) { setUsuario("local"); return; }
    supabase.auth.getUser().then(({ data }) => setUsuario(data?.user?.email || null));
  }, []);

  // Ao abrir o app, carrega as obras reais do Monday (via proxy). Cada
  // squad aparece assim que responde — um squad lento (ex: Comet) não
  // segura os demais.
  useEffect(() => {
    let vivo = true;
    const erros = [];
    let respondidos = 0;
    let algumSucesso = false;

    SQUADS.forEach((squad) => {
      fetchSquadObras(squad)
        .then((doSquad) => {
          if (!vivo || doSquad.length === 0) return;
          algumSucesso = true;
          setObras((prev) => {
            const ids = new Set(prev.map((o) => o.id));
            const novas = doSquad.filter((o) => !ids.has(o.id));
            return [...prev, ...novas];
          });
        })
        .catch(() => { erros.push(squad.nome); })
        .finally(() => {
          respondidos += 1;
          if (!vivo) return;
          if (erros.length) setAvisoMonday(`Squads não carregados: ${erros.join(", ")}.`);
          if (respondidos === SQUADS.length) {
            setLoading(false);
            if (!algumSucesso) {
              setAvisoMonday("Não foi possível ler o Monday — confira se o proxy está no ar e tente recarregar a página.");
            }
          }
        });
    });

    return () => { vivo = false; };
  }, []);

  // Quem o time já iniciou. Isso vem do nosso banco, não do Monday —
  // é o que sobrevive a recarregar a página.
  useEffect(() => {
    let vivo = true;
    listarObras()
      .then((linhas) => {
        if (!vivo) return;
        setRegistro(new Map(linhas.map((l) => [String(l.codigo), l])));

        /* A OBRA QUE SÓ EXISTE AQUI.
         *
         * A lista da barra lateral vem do Monday. Obra cadastrada à mão
         * não está lá — então ela aparecia no instante em que era criada
         * e sumia ao recarregar, viva no banco e invisível na tela.
         *
         * Quem está no banco e não veio do Monday é remontado a partir
         * da própria linha. Casa por CÓDIGO, que é a chave de verdade da
         * obra nos dois mundos. */
        setObras((prev) => {
          const faltando = faltandoNaTela(linhas, prev)
            .map((l) => ({
              id: String(l.codigo),
              codigo: String(l.codigo),
              nome: l.nome,
              squad: l.squad || null,
              boardId: l.board_id || null,
              endereco: l.endereco || "—",
              cliente: l.cliente || "—",
              gc: l.gc || null,
              tailorMade: l.tailor_made || null,
              responsavelExecutivo: l.responsavel_executivo || null,
              area: null, prazo: null,
              valorVendido: l.valor_vendido || 0,
              categorias: buildCategorias([], null),
              semDetalhe: true,
              /* Marca de origem: sem Monday, ela não recebe atualização
                 de lá, e a tela precisa poder dizer isso. */
              manual: !l.board_id,
            }));
          return faltando.length ? [...prev, ...faltando] : prev;
        });
      })
      .catch((err) => { if (vivo) setErroBanco(err.message || String(err)); });
    return () => { vivo = false; };
  }, []);

  const situacaoDe = (o) => registro.get(String(o.codigo))?.situacao;
  /* A equipe vem ANTES da lista de obras porque a lista depende dela:
     e' `eu` que decide quais obras aparecem. Declarada depois, o
     JavaScript morre no primeiro render — "Cannot access before
     initialization" — e a tela inteira fica em branco. */
  /* A equipe carrega com o app: o seletor de GC de cada obra precisa
     dela, e ela e' uma lista curta. */
  const [pessoas, setPessoas] = useState([]);
  const [pessoasCarregando, setPessoasCarregando] = useState(true);
  const [pessoasErro, setPessoasErro] = useState(null);
  const [migracaoPendente, setMigracaoPendente] = useState(false);

  useEffect(() => {
    let vivo = true;
    /* A coluna vem primeiro: sem ela, o portao fica desligado e o app
       se comporta como antes. Depois a linha, que faz a pessoa aparecer
       na fila sem ninguem digitar o e-mail dela. §3 da SPEC. */
    migracaoDePerfilFeita()
      .then((feita) => {
        if (vivo && !feita) setMigracaoPendente(true);
        return feita && usuario ? garantirPessoa(usuario).catch(() => null) : null;
      })
      .then(() => listarPessoas())
      .then((l) => { if (vivo) setPessoas(l); })
      .catch((e) => {
        if (!vivo) return;
        /* A coluna `perfil` ainda nao existe: o app volta a se comportar
           como antes da migracao em vez de trancar todo mundo. */
        if (e.migracao) { setMigracaoPendente(true); return; }
        setPessoasErro(`Não consegui carregar a equipe: ${e.message || e}`);
      })
      .finally(() => { if (vivo) setPessoasCarregando(false); });
    return () => { vivo = false; };
  }, [usuario]);

  /* O ACESSO, aplicado. Ver docs/SPEC-acessos.md.

     `eu` e' a linha da pessoa logada. SEM PERFIL NAO ENTRA — o oposto do
     que valia antes: acesso deixou de ser concedido por omissao. O
     primeiro administrador e' semeado no SQL, sem o que a sala de espera
     trancaria inclusive quem deveria liberar. */
  const eu = useMemo(
    () => pessoas.find((p) => p.email === String(usuario || "").toLowerCase()) || null,
    [pessoas, usuario]);

  /* Enquanto a coluna nao existe, TODO o controle fica desligado — nao
     so' o portao. Desligar o portao e manter o filtro deixava a pessoa
     entrar e ver zero obra, que e' o mesmo estar trancado com outra
     cara. */
  const souAdmin = migracaoPendente || podeGerenciarPessoas(eu);
  const nPendentes = useMemo(() => (souAdmin ? pendentes(pessoas).length : 0), [pessoas, souAdmin]);
  const modulosVisiveis = useMemo(
    () => (migracaoPendente ? MODULOS : MODULOS.filter((m) => podeVerModulo(eu, m.id))),
    [eu, migracaoPendente]);

  /* Modulo que a pessoa nao pode ver nao pode ficar aberto: ela pode ter
     chegado nele antes de o acesso mudar, ou por um atalho de dentro de
     outra tela. Volta pro primeiro que ela pode. */
  useEffect(() => {
    if (pessoasCarregando || migracaoPendente || podeVerModulo(eu, modulo)) return;
    setModulo(modulosVisiveis[0]?.id || "inicio");
  }, [eu, modulo, modulosVisiveis, pessoasCarregando]);

  const obrasAtivas = useMemo(() => {
    const ativas = obras.filter((o) => situacaoDe(o) === "ativa");
    return migracaoPendente ? ativas : obrasPermitidas(eu, ativas);
  }, [obras, registro, eu, migracaoPendente]);

  /* O painel geral compara obras entre si, e os dados de uma obra so
     chegam quando alguem ABRE aquela obra — entao ele somava, na
     pratica, uma obra so. Aqui vem tudo de uma vez, e so quando o painel
     esta na tela: sao varios JSONB gordos, e quem nunca abre o painel
     nao tem por que pagar por eles. */

  async function salvarPessoaNoTime(dados) {
    const salva = await salvarPessoa(dados);
    setPessoas((prev) => {
      const sem = prev.filter((p) => p.email !== salva.email);
      return [...sem, salva].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    });
    return salva;
  }

  /* Salva o perfil e, no caso do GC, o vinculo das obras. As duas
     coisas vao juntas de proposito: escolher "GC" sem dizer quais obras
     deixaria a pessoa com um perfil que nao mostra nada. */
  async function salvarAcessoDaPessoa(dados, obrasDoGC) {
    const salva = await salvarPessoaNoTime({ ...dados, por: usuario });
    if (obrasDoGC) {
      const querem = new Set(obrasDoGC.map(String));
      const mudar = obras.filter((o) => {
        const eraDele = String(o.gc || "").toLowerCase() === salva.email;
        return querem.has(String(o.codigo)) !== eraDele;
      });
      for (const o of mudar) {
        await definirGCdaObra(o.codigo, querem.has(String(o.codigo)) ? salva.email : null);
      }
    }
    return salva;
  }

  async function excluirPessoaDoTime(email) {
    await excluirPessoa(email);
    setPessoas((prev) => prev.filter((p) => p.email !== email));
  }

  const [painelDados, setPainelDados] = useState(null);
  const [painelCarregando, setPainelCarregando] = useState(false);
  const [painelErro, setPainelErro] = useState(null);

  useEffect(() => {
    if (!["inicio", "a_contratar", "mehoo"].includes(modulo) || !obrasAtivas.length || !usuario) return;
    let vivo = true;
    setPainelCarregando(true);
    setPainelErro(null);
    /* O parcial faz a tabela ir se preenchendo lote a lote, em vez de
       ficar em branco ate a ultima obra chegar. */
    carregarResumoDeVarias(obrasAtivas.map((o) => o.codigo), (m) => { if (vivo) setPainelDados(m); })
      .then((m) => { if (vivo) setPainelDados(m); })
      .catch((e) => { if (vivo) setPainelErro(`Não consegui carregar as obras: ${e.message || e}`); })
      .finally(() => { if (vivo) setPainelCarregando(false); });
    return () => { vivo = false; };
  }, [modulo, obrasAtivas.length, usuario]);

  /* A obra aberta tem edicao em andamento na memoria; o painel nao pode
     mostrar dela um retrato mais velho do que a tela ao lado. */
  const obrasDoPainel = useMemo(() => {
    /* Toda obra ja vem do Monday com a EAP vazia — 32 grupos, zero itens.
       Entao "tem categorias" nao diz nada; o que diz e' TER ITEM. */
    const temItens = (cats) => (cats || []).some((c) => (c.itens || []).length);
    return obrasAtivas.map((o) => {
      // A obra aberta manda: ela pode ter edicao ainda nao salva na tela.
      if (o.id === selectedId && temItens(o.categorias)) return o;
      const salvo = painelDados?.get(String(o.codigo));
      if (!temItens(salvo?.categorias)) return o;
      return {
        ...o,
        // Mesma migracao que a obra recebe ao abrir: sem ela a mao de
        // obra separada aparece na verba 32 e nao no grupo dela.
        categorias: devolverMOaoGrupoDeOrigem(normalizarCategorias(salvo.categorias)),
        dataEntrega: salvo.dataEntrega,
        cadernos: salvo.cadernos || o.cadernos,
        comprasLiberadas: salvo.comprasLiberadas,
        deparaAprovado: salvo.deparaAprovado,
        cmvLiberado: salvo.cmvLiberado,
      };
    });
  }, [obrasAtivas, painelDados, selectedId]);
  const obrasConcluidas = useMemo(() => obras.filter((o) => situacaoDe(o) === "concluida"), [obras, registro]);
  const obrasNovas = useMemo(() => obras.filter((o) => !situacaoDe(o)), [obras, registro]);
  const dadosLocalizacao = useMemo(() => agruparPorLocalizacao(siengeObras, registro), [siengeObras, registro]);
  /* Otimista: a tela muda na hora, e desfaz sozinha se o Supabase
     recusar — sem isso, cada clique ficaria "cru" até a resposta ir e
     voltar, e um clique duplo enquanto isso ainda ia pro estado errado. */
  const alternarStatusLocalizacao = (codigo, statusAtual) => {
    const anterior = siengeObras.find((r) => r.codigo === codigo)?.status_manual ?? null;
    const novo = statusAtual === "finalizada" ? "ativa" : "finalizada";
    setSiengeObras((prev) => prev.map((r) => (r.codigo === codigo ? { ...r, status_manual: novo } : r)));
    marcarStatusSienge(codigo, novo).catch(() => {
      setSiengeObras((prev) => prev.map((r) => (r.codigo === codigo ? { ...r, status_manual: anterior } : r)));
    });
  };

  // Seleciona a primeira obra ativa assim que houver uma, e nunca deixa
  // uma obra que saiu da sidebar (concluída) presa como selecionada.
  useEffect(() => {
    if (obrasAtivas.length === 0) { setSelectedId(null); return; }
    setSelectedId((prev) => (obrasAtivas.some((o) => o.id === prev) ? prev : obrasAtivas[0].id));
  }, [obrasAtivas]);

  async function darStart(o) {
    setSalvandoObra(o.id);
    setErroBanco(null);
    try {
      const linha = await iniciarObra(o);
      setRegistro((prev) => new Map(prev).set(String(linha.codigo), linha));
      setModulo("comparativo");
      setSelectedId(o.id);
    } catch (err) {
      setErroBanco(`Não foi possível iniciar "${o.nome}": ${err.message || err}`);
    } finally {
      setSalvandoObra(null);
    }
  }

  /* Obra que nao veio do Monday. Ela nasce com o mesmo formato das
     outras — inclusive a EAP vazia — pra que nenhuma tela precise saber
     de onde ela veio. `boardId` fica nulo, e e' so isso que a distingue. */
  /* Sair de verdade: `scope: "local"` limpa a sessao deste navegador
     mesmo quando o token ja esta invalido e o servidor recusaria o
     signOut normal — sem isso, token podre virava um "Sair" que nao sai. */
  async function sairDaConta() {
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* segue */ }
    window.location.reload();
  }

  async function definirGCdaObra(codigo, email) {
    const linha = await definirGC(codigo, email);
    setObras((prev) => prev.map((o) => (String(o.codigo) === String(codigo) ? { ...o, gc: email } : o)));
    setRegistro((prev) => new Map(prev).set(String(linha.codigo), linha));
  }

  // Mesmo padrão do GC, pros outros dois papéis de "Equipe da obra".
  async function definirTailorMadeDaObra(codigo, email) {
    const linha = await definirTailorMade(codigo, email);
    setObras((prev) => prev.map((o) => (String(o.codigo) === String(codigo) ? { ...o, tailorMade: email } : o)));
    setRegistro((prev) => new Map(prev).set(String(linha.codigo), linha));
  }

  async function definirResponsavelExecutivoDaObra(codigo, email) {
    const linha = await definirResponsavelExecutivo(codigo, email);
    setObras((prev) => prev.map((o) => (String(o.codigo) === String(codigo) ? { ...o, responsavelExecutivo: email } : o)));
    setRegistro((prev) => new Map(prev).set(String(linha.codigo), linha));
  }

  async function criarObraManual({ nome, codigo, squad, gc }) {
    setSalvandoObra("manual");
    setErroBanco(null);
    try {
      const nova = {
        id: codigo, codigo, nome, squad,
        boardId: null, endereco: "—", cliente: "—", gc: gc || null,
        area: null, prazo: null, valorVendido: 0,
        categorias: buildCategorias([], null),
        semDetalhe: true, manual: true,
      };
      const linha = await iniciarObra(nova);
      setObras((prev) => (prev.some((o) => String(o.codigo) === codigo) ? prev : [...prev, nova]));
      setRegistro((prev) => new Map(prev).set(String(linha.codigo), linha));
      setModulo("comparativo");
      setSelectedId(nova.id);
    } catch (err) {
      const msg = /duplicate key|already exists/i.test(err.message || "")
        ? `Já existe uma obra com o centro de custo ${codigo}.`
        : (err.message || String(err));
      setErroBanco(`Não foi possível criar "${nome}": ${msg}`);
      throw new Error(msg);
    } finally {
      setSalvandoObra(null);
    }
  }

  async function marcarConcluida(o) {
    // Concluir tira a obra da lista de todo mundo, e o botão fica ao lado
    // do nome da obra — dá pra clicar sem querer. Confirmar custa um
    // segundo; descobrir depois por que a obra sumiu custa bem mais.
    const ok = window.confirm(
      `Concluir a obra "${o.nome}"?\n\n` +
      "Ela sai da lista de obras ativas e vai para o Arquivo, em modo consulta — " +
      "ninguém do time consegue mais alterar nada nela.\n\n" +
      "Dá para reabrir depois, pelo Arquivo."
    );
    if (!ok) return;

    setSalvandoObra(o.id);
    setErroBanco(null);
    try {
      const linha = await concluirObra(o.codigo);
      setRegistro((prev) => new Map(prev).set(String(linha.codigo), linha));
    } catch (err) {
      setErroBanco(`Não foi possível concluir "${o.nome}": ${err.message || err}`);
    } finally {
      setSalvandoObra(null);
    }
  }

  async function marcarAtiva(o) {
    setSalvandoObra(o.id);
    setErroBanco(null);
    try {
      const linha = await reabrirObra(o.codigo);
      setRegistro((prev) => new Map(prev).set(String(linha.codigo), linha));
      setModulo("comparativo");
      setSelectedId(o.id);
    } catch (err) {
      setErroBanco(`Não foi possível reabrir "${o.nome}": ${err.message || err}`);
    } finally {
      setSalvandoObra(null);
    }
  }

  const obra = obras.find((o) => o.id === selectedId);

  // Ao abrir uma obra, traz o que já foi salvo dela.
  useEffect(() => {
    if (!obra?.codigo || !usuario) return;
    let vivo = true;
    setCarregandoDados(true);
    setEdicao({ minha: false, por: null, desde: null });
    const codigo = obra.codigo;

    /* Os aditivos aprovados mexem no orcamento, no CMV e no Plano de
       Compras — entao eles chegam junto com a obra, e nao so quando
       alguem abre o modulo. */
    listarAditivos(codigo)
      .then((lista) => { if (vivo) setObras((prev) => prev.map((o) => (o.codigo === codigo ? { ...o, aditivos: lista } : o))); })
      .catch(() => { /* aditivo indisponivel nao pode impedir a obra de abrir */ });

    carregarDadosObra(codigo)
      .then((dados) => {
        if (!vivo || !dados) return;
        setObras((prev) => prev.map((o) => (o.codigo === codigo ? {
          ...o,
          /* `devolverMOaoGrupoDeOrigem` conserta sozinha as obras que ja
             tinham separacao: a linha de mao de obra ia parar numa verba
             de "Execucao e Mao de Obra", longe do grupo onde o valor e
             conferido. Sem isso, seria preciso desfazer e refazer uma a
             uma na mao. */
          categorias: (dados.categorias || []).length
            ? devolverMOaoGrupoDeOrigem(normalizarCategorias(dados.categorias))
            : o.categorias,
          cadernos: dados.cadernos,
          arquivos: dados.arquivos,
          aprovacoes: dados.aprovacoes,
          deparaAprovado: dados.deparaAprovado,
          executivoLiberadoDireto: dados.executivoLiberadoDireto,
          comprasLiberadas: dados.comprasLiberadas,
          // Sem estas três, o CMV liberado se perdia no reload: a aba
          // Executivo continuava aberta (isso é `deparaAprovado`), mas o
          // teto voltava vazio e os blocos que dependem dele — resumo do
          // topo e fechamento do rodapé — simplesmente não renderizavam.
          etapasConcluidas: dados.etapasConcluidas,
          clienteAssinouEm: dados.clienteAssinouEm,
          clienteAssinaturaPor: dados.clienteAssinaturaPor,
          clienteAssinaturaArq: dados.clienteAssinaturaArq,
          clienteAssinaturaObs: dados.clienteAssinaturaObs,
          compraSemAssinaturaPor: dados.compraSemAssinaturaPor,
          compraSemAssinaturaEm: dados.compraSemAssinaturaEm,
          compraSemAssinaturaJust: dados.compraSemAssinaturaJust,
          cmvLiberado: dados.cmvLiberado,
          cmvLiberadoEm: dados.cmvLiberadoEm,
          cmvLiberadoPor: dados.cmvLiberadoPor,
          dataEntrega: dados.dataEntrega,
          escopos: dados.escopos,
          // Campos DERIVADOS das categorias. Sem refazer a conta aqui, a
          // obra volta do banco com os itens certos e os totais do Monday
          // — que sao zero. O cabecalho dizia "R$ 0,00" numa obra com R$
          // 632 mil em produtos.
          ...derivadosDasCategorias(devolverMOaoGrupoDeOrigem(normalizarCategorias(dados.categorias)), o),
        } : o)));
        const deOutro = dados.editandoPor && dados.editandoPor !== usuario;
        setEdicao({
          /* `perfilEdita` tambem aqui: a trava do banco pode dizer que a
             obra e' minha de uma sessao anterior, mas quem nao edita por
             perfil nao passa a editar por causa disso. */
          minha: dados.editandoPor === usuario && (migracaoPendente || perfilEdita(eu)),
          por: deOutro ? dados.editandoPor : null,
          desde: deOutro ? dados.editandoDesde : null,
        });
      })
      .catch((e) => { if (vivo) setErroBanco(e.message || String(e)); })
      .finally(() => { if (vivo) setCarregandoDados(false); });

    return () => { vivo = false; };
  }, [obra?.codigo, usuario]);

  // Salvamento automático. Sem botão "Salvar", porque botão é justamente
  // o jeito de esquecer e perder o trabalho. Espera a mão parar — subir
  // uma planilha dispara várias mudanças seguidas — e só grava quem está
  // com a trava, senão duas pessoas se sobrescreveriam.
  // Dispara sempre que o conteúdo da obra muda — em vez de marcar "sujo"
  // em cada uma das dezenas de ações, que é onde se esquece uma e o dado
  // se perde justamente ali.
  useEffect(() => {
    if (!obra?.codigo || !edicao.minha) return;
    const t = setTimeout(async () => {
      setSalvando("salvando");
      try {
        /* O aviso de coluna faltando existia e nunca chegava na tela.

           `salvarDadosObra` tira do payload a coluna que o banco ainda
           nao conhece, grava o resto e devolve `migracaoPendente` dizendo
           qual. Ninguem lia esse retorno: o app dizia "salvo", o campo
           novo voltava vazio no F5 e o defeito parecia estar no campo.
           Foi o que aconteceu com a data de entrega. */
        const r = await salvarDadosObra(obra.codigo, obra, usuario);
        setMigracao(r?.migracaoPendente || null);
        setSalvando(r?.migracaoPendente ? "parcial" : "salvo");
        setTimeout(() => setSalvando(null), 2000);
      } catch (e) {
        setSalvando(null);
        setErroBanco(`Não consegui salvar: ${e.message || e}`);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [obra, edicao.minha, usuario]);

  /* A TRAVA SO VIVE ENQUANTO A PESSOA ESTA NA OBRA.

     Ela era solta so pelo botao "finalizar". Quem trocava de obra, ia
     olhar um modulo ou fechava a aba deixava a obra travada em nome dele
     — e a pessoa do lado via "em edicao por..." numa obra que ninguem
     estava editando. A expiracao de 30 minutos era a unica saida, e 30
     minutos e' meia manha de trabalho parada.

     Agora a trava e' um efeito com dono: ela existe enquanto (a edicao e'
     minha) E (estou na tela da obra) E (e' esta obra). Qualquer uma
     dessas tres deixar de valer, a limpeza do efeito solta. */
  const travaRef = useRef(null);
  const naObra = modulo === "comparativo";

  useEffect(() => {
    const codigo = edicao.minha && naObra ? obra?.codigo : null;
    travaRef.current = codigo || null;
    if (!codigo) return;
    return () => { liberarEdicao(codigo, usuario).catch(() => {}); };
  }, [edicao.minha, naObra, obra?.codigo, usuario]);

  /* Sair da obra tambem volta a tela pro modo leitura. Sem isso a trava
     era solta no banco mas a tela continuava dizendo "Editando" — e a
     pessoa seguia digitando numa obra que ja estava livre pra outro. */
  useEffect(() => {
    if (!naObra && edicao.minha) setEdicao({ minha: false, por: null, desde: null });
  }, [naObra, edicao.minha]);

  /* Fechar a aba. `pagehide` e nao `beforeunload` porque este dispara em
     celular e em navegacao de volta; a promessa nao termina, mas o pedido
     sai — e se nao sair, a expiracao de 30 minutos ainda cobre. */
  useEffect(() => {
    const sair = () => {
      if (travaRef.current) liberarEdicao(travaRef.current, usuario).catch(() => {});
    };
    window.addEventListener("pagehide", sair);
    return () => window.removeEventListener("pagehide", sair);
  }, [usuario]);

  /* O perfil manda na edicao antes da trava: o Mehoo consulta, e nem
     chega a disputar a obra com ninguem. */
  const perfilPermiteEditar = migracaoPendente || perfilEdita(eu);

  async function habilitarEdicao() {
    if (!perfilPermiteEditar) return;
    if (!obra?.codigo) return;
    setErroBanco(null);
    try {
      const r = await pegarEdicao(obra.codigo, usuario);
      if (r.ok) setEdicao({ minha: true, por: null, desde: null });
      else setEdicao({ minha: false, por: r.por, desde: r.desde });
    } catch (e) {
      setErroBanco(e.message || String(e));
    }
  }

  async function finalizarEdicao() {
    if (!obra?.codigo) return;
    setSalvando("salvando");
    try {
      const r = await salvarDadosObra(obra.codigo, obra, usuario);
      setMigracao(r?.migracaoPendente || null);
      await liberarEdicao(obra.codigo, usuario);
      setEdicao({ minha: false, por: null, desde: null });
      setSalvando(null);
    } catch (e) {
      setSalvando(null);
      setErroBanco(`Não consegui salvar antes de liberar: ${e.message || e}`);
    }
  }

  const totals = useMemo(() => {
    const vazio = { totalVendido: 0, totalExecutivo: 0, criticos: 0, itensAlerta: 0, totalProdutos: 0, totalComprado: 0, falta: 0, pct: 0 };
    if (!obra) return vazio;
    const totalVendido = obra.categorias.reduce((a, c) => a + (c.vendido || 0), 0);
    const totalExecutivo = obra.categorias.reduce((a, c) => a + (c.executivo || 0), 0);
    const criticos = obra.categorias.filter((c) => categoriaStatus(c) === "critico").length;
    let itensAlerta = 0;
    obra.categorias.forEach((c) => (c.itens || []).forEach((it) => { if (itemAlertas(it).length) itensAlerta += 1; }));
    const compras = obraComprasStats(obra);
    return { totalVendido, totalExecutivo, criticos, itensAlerta, ...compras };
  }, [obra]);

  function toggleCat(num) {
    setExpandedCats((prev) => { const next = new Set(prev); next.has(num) ? next.delete(num) : next.add(num); return next; });
  }

  function updateItem(catIdx, itemIdx, patch) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = o.categorias.map((c, ci) => {
        if (ci !== catIdx) return c;
        const itens = c.itens.map((it, ii) => (ii === itemIdx ? { ...it, ...patch } : it));
        return { ...c, itens };
      });
      return { ...o, categorias };
    }));
  }

  // Vendido Contrato (PDF): atualiza o valor por verba + os itens
  // (descrição/ambiente/quantidade — sem valor, o contrato é fechado por verba).
  function importVendidoContrato(valores, itens) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const porVerba = {};
      (itens || []).forEach((it) => {
        // Copia o item INTEIRO em vez de listar campo a campo.
        //
        // A lista fixa congelava no tempo: quando o leitor passou a marcar
        // `qtdColada` (a quantidade que veio grudada na descrição e precisa
        // ser conferida), a marca morria aqui — o parser mandava, a tela
        // nunca recebia, e o destaque laranja nunca apareceria. Mesmo erro
        // que já tinha acontecido no importador do Executivo.
        (porVerba[it.num] = porVerba[it.num] || []).push({
          ...it, ambiente: it.ambiente || "—",
        });
      });
      const categorias = o.categorias.map((c) => {
        const patch = {};
        if (valores[c.num] != null) patch.vendido = valores[c.num];
        if (porVerba[c.num]) patch.itensContrato = porVerba[c.num];
        return Object.keys(patch).length ? { ...c, ...patch } : c;
      });
      const valorVendido = categorias.reduce((a, c) => a + (c.vendido || 0), 0);
      return { ...o, categorias, valorVendido };
    }));
  }

  // Vendido Planilha (Excel): itens mais elaborados, com marca e custo.
  // Não atualiza o valor por verba (esse vem do Contrato).
  /* Remove o que veio de UM documento, sem tocar nos outros.
     Subir o arquivo errado precisa ter volta: antes o unico jeito de
     desfazer era subir outro por cima, e se o certo ainda nao existisse a
     obra ficava com o dado errado. */
  /* Corrige na tela um item lido do Contrato.

     O leitor de PDF acerta a maioria das linhas, nunca todas — layout de
     PDF nao tem contrato de formato. Sem poder corrigir aqui, cada linha
     torta virava uma rodada minha de conserto no parser, com a obra
     parada esperando deploy. */
  function editarItemContrato(catNum, codigo, patch) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = o.categorias.map((c) => {
        if (c.num !== catNum) return c;
        return { ...c, itensContrato: (c.itensContrato || []).map((it) => (
          it.codigo === codigo ? { ...it, ...patch, editadoNaMao: true } : it
        )) };
      });
      return { ...o, categorias };
    }));
  }

  /* Aprovar uma linha de conferência — agora na obra, não no componente.

     As duas telas de conferência guardavam as aprovações num useState
     local. Elas funcionavam na sessão e sumiam no F5: o trabalho de
     conferir cento e oitenta linhas se perdia inteiro, e no Depara isso
     era pior, porque é a aprovação das linhas que libera o CMV.

     A chave leva o ESCOPO junto. As duas telas comparam documentos
     diferentes e podem ter o mesmo par verba+código: sem o prefixo,
     aprovar uma linha no Depara marcaria sozinha a linha correspondente na
     Conferência do Executivo, que é uma conferência que ninguém fez. */
  function aprovarLinhaConferencia(escopo, catNum, codigo) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const atual = new Set(o.aprovacoes || []);
      atual.add(`${escopo}:${catNum}:${codigo}`);
      return { ...o, aprovacoes: atual };
    }));
  }

  function limparImportacao(campos) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = o.categorias.map((c) => {
        const limpo = { ...c };
        campos.forEach((campo) => { limpo[campo] = []; });
        if (campos.includes("itensContrato")) limpo.vendido = 0;
        return limpo;
      // grupo fora do padrao que ficou sem nenhum item some junto
      }).filter((c) => !c.foraDaEapPadrao || ["itens", "itensContrato", "itensPlanilha", "itensPlanilhaExecutivo"]
        .some((k) => (c[k] || []).length));
      return { ...o, categorias };
    }));
  }

  function importVendidoPlanilha(itens) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = aplicarItensNasVerbas(o.categorias, itens, "itensPlanilha");
      return { ...o, categorias };
    }));
  }

  // Executivo (PDF — Composição de Custo): substitui os itens da verba
  // pelos recém-importados (produto/serviço já classificados por custo).
  function importExecutivo(itens) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = aplicarItensNasVerbas(o.categorias, itens, "itens");
      return { ...o, categorias };
    }));
  }

  // Libera o CMV desta obra e abre o Executivo.
  //
  // O valor fica CONGELADO aqui. O Executivo compara o gasto contra ele
  // — se fosse recalculado a cada abertura, mexer numa linha do depara
  // moveria o teto junto e o estouro sumiria sozinho. Teto que se ajusta
  // ao gasto não é teto.
  function aprovarDepara(cmv) {
    setObras((prev) => prev.map((o) => (o.id === selectedId
      ? { ...o, deparaAprovado: true, cmvLiberado: cmv, cmvLiberadoEm: new Date().toISOString(), cmvLiberadoPor: usuario }
      : o)));
  }

  // Abre o Executivo direto, sem passar pelo Depara — pra obra sem
  // Vendido Contrato/Planilha (só cadastro do Monday), que não tem com o
  // que montar a comparação. FICA À PARTE de `deparaAprovado`: o Depara
  // continua aparecendo como "não concluído" no Planejamento (ele de
  // fato não foi feito, só foi pulado), e o CMV fica sem teto até
  // alguém liberar de verdade pelo Depara — se a obra um dia ganhar
  // Vendido pra comparar.
  function comecarExecutivoSemDepara() {
    setObras((prev) => prev.map((o) => (o.id === selectedId
      ? { ...o, executivoLiberadoDireto: true }
      : o)));
  }

  // Edita um valor do Executivo direto na tela. Nem tudo chega pronto do
  // arquivo — na planilha real, lâmpadas e fontes vêm com quantidade e
  // sem custo — então o time completa aqui.
  //
  // Mexe nas duas listas da verba: `itensPlanilhaExecutivo` (o que a tela
  // mostra) e `itens` (o que alimenta Plano de Compras, Compras e
  // Contratos). As duas nascem do mesmo import, na mesma ordem.
  function editarItemExecutivo(catNum, idx, patch) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = o.categorias.map((c) => {
        if (c.num !== catNum) return c;
        const aplicar = (lista) => (lista || []).map((it, i) => (i === idx ? recalcularCustos({ ...it, ...patch }, patch) : it));
        return { ...c, itensPlanilhaExecutivo: aplicar(c.itensPlanilhaExecutivo), itens: aplicar(c.itens) };
      });
      return { ...o, categorias };
    }));
  }

  // Traz a planilha do criativo como ponto de partida do Executivo.
  //
  // É o fluxo real: o executivo não começa do zero, começa do que foi
  // vendido e conferido no depara. Cada item leva junto o valor de
  // origem (`vendido`), pra que qualquer alteração daqui pra frente
  // possa ser mostrada ao lado do que veio — sem isso, a equipe altera
  // sem enxergar o quanto está se afastando do que foi vendido.
  function puxarDoCriativo() {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = o.categorias.map((c) => {
        const base = c.itensPlanilha || [];
        if (base.length === 0) return c;
        const copia = base.map((it) => ({
          ...it,
          origem: "criativo",
          vendido: {
            qtd: it.qtdVendida, custoUnitario: it.custoUnitario, custo: it.custo,
            custoMaterial: it.custoMaterial ?? null, custoMO: it.custoMO ?? null,
          },
          tipo: it.tipo || ((it.custoMaterial ?? it.custo ?? 0) > 0 ? "produto" : "servico"),
          contavel: !it.ehTitulo,
          liberado: false, comprado: false, valorComprado: null, statusContrato: null,
        }));
        return { ...c, itensPlanilhaExecutivo: copia, itens: copia };
      });
      return { ...o, categorias };
    }));
  }

  // `insumo` vem do Banco de Preços quando a pessoa escolhe um; null
  // quando ela opta por criar em branco. Vindo do banco, o item já nasce
  // com o nome que o Sienge conhece — o que faz a compra casar depois —
  // e com o preço de referência preenchido.
  /* Código de uma linha inserida no meio: 3.5 -> 3.5.1, 3.5.2...

     Renumerar tudo pra baixo (o que o Excel faz) faria o mesmo item ter
     código diferente no criativo e no executivo, e invalidaria qualquer
     código que alguém tenha anotado. Como sufixo, a linha nova diz de onde
     nasceu e ninguém mais muda de lugar. */
  function codigoInserido(codigoAcima, irmaos) {
    if (!codigoAcima) return null;
    const usados = new Set((irmaos || []).map((it) => it.codigo).filter(Boolean));
    for (let n = 1; n < 100; n++) {
      const tentativa = `${codigoAcima}.${n}`;
      if (!usados.has(tentativa)) return tentativa;
    }
    return null;
  }

  function adicionarItemExecutivo(catNum, insumo, depoisDoIndice = null, substituindo = null) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = o.categorias.map((c) => {
        if (c.num !== catNum) return c;
        const novo = insumo ? {
          codigo: null, num: catNum,
          desc: insumo.descricao,
          un: insumo.unidade || null,
          qtdVendida: null,
          custoMaterial: insumo.custo_unitario, custoMO: null,
          totalMaterial: null, totalMO: null, custo: null,
          custoUnitario: insumo.custo_unitario,
          insumoSienge: insumo.codigo,
          precoRefData: insumo.data_ref,
          manual: true, tipo: "produto", contavel: false,
          alteradoExecutivo: true,
        } : {
          codigo: null, desc: "Novo item — clique para descrever", num: catNum,
          qtdVendida: null, un: null, custoMaterial: null, custoMO: null,
          totalMaterial: null, totalMO: null, custo: null,
          manual: true, tipo: "produto", contavel: false,
        };
        /* Insere DEPOIS da linha escolhida, ou no fim quando nenhuma foi.

           A posição importa: a planilha do executivo é lida na ordem, e um
           item que pertence ao trecho da cozinha não pode aparecer trinta
           linhas abaixo, no meio dos quartos, só porque o app só sabia
           acrescentar no fim. */
        const inserir = (lista) => {
          const arr = [...(lista || [])];
          if (depoisDoIndice == null || depoisDoIndice < 0 || depoisDoIndice >= arr.length) {
            arr.push(novo);
          } else {
            arr.splice(depoisDoIndice + 1, 0, novo);
          }
          return arr;
        };
        /* Procura o código mais próximo ACIMA, não só o da linha imediata.

           Inserindo abaixo de uma linha que também nasceu aqui (e ainda não
           tem código), a linha imediata não serve de âncora — e o item
           nascia com traço, sem lugar na numeração. Subindo até achar um
           código de verdade, a segunda inserção vira 3.14.2 em vez de nada. */
        const lista = c.itensPlanilhaExecutivo || [];
        let ancora = null;
        for (let k = depoisDoIndice; k >= 0 && ancora == null; k--) {
          if (lista[k]?.codigo) ancora = lista[k].codigo;
        }
        if (depoisDoIndice != null && ancora) novo.codigo = codigoInserido(ancora, lista);

        /* Substituição é UM ato, não "excluí" + "adicionei".

           Feitas soltas, as duas ações deixavam a tela cheia de amarelo e
           vermelho sem dizer o que virou o quê — e o item novo ainda ia
           parar no fim da lista, longe do que ele substituiu. Aqui os dois
           ficam vizinhos e apontam um pro outro, então a leitura da linha
           responde sozinha "trocaram o spot da Suíte 01 por este". */
        const velho = substituindo != null ? lista[substituindo] : null;
        if (velho) {
          novo.substitui = velho.codigo || null;
          novo.substituiDesc = velho.desc || null;
        }
        // marca o substituído como excluído e aponta pro novo
        const marcar = (arr) => arr.map((it, k) => (
          substituindo != null && k === substituindo
            ? { ...it, excluido: true, substituidoPor: novo.codigo || null, substituidoPorDesc: novo.desc || null }
            : it
        ));
        return {
          ...c,
          itensPlanilhaExecutivo: inserir(marcar(c.itensPlanilhaExecutivo || [])),
          itens: inserir(marcar(c.itens || [])),
        };
      });
      return { ...o, categorias };
    }));
  }

  // Libera o Plano de Compras: a partir daqui, compras e contratações
  // seguem, e nada das etapas anteriores pode mais ser mexido.
  // `estouro` vem preenchido quando o Executivo passou do CMV — traz a
  // justificativa e quem autorizou. Fica gravado na obra: a decisão é de
  // gente, mas o registro não é opcional.
  function liberarCompras(estouro) {
    setObras((prev) => prev.map((o) => (o.id === selectedId ? {
      ...o,
      /* Sugestão pendente na hora de liberar vira decisão.

         Ela já estava marcada e já contava no total do plano — deixá-la
         num terceiro estado depois do congelamento criaria item que a
         tela dizia que ia pra compra e que Compras nunca receberia. */
      categorias: o.categorias.map((cat) => ({
        ...cat,
        itens: cat.itens || [],
      })),
      comprasLiberadas: true,
      compraLiberadaEm: new Date().toISOString(),
      compraLiberadaPor: usuario,
      estouroAprovado: estouro ? { ...estouro, em: new Date().toISOString(), registradoPor: usuario } : null,
      // Exceção do portão da assinatura, em campo próprio: "quem liberou
      // compra sem o cliente ter aprovado" é a pergunta que alguém vai
      // fazer, e ela não pode depender de garimpar dentro do estouro.
      ...(estouro?.semAssinatura ? {
        compraSemAssinaturaPor: estouro.aprovador,
        compraSemAssinaturaEm: new Date().toISOString(),
        compraSemAssinaturaJust: estouro.justificativa,
      } : {}),
    } : o)));
  }

  // Desfaz a liberação. Toda trava precisa de volta — sem isso um clique
  // sem querer congelaria a obra pra sempre.
  /* Aceita de uma vez tudo que o sistema sugeriu.

     É o caminho comum do Plano de Compras: a pessoa olha o lote, aceita,
     e depois tira as poucas linhas que não vão. O contrário — marcar
     item por item as 60 luminárias de uma obra — é o que faz alguém
     desistir da tela e voltar pro Excel. */


  function reabrirCompras() {
    setObras((prev) => prev.map((o) => (o.id === selectedId ? { ...o, comprasLiberadas: false } : o)));
  }

  // Edita, linha a linha, o item do lado "planilha" (coluna B) de um
  // depara — usado tanto no Depara Contrato×Planilha (edita itensPlanilha)
  // quanto no Conf. Executivo (edita itensPlanilhaExecutivo).
  function editarLinhaDepara(campoArray, catNum, codigo, patch) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = o.categorias.map((c) => {
        if (c.num !== catNum) return c;
        const lista = c[campoArray] || [];
        const existe = lista.some((it) => it.codigo === codigo);
        const novaLista = existe
          ? lista.map((it) => (it.codigo === codigo ? { ...it, ...patch } : it))
          : [...lista, { codigo, ...patch }];
        return { ...c, [campoArray]: novaLista };
      });
      return { ...o, categorias };
    }));
  }
  const editarItemPlanilha = (catNum, codigo, patch) => editarLinhaDepara("itensPlanilha", catNum, codigo, patch);
  const editarItemPlanilhaExecutivo = (catNum, codigo, patch) => editarLinhaDepara("itensPlanilhaExecutivo", catNum, codigo, patch);

  // Caderno de Especificação: só guarda o arquivo (upload/download, sem parse).
  // Os cadernos ficam guardados por chave ("especificacao", "marcenaria",
  // "projeto") — só arquivo pra consulta, nada é lido deles.
  function trocarArquivosDaObra(lista) {
    setObras((prev) => prev.map((o) => (o.id === selectedId ? { ...o, arquivos: lista } : o)));
  }

  function importCaderno(chave, info, caminhoAnterior) {
    setObras((prev) => prev.map((o) => (
      o.id === selectedId ? { ...o, cadernos: { ...(o.cadernos || {}), [chave]: info } } : o
    )));
    // Trocar o caderno já gravou o novo; o antigo vira lixo no Storage.
    if (caminhoAnterior) apagarArquivo(caminhoAnterior);
  }

  // Planilha Executivo: mesma origem populando dois formatos — o
  // "simples" (itensPlanilhaExecutivo, pro depara e a própria tela) e o
  // "rico" (itens, que já alimenta Comparativo/Compras/Contratos).
  function importPlanilhaExecutivo(itens) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      // Enriquece antes de distribuir: a comparação com o criativo depende
      // da verba de destino, que é a mesma em que o item vai cair.
      const porVerba = {};
      (itens || []).forEach((it) => { (porVerba[it.num] = porVerba[it.num] || []).push(it); });
      const categorias = aplicarItensNasVerbas(o.categorias, itens, "itensPlanilhaExecutivo").map((c) => {
        if (!porVerba[c.num]) return c;
        // Guarda o item INTEIRO. Antes essa lista era montada campo a
        // campo, e ficou congelada no tempo: quando as colunas de
        // material e mão de obra passaram a existir, elas não entraram
        // aqui — o arquivo trazia os valores e a tela mostrava "—".
        // Copiar tudo evita que a próxima coluna nova se perca igual.
        const doArquivo = porVerba[c.num].map((it) => ({
          ...it,
          qtdVendida: it.qtdVendida ?? it.qtdExecutivo,
          // Item vindo do EXECUTIVO tem quantidade de executivo. O leitor
          // grava so em `qtdVendida` (o campo que o criativo usa), e todo
          // o resto do app pergunta por `qtdExecutivo`.
          qtdExecutivo: it.qtdExecutivo ?? it.qtdVendida,
          // guarda o que o criativo tinha, pra coluna de comparação
          vendido: casarComCriativo(it, c.itensPlanilha),
        }));
        return { ...c, itens: doArquivo, itensPlanilhaExecutivo: doArquivo };
      });
      /* Iluminacao, climatizacao, moveis soltos e loucas/metais ja
         chegam partidos: nessas a empresa sempre compra o material e
         contrata a mao de obra, entao deixar as duas parcelas na mesma
         linha obrigaria a separar tudo na mao, item por item.

         So `itens` e afetado. `itensPlanilhaExecutivo` continua sendo o
         documento como veio do arquivo — e o que a Conf. Executivo
         compara, e comparar contra uma versao ja mexida esconderia
         justamente a diferenca que ela existe pra achar. */
      return { ...o, categorias: separarMOnasVerbasDeContrato(categorias).categorias };
    }));
  }

  // Cria uma solicitação de contrato avulsa (serviço digitado na hora,
  // não veio do executivo importado) — entra na verba já como "solicitação".
  function criarSolicitacaoContrato(verbaNum, novoItem) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = o.categorias.map((c) => {
        if (c.num !== verbaNum) return c;
        const codigo = `${verbaNum}.av${((c.itens || []).length + 1)}`;
        return { ...c, itens: [...(c.itens || []), { ...novoItem, codigo }] };
      });
      return { ...o, categorias };
    }));
  }

  /* A data de entrega da obra, e os prazos de compra que saem dela.

     Um numero so muda a tela inteira: cada grupo passa a saber ate quando
     o material dele TEM que estar comprado, contando pra tras. */
  function definirDataEntrega(data) {
    setObras((prev) => prev.map((o) => (o.id === selectedId ? { ...o, dataEntrega: data || null } : o)));
  }

  /* Corrigir a alocacao de um item vale pra EMPRESA INTEIRA.

     "Anotacao de responsabilidade tecnica - RRT" e mao de obra em toda
     obra que a casa faz. Corrigir isso obra a obra e refazer a mesma
     decisao pra sempre, e basta esquecer uma vez pra o valor cair na
     coluna errada e o contrato nascer menor do que deveria.

     Grava nos dois lugares de proposito: no item, pra tela reagir no
     clique e a correcao sobreviver mesmo se o banco recusar; e na tabela
     da empresa, pra toda obra com a mesma descricao ja nascer certa. */
  function definirAlocacao(catIdx, itemIdx, item, valor) {
    updateItem(catIdx, itemIdx, { alocacaoManual: valor });
    salvarAlocacaoPadrao(item.desc, valor, usuario)
      .catch((e) => setErroBanco(
        `Alocação aplicada nesta obra, mas não virou padrão da empresa: ${e.message || e}. ` +
        `Talvez falte rodar supabase/alocacao.sql.`
      ));
  }

  /* Separa a mao de obra de UM item, na mao.

     O de R$ 268 (223 de material + 45 de MO) vira dois: ele mesmo, so com
     os 223, e uma linha de 45 LOGO ABAIXO, na mesma verba. O dinheiro nao
     muda de tamanho nem de grupo — a mao de obra da iluminacao continua
     sendo da iluminacao. */
  function separarMaoDeObra(catNum, codigo) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const cat = o.categorias.find((c) => c.num === catNum);
      const item = (cat?.itens || []).find((it) => it.codigo === codigo);
      if (!item) return o;
      const usados = new Set(cat.itens.map((it) => it.codigo));
      const par = partirMaoDeObra(item, cat, codigoMOlivre(usados, catNum));
      if (!par) return o;
      return { ...o, categorias: o.categorias.map((c) => {
        if (c.num !== catNum) return c;
        const itens = [];
        c.itens.forEach((it) => {
          if (it.codigo !== codigo) { itens.push(it); return; }
          itens.push(par.original, par.linhaMO);
        });
        return { ...c, itens };
      }) };
    }));
  }

  // Separa a MO de um grupo inteiro. Serve pras obras que ja estavam
  // salvas antes desta regra existir — na importacao isso ja vem pronto.
  function separarMOdoGrupo(catNum) {
    setObras((prev) => prev.map((o) => (o.id === selectedId
      ? { ...o, categorias: separarMOnasVerbasDeContrato(o.categorias, catNum).categorias }
      : o)));
  }

  /* Desfaz a separacao: a mao de obra volta pro item e a linha some.

     Toda separacao precisa de volta. Sem isso um clique sem querer deixa
     duas linhas onde havia uma, e desfazer viraria trabalho de banco. */
  function juntarMaoDeObra(catNum, codigo) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const item = (o.categorias.find((c) => c.num === catNum)?.itens || []).find((it) => it.codigo === codigo);
      const sep = item?.moSeparada;
      if (!sep) return o;
      // A linha separada mora na MESMA verba, entao juntar e um passe so:
      // tira a marca do original e apaga a linha filha ali mesmo.
      return { ...o, categorias: o.categorias.map((c) => {
        if (c.num !== catNum) return c;
        return { ...c, itens: c.itens
          .filter((it) => it.codigo !== sep.codigo)
          .map((it) => {
            if (it.codigo !== codigo) return it;
            const { moSeparada, ...resto } = it;
            return resto;
          }) };
      }) };
    }));
  }

  /* O escopo e um retrato, nao um link.

     O texto do modelo ja veio copiado pra dentro dele: o que a empresa
     contrata hoje nao pode mudar porque alguem editou o modelo amanha. */
  function criarEscopo(dados) {
    const id = `esc${Date.now().toString(36)}`;
    setObras((prev) => prev.map((o) => (o.id === selectedId ? {
      ...o,
      escopos: [...(o.escopos || []), { ...dados, id, criadoEm: new Date().toISOString(), criadoPor: usuario, valorContrato: null }],
    } : o)));
    return id;
  }

  function mudarEscopo(id, patch) {
    setObras((prev) => prev.map((o) => (o.id === selectedId ? {
      ...o, escopos: (o.escopos || []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
    } : o)));
  }

  function apagarEscopo(id) {
    setObras((prev) => prev.map((o) => (o.id === selectedId ? {
      ...o, escopos: (o.escopos || []).filter((e) => e.id !== id),
    } : o)));
  }

  /* Registra uma compra avulsa dentro da verba escolhida.

     Segue o mesmo caminho de `criarSolicitacaoContrato` — item novo em
     `cat.itens` — e de propósito NÃO toca em `itensPlanilhaExecutivo`:
     avulso não faz parte do executivo que o cliente assinou, e escrever
     lá seria reescrever um documento aprovado.

     Como nasce com `custo: null`, ele não move total nenhum. O CMV, o
     valor da verba e as somas de MAT e MO continuam sendo o que veio da
     planilha — ele é um pedido, e aparece como pedido até a compra
     acontecer e alguém lançar o valor pago. */
  function criarCompraAvulsa(verbaNum, novoItem) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const categorias = o.categorias.map((c) => {
        if (c.num !== verbaNum) return c;
        // O código é a chave da linha na tela. `criarSolicitacaoContrato`
        // também usa o sufixo ".av", então contar itens não basta: dois
        // caminhos diferentes chegariam no mesmo código e uma das linhas
        // sumiria do React. Procura o primeiro livre.
        const usados = new Set((c.itens || []).map((it) => it.codigo));
        let n = 1;
        while (usados.has(`${verbaNum}.av${n}`)) n += 1;
        return { ...c, itens: [...(c.itens || []), {
          ...novoItem,
          codigo: `${verbaNum}.av${n}`,
          avulsoPor: usuario,
          avulsoEm: new Date().toISOString(),
        }] };
      });
      return { ...o, categorias };
    }));
  }

  /* Registra a aprovação do cliente.

     O documento já subiu pro Storage antes de chegar aqui: `arq` é o que
     ficou guardado dele (nome + caminho), não o File do navegador. */
  function registrarAssinaturaCliente({ data, obs, arq }) {
    setObras((prev) => prev.map((o) => (o.id === selectedId ? {
      ...o,
      clienteAssinouEm: data,
      clienteAssinaturaPor: usuario,
      clienteAssinaturaObs: obs || null,
      clienteAssinaturaArq: arq || null,
    } : o)));
  }

  function removerAssinaturaCliente() {
    const arq = obras.find((o) => o.id === selectedId)?.clienteAssinaturaArq;
    setObras((prev) => prev.map((o) => (o.id === selectedId ? {
      ...o, clienteAssinouEm: null, clienteAssinaturaPor: null,
      clienteAssinaturaObs: null, clienteAssinaturaArq: null,
    } : o)));
    // Removido o registro, o documento dele não tem mais a que servir.
    if (arq?.caminho) apagarArquivo(arq.caminho);
  }

  /* Conclui uma etapa da esteira, gravando quem e quando.

     Só vale para as etapas sem ato próprio: Depara, Aprovação do Cliente e
     Plano de Compras já têm o seu (liberar CMV, registrar assinatura,
     liberar compras) e são lidas dali. */
  function concluirEtapa(id) {
    setObras((prev) => prev.map((o) => (o.id === selectedId ? {
      ...o,
      etapasConcluidas: { ...(o.etapasConcluidas || {}), [id]: { por: usuario, em: new Date().toISOString() } },
    } : o)));
  }

  function reabrirEtapa(id) {
    setObras((prev) => prev.map((o) => {
      if (o.id !== selectedId) return o;
      const resto = { ...(o.etapasConcluidas || {}) };
      delete resto[id];
      return { ...o, etapasConcluidas: resto };
    }));
  }

  function handleTabChange(t) { setTab(t); setItemFilter("todos"); setTipoFilter("todos"); }

  /* Trocar de grupo leva pra primeira etapa DELE, nao pra lugar nenhum.
     Clicar em "Planejamento" e ficar olhando pra tela vazia obrigaria um
     segundo clique sempre. O Dashboard e a excecao: ele proprio e a tela. */
  function handleGrupoChange(g) {
    setGrupo(g);
    // Grupo sem etapa e' a propria tela — Dashboard e Arquivos da Obra.
    if (!ETAPAS_POR_GRUPO[g]) { setTab(null); return; }
    const lista = ETAPAS_POR_GRUPO[g] || [];
    // volta pra ultima etapa cumprida (ou a primeira), que e onde a obra esta
    const pendente = lista.find((e) => !etapaConcluida(e.id, obra));
    handleTabChange((pendente || lista[0] || {}).id || null);
  }

  /* Sem perfil, a tela para aqui. Antes de qualquer barra lateral,
     antes de qualquer numero — a sala de espera nao mostra NADA da
     empresa. Ver docs/SPEC-acessos.md §3. */
  if (!pessoasCarregando && !migracaoPendente && usuario && !temAcesso(eu)) {
    return <SalaDeEspera usuario={usuario} pessoa={eu}
      onSair={sairDaConta} onRecarregar={() => window.location.reload()} />;
  }

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@1,500;1,600&family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --page: #FAFAF8; --panel: #F3F2EE; --card: #FFFFFF;
          --border: #E8E5DD; --border-soft: #F0EEE7;
          --ink: #191D21; --ink-2: #565B60;
          /* #9A9C9C dava 2,76:1 sobre branco — reprova em AA, que pede
             4,5:1 pra texto miudo, e ele e' justamente a cor do que se le
             o dia inteiro (codigo da obra, data, subtitulo). #737373 da
             4,7:1 e continua sendo terciario. */
          --ink-3: #737373;
          --blue: #2E6FA3; --blue-bg: #E3EEF7;
          --green: #2E8F58; --green-bg: #E4F3E9;
          --amber: #B87A1E; --amber-bg: #FAEFDC;
          --red: #C2453F; --red-bg: #FBE5E3;
          --purple: #6E56B8;
        }
        * { box-sizing: border-box; }
        .app { min-height: 100vh; background: var(--page); color: var(--ink); font-family: 'Inter', sans-serif; font-size: 13.5px; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .dim { color: var(--ink-3); }
        .center { text-align: center; }
        .right { text-align: right; }

        .topbar { height: 64px; display: flex; align-items: center; gap: 24px; padding: 0 24px; background: #fff; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10; }
        .topbar-brand { display: flex; align-items: center; gap: 11px; flex-shrink: 0; background: none; border: none; font-family: inherit; padding: 4px 6px; margin-left: -6px; border-radius: 9px; cursor: pointer; }
        .topbar-brand:hover { background: var(--panel); }
        /* mostra só o monograma (recorta o texto "GROUP WS" e as margens
           do PNG oficial, sem alterar o arquivo — nada é distorcido) */
        .brand-logo { width: 46px; height: 38px; object-fit: cover; object-position: top center; display: block; }
        .brand-word { font-weight: 700; font-size: 13px; letter-spacing: 0.06em; color: var(--ink); white-space: nowrap; }
        .aviso-monday { background: var(--amber-bg, #FEF3E2); color: var(--amber, #B7791F); border: 1px solid var(--amber, #E8B04B); border-radius: 8px; padding: 9px 13px; font-size: 12px; font-weight: 500; margin-bottom: 16px; }
        /* O margin-left auto porque quem empurrava esse bloco pra
           direita era a busca do meio, que tinha flex 1. Tirando a busca,
           ele foi junto encostar na marca. */
        .topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto; }
        .icon-btn { width: 34px; height: 34px; border-radius: 8px; border: none; background: transparent; display: flex; align-items: center; justify-content: center; color: var(--ink-2); cursor: pointer; position: relative; }
        .icon-btn:hover { background: var(--panel); }
        .notif-dot { position: absolute; top: 3px; right: 3px; background: var(--red); color: #fff; font-size: 9px; font-weight: 700; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--purple); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; }

        .body-layout { display: flex; }
        /* Sem space-between: ele funcionava com dois filhos (lista e
           rodapé), mas o botão de recolher virou um terceiro — e aí o
           espaçamento automático empurrava a lista pro meio da tela,
           deixando um vazio enorme embaixo do botão.
           Agora quem ocupa a sobra é a lista, explicitamente. */
        .sidebar { width: 288px; flex-shrink: 0; background: #fff; border-right: 1px solid var(--border); height: calc(100vh - 64px); position: sticky; top: 64px; display: flex; flex-direction: column; }
        .sidebar-scroll { flex: 1; padding: 6px 14px 16px; overflow-y: auto; display: flex; flex-direction: column; min-height: 0; }
        .nav-group-label { font-size: 10.5px; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 8px; margin: 14px 0 8px; }
        .nav-group-label:first-child { margin-top: 0; }
        .obra-search { display: flex; align-items: center; gap: 7px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 7px 9px; margin-bottom: 8px; }
        .obra-search input { flex: 1; border: none; outline: none; background: transparent; font-size: 12px; color: var(--ink); }
        .obra-search input::placeholder { color: var(--ink-3); }
        .clear-btn { border: none; background: transparent; color: var(--ink-3); cursor: pointer; display: flex; }
        .alert-toggle { display: flex; align-items: center; gap: 6px; width: 100%; background: transparent; border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; font-size: 11px; color: var(--ink-2); cursor: pointer; margin-bottom: 10px; }
        .alert-toggle.active { background: var(--red-bg); border-color: var(--red); color: var(--red); font-weight: 600; }
        /* Nos 62px o codigo E' o icone. */
        .nav-cod { display: none; font-size: 11px; font-weight: 700; color: var(--ink-2); letter-spacing: -.02em; }
        .sidebar.recolhida .nav-cod { display: block; }
        .sidebar.recolhida .nav-item > .nav-icon { display: none; }
        .sidebar.recolhida .nav-item.active .nav-cod { color: var(--blue); }
        .chip-sep { width: 1px; align-self: stretch; background: var(--border); margin: 2px 3px; }
        .squad-chip.neutro { background: none; border-color: var(--border); color: var(--ink-3); }
        .squad-chip.neutro.on { color: var(--ink); border-color: var(--ink-3); font-weight: 600; }
        .squad-chip.active.alerta { background: var(--red); border-color: var(--red); }
        .alert-toggle.escondido { display: none; }
        .squad-filter { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
        .squad-chip { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 4px 10px; font-size: 10.5px; font-weight: 500; color: var(--ink-2); cursor: pointer; }
        .squad-chip:hover { border-color: var(--blue); }
        .squad-chip.active { background: var(--ink); border-color: var(--ink); color: #fff; font-weight: 600; }
        .squad-group { margin-bottom: 10px; }
        .squad-group-label { display: flex; align-items: center; gap: 5px; width: 100%; background: none; border: none; font-family: inherit; cursor: pointer; }
        .squad-group-label:hover { color: var(--ink-2); }
        /* ---- Rotulo no hover, na barra recolhida ----

           Primeiro tentei ::after com content: attr(title). Nao funciona:
           ele nasce DENTRO da lista de obras, que rola, e tudo que passa
           da borda da caixa e' recortado — o rotulo existia e ficava
           invisivel do lado de fora.

           Este e' um elemento so', em position: fixed, posicionado pelo
           retangulo do botao sob o mouse. Fixed nao e' recortado por
           ancestral nenhum, que e' exatamente o problema a resolver. */
        .dica-lateral { position: fixed; z-index: 200; background: var(--ink); color: #fff; border-radius: 7px; padding: 7px 11px; font-size: 11.5px; font-weight: 600; white-space: nowrap; pointer-events: none; box-shadow: 0 6px 20px rgba(0,0,0,.22); }
        .dica-lateral::before { content: ""; position: absolute; left: -4px; top: 50%; margin-top: -4px; width: 8px; height: 8px; background: var(--ink); transform: rotate(45deg); }

        /* O simbolo do squad so' existe recolhida: aberta, o nome basta. */
        .squad-simbolo { display: none; }
        .sidebar.recolhida .squad-group-label { display: flex; justify-content: center; padding: 6px 0 4px; color: var(--ink-3); }
        /* So' o simbolo. O nome quebrava em tres linhas dentro dos 62px e
           encavalava com as obras logo abaixo. */
        .sidebar.recolhida .squad-group-label > .lucide,
        .sidebar.recolhida .squad-group-label > span:not(.squad-simbolo) { display: none; }
        .sidebar.recolhida .squad-simbolo { display: block; }
        .squad-tem-aberta { width: 5px; height: 5px; border-radius: 50%; background: var(--blue); flex-shrink: 0; }

        .squad-group-label span { text-align: left; }

        .squad-group-label { font-size: 9.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 8px; }
        /* A lista come o espaco que sobra pra empurrar os modulos pro pe
           da barra; sem isso eles paravam onde a lista acabasse. */
        .scroll-list { flex: 1; min-height: 90px; overflow-y: auto; padding-right: 2px; }
        /* Grudado embaixo mesmo com a barra rolando: com quarenta obras a
           lista rola, e o modulo tem que continuar a um clique. */
        .nav-modulos { margin-top: auto; position: sticky; bottom: 0; background: #fff; padding-bottom: 2px; }
        .nav-modulos::before { content: ""; display: block; height: 10px; margin: 0 -14px; background: linear-gradient(to bottom, rgba(255,255,255,0), #fff); }
        .no-results { font-size: 11.5px; color: var(--ink-3); padding: 10px 6px; }
        .nav-group-toggle { display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none; font-family: inherit; font-size: 10.5px; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 8px; margin: 14px 0 8px; cursor: pointer; }
        .nav-group-toggle:hover { color: var(--ink-2); }
        .nav-group-toggle span:first-child { flex: 1; text-align: left; }
        .nav-tira { display: flex; align-items: center; gap: 4px; padding: 0 4px; }
        .nav-tira-item { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; height: 34px; border: 1px solid transparent; border-radius: 8px; background: none; color: var(--ink-3); cursor: pointer; }
        .nav-tira-item:hover { background: var(--panel); color: var(--ink); }
        .nav-tira-item.active { background: var(--blue-bg); border-color: var(--blue); color: var(--blue); }
        .nav-tira-badge { position: absolute; top: 1px; right: 1px; background: var(--blue); color: #fff; font-size: 8.5px; font-weight: 700; border-radius: 20px; padding: 0 4px; line-height: 13px; }
        .sidebar.recolhida .nav-tira { flex-direction: column; }
        .nav-list { display: flex; flex-direction: column; gap: 2px; }
        .nav-list-topo { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-soft); }
        .nav-item { display: flex; align-items: center; gap: 10px; width: 100%; background: transparent; border: none; border-radius: 8px; padding: 9px 8px; cursor: pointer; text-align: left; transition: background 0.12s ease; }
        .nav-item:hover { background: var(--panel); }
        .nav-item.active { background: var(--blue-bg); }
        .nav-item.static { cursor: default; }
        .nav-item.disabled { opacity: 0.55; cursor: default; }
        .nav-item.disabled:hover { background: transparent; }
        .nav-icon { color: var(--ink-2); flex-shrink: 0; }
        .nav-item.active .nav-icon { color: var(--blue); }
        .nav-item-text { flex: 1; min-width: 0; }
        .nav-item-name { font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nav-item-sub { font-size: 10.5px; color: var(--ink-3); margin-top: 1px; }
        .nav-badge { background: var(--red); color: #fff; font-size: 10px; font-weight: 700; border-radius: 20px; padding: 1px 6px; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
        .soon { font-size: 9.5px; color: var(--ink-3); background: var(--panel); padding: 2px 6px; border-radius: 20px; flex-shrink: 0; }
        .sidebar-footer { border-top: 1px solid var(--border); padding: 12px 14px; flex-shrink: 0; }
        .profile { display: flex; align-items: center; gap: 9px; padding: 7px 6px; border-radius: 8px; cursor: pointer; }
        .profile { width: 100%; background: none; border: none; font-family: inherit; text-align: left; }
        .profile.aberto { background: var(--panel); }
        .profile-name { color: var(--ink); }
        /* O menu era um e-mail quebrando em duas linhas e um "Sair desta
           conta" vermelho gritando. Agora ele se parece com o cartao de
           conta de qualquer ferramenta: quem esta logado em cima, uma
           linha, e a saida discreta embaixo. Vermelho so' no hover — sair
           nao e' perigoso, e' so' sair. */
        .perfil-menu { border: 1px solid var(--border); border-radius: 12px; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,.12); padding: 6px; margin-bottom: 8px; }
        .perfil-cab { display: flex; align-items: center; gap: 10px; padding: 9px 9px 10px; }
        .perfil-cab-txt { min-width: 0; }
        .perfil-cab-nome { font-size: 12.5px; font-weight: 700; color: var(--ink); }
        .perfil-cab-email { font-size: 10.5px; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
        .perfil-sep { height: 1px; background: var(--border-soft); margin: 0 4px 5px; }
        .perfil-sair { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: none; border-radius: 8px; padding: 8px 9px; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
        .perfil-sair:hover { background: var(--red-bg); color: var(--red); }

        .profile:hover { background: var(--panel); }
        .avatar-sm { width: 28px; height: 28px; font-size: 10.5px; }
        .profile-text { flex: 1; min-width: 0; }
        .profile-name { font-size: 12px; font-weight: 600; }
        .profile-email { font-size: 10.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* Discreto: é um controle da barra, não um título. Antes vinha em
           caixa alta ocupando a largura toda, e competia com o nome da
           obra logo abaixo. */
        .sidebar-toggle { display: flex; align-items: center; justify-content: flex-start; gap: 5px; width: auto; margin: 10px 8px 2px; font-size: 11.5px; font-weight: 500; color: var(--ink-3); background: transparent; border: none; border-radius: 6px; padding: 5px 8px; cursor: pointer; flex-shrink: 0; }
        .sidebar-toggle:hover { color: var(--ink-1); background: var(--panel); }
        .sidebar.recolhida .sidebar-toggle { justify-content: center; margin: 10px auto 2px; }

        /* RECOLHIDA — só os símbolos.
           Some tudo que é texto e filtro; ficam os ícones, que já existiam
           em cada item. O atributo title de cada botão vira o rótulo no
           hover, e é
           por isso que ele foi adicionado em todos: sem ele, quatro ícones
           iguais não dizem nada. */
        /* RECOLHIDA.

           Ela virava uma coluna de icones sem hierarquia: obra e modulo
           com o mesmo peso, a tira de modulos deitada de lado, e o
           perfil com um chevron apontando pro nada. Agora as obras ficam
           numa coluna alinhada, os modulos numa faixa separada por uma
           linha, e o perfil e' so' o avatar — que continua abrindo o
           menu de sair. O atributo title de cada botao e' o rotulo no
           hover. */
        .sidebar.recolhida { width: 62px; }
        .sidebar.recolhida .sidebar-scroll { padding: 12px 6px; align-items: center; gap: 2px; }
        .sidebar.recolhida .squad-group { margin-bottom: 4px; }
        .sidebar.recolhida .nav-modulos { border-top: 1px solid var(--border); padding-top: 8px; margin-top: auto; width: 100%; }
        .sidebar.recolhida .nav-modulos::before { display: none; }
        .sidebar.recolhida .nav-tira { flex-direction: column; gap: 2px; }
        .sidebar.recolhida .nav-tira-item { width: 44px; flex: none; }
        .sidebar.recolhida .sidebar-toggle { justify-content: center; }
        /* O menu de sair nao cabe em 62px: ele salta pra fora da barra. */
        .sidebar.recolhida .perfil-menu { position: absolute; bottom: 58px; left: 8px; width: 210px; z-index: 30; }
        .sidebar.recolhida .sidebar-footer { position: relative; }
        .sidebar.recolhida .nav-group-toggle,
        .sidebar.recolhida .nav-group-label,
        .sidebar.recolhida .obra-search,
        .sidebar.recolhida .squad-filter,
        .sidebar.recolhida .alert-toggle,
        .sidebar.recolhida .nav-item-text,
        .sidebar.recolhida .nav-item-chevron,
        .sidebar.recolhida .no-results,
        .sidebar.recolhida .profile-text,
        .sidebar.recolhida .profile > .lucide-chevron-right { display: none; }
        .sidebar.recolhida .nav-item { justify-content: center; padding: 10px 0; width: 44px; }
        .sidebar.recolhida .nav-list { align-items: center; }
        .sidebar.recolhida .squad-group { width: 100%; }
        .sidebar.recolhida .sidebar-footer { padding: 10px 8px; }
        .sidebar.recolhida .profile { justify-content: center; gap: 0; padding: 7px 0; }
        .sidebar.recolhida .profile > .lucide-chevron-down { display: none; }
        /* badge vira ponto: o número não cabe, mas "tem alerta" precisa aparecer */
        .sidebar.recolhida .nav-badge, .sidebar.recolhida .nav-count { position: absolute; top: 4px; right: 2px; min-width: 7px; height: 7px; padding: 0; font-size: 0; border-radius: 50%; }
        .sidebar.recolhida .nav-item { position: relative; }

        .main { flex: 1; padding: 32px 40px 60px; max-width: 1260px; }
        /* Nas telas de planilha a largura é o próprio conteúdo: são 13
           colunas, e limitar em 1260px obrigava a rolar de lado pra ver
           o custo total — justamente a coluna que mais importa. */
        .main.larga { max-width: none; }
        .eyebrow { font-size: 11px; font-weight: 600; color: var(--blue); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
        .obra-fictitious { margin-left: 8px; font-size: 10px; background: var(--panel); color: var(--ink-3); padding: 2px 8px; border-radius: 20px; text-transform: none; letter-spacing: 0; font-weight: 500; }
        .title-row { font-size: 30px; line-height: 1.15; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .title-plain { font-weight: 700; color: var(--ink); }

        /* --- Ciclo de vida da obra: novas / concluir / arquivo --- */
        .nav-badge-novo { background: var(--blue); }
        .nav-count { background: var(--panel); color: var(--ink-3); font-size: 10px; font-weight: 600; border-radius: 20px; padding: 1px 6px; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
        .link-inline { background: none; border: none; padding: 0; font: inherit; color: var(--blue); cursor: pointer; text-decoration: underline; }

        .secao-intro { font-size: 12.5px; color: var(--ink-2); line-height: 1.55; background: var(--panel); border-radius: 10px; padding: 12px 15px; margin-bottom: 18px; max-width: 720px; }
        .secao-intro p { margin: 0; }
        .aviso-banco { background: var(--amber-bg, #FEF3E2); color: var(--amber, #B7791F); border: 1px solid var(--amber, #E8B04B); border-radius: 8px; padding: 9px 13px; font-size: 12px; font-weight: 500; margin-bottom: 16px; }
        .obra-search-wide { max-width: 380px; margin-bottom: 18px; }

        .obra-card-grupo { margin-bottom: 22px; }
        .obra-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #fff; border: 1px solid var(--border-soft); border-radius: 12px; padding: 13px 16px; margin-bottom: 8px; max-width: 720px; }
        .obra-card-info { min-width: 0; }
        .obra-card-nome { font-size: 13.5px; font-weight: 600; color: var(--ink); }
        .obra-card-sub { font-size: 11px; color: var(--ink-3); margin-top: 2px; }

        .btn-start, .btn-reabrir, .btn-concluir { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; font-size: 12px; font-weight: 600; padding: 7px 13px; cursor: pointer; white-space: nowrap; flex-shrink: 0; font-family: inherit; }
        .btn-start { background: var(--blue); color: #fff; border: 1px solid var(--blue); }
        .btn-start:hover:not(:disabled) { filter: brightness(1.08); }
        .btn-reabrir { background: #fff; color: var(--ink-2); border: 1px solid var(--border); }
        .btn-reabrir:hover:not(:disabled) { background: var(--panel); }
        .btn-concluir { background: #fff; color: var(--ink-2); border: 1px solid var(--border); font-size: 11.5px; padding: 6px 11px; }
        .btn-concluir:hover:not(:disabled) { background: var(--panel); color: var(--ink); }
        .btn-start:disabled, .btn-reabrir:disabled, .btn-concluir:disabled { opacity: 0.55; cursor: default; }

        .vazio-box { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; background: var(--panel); border-radius: 12px; padding: 40px 20px; max-width: 720px; }
        .vazio-titulo { font-size: 14px; font-weight: 600; color: var(--ink); margin-top: 4px; }
        .vazio-sub { font-size: 12px; color: var(--ink-3); }
        .title-accent { font-family: 'Newsreader', serif; font-style: italic; font-weight: 500; color: var(--ink); }
        .obra-meta { font-size: 13px; color: var(--ink-2); margin-bottom: 26px; }
        .sg-sub { font-size: 13px; font-weight: 600; letter-spacing: .02em; color: var(--ink-2); margin: -2px 0 14px; }
        /* Uma regua so' pra tudo. Larga: o texto se espalha em colunas
           em vez de empilhar, entao a largura vira leitura mais curta, e
           nao linha mais comprida. */
        .sg-col { max-width: 1180px; }
        /* --ink-3 e' o cinza mais claro que ainda passa no contraste
           (4.74:1 sobre o fundo). Mais claro que isto vira texto que a
           pessoa nao le -- foi o defeito que ja corrigimos no rotulo da
           barra lateral. */
        .sg-escopo { max-width: 1180px; font-size: 12.5px; line-height: 1.6; color: var(--ink-3); margin-bottom: 16px; }
        .sg-escopo p { margin: 0 0 10px; }
        .sg-escopo b { font-weight: 600; color: var(--ink-2); }
        .sg-passos { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 8px 26px; padding: 10px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .sg-escopo-nota { margin: 10px 0 0 !important; font-size: 11.5px; }
        /* Rodape do cartao de subir: mesma borda, mesmo recuo, sem vao. */
        .sg-formatos { margin-bottom: 12px; border: 1px solid var(--border); border-top: none; border-radius: 0 0 12px 12px; background: var(--card); padding: 2px 16px 14px; font-size: 12px; line-height: 1.55; color: var(--ink-3); }
        .sg-formatos dl { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px 26px; }
        .sg-formatos dt { font-weight: 600; color: var(--ink-2); margin-bottom: 1px; }
        .sg-formatos dd { margin: 0; }
        .sg-formatos-nota { margin: 11px 0 0; padding-top: 9px; border-top: 1px solid var(--border); font-size: 11.5px; }

        /* DASHBOARD DA OBRA
           Tres perguntas na ordem em que se faz: o executivo cabe no
           vendido, quanto ja foi comprado e ate quando da, e o que pede
           atencao. A ultima faixa fica curta e verde quando nao ha nada —
           painel que mostra sempre as mesmas caixas ensina a ignorar. */
        /* ESCOPO DE CONTRATACAO */
        .btn-abrir-escopo { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; background: #fff; color: var(--ink); border: none; border-radius: 8px; padding: 8px 14px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .btn-abrir-escopo:hover { background: var(--green-bg); color: var(--green); }
        .mo-escopo-barra .btn-limpar-sel { margin-left: 0; }
        .form-escopo { max-width: 560px; }
        .form-dica { font-size: 10.5px; color: var(--green); margin-top: 5px; }
        .btn-lupa { flex-shrink: 0; background: transparent; border: 1px solid var(--border); border-radius: 7px; padding: 5px 7px; color: var(--ink-3); cursor: pointer; display: inline-flex; }
        .btn-lupa:hover { border-color: var(--ink); color: var(--ink); background: #fff; }
        .btn-lupa-vazio { flex-shrink: 0; width: 30px; }
        .mo-linha.com-escopo { box-shadow: inset 2px 0 0 var(--green); }

        .escopo-topo { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .btn-voltar { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: 1px solid var(--border); border-radius: 8px; padding: 6px 11px; font-size: 12px; cursor: pointer; font-family: inherit; color: var(--ink-2); flex-shrink: 0; }
        .btn-voltar:hover { border-color: var(--ink); color: var(--ink); }
        .escopo-titulo { flex: 1; min-width: 0; }
        .escopo-nome { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; }
        .escopo-banda { font-size: 11.5px; color: var(--ink-3); margin-top: 1px; }
        .btn-doc { display: inline-flex; align-items: center; gap: 5px; background: var(--ink); color: #fff; border: none; border-radius: 8px; padding: 7px 12px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .btn-doc:hover { background: var(--blue); }
        .btn-apagar-escopo { background: transparent; border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; cursor: pointer; color: var(--ink-3); display: inline-flex; }
        .btn-apagar-escopo:hover { border-color: var(--red); color: var(--red); }

        .escopo-conta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
        .ec-bloco { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
        .ec-rot { font-size: 9.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; }
        .ec-val { font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 5px; }
        .ec-sub { font-size: 10.5px; color: var(--ink-3); margin-top: 3px; }
        .ec-input { width: 100%; margin-top: 5px; border: 1px solid var(--border); border-radius: 7px; padding: 4px 9px; font-size: 19px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
        .ec-input:focus { border-color: var(--ink); outline: none; }
        .ec-dif.ok { background: var(--green-bg); border-color: #C9E5D4; color: var(--green); }
        .ec-dif.ruim { background: var(--red-bg); border-color: #F0C9C6; color: var(--red); }
        .ec-dif.ok .ec-rot, .ec-dif.ruim .ec-rot, .ec-dif.ok .ec-sub, .ec-dif.ruim .ec-sub { color: inherit; opacity: 0.8; }
        .escopo-campos { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; margin-bottom: 18px; }

        /* A FOLHA. Largura de A4 e fundo branco de proposito: a pessoa
           enxerga o documento que vai virar contrato, nao um formulario. */
        .doc-escopo { background: #fff; border: 1px solid var(--border); border-radius: 4px; max-width: 210mm; margin: 0 auto; padding: 26mm 22mm; font-size: 12px; line-height: 1.6; color: #16181A; box-shadow: 0 2px 14px rgba(0,0,0,0.06); }
        .doc-banda { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 700; line-height: 1.3; margin-bottom: 18px; }
        .doc-cab { display: grid; gap: 3px; font-size: 12px; padding-bottom: 14px; border-bottom: 1px solid #DDD; margin-bottom: 6px; }
        .doc-rot { font-weight: 700; display: inline-block; min-width: 82px; color: #55595E; }
        .doc-h { font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; font-weight: 700; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #DDD; }
        .doc-item { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #F0F0EE; }
        .doc-qtd { flex-shrink: 0; width: 52px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: #6A6E72; padding-top: 2px; }
        .doc-desc { flex: 1; }
        .doc-desc:focus, .doc-cond:focus { outline: 2px solid var(--blue); outline-offset: 3px; border-radius: 3px; }
        .doc-amb { flex-shrink: 0; font-size: 10.5px; color: #85898D; }
        .doc-grupo { font-weight: 700; margin: 16px 0 4px; font-size: 12px; }
        .doc-nota { font-style: italic; color: #6A6E72; margin: 6px 0; }
        .doc-tab { width: 100%; border-collapse: collapse; margin-top: 4px; }
        .doc-tab th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #55595E; padding: 6px 8px; border-bottom: 1px solid #CCC; }
        .doc-tab td { padding: 8px; border-bottom: 1px solid #F0F0EE; vertical-align: top; font-size: 11.5px; }
        .doc-tab .center { text-align: center; } .doc-tab .right { text-align: right; }
        .doc-cond { line-height: 1.5; }
        .parc-controles { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; }
        .parc-linha { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
        .parc-linha .form-label { flex: 1; min-width: 110px; }
        .doc-total td { border-top: 1px solid #CCC; border-bottom: none; font-weight: 700; }
        .doc-ul { margin: 4px 0 0; padding-left: 20px; }
        .doc-ul li { margin-bottom: 5px; }
        .doc-rodape { margin-top: 26px; padding-top: 12px; border-top: 1px solid #DDD; font-size: 10px; color: #85898D; line-height: 1.5; }

        /* PDF sai daqui: o navegador imprime so a folha. */
        /* ---- ADITIVOS ---- */
        .row-aditivo { background: #FBF9FF; }
        .tag-aditivo { display: inline-flex; align-items: center; gap: 4px; background: #EFEAFB; color: var(--purple); border-radius: 4px; padding: 1px 7px; font-size: 9.5px; font-weight: 700; margin-top: 3px; }
        /* Coluna propria, e estreita: com o rotulo longo ela encostava na
           tabela de itens logo abaixo e passava a ser lida como cabecalho
           dela — "Destino" cai bem embaixo. */
        .grp-tot-wip { width: 62px; border-left: 1px dashed var(--border); padding-left: 12px; }
        .grp-tot-wip .grp-tot-rot { color: var(--ink-3); }
        .plano-wip { display: flex; align-items: center; gap: 8px; background: var(--panel); border-radius: 8px; padding: 8px 13px; font-size: 11.5px; color: var(--ink-3); margin-bottom: 12px; }
        .grp-aditivo { display: inline-flex; align-items: center; gap: 4px; background: #EFEAFB; color: var(--purple); border-radius: 20px; padding: 2px 9px; font-size: 10px; font-weight: 700; white-space: nowrap; }
        .item-aditivo { background: #FBF9FF; }
        .chip-aditivo { display: inline-flex; align-items: center; gap: 3px; background: #EFEAFB; color: var(--purple); border-radius: 4px; padding: 1px 6px; font-size: 9.5px; font-weight: 700; font-family: 'JetBrains Mono', monospace; margin-left: 6px; }
        .cmv-aditivos { margin-top: 16px; padding-top: 4px; border-top: 1px dashed var(--border); }
        .cmv-aditivos .cmv-grupos-titulo { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .cmv-adit-total { font-size: 14px; font-weight: 700; color: var(--ink); }
        .cmv-adit-total.credito { color: var(--green); }
        .cmv-adit-nota { font-size: 11px; color: var(--ink-3); margin: -2px 0 8px; line-height: 1.45; }
        .cmv-tag-adit { display: inline-block; margin-left: 7px; background: #EFEAFB; color: var(--purple); border-radius: 4px; padding: 1px 6px; font-size: 9.5px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
        .cmv-adit-parcelas { display: inline-flex; gap: 8px; font-size: 11px; }
        .adit-mais { color: var(--blue); }
        .adit-menos { color: #7d4038; }
        .cmv-linha-valor.credito { color: var(--green); }
        .dash-gc-nome { font-size: 17px; font-weight: 700; color: var(--ink); }
        .dash-gc-email { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
        .dash-gc-vazio { font-size: 12px; color: var(--ink-3); font-style: italic; }
        .dash-gc-acoes { display: flex; gap: 7px; margin-top: 9px; }
        .dash-aditivos .dash-adit-saldo { font-family: 'Space Grotesk', sans-serif; font-size: 27px; font-weight: 700; color: var(--ink); line-height: 1.15; }
        .dash-aditivos .dash-adit-saldo.credito { color: var(--green); }
        .dash-adit-sub { font-size: 11.5px; color: var(--ink-3); margin-top: 3px; }
        .dash-adit-lista { margin-top: 11px; border-top: 1px solid var(--border-soft); }
        .dash-adit-linha { display: flex; align-items: center; gap: 9px; padding: 6px 0; border-bottom: 1px solid var(--border-soft); font-size: 12px; }
        .dash-adit-linha .mono { font-size: 11.5px; font-weight: 700; }
        .dash-adit-desc { flex: 1; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dash-adit-linha .credito { color: var(--green); }
        .ad-topo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 16px 0 14px; }
        .ad-numero { font-size: 15px; font-weight: 700; color: var(--ink); }
        .ad-titulo { margin-top: 0; flex: 1; min-width: 200px; font-size: 13px; }
        .ad-status-sel { display: flex; gap: 4px; }
        .ad-tag { border: 1px solid var(--border); background: #fff; border-radius: 20px; padding: 4px 11px; font-size: 11px; font-weight: 700; font-family: inherit; color: var(--ink-3); cursor: pointer; }
        .ad-tag:hover { border-color: var(--ink-3); }
        .ad-tag.rascunho.on { background: var(--panel); border-color: var(--ink-3); color: var(--ink-2); }
        .ad-tag.aprovado.on { background: var(--green-bg); border-color: var(--green); color: var(--green); }
        .ad-tag.reprovado.on { background: var(--red-bg); border-color: var(--red); color: var(--red); }

        .ad-interno { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--ink-3); font-size: 10px; font-style: italic; }
        .pf-box { border: 1px solid #E8CE9A; background: var(--amber-bg); border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
        .pf-box.compacto { margin: 6px 0 0; padding: 7px 9px; border-radius: 8px; }
        .pf-topo { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #7A4E00; line-height: 1.45; }
        .pf-box.compacto .pf-topo { font-size: 11px; }
        .pf-dados { display: flex; align-items: flex-start; gap: 6px; margin: 9px 0; }
        .pf-dados pre { flex: 1; margin: 0; background: #fff; border-radius: 6px; padding: 8px 10px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; line-height: 1.5; white-space: pre-wrap; color: var(--ink-2); }
        .pf-acoes { display: flex; gap: 7px; margin-top: 9px; flex-wrap: wrap; }
        .pf-box.compacto .pf-acoes { margin-top: 6px; }
        .pf-box.compacto .btn-doc { padding: 4px 9px; font-size: 10.5px; }
        .pf-nota { font-size: 10.5px; color: #7A4E00; margin-top: 8px; line-height: 1.5; opacity: .85; }
        .pf-ok { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--green); font-weight: 600; margin-top: 6px; }
        .pf-ok.compacto { font-size: 10.5px; }
        .pf-desfazer { background: none; border: none; color: var(--ink-3); font-family: inherit; font-size: 10px; text-decoration: underline; cursor: pointer; }
        .ad-tag.aprovado.on.cobra { border-style: dashed; }
        .ad-busca { border: 1px solid var(--border); border-radius: 8px; margin-top: 5px; overflow: hidden; background: #fff; }
        .ad-busca-rot { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); padding: 5px 8px 3px; }
        .ad-busca-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; background: none; border: none; border-top: 1px solid var(--border-soft); padding: 5px 8px; font-family: inherit; font-size: 11.5px; color: var(--ink); cursor: pointer; }
        .ad-busca-item:hover { background: var(--blue-bg); }
        .ad-busca-item .mono { font-size: 10.5px; }
        .ad-busca-desc { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-busca-amb { font-size: 10px; color: var(--ink-3); white-space: nowrap; }
        .ad-busca-qtd { color: var(--ink-3); white-space: nowrap; }
        .ad-busca-val { color: var(--ink-2); font-weight: 700; white-space: nowrap; }
        .ad-obs { display: block; width: 100%; margin-top: 5px; border: 1px solid transparent; border-radius: 6px; padding: 3px 6px; font-family: inherit; font-size: 11.5px; color: var(--ink-2); background: var(--panel); resize: vertical; min-height: 24px; }
        .ad-obs:hover { border-color: var(--border); }
        .ad-obs:focus { outline: none; border-color: var(--blue); background: #fff; }
        .ad-obs::placeholder { color: var(--ink-3); font-style: italic; }
        .ad-status-lista .ad-tag { padding: 3px 8px; font-size: 10px; }
        .ad-status-lista { justify-content: center; }
        .ad-obras { display: flex; gap: 7px; flex-wrap: wrap; margin: 16px 0 18px; }
        .ad-obra { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--border); background: #fff; border-radius: 10px; padding: 8px 13px; font-size: 12.5px; font-family: inherit; color: var(--ink-2); cursor: pointer; }
        .ad-obra:hover { border-color: var(--ink-3); }
        .ad-obra.on { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); color: var(--ink); font-weight: 600; }
        .ad-obra-nome { max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-obra-n { background: var(--blue); color: #fff; border-radius: 20px; font-size: 10px; font-weight: 700; padding: 1px 7px; }
        .ad-cab-obra { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
        .ad-cab-nome { font-size: 16px; font-weight: 700; color: var(--ink); }
        .ad-cab-sub { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
        .fo-menu-dir { left: auto; right: 0; width: 360px; }
        .eo-lista { max-height: 320px; }
        .eo-squad { display: flex; align-items: center; gap: 5px; font-size: 9.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); padding: 9px 6px 4px; }
        .eo-item { gap: 8px; padding: 7px 6px; }
        .eo-num { margin-left: auto; flex-shrink: 0; font-size: 10.5px; color: var(--ink-3); }
        .eo-item:hover .eo-num { color: var(--ink-2); }
        .ad-linha-obra { font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-linha-desc { background: none; border: none; padding: 0; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--ink); text-align: left; cursor: pointer; }
        .ad-linha-desc:hover { color: var(--blue); text-decoration: underline; }
        .ad-linha-data { font-size: 10.5px; color: var(--ink-3); margin-top: 2px; }
        .ad-credito { color: var(--green); }

        .ad-wrap { display: grid; grid-template-columns: minmax(380px, 1fr) minmax(420px, 1fr); gap: 18px; align-items: start; }
        .ad-form { display: flex; flex-direction: column; gap: 14px; }
        .ad-card { border: 1px solid var(--border); border-radius: 12px; background: #fff; overflow: hidden; }
        .ad-card-h { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--panel); font-size: 12.5px; font-weight: 700; color: var(--ink); border-bottom: 1px solid var(--border); }
        .ad-card.sup .ad-card-h { background: #F7EFED; color: #7d4038; }
        .ad-card-tot { font-size: 13px; }
        .ad-card-b { padding: 12px 14px; }
        .ad-cab { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .ad-cab label, .ad-item-campos label { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); }
        .ad-largo { grid-column: 1 / -1; }
        .ad-cab .form-input, .ad-item-campos .form-input { margin-top: 3px; width: 100%; font-size: 12.5px; }

        .ad-grupo { border: 1px solid var(--border-soft); border-radius: 9px; margin-bottom: 10px; }
        .ad-gh { display: flex; align-items: center; gap: 6px; padding: 7px 9px; background: var(--panel); border-bottom: 1px solid var(--border-soft); border-radius: 9px 9px 0 0; }
        .ad-num { width: 34px; border: 1px solid var(--border); border-radius: 6px; padding: 4px 5px; font-size: 11.5px; font-family: 'JetBrains Mono', monospace; text-align: center; }
        .ad-gnome { flex: 1; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 12px; font-family: inherit; font-weight: 600; text-transform: uppercase; }
        .ad-sub { font-size: 11.5px; font-weight: 700; color: var(--ink-2); white-space: nowrap; }
        .ad-icon { background: none; border: none; color: var(--ink-3); cursor: pointer; padding: 3px; border-radius: 5px; display: inline-flex; font-family: inherit; font-size: 12px; }
        .ad-icon:hover { background: #fff; color: var(--ink); }
        .ad-icon.del:hover { color: var(--red); }
        .ad-itens { padding: 9px; }
        .ad-item { border-bottom: 1px dashed var(--border-soft); padding-bottom: 9px; margin-bottom: 9px; }
        .ad-item:last-of-type { border-bottom: none; margin-bottom: 4px; }
        .ad-item-topo { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .ad-item-cod { font-size: 10.5px; color: var(--ink-3); font-weight: 700; }
        .ad-item-tot { flex: 1; font-size: 11.5px; color: var(--ink-2); font-weight: 700; }
        .ad-desc-in { margin-top: 0; width: 100%; font-size: 12.5px; resize: vertical; }
        .ad-item-campos { display: grid; grid-template-columns: 1.4fr .7fr .6fr 1.1fr 1.2fr; gap: 7px; margin-top: 6px; }
        .ad-addbtn { display: inline-flex; align-items: center; gap: 5px; background: none; border: 1px dashed var(--border); border-radius: 8px; padding: 7px 12px; font-size: 11.5px; font-weight: 600; color: var(--ink-2); font-family: inherit; cursor: pointer; width: 100%; justify-content: center; }
        .ad-addbtn:hover { border-color: var(--ink-3); color: var(--ink); }
        .ad-resumo { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12.5px; color: var(--ink-2); border-bottom: 1px solid var(--border-soft); }
        .ad-resumo.forte { font-size: 14px; font-weight: 700; color: var(--ink); border-bottom: none; padding-top: 9px; }

        .ad-prev { position: sticky; top: 12px; }
        .ad-prev-h { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); margin-bottom: 7px; }
        .ad-prev-box { background: var(--panel); border-radius: 10px; padding: 14px; max-height: 78vh; overflow: auto; }

        /* ---- O DOCUMENTO ----
           Medidas em mm porque ele existe pra virar papel: o que se ve na
           tela e' a mesma caixa que sai do window.print(). */
        .ad-page { width: 210mm; background: #fff; color: #1c2426; font-family: 'Century Gothic', 'Questrial', 'Montserrat', sans-serif; font-size: 8.4pt; line-height: 1.35; padding: 0 0 14mm; display: flex; flex-direction: column; box-shadow: 0 4px 18px rgba(0,0,0,.18); transform-origin: top left; }
        .ad-brandbar { display: block; width: 100%; }
        .ad-inner { padding: 7mm 12mm 0; flex: 1 0 auto; }
        .ad-dochead { display: flex; justify-content: space-between; align-items: flex-end; gap: 10mm; border-bottom: 2px solid #0E5F6B; padding-bottom: 3mm; margin-bottom: 5mm; }
        .ad-dochead .t { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 14pt; color: #0E5F6B; letter-spacing: -.01em; line-height: 1.1; }
        .ad-dochead .meta { font-size: 8.4pt; text-align: right; white-space: nowrap; }
        .ad-dochead .meta div { margin-top: 1.2mm; }
        .ad-dochead .meta b { color: #6b7b7f; font-weight: 400; }
        .ad-sectitle { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 10.5pt; color: #0E5F6B; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 2mm; display: flex; align-items: center; gap: 3mm; page-break-after: avoid; }
        .ad-sectitle::after { content: ""; flex: 1; height: .5mm; background: #0E5F6B; opacity: .25; }
        .ad-sec-sup .ad-sectitle { color: #7d4038; }
        .ad-sec-sup .ad-sectitle::after { background: #7d4038; }
        table.ad-dt { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
        table.ad-dt th { background: #0E5F6B; color: #fff; font-weight: 700; font-size: 7.2pt; letter-spacing: .05em; text-transform: uppercase; padding: 1.8mm 2mm; text-align: left; border-right: 1px solid rgba(255,255,255,.25); }
        table.ad-dt th:last-child { border-right: 0; }
        table.ad-dt td { padding: 1.6mm 2mm; border-bottom: .3mm solid #dfe7e9; vertical-align: top; }
        table.ad-dt tr.g td { background: #e9f2f4; font-weight: 700; text-transform: uppercase; font-size: 8pt; border-bottom: .3mm solid #b9ccd0; border-top: .3mm solid #b9ccd0; }
        table.ad-dt tr.tot td { background: #0E5F6B; color: #fff; font-weight: 700; font-size: 9pt; text-transform: uppercase; letter-spacing: .04em; }
        .ad-sec-sup table.ad-dt th { background: #7d4038; }
        .ad-sec-sup table.ad-dt tr.g td { background: #f4ebe9; border-color: #dcc4bf; }
        .ad-sec-sup table.ad-dt tr.tot td { background: #7d4038; }
        .ad-page .c-cod { width: 12mm; } .ad-page .c-amb { width: 24mm; }
        .ad-page .c-qtd { width: 14mm; } .ad-page .c-un { width: 9mm; }
        .ad-page .c-vu { width: 24mm; } .ad-page .c-vt { width: 27mm; }
        .ad-page td.c-qtd, .ad-page td.c-vu, .ad-page td.c-vt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ad-page th.c-qtd, .ad-page th.c-vu, .ad-page th.c-vt { text-align: right; }
        .ad-page td.c-un, .ad-page th.c-un { text-align: center; }
        .ad-desc { white-space: pre-line; }
        .ad-dt1 { font-weight: 700; }
        .ad-saldo { margin-top: 2mm; margin-left: auto; width: 92mm; border: .4mm solid #0E5F6B; border-radius: 1.5mm; overflow: hidden; }
        .ad-saldo .l { display: flex; justify-content: space-between; padding: 1.8mm 3mm; font-size: 8.6pt; border-bottom: .3mm solid #dfe7e9; }
        .ad-saldo .l:last-child { border-bottom: 0; }
        .ad-saldo .l.f { background: #0E5F6B; color: #fff; font-weight: 700; font-size: 10pt; padding: 2.6mm 3mm; }
        .ad-saldo .l.f.credito { background: #1f7a54; }
        .ad-saldo .l b { font-variant-numeric: tabular-nums; }
        .ad-cond { margin-top: 7mm; font-size: 8.4pt; page-break-inside: avoid; }
        .ad-cond h4 { margin: 0 0 1.5mm; font-size: 8.4pt; color: #0E5F6B; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
        .ad-cond p { margin: 0; white-space: pre-line; }
        .ad-prevalencia { margin-top: 6mm; font-size: 6.6pt; line-height: 1.45; color: #9aa7aa; text-align: justify; page-break-inside: avoid; }
        .ad-pagefoot { margin-top: auto; padding: 8mm 12mm 0; }
        .ad-pagefoot img { display: block; width: 100%; }
        .ad-docwarn { border: 1px dashed #b9ccd0; border-radius: 2mm; padding: 8mm; text-align: center; color: #6b7b7f; font-size: 9pt; }

        @media (max-width: 1200px) { .ad-wrap { grid-template-columns: 1fr; } .ad-prev { position: static; } }

        @media print {
          .naoimprime, .sidebar, .topbar, .nav-obra, .barra-etapa, .eyebrow, .title-row, .obra-meta { display: none !important; }
          .app, .body-layout, .main { background: #fff !important; padding: 0 !important; margin: 0 !important; display: block !important; }
          .doc-escopo { border: none; box-shadow: none; border-radius: 0; max-width: none; padding: 0; margin: 0; }
          .doc-item, .doc-tab tr { break-inside: avoid; }
          .doc-h { break-after: avoid; }
          /* O aditivo: some com o formulario e com a moldura, e deixa a
             pagina do documento ocupar o papel inteiro. A sombra da
             pre-visualizacao viraria uma mancha cinza na impressao. */
          .ad-form, .ad-prev-h, .ad-topo { display: none !important; }
          .ad-wrap { display: block !important; }
          .ad-prev, .ad-prev-box { position: static !important; max-height: none !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
          .ad-page { width: auto !important; box-shadow: none !important; padding: 0 !important; display: block !important; }
          .ad-page .ad-inner { padding: 6mm 12mm 0; }
          table.ad-dt tr { break-inside: avoid; }
          .ad-saldo { break-inside: avoid; }
        }

        @media (max-width: 900px) { .escopo-conta, .escopo-campos { grid-template-columns: 1fr; } }

        /* COMPRAS DE PRODUTOS — o funil. */
        .funil { display: flex; align-items: stretch; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
        .funil-no { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 10px 16px; cursor: pointer; font-family: inherit; text-align: center; min-width: 96px; }
        .funil-no:hover { border-color: var(--ink-3); }
        .funil-no.ativo { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
        .funil-n { font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 700; }
        .funil-rot { font-size: 10.5px; color: var(--ink-2); margin-top: 1px; }
        .funil-v { font-size: 10px; color: var(--ink-3); margin-top: 2px; font-variant-numeric: tabular-nums; }
        .assoc-barra { display: flex; align-items: center; gap: 10px; background: var(--blue-bg); border: 1px solid #C6DDEE; border-radius: 10px; padding: 11px 15px; font-size: 12px; color: var(--ink-2); margin-bottom: 12px; }
        .assoc-barra .btn-doc { margin-left: auto; flex-shrink: 0; }
        .funil-feitos { font-size: 9px; color: var(--ink-3); margin-top: 3px; display: inline-flex; align-items: center; gap: 3px; }
        .funil-feitos.tudo { color: var(--green); font-weight: 700; }
        .mo-num-ok .mo-num-val { color: var(--green); }
        .assoc-resultado { display: flex; align-items: center; gap: 9px; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; margin-bottom: 12px; }
        .assoc-resultado.ok { background: var(--green-bg); border: 1px solid #C9E5D4; color: var(--green); }
        .assoc-resultado.parcial { background: var(--amber-bg); border: 1px solid #E8CE9A; color: #7A4C0A; }
        .btn-associar-sel { display: inline-flex; align-items: center; gap: 5px; background: #fff; color: var(--ink); border: none; border-radius: 8px; padding: 6px 12px; font-size: 11.5px; font-weight: 700; cursor: pointer; font-family: inherit; margin-right: 6px; }
        .btn-associar-sel:hover { background: var(--blue-bg); color: var(--blue); }
        .sel-barra-topo { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .btn-sel-tudo { display: inline-flex; align-items: center; gap: 5px; background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; color: var(--ink-2); }
        .btn-sel-tudo:hover { border-color: var(--ink); color: var(--ink); }
        .btn-limpar-sel-claro { background: transparent; border: none; color: var(--ink-3); font-size: 11.5px; cursor: pointer; font-family: inherit; text-decoration: underline; }
        .mo-check-tab { margin-left: 0; }
        .linha-sel { background: var(--blue-bg); }
        /* Tres respostas, tres cores: "nao achei" manda cadastrar,
           "achei parecido" manda olhar antes de cadastrar. */
        /* O nome da mae inteiro: era um <select> nativo espremido em 170px,
           onde "LUMINÁRIA - ARANDELA" virava "LUMINÁRIA - ARAND". */
        .mae-cel { position: relative; display: flex; align-items: flex-start; gap: 6px; padding: 2px 4px; margin-bottom: 4px; border: 1px solid transparent; border-radius: 6px; border-bottom: 1px solid var(--border-soft); }
        .mae-cel:hover { border-color: var(--border); background: #fff; }
        .mae-cel .casa-bola { margin-top: 5px; }
        .mae-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .mae-cod { font-size: 10.5px; font-weight: 700; }
        .mae-nome { font-size: 11px; line-height: 1.35; color: var(--ink-2); }
        .mae-seta { flex-shrink: 0; margin-top: 3px; color: var(--ink-3); }
        .mae-sel { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font-family: inherit; }
        .mae-cel.casa-exato .mae-cod { color: var(--green); }
        .mae-cel.casa-aproximado .mae-cod { color: var(--amber); }
        .mae-cel.casa-sem .mae-cod { color: var(--red); }
        .casa { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; }
        .casa-bola { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .casa-exato .casa-bola { background: var(--green); }
        .casa-exato { color: var(--green); font-weight: 600; }
        .casa-aproximado .casa-bola { background: var(--amber); }
        .casa-aproximado { color: var(--amber); }
        .casa-sem .casa-bola { background: var(--red); }
        .casa-sem { color: var(--red); font-weight: 600; }
        .casa-sel { max-width: 168px; font-size: 11px; border: 1px solid var(--border); border-radius: 5px; padding: 2px 4px; font-family: inherit; background: #fff; color: var(--ink); }
        .det-opcao { display: flex; align-items: baseline; gap: 8px; width: 100%; text-align: left; background: transparent; border: 1px solid transparent; border-radius: 6px; padding: 3px 6px; cursor: pointer; font-family: inherit; }
        .det-opcao:hover { background: var(--panel); }
        .det-opcao.escolhida { border-color: var(--green); background: var(--green-bg); }
        .det-opcao-txt { flex: 1; font-size: 11px; color: var(--ink-2); line-height: 1.35; }
        .det-falta { font-size: 9.5px; color: var(--amber); white-space: nowrap; flex-shrink: 0; }
        .det-bate { font-size: 9.5px; color: var(--green); font-weight: 700; white-space: nowrap; flex-shrink: 0; }
        .det-gerar { margin-top: 4px; }
        .det-gerar summary { font-size: 10px; color: var(--ink-3); cursor: pointer; }
        .det-gerar summary:hover { color: var(--ink); }
        .detalhe-cel { display: flex; flex-direction: column; gap: 3px; }
        .det-mae { font-size: 9.5px; font-weight: 700; color: var(--purple); text-transform: uppercase; letter-spacing: 0.04em; }
        .det-desc { font-size: 11px; color: var(--ink-2); line-height: 1.4; }
        .det-espec { font-size: 10.5px; color: var(--ink-3); line-height: 1.4; font-style: italic; }
        .padrao-cel { display: flex; align-items: flex-start; gap: 6px; }
        .padrao-txt { font-family: 'JetBrains Mono', monospace; font-size: 10px; line-height: 1.45; background: var(--panel); border-radius: 4px; padding: 4px 6px; flex: 1; word-break: break-word; }
        .btn-copiar { background: transparent; border: 1px solid var(--border); border-radius: 5px; padding: 3px 5px; cursor: pointer; color: var(--ink-3); display: inline-flex; flex-shrink: 0; }
        .btn-copiar:hover { border-color: var(--ink); color: var(--ink); }
        .canal-escolha { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }
        .btn-canal { background: rgba(255,255,255,0.12); border: none; border-radius: 8px; padding: 5px 7px; cursor: pointer; font-family: inherit; }
        .btn-canal:hover { background: rgba(255,255,255,0.26); }
        .btn-canal-limpar { color: #fff; font-size: 11px; font-weight: 600; padding: 7px 11px; opacity: 0.75; }
        .btn-canal-limpar:hover { opacity: 1; }

        /* Conferencia com o Sienge: o que a planilha diz que tem pra
           comprar chegou mesmo la? */
        .btn-pdf-sienge { cursor: pointer; }
        .confronto { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
        .confronto-topo { display: flex; align-items: center; gap: 9px; font-size: 12px; color: var(--ink-2); padding-bottom: 12px; border-bottom: 1px solid var(--border-soft); }
        .confronto-topo span { flex: 1; }
        .cf-docs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .cf-doc { display: inline-flex; align-items: center; gap: 5px; background: var(--panel); border-radius: 20px; padding: 3px 5px 3px 10px; font-size: 11px; }
        .cf-doc-x { display: inline-flex; background: transparent; border: none; color: var(--ink-3); cursor: pointer; padding: 2px; border-radius: 50%; }
        .cf-doc-x:hover { color: var(--red); background: #fff; }
        .confronto-placar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
        .cf-bloco { border-radius: 10px; padding: 10px 14px; }
        .cf-bloco.ok { background: var(--green-bg); color: var(--green); }
        .cf-bloco.ruim { background: var(--red-bg); color: var(--red); }
        .cf-bloco.aviso { background: var(--amber-bg); color: #7A4C0A; }
        .cf-n { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; }
        .cf-rot { font-size: 10.5px; opacity: 0.85; }
        .cf-lista { margin-top: 12px; }
        .cf-tit { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .cf-tit.ruim { color: var(--red); }
        .cf-tit.aviso { color: #7A4C0A; }
        .cf-linha { display: flex; align-items: baseline; gap: 12px; padding: 5px 0; border-bottom: 1px solid var(--border-soft); font-size: 12px; }
        .cf-desc { flex: 1; min-width: 0; }
        /* Gerador avulso: mesma associacao, sem obra e sem gravar nada. */
        .btn-template { background: var(--green); }
        .btn-template:hover { background: #247346; }
        .det-sorteado { color: var(--amber); font-weight: 700; }
        .det-codigos .form-input.sorteado { border-style: dashed; border-color: var(--amber); }
        .det-codigos { display: flex; gap: 8px; margin-top: 5px; }
        .det-codigos label { flex: 1; display: flex; flex-direction: column; gap: 2px; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; font-weight: 700; color: var(--ink-3); }
        .det-codigos .form-input { margin-top: 0; font-size: 11px; padding: 4px 6px; font-family: 'JetBrains Mono', monospace; }
        .det-codigos .form-input.vazio { border-color: var(--amber); background: var(--amber-bg); }
        .det-escolha { margin-top: 6px; border-top: 1px dashed var(--line); padding-top: 6px; }
        .det-escolha-rot { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 9.5px; letter-spacing: .05em; text-transform: uppercase; font-weight: 700; color: var(--ink-3); margin-bottom: 4px; }
        .det-selo-vai { color: var(--blue); background: var(--blue-bg); border-radius: 4px; padding: 1px 5px; text-transform: none; letter-spacing: 0; }
        .det-selo-fora { color: var(--green); background: var(--green-bg); border-radius: 4px; padding: 1px 5px; text-transform: none; letter-spacing: 0; }
        .det-radio { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--ink-3); flex-shrink: 0; align-self: center; }
        .det-opcao.escolhida .det-radio { border-color: var(--green); box-shadow: inset 0 0 0 2px var(--green-bg); background: var(--green); }
        .det-nova { border-radius: 6px; padding: 2px; }
        .det-nova.fora { opacity: .5; }
        .padrao-edit { border: 1px solid var(--line); resize: vertical; min-height: 34px; color: var(--ink); }
        .padrao-edit:focus { outline: none; border-color: var(--blue); background: var(--panel-2); }
        .padrao-acoes { display: flex; flex-direction: column; gap: 3px; }
        .padrao-nota { font-size: 10px; color: var(--amber); font-weight: 600; margin-left: 2px; }
        .ger-forn { display: flex; align-items: center; gap: 9px; font-size: 11px; font-weight: 600; color: var(--ink-2); }
        .ger-forn .form-input { margin-top: 0; width: 160px; font-size: 12px; padding: 6px 9px; }
        .ger-modo { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .ger-modo button { background: none; border: none; font-family: inherit; font-size: 11px; font-weight: 600; color: var(--ink-3); padding: 6px 11px; cursor: pointer; }
        .ger-modo button + button { border-left: 1px solid var(--border); }
        .ger-modo button:hover:not(:disabled) { color: var(--ink); background: var(--panel); }
        .ger-modo button.on { background: var(--ink); color: #fff; }
        .ger-modo button:disabled { color: #C4C4C4; cursor: default; }
        .ger-forn-lidos { display: inline-flex; align-items: center; gap: 8px; font-weight: 400; color: var(--ink-3); }
        .ger-forn-lidos b { font-weight: 600; color: var(--ink-2); }
        .ger-trocar-col { background: none; border: none; font-family: inherit; font-size: 10.5px; color: var(--blue); text-decoration: underline; cursor: pointer; padding: 0; }
        .det-forn, .det-amb { display: inline-block; border-radius: 4px; padding: 1px 6px; margin-right: 6px; font-weight: 600; font-size: 10.5px; }
        .det-forn { background: var(--blue-bg); color: var(--blue); }
        .det-amb { background: var(--panel); color: var(--ink-2); }
        .ger-trocar { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; background: transparent; border: none; color: var(--ink-3); text-decoration: underline; font-size: 10px; cursor: pointer; font-family: inherit; padding: 2px 0; }
        .ger-trocar:hover { color: var(--ink); }
        .ger-busca { display: flex; flex-direction: column; gap: 3px; padding: 6px; background: var(--panel); border-radius: 8px; }
        .ger-busca .form-input { margin-top: 0; font-size: 12px; padding: 5px 8px; }
        .ger-topo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 13px 16px; margin-bottom: 12px; }
        .ger-topo:has(+ .sg-formatos) { border-radius: 12px 12px 0 0; margin-bottom: 0; }
        .ger-info { flex: 1; font-size: 12px; color: var(--ink-3); }
        .ger-placar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
        /* O pedido: mesma folha do escopo, com o cabecalho do pedido. */
        .pedido-wrap { margin-top: 18px; }
        .pedido-topo { display: flex; align-items: center; gap: 12px; background: var(--blue-bg); color: var(--blue); border-radius: 10px; padding: 10px 14px; font-size: 12.5px; margin-bottom: 12px; }
        .pedido-topo .btn-voltar { margin-left: auto; }
        .ped-espec { font-size: 10.5px; color: #6A6E72; font-style: italic; margin-top: 2px; }
        .ped-sienge { font-size: 10px; color: #85898D; margin-top: 2px; }
        .pedido-vencido { color: #C2453F; font-weight: 700; }
        .pedido-perto { color: #B54708; font-weight: 600; }
        /* DASHBOARD MO — a base de orcado de um escopo. */
        .mo-topo { display: flex; align-items: center; gap: 30px; flex-wrap: wrap; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; margin-bottom: 12px; }
        .mo-num-val { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .mo-num-rot { font-size: 10.5px; color: var(--ink-3); margin-top: 1px; }
        .mo-topo .btn-nova-solicitacao { margin-left: auto; }
        .mo-check { width: 19px; height: 19px; flex-shrink: 0; border-radius: 5px; border: 1.5px solid var(--border); background: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #fff; padding: 0; margin-left: 16px; }
        .mo-check:hover { border-color: var(--blue); }
        .mo-linha.sel .mo-check, .grp-head .mo-check:has(svg) { background: var(--blue); border-color: var(--blue); }
        .mo-linha { display: flex; align-items: center; gap: 10px; padding-right: 14px; }
        .mo-linha.sel { background: var(--blue-bg); }
        .mo-linha .compras-row { flex: 1; min-width: 0; }
        .mo-valor { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; min-width: 104px; text-align: right; }
        /* A soma so aparece quando ha selecao: e o unico numero da tela
           contra o qual a proposta do fornecedor vai ser comparada. */
        .mo-escopo-barra { position: sticky; bottom: 14px; display: flex; align-items: center; gap: 18px; background: var(--ink); color: #fff; border-radius: 12px; padding: 13px 20px; margin-top: 14px; box-shadow: 0 6px 20px rgba(0,0,0,0.18); }
        .mo-escopo-val { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .mo-escopo-rot { font-size: 11px; opacity: 0.75; margin-top: 1px; }
        .btn-limpar-sel { margin-left: auto; background: rgba(255,255,255,0.14); color: #fff; border: none; border-radius: 7px; padding: 7px 13px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .btn-limpar-sel:hover { background: rgba(255,255,255,0.24); }

        .dash { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px; }
        .dash-hero, .dash-atencao { grid-column: 1 / -1; }
        .dash-hero, .dash-card, .dash-atencao { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; }
        .dash-rot { font-size: 10px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
        .dash-hero-topo { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .dash-hero-nums { display: flex; align-items: center; gap: 18px; }
        .dash-num-val { font-family: 'Space Grotesk', sans-serif; font-size: 27px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .dash-num-rot { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
        .dash-seta { font-size: 19px; color: var(--ink-3); padding-bottom: 16px; }
        .dash-delta { display: flex; align-items: center; gap: 8px; border-radius: 12px; padding: 9px 14px; }
        .dash-delta.ok { background: var(--green-bg); color: var(--green); }
        .dash-delta.ruim { background: var(--red-bg); color: var(--red); }
        .dash-delta-val { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .dash-delta-rot { font-size: 10.5px; opacity: 0.85; }
        /* A barra inteira e o vendido; o preenchido, o executivo. */
        .dash-barra { position: relative; display: flex; height: 8px; background: var(--panel); border-radius: 20px; overflow: hidden; margin-top: 16px; }
        .dash-barra-fill.ok { background: var(--green); }
        .dash-barra-fill.ruim { background: var(--red); }
        .dash-barra-over { background: repeating-linear-gradient(45deg, var(--red) 0 4px, #E58B85 4px 8px); }
        .dash-barra-rot { font-size: 10.5px; color: var(--ink-3); margin-top: 6px; }
        .dash-anel-linha { display: flex; align-items: center; gap: 18px; }
        .dash-anel-txt { font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 700; fill: var(--ink); }
        .dash-mini { font-size: 11px; color: var(--ink-2); margin-top: 4px; }
        .dash-data-linha { display: flex; align-items: center; gap: 8px; }
        .dash-data-linha .entrega-input { width: auto; flex: 1; margin-top: 0; }
        .btn-salvar-data { background: var(--ink); color: #fff; border: none; border-radius: 7px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .btn-salvar-data:hover { background: var(--blue); }
        .dash-sujo { color: var(--amber); font-weight: 600; }
        .dash-proximo { display: flex; align-items: flex-start; gap: 8px; margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--border-soft); color: var(--ink-2); }
        .dash-proximo-tit { font-size: 9.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; }
        .dash-proximo-val { font-size: 12.5px; margin-top: 2px; }
        .dash-proximo-conta { color: var(--ink-3); }
        .dash-proximo.perto, .dash-proximo.perto .dash-proximo-conta { color: var(--amber); }
        .dash-proximo.vencido, .dash-proximo.vencido .dash-proximo-conta { color: var(--red); font-weight: 600; }
        .dash-atencao { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; padding: 13px 20px; }
        .dash-atencao.tudo-ok { background: var(--green-bg); border-color: #C9E5D4; }
        .dash-alerta { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; }
        .dash-alerta.ok { color: var(--green); }
        .dash-alerta.red { color: var(--red); }
        .dash-alerta.amber { color: var(--amber); }
        .dash-alerta.purple { color: var(--purple); }
        .dash-atalho { margin-left: auto; margin-top: 0; }
        @media (max-width: 900px) { .dash { grid-template-columns: 1fr; } }

        /* NOVO PAINEL DA OBRA — cartões no mesmo estilo do painel geral
           (classes .ini-cel / .ini-titulo), só que na escala de UMA obra. */
        .dobra-regua { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; margin-bottom: 16px; }
        .dobra-entrega { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; padding: 10px 14px; background: #fff; border: 1px solid var(--border-soft); border-radius: 10px; font-size: 12.5px; color: var(--ink-2); }
        .dobra-entrega-rot { font-weight: 600; color: var(--ink); margin-right: 4px; }
        .dobra-entrega .entrega-input { width: auto; margin-top: 0; }
        .dobra-card { background: #fff; border: 1px solid var(--border-soft); border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(20,20,20,.03); }
        .dobra-sub { font-size: 11.5px; color: var(--ink-3); margin: -4px 0 14px; }
        .dobra-colunas { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; align-items: start; }
        .dobra-colunas .dobra-card { margin-bottom: 0; }
        @media (max-width: 1100px) { .dobra-regua { grid-template-columns: repeat(2,1fr); } .dobra-colunas { grid-template-columns: 1fr; } }

        /* Jornada da obra: passos conectados, feito / atual / aguardando. */
        .jornada { display: flex; align-items: flex-start; }
        .jornada-passo { display: flex; flex-direction: column; align-items: center; text-align: center; width: 132px; flex-shrink: 0; }
        .jornada-linha { flex: 1; height: 2px; background: var(--border); margin-top: 15px; min-width: 12px; }
        .jornada-linha.feita { background: var(--green); }
        .jornada-bola { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--panel); border: 2px solid var(--border); color: var(--ink-3); margin-bottom: 8px; }
        .jornada-bola.feita { background: var(--green); border-color: var(--green); color: #fff; }
        .jornada-bola.atual { background: #fff; border-color: var(--blue); color: var(--blue); }
        .jornada-ponto { width: 9px; height: 9px; border-radius: 50%; background: var(--blue); }
        .jornada-nome { font-size: 12.5px; font-weight: 700; color: var(--ink); }
        .jornada-status { font-size: 10.5px; color: var(--ink-3); margin-top: 2px; }
        @media (max-width: 900px) { .jornada { flex-wrap: wrap; } .jornada-linha { display: none; } .jornada-passo { width: auto; margin: 0 10px 10px 0; } }

        /* Progresso por frente: nome, barra, percentual — nada mais. */
        .frente-linha { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .frente-linha:last-child { margin-bottom: 0; }
        .frente-nome { font-size: 12px; color: var(--ink-2); width: 84px; flex-shrink: 0; }
        .frente-barra { flex: 1; height: 7px; background: var(--panel); border-radius: 20px; overflow: hidden; }
        .frente-fill { height: 100%; background: var(--blue); border-radius: 20px; }
        .frente-pct { font-size: 12px; color: var(--ink); width: 34px; text-align: right; flex-shrink: 0; }

        /* Equipe da obra: avatar + papel + PapelDaObra (nome ou seletor). */
        .equipe-linha { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border-soft); }
        .equipe-linha:last-child { border-bottom: none; padding-bottom: 0; }
        .equipe-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--blue-bg); color: var(--blue); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .equipe-avatar.vazio { background: var(--panel); color: var(--ink-3); }
        .equipe-corpo { flex: 1; min-width: 0; }
        .equipe-rotulo { font-size: 10px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 3px; }

        .resumo-label { font-size: 11px; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 12px 4px; }
        /* Cinco colunas fixas espremiam tudo em tela estreita, e como as
           células esticam pra igualar a mais alta, cada card ficava com um
           vazio embaixo do número. Agora as colunas se acomodam à largura
           e os cards param de esticar. */
        .resumo-panel { background: var(--panel); border-radius: 16px; padding: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); align-items: start; gap: 12px; margin-bottom: 28px; }
        .resumo-panel .mini-stats { grid-column: span 1; min-width: 210px; }
        @media (min-width: 1500px) { .resumo-panel { grid-template-columns: repeat(4, 1fr) 250px 230px; } }
        .big-card { background: #fff; border: 1px solid var(--border-soft); border-radius: 12px; padding: 15px 17px; }
        .big-card-label { font-size: 10px; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 9px; }
        .big-card-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .big-card-value { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
        .big-card-sub { font-size: 11px; color: var(--ink-3); margin-top: 6px; }
        .delta { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 700; }
        .delta-good { color: var(--green); }
        .delta-bad { color: var(--red); }
        .progress-track { height: 5px; background: var(--panel); border-radius: 4px; margin-top: 9px; overflow: hidden; }
        .progress-fill { height: 5px; background: var(--blue); border-radius: 4px; }

        .mini-stats { display: flex; flex-direction: column; gap: 8px; }
        .mini-stat { background: #fff; border: 1px solid var(--border-soft); border-radius: 12px; padding: 9px 14px; flex: 1; display: flex; flex-direction: column; justify-content: center; }
        .mini-stat-label { font-size: 9.5px; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        .mini-stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 700; }

        /* ESTEIRA — dois niveis.
           O primeiro separa por momento (planejar / executar), o segundo
           mostra a fila daquele momento com o cumprido marcado. */
        /* BARRA DA ETAPA — estado da edição + avanço, numa linha só.
           Minimalista: o estado é um ponto e uma palavra, as ações
           secundárias são texto. O único botão cheio é o de avançar,
           porque é a única coisa aqui que empurra a obra pra frente. */
        .barra-etapa { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 14px; margin-bottom: 16px; background: #fff; border: 1px solid var(--border); border-radius: 10px; font-size: 12.5px; }
        .barra-etapa.feita { background: var(--green-bg); border-color: var(--green); }
        .be-estado { display: inline-flex; align-items: center; gap: 7px; color: var(--ink-2); min-width: 0; }
        .be-estado b { color: var(--ink-1); font-weight: 600; }
        .be-ponto { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-3); flex-shrink: 0; }
        .be-ponto.editando { background: var(--green); box-shadow: 0 0 0 3px var(--green-bg); }
        .be-ponto.carregando { background: var(--amber); }
        .be-salvo { font-size: 11.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
        .be-link { font: inherit; font-size: 12px; color: var(--blue); background: transparent; border: none; padding: 0 2px; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
        .be-link:hover { color: var(--ink-1); }
        .be-link:disabled { color: var(--ink-3); cursor: default; text-decoration: none; }
        .be-dir { display: inline-flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .be-feita { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-2); }
        .be-feita svg { color: var(--green); }
        .be-avancar { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 12.5px; font-weight: 600; color: #fff; background: var(--blue); border: none; border-radius: 8px; padding: 7px 13px; cursor: pointer; }
        .be-avancar:hover:not(:disabled) { filter: brightness(1.08); }
        .be-avancar:disabled { background: var(--border); color: var(--ink-3); cursor: default; }

        .nav-obra { margin-bottom: 18px; }
        /* Respiro entre a navegação e o conteúdo dela. Coladas, a fila de
           etapas parecia parte do painel de baixo. */
        .nav-obra + .resumo-label { margin-top: 0; }
        .nav-grupos { display: flex; gap: 6px; border-bottom: 1px solid var(--border); padding: 0 2px; }
        .nav-grupo { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 600; color: var(--ink-3); background: transparent; border: none; border-bottom: 2px solid transparent; padding: 11px 14px; margin-bottom: -1px; cursor: pointer; }
        .nav-grupo:hover { color: var(--ink-1); }
        .nav-grupo.active { color: var(--blue); border-bottom-color: var(--blue); }
        .nav-grupo-progresso { font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ink-3); background: var(--panel); border-radius: 20px; padding: 1px 7px; }
        .nav-grupo.active .nav-grupo-progresso { color: var(--blue); background: var(--blue-bg); }

        /* etapa cumprida: check verde no lugar do icone */
        .tab.feita .tab-check { color: var(--green); }
        .tab.feita { color: var(--ink-2); }
        /* etapa cuja anterior nao foi cumprida: da pra ver e visitar, mas
           o cadeado avisa que a esteira ainda nao chegou ali */
        .tab.travada { opacity: 0.5; }

        .etapa-pendente, .etapa-concluida { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 12px 16px; border-radius: 10px; font-size: 13px; }
        .etapa-pendente { background: var(--panel); border: 1px solid var(--border); }
        .etapa-pendente-texto { color: var(--ink-2); flex: 1; }
        .etapa-concluida { background: var(--green-bg); border: 1px solid var(--green); color: var(--ink-1); }
        .etapa-concluida svg { color: var(--green); flex-shrink: 0; }
        .etapa-concluida span { flex: 1; }

        .bloqueio-assinatura { background: var(--red-bg); }
        .bloqueio-assinatura svg { color: var(--red); }

        .assinatura-ok { display: flex; align-items: flex-start; gap: 16px; padding: 20px; background: var(--green-bg); border: 1px solid var(--green); border-radius: 12px; }
        .assinatura-selo { color: var(--green); flex-shrink: 0; }
        .assinatura-corpo { flex: 1; }
        .assinatura-titulo { font-size: 15px; font-weight: 700; margin-bottom: 5px; }
        .assinatura-linha { font-size: 13px; color: var(--ink-2); }
        .assinatura-obs { font-size: 13px; color: var(--ink-2); margin-top: 7px; font-style: italic; }
        .assinatura-arq { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-2); margin-top: 8px; }
        .assinatura-sem-arq { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #B54708; margin-top: 8px; }
        /* Quando o aviso vem na mesma linha do nome do arquivo, o
           respiro de cima é do bloco, não dele. */
        .assinatura-arq .assinatura-sem-arq { margin-top: 0; font-size: 11.5px; }
        .assinatura-campos { display: grid; grid-template-columns: 200px 1fr; gap: 16px; padding: 18px 20px; }
        .campo { display: flex; flex-direction: column; gap: 6px; }
        .campo-largo { grid-column: 1 / -1; }
        .campo-rotulo { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-3); }
        .campo input { font: inherit; font-size: 13px; padding: 9px 11px; border: 1px solid var(--border); border-radius: 8px; }
        .assinatura-upload { display: flex; align-items: center; gap: 12px; }
        .assinatura-acoes { display: flex; align-items: center; justify-content: flex-end; gap: 14px; padding: 0 20px 18px; }
        .assinatura-aviso { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #B54708; }

        .tabbar { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 20px; overflow-x: auto; }
        .tabbar .tab { white-space: nowrap; flex-shrink: 0; }
        .tab { display: flex; align-items: center; gap: 7px; background: transparent; border: none; padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: var(--ink-3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .tab:hover { color: var(--ink-2); }
        .tab.active { color: var(--ink); border-bottom-color: var(--blue); }

        .filter-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 14px; }
        .filter-chip { background: #fff; border: 1px solid var(--border); border-radius: 20px; padding: 5px 12px; font-size: 11.5px; font-weight: 500; color: var(--ink-2); cursor: pointer; }
        .filter-chip:hover { border-color: var(--blue); }
        .filter-chip.active { background: var(--ink); border-color: var(--ink); color: #fff; font-weight: 600; }
        /* Fila de cima: o que o item É. Fica acima e mais encorpada que a
           de situação, porque decide qual das duas rotinas — compra no
           Sienge ou contrato — você está tocando. */
        .tipo-bar { margin-bottom: 8px; }
        .tipo-chip { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; }
        .tipo-chip-conta { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 20px; background: var(--panel); color: var(--ink-3); }
        .tipo-chip.active .tipo-chip-conta { background: rgba(255,255,255,0.22); color: #fff; }
        .tipo-bar-destino { font-size: 11px; color: var(--ink-3); font-style: italic; margin-left: 3px; }
        .venda-bar { margin-bottom: 10px; }
        .vend-nao-vendido { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--ink-3); background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 1px 8px; flex-shrink: 0; }
        .vend-nao-vendido.leve { text-transform: none; letter-spacing: 0; font-weight: 500; border-style: dashed; }

        /* PLANO DE COMPRAS — grupo da EAP em forma de lista.
           A linha fechada carrega o que se pergunta primeiro (quanto de
           MAT, quanto de MO); o item so aparece ao abrir. */
        .grp-block { background: var(--card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; overflow: hidden; }
        /* O cabecalho deixou de ser um <button> pra caber controle
           dentro dele (o campo de dias do prazo). Quem abre o grupo agora
           e so a parte esquerda, que segue sendo a maior area da linha. */
        .grp-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-right: 16px; }
        .grp-head:hover { background: #FCFBF9; }
        .grp-toggle { flex: 1; min-width: 0; background: transparent; border: none; padding: 12px 16px; cursor: pointer; font-family: inherit; text-align: left; }
        .grp-esq { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .grp-num { font-size: 11.5px; color: var(--ink-3); width: 20px; flex-shrink: 0; }
        .grp-nome { font-size: 13.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .grp-conta { font-size: 10.5px; color: var(--ink-3); background: var(--panel); border-radius: 20px; padding: 2px 8px; flex-shrink: 0; }
        .grp-avulsos { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 600; color: var(--purple); background: #EFEAFB; border-radius: 20px; padding: 2px 8px; flex-shrink: 0; }
        /* MAT e MO em colunas de largura fixa: com valores alinhados da
           direita, os grupos viram uma coluna so de cima a baixo e da pra
           comparar verba com verba sem ler numero por numero. */
        .grp-dir { display: flex; align-items: center; gap: 22px; flex-shrink: 0; }
        .grp-tot { min-width: 108px; text-align: right; }
        .grp-tot-rot { font-size: 9.5px; font-weight: 700; color: var(--ink-3); letter-spacing: 0.06em; }
        .grp-tot-val { font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
        /* PRAZO DE COMPRA — a data, nao o prazo do fornecedor.
           Ninguem subtrai 75 dias de cabeca no meio de uma conferencia de
           200 itens, entao a celula ja mostra a data e a contagem. */
        .grp-prazo { min-width: 136px; text-align: right; }
        .prazo-conta { font-size: 10.5px; color: var(--ink-3); margin-top: 1px; }
        .prazo-sem-data { font-size: 10.5px; max-width: 140px; line-height: 1.3; }
        .grp-prazo.prazo-perto .grp-tot-val, .grp-prazo.prazo-perto .prazo-conta { color: var(--amber); }
        .grp-prazo.prazo-vencido .grp-tot-val, .grp-prazo.prazo-vencido .prazo-conta { color: var(--red); font-weight: 700; }
        .prazo-marca { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; border-radius: 50%; background: var(--amber-bg); color: var(--amber); font-size: 9px; font-weight: 700; margin-left: 4px; vertical-align: middle; }

        /* Dashboard: a data que comanda os prazos, e as avulsas. */
        .entrega-panel { display: flex; flex-direction: column; gap: 8px; min-width: 210px; }
        .aviso-entrega { margin-bottom: 12px; align-items: center; }
        .aviso-migracao { display: flex; align-items: center; gap: 9px; background: var(--amber-bg); color: #7A4C0A; border: 1px solid #E8CE9A; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; margin-bottom: 14px; }
        .aviso-x { margin-left: auto; background: transparent; border: none; color: inherit; cursor: pointer; display: flex; opacity: 0.6; }
        .aviso-x:hover { opacity: 1; }
        .be-parcial { color: var(--amber); font-weight: 600; }
        .entrega-bloco { background: #fff; border: 1px solid var(--border-soft); border-radius: 12px; padding: 10px 14px; }
        .entrega-input { width: 100%; margin-top: 3px; border: 1px solid var(--border); border-radius: 7px; padding: 5px 8px; font-size: 13px; font-family: 'JetBrains Mono', monospace; color: var(--ink); background: #fff; }
        .entrega-input:focus { border-color: var(--ink); outline: none; }
        .entrega-input:disabled { background: var(--panel); color: var(--ink-3); }
        .entrega-sub { font-size: 10.5px; color: var(--ink-3); margin-top: 3px; line-height: 1.35; }
        .btn-atalho { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; background: var(--ink); color: #fff; border: none; border-radius: 7px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .btn-atalho:hover { background: var(--purple); }

        .grp-itens { border-top: 1px solid var(--border); background: #FCFBF8; overflow-x: auto; }
        /* As 12 colunas somam mais que a largura util da tela. Sem um
           minimo, o navegador espremia justamente a coluna flexivel — a
           descricao — e "Anotacao de responsabilidade tecnica" saia em
           quatro linhas ao lado de colunas de valor com folga sobrando.
           Com o minimo a tabela rola na horizontal e a descricao respira. */
        /* Sem largura minima gigante: a tabela encolheu de duas colunas
           de Sienge pra uma, entao ela cabe sem rolar na maioria das
           telas — e rolar pro lado e o oposto de ler uma lista. */
        .grp-itens table { width: 100%; min-width: 900px; border-collapse: collapse; }
        .grp-itens th:nth-child(2), .grp-itens td:nth-child(2) { min-width: 230px; }
        /* A situacao virou o controle de incluir/tirar do plano. */
        .pill-btn { border: none; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
        .pill-btn:hover { filter: brightness(0.95); box-shadow: inset 0 0 0 1px currentColor; }
        .grp-itens th { text-align: left; font-size: 10.5px; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.03em; padding: 9px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .grp-itens td { padding: 9px 12px; border-bottom: 1px solid var(--border-soft); vertical-align: top; font-size: 12.5px; }
        .grp-itens th.center, .grp-itens td.center { text-align: center; }
        .grp-itens th.right, .grp-itens td.right { text-align: right; }
        .grp-itens td.mono { font-variant-numeric: tabular-nums; }
        .grp-itens tfoot td { border-bottom: none; border-top: 1px solid var(--border); background: #F7F6F2; font-size: 12.5px; }

        /* Alocacao de recurso. MAT/MO ganha as duas cores num degrade de
           canto — a pessoa reconhece "os dois" sem ler a sigla. */
        .aloc { display: inline-block; font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 5px; white-space: nowrap; }
        .aloc-mat { background: var(--blue-bg); color: var(--blue); }
        .aloc-mo { background: var(--panel); color: var(--ink-2); }
        .aloc-ambos { background: linear-gradient(105deg, var(--blue-bg) 50%, var(--panel) 50%); color: var(--ink-2); }
        /* Ponto na etiqueta = alocacao corrigida a mao. Numero que nao e
           mais o que a planilha disse nao pode ficar calado na tela. */
        .aloc-vazio { background: var(--red-bg); color: var(--red); }
        .aloc-manual { box-shadow: inset 0 0 0 1px var(--purple); position: relative; }
        .aloc-manual::after { content: ""; position: absolute; top: -2px; right: -2px; width: 5px; height: 5px; border-radius: 50%; background: var(--purple); }
        /* O select de verdade fica por cima da etiqueta, invisivel: a
           pessoa clica onde ja estava olhando e o teclado continua indo. */
        .aloc-edit { position: relative; display: inline-block; }
        .aloc-edit select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font-family: inherit; }
        .aloc-edit:hover .aloc { box-shadow: inset 0 0 0 1px var(--ink-3); }
        .aloc-edit select:focus-visible + .aloc, .aloc-edit:focus-within .aloc { box-shadow: inset 0 0 0 2px var(--ink); }

        /* Avulso e a linha que NAO veio da planilha. Fica visivelmente
           diferente porque a pergunta "de onde saiu isto?" aparece toda
           vez que alguem confere o plano meses depois. */
        /* Tom pastel bem claro: com 174 linhas, cor forte vira parede e
           para de informar. O verde e um tico mais presente porque ele e
           a excecao — a maioria falta comprar. */
        .row-falta { background: #FEFCF3; }
        .row-comprado { background: #F2F9F4; }
        .grp-itens tbody tr.row-comprado td:first-child { box-shadow: inset 2px 0 0 var(--green); }
        .grp-itens tbody tr.row-falta td:first-child { box-shadow: inset 2px 0 0 #E5C97A; }
        .status-pill { display: inline-flex; align-items: center; gap: 4px; }
        .legend-quadro { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
        .q-falta { background: #FEFCF3; border: 1px solid #E5C97A; }
        .q-comprado { background: #F2F9F4; border: 1px solid var(--green); }
        .row-avulso { background: #FBFAFE; }
        .row-avulso td:first-child { box-shadow: inset 2px 0 0 var(--purple); }
        .tag-avulso { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; color: var(--purple); background: #EFEAFB; border-radius: 4px; padding: 1px 6px; margin-top: 3px; }
        .avulso-obs { font-size: 11px; color: var(--ink-3); margin-top: 3px; }

        /* Separar a MO: acao pequena, ao lado da etiqueta que a motiva. */
        .btn-separar { display: inline-flex; align-items: center; gap: 3px; margin-top: 4px; background: transparent; border: 1px dashed var(--border); border-radius: 5px; padding: 1px 6px; font-size: 9.5px; font-weight: 600; color: var(--ink-3); cursor: pointer; font-family: inherit; white-space: nowrap; }
        .btn-separar:hover { border-color: var(--purple); color: var(--purple); border-style: solid; }
        .grp-acao { display: flex; align-items: center; gap: 9px; padding: 9px 14px; background: var(--amber-bg); border-bottom: 1px solid var(--border); font-size: 11.5px; color: var(--ink-2); }
        .btn-separar-grupo { margin-left: auto; background: var(--ink); color: #fff; border: none; border-radius: 6px; padding: 5px 11px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .btn-separar-grupo:hover { background: var(--purple); }
        /* As duas pontas do vinculo. Sem elas sao duas linhas parecidas em
           verbas diferentes, e a conferencia de meses depois nao sabe se e
           separacao ou duplicata. */
        .tag-separado { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--purple); background: #EFEAFB; border-radius: 4px; padding: 1px 6px; margin-top: 3px; }
        .btn-juntar { background: transparent; border: none; color: var(--purple); text-decoration: underline; font-size: 10px; cursor: pointer; font-family: inherit; padding: 0 0 0 3px; }
        .btn-avulsa { display: inline-flex; align-items: center; gap: 6px; background: var(--ink); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; margin-bottom: 12px; }
        .btn-avulsa:hover { background: var(--purple); }
        .form-avulsa { max-width: 560px; margin-bottom: 12px; }
        .form-avulsa-nota { font-size: 11.5px; color: var(--ink-2); background: var(--panel); border-radius: 8px; padding: 9px 11px; margin-bottom: 12px; line-height: 1.45; }
        .form-avulsa-aviso { font-size: 11.5px; color: var(--ink-2); margin-top: 8px; }
        .aloc-escolha { display: flex; gap: 8px; margin-top: 6px; }
        .aloc-op { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px 11px; cursor: pointer; font-family: inherit; flex: 1; }
        .aloc-op:hover { border-color: var(--purple); }
        .aloc-op.ativo { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
        .aloc-op-sub { font-size: 10.5px; color: var(--ink-3); }
        .filter-sep { width: 1px; height: 18px; background: var(--border); margin: 0 3px; }

        .cat-block { background: var(--card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; overflow: hidden; }
        .cat-header { width: 100%; background: transparent; border: none; display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; }
        .cat-header:hover { background: #FCFBF9; }
        .cat-header-left { display: flex; align-items: center; gap: 10px; }
        .cat-num { font-size: 11.5px; color: var(--ink-3); width: 20px; }
        .cat-nome { font-size: 13.5px; font-weight: 600; color: var(--ink); }
        .cat-header-right { display: flex; align-items: center; gap: 18px; }
        .cbar { width: 110px; }
        .cbar-track { position: relative; height: 5px; background: var(--panel); border-radius: 4px; }
        .cbar-vendido { position: absolute; top: 0; left: 0; height: 5px; background: var(--border); border-radius: 4px; }
        .cbar-exec { position: absolute; top: 0; left: 0; height: 5px; border-radius: 4px; opacity: 0.9; }
        .cat-values { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 190px; justify-content: flex-end; }
        .arrow { font-size: 11px; }
        .cat-diff { font-size: 12px; font-weight: 600; min-width: 150px; text-align: right; }
        .status-text { font-size: 11.5px; font-weight: 600; white-space: nowrap; min-width: 140px; text-align: right; }

        .cat-items { border-top: 1px solid var(--border); background: #FCFBF8; }
        .table-note { font-size: 10.5px; color: var(--ink-3); padding: 8px 12px; font-style: italic; border-bottom: 1px solid var(--border-soft); }
        .fluxo-bloco { border-bottom: 1px solid var(--border); }
        .fluxo-bloco:last-child { border-bottom: none; }
        .fluxo-head { display: flex; align-items: center; gap: 8px; padding: 9px 12px; font-size: 12px; font-weight: 700; border-bottom: 1px solid var(--border-soft); }
        .fluxo-head-produto { color: var(--blue); background: var(--blue-bg); }
        .fluxo-head-servico { color: var(--ink-2); background: var(--panel); }
        .fluxo-titulo { font-weight: 700; }
        .fluxo-dest { font-weight: 600; font-size: 11px; opacity: 0.85; }
        .fluxo-meta { margin-left: auto; font-size: 11px; font-weight: 600; color: var(--ink-3); font-family: 'JetBrains Mono', monospace; }
        .cat-items table, .flat-table { width: 100%; border-collapse: collapse; }
        .cat-items th, .flat-table th { text-align: left; font-size: 10.5px; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.03em; padding: 9px 12px; border-bottom: 1px solid var(--border); }
        .cat-items td, .flat-table td { padding: 9px 12px; border-bottom: 1px solid var(--border-soft); vertical-align: top; font-size: 12.5px; }
        .cat-items tr:last-child td { border-bottom: none; }
        .row-alert { background: var(--red-bg); }
        .row-estouro { background: var(--amber-bg); }
        .input-qtd { width: 66px; }
        .input-estouro { border-color: var(--red); color: var(--red); }
        .estouro-tag { display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 700; color: var(--red); margin-top: 3px; }

        .item-desc { color: var(--ink); line-height: 1.4; }
        .tipo-tag { display: inline-block; margin-left: 7px; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; padding: 1px 6px; border-radius: 4px; vertical-align: middle; }
        .tipo-produto { background: var(--blue-bg); color: var(--blue); }
        .tipo-servico { background: var(--panel); color: var(--ink-3); }
        .item-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
        .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 6px; }
        .chip-red { background: var(--red-bg); color: var(--red); }
        .chip-blue { background: var(--blue-bg); color: var(--blue); }
        .chip-green { background: var(--green-bg); color: var(--green); }

        .sienge-match { display: flex; align-items: flex-start; gap: 7px; margin-top: 7px; padding: 7px 10px; border-radius: 7px; font-size: 11.5px; line-height: 1.45; }
        .sienge-match-icon { flex-shrink: 0; margin-top: 2px; }
        .sienge-match-green { background: var(--green-bg); }
        .sienge-match-green .sienge-match-icon, .sienge-match-green .sienge-cod { color: var(--green); }
        .sienge-match-amber { background: var(--amber-bg); }
        .sienge-match-amber .sienge-match-icon, .sienge-match-amber .sienge-cod { color: var(--amber); }
        .sienge-match-neutral { background: var(--panel); }
        .sienge-match-neutral .sienge-match-icon { color: var(--ink-3); }
        .sienge-cod { font-weight: 600; margin-right: 6px; }
        .sienge-eyebrow { display: block; font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; opacity: 0.75; margin-bottom: 2px; }
        .sienge-desc { color: var(--ink-2); }
        .sienge-note { display: block; color: var(--ink-3); font-size: 10.5px; margin-top: 2px; font-style: italic; }

        .qtd-bad { color: var(--red); font-weight: 700; }
        .unit { color: var(--ink-3); font-size: 11px; }
        .center-block { display: block; text-align: center; }

        .btn-approve { display: inline-flex; align-items: center; gap: 4px; background: var(--ink); color: #fff; border: none; border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .btn-approve:hover { background: var(--blue); }
        .tag-canal { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 20px; white-space: nowrap; }
        .tag-canal b { font-size: 9.5px; font-weight: 800; letter-spacing: 0.04em; }
        .pill { font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
        .pill-ok { background: var(--green-bg); color: var(--green); }
        .pill-contratos { background: var(--panel); color: var(--ink-2); display: inline-flex; align-items: center; gap: 4px; }
        .pill-wait { background: var(--panel); color: var(--ink-3); }
        .pill-falta { background: #FDF3E3; color: #B54708; }

        /* PLANO DE COMPRAS — seleção do que vai ser comprado.

           A marca da sugestão é TRACEJADA, e a da pessoa é cheia. As duas
           contam no total do plano, mas só uma foi decidida por alguém —
           e é isso que a borda diz sem precisar de legenda. */
        .est-tag { font-size: 9.5px; margin-left: 4px; font-style: italic; }
        /* A parcela de mão de obra do item aparece na linha de compra só
           como informação: ela segue pra Contratos, e quem a movimenta é
           aquele módulo. */
        .tag-mo { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--ink-3); background: var(--panel); border-radius: 4px; padding: 1px 6px; margin-top: 3px; }
        .plano-barra { display: flex; align-items: center; gap: 26px; flex-wrap: wrap; background: var(--card); border: 1px solid var(--linha); border-radius: 10px; padding: 13px 18px; margin-bottom: 12px; }
        .plano-valor { font-size: 17px; font-weight: 700; }
        .plano-rotulo { font-size: 11px; color: var(--ink-3); margin-top: 1px; }
        .plano-num-ok .plano-valor { color: var(--green); }
        .plano-num-ok { padding-left: 26px; border-left: 1px solid var(--linha); }
        .plano-num-mo { padding-left: 26px; border-left: 1px solid var(--linha); }
        .contrato-cell { vertical-align: middle; }
        .contrato-pill { display: inline-block; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; }
        .contrato-blocked { display: inline-block; font-size: 11px; font-weight: 600; color: var(--red); background: var(--red-bg); padding: 4px 10px; border-radius: 20px; }
        .contrato-caption { display: block; font-size: 10px; color: var(--ink-3); font-style: italic; margin-top: 4px; }
        .input-valor { width: 88px; text-align: right; border: 1px solid var(--border); border-radius: 6px; padding: 4px 7px; font-size: 12px; font-family: 'JetBrains Mono', monospace; background: #fff; color: var(--ink); }
        .input-valor:focus { outline: none; border-color: var(--blue); }
        .check { width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid var(--border); background: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; }
        .check-on { background: var(--green); border-color: var(--green); }

        .legend { display: flex; gap: 18px; margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--border); flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--ink-2); }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; }

        .flat-panel { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; }
        .flat-panel-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
        .flat-panel-title { font-size: 14px; font-weight: 700; color: var(--ink); }
        .flat-panel-sub { font-size: 11.5px; color: var(--ink-3); margin-top: 4px; max-width: 560px; }
        .btn-download { display: flex; align-items: center; gap: 6px; background: var(--ink); color: #fff; border: none; border-radius: 8px; padding: 8px 13px; font-size: 12px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
        .btn-download:hover { background: var(--blue); }
        .import-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 14px; align-items: start; }
        .import-card { display: flex; flex-direction: column; gap: 8px; }
        .import-bar { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; background: var(--panel); border: 1px dashed var(--border); border-radius: 12px; padding: 12px 15px; margin-bottom: 0; }
        .import-bar .btn-import { align-self: stretch; justify-content: center; }
        .btn-limpar-import { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--red); background: transparent; border: 1px solid var(--border); border-radius: 7px; padding: 6px 11px; cursor: pointer; flex-shrink: 0; }
        .btn-limpar-import:hover:not(:disabled) { background: var(--red-bg); border-color: var(--red); }
        .btn-limpar-import:disabled { opacity: 0.5; cursor: default; }
        .import-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; font-size: 12.5px; color: var(--ink-2); }
        .btn-import { display: inline-flex; align-items: center; gap: 6px; background: var(--blue); color: #fff; border: none; border-radius: 8px; padding: 9px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
        .btn-import:hover { filter: brightness(1.08); }
        .import-ok { display: flex; align-items: center; gap: 8px; background: var(--green-bg); color: var(--green); border: 1px solid var(--green); border-radius: 8px; padding: 9px 13px; font-size: 12.5px; margin-bottom: 14px; }
        .import-erro { display: flex; align-items: center; gap: 8px; background: var(--red-bg); color: var(--red); border: 1px solid var(--red); border-radius: 8px; padding: 9px 13px; font-size: 12.5px; margin-bottom: 14px; }
        .vend-list { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .vend-grupo { border-bottom: 1px solid var(--border-soft); }
        .vend-grupo:last-child { border-bottom: none; }
        .vend-head { display: flex; align-items: center; gap: 10px; width: 100%; background: transparent; border: none; text-align: left; padding: 12px 14px; }
        .vend-head:hover { background: var(--panel); }
        .vend-num { font-size: 11.5px; color: var(--ink-3); font-weight: 600; width: 22px; flex-shrink: 0; }
        .vend-nome { font-size: 13px; color: var(--ink); font-weight: 600; flex: 1; min-width: 0; }
        .vend-count { font-size: 11px; color: var(--ink-3); background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 2px 8px; flex-shrink: 0; }
        .vend-val { font-size: 13px; color: var(--ink); width: 130px; text-align: right; flex-shrink: 0; }
        /* No depara, o lugar do valor mostra o que ainda falta conferir
           naquela verba — é a informação que decide se vale abrir. */
        .vend-pend { font-size: 11.5px; font-weight: 600; color: var(--amber); width: 130px; text-align: right; flex-shrink: 0; }
        .vend-pend.ok { color: var(--green); font-weight: 500; }
        /* Verba fora da conferência: aparece apagada, mas aparece — some
           da tela é diferente de dizer que não foi analisada. */
        .vend-pend.na { color: var(--ink-3); font-weight: 600; letter-spacing: 0.04em; }
        .vend-grupo.na { opacity: 0.72; }
        .vend-head.na { cursor: default; }
        .vend-na-motivo { font-size: 11px; color: var(--ink-3); flex: 1; text-align: right; padding-right: 10px; }
        .aviso-pobre { display: flex; align-items: flex-start; gap: 10px; background: var(--amber-bg, #FEF3E2); border: 1px solid var(--amber, #E8B04B); color: var(--amber, #B7791F); border-radius: 10px; padding: 11px 14px; font-size: 12px; margin-bottom: 16px; line-height: 1.5; }
        .aviso-pobre-sub { color: var(--ink-2); font-size: 11.5px; margin-top: 4px; }

        .aviso-deslocamento { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 9px 13px; font-size: 12px; color: var(--ink-2); margin-bottom: 14px; }
        /* fixed vale pra todas: cada verba renderiza a própria tabela, e
           sem isso cada uma calcularia larguras pelo próprio conteúdo —
           as colunas deixavam de alinhar de um grupo pro outro. */
        .vend-itens { width: 100%; border-collapse: collapse; background: #FCFBF8; border-top: 1px solid var(--border-soft); table-layout: fixed; }
        /* Quebra agressiva SÓ onde o texto é longo de verdade.
           Valia pra toda célula — existia pra impedir que uma URL de 357
           caracteres esticasse a tabela — e numa coluna estreita partia
           "Circulação" ao meio, virando "Circulaçã / o". */
        .vend-itens td.col-desc { overflow-wrap: anywhere; word-break: break-word; }
        /* Ambiente e quantidade cabem numa linha; o que não couber vira
           reticências e sai pelo "i", em vez de esticar a linha inteira. */
        .vend-itens td.col-amb { white-space: nowrap; }
        .vend-itens td.col-amb .celula-corte { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .vend-itens td.col-qtd { white-space: nowrap; }
        /* Valor à direita, unidade à esquerda, larguras próprias. */
        .qtd-celula { display: flex; align-items: baseline; justify-content: flex-end; gap: 5px; }
        .qtd-celula .celula-valor, .qtd-celula .celula-input { width: auto; min-width: 40px; flex: 0 1 auto; text-align: right; }
        .qtd-celula .unit { flex: 0 0 24px; text-align: left; }
        /* Marca de palpite: risco na borda, não caixa em volta.
           Como boa parte das linhas vem com a quantidade colada, a caixa
           laranja em cada célula virava uma parede — e parede não sinaliza
           nada, porque não tem contraste com o resto. */
        .vend-itens td.qtd-palpite { background: #FFFBF4; box-shadow: inset 3px 0 0 #F79009; cursor: help; }
        /* A quebra livre acima existe pela especificação gigante, que sem
           ela estica a coluna e desalinha a tabela. Mas ela também
           autoriza partir "1.10" em "1.1" e "0" — código de item não é
           texto corrido, é identificador: quebrado, deixa de identificar. */
        .vend-itens td:first-child, .vend-itens th:first-child,
        .exec-itens td:first-child, .exec-itens th:first-child { white-space: nowrap; overflow-wrap: normal; word-break: normal; }
        .vend-itens th { text-align: left; font-size: 10.5px; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.03em; padding: 8px 12px; border-bottom: 1px solid var(--border-soft); }
        .vend-itens td { padding: 8px 12px; border-bottom: 1px solid var(--border-soft); font-size: 12.5px; color: var(--ink); vertical-align: top; }
        .vend-itens tr:last-child td { border-bottom: none; }
        .vend-total { display: flex; justify-content: space-between; align-items: center; padding: 13px 14px; margin-top: 2px; border-top: 2px solid var(--ink); }
        .flat-table tfoot td { padding: 11px 12px; border-top: 2px solid var(--ink); }
        .total-label { font-weight: 700; }
        .total-value { font-weight: 700; font-size: 13.5px; }
        .exec-group { margin-bottom: 22px; }
        .exec-group-title { font-size: 12.5px; font-weight: 700; margin-bottom: 8px; display: flex; gap: 8px; align-items: baseline; }
        .empty-note { font-size: 12.5px; color: var(--ink-3); padding: 20px 0; text-align: center; }

        /* ---- Módulo Compras → Sienge ---- */
        .compras-buckets { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 18px 0 12px; }
        .bucket { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
        .bucket-falta { background: var(--amber-bg); border-color: var(--amber); }
        .bucket-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--ink-2); }
        .bucket-falta .bucket-label { color: var(--amber); }
        .bucket-num { font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 700; margin-top: 4px; color: var(--ink); }
        .bucket-falta .bucket-num { color: var(--amber); }
        .bucket-num span { font-size: 13px; font-weight: 500; color: var(--ink-3); }
        .bucket-falta .bucket-num span { color: var(--amber); }
        .bucket-sub { font-size: 12px; color: var(--ink-3); margin-top: 2px; }
        .bucket-falta .bucket-sub { color: var(--amber); }
        .compras-alerta { display: flex; align-items: center; gap: 9px; background: var(--red-bg); color: var(--red); border: 1px solid var(--red); border-radius: 12px; padding: 11px 15px; font-size: 12.5px; margin-bottom: 16px; }
        .compras-filtros { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .cfiltro { display: inline-flex; align-items: center; gap: 6px; background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 5px 11px; font-size: 12px; font-weight: 500; color: var(--ink-2); cursor: pointer; }
        .cfiltro:hover { border-color: var(--blue); }
        .cfiltro.active { background: var(--ink); border-color: var(--ink); color: #fff; }
        .cbadge { background: rgba(0,0,0,0.08); border-radius: 10px; padding: 0 6px; font-size: 11px; font-weight: 600; }
        .cfiltro.active .cbadge { background: rgba(255,255,255,0.22); }
        .compras-grupo { margin-bottom: 16px; }
        .compras-grupo-head { display: flex; align-items: center; gap: 8px; padding: 6px 4px; width: 100%; background: transparent; border: none; border-radius: 8px; cursor: pointer; text-align: left; }
        .compras-grupo-head:hover { background: var(--panel); }
        .cg-num { font-size: 11px; color: var(--ink-3); font-weight: 600; }
        .cg-nome { font-size: 13.5px; font-weight: 700; color: var(--ink); }
        .cg-meta { margin-left: auto; font-size: 11px; color: var(--ink-3); }
        .compras-list { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .compras-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-bottom: 1px solid var(--border-soft); }
        .compras-row:last-child { border-bottom: none; }
        .compras-rowwrap { border-bottom: 1px solid var(--border-soft); }
        .compras-rowwrap:last-child { border-bottom: none; }
        .compras-rowwrap .compras-row { border-bottom: none; }
        .sug-toggle { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; background: none; border: none; color: var(--blue); font-size: 11px; font-weight: 600; cursor: pointer; padding: 0; }
        .sug-toggle:hover { text-decoration: underline; }
        .sugestao-sienge { background: var(--panel); border: 1px dashed var(--border); border-radius: 8px; padding: 10px 12px; margin: 0 16px 12px; }
        .sug-title { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); margin-bottom: 8px; }
        .sug-warn { font-weight: 500; color: var(--amber); font-size: 10.5px; }
        .sug-row { display: flex; align-items: center; gap: 10px; }
        .sug-code { flex: 1; min-width: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; color: var(--ink); overflow-x: auto; white-space: nowrap; }
        .sug-copy { display: inline-flex; align-items: center; gap: 5px; background: var(--ink); color: #fff; border: none; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
        .sug-copy:hover { background: var(--blue); }
        .sug-fmt { font-size: 10.5px; color: var(--ink-3); margin-top: 6px; }
        .compras-row-main { flex: 1; min-width: 0; }
        .compras-desc { font-size: 13px; color: var(--ink); line-height: 1.35; }
        .compras-meta { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
        .compras-custo { font-size: 13px; color: var(--ink); width: 86px; text-align: right; flex-shrink: 0; }
        .compras-sg { width: 168px; flex-shrink: 0; }
        .sg-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; padding: 4px 9px; border-radius: 20px; }
        .sg-match { background: var(--green-bg); color: var(--green); }
        .sg-parcial { background: var(--amber-bg); color: var(--amber); }
        .sg-nao { background: var(--red-bg); color: var(--red); }
        .compras-acao { width: 172px; flex-shrink: 0; display: flex; justify-content: flex-end; }
        .proc-tag { border: none; border-radius: 20px; padding: 6px 26px 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; appearance: none; -webkit-appearance: none; background-repeat: no-repeat; background-position: right 9px center; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); }
        .proc-falta { background-color: var(--amber-bg); color: var(--amber); }
        .proc-lancado { background-color: var(--blue-bg); color: var(--blue); }
        .proc-comprado { background-color: var(--green-bg); color: var(--green); }
        .btn-lancar { display: inline-flex; align-items: center; gap: 6px; background: var(--blue); color: #fff; border: none; border-radius: 8px; padding: 8px 13px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .btn-lancar:hover { filter: brightness(1.08); }
        .btn-cadastrar { display: inline-flex; align-items: center; gap: 6px; background: #fff; color: var(--red); border: 1px solid var(--red); border-radius: 8px; padding: 8px 13px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .btn-compra { display: inline-flex; align-items: center; gap: 6px; background: #fff; color: var(--green); border: 1px solid var(--green); border-radius: 8px; padding: 8px 13px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .btn-avancar { display: inline-flex; align-items: center; gap: 6px; background: var(--ink); color: #fff; border: none; border-radius: 8px; padding: 8px 13px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .btn-avancar:hover { background: var(--blue); }
        .contrato-etapa-cell { width: 210px; flex-shrink: 0; }
        .pipeline { display: flex; align-items: stretch; gap: 3px; margin: 18px 0 12px; overflow-x: auto; padding-bottom: 4px; }
        .pipe-node { flex: 1; min-width: 92px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 10px 6px; cursor: pointer; text-align: center; }
        .pipe-node:hover { border-color: var(--ink-3); }
        .pipe-node.active { border-width: 2px; padding: 9px 5px; }
        .pipe-count { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; line-height: 1; }
        .pipe-label { font-size: 10.5px; color: var(--ink-2); margin-top: 4px; font-weight: 600; }
        .pipe-val { font-size: 10px; color: var(--ink-3); margin-top: 2px; }
        .pipe-arrow { align-self: center; flex-shrink: 0; }
        .contratos-toolbar { margin: 4px 0 4px; }
        .btn-nova-solicitacao { display: inline-flex; align-items: center; gap: 6px; background: var(--ink); color: #fff; border: none; border-radius: 8px; padding: 9px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .btn-nova-solicitacao:hover { background: var(--blue); }
        .form-solicitacao { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 4px; max-width: 480px; }
        .form-solicitacao-title { font-size: 13.5px; font-weight: 700; color: var(--ink); margin-bottom: 12px; }
        .form-row { margin-bottom: 12px; }
        .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 10px; }
        .form-label { display: flex; flex-direction: column; gap: 5px; font-size: 11px; font-weight: 600; color: var(--ink-2); }
        .form-input, .form-select { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12.5px; font-family: 'Inter', sans-serif; color: var(--ink); background: #fff; }
        .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        .btn-cancelar { background: none; border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px; font-size: 12.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
        .btn-criar { background: var(--ink); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .btn-criar:hover { background: var(--blue); }
        .compras-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 60px 20px; }
        .compras-empty-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .compras-empty-sub { font-size: 12.5px; color: var(--ink-3); max-width: 440px; }
        /* ---- Vendido: Conferência Contrato × Planilha ---- */
        .conf-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 4px 0 16px; }
        .conf-stat { text-align: left; background: var(--card); border: 1.5px solid var(--border); border-radius: 12px; padding: 13px 15px; cursor: pointer; }
        .conf-stat:hover { border-color: var(--ink-3); }
        .conf-stat.active { border-width: 2px; padding: 12px 14px; }
        .conf-stat-num { font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 700; line-height: 1; }
        .conf-stat-label { font-size: 12.5px; font-weight: 700; color: var(--ink); margin-top: 6px; }
        .conf-stat-sub { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
        .conf-row { padding: 12px 16px; border-bottom: 1px solid var(--border-soft); }
        .conf-row:last-child { border-bottom: none; }
        .conf-row-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .conf-codigo { font-size: 11.5px; }
        .conf-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
        .conf-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .conf-col-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-3); margin-bottom: 3px; }
        .conf-desc { font-size: 12.5px; color: var(--ink); line-height: 1.35; }
        .conf-meta { font-size: 11px; color: var(--ink-3); margin-top: 3px; }
        .conf-vazio { font-size: 12px; color: var(--ink-3); font-style: italic; }
        .conf-acoes { display: flex; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-soft); }
        .btn-editar-linha { display: inline-flex; align-items: center; gap: 5px; background: #fff; border: 1px solid var(--border-strong); border-radius: 7px; padding: 6px 11px; font-size: 11.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
        .btn-editar-linha:hover { border-color: var(--blue); color: var(--blue); }
        .btn-aprovar-linha { display: inline-flex; align-items: center; gap: 5px; background: var(--green); border: none; border-radius: 7px; padding: 6px 11px; font-size: 11.5px; font-weight: 600; color: #fff; cursor: pointer; }
        .btn-aprovar-linha:hover { filter: brightness(1.08); }
        .conf-edit { display: flex; flex-direction: column; gap: 6px; }
        .conf-edit-row { display: flex; gap: 6px; }
        .conf-edit-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 2px; }
        .conf-check { width: 15px; height: 15px; flex-shrink: 0; cursor: pointer; }
        .selecao-massa { display: flex; align-items: center; gap: 10px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 9px 13px; margin-bottom: 12px; }
        .selecao-massa-texto { font-size: 12px; font-weight: 600; color: var(--ink); }
        .conf-motivo { font-size: 11.5px; color: var(--amber); margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-soft); }
        /* Barra de liberação no topo — mesma linguagem visual do painel
           de CMV logo acima, pra ler como uma coisa só. */
        .liberacao-barra { display: flex; align-items: center; gap: 16px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; margin-bottom: 18px; }
        .liberacao-texto { display: flex; align-items: center; gap: 9px; flex: 1; min-width: 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.45; }
        .liberacao-barra .btn-aprovar { flex-shrink: 0; }

        .aprovacao-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-top: 16px; }
        .aprovacao-resumo { font-size: 12.5px; color: var(--ink-2); margin-bottom: 10px; }
        .aprovacao-check { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink); margin-bottom: 12px; cursor: pointer; }
        .btn-aprovar { display: inline-flex; align-items: center; gap: 6px; background: var(--ink); color: #fff; border: none; border-radius: 8px; padding: 10px 16px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
        .btn-aprovar:hover:not(:disabled) { background: var(--green); }
        .btn-aprovar:disabled { opacity: 0.4; cursor: not-allowed; }
        .caderno-card { display: flex; align-items: center; gap: 12px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
        .caderno-lista { display: flex; flex-direction: column; gap: 1px; background: var(--border-soft); }
        .caderno-slot { display: flex; align-items: center; gap: 9px; background: #fff; padding: 8px 18px; font-size: 12px; }
        .caderno-slot-titulo { color: var(--ink); font-weight: 500; }
        .caderno-slot-arquivo { flex: 1; min-width: 0; color: var(--ink-3); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .caderno-slot-vazio { flex: 1; color: var(--ink-3); font-size: 11.5px; font-style: italic; }
        .caderno-acao { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; padding: 2px 4px; font-size: 11px; color: var(--blue); cursor: pointer; font-family: inherit; text-decoration: none; flex-shrink: 0; }
        .caderno-acao:hover { text-decoration: underline; }
        /* Enquanto o arquivo sobe, a ação some do azul: clicar de novo
           não adianta, e nada pior do que um botão que parece pronto. */
        .caderno-acao:disabled { color: var(--ink-3); cursor: default; text-decoration: none; }
        .caderno-erro { font-size: 11px; color: var(--red); }
        .escolha-aba { font-size: 12.5px; color: var(--ink-3); padding: 28px 4px; }

        /* Saldo do Executivo contra o CMV congelado na liberação */
        .saldo-exec { display: flex; align-items: center; gap: 26px; flex-wrap: wrap; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; }
        .saldo-exec.estourou { border-color: var(--red); background: var(--red-bg, #FDEEEC); }
        .saldo-rotulo { font-size: 10px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; }
        .saldo-valor { font-size: 17px; font-weight: 600; color: var(--ink); margin-top: 3px; }
        .saldo-bloco.destaque .saldo-valor { font-size: 19px; }
        .saldo-mov { display: flex; flex-direction: column; gap: 3px; margin-left: auto; }
        .saldo-mov-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--ink-2); }

        /* Item excluído: some do custo, não some da vista */
        /* Fundo cheio só fora do Executivo (Plano de Compras), onde a
           exclusão é rara. No Executivo quem marca é a barra lateral. */
        .linha-excluida { background: var(--red-bg, #FDEEEC); }
        .exec-itens tr.linha-excluida { background: transparent; }
        .linha-excluida td { color: var(--ink-3); text-decoration: line-through; }
        .linha-excluida td:nth-child(2) { text-decoration: none; }
        .tag-excluido { margin-left: 8px; font-size: 9.5px; font-weight: 600; color: var(--red); text-transform: uppercase; letter-spacing: .04em; }
        .btn-linha-excluir { background: none; border: 1px solid transparent; border-radius: 6px; padding: 3px; color: var(--ink-3); cursor: pointer; display: inline-flex; }
        .linha-acoes { display: inline-flex; gap: 2px; align-items: center; }
        .exec-itens td.col-item { display: flex; align-items: center; justify-content: space-between; gap: 4px; height: 44px; }
        .col-item-cod { flex-shrink: 0; }
        /* ESTADO DA LINHA — uma barra na lateral, não a linha inteira pintada.

           Antes cada estado pintava a linha toda: amarelo pra alterado,
           vermelho pra excluído. Como quase toda linha do executivo é
           alterada, metade da tabela ficava amarela — e cor que cobre
           metade da tela deixa de ser aviso, vira papel de parede. Junto
           com as etiquetas repetindo a mesma coisa, sobrava ruído e faltava
           hierarquia.

           Agora a barra diz o estado e o fundo fica limpo. Sobra contraste
           pro que realmente pede ação. */
        .exec-itens tr.linha-alterada > td:nth-child(2) { box-shadow: inset 3px 0 0 #E8B04B; }
        .exec-itens tr.linha-excluida > td:nth-child(2) { box-shadow: inset 3px 0 0 var(--red); }
        .exec-itens tr.linha-excluida > td { color: var(--ink-3); }
        .exec-itens tr.linha-excluida td:nth-child(2) { text-decoration: none; }
        .exec-itens tr.linha-excluida .celula-corte { text-decoration: line-through; }

        /* O PAR DA SUBSTITUIÇÃO lê como um bloco só.

           As duas linhas dividem a mesma barra indigo — a de cima abre o
           par, a de baixo fecha e vem recuada. É a "variação dentro" que a
           Priscila pediu: o olho junta as duas antes de ler qualquer texto. */
        .exec-itens tr.linha-saiu-por-troca > td { background: #FBFAFF; }
        .exec-itens tr.linha-saiu-por-troca > td:nth-child(2) { box-shadow: inset 3px 0 0 #6366F1; }
        .exec-itens tr.linha-substituta > td { background: #F5F4FF; }
        .exec-itens tr.linha-substituta > td:nth-child(2) { box-shadow: inset 3px 0 0 #6366F1; padding-left: 22px; }

        /* Só uma etiqueta continua colorida: a que pede ação. */
        .so-no-hover { opacity: 0; transition: opacity .12s; }
        .exec-itens tr:hover .so-no-hover, .so-no-hover:focus-within { opacity: 1; }
        .col-item-acoes { display: inline-flex; gap: 1px; }

        /* Linha que esta saindo: fica vermelha JA, enquanto a busca esta
           aberta. Antes so mudava depois de escolher o substituto, entao
           durante a escolha nada na tela dizia qual item ia sair. */
        .exec-itens tr.linha-saindo > td { background: var(--red-bg, #FDEEEC); }
        .exec-itens tr.linha-saindo td:nth-child(2) { text-decoration: line-through; color: var(--ink-3); }

        /* A busca aberta dentro da tabela, no lugar em que o item vai nascer. */
        .exec-itens tr.linha-busca > td { background: #EEF2FF; padding: 10px 12px 12px; white-space: normal; position: static; overflow: visible; }
        /* A regra sticky das duas primeiras colunas nao vale nesta linha:
           ela tem uma celula so, que atravessa a tabela inteira. */
        .exec-itens tr.linha-busca > td:nth-child(1) { position: static; left: auto; z-index: auto; }
        .busca-na-linha { display: flex; align-items: flex-start; gap: 8px; padding-left: 22px; }
        .busca-na-linha-campo { flex: 1; min-width: 0; max-width: 640px; }
        .busca-na-linha-titulo { font-size: 11.5px; color: #3730A3; margin-bottom: 6px; }
        .busca-na-linha-titulo b { font-weight: 700; }
        .btn-linha-substituir { background: none; border: 1px solid transparent; border-radius: 6px; padding: 3px; color: var(--ink-3); cursor: pointer; display: inline-flex; }
        .btn-linha-substituir:hover { color: #B54708; border-color: #F79009; background: #FFF4E5; }

        /* O par da substituição: o que saiu aponta pra baixo, o que entrou
           aponta pra ele. Mesma cor nos dois lados, pra o olho juntar as
           duas linhas sem precisar ler. */
        .tag-troca { display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; padding: 1px 6px; border-radius: 4px; margin-left: 7px; white-space: nowrap; background: #EEF2FF; color: #4338CA; }
        /* A linha que entrou fica levemente recuada: lê-se como filha da
           que saiu, que é a "variação dentro" que a Priscila descreveu. */
        /* Discreto até o mouse passar: 32 linhas com um + aceso viram ruído. */
        .exec-itens td.col-item .btn-linha-inserir { opacity: 0; transition: opacity .12s; }
        .exec-itens tr:hover td.col-item .btn-linha-inserir,
        .exec-itens td.col-item .btn-linha-inserir:focus { opacity: 1; }
        .btn-linha-inserir { background: none; border: 1px solid transparent; border-radius: 6px; padding: 3px; color: var(--ink-3); cursor: pointer; display: inline-flex; }
        .btn-linha-inserir:hover { color: var(--blue); border-color: var(--blue); background: var(--blue-bg); }
        .exec-itens td.col-acoes { overflow: visible; }
        .btn-linha-excluir:hover { color: var(--red); border-color: var(--red); }
        .btn-linha-excluir.desfazer:hover { color: var(--green); border-color: var(--green); }
        .liberado-barra { display: flex; align-items: center; gap: 9px; }
        .liberado-barra span { flex: 1; }
        .btn-reabrir-etapa { display: inline-flex; align-items: center; gap: 5px; background: #fff; border: 1px solid var(--border); border-radius: 7px; padding: 4px 10px; font-size: 11px; color: var(--ink-2); cursor: pointer; font-family: inherit; flex-shrink: 0; }
        .btn-reabrir-etapa:hover { border-color: var(--ink-2); color: var(--ink); }

        /* Estouro do CMV: passa, mas com nome e motivo */
        .aprovacao-box.com-estouro { border-color: var(--red); }
        .estouro-aviso { display: flex; align-items: flex-start; gap: 9px; background: var(--red-bg, #FDEEEC); border-radius: 9px; padding: 11px 13px; font-size: 12px; color: var(--red); line-height: 1.5; margin-bottom: 12px; }
        .estouro-campos { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
        .estouro-campos label { display: flex; flex-direction: column; gap: 4px; }
        .estouro-campos span { font-size: 11px; font-weight: 600; color: var(--ink-2); }
        .estouro-campos textarea, .estouro-campos input { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12px; font-family: inherit; color: var(--ink); outline: none; resize: vertical; }
        .estouro-campos textarea:focus, .estouro-campos input:focus { border-color: var(--blue); }
        /* Linha que só nomeia um conjunto (qtd e valor zerados) — some do
           depara, mas continua visível na listagem, marcada. */
        .linha-titulo { background: var(--panel); }
        .linha-titulo td { color: var(--ink-3); }
        .tag-na { margin-left: 8px; font-size: 10px; font-weight: 600; color: var(--ink-3); background: #fff; border: 1px solid var(--border); border-radius: 20px; padding: 1px 7px; white-space: nowrap; }
        /* O Executivo tem 9 colunas — aperta a fonte e deixa rolar na
           horizontal em tela estreita, sem espremer a descrição. */
        /* O Executivo tem 11 colunas e nao cabe na tela. Rola na
           horizontal dentro do proprio grupo, com Item e Descricao
           ancorados na esquerda — sem isso a pessoa rola e perde de vista
           de qual item e o numero que esta olhando. */
        /* max-height é o que faz o cabeçalho grudar.
           O thead já tinha position: sticky; top: 0, mas se ancorava num
           contêiner que nunca rolava verticalmente — na prática não colava
           em nada. Com altura máxima a tabela passa a rolar dentro da caixa
           e o cabeçalho fica à vista, que é o que resolve o "não sei qual
           coluna estou lendo" numa verba com trinta itens. */
        .exec-scroll { overflow: auto; max-height: 70vh; border-top: 1px solid var(--border-soft); }
        /* Zebra e realce da linha sob o cursor: ler a linha inteira sem
           perder a coluna é metade do trabalho numa tabela de 15 colunas. */
        .exec-itens tbody tr:nth-child(even) > td { background: #FAF9F6; }
        .exec-itens tbody tr:hover > td { background: #F0F4FA; }
        .exec-itens tbody tr:focus-within > td { background: #E8F0FB; }
        /* table-layout: fixed é o que mantém as colunas alinhadas entre
           os grupos. Sem ele o navegador dimensiona cada tabela pelo
           conteúdo dela, e como cada verba é uma tabela separada, cada
           uma saía com larguras próprias. Bastava um grupo ter conteúdo
           incomum — em Climatização, uma URL de 200 caracteres sem
           espaço — pra desalinhar tudo naquele grupo. */
        .exec-itens { font-size: 11px; width: 100%; min-width: 1080px; border-top: none; table-layout: fixed; }
        .exec-itens th, .exec-itens td { padding: 6px 7px; }
        /* texto sem espaço (URL, código longo) quebra em vez de esticar */
        /* Número não quebra. A regra antiga valia pra TODA célula, e numa
           coluna de 78px partia "R$ 1.234,56" em duas linhas. tabular-nums
           dá largura fixa a cada dígito, então as colunas de valor alinham
           verticalmente como no Excel. */
        /* overflow: hidden é o que impede a sobreposição.
           Com table-layout: fixed e nowrap, um valor maior que a coluna não
           empurra nada — ele TRANSBORDA e pinta por cima da célula vizinha,
           e os números aparecem embaralhados uns sobre os outros. Cortando
           com reticências o número fica legível ou visivelmente truncado,
           nunca misturado com o do lado. */
        .exec-itens td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; font-variant-numeric: tabular-nums; }
        /* A célula em edição precisa vazar por cima das vizinhas, senão o
           campo fica menor que o número que se está digitando. */
        .exec-itens td:has(.celula-input) { overflow: visible; position: relative; z-index: 5; }
        /* Só a descrição e a especificação quebram — é onde há texto longo. */
        .exec-itens td:nth-child(2), .exec-itens td:nth-child(3),
        .exec-itens td:nth-child(4), .exec-itens td:nth-child(5) { white-space: normal; overflow-wrap: anywhere; word-break: break-word; }

        /* Altura de linha constante: o texto corta em N linhas e o resto
           vai pro painel do "i". Sem isso uma especificação longa fazia
           a linha crescer e a tabela perder o ritmo. */
        /* Toda linha com a MESMA altura: duas linhas de texto cabem, o
           resto vai pro painel do "i". Antes um item de descrição longa
           ocupava cinco linhas e o seguinte uma — a tabela ficava sem
           ritmo e difícil de percorrer com o olho. */
        .exec-itens tbody td { height: 44px; }
        .celula-texto { display: flex; align-items: flex-start; gap: 5px; }
        .celula-corte { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.35; flex: 1; min-width: 0; }
        .btn-info { flex-shrink: 0; width: 15px; height: 15px; border-radius: 50%; border: 1px solid var(--border); background: #fff; color: var(--ink-3); font-size: 9.5px; font-weight: 700; font-family: Georgia, serif; font-style: italic; cursor: pointer; line-height: 1; padding: 0; }
        .btn-info:hover { border-color: var(--blue); color: var(--blue); }

        .detalhe-fundo { position: fixed; inset: 0; background: rgba(20,18,15,0.4); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
        .detalhe-caixa { background: #fff; border-radius: 14px; padding: 18px; width: min(620px, 100%); box-shadow: 0 18px 50px rgba(0,0,0,0.2); }
        .detalhe-topo { display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
        .detalhe-texto { width: 100%; min-height: 140px; border: 1px solid var(--border); border-radius: 9px; padding: 11px 13px; font-size: 12.5px; line-height: 1.55; color: var(--ink); font-family: inherit; resize: vertical; outline: none; }
        .detalhe-acoes { display: flex; justify-content: flex-end; margin-top: 10px; }
        .exec-itens th:nth-child(1), .exec-itens td:nth-child(1) { position: sticky; left: 0; z-index: 2; background: #FCFBF8; }
        /* O deslocamento da 2a coluna congelada TEM que ser a largura exata
           da 1a — e as duas tabelas que usam este CSS tem larguras
           diferentes: 46px na Vendido Planilha, 72px no Executivo (que
           carrega o botao de inserir). Com um valor fixo de 56px, uma sobrava
           10px e deixava o texto passar por baixo, a outra cobria 16px do
           conteudo: era o que cortava as letras de "CODIGO / ESPECIF.". */
        .exec-itens th:nth-child(2), .exec-itens td:nth-child(2) { position: sticky; left: 46px; z-index: 2; background: #FCFBF8; box-shadow: 1px 0 0 var(--border-soft); }
        .exec-editavel th:nth-child(2), .exec-editavel td:nth-child(2) { left: 72px; }
        .exec-itens thead th:nth-child(1), .exec-itens thead th:nth-child(2) { z-index: 4; background: #F7F5F0; }
        /* O cabecalho acompanha a rolagem: editando uma linha la
           embaixo, sem isso nao da pra saber que coluna e qual. */
        .exec-itens thead th { position: sticky; top: 0; z-index: 3; background: #F7F5F0; }
        .celula-corte.editavel { cursor: text; border-radius: 4px; padding: 1px 3px; margin: -1px -3px; }
        .celula-corte.editavel:hover { background: #fff; box-shadow: inset 0 0 0 1px var(--border); }
        .celula-input.texto { text-align: left; font-family: inherit; }
        /* O campo de texto em edição fica com a cara de campo: fundo branco,
           borda azul e altura de linha própria. Antes se confundia com a
           tabela e parecia um retângulo vazio atravessando a linha. */
        .vend-itens .celula-input.texto { padding: 4px 7px; line-height: 1.4; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
        .celula-input.multi { resize: vertical; line-height: 1.35; }
        .fechamento { border-top: 2px solid var(--border); padding: 4px 18px 14px; }
        .fechamento-linha { display: flex; align-items: baseline; justify-content: space-between; padding: 7px 0; font-size: 12.5px; color: var(--ink-2); }
        .fechamento-linha.final { border-top: 1px solid var(--border-soft); margin-top: 3px; padding-top: 11px; font-weight: 600; color: var(--ink); }
        .fechamento-rotulo { flex: 1; }
        .fechamento-valor { font-size: 14px; font-weight: 600; }
        .fechamento-linha.final .fechamento-valor { font-size: 17px; }
        /* Explica o traço no lugar do número. Bloco que some sem dizer
           nada faz a pessoa achar que a funcionalidade nunca existiu. */
        .fechamento-aviso { display: flex; align-items: center; gap: 9px; margin-top: 11px; padding: 10px 12px; background: #FFF4E5; border-radius: 9px; font-size: 12px; line-height: 1.5; color: #7A2E0E; }
        .fechamento-aviso svg { color: #B54708; flex-shrink: 0; }
        .fechamento-aviso span { flex: 1; }
        .fechamento-aviso b { color: #B54708; }
        .fechamento-aviso.recuperado { background: var(--panel); color: var(--ink-2); }
        .fechamento-aviso.recuperado svg, .fechamento-aviso.recuperado b { color: var(--ink-2); }
        .saldo-exec.sem-cmv { border-style: dashed; }
        .saldo-exec.sem-cmv .saldo-valor.dim { font-size: 13px; font-weight: 500; color: var(--ink-3); }

        /* Alerta de conferência técnica: bate em custo e quantidade, mas
           pode não caber no elevador nem casar com a infraestrutura. */
        .conf-row.com-alerta { background: #FFF4E5; box-shadow: inset 3px 0 0 #F79009; }
        .alerta-conf b { color: #D92D20; text-transform: uppercase; font-weight: 700; letter-spacing: 0.01em; }
        .conf-badge.nao-vendido { color: #B42318; background: #FEE4E2; }

        /* Alerta que vale pra verba inteira: aparece UMA vez, no topo do
           grupo. A infraestrutura de climatização da planta é uma só — não
           é uma por aparelho. */
        .grupo-alerta { display: flex; align-items: flex-start; gap: 9px; background: #FFF4E5; box-shadow: inset 3px 0 0 #F79009; padding: 11px 14px; font-size: 12px; line-height: 1.5; color: #7A2E0E; border-bottom: 1px solid var(--border-soft); }
        /* Com mais de um alerta na verba, texto corrido vira parede: cada
           um é uma conferência diferente, com resposta diferente. */
        .grupo-alerta-lista { margin: 4px 0 0; padding-left: 17px; }
        .grupo-alerta-lista li { margin-bottom: 3px; }
        .grupo-alerta svg { color: #B54708; flex-shrink: 0; margin-top: 1px; }
        .grupo-alerta b { color: #B54708; text-transform: uppercase; font-weight: 700; font-size: 11px; letter-spacing: 0.01em; }
        /* Marca a verba com alerta mesmo com o grupo fechado */
        .vend-alerta-mark { display: inline-flex; align-items: center; color: #B54708; flex-shrink: 0; }
        .exec-itens tr.linha-titulo td:nth-child(1), .exec-itens tr.linha-titulo td:nth-child(2) { background: var(--panel); }
        /* Cabecalho de duas linhas ("Codigo / especif. / Obs.") precisa de
           altura pra segunda linha caber inteira, senao ela sai cortada. */
        .exec-itens th { line-height: 1.25; white-space: normal; vertical-align: bottom; padding-top: 8px; padding-bottom: 6px; }
        .exec-itens td.forte { color: var(--ink); font-weight: 600; }
        .exec-total-parcelas { font-size: 11.5px; color: var(--ink-3); margin-right: 14px; }
        /* Colunas de origem: o que veio do criativo e o quanto mudou */
        /* As duas ultimas colunas fazem coisas diferentes e viravam a mesma
           parede de numeros. Agora se distinguem pelo papel:

             Vendido (criativo) — REFERENCIA. Nao se edita, veio do criativo.
               Fundo proprio, texto apagado, separada do bloco editavel por
               uma linha. Esta ali pra ser consultada, nao varrida.

             Diferenca — VEREDITO. E a unica coluna da tabela que muda de
               cor, e por isso e o que o olho acha primeiro ao procurar o
               que precisa de atencao. */
        .exec-itens .col-vendido { background: #F7F6F2; color: var(--ink-3); border-left: 2px solid var(--border); }
        .exec-itens .col-diferenca { background: #F7F6F2; font-weight: 600; }
        .dif-acima  { color: var(--red); }
        .dif-abaixo { color: var(--green); }
        /* Zero e resposta, nao ausencia: fica visivel mas neutro, pra nao
           disputar atencao com quem realmente mudou. */
        .dif-igual  { color: var(--ink-3); font-weight: 500; }
        .vend-delta { font-size: 11px; font-weight: 600; flex-shrink: 0; margin-right: 4px; cursor: help; }
        .vend-base { font-size: 11px; color: var(--ink-3); flex-shrink: 0; margin-right: 8px; cursor: help; font-variant-numeric: tabular-nums; }
        /* Vermelho é do CMV, e o CMV é o total — está no resumo do topo.
           Aqui a cor mede peso: ruído fica apagado, movimento relevante
           chama, e só o desvio grande da verba usa vermelho. */
        .vend-delta.tom-igual { color: var(--ink-3); font-weight: 500; }
        .vend-delta.tom-leve  { color: var(--ink-3); font-weight: 500; }
        .vend-delta.tom-sobra { color: var(--green); }
        .vend-delta.tom-medio { color: #B54708; }
        .vend-delta.tom-alto  { color: var(--red); }

        /* CMV liberado — o teto que sai do depara */
        .cmv-painel { background: var(--panel); border-radius: 14px; padding: 16px 18px; margin-bottom: 18px; }
        .cmv-topo { display: flex; gap: 28px; flex-wrap: wrap; }
        .cmv-bloco { min-width: 150px; }
        .cmv-rotulo { font-size: 10.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; }
        .cmv-provisorio { font-size: 9.5px; background: var(--amber-bg, #FEF3E2); color: var(--amber, #B7791F); border-radius: 20px; padding: 1px 7px; letter-spacing: 0; text-transform: none; font-weight: 600; }
        .cmv-valor { font-size: 22px; font-weight: 600; color: var(--ink); margin-top: 4px; }
        .cmv-sub { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
        .cmv-grupos { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px; }
        .cmv-grupos-titulo { font-size: 10.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .cmv-linha { display: flex; align-items: center; gap: 10px; padding: 3px 0; font-size: 11.5px; }
        .cmv-linha-num { color: var(--ink-3); width: 22px; flex-shrink: 0; }
        .cmv-tag-na { margin-left: 7px; font-size: 9.5px; font-weight: 600; color: var(--ink-3); background: #fff; border: 1px solid var(--border); border-radius: 20px; padding: 1px 6px; white-space: nowrap; }
        .cmv-tag-fora { display: inline-block; margin-left: 7px; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; padding: 1px 6px; border-radius: 4px; background: #FFF4E5; color: #B54708; vertical-align: middle; }
        .cmv-linha-nome { color: var(--ink-2); width: 260px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cmv-linha-barra { flex: 1; height: 6px; background: #fff; border-radius: 20px; overflow: hidden; min-width: 40px; }
        .cmv-linha-barra span { display: block; height: 100%; background: var(--blue); border-radius: 20px; }
        .cmv-linha-valor { width: 110px; text-align: right; color: var(--ink); flex-shrink: 0; }

        /* Cadernos recolhíveis — ocupavam meia tela sempre abertos */
        .cadernos-head { display: flex; align-items: center; gap: 10px; width: 100%; background: transparent; border: none; text-align: left; padding: 16px 18px; cursor: pointer; }
        .cadernos-head-texto { flex: 1; min-width: 0; }
        .cadernos-resumo { font-size: 11.5px; color: var(--ink-3); flex-shrink: 0; }

        /* Célula que vira campo ao clicar */
        .celula-valor { background: transparent; border: 1px solid transparent; border-radius: 5px; padding: 2px 5px; font-size: 11.5px; color: var(--ink); cursor: text; width: 100%; text-align: right; font-family: 'JetBrains Mono', monospace; }
        .celula-valor:hover { border-color: var(--border); background: #fff; }
        .celula-valor.travada { cursor: default; color: var(--ink-3); }
        .celula-valor.travada:hover { border-color: transparent; background: transparent; }
        .celula-input { width: 100%; border: 1px solid var(--blue); border-radius: 5px; padding: 2px 5px; font-size: 11.5px; text-align: right; outline: none; background: #fff; font-family: 'JetBrains Mono', monospace; box-shadow: 0 0 0 2px var(--blue-bg); }
        /* .celula-valor alinhava TUDO à direita, inclusive Qtd. e Un., que
           o <td className="center"> pedia centralizadas — o botão de 100% de
           largura vencia o alinhamento da célula. */
        .celula-valor.centro, .celula-input.centro { text-align: center; }
        .celula-valor.texto { font-family: inherit; }
        .btn-add-item { display: inline-flex; align-items: center; gap: 5px; margin: 4px 0 10px 34px; background: transparent; border: 1px dashed var(--border); border-radius: 7px; padding: 5px 11px; font-size: 11.5px; color: var(--ink-3); cursor: pointer; font-family: inherit; }
        .btn-add-item:hover { color: var(--blue); border-color: var(--blue); }

        /* Escolher o insumo no banco em vez de digitar do zero */
        .busca-insumo { margin: 6px 0 12px 34px; max-width: 720px; background: #fff; border: 1px solid var(--blue); border-radius: 10px; overflow: hidden; }
        .busca-insumo-topo { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--border-soft); }
        .busca-insumo-topo input { flex: 1; border: none; outline: none; background: transparent; font-size: 12px; color: var(--ink); font-family: inherit; }
        .busca-insumo-vazio { font-size: 11.5px; color: var(--ink-3); padding: 10px 12px; }
        .busca-insumo-linha { display: flex; align-items: baseline; gap: 9px; width: 100%; background: none; border: none; border-bottom: 1px solid var(--border-soft); padding: 7px 12px; text-align: left; cursor: pointer; font-family: inherit; }
        .busca-insumo-linha:last-child { border-bottom: none; }
        .busca-insumo-linha:hover { background: var(--panel); }
        .busca-insumo-cod { font-size: 10.5px; color: var(--ink-3); width: 46px; flex-shrink: 0; }
        .busca-insumo-desc { flex: 1; min-width: 0; font-size: 11.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .busca-insumo-preco { font-size: 12px; font-weight: 600; color: var(--ink); flex-shrink: 0; }
        .busca-insumo-un { font-size: 10px; color: var(--ink-3); flex-shrink: 0; }

        /* Mesmo amarelo que a planilha usa na mão pra marcar o que o
           executivo mexeu — só que agora o sistema marca sozinho. */
        .tag-alterado { margin-left: 8px; font-size: 10px; font-weight: 600; color: #8A6D1F; background: #fff; border: 1px solid #E8D08B; border-radius: 20px; padding: 1px 7px; white-space: nowrap; }
        .tag-preco { display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; font-size: 10px; font-weight: 600; color: var(--red); background: #fff; border: 1px solid var(--red); border-radius: 20px; padding: 1px 7px; white-space: nowrap; }

        /* Preços de referência do Sienge — evidência pra decidir, não
           preenchimento automático. */
        .btn-sugestao { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; background: none; border: none; padding: 0; font-size: 10.5px; color: var(--blue); cursor: pointer; text-decoration: underline; font-family: inherit; }
        .sugestoes { margin-top: 8px; background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px; max-width: 560px; }
        .sugestoes-titulo { display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
        .sugestoes-vazio { font-size: 11px; color: var(--ink-3); padding: 4px 2px; }
        .sugestao-linha { display: flex; align-items: baseline; gap: 8px; width: 100%; background: none; border: none; border-radius: 6px; padding: 5px 6px; text-align: left; cursor: pointer; font-family: inherit; }
        .sugestao-linha:hover { background: var(--panel); }
        .sugestao-preco { font-size: 12px; font-weight: 600; color: var(--ink); flex-shrink: 0; }
        .sugestao-un { font-size: 10px; color: var(--ink-3); flex-shrink: 0; }
        .sugestao-desc { flex: 1; min-width: 0; font-size: 11px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sugestao-data { font-size: 10px; color: var(--ink-3); flex-shrink: 0; }

        /* Trava de edição — uma obra por vez, uma pessoa por vez */

        .caderno-info { flex: 1; min-width: 0; }
        .caderno-nome { font-size: 13px; font-weight: 600; color: var(--ink); }
        .caderno-meta { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
        .tab .dim { margin-left: 2px; vertical-align: -1px; }
        /* ---- Módulo A Contratar ---- */
        .cad-abrir { margin-bottom: 16px; }
        .cad-box { border: 1px solid var(--border); border-radius: 12px; background: #fff; padding: 14px 16px; margin-bottom: 18px; }
        .cad-h { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 11px; }
        .cad-campos { display: grid; grid-template-columns: 1fr 140px 170px; gap: 10px; }
        .cad-campos label { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); }
        .cad-campos .form-input { margin-top: 3px; width: 100%; font-size: 13px; }
        .cad-largo { grid-column: auto; }
        .cad-erro { display: block; font-size: 10.5px; color: var(--red); font-weight: 600; text-transform: none; letter-spacing: 0; margin-top: 3px; }
        .cad-erro-larga { margin-top: 9px; }
        .cad-acoes { display: flex; align-items: center; gap: 12px; margin-top: 13px; flex-wrap: wrap; }
        .cad-nota { font-size: 11px; color: var(--ink-3); }
        @media (max-width: 760px) { .cad-campos { grid-template-columns: 1fr; } }
        .ac-painel { border: 1px solid var(--blue); border-radius: 12px; background: var(--blue-bg); padding: 15px 17px; margin: 4px 0 12px; }
        .ac-bloco-t { font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 12px; }
        .ac-sub { display: flex; align-items: center; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--ink-3); margin: 16px 0 7px; }
        .ac-link { background: none; border: none; font-family: inherit; font-size: 10.5px; font-weight: 600; color: var(--blue); cursor: pointer; text-transform: none; letter-spacing: 0; padding: 0; }
        .ac-nota { font-size: 10.5px; color: var(--ink-3); line-height: 1.45; margin-top: 2px; }
        .ac-nota-forte { color: #7A4E00; background: var(--amber-bg); border-radius: 6px; padding: 5px 8px; margin-bottom: 7px; }
        .ac-admin { display: flex; align-items: flex-start; gap: 9px; background: #fff; border: 1px solid var(--border); border-radius: 9px; padding: 10px 12px; cursor: pointer; font-size: 12.5px; }
        .ac-desligado { opacity: .4; pointer-events: none; }
        .ac-modulos { display: flex; flex-wrap: wrap; gap: 6px; }
        .ac-chip { display: inline-flex; align-items: center; gap: 5px; background: #fff; border: 1px solid var(--border); border-radius: 20px; padding: 5px 11px; font-size: 11.5px; color: var(--ink-2); cursor: pointer; }
        .ac-chip.on { border-color: var(--blue); color: var(--blue); font-weight: 600; }
        .ac-chip input { margin: 0; }
        .ac-regras { display: flex; flex-direction: column; gap: 6px; }
        .ac-regra { display: flex; align-items: flex-start; gap: 9px; background: #fff; border: 1px solid var(--border); border-radius: 9px; padding: 9px 12px; cursor: pointer; font-size: 12.5px; }
        .ac-regra.on { border-color: var(--blue); box-shadow: inset 0 0 0 1px var(--blue); }
        .ac-lista { background: #fff; border: 1px solid var(--border); border-radius: 9px; padding: 10px; margin-top: 9px; }
        .ac-lista-topo { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }
        .ac-lista-topo .form-input { margin-top: 0; flex: 1; font-size: 12px; }
        .ac-lista-itens { max-height: 220px; overflow-y: auto; }
        .ac-obra { display: flex; align-items: center; gap: 8px; padding: 5px 4px; border-radius: 6px; font-size: 12px; cursor: pointer; }
        .ac-obra:hover { background: var(--panel); }
        .ac-obra.on { background: var(--blue-bg); }
        .ac-obra-nome { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ac-obra-squad { font-size: 10px; color: var(--ink-3); white-space: nowrap; }
        .eq-fila .arq-bloco-h { border-bottom-color: var(--amber); }
        .eq-fila .arq-bloco-tit { color: #7A4E00; }
        .eq-fila .arq-linha { background: var(--amber-bg); }
        .nav-badge-espera { background: var(--amber); }
        .nav-tira-badge.espera { background: var(--amber); }
        .eq-form .eq-campos { grid-template-columns: 1fr 1fr 170px; }
        .eq-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--blue-bg); color: var(--blue); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .eq-inativo { opacity: .55; }
        .cargo-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
        .cargo-chip { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 4px 11px; font-family: inherit; font-size: 11px; font-weight: 500; color: var(--ink-2); cursor: pointer; }
        .cargo-chip:hover { border-color: var(--blue); color: var(--ink); }
        .cargo-chip.on { background: var(--ink); border-color: var(--ink); color: #fff; font-weight: 600; }
        .eq-migracao { display: flex; gap: 10px; align-items: flex-start; background: #FFFBEB; border: 1px solid #FDE68A; color: #78350F; border-radius: 10px; padding: 12px 14px; font-size: 12.5px; line-height: 1.55; margin-bottom: 14px; }
        .eq-migracao code { background: #FEF3C7; padding: 1px 5px; border-radius: 4px; font-size: 11.5px; }
        .eq-tag-inativo { margin-left: 7px; background: var(--panel); color: var(--ink-3); border-radius: 20px; padding: 1px 7px; font-size: 9.5px; font-weight: 700; }
        .eq-obras { font-size: 11px; color: var(--ink-3); white-space: nowrap; flex-shrink: 0; }
        /* ---- Arquivos da obra ---- */
        .arq-topo { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin: 18px 0 16px; }
        .arq-topo-n { font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 700; color: var(--ink); line-height: 1; }
        .arq-topo-rot { font-size: 12px; color: var(--ink-3); margin-top: 3px; }
        .arq-subir { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .arq-subir .form-input { margin-top: 0; font-size: 12.5px; }
        .arq-subir input.form-input { width: 220px; }
        .arq-subir select.form-input { width: 170px; }
        .arq-bloco { margin-bottom: 20px; }
        .arq-bloco-h { display: flex; align-items: center; gap: 8px; padding: 7px 2px; border-bottom: 2px solid var(--ink); margin-bottom: 4px; }
        .arq-bloco-tit { font-size: 13px; font-weight: 700; color: var(--ink); }
        .arq-bloco-n { background: var(--panel); color: var(--ink-2); border-radius: 20px; padding: 1px 8px; font-size: 10.5px; font-weight: 700; }
        .arq-linha { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-bottom: 1px solid var(--border-soft); }
        .arq-linha:hover { background: #FCFBF9; }
        .arq-id { flex: 1; min-width: 0; }
        .arq-titulo { font-size: 13px; font-weight: 600; color: var(--ink); }
        .arq-sub { font-size: 10.5px; color: var(--ink-3); margin-top: 2px; }
        .arq-erro { font-size: 11px; color: var(--red); margin-top: 3px; }
        .arq-fase { font-size: 9.5px; font-weight: 700; border-radius: 20px; padding: 2px 9px; white-space: nowrap; flex-shrink: 0; }
        .arq-acoes { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
        .arq-perdido { font-size: 11px; color: var(--ink-3); font-style: italic; flex-shrink: 0; }
        /* ---- Painel da Mehoo ---- */
        .mh-filtro { margin: 18px 0 14px; }
        .mh-obra { border: 1px solid var(--border); border-radius: 12px; background: #fff; margin-bottom: 12px; overflow: hidden; }
        .mh-obra-head { display: flex; align-items: center; gap: 16px; width: 100%; text-align: left; background: none; border: none; font-family: inherit; padding: 13px 16px; cursor: pointer; }
        .mh-obra-head:hover { background: #FCFBF9; }
        .mh-obra-id { flex: 1; min-width: 0; }
        .mh-obra-nome { font-size: 13.5px; font-weight: 600; color: var(--ink); }
        .mh-obra-sub { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; font-size: 11px; color: var(--ink-3); margin-top: 3px; }
        .mh-squad { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: var(--ink-2); }
        .mh-obra-end { font-size: 11px; color: var(--ink-3); }
        .mh-rot { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
        .mh-entrega, .mh-num { flex-shrink: 0; text-align: right; }
        .mh-num-larga { width: 130px; }
        .mh-entrega-val, .mh-num-val { font-size: 13px; font-weight: 700; color: var(--ink); margin-top: 2px; }
        .mh-entrega-val.venceu { color: var(--red); }
        .mh-dias { display: block; font-size: 10px; font-weight: 400; color: var(--ink-3); }
        .mh-sem { font-size: 11px; color: var(--ink-3); font-style: italic; margin-top: 3px; }
        .mh-num .gc-track { margin-top: 4px; }
        .mh-corpo { border-top: 1px solid var(--border-soft); padding: 14px 16px; background: var(--panel); }
        .mh-sub { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 6px; }
        .mh-cadernos { margin-bottom: 14px; }
        .mh-caderno { display: flex; align-items: center; gap: 9px; padding: 6px 10px; background: #fff; border: 1px solid var(--border-soft); border-radius: 8px; margin-bottom: 5px; font-size: 12px; }
        .mh-caderno-tit { font-weight: 600; color: var(--ink); width: 210px; flex-shrink: 0; }
        .mh-caderno-arq { flex: 1; font-size: 11px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mh-caderno-vazio { flex: 1; font-size: 11px; color: var(--ink-3); font-style: italic; }
        .mh-tabela { background: #fff; border-radius: 8px; border: 1px solid var(--border-soft); }
        .mh-item-sub { font-size: 10.5px; color: var(--ink-3); margin-top: 2px; }
        .mh-perto { color: var(--amber); font-weight: 600; }
        @media (max-width: 900px) { .mh-obra-head { flex-wrap: wrap; gap: 10px; } }
        /* ---- Tela de inicio ---- */
        /* ---- Cabecalho do Inicio: a regua ----
           Os numeros nao sao cartao. Cartao aqui em cima competia com os
           cartoes de "Pedindo atencao" logo abaixo, e quatro caixas
           brancas iguais nao dizem qual delas pede acao. Entre duas
           linhas e separados por filete, eles viram referencia — que e'
           o que sao. */
        .ini-topo { margin: 6px 0 18px; }
        .ini-nome-linha { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
        .ini-nome { font-size: 26px; font-weight: 700; color: var(--ink); line-height: 1.2; }
        .ini-data { font-size: 11px; color: var(--ink-3); }
        .ini-recado { font-size: 16px; color: var(--ink-2); line-height: 1.45; max-width: 720px; margin-top: 5px; }
        .ini-regua { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
        .ini-cel { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--border-soft); border-radius: 12px; background: #fff; text-align: left; font-family: inherit; box-shadow: 0 1px 2px rgba(20,20,20,.04); transition: box-shadow .15s ease, border-color .15s ease; }
        .ini-cel.clicavel { cursor: pointer; }
        .ini-cel.clicavel:hover { border-color: var(--border); box-shadow: 0 4px 10px rgba(20,20,20,.07); }
        .ini-cel.clicavel:hover .ini-cel-val { color: var(--blue); }
        .ini-cel-icone { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; }
        .ini-cel-corpo { min-width: 0; }
        .ini-cel-rot { font-size: 9px; font-weight: 800; letter-spacing: .08em; color: var(--ink-3); }
        .ini-cel-val { font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 700; color: var(--ink); line-height: 1.15; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ini-cel-sub { font-size: 10px; color: var(--ink-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media (max-width: 900px) { .ini-regua { grid-template-columns: repeat(2, 1fr); } }
        .ini-colunas { display: grid; grid-template-columns: 1.15fr 1fr; gap: 22px; align-items: start; }
        .ini-titulo { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--ink); padding-bottom: 10px; border-bottom: 1px solid var(--border); margin-bottom: 10px; }
        .ini-titulo-icone { color: var(--ink-3); flex-shrink: 0; }
        .ini-conta { background: var(--panel); color: var(--ink-2); border-radius: 20px; padding: 1px 8px; font-size: 10.5px; }
        .ini-alerta { display: flex; align-items: flex-start; gap: 9px; width: 100%; text-align: left; font-family: inherit; border: 1px solid var(--border-soft); border-radius: 10px; background: #fff; padding: 8px 12px; margin-bottom: 6px; font-size: 12px; color: var(--ink-2); line-height: 1.4; cursor: pointer; box-shadow: 0 1px 2px rgba(20,20,20,.03); transition: box-shadow .15s ease, border-color .15s ease; }
        .ini-alerta:hover { border-color: var(--ink-3); box-shadow: 0 3px 8px rgba(20,20,20,.06); }
        .ini-alerta span { flex: 1; }
        .ini-alerta.ruim { background: var(--red-bg); border-color: #F0CFCB; color: #8A2E22; }
        .ini-alerta.aviso { background: var(--amber-bg); border-color: #E8CE9A; color: #7A4E00; }
        .ini-seta { flex-shrink: 0; opacity: .5; margin-top: 2px; }
        .ini-obra { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; font-family: inherit; background: #fff; border: 1px solid var(--border-soft); border-radius: 10px; padding: 10px 12px; margin-bottom: 6px; cursor: pointer; box-shadow: 0 1px 2px rgba(20,20,20,.03); transition: box-shadow .15s ease, border-color .15s ease; }
        .ini-obra:hover { border-color: var(--ink-3); box-shadow: 0 3px 8px rgba(20,20,20,.06); }
        .ini-obra-id { flex: 1; min-width: 0; }
        .ini-obra-nome { font-size: 12.5px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ini-obra-sub { font-size: 10.5px; color: var(--ink-3); margin-top: 2px; }
        .ini-obra-resumo { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; text-align: right; }
        .ini-obra-gc { font-size: 9.5px; color: var(--ink-3); }
        .ini-obra-pct { font-size: 11.5px; font-weight: 600; color: var(--ink); }
        .ini-obra-vazia { font-size: 10.5px; color: var(--ink-3); font-style: italic; flex-shrink: 0; }
        /* A esteira: um chip por passo, com o NOME escrito — bolinha
           sozinha nao distinguia "feito" de "faltando" com clareza. */
        .ini-esteira { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .ini-passo-chip { display: inline-flex; align-items: center; gap: 1px; font-size: 9.5px; font-weight: 600; color: var(--ink-3); background: var(--panel); border: 1px solid var(--border); border-radius: 999px; padding: 2px 7px; }
        .ini-passo-chip.on { color: #1B7A43; background: #E7F5EC; border-color: #BFE3CC; }
        .ini-passo-chip.atrasado { color: var(--red); background: var(--red-bg); border-color: #F0CFCB; }
        .loc-bloco { margin-top: 24px; }
        .loc-legenda { margin-left: auto; display: flex; gap: 12px; }
        .loc-legenda-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--ink-3); font-weight: 500; }
        .loc-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .loc-dot.ativa, .loc-conta.ativa { background: #1B7A43; }
        .loc-dot.finalizada, .loc-conta.finalizada { background: var(--ink-3); }
        .loc-obra-chip.ativa { color: #1B7A43; background: #E7F5EC; }
        .loc-estados { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 4px; }
        .loc-cidades { margin-top: 6px; }
        .loc-cidade { border-bottom: 1px solid var(--border-soft); }
        .loc-cidade:last-child { border-bottom: none; }
        .loc-cidade-head { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 4px; background: none; border: none; font: inherit; text-align: left; cursor: pointer; }
        .loc-cidade-head:hover { background: var(--panel); }
        .loc-cidade-nome { flex: 1; font-size: 13px; color: var(--ink); font-weight: 600; }
        .loc-cidade-conta { display: flex; gap: 6px; }
        .loc-conta { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #fff; }
        .loc-obras { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 4px 12px 24px; }
        .loc-obra-chip { display: inline-flex; align-items: center; gap: 3px; font: inherit; font-size: 11px; font-weight: 600; border: none; border-radius: 999px; padding: 3px 10px; cursor: pointer; }
        .loc-obra-chip:hover { filter: brightness(0.95); }
        .loc-obra-chip.finalizada { color: var(--ink-2); background: var(--panel); }
        /* A frase diz o que falta AGORA — a esteira mostra o caminho
           inteiro, a frase poupa de reler os chips pra saber o motivo. */
        .ini-fase-pilula { display: inline-block; margin-top: 5px; font-size: 10.5px; font-weight: 600; color: var(--ink-2); background: var(--panel); border-radius: 6px; padding: 2px 8px; }
        .ini-fase-pilula.azul { color: #1D5FB8; background: var(--blue-bg); }
        .ini-fase-pilula.roxo { color: var(--purple); background: #F1EBFA; }
        .ini-titulo-linha { justify-content: space-between; }
        .ini-titulo-esq { display: inline-flex; align-items: center; gap: 8px; }
        .ini-link-finalizadas { display: inline-flex; align-items: center; gap: 2px; background: none; border: none; font-family: inherit; font-size: 11.5px; font-weight: 600; color: var(--ink-3); cursor: pointer; padding: 2px 0; }
        .ini-link-finalizadas:hover { color: var(--ink); }
        @media (max-width: 1100px) { .ini-numeros { grid-template-columns: repeat(2, 1fr); } .ini-colunas { grid-template-columns: 1fr; } }
        /* ---- Painel geral de compras e contratacoes ---- */
        .gc-topo { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin: 18px 0 16px; }
        .gc-horizonte { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .gc-horizonte-rot { font-size: 12px; font-weight: 600; color: var(--ink-2); margin-right: 4px; }
        .gc-chip { border: 1px solid var(--border); background: #fff; color: var(--ink-2); border-radius: 20px; padding: 5px 13px; font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer; }
        .gc-chip:hover { border-color: var(--ink-3); }
        .gc-chip.on { background: var(--ink); border-color: var(--ink); color: #fff; }
        .gc-topo-info { font-size: 12px; color: var(--ink-3); }
        .gc-topo-alerta { color: var(--red); }

        .fo-caixa { position: relative; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .fo-btn { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--border); background: #fff; color: var(--ink-2); border-radius: 20px; padding: 5px 11px; font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer; }
        .fo-btn:hover { border-color: var(--ink-3); }
        .fo-btn.on { background: var(--ink); border-color: var(--ink); color: #fff; }
        .fo-rot { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fo-menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; width: 330px; background: #fff; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.13); padding: 10px; }
        .fo-busca { margin-top: 0; width: 100%; font-size: 12.5px; }
        .fo-acoes { display: flex; gap: 8px; margin: 8px 0 6px; }
        .fo-acoes button { background: none; border: none; font-family: inherit; font-size: 11px; font-weight: 600; color: var(--blue); cursor: pointer; padding: 0; }
        .fo-acoes button:disabled { color: var(--ink-3); cursor: default; }
        .fo-lista { max-height: 260px; overflow-y: auto; margin: 0 -4px; }
        .fo-item { display: flex; align-items: center; gap: 7px; width: 100%; text-align: left; background: none; border: none; border-radius: 6px; padding: 5px 6px; font-family: inherit; font-size: 12px; color: var(--ink); cursor: pointer; }
        .fo-item:hover { background: var(--panel); }
        .fo-item.on { background: var(--blue-bg); }
        .fo-check { width: 14px; height: 14px; border: 1.5px solid var(--ink-3); border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; }
        .fo-item.on .fo-check { background: var(--blue); border-color: var(--blue); }
        .fo-nome { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fo-marcadas { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .fo-tag { display: inline-flex; align-items: center; gap: 4px; background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 3px 8px; font-size: 11px; color: var(--ink-2); font-family: inherit; cursor: pointer; }
        .fo-tag:hover { border-color: var(--red); color: var(--red); }
        .fo-limpar { background: none; border: none; font-family: inherit; font-size: 11.5px; font-weight: 600; color: var(--blue); cursor: pointer; }
        .gc-obras-filtro { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: -6px 0 20px; }
        .gc-obras-filtro .gc-chip { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gc-obras-filtro .gc-chip .mono { opacity: .6; margin-right: 3px; }
        .gc-totais { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
        .gc-total { border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; background: #fff; }
        .gc-total-rot { font-size: 10px; font-weight: 800; letter-spacing: .07em; }
        .gc-total-val { font-size: 27px; font-weight: 700; color: var(--ink); line-height: 1.2; margin-top: 6px; }
        .gc-total-sub { font-size: 11.5px; color: var(--ink-3); margin-bottom: 12px; }
        .gc-total-pe { font-size: 11px; color: var(--ink-3); margin-top: 7px; }

        .gc-track { height: 8px; background: var(--panel); border-radius: 20px; overflow: hidden; min-width: 40px; }
        .gc-fill { height: 100%; border-radius: 20px; }

        .gc-bloco { margin-bottom: 24px; }
        .gc-bloco-head { display: flex; align-items: center; gap: 8px; padding: 8px 2px; border-bottom: 2px solid var(--ink); margin-bottom: 4px; }
        .gc-bloco-titulo { font-size: 14px; font-weight: 700; color: var(--ink); }
        .gc-abas { display: flex; gap: 3px; background: var(--panel); border-radius: 8px; padding: 2px; }
        .gc-aba { border: none; background: none; font: inherit; font-size: 11.5px; font-weight: 600; color: var(--ink-3); padding: 4px 10px; border-radius: 6px; cursor: pointer; }
        .gc-aba.on { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
        .gc-bloco-total { margin-left: auto; font-size: 15px; font-weight: 700; }
        .gc-verba { border-bottom: 1px solid var(--border-soft); }
        .gc-verba:last-child { border-bottom: none; }
        .gc-row { display: flex; align-items: center; gap: 12px; padding: 11px 4px; width: 100%; }
        .gc-row-clic { background: none; border: none; font: inherit; text-align: left; cursor: pointer; }
        .gc-row-clic:hover { background: var(--panel); }
        .gc-chevron { color: var(--ink-3); flex-shrink: 0; transition: transform .12s ease; }
        .gc-chevron.aberto { transform: rotate(90deg); }
        .gc-num { font-size: 11px; color: var(--ink-3); font-weight: 600; width: 22px; flex-shrink: 0; }
        .gc-nome { font-size: 13px; color: var(--ink); font-weight: 600; width: 230px; flex-shrink: 0; }
        .gc-obras { font-size: 11px; color: var(--ink-3); width: 68px; flex-shrink: 0; }
        .gc-row .gc-track { flex: 1; }
        .gc-qtd { font-size: 11.5px; width: 92px; text-align: right; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gc-val { font-size: 13px; color: var(--ink); width: 106px; text-align: right; flex-shrink: 0; }
        .gc-verba-obras { display: flex; flex-direction: column; gap: 2px; padding: 0 4px 10px 29px; }
        .gc-verba-obra { display: flex; align-items: center; gap: 8px; background: none; border: none; font: inherit; font-size: 12px; color: var(--ink-2); text-align: left; padding: 5px 8px; border-radius: 6px; cursor: pointer; }
        .gc-verba-obra:hover:not(:disabled) { background: var(--panel); color: var(--ink); }
        .gc-verba-obra:disabled { cursor: default; }
        .gc-verba-obra-nome { flex: 1; }
        .gc-verba-obra-qtd { font-size: 11px; width: 92px; text-align: right; flex-shrink: 0; }
        .gc-busca { display: flex; align-items: center; gap: 7px; margin: 8px 2px 12px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); }
        .gc-busca input { flex: 1; border: none; background: none; font: inherit; font-size: 13px; color: var(--ink); outline: none; }
        .gc-busca-limpar { display: flex; padding: 2px; background: none; border: none; color: var(--ink-3); cursor: pointer; }
        .gc-busca-limpar:hover { color: var(--ink); }

        .gc-tabela table { table-layout: fixed; }
        .gc-tabela td { vertical-align: middle; }
        .gc-obra-nome { background: none; border: none; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--ink); text-align: left; cursor: pointer; padding: 0; }
        .gc-obra-nome:hover { color: var(--blue); text-decoration: underline; }
        .gc-obra.atrasada { background: var(--red-bg); }
        .gc-dias { display: block; font-size: 10px; color: var(--ink-3); }
        .gc-venceu { color: var(--red); font-weight: 600; }
        .gc-sem-data { font-size: 11px; color: var(--ink-3); font-style: italic; }
        .gc-cel-barra { display: flex; align-items: center; gap: 8px; }
        .gc-cel-txt { font-size: 11.5px; color: var(--ink-2); white-space: nowrap; }
        .gc-selo { display: inline-flex; align-items: center; gap: 4px; border: none; border-radius: 20px; padding: 3px 9px; font-size: 10.5px; font-weight: 700; font-family: inherit; cursor: pointer; }
        .gc-selo.atraso { background: var(--red-bg); color: var(--red); }
        .gc-selo.perto { background: var(--amber-bg); color: var(--amber); }
        .gc-detalhe td { background: var(--panel); padding: 8px 12px; }
        .gc-prazo { display: flex; align-items: center; gap: 10px; padding: 5px 0; font-size: 11.5px; }
        .gc-prazo-nome { font-weight: 600; color: var(--ink); width: 190px; }
        .gc-prazo-quando { flex: 1; color: var(--ink-2); }
        .gc-prazo.atraso .gc-prazo-quando { color: var(--red); }
        .gc-prazo-val { color: var(--ink); font-weight: 600; }
        .gc-nota-semdata { display: flex; align-items: flex-start; gap: 8px; background: var(--amber-bg); color: #7A4E00; border-radius: 8px; padding: 10px 13px; font-size: 12px; margin-bottom: 22px; }

        @media (max-width: 900px) { .gc-totais { grid-template-columns: 1fr; } }
      `}</style>

      <TopBar onInicio={() => setModulo("inicio")} />
      <div className="body-layout">
        <Sidebar obras={obrasAtivas} selected={selectedId} modulo={modulo} onModulo={setModulo} usuario={usuario}
          equipe={pessoas} onSair={sairDaConta} modulos={modulosVisiveis} pendentesCount={nPendentes}
          novasCount={obrasNovas.length} arquivoCount={obrasConcluidas.length}
          onSelect={(id) => { setSelectedId(id); setItemFilter("todos"); setTipoFilter("todos"); setTab(null); setModulo("comparativo"); }} />

        {/* As abas de planilha usam a tela inteira: são 13 colunas e não
            cabem na largura de leitura que serve pro resto do app. */}
        <main className={`main ${["executivo", "vendido_planilha", "vendido_contrato"].includes(tab) ? "larga" : ""}`}>
          {/* O portao de perfil esta DESLIGADO ate a coluna existir. Dizer
          isso e' o que impede a janela virar um estado permanente que
          ninguem lembra de fechar. */}
      {migracaoPendente && (
        <div className="aviso-monday">
          <b>Falta rodar supabase/perfis.sql.</b> Até lá o controle de acesso por perfil
          fica desligado e todo mundo continua vendo tudo — como era antes.
        </div>
      )}
      {avisoMonday && <div className="aviso-monday">{avisoMonday}</div>}
          {erroBanco && <div className="aviso-monday">{erroBanco}</div>}
          {migracao && (
            <div className="aviso-migracao">
              <AlertTriangle size={14} />
              <span>{migracao}</span>
              <button className="aviso-x" onClick={() => setMigracao(null)} aria-label="Fechar aviso"><X size={13} /></button>
            </div>
          )}
          {modulo === "inicio" ? (
          <>
          {/* Sem titulo aqui. "GESTAO DE OBRAS TKWS" ja esta no topo da
              pagina, "Inicio" ja esta marcado no menu, e a linha de baixo
              descrevia o que a propria tela mostra logo abaixo. Tres
              linhas pra dizer onde a pessoa esta quando ela ja sabe —
              elas empurravam pra baixo o unico conteudo que importa. */}
          <InicioView obras={obrasDoPainel} novas={obrasNovas} carregando={painelCarregando}
            usuario={usuario} equipe={pessoas} nPendentes={nPendentes}
            dadosLocalizacao={dadosLocalizacao} localizacaoCarregando={siengeCarregando}
            onToggleLocalizacao={alternarStatusLocalizacao}
            onAbrirObra={(id) => { setSelectedId(id); setModulo("comparativo"); setGrupo("dashboard"); setTab(null); }}
            onModulo={setModulo} />
          </>
          ) : modulo === "novas" ? (
          <>
          <div className="eyebrow">DO MONDAY · {obrasNovas.length}</div>
          <div className="title-row"><span className="title-accent">Novas obras</span></div>
          <div className="obra-meta">Obras que ainda não foram iniciadas aqui</div>
          <NovasObrasView obras={obrasNovas} onStart={darStart} onCriarManual={criarObraManual}
            salvando={salvandoObra} semBanco={!supabaseConfigurado}
            codigosUsados={new Set(obras.map((o) => String(o.codigo)))} usuario={usuario} equipe={pessoas} />
          </>
          ) : modulo === "arquivo" ? (
          <>
          <div className="eyebrow">CONCLUÍDAS · {obrasConcluidas.length}</div>
          <div className="title-row"><span className="title-accent">Arquivo</span></div>
          <div className="obra-meta">Obras encerradas, mantidas para consulta</div>
          <ArquivoView obras={obrasConcluidas} onReabrir={marcarAtiva} salvando={salvandoObra} />
          </>
          ) : modulo === "gerador" ? (
          <>
          <div className="eyebrow">FERRAMENTA AVULSA</div>
          <div className="title-row"><span className="title-accent">Gerador de códigos Sienge</span></div>
          <div className="sg-sub">Detalhes de Insumos</div>

          {/* Tres colunas, nao tres paragrafos empilhados: o texto e'
              curto e a tela e' larga: empilhar desperdiça a largura e
              faz parecer mais texto do que e'. */}
          <div className="sg-escopo">
            <p>
              Gera e associa <b>detalhes</b> de insumos no Sienge. Não cria insumos novos.
            </p>
            <div className="sg-passos">
              <div><b>Associa</b> cada produto a um insumo que já existe no Sienge.</div>
              <div><b>Compara</b> com os detalhes já cadastrados, pra não duplicar.</div>
              <div><b>Sugere</b> código e descrição quando não acha nenhum compatível.</div>
            </div>
            <p className="sg-escopo-nota">
              A importação/cadastro no Sienge continua restrita a quem tem permissão lá dentro:
              esta ferramenta padroniza e gera os detalhes, não concede nem substitui esse acesso.
            </p>
          </div>
          <div className="sg-col"><GeradorSiengeView /></div>
          </>
          ) : modulo === "catalogo" ? (
          <>
          <div className="eyebrow">PADRÃO DA CASA</div>
          <div className="title-row"><span className="title-accent">Catálogo TKWS</span></div>
          <div className="obra-meta">O que a gente especifica, por grupo e subgrupo — escolha os produtos e eles vão direto para o Executivo da obra</div>
          <Catalogo usuario={usuario} obras={obrasAtivas} podeEditar={perfilPermiteEditar} />
          </>
          ) : modulo === "equipe" ? (
          <>
          <div className="eyebrow">CADASTRO · {pessoas.length}</div>
          <div className="title-row"><span className="title-accent">Equipe</span></div>
          <div className="obra-meta">Quem é quem, o cargo de cada um, e o que cada um pode ver — é desta lista que sai o GC de cada obra</div>
          <EquipeView pessoas={pessoas} obras={obras} carregando={pessoasCarregando} erro={pessoasErro}
            usuario={usuario} migracaoPendente={migracaoPendente}
            onSalvar={salvarPessoaNoTime} onSalvarAcesso={salvarAcessoDaPessoa}
            onExcluir={excluirPessoaDoTime} />
          </>
          ) : modulo === "mehoo" ? (
          <>
          <div className="eyebrow">CANAL DE COMPRA</div>
          <div className="title-row"><span className="title-accent">Mehoo</span></div>
          <div className="obra-meta">Cada obra com item da Mehoo: quando ela entrega, os cadernos do executivo pra baixar, e o que foi mandado pra eles</div>
          <MehooView obras={obrasDoPainel} carregando={painelCarregando} erro={painelErro} />
          </>
          ) : modulo === "aditivos" ? (
          <>
          <div className="eyebrow">DOCUMENTO DE OBRA</div>
          <div className="title-row"><span className="title-accent">Aditivos</span></div>
          <div className="obra-meta">Supressão e adição por obra, numeradas a partir do centro de custo — o documento aparece do lado enquanto você preenche</div>
          <AditivosView obras={obrasAtivas} usuario={usuario} />
          </>
          ) : modulo === "precos" ? (
          <>
          <div className="eyebrow">REFERÊNCIA DE CUSTO</div>
          <div className="title-row"><span className="title-accent">Banco de Preços</span></div>
          <div className="obra-meta">Preço realmente pago por insumo, vindo dos pedidos de compra do Sienge</div>
          <BancoPrecosView />
          </>
          ) : modulo === "a_contratar" ? (
          <>
          <div className="eyebrow">OBRAS ATIVAS · {obrasAtivas.length}</div>
          <div className="title-row"><span className="title-accent">Gestão de compras e contratações</span></div>
          <div className="obra-meta">Todas as obras lado a lado: o que falta comprar, o que falta contratar, e quais prazos já venceram</div>
          <GestaoComprasView obras={obrasDoPainel} carregando={painelCarregando} erro={painelErro}
            onAbrir={(id) => { setSelectedId(id); setModulo("comparativo"); }} />
          </>
          ) : !obra ? (
            <div className="empty-note">
              {loading
                ? "Carregando obras do Monday…"
                : obrasNovas.length > 0
                ? <>Nenhuma obra iniciada ainda. Comece em <button className="link-inline" onClick={() => setModulo("novas")}>Novas obras</button>.</>
                : "Nenhuma obra encontrada."}
            </div>
          ) : (
          <>
          <div className="eyebrow">
            OBRA #{obra.codigo}
            {obra.semDetalhe && <span className="obra-fictitious">SEM DETALHE DE EXECUTIVO — só cadastro do Monday</span>}
          </div>
          <div className="title-row">
            <span className="title-accent">{obra.nome}</span>
            {/* Concluir a obra e um ato de fim de tudo. Repetido no topo
                de oito telas ele fica ao lado do cotovelo de quem esta
                conferindo item a item — agora mora so no Dashboard. */}
            {grupo === "dashboard" && (
              <button className="btn-concluir" disabled={salvandoObra === obra.id} onClick={() => marcarConcluida(obra)}>
                {salvandoObra === obra.id ? "Concluindo…" : <><Archive size={13} /> Concluir obra</>}
              </button>
            )}
          </div>
          <div className="obra-meta">{obra.endereco} · {obra.cliente}</div>

          <BarraEtapa
            edicao={edicao} salvando={salvando} carregando={carregandoDados}
            onHabilitar={habilitarEdicao} onFinalizar={finalizarEdicao}
            etapaId={ETAPAS_COM_CONCLUSAO.has(tab) ? tab : null} obra={obra}
            onConcluir={concluirEtapa} onReabrirEtapa={reabrirEtapa} />


          <TabBar tab={tab} onChange={handleTabChange} obra={obra} grupo={grupo} onGrupo={handleGrupoChange} />

          {/* Só no Dashboard. Antes ficava acima de todas as abas, ocupando
              o topo mesmo quando a pessoa estava conferindo item a item —
              e repetido em oito telas ele vira moldura, não informação. */}
          {grupo === "dashboard" && <>
          <DashboardObra obra={obra} totals={totals} podeEditar={edicao.minha}
            onDataEntrega={definirDataEntrega}
            onIrParaCompras={() => { setGrupo("planejamento"); setTab("comparativo"); }}
            onIrParaAditivos={() => setModulo("aditivos")}
            onDefinirGC={definirGCdaObra} onDefinirTailorMade={definirTailorMadeDaObra}
            onDefinirExecutivo={definirResponsavelExecutivoDaObra}
            /* O Monday nao tem esses dois campos — pra obra que vem de
               la, so' o `registro` (nosso banco) guarda o que foi
               atribuido aqui, e sem este fallback o valor sumiria a
               cada recarregada. */
            tailorMade={obra.tailorMade ?? registro.get(String(obra.codigo))?.tailor_made ?? null}
            responsavelExecutivo={obra.responsavelExecutivo ?? registro.get(String(obra.codigo))?.responsavel_executivo ?? null}
            equipe={pessoas} />
          </>}

          {tab === null && ETAPAS_POR_GRUPO[grupo] && <div className="escolha-aba">Escolha uma etapa acima para começar.</div>}
          {tab === "vendido_contrato" && <VendidoContratoView obra={obra} onImportContrato={importVendidoContrato} onLimpar={() => limparImportacao(["itensContrato"])} onReabrir={reabrirCompras} onEditarItem={editarItemContrato} podeEditar={edicao.minha} />}
          {tab === "vendido_planilha" && <VendidoPlanilhaView obra={obra} onImportPlanilha={importVendidoPlanilha} onLimpar={() => limparImportacao(["itensPlanilha"])} onReabrir={reabrirCompras} podeEditar={edicao.minha} />}
          {tab === "vendido_conferencia" && <DeparaContratoPlanilhaView obra={obra} onAprovar={aprovarDepara} onEditarPlanilha={editarItemPlanilha} onAprovarLinha={aprovarLinhaConferencia} podeEditar={edicao.minha} />}
          {tab === "executivo" && ((obra.deparaAprovado || obra.executivoLiberadoDireto)
            ? <ExecutivoView obra={obra} usuario={usuario} onImportCaderno={importCaderno} onImportPlanilhaExecutivo={importPlanilhaExecutivo} onEditarItem={editarItemExecutivo} onAdicionarItem={adicionarItemExecutivo} onPuxarDoCriativo={puxarDoCriativo} onIrParaDepara={() => handleTabChange("vendido_conferencia")} onLimparExecutivo={() => limparImportacao(["itensPlanilhaExecutivo", "itens"])} onReabrir={reabrirCompras} podeEditar={edicao.minha} />
            : <FaseBloqueada onIrParaDepara={() => handleTabChange("vendido_conferencia")}
                onComecarSemDepara={(edicao.minha && obra.semDetalhe) ? comecarExecutivoSemDepara : undefined} />)}
          {tab === "executivo_conferencia" && (obra.deparaAprovado ? <ExecutivoConferenciaView obra={obra} onEditarPlanilhaExecutivo={editarItemPlanilhaExecutivo} onAprovarLinha={aprovarLinhaConferencia} podeEditar={edicao.minha} /> : <FaseBloqueada onIrParaDepara={() => handleTabChange("vendido_conferencia")} />)}
          {tab === "assinatura_cliente" && (
            <AssinaturaClienteView obra={obra} usuario={usuario} onRegistrar={registrarAssinaturaCliente}
              onRemover={removerAssinaturaCliente} podeEditar={edicao.minha} />
          )}
          {tab === "diario" && (
            <div className="compras-empty">
              <BookOpen size={30} className="dim" />
              <div className="compras-empty-title">Diário de Obra</div>
              <div className="compras-empty-sub">Ainda não construímos esta tela — o menu está aqui pra a estrutura ficar de pé. Me diga o que a equipe registra no dia a dia da obra e eu desenho a partir disso.</div>
            </div>
          )}
          {tab === "comparativo" && (
            <ComparativoView obra={obra} expandedCats={expandedCats} toggleCat={toggleCat} updateItem={updateItem} itemFilter={itemFilter} setItemFilter={setItemFilter} tipoFilter={tipoFilter} setTipoFilter={setTipoFilter} onLiberar={liberarCompras} onReabrir={reabrirCompras} onCriarAvulsa={criarCompraAvulsa} onSepararMO={separarMaoDeObra} onJuntarMO={juntarMaoDeObra} onSepararGrupo={separarMOdoGrupo} onAlocar={definirAlocacao} onIrParaDashboard={() => { setGrupo("dashboard"); setTab(null); }} podeEditar={edicao.minha} />
          )}
          {tab === "compras" && <ComprasView obra={obra} onItemChange={updateItem} usuario={usuario} />}
          {grupo === "arquivos" && (
            <ArquivosObraView obra={obra} usuario={usuario} podeEditar={edicao.minha}
              onArquivos={trocarArquivosDaObra} />
          )}
          {tab === "contratos" && <DashboardMO obra={obra} onItemChange={updateItem} onCriarSolicitacao={criarSolicitacaoContrato} onCriarEscopo={criarEscopo} onMudarEscopo={mudarEscopo} onApagarEscopo={apagarEscopo} podeEditar={edicao.minha} />}
          </>
          )}
        </main>
      </div>
    </div>
  );
}
