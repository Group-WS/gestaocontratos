import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import * as XLSX from "xlsx";
import {
  ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2, XCircle,
  Search, Building2, ClipboardList, ShoppingCart, ArrowUpRight,
  ArrowDownRight, Minus, Check, Link2, PackageSearch, Bell, Sparkles,
  LayoutGrid, FileText, Download, SlidersHorizontal, X, Upload, Clock, Copy, GitCompare, Plus,
  Lock, BookOpen, ShieldCheck, Play, Archive, RotateCcw, Sparkle, Package, Trash2
} from "lucide-react";
import { listarObras, iniciarObra, concluirObra, reabrirObra } from "./lib/obras";
import { definirEapPadrao, eapAtual, carregarEapDoBanco } from "./lib/eap";
import { listarPrecos, contarPrecos, salvarPrecos, sugerirPrecos } from "./lib/insumos";
import { supabase, supabaseConfigurado } from "./lib/supabase";
import { carregarDadosObra, salvarDadosObra, pegarEdicao, liberarEdicao, MINUTOS_ATE_TRAVA_EXPIRAR } from "./lib/dadosObra";

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
  { num: "32", nome: "Execução e Mão de Obra" },
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

function obraComprasStats(o) {
  let totalProdutos = 0, totalComprado = 0;
  o.categorias.forEach((c) => (c.itens || []).forEach((it) => {
    if (it.tipo !== "produto" || it.custo == null) return;
    totalProdutos += it.custo;
    if (it.comprado) totalComprado += it.valorComprado != null ? it.valorComprado : it.custo;
  }));
  const pct = totalProdutos > 0 ? (totalComprado / totalProdutos) * 100 : 0;
  return { totalProdutos, totalComprado, falta: totalProdutos - totalComprado, pct };
}

function matchesFilter(it, filter) {
  if (filter === "todos") return true;
  if (filter === "alerta") return itemAlertas(it).length > 0;
  if (it.tipo !== "produto") return false; // só produto passa pelo fluxo de compras
  if (filter === "liberado") return it.liberado === true;
  if (filter === "aguardando") return !it.liberado;
  if (filter === "comprado") return it.comprado === true;
  if (filter === "falta") return !it.comprado;
  return true;
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
  const rows = [["Verba", "Código", "Descrição", "Tipo", "Ambiente", "Qtd. Executivo", "Custo Total (R$)", "Liberado p/ compra"]];
  obra.categorias.forEach((cat) => (cat.itens || []).forEach((it) => {
    rows.push([
      cat.nome, it.codigo, it.desc, it.tipo === "produto" ? "Produto" : "Serviço",
      it.ambiente || "", it.qtdExecutivo ?? "", (it.custo ?? 0).toFixed(2).replace(".", ","),
      it.tipo === "produto" ? (it.liberado ? "Liberado" : "Aguardando") : "—",
    ]);
  }));
  const csv = rows.map((r) => r.map(csvCell).join(";")).join("\n");
  downloadFile(`executivo_obra_${obra.codigo}.csv`, csv, "text/csv;charset=utf-8;");
}

/* ============================================================
   COMPONENTES PEQUENOS
   ============================================================ */

function StatusText({ status }) {
  const m = STATUS_META[status];
  return <span className="status-text" style={{ color: m.color }}>{m.label}</span>;
}

function BigCard({ label, value, delta, deltaGood, sub, progress }) {
  return (
    <div className="big-card">
      <div className="big-card-label">{label}</div>
      <div className="big-card-row">
        <div className="big-card-value">{value}</div>
        {delta && <span className={`delta ${deltaGood ? "delta-good" : "delta-bad"}`}><ArrowUpRight size={13} /> {delta}</span>}
      </div>
      {progress != null && (
        <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
      )}
      {sub && <div className="big-card-sub">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className="mini-stat">
      <div className="mini-stat-label">{label}</div>
      <div className="mini-stat-value" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}

function CategoriaBar({ vendido, executivo }) {
  const max = Math.max(vendido, executivo || 0, 1);
  const wV = (vendido / max) * 100;
  const wE = executivo == null ? 0 : (executivo / max) * 100;
  const over = executivo > vendido;
  return (
    <div className="cbar">
      <div className="cbar-track">
        <div className="cbar-vendido" style={{ width: `${wV}%` }} />
        <div className="cbar-exec" style={{ width: `${Math.min(wE, 100)}%`, background: over ? "var(--red)" : "var(--blue)" }} />
      </div>
    </div>
  );
}

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

// Linha de PRODUTO → segue o fluxo de Compras (Sienge)
function ProdutoRow({ item, onAprovar, onToggleComprado, onValorComprado, onQtdComprada }) {
  const alertas = itemAlertas(item);
  const bloqueado = alertas.includes("escopo");
  const estourou = itemEstourou(item);
  return (
    <tr className={alertas.length ? "row-alert" : estourou ? "row-estouro" : ""}>
      <td className="mono dim">{item.codigo}</td>
      <td>
        <div className="item-desc">{item.desc}</div>
        <ItemTags item={item} alertas={alertas} />
        {item.contavel && <SiengeMatch sienge={item.sienge} />}
      </td>
      <td className="mono center dim">{item.ambiente}</td>
      <td className="mono center">
        <span className={item.excedeQtd ? "qtd-bad" : ""}>{item.qtdExecutivo ?? "—"}</span> <span className="unit">{item.un}</span>
      </td>
      <td className="mono right">{fmtBRL(item.custo)}</td>
      <td className="center">
        {bloqueado ? (
          <button className="btn-approve" onClick={onAprovar}><Check size={12} /> Aprovar p/ compra</button>
        ) : (
          <span className={item.liberado ? "pill pill-ok" : "pill pill-wait"}>{item.liberado ? "Lançado p/ compra" : "Aguardando liberação"}</span>
        )}
      </td>
      <td className="mono center">
        <input className="input-valor input-qtd" type="text" placeholder="—"
          value={item.qtdComprada != null ? item.qtdComprada.toString().replace(".", ",") : ""}
          onChange={(e) => onQtdComprada(e.target.value)} />
      </td>
      <td className="mono right">
        <input className={`input-valor ${estourou ? "input-estouro" : ""}`} type="text" placeholder="—"
          value={item.valorComprado != null ? item.valorComprado.toString().replace(".", ",") : ""}
          onChange={(e) => onValorComprado(e.target.value)} />
        {estourou && <div className="estouro-tag"><AlertTriangle size={10} /> estourou</div>}
      </td>
      <td className="center">
        <button className={item.comprado ? "check check-on" : "check"} onClick={onToggleComprado} aria-label="Marcar como comprado">
          {item.comprado && <Check size={13} />}
        </button>
      </td>
    </tr>
  );
}

// Linha de SERVIÇO / mão de obra → segue o fluxo de Contratos (o status
// do contrato mora no módulo Contratos, não aqui — evita duplicar/confundir).
function ServicoRow({ item }) {
  const alertas = itemAlertas(item);
  return (
    <tr className={alertas.length ? "row-alert" : ""}>
      <td className="mono dim">{item.codigo}</td>
      <td>
        <div className="item-desc">{item.desc}</div>
        <ItemTags item={item} alertas={alertas} />
      </td>
      <td className="mono center">
        <span className={item.excedeQtd ? "qtd-bad" : ""}>{item.qtdExecutivo ?? "—"}</span> <span className="unit">{item.un}</span>
      </td>
      <td className="mono right">{fmtBRL(item.custo)}</td>
    </tr>
  );
}

/* Produto e serviço seguem caminhos diferentes depois daqui: produto vira
   insumo no Sienge, serviço vira contrato. São duas rotinas distintas, com
   pessoas distintas — daí o filtro ser uma dimensão SEPARADA do filtro de
   situação, e não mais um chip na mesma fila. Sem isso não dá pra pedir
   "produtos que ainda estão aguardando liberação", que é a pergunta real
   de quem vai lançar compra. */
const TIPOS_COMPRA = [
  { id: "todos", label: "Produtos e serviços" },
  { id: "produto", label: "Só produtos", destino: "vinculam insumo do Sienge" },
  { id: "servico", label: "Só serviços", destino: "viram contrato" },
];

const ehProduto = (it) => it.tipo === "produto";
const casaTipo = (it, tipoFilter) =>
  tipoFilter === "todos" || (tipoFilter === "produto" ? ehProduto(it) : !ehProduto(it));

function CategoriaBlock({ cat, expanded, onToggle, onItemChange, itemFilter, tipoFilter = "todos" }) {
  const status = categoriaStatus(cat);
  const diff = cat.executivo - cat.vendido;
  const pct = cat.vendido === 0 ? null : (diff / cat.vendido) * 100;
  const hasItens = Array.isArray(cat.itens) && cat.itens.length > 0;
  const filteredItens = hasItens
    ? cat.itens.filter((it) => matchesFilter(it, itemFilter) && casaTipo(it, tipoFilter))
    : [];
  const filtering = itemFilter !== "todos" || tipoFilter !== "todos";
  const showExpanded = filtering ? filteredItens.length > 0 : expanded;
  // Verba que ficou sem nada depois do filtro sai da tela: com 19 verbas,
  // deixar as vazias faz a pessoa rolar por cabeçalhos que não levam a
  // lugar nenhum pra achar as três que interessam.
  if (filtering && filteredItens.length === 0) return null;

  return (
    <div className="cat-block">
      <button className="cat-header" onClick={() => hasItens && !filtering && onToggle()} style={{ cursor: hasItens && !filtering ? "pointer" : "default" }}>
        <div className="cat-header-left">
          {hasItens ? (showExpanded ? <ChevronDown size={15} className="dim" /> : <ChevronRight size={15} className="dim" />) : <span style={{ width: 15, display: "inline-block" }} />}
          <span className="cat-num mono">{cat.num}</span>
          <span className="cat-nome">{cat.nome}</span>
          {cat.foraDeEscopoCategoria && <span className="chip chip-red"><XCircle size={11} /> Fora do escopo vendido</span>}
        </div>
        <div className="cat-header-right">
          <CategoriaBar vendido={cat.vendido} executivo={cat.executivo} />
          <div className="cat-values"><span className="mono dim">{fmtBRL(cat.vendido)}</span><span className="arrow dim">→</span><span className="mono">{fmtBRL(cat.executivo)}</span></div>
          <div className="cat-diff">
            {status === "vazio" ? <span className="dim">—</span> : status === "pendente" ? <span className="dim">sem lançamento</span> : (
              <span style={{ color: STATUS_META[status].color }} className="mono">
                {diff === 0 ? <Minus size={12} /> : diff > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {" "}{diff > 0 ? "+" : ""}{fmtBRL(diff)}{pct != null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(0)}%)` : ""}
              </span>
            )}
          </div>
          <StatusText status={status} />
        </div>
      </button>

      {showExpanded && hasItens && (
        <div className="cat-items">
          {filtering && filteredItens.length === 0 ? null : (() => {
            const produtos = filteredItens.filter((it) => it.tipo === "produto");
            const servicos = filteredItens.filter((it) => it.tipo !== "produto");
            const totalProd = produtos.reduce((a, it) => a + (it.custo || 0), 0);
            const totalServ = servicos.reduce((a, it) => a + (it.custo || 0), 0);
            return (
            <>
              {produtos.length > 0 && (
                <div className="fluxo-bloco">
                  <div className="fluxo-head fluxo-head-produto">
                    <ShoppingCart size={14} />
                    <span className="fluxo-titulo">Produtos</span>
                    <span className="fluxo-dest">→ Compras (Sienge)</span>
                    <span className="fluxo-meta">{produtos.length} {produtos.length === 1 ? "item" : "itens"} · {fmtBRL(totalProd)}</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 62 }}>Cód.</th>
                        <th>Descrição</th>
                        <th style={{ width: 88 }}>Ambiente</th>
                        <th style={{ width: 84 }} className="center">Qtd. exec.</th>
                        <th style={{ width: 100 }} className="right">Custo</th>
                        <th style={{ width: 140 }} className="center">Situação de compra</th>
                        <th style={{ width: 90 }} className="center">Qtd. comprada</th>
                        <th style={{ width: 106 }} className="right">Valor comprado</th>
                        <th style={{ width: 58 }} className="center">Comprado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtos.map((it) => {
                        const idx = cat.itens.indexOf(it);
                        return (
                          <ProdutoRow key={it.codigo} item={it}
                            onAprovar={() => onItemChange(idx, { statusEscopo: "aprovado" })}
                            onToggleComprado={() => onItemChange(idx, { comprado: !it.comprado })}
                            onValorComprado={(v) => {
                              const num = parseFloat(v.replace(/\./g, "").replace(",", "."));
                              onItemChange(idx, { valorComprado: isNaN(num) ? null : num });
                            }}
                            onQtdComprada={(v) => {
                              const num = parseFloat(v.replace(/\./g, "").replace(",", "."));
                              onItemChange(idx, { qtdComprada: isNaN(num) ? null : num });
                            }}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {servicos.length > 0 && (
                <div className="fluxo-bloco">
                  <div className="fluxo-head fluxo-head-servico">
                    <FileText size={14} />
                    <span className="fluxo-titulo">Serviços / mão de obra</span>
                    <span className="fluxo-dest">→ Contratos</span>
                    <span className="fluxo-meta">{servicos.length} {servicos.length === 1 ? "item" : "itens"} · {fmtBRL(totalServ)}</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 62 }}>Cód.</th>
                        <th>Descrição</th>
                        <th style={{ width: 84 }} className="center">Qtd. exec.</th>
                        <th style={{ width: 100 }} className="right">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicos.map((it) => <ServicoRow key={it.codigo} item={it} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

const FILTERS = [
  { id: "todos", label: "Todos os itens" },
  { id: "liberado", label: "Liberado p/ compra" },
  { id: "aguardando", label: "Aguardando liberação" },
  { id: "alerta", label: "Com alerta" },
  { id: "comprado", label: "Já comprado" },
  { id: "falta", label: "Falta comprar" },
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

  const faltaJustificar = acimaDoTeto && (justificativa.trim().length < 15 || aprovador.trim().length < 3);
  const bloqueado = !temItens || !podeEditar || faltaJustificar;

  return (
    <div className={`aprovacao-box ${acimaDoTeto ? "com-estouro" : ""}`}>
      {acimaDoTeto && (
        <div className="estouro-aviso">
          <AlertTriangle size={15} />
          <span>
            O Executivo está <b>{fmtBRL(estouro)} acima</b> do CMV liberado ({fmtBRL(teto)}).
            Dá pra seguir, mas precisa de justificativa e de quem autorizou — fica registrado na obra.
          </span>
        </div>
      )}

      {acimaDoTeto && (
        <div className="estouro-campos">
          <label>
            <span>Por que o custo passou do CMV?</span>
            <textarea rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: cliente aprovou troca do ar-condicionado por modelo superior, com aditivo de contrato." />
          </label>
          <label>
            <span>Autorizado por</span>
            <input value={aprovador} onChange={(e) => setAprovador(e.target.value)} placeholder="Nome de quem aprovou o estouro" />
          </label>
        </div>
      )}

      <div className="aprovacao-resumo">
        {!temItens
          ? "Importe o Executivo desta obra antes de liberar — sem itens não há o que comprar."
          : "Ao liberar, esta vira a planilha oficial de compra: Vendido, Depara e Executivo ficam congelados."}
      </div>

      <button className="btn-aprovar" disabled={bloqueado} onClick={() => {
        onLiberar(acimaDoTeto ? { estouro, justificativa: justificativa.trim(), aprovador: aprovador.trim() } : null);
      }}>
        <ShieldCheck size={14} /> {acimaDoTeto ? "Liberar com estouro registrado" : "Liberar planilha de compra"}
      </button>
    </div>
  );
}

function ComparativoView({ obra, expandedCats, toggleCat, updateItem, itemFilter, setItemFilter, tipoFilter, setTipoFilter, onLiberar, onReabrir, podeEditar }) {
  const temItens = obra.categorias.some((c) => (c.itens || []).length > 0);

  // Conta na EAP inteira pra estampar no chip. Saber que são 148 produtos
  // e 43 serviços antes de clicar é o que diz de qual lado começar.
  const todosItens = obra.categorias.flatMap((c) => c.itens || []);
  const nProdutos = todosItens.filter(ehProduto).length;
  const nServicos = todosItens.length - nProdutos;
  const contaPorTipo = { todos: todosItens.length, produto: nProdutos, servico: nServicos };

  return (
    <>
      {obra.comprasLiberadas ? (
        <div className="import-ok liberado-barra">
          <ShieldCheck size={14} />
          <span>Planilha de Compra liberada — as etapas anteriores estão congeladas.</span>
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
            <span>Esta é a planilha que libera compras e contratações. Ao liberar, <b>as etapas anteriores são congeladas</b> e não podem mais ser alteradas.</span>
          </div>
        </div>
      )}
      {/* Duas dimensões, duas filas. A de cima é o que o item É (e pra onde
          ele vai depois); a de baixo é em que pé ele está. */}
      <div className="filter-bar tipo-bar">
        <Package size={13} className="dim" />
        {TIPOS_COMPRA.map((t) => (
          <button key={t.id} className={`filter-chip tipo-chip ${tipoFilter === t.id ? "active" : ""}`}
            onClick={() => setTipoFilter(t.id)} title={t.destino ? `Estes ${t.destino}` : undefined}>
            {t.label}
            <span className="tipo-chip-conta">{contaPorTipo[t.id]}</span>
          </button>
        ))}
        {tipoFilter !== "todos" && (
          <span className="tipo-bar-destino">
            {TIPOS_COMPRA.find((t) => t.id === tipoFilter)?.destino}
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
      </div>
      {obra.categorias.map((cat, catIdx) => (
        <CategoriaBlock key={cat.num + cat.nome} cat={cat}
          expanded={expandedCats.has(cat.num + obra.id)}
          onToggle={() => toggleCat(cat.num + obra.id)}
          onItemChange={(itemIdx, patch) => updateItem(catIdx, itemIdx, patch)}
          itemFilter={itemFilter}
          tipoFilter={tipoFilter}
        />
      ))}
      {temItens && obra.categorias.every((c) => (c.itens || []).filter((it) => matchesFilter(it, itemFilter) && casaTipo(it, tipoFilter)).length === 0) && (
        <div className="compras-empty">
          <SlidersHorizontal size={26} className="dim" />
          <div className="compras-empty-title">Nenhum item com esses filtros</div>
          <div className="compras-empty-sub">Nenhum item da EAP combina "{TIPOS_COMPRA.find((t) => t.id === tipoFilter)?.label}" com "{FILTERS.find((f) => f.id === itemFilter)?.label}".</div>
        </div>
      )}
      <div className="legend">
        <div className="legend-item"><span className="legend-dot" style={{ background: "var(--green)" }} /> Dentro do orçado</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "var(--amber)" }} /> Acima do orçado (até 15%)</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "var(--red)" }} /> Estouro crítico / fora de escopo</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "var(--ink-3)" }} /> Sem lançamento / não se aplica</div>
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
  "32": ["execucao", "maodeobra"],
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
async function lerPlanilhaExcel(file) {
  let linhas;
  // .xlsm é Excel com macro — é o formato do "Composição de Custo" da
  // casa. Sem ele na lista, o arquivo caía no caminho de texto simples e
  // nada era lido. .xlsb entra junto pelo mesmo motivo.
  if (/\.(xlsx|xlsm|xlsb|xls)$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
  } else {
    linhas = parseCSVLinhas(await lerTextoComAcento(file));
  }

  // acha a linha de cabeçalho: a primeira que tem "descri" e (marca ou custo/valor)
  let headerIdx = -1;
  for (let i = 0; i < linhas.length; i++) {
    const row = linhas[i].map((c) => String(c || "").toLowerCase());
    const temDesc = row.some((h) => /descri/.test(h));
    const temMarcaOuCusto = row.some((h) => /marca|custo|valor/.test(h));
    if (temDesc && temMarcaOuCusto) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return { itens: [] };

  const header = linhas[headerIdx];
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
  const iQtd = reservarIdent([/qtd/, /quant/]);
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
  const iCustoTotal = reservar([/custo total/, /^total$/, /^custo$/, /^valor$/]);

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
function ImportButton({ label, accept, dica, onFile, congelado, onLimpar, temConteudo, oQueLimpa }) {
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
          <span>{congelado ? "Planilha de Compra já liberada — esta etapa está congelada e não aceita mais alterações." : dica}</span>
        </div>
        <button className="btn-import" onClick={() => inputRef.current && inputRef.current.click()} disabled={carregando || congelado}>
          <Upload size={13} /> {carregando ? "Lendo…" : label}
        </button>
        <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={aoEscolher} />
        {/* Subir o arquivo errado tem que ter volta. Sem isto, o unico
            jeito de desfazer era subir outro por cima — e se o certo
            ainda nao existisse, a obra ficava com dado errado. */}
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
  jaFora.forEach((c) => { if (!fora.has(c.nome)) extras.push(c); });

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
    if (c.foraDaEapPadrao) { fora.push(c); return; }
    // Só o nome decide. Sem nome reconhecido, o grupo vai pro fim — nunca
    // se assume que o número salvo significa a mesma coisa hoje.
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
function VendidoContratoView({ obra, onImportContrato, onLimpar, podeEditar }) {
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
    if (n === 0) throw new Error("Não encontrei nenhuma verba com valor no PDF. Me manda o arquivo que eu ajusto o leitor.");
    onImportContrato(valores, itens);

    // Presta contas da leitura. O que o leitor NÃO conseguiu ler precisa
    // aparecer aqui, não semanas depois na conferência: um item perdido no
    // meio do PDF não deixa rastro nenhum sozinho.
    const d = diagnostico || {};
    const alertas = [];
    if ((d.semQtd || []).length) alertas.push(`${d.semQtd.length} sem quantidade (${d.semQtd.slice(0, 6).join(", ")}${d.semQtd.length > 6 ? "…" : ""})`);
    if ((d.semDescricao || []).length) alertas.push(`${d.semDescricao.length} sem descrição legível`);
    if ((d.itensForaDeVerba || []).length) alertas.push(`${d.itensForaDeVerba.length} fora de qualquer grupo`);
    // Quantidade que o leitor se recusou a adivinhar: a descrição veio
    // colada no número no PDF, e chutar onde separa já produziu "164
    // unidades" onde eram 4. Estes itens precisam de conferência à mão.
    if ((d.qtdDuvidosa || []).length) alertas.push(`${d.qtdDuvidosa.length} com quantidade ilegível — preencher à mão (${d.qtdDuvidosa.slice(0, 6).join(", ")}${d.qtdDuvidosa.length > 6 ? "…" : ""})`);
    if ((d.suspeitas || []).length) alertas.push(`${d.suspeitas.length} suspeito${d.suspeitas.length > 1 ? "s" : ""} na releitura: ${d.suspeitas.slice(0, 3).map((x) => `${x.codigo} (${x.motivo})`).join("; ")}`);
    if ((gruposNaoReconhecidos || []).length) alertas.push(`grupo fora do padrão: ${gruposNaoReconhecidos.join(", ")}`);

    const base = `“${file.name}” — ${paginas || "?"} páginas lidas · ${n} verba${n > 1 ? "s" : ""} · ${itens.length} itens.`;
    return alertas.length
      ? `${base} ATENÇÃO: ${alertas.join(" · ")}. Confira estes antes de seguir.`
      : `${base} Todos os itens vieram com grupo e quantidade.`;
  }

  return (
    <>
      <DetalheTexto item={verTexto} onFechar={() => setVerTexto(null)} />

      <ImportButton congelado={congelado} label="Importar Contrato (PDF)" accept=".pdf"
        onLimpar={onLimpar} oQueLimpa="os itens e valores do Contrato"
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
                        <th style={{ width: 92 }}>Ambiente</th>
                        <th style={{ width: 100 }} className="center">Qtd. vendida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, i) => (
                        <tr key={it.codigo || i}>
                          <td className="mono dim">{it.codigo || "—"}</td>
                          <td><CelulaTexto texto={it.desc} onVerTudo={(t) => setVerTexto({ rotulo: "Descrição", texto: t })} /></td>
                          <td className="mono center dim"><CelulaTexto texto={it.ambiente} onVerTudo={(t) => setVerTexto({ rotulo: "Ambiente", texto: t })} /></td>
                          <td className="mono center">{it.qtdVendida ?? "—"} <span className="unit">{it.un}</span></td>
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
function VendidoPlanilhaView({ obra, onImportPlanilha, onLimpar, podeEditar }) {
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
    const { itens } = ehPDF ? await lerPlanilhaPDF(file) : await lerPlanilhaExcel(file);
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

function normTxt(s) {
  // remove acentos (NFD separa a letra do acento; filtramos os marcadores
  // combinantes por code point, em vez de regex, pra evitar problema de
  // caractere invisível na faixa Unicode).
  const semAcento = String(s || "").toLowerCase().normalize("NFD")
    .split("").filter((ch) => { const cp = ch.codePointAt(0); return cp < 0x0300 || cp > 0x036f; }).join("");
  return semAcento.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
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
const ALERTA_BANQUETA =
  "conferir a altura da banqueta com a altura da bancada.";
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
  if (tem("mesa", "jantar", "tampo")) {
    const medidas = medidasEmMetros(t);
    if (medidas.length === 0) return doItem(ALERTA_MESA_SEM_MEDIDA);
    if (Math.max(...medidas) > 1.0) return doItem(ALERTA_MESA_MEDIDA);
    return null; // tem medida e cabe
  }

  // 2 — BANQUETA: altura tem que casar com a da bancada
  if (tem("banqueta")) return doItem(ALERTA_BANQUETA);

  // 3 — BASE DO MONOCOMANDO: só a base embutida na parede. Torneira,
  // bica e monocomando de mesa não têm esse problema.
  if (tem("base") && tem("monocomando", "registro", "chuveiro", "ducha", "pressao")) {
    const ehDeMesa = tem("torneira", "bica", "de mesa", "lavatorio", "cozinha", "pia");
    const ehEmbutida = /base[^.]*\b(registro|pressao|embut)/.test(t);
    if (!ehDeMesa || ehEmbutida) return doItem(ALERTA_BASE_MONOCOMANDO);
  }

  // 4 — CLIMATIZAÇÃO. "split" solto entra de propósito: na planilha real
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

function ConferenciaGenerica({ linhas, naoAnalisadas = [], meta, alertasPorVerba, colALabel, colBLabel, vazioALabel, vazioBLabel, vazioTitulo, vazioSub, aprovacoes, onAprovarLinha, onEditarB }) {
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
                    <b>Alerta de conferência técnica — vale para toda a verba:</b>{" "}
                    <span>{alertaGrupo}</span>
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
                        aprovado={aprovacoes ? aprovacoes.has(k) : false}
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
  "32": "Valor fictício criado na venda pra separar margem — não representa item real",
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
function DeparaContratoPlanilhaView({ obra, onAprovar, onEditarPlanilha, podeEditar }) {
  const [aprovacoes, setAprovacoes] = useState(() => new Set());
  const toggleAprovacao = (catNum, codigo) => setAprovacoes((prev) => { const n = new Set(prev); n.add(`${catNum}:${codigo}`); return n; });

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

  // linha aprovada manualmente entra de vez no bucket "OK — bate"
  // (o motivo/badge "Aprovado" continua aparecendo pra diferenciar de
  // um match automático).
  const linhas = useMemo(() => linhasBrutas.map((l) => (
    aprovacoes.has(`${l.catNum}:${l.codigo}`) ? { ...l, status: "ok", motivo: null } : l
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

  const pendentes = linhas.filter((l) => l.status !== "ok");
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
        aprovacoes={aprovacoes} onAprovarLinha={obra.comprasLiberadas || !podeEditar ? undefined : toggleAprovacao}
        onEditarB={obra.comprasLiberadas || !podeEditar ? undefined : ((catNum, codigo, patch) => onEditarPlanilha(catNum, codigo, patch))} />
    </>
  );
}

// CONF. EXECUTIVO — depara Vendido Planilha × Planilha Executivo.
function ExecutivoConferenciaView({ obra, onEditarPlanilhaExecutivo, podeEditar }) {
  const [aprovacoes, setAprovacoes] = useState(() => new Set());
  const toggleAprovacao = (catNum, codigo) => setAprovacoes((prev) => { const n = new Set(prev); n.add(`${catNum}:${codigo}`); return n; });

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
    aprovacoes.has(`${l.catNum}:${l.codigo}`) ? { ...l, status: "ok", motivo: null } : l
  )), [linhasBrutas, aprovacoes]);

  // Um alerta por verba, não um por item. Os textos são idênticos entre
  // as linhas do mesmo grupo — o primeiro que aparecer serve pra todas.
  const alertasPorVerba = useMemo(() => {
    const m = new Map();
    linhasBrutas.forEach((l) => {
      if (l.alertaGrupo && !m.has(l.catNum)) m.set(l.catNum, l.alertaGrupo);
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
      aprovacoes={aprovacoes} onAprovarLinha={obra.comprasLiberadas || !podeEditar ? undefined : toggleAprovacao}
      onEditarB={obra.comprasLiberadas || !podeEditar ? undefined : ((catNum, codigo, patch) => onEditarPlanilhaExecutivo(catNum, codigo, patch))} />
  );
}

// Bloqueio de fase: mostra enquanto o Depara Contrato×Planilha não foi
// aprovado — o Executivo só libera depois dessa aprovação.
function FaseBloqueada({ onIrParaDepara }) {
  return (
    <div className="compras-empty">
      <Lock size={30} className="dim" />
      <div className="compras-empty-title">Aguardando a liberação do CMV</div>
      <div className="compras-empty-sub">Esta etapa abre quando o CMV desta obra for liberado no Depara Contrato × Planilha — é ele que define o teto de custo com que a equipe vai trabalhar daqui pra frente.</div>
      <button className="btn-nova-solicitacao" onClick={onIrParaDepara}>Ir para o Depara</button>
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
function CelulaEditavel({ valor, onSalvar, formato = "moeda", congelado }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");

  function abrir() {
    if (congelado) return;
    setTexto(valor == null ? "" : String(valor).replace(".", ","));
    setEditando(true);
  }

  function salvar() {
    setEditando(false);
    const limpo = texto.trim();
    const novo = limpo === "" ? null : (formato === "texto" ? limpo : parseBRL(limpo));
    if (novo !== valor) onSalvar(novo);
  }

  if (editando) {
    return (
      <input
        className={`celula-input ${formato === "texto" ? "texto" : "mono"}`}
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditando(false);
        }}
      />
    );
  }

  const mostrar = valor == null || valor === ""
    ? (formato === "texto" ? "—" : "—")
    : formato === "moeda" ? fmtBRL(valor) : String(valor);

  return (
    <button
      className={`celula-valor ${formato === "texto" ? "texto" : "mono"} ${congelado ? "travada" : ""}`}
      onClick={abrir}
      title={congelado ? "Congelado pela liberação de compra" : "Clique para editar"}
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
function CelulaTexto({ texto, linhas = 2, onVerTudo, onEditar, congelado }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const editavel = !!onEditar && !congelado;
  const [alvo, cortado] = useCortado(texto);

  if (editando) {
    return (
      <textarea
        className="celula-input texto multi"
        autoFocus
        rows={2}
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={() => { setEditando(false); const v = rascunho.trim(); if (v !== (texto || "")) onEditar(v || null); }}
        onKeyDown={(e) => {
          // Enter salva. Quem precisar de varias linhas usa Shift+Enter.
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
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
        className={`celula-corte ${editavel ? "editavel" : ""}`}
        style={{ WebkitLineClamp: linhas }}
        onClick={abrir}
        title={editavel ? "Clique para editar" : undefined}
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
  { chave: "especificacao", titulo: "Caderno de Especificação", sub: "Tudo que foi aprovado de produto junto ao cliente." },
  { chave: "marcenaria", titulo: "Caderno de Marcenaria", sub: "Projeto e detalhamento dos móveis sob medida." },
  { chave: "projeto", titulo: "Caderno de Projeto Executivo", sub: "Pranchas e detalhamentos do projeto executivo." },
];

// Uma linha por caderno, não um bloco. São três anexos de consulta que
// quase nunca mudam — ocupavam meia tela pra dizer "nenhum arquivo".
function CadernoSlot({ titulo, arquivo, onImportar, congelado }) {
  const inputRef = useRef(null);
  const [erro, setErro] = useState(null);

  function aoEscolher(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErro(null);
    if (!/\.pdf$/i.test(file.name)) { setErro("Suba um arquivo PDF."); return; }
    onImportar({ nome: file.name, url: URL.createObjectURL(file), tamanhoKB: Math.round(file.size / 1024) });
  }

  return (
    <div className="caderno-slot">
      <BookOpen size={14} className={arquivo ? "" : "dim"} />
      <span className="caderno-slot-titulo">{titulo}</span>
      {arquivo ? (
        <>
          <span className="caderno-slot-arquivo">{arquivo.nome} · {arquivo.tamanhoKB} KB</span>
          <a className="caderno-acao" href={arquivo.url} download={arquivo.nome}><Download size={12} /> Baixar</a>
        </>
      ) : (
        <span className="caderno-slot-vazio">sem arquivo</span>
      )}
      {!congelado && (
        <button className="caderno-acao" onClick={() => inputRef.current && inputRef.current.click()}>
          <Upload size={12} /> {arquivo ? "Trocar" : "Anexar"}
        </button>
      )}
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={aoEscolher} />
      {erro && <span className="caderno-erro">{erro}</span>}
    </div>
  );
}

// PLANILHA EXECUTIVO — extrai só descrição, quantidade e valores
// (unitário e total) por item, dentro de cada grupo — igual à Vendido
// Planilha. Por trás, também alimenta o Comparativo/Compras/Contratos
// (produto × serviço classificado pelo custo de material).
function ExecutivoView({ obra, onImportCaderno, onImportPlanilhaExecutivo, onEditarItem, onAdicionarItem, onPuxarDoCriativo, onIrParaDepara, onLimparExecutivo, podeEditar }) {
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
  const [buscandoEm, setBuscandoEm] = useState(null);
  // texto completo aberto no painel de leitura ({rotulo, texto})
  const [verTexto, setVerTexto] = useState(null);
  const verbas = obra.categorias.filter((c) => !c.foraDaEapPadrao);
  // item excluído não soma: ele fica visível como registro, não como custo
  const somar = (campo) => verbas.reduce((a, c) => a + (c.itensPlanilhaExecutivo || []).reduce((s, it) => s + (it.excluido ? 0 : (it[campo] || 0)), 0), 0);
  const total = somar("custo");
  const totalMaterial = somar("totalMaterial");
  const totalMO = somar("totalMO");

  async function aoImportar(file) {
    const ehPDF = /\.pdf$/i.test(file.name);
    const { itens } = ehPDF ? await lerExecutivoPDF(file) : await lerPlanilhaExcel(file);
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
              <CadernoSlot key={c.chave} titulo={c.titulo}
                arquivo={(obra.cadernos || {})[c.chave]}
                congelado={congelado}
                onImportar={(info) => onImportCaderno(c.chave, info)} />
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
        <div className="vend-list">
          {verbas.map((c) => {
            const itens = c.itensPlanilhaExecutivo || [];
            const temItens = itens.length > 0;
            const aberto = abertos.has(c.num);
            const subtotal = itens.reduce((a, it) => a + (it.excluido ? 0 : (it.custo || 0)), 0);
            // quanto essa verba valia no criativo — a referência do movimento
            const baseVerba = itens.reduce((a, it) => a + (it.vendido?.custo || 0), 0);
            const delta = temItens && baseVerba > 0 ? deltaVerba(subtotal, baseVerba) : null;
            return (
              <div key={c.num} className="vend-grupo">
                {/* abre mesmo sem itens: é onde se lança item manual */}
                <button className="vend-head" onClick={() => toggle(c.num)}>
                  {aberto ? <ChevronDown size={14} className="dim" /> : <ChevronRight size={14} className="dim" />}
                  <span className="vend-num mono">{c.num}</span>
                  <span className="vend-nome">{c.nome}</span>
                  {temItens && <span className="vend-count">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>}
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
                  <table className="vend-itens exec-itens">
                    <thead>
                      <tr>
                        <th style={{ width: 56 }}>Item</th>
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
                        <th style={{ width: 78 }} className="right col-vendido">Diferença</th>
                        <th style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, i) => {
                        const editar = (campo) => (novo) => onEditarItem(c.num, i, { [campo]: novo });
                        return (
                          <tr key={it.codigo || i} className={`${it.ehTitulo ? "linha-titulo" : ""} ${it.excluido ? "linha-excluida" : it.alteradoExecutivo ? "linha-alterada" : ""}`}>
                            <td className="mono dim">{it.codigo || "—"}</td>
                            <td>
                              <CelulaTexto texto={it.desc} congelado={congelado}
                                onEditar={(v) => onEditarItem(c.num, i, { desc: v })}
                                onVerTudo={(t) => setVerTexto({ rotulo: "Descrição", texto: t })} />
                              {it.excluido && <span className="tag-excluido">excluído do executivo — não entra no custo</span>}
                              {it.ehTitulo && <span className="tag-na">N/A — título, não entra na conferência</span>}
                              {it.alteradoExecutivo && <span className="tag-alterado" title="Valor alterado aqui, não veio assim do arquivo">alterado no executivo</span>}
                              {it.precoNaoRevisado && <span className="tag-preco"><AlertTriangle size={10} /> preço não revisado</span>}
                              {it.precoNaoRevisado && !obra.comprasLiberadas && (
                                <SugestoesPreco descricao={it.desc} onUsar={(v) => onEditarItem(c.num, i, { custoMaterial: v })} />
                              )}
                            </td>
                            <td className="dim">
                              <CelulaTexto texto={it.especificacao} congelado={congelado}
                                onEditar={(v) => onEditarItem(c.num, i, { especificacao: v })}
                                onVerTudo={(t) => setVerTexto({ rotulo: "Código / especificação / Obs.", texto: t })} />
                            </td>
                            <td className="dim"><CelulaTexto texto={it.marca} congelado={congelado} onEditar={(v) => onEditarItem(c.num, i, { marca: v })} onVerTudo={(t) => setVerTexto({ rotulo: "Fornecedor", texto: t })} /></td>
                            <td className="dim"><CelulaTexto texto={it.ambiente} congelado={congelado} onEditar={(v) => onEditarItem(c.num, i, { ambiente: v })} onVerTudo={(t) => setVerTexto({ rotulo: "Ambiente", texto: t })} /></td>
                            <td className="center"><CelulaEditavel valor={it.qtdVendida} formato="numero" congelado={congelado} onSalvar={editar("qtdVendida")} /></td>
                            <td className="center"><CelulaEditavel valor={it.un} formato="texto" congelado={congelado} onSalvar={editar("un")} /></td>
                            <td className="right"><CelulaEditavel valor={it.custoMaterial} congelado={congelado} onSalvar={editar("custoMaterial")} /></td>
                            <td className="right"><CelulaEditavel valor={it.custoMO} congelado={congelado} onSalvar={editar("custoMO")} /></td>
                            <td className="right"><CelulaEditavel valor={it.totalMaterial} congelado={congelado} onSalvar={editar("totalMaterial")} /></td>
                            <td className="right"><CelulaEditavel valor={it.totalMO} congelado={congelado} onSalvar={editar("totalMO")} /></td>
                            <td className="right forte"><CelulaEditavel valor={it.custo} congelado={congelado} onSalvar={editar("custo")} /></td>
                            <td className="mono right col-vendido dim">{it.vendido?.custo != null ? fmtBRL(it.vendido.custo) : "—"}</td>
                            <td className="mono right col-vendido">
                              {(() => {
                                const base = it.vendido?.custo;
                                if (base == null || it.custo == null) return <span className="dim">—</span>;
                                const d = it.custo - base;
                                if (Math.abs(d) < 0.01) return <span className="dim">—</span>;
                                return <span style={{ color: d > 0 ? "var(--red)" : "var(--green)", fontWeight: 600 }}>{d > 0 ? "+" : ""}{fmtBRL(d)}</span>;
                              })()}
                            </td>
                            <td className="center">
                              {!congelado && (
                                <button
                                  className={`btn-linha-excluir ${it.excluido ? "desfazer" : ""}`}
                                  title={it.excluido ? "Trazer de volta" : "Excluir do executivo"}
                                  onClick={() => onEditarItem(c.num, i, { excluido: !it.excluido })}
                                >
                                  {it.excluido ? <RotateCcw size={13} /> : <X size={13} />}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
                {aberto && !congelado && (
                  buscandoEm === c.num ? (
                    <BuscaInsumo
                      onCancelar={() => setBuscandoEm(null)}
                      onEscolher={(insumo) => { onAdicionarItem(c.num, insumo); setBuscandoEm(null); }}
                    />
                  ) : (
                    <button className="btn-add-item" onClick={() => setBuscandoEm(c.num)}>
                      <Plus size={12} /> Adicionar item nesta verba
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

function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img
          className="brand-logo"
          src="/logo.png"
          alt="Group WS"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <span className="brand-word">GESTÃO DE OBRAS TKWS</span>
      </div>
      <div className="topbar-search"><Search size={15} className="dim" /><input placeholder="Buscar obra, item, código Sienge..." /><span className="kbd">⌘K</span></div>
      <div className="topbar-right">
        <button className="icon-btn"><Sparkles size={16} /></button>
        <button className="icon-btn bell"><Bell size={16} /><span className="notif-dot">1</span></button>
        <div className="avatar">PW</div>
      </div>
    </header>
  );
}

function Sidebar({ obras, selected, onSelect, modulo, onModulo, novasCount, arquivoCount }) {
  const [search, setSearch] = useState("");
  const [onlyAlert, setOnlyAlert] = useState(false);
  const [squadFilter, setSquadFilter] = useState("todos");

  const squads = Array.from(new Set(obras.map((o) => o.squad || "Sem squad"))).sort();

  const filtered = obras.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${o.nome} ${o.codigo} ${o.cliente}`.toLowerCase().includes(q);
    const matchesAlert = !onlyAlert || obraAlertCount(o) > 0;
    const matchesSquad = squadFilter === "todos" || (o.squad || "Sem squad") === squadFilter;
    return matchesSearch && matchesAlert && matchesSquad;
  });

  const groups = {};
  filtered.forEach((o) => {
    const key = o.squad || "Sem squad";
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  });
  const groupNames = Object.keys(groups).sort();

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <div className="nav-group-label">OBRAS ATIVAS · {obras.length}</div>
        <div className="obra-search">
          <Search size={13} className="dim" />
          <input placeholder="Filtrar por nome, código, cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="clear-btn" onClick={() => setSearch("")}><X size={12} /></button>}
        </div>

        <div className="squad-filter">
          <button className={`squad-chip ${squadFilter === "todos" ? "active" : ""}`} onClick={() => setSquadFilter("todos")}>Todos os squads</button>
          {squads.map((s) => (
            <button key={s} className={`squad-chip ${squadFilter === s ? "active" : ""}`} onClick={() => setSquadFilter(s)}>{s}</button>
          ))}
        </div>

        <button className={`alert-toggle ${onlyAlert ? "active" : ""}`} onClick={() => setOnlyAlert((v) => !v)}>
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
              <div className="squad-group-label">{squadName} · {groups[squadName].length}</div>
              <div className="nav-list">
                {groups[squadName].map((o) => {
                  const alertCount = obraAlertCount(o);
                  const active = selected === o.id;
                  return (
                    <button key={o.id} className={`nav-item ${active ? "active" : ""}`} onClick={() => onSelect(o.id)}>
                      <Building2 size={16} className="nav-icon" />
                      <div className="nav-item-text">
                        <div className="nav-item-name">{o.nome}</div>
                        <div className="nav-item-sub mono">#{o.codigo} · {o.area}m²</div>
                      </div>
                      {alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="nav-group-label">MÓDULOS</div>
        <div className="nav-list">
          <button className={`nav-item ${modulo === "novas" ? "active" : ""}`} onClick={() => onModulo("novas")}>
            <Sparkle size={16} className="nav-icon" />
            <div className="nav-item-text"><div className="nav-item-name">Novas obras</div><div className="nav-item-sub">vindas do Monday</div></div>
            {novasCount > 0 && <span className="nav-badge nav-badge-novo">{novasCount}</span>}
          </button>
          <button className={`nav-item ${modulo === "a_contratar" ? "active" : ""}`} onClick={() => onModulo("a_contratar")}><ClipboardList size={16} className="nav-icon" /><div className="nav-item-text"><div className="nav-item-name">A Contratar</div><div className="nav-item-sub">todas as obras</div></div></button>
          <button className={`nav-item ${modulo === "arquivo" ? "active" : ""}`} onClick={() => onModulo("arquivo")}>
            <Archive size={16} className="nav-icon" />
            <div className="nav-item-text"><div className="nav-item-name">Arquivo</div><div className="nav-item-sub">obras concluídas</div></div>
            {arquivoCount > 0 && <span className="nav-count">{arquivoCount}</span>}
          </button>
          <button className={`nav-item ${modulo === "precos" ? "active" : ""}`} onClick={() => onModulo("precos")}>
            <PackageSearch size={16} className="nav-icon" />
            <div className="nav-item-text"><div className="nav-item-name">Banco de Preços</div><div className="nav-item-sub">insumos do Sienge</div></div>
          </button>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="profile">
          <div className="avatar avatar-sm">PW</div>
          <div className="profile-text"><div className="profile-name">Priscila Wayhs</div><div className="profile-email">priscila.wayhs@groupws…</div></div>
          <ChevronRight size={14} className="dim" />
        </div>
        <div className="collapse-row"><ChevronLeft size={13} /> Recolher</div>
      </div>
    </aside>
  );
}

function TabBar({ tab, onChange, obra }) {
  const bloqueado = !obra.deparaAprovado;
  const tabs = [
    { id: "vendido_contrato", label: "Vendido Contrato", icon: FileText },
    { id: "vendido_planilha", label: "Vendido Planilha", icon: FileText },
    { id: "vendido_conferencia", label: "Depara Contrato x Planilha", icon: GitCompare },
    { id: "executivo", label: "Executivo", icon: BookOpen, gate: bloqueado },
    { id: "executivo_conferencia", label: "Conf. Executivo", icon: GitCompare, gate: bloqueado },
    { id: "comparativo", label: "Planilha de Compra", icon: LayoutGrid },
    { id: "compras", label: "Compras de Produtos", icon: ShoppingCart },
    { id: "contratos", label: "Contratos", icon: Link2 },
  ];
  return (
    <div className="tabbar">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => onChange(t.id)}>
            <Icon size={14} /> {t.label} {t.gate && <Lock size={11} className="dim" />}
          </button>
        );
      })}
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
function comprasItens(obra) {
  const out = [];
  obra.categorias.forEach((cat, catIdx) => {
    (cat.itens || []).forEach((it, itemIdx) => {
      if (it.tipo === "produto") out.push({ it, catIdx, itemIdx, catNum: cat.num, catNome: cat.nome });
    });
  });
  return out;
}

const isFalta = (it) => it.liberado && !it.lancadoSienge && !it.comprado;
const isLancado = (it) => it.lancadoSienge && !it.comprado;
const isComprado = (it) => !!it.comprado;
const isSemInsumo = (it) => isFalta(it) && (it.sienge?.status === "nao_encontrado");

function ComprasRow({ row, onItemChange }) {
  const { it, catNum, catNome } = row;
  const [sugAberta, setSugAberta] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const status = it.sienge?.status || (it.contavel ? "nao_encontrado" : null);
  const codigo = it.sienge?.codigo;
  const sug = it.sugestaoSienge;

  let badge = null;
  if (status === "match") badge = <span className="sg-badge sg-match"><CheckCircle2 size={12} /> Sienge {codigo} · confere</span>;
  else if (status === "parcial") badge = <span className="sg-badge sg-parcial"><AlertTriangle size={12} /> Sienge {codigo} · revisar</span>;
  else if (status === "nao_encontrado") badge = <span className="sg-badge sg-nao"><XCircle size={12} /> Sem insumo — cadastrar</span>;

  // Status do processo é uma TAG (não há integração com o Sienge): o
  // comprador lança/cadastra por fora e marca aqui em que fase está.
  const estado = it.comprado ? "comprado" : it.lancadoSienge ? "lancado" : "falta";
  const setEstado = (v) => {
    if (v === "falta") onItemChange({ lancadoSienge: false, comprado: false });
    else if (v === "lancado") onItemChange({ lancadoSienge: true, comprado: false });
    else onItemChange({ lancadoSienge: true, comprado: true });
  };

  const textoSug = sug ? `${sug.marca} / ${sug.descricao} / ${sug.cor} / ${sug.codigo}` : "";
  const copiar = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(textoSug);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <div className="compras-rowwrap">
      <div className="compras-row">
        <div className="compras-row-main">
          <div className="compras-desc">{it.desc}</div>
          <div className="compras-meta mono">{catNum} · {catNome} · {it.ambiente} · {it.qtdExecutivo ?? "—"} {it.un}</div>
        </div>
        <div className="compras-custo mono">{fmtBRL(it.custo)}</div>
        <div className="compras-sg">
          {badge}
          {status === "nao_encontrado" && sug && (
            <button className="sug-toggle" onClick={() => setSugAberta((v) => !v)}>
              <Sparkles size={11} /> {sugAberta ? "ocultar sugestão" : "sugestão de cadastro"}
            </button>
          )}
        </div>
        <div className="compras-acao">
          <select className={`proc-tag proc-${estado}`} value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Status do processo de compra">
            <option value="falta">Falta lançar no Sienge</option>
            <option value="lancado">Lançado no Sienge</option>
            <option value="comprado">Comprado</option>
          </select>
        </div>
      </div>
      {sugAberta && sug && (
        <div className="sugestao-sienge">
          <div className="sug-title"><Sparkles size={12} /> Sugestão para cadastrar no Sienge <span className="sug-warn">confirme antes de usar</span></div>
          <div className="sug-row">
            <code className="sug-code">{textoSug}</code>
            <button className="sug-copy" onClick={copiar}><Copy size={13} /> {copiado ? "Copiado!" : "Copiar"}</button>
          </div>
          <div className="sug-fmt">Formato: MARCA / DESCRIÇÃO / COR / CÓDIGO</div>
        </div>
      )}
    </div>
  );
}

function ComprasView({ obra, onItemChange }) {
  const [filtro, setFiltro] = useState("falta");
  const [recolhidos, setRecolhidos] = useState(() => new Set());
  const toggleGrupo = (num) => setRecolhidos((prev) => { const n = new Set(prev); n.has(num) ? n.delete(num) : n.add(num); return n; });
  const rows = useMemo(() => comprasItens(obra), [obra]);

  if (rows.length === 0) {
    return (
      <div className="compras-empty">
        <ShoppingCart size={30} className="dim" />
        <div className="compras-empty-title">Esta obra ainda não tem produtos no executivo</div>
        <div className="compras-empty-sub">Quando o executivo for carregado, os produtos liberados aparecem aqui pra você lançar no Sienge.</div>
      </div>
    );
  }

  const soma = (pred) => rows.filter((r) => pred(r.it)).reduce((a, r) => a + (r.it.custo || 0), 0);
  const cnt = (pred) => rows.filter((r) => pred(r.it)).length;

  const filtros = [
    { id: "falta", label: "Falta lançar", pred: isFalta },
    { id: "sem_insumo", label: "Sem insumo Sienge", pred: isSemInsumo },
    { id: "lancado", label: "Lançado", pred: isLancado },
    { id: "comprado", label: "Comprado", pred: isComprado },
    { id: "todos", label: "Todos", pred: () => true },
  ];
  const pred = filtros.find((f) => f.id === filtro).pred;
  const visiveis = rows.filter((r) => pred(r.it));

  return (
    <>
      <div className="compras-buckets">
        <div className="bucket bucket-falta">
          <div className="bucket-label"><Upload size={13} /> Falta lançar no Sienge</div>
          <div className="bucket-num">{cnt(isFalta)} <span>itens</span></div>
          <div className="bucket-sub">{fmtCompactBRL(soma(isFalta))} aguardando</div>
        </div>
        <div className="bucket">
          <div className="bucket-label"><Clock size={13} /> Lançado, aguardando compra</div>
          <div className="bucket-num" style={{ color: "var(--blue)" }}>{cnt(isLancado)} <span>itens</span></div>
          <div className="bucket-sub">{fmtCompactBRL(soma(isLancado))} no Sienge</div>
        </div>
        <div className="bucket">
          <div className="bucket-label"><Check size={13} /> Comprado</div>
          <div className="bucket-num" style={{ color: "var(--green)" }}>{cnt(isComprado)} <span>itens</span></div>
          <div className="bucket-sub">{fmtCompactBRL(soma(isComprado))} concluído</div>
        </div>
      </div>

      {cnt(isSemInsumo) > 0 && (
        <div className="compras-alerta">
          <AlertTriangle size={16} />
          <span><b>{cnt(isSemInsumo)} {cnt(isSemInsumo) === 1 ? "produto sem insumo" : "produtos sem insumo"} no Sienge</b> — {cnt(isSemInsumo) === 1 ? "precisa" : "precisam"} de cadastro antes de lançar ({fmtCompactBRL(soma(isSemInsumo))})</span>
        </div>
      )}

      <div className="compras-filtros">
        {filtros.map((f) => (
          <button key={f.id} className={`cfiltro ${filtro === f.id ? "active" : ""}`} onClick={() => setFiltro(f.id)}>
            {f.label} <span className="cbadge">{cnt(f.pred)}</span>
          </button>
        ))}
      </div>

      {(() => {
        if (visiveis.length === 0) return <div className="empty-note">Nada neste filtro.</div>;
        const porVerba = [];
        visiveis.forEach((r) => {
          let g = porVerba.find((x) => x.num === r.catNum);
          if (!g) { g = { num: r.catNum, nome: r.catNome, rows: [] }; porVerba.push(g); }
          g.rows.push(r);
        });
        porVerba.sort((a, b) => String(a.num).localeCompare(String(b.num), undefined, { numeric: true }));
        return porVerba.map((g) => {
          const recolhido = recolhidos.has(g.num);
          return (
            <div key={g.num} className="compras-grupo">
              <button className="compras-grupo-head" onClick={() => toggleGrupo(g.num)}>
                {recolhido ? <ChevronRight size={15} className="dim" /> : <ChevronDown size={15} className="dim" />}
                <span className="cg-num mono">{g.num}</span>
                <span className="cg-nome">{g.nome}</span>
                <span className="cg-meta mono">{g.rows.length} {g.rows.length === 1 ? "item" : "itens"} · {fmtBRL(g.rows.reduce((a, r) => a + (r.it.custo || 0), 0))}</span>
              </button>
              {!recolhido && (
                <div className="compras-list">
                  {g.rows.map((r) => (
                    <ComprasRow key={`${r.catIdx}-${r.itemIdx}`} row={r} onItemChange={(patch) => onItemChange(r.catIdx, r.itemIdx, patch)} />
                  ))}
                </div>
              )}
            </div>
          );
        });
      })()}
    </>
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

function contratosItens(obra) {
  const out = [];
  obra.categorias.forEach((cat, catIdx) => {
    (cat.itens || []).forEach((it, itemIdx) => {
      if (it.tipo !== "produto") out.push({ it, catIdx, itemIdx, catNum: cat.num, catNome: cat.nome });
    });
  });
  return out;
}

const contratoBloqueado = (it) => it.foraDeEscopo && it.statusEscopo !== "aprovado";
const contratoEtapa = (it) => it.statusContrato || "nao_solicitado";

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

function ContratosView({ obra, onItemChange, onCriarSolicitacao }) {
  const [filtro, setFiltro] = useState("todos");
  const rows = useMemo(() => contratosItens(obra), [obra]);

  if (rows.length === 0) {
    return (
      <div className="compras-empty">
        <FileText size={30} className="dim" />
        <div className="compras-empty-title">Esta obra ainda não tem serviços no executivo</div>
        <div className="compras-empty-sub">Quando o executivo for carregado, os serviços e o andamento dos contratos aparecem aqui. Ou crie uma solicitação avulsa abaixo.</div>
        <NovaSolicitacaoForm obra={obra} onCriar={onCriarSolicitacao} />
      </div>
    );
  }

  const naoBloq = rows.filter((r) => !contratoBloqueado(r.it));
  const bloqueados = rows.filter((r) => contratoBloqueado(r.it));
  const cntEtapa = (id) => naoBloq.filter((r) => contratoEtapa(r.it) === id).length;
  const somaEtapa = (id) => naoBloq.filter((r) => contratoEtapa(r.it) === id).reduce((a, r) => a + (r.it.custo || 0), 0);
  const visiveis = filtro === "todos" ? naoBloq : naoBloq.filter((r) => contratoEtapa(r.it) === filtro);

  return (
    <>
      <div className="contratos-toolbar">
        <NovaSolicitacaoForm obra={obra} onCriar={onCriarSolicitacao} />
      </div>
      <div className="pipeline">
        {CONTRATO_PIPELINE.map((st, i) => (
          <React.Fragment key={st.id}>
            <button className={`pipe-node ${filtro === st.id ? "active" : ""}`} style={filtro === st.id ? { borderColor: st.color } : undefined} onClick={() => setFiltro(filtro === st.id ? "todos" : st.id)}>
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

      <div className="compras-filtros">
        <button className={`cfiltro ${filtro === "todos" ? "active" : ""}`} onClick={() => setFiltro("todos")}>Todos <span className="cbadge">{naoBloq.length}</span></button>
        {CONTRATO_PIPELINE.map((st) => (
          <button key={st.id} className={`cfiltro ${filtro === st.id ? "active" : ""}`} onClick={() => setFiltro(st.id)}>{st.curto} <span className="cbadge">{cntEtapa(st.id)}</span></button>
        ))}
      </div>

      <div className="compras-list">
        {visiveis.length === 0 && <div className="empty-note">Nada nesta etapa.</div>}
        {visiveis.map((r) => (
          <ContratosRow key={`${r.catIdx}-${r.itemIdx}`} row={r} onItemChange={(patch) => onItemChange(r.catIdx, r.itemIdx, patch)} />
        ))}
      </div>
    </>
  );
}

/* ============================================================
   MÓDULO A CONTRATAR
   Dashboard de TODAS as obras: quanto falta contratar (mão de obra)
   e comprar (produtos), agregado por verba da EAP, com filtro de
   período. Responde "quanto tenho pra contratar de elétrica nos
   próximos 6 meses".
   ============================================================ */

function aContratarAgrega(obras) {
  const servicos = {};
  const produtos = {};
  obras.forEach((o) => {
    o.categorias.forEach((cat) => {
      (cat.itens || []).forEach((it) => {
        const bucket = it.tipo === "produto" ? produtos : servicos;
        const key = cat.num;
        if (!bucket[key]) bucket[key] = { num: cat.num, nome: cat.nome, total: 0, itens: 0, obras: new Set() };
        bucket[key].total += it.custo || 0;
        bucket[key].itens += 1;
        bucket[key].obras.add(o.codigo);
      });
    });
  });
  const toArr = (b) => Object.values(b).filter((g) => g.total > 0).sort((a, z) => z.total - a.total);
  return { servicos: toArr(servicos), produtos: toArr(produtos) };
}

function AContratarBloco({ titulo, Icone, grupos, total, cor }) {
  const max = grupos.length ? grupos[0].total : 1;
  return (
    <div className="ac-bloco">
      <div className="ac-bloco-head">
        <Icone size={15} style={{ color: cor }} />
        <span className="ac-bloco-titulo">{titulo}</span>
        <span className="ac-bloco-total mono" style={{ color: cor }}>{fmtBRL(total)}</span>
      </div>
      <div className="ac-list">
        {grupos.length === 0 && <div className="empty-note">Nada a contratar neste recorte.</div>}
        {grupos.map((g) => (
          <div key={g.num} className="ac-row">
            <span className="ac-num mono">{g.num}</span>
            <span className="ac-nome">{g.nome}</span>
            <span className="ac-obras">{g.obras.size} {g.obras.size === 1 ? "obra" : "obras"} · {g.itens} {g.itens === 1 ? "item" : "itens"}</span>
            <div className="ac-bar-track"><div className="ac-bar" style={{ width: `${(g.total / max) * 100}%`, background: cor }} /></div>
            <span className="ac-val mono">{fmtBRL(g.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AContratarView({ obras }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const { servicos, produtos } = useMemo(() => aContratarAgrega(obras), [obras]);
  const totServ = servicos.reduce((a, g) => a + g.total, 0);
  const totProd = produtos.reduce((a, g) => a + g.total, 0);

  return (
    <>
      <div className="ac-filtros">
        <div className="ac-periodo">
          <span className="ac-periodo-label">Período de contratação:</span>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          <span className="dim">até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          {(de || ate) && <button className="ac-limpar" onClick={() => { setDe(""); setAte(""); }}>limpar</button>}
        </div>
        <div className="ac-periodo-nota">O filtro por período usa o cronograma da obra no Monday — ligação ainda pendente; por enquanto mostra o total de todas as obras.</div>
      </div>

      <AContratarBloco titulo="Mão de obra a contratar" Icone={FileText} grupos={servicos} total={totServ} cor="var(--blue)" />
      <AContratarBloco titulo="Produtos a comprar" Icone={ShoppingCart} grupos={produtos} total={totProd} cor="var(--green)" />
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

function NovasObrasView({ obras, onStart, salvando, semBanco }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtradas = obras.filter((o) => !q || `${o.nome} ${o.codigo} ${o.squad}`.toLowerCase().includes(q));

  const grupos = {};
  filtradas.forEach((o) => { (grupos[o.squad || "Sem squad"] ||= []).push(o); });
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
function BarraEdicao({ edicao, salvando, carregando, onHabilitar, onFinalizar }) {
  if (carregando) {
    return <div className="barra-edicao"><span className="dim">Carregando o que já foi salvo desta obra…</span></div>;
  }

  if (edicao.por) {
    const desde = edicao.desde ? new Date(edicao.desde).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
    return (
      <div className="barra-edicao travada">
        <Lock size={14} />
        <span><b>{edicao.por}</b> está editando{desde ? ` desde ${desde}` : ""} — você está vendo, mas não pode alterar.</span>
        <span className="barra-edicao-nota">Libera sozinho após {MINUTOS_ATE_TRAVA_EXPIRAR} min sem alteração.</span>
      </div>
    );
  }

  if (edicao.minha) {
    return (
      <div className="barra-edicao editando">
        <ShieldCheck size={14} />
        <span>Você está editando esta obra. As alterações são salvas sozinhas.</span>
        <span className="barra-edicao-status">
          {salvando === "salvando" ? "salvando…" : salvando === "salvo" ? "salvo ✓" : ""}
        </span>
        <button className="btn-finalizar" onClick={onFinalizar} disabled={salvando === "salvando"}>
          Finalizar e liberar
        </button>
      </div>
    );
  }

  return (
    <div className="barra-edicao">
      <span className="dim">Modo leitura — habilite a edição para alterar esta obra.</span>
      <button className="btn-habilitar" onClick={onHabilitar}>Habilitar edição</button>
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
  const [modulo, setModulo] = useState("comparativo");
  // Registro das obras no nosso banco: código -> { situacao, ... }.
  // É isso que decide quem aparece na sidebar (ativa), quem está no
  // Arquivo (concluida) e quem ainda é só sugestão do Monday (ausente).
  const [registro, setRegistro] = useState(() => new Map());
  const [erroBanco, setErroBanco] = useState(null);
  const [salvandoObra, setSalvandoObra] = useState(null);
  // null = nenhuma aba aberta: a obra abre mostrando só o cabeçalho e o
  // resumo. Antes a aba ficava onde a pessoa tinha parado na obra
  // ANTERIOR, então trocar de obra caía direto numa tela de trabalho de
  // outra — sem contexto nenhum.
  const [tab, setTab] = useState(null);
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
      })
      .catch((err) => { if (vivo) setErroBanco(err.message || String(err)); });
    return () => { vivo = false; };
  }, []);

  const situacaoDe = (o) => registro.get(String(o.codigo))?.situacao;
  const obrasAtivas = useMemo(() => obras.filter((o) => situacaoDe(o) === "ativa"), [obras, registro]);
  const obrasConcluidas = useMemo(() => obras.filter((o) => situacaoDe(o) === "concluida"), [obras, registro]);
  const obrasNovas = useMemo(() => obras.filter((o) => !situacaoDe(o)), [obras, registro]);

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

    carregarDadosObra(codigo)
      .then((dados) => {
        if (!vivo || !dados) return;
        setObras((prev) => prev.map((o) => (o.codigo === codigo ? {
          ...o,
          categorias: (dados.categorias || []).length ? normalizarCategorias(dados.categorias) : o.categorias,
          cadernos: dados.cadernos,
          aprovacoes: dados.aprovacoes,
          deparaAprovado: dados.deparaAprovado,
          comprasLiberadas: dados.comprasLiberadas,
          // Sem estas três, o CMV liberado se perdia no reload: a aba
          // Executivo continuava aberta (isso é `deparaAprovado`), mas o
          // teto voltava vazio e os blocos que dependem dele — resumo do
          // topo e fechamento do rodapé — simplesmente não renderizavam.
          cmvLiberado: dados.cmvLiberado,
          cmvLiberadoEm: dados.cmvLiberadoEm,
          cmvLiberadoPor: dados.cmvLiberadoPor,
          // Campos DERIVADOS das categorias. Sem refazer a conta aqui, a
          // obra volta do banco com os itens certos e os totais do Monday
          // — que sao zero. O cabecalho dizia "R$ 0,00" numa obra com R$
          // 632 mil em produtos.
          ...derivadosDasCategorias(normalizarCategorias(dados.categorias), o),
        } : o)));
        const deOutro = dados.editandoPor && dados.editandoPor !== usuario;
        setEdicao({
          minha: dados.editandoPor === usuario,
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
        await salvarDadosObra(obra.codigo, obra, usuario);
        setSalvando("salvo");
        setTimeout(() => setSalvando(null), 2000);
      } catch (e) {
        setSalvando(null);
        setErroBanco(`Não consegui salvar: ${e.message || e}`);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [obra, edicao.minha, usuario]);

  async function habilitarEdicao() {
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
      await salvarDadosObra(obra.codigo, obra, usuario);
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

  const pctExecutado = obra && obra.valorVendido > 0 ? (totals.totalExecutivo / obra.valorVendido) * 100 : 0;
  const deltaGood = totals.totalExecutivo <= totals.totalVendido;

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
        (porVerba[it.num] = porVerba[it.num] || []).push({
          codigo: it.codigo, desc: it.desc, ambiente: it.ambiente || "—",
          qtdVendida: it.qtdVendida, un: it.un,
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

  // Edita um valor do Executivo direto na tela. Nem tudo chega pronto do
  // arquivo — na planilha real, lâmpadas e fontes vêm com quantidade e
  // sem custo — então o time completa aqui.
  //
  // Mexe nas duas listas da verba: `itensPlanilhaExecutivo` (o que a tela
  // mostra) e `itens` (o que alimenta Planilha de Compra, Compras e
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
  function adicionarItemExecutivo(catNum, insumo) {
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
        return {
          ...c,
          itensPlanilhaExecutivo: [...(c.itensPlanilhaExecutivo || []), novo],
          itens: [...(c.itens || []), novo],
        };
      });
      return { ...o, categorias };
    }));
  }

  // Libera a Planilha de Compra: a partir daqui, compras e contratações
  // seguem, e nada das etapas anteriores pode mais ser mexido.
  // `estouro` vem preenchido quando o Executivo passou do CMV — traz a
  // justificativa e quem autorizou. Fica gravado na obra: a decisão é de
  // gente, mas o registro não é opcional.
  function liberarCompras(estouro) {
    setObras((prev) => prev.map((o) => (o.id === selectedId ? {
      ...o,
      comprasLiberadas: true,
      compraLiberadaEm: new Date().toISOString(),
      compraLiberadaPor: usuario,
      estouroAprovado: estouro ? { ...estouro, em: new Date().toISOString(), registradoPor: usuario } : null,
    } : o)));
  }

  // Desfaz a liberação. Toda trava precisa de volta — sem isso um clique
  // sem querer congelaria a obra pra sempre.
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
  function importCaderno(chave, info) {
    setObras((prev) => prev.map((o) => (
      o.id === selectedId ? { ...o, cadernos: { ...(o.cadernos || {}), [chave]: info } } : o
    )));
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
          // guarda o que o criativo tinha, pra coluna de comparação
          vendido: casarComCriativo(it, c.itensPlanilha),
        }));
        return { ...c, itens: doArquivo, itensPlanilhaExecutivo: doArquivo };
      });
      return { ...o, categorias };
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

  function handleTabChange(t) { setTab(t); setItemFilter("todos"); setTipoFilter("todos"); }

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@1,500;1,600&family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --page: #FAFAF8; --panel: #F3F2EE; --card: #FFFFFF;
          --border: #E8E5DD; --border-soft: #F0EEE7;
          --ink: #191D21; --ink-2: #565B60; --ink-3: #9A9C9C;
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
        .topbar-brand { display: flex; align-items: center; gap: 11px; flex-shrink: 0; }
        /* mostra só o monograma (recorta o texto "GROUP WS" e as margens
           do PNG oficial, sem alterar o arquivo — nada é distorcido) */
        .brand-logo { width: 46px; height: 38px; object-fit: cover; object-position: top center; display: block; }
        .brand-word { font-weight: 700; font-size: 13px; letter-spacing: 0.06em; color: var(--ink); white-space: nowrap; }
        .aviso-monday { background: var(--amber-bg, #FEF3E2); color: var(--amber, #B7791F); border: 1px solid var(--amber, #E8B04B); border-radius: 8px; padding: 9px 13px; font-size: 12px; font-weight: 500; margin-bottom: 16px; }
        .topbar-search { flex: 1; max-width: 560px; display: flex; align-items: center; gap: 9px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 9px 12px; margin: 0 auto; }
        .topbar-search input { flex: 1; border: none; outline: none; background: transparent; font-size: 13px; color: var(--ink); }
        .topbar-search input::placeholder { color: var(--ink-3); }
        .kbd { font-size: 10.5px; color: var(--ink-3); background: #fff; border: 1px solid var(--border); border-radius: 5px; padding: 2px 6px; font-family: 'JetBrains Mono', monospace; }
        .topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .icon-btn { width: 34px; height: 34px; border-radius: 8px; border: none; background: transparent; display: flex; align-items: center; justify-content: center; color: var(--ink-2); cursor: pointer; position: relative; }
        .icon-btn:hover { background: var(--panel); }
        .notif-dot { position: absolute; top: 3px; right: 3px; background: var(--red); color: #fff; font-size: 9px; font-weight: 700; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--purple); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; }

        .body-layout { display: flex; }
        .sidebar { width: 288px; flex-shrink: 0; background: #fff; border-right: 1px solid var(--border); height: calc(100vh - 64px); position: sticky; top: 64px; display: flex; flex-direction: column; justify-content: space-between; }
        .sidebar-scroll { padding: 16px 14px; overflow-y: auto; display: flex; flex-direction: column; min-height: 0; }
        .nav-group-label { font-size: 10.5px; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 8px; margin: 14px 0 8px; }
        .nav-group-label:first-child { margin-top: 0; }
        .obra-search { display: flex; align-items: center; gap: 7px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 7px 9px; margin-bottom: 8px; }
        .obra-search input { flex: 1; border: none; outline: none; background: transparent; font-size: 12px; color: var(--ink); }
        .obra-search input::placeholder { color: var(--ink-3); }
        .clear-btn { border: none; background: transparent; color: var(--ink-3); cursor: pointer; display: flex; }
        .alert-toggle { display: flex; align-items: center; gap: 6px; width: 100%; background: transparent; border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; font-size: 11px; color: var(--ink-2); cursor: pointer; margin-bottom: 10px; }
        .alert-toggle.active { background: var(--red-bg); border-color: var(--red); color: var(--red); font-weight: 600; }
        .squad-filter { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
        .squad-chip { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 4px 10px; font-size: 10.5px; font-weight: 500; color: var(--ink-2); cursor: pointer; }
        .squad-chip:hover { border-color: var(--blue); }
        .squad-chip.active { background: var(--ink); border-color: var(--ink); color: #fff; font-weight: 600; }
        .squad-group { margin-bottom: 10px; }
        .squad-group-label { font-size: 9.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 8px; }
        .scroll-list { max-height: 320px; overflow-y: auto; padding-right: 2px; }
        .no-results { font-size: 11.5px; color: var(--ink-3); padding: 10px 6px; }
        .nav-list { display: flex; flex-direction: column; gap: 2px; }
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
        .sidebar-footer { border-top: 1px solid var(--border); padding: 12px 14px; }
        .profile { display: flex; align-items: center; gap: 9px; padding: 7px 6px; border-radius: 8px; cursor: pointer; }
        .profile:hover { background: var(--panel); }
        .avatar-sm { width: 28px; height: 28px; font-size: 10.5px; }
        .profile-text { flex: 1; min-width: 0; }
        .profile-name { font-size: 12px; font-weight: 600; }
        .profile-email { font-size: 10.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .collapse-row { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--ink-3); margin-top: 8px; padding: 0 6px; cursor: pointer; }

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

        .resumo-label { font-size: 11px; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 12px 4px; }
        .resumo-panel { background: var(--panel); border-radius: 16px; padding: 16px; display: grid; grid-template-columns: repeat(4, 1fr) 250px; gap: 12px; margin-bottom: 28px; }
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
        .pill { font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
        .pill-ok { background: var(--green-bg); color: var(--green); }
        .pill-wait { background: var(--panel); color: var(--ink-3); }
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
        .vend-itens td { overflow-wrap: anywhere; word-break: break-word; }
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
        .linha-excluida { background: var(--red-bg, #FDEEEC); }
        .linha-excluida td { color: var(--ink-3); text-decoration: line-through; }
        .linha-excluida td:nth-child(2) { text-decoration: none; }
        .exec-itens tr.linha-excluida td:nth-child(1), .exec-itens tr.linha-excluida td:nth-child(2) { background: var(--red-bg, #FDEEEC); }
        .tag-excluido { margin-left: 8px; font-size: 10px; font-weight: 600; color: var(--red); background: #fff; border: 1px solid var(--red); border-radius: 20px; padding: 1px 7px; white-space: nowrap; text-decoration: none; display: inline-block; }
        .btn-linha-excluir { background: none; border: 1px solid transparent; border-radius: 6px; padding: 3px; color: var(--ink-3); cursor: pointer; display: inline-flex; }
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
        .exec-scroll { overflow-x: auto; border-top: 1px solid var(--border-soft); }
        /* table-layout: fixed é o que mantém as colunas alinhadas entre
           os grupos. Sem ele o navegador dimensiona cada tabela pelo
           conteúdo dela, e como cada verba é uma tabela separada, cada
           uma saía com larguras próprias. Bastava um grupo ter conteúdo
           incomum — em Climatização, uma URL de 200 caracteres sem
           espaço — pra desalinhar tudo naquele grupo. */
        .exec-itens { font-size: 11px; width: 100%; min-width: 1080px; border-top: none; table-layout: fixed; }
        .exec-itens th, .exec-itens td { padding: 6px 7px; }
        /* texto sem espaço (URL, código longo) quebra em vez de esticar */
        .exec-itens td { overflow-wrap: anywhere; word-break: break-word; vertical-align: middle; }

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
        .exec-itens th:nth-child(2), .exec-itens td:nth-child(2) { position: sticky; left: 52px; z-index: 2; background: #FCFBF8; box-shadow: 1px 0 0 var(--border-soft); }
        .exec-itens thead th:nth-child(1), .exec-itens thead th:nth-child(2) { z-index: 4; background: #F7F5F0; }
        /* O cabecalho acompanha a rolagem: editando uma linha la
           embaixo, sem isso nao da pra saber que coluna e qual. */
        .exec-itens thead th { position: sticky; top: 0; z-index: 3; background: #F7F5F0; }
        .celula-corte.editavel { cursor: text; border-radius: 4px; padding: 1px 3px; margin: -1px -3px; }
        .celula-corte.editavel:hover { background: #fff; box-shadow: inset 0 0 0 1px var(--border); }
        .celula-input.texto { text-align: left; font-family: inherit; }
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
        .grupo-alerta svg { color: #B54708; flex-shrink: 0; margin-top: 1px; }
        .grupo-alerta b { color: #B54708; text-transform: uppercase; font-weight: 700; font-size: 11px; letter-spacing: 0.01em; }
        /* Marca a verba com alerta mesmo com o grupo fechado */
        .vend-alerta-mark { display: inline-flex; align-items: center; color: #B54708; flex-shrink: 0; }
        .exec-itens tr.linha-titulo td:nth-child(1), .exec-itens tr.linha-titulo td:nth-child(2) { background: var(--panel); }
        .exec-itens tr.linha-alterada td:nth-child(1), .exec-itens tr.linha-alterada td:nth-child(2) { background: #FFF2CC; }
        .exec-itens th { line-height: 1.25; }
        .exec-itens td.forte { color: var(--ink); font-weight: 600; }
        .exec-total-parcelas { font-size: 11.5px; color: var(--ink-3); margin-right: 14px; }
        /* Colunas de origem: o que veio do criativo e o quanto mudou */
        .exec-itens .col-vendido { background: #FAFAF8; }
        .vend-delta { font-size: 11px; font-weight: 600; flex-shrink: 0; margin-right: 4px; cursor: help; }
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
        .celula-input { width: 100%; border: 1px solid var(--blue); border-radius: 5px; padding: 2px 5px; font-size: 11.5px; text-align: right; outline: none; background: #fff; font-family: 'JetBrains Mono', monospace; }
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
        .linha-alterada { background: #FFF2CC; }
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
        .barra-edicao { display: flex; align-items: center; gap: 10px; background: var(--panel); border: 1px solid var(--border); border-radius: 9px; padding: 9px 14px; font-size: 12px; color: var(--ink-2); margin-bottom: 20px; }
        .barra-edicao.editando { background: #EAF4EC; border-color: var(--green); color: #2C6B3F; }
        .barra-edicao.travada { background: var(--amber-bg, #FEF3E2); border-color: var(--amber, #E8B04B); color: var(--amber, #B7791F); }
        .barra-edicao-status { margin-left: auto; font-size: 11px; opacity: 0.75; font-family: 'JetBrains Mono', monospace; }
        .barra-edicao-nota { margin-left: auto; font-size: 11px; opacity: 0.8; }
        .btn-habilitar, .btn-finalizar { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; font-size: 12px; font-weight: 600; padding: 6px 13px; cursor: pointer; font-family: inherit; white-space: nowrap; flex-shrink: 0; }
        .btn-habilitar { margin-left: auto; background: var(--blue); color: #fff; border: 1px solid var(--blue); }
        .btn-finalizar { background: #fff; color: #2C6B3F; border: 1px solid var(--green); }
        .btn-habilitar:hover, .btn-finalizar:hover { filter: brightness(1.05); }
        .btn-finalizar:disabled { opacity: 0.55; cursor: default; }

        .caderno-info { flex: 1; min-width: 0; }
        .caderno-nome { font-size: 13px; font-weight: 600; color: var(--ink); }
        .caderno-meta { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
        .tab .dim { margin-left: 2px; vertical-align: -1px; }
        /* ---- Módulo A Contratar ---- */
        .ac-filtros { margin: 18px 0 18px; }
        .ac-periodo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .ac-periodo-label { font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
        .ac-periodo input[type="date"] { border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; font-size: 12.5px; font-family: 'Inter', sans-serif; color: var(--ink); background: #fff; }
        .ac-limpar { background: none; border: none; color: var(--blue); font-size: 12px; font-weight: 600; cursor: pointer; }
        .ac-periodo-nota { font-size: 11px; color: var(--ink-3); font-style: italic; margin-top: 7px; }
        .ac-bloco { margin-bottom: 22px; }
        .ac-bloco-head { display: flex; align-items: center; gap: 8px; padding: 8px 2px; border-bottom: 2px solid var(--ink); margin-bottom: 4px; }
        .ac-bloco-titulo { font-size: 14px; font-weight: 700; color: var(--ink); }
        .ac-bloco-total { margin-left: auto; font-size: 15px; font-weight: 700; }
        .ac-row { display: flex; align-items: center; gap: 12px; padding: 11px 4px; border-bottom: 1px solid var(--border-soft); }
        .ac-num { font-size: 11px; color: var(--ink-3); font-weight: 600; width: 22px; flex-shrink: 0; }
        .ac-nome { font-size: 13px; color: var(--ink); font-weight: 600; width: 230px; flex-shrink: 0; }
        .ac-obras { font-size: 11px; color: var(--ink-3); width: 130px; flex-shrink: 0; }
        .ac-bar-track { flex: 1; min-width: 60px; height: 8px; background: var(--panel); border-radius: 20px; overflow: hidden; }
        .ac-bar { height: 100%; border-radius: 20px; }
        .ac-val { font-size: 13px; color: var(--ink); width: 96px; text-align: right; flex-shrink: 0; }
      `}</style>

      <TopBar />
      <div className="body-layout">
        <Sidebar obras={obrasAtivas} selected={selectedId} modulo={modulo} onModulo={setModulo}
          novasCount={obrasNovas.length} arquivoCount={obrasConcluidas.length}
          onSelect={(id) => { setSelectedId(id); setItemFilter("todos"); setTipoFilter("todos"); setTab(null); setModulo("comparativo"); }} />

        {/* As abas de planilha usam a tela inteira: são 13 colunas e não
            cabem na largura de leitura que serve pro resto do app. */}
        <main className={`main ${["executivo", "vendido_planilha", "vendido_contrato"].includes(tab) ? "larga" : ""}`}>
          {avisoMonday && <div className="aviso-monday">{avisoMonday}</div>}
          {erroBanco && <div className="aviso-monday">{erroBanco}</div>}
          {modulo === "novas" ? (
          <>
          <div className="eyebrow">DO MONDAY · {obrasNovas.length}</div>
          <div className="title-row"><span className="title-accent">Novas obras</span></div>
          <div className="obra-meta">Obras que ainda não foram iniciadas aqui</div>
          <NovasObrasView obras={obrasNovas} onStart={darStart} salvando={salvandoObra} semBanco={!supabaseConfigurado} />
          </>
          ) : modulo === "arquivo" ? (
          <>
          <div className="eyebrow">CONCLUÍDAS · {obrasConcluidas.length}</div>
          <div className="title-row"><span className="title-accent">Arquivo</span></div>
          <div className="obra-meta">Obras encerradas, mantidas para consulta</div>
          <ArquivoView obras={obrasConcluidas} onReabrir={marcarAtiva} salvando={salvandoObra} />
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
          <div className="title-row"><span className="title-accent">A Contratar</span></div>
          <div className="obra-meta">Planejamento do que precisa ser contratado (mão de obra) e comprado (produtos), por verba da EAP</div>
          <AContratarView obras={obrasAtivas} />
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
            <button className="btn-concluir" disabled={salvandoObra === obra.id} onClick={() => marcarConcluida(obra)}>
              {salvandoObra === obra.id ? "Concluindo…" : <><Archive size={13} /> Concluir obra</>}
            </button>
          </div>
          <div className="obra-meta">{obra.endereco} · {obra.cliente}</div>

          <BarraEdicao
            edicao={edicao} salvando={salvando} carregando={carregandoDados}
            onHabilitar={habilitarEdicao} onFinalizar={finalizarEdicao} />

          <div className="resumo-label">RESUMO FINANCEIRO</div>
          <div className="resumo-panel">
            <BigCard label="Valor vendido (contrato)" value={fmtCompactBRL(obra.valorVendido)} sub={fmtBRL(obra.valorVendido)} />
            <BigCard label="Somatório do executivo" value={fmtCompactBRL(totals.totalExecutivo)}
              delta={`${pctExecutado.toFixed(0)}%`} deltaGood={deltaGood} sub={`${deltaGood ? "dentro do" : "acima do"} valor vendido`} />
            <BigCard label="% comprado" value={`${totals.pct.toFixed(0)}%`} progress={totals.pct}
              sub={`${fmtCompactBRL(totals.totalComprado)} de ${fmtCompactBRL(totals.totalProdutos)} em produtos`} />
            <BigCard label="Falta comprar" value={fmtCompactBRL(totals.falta)} sub="em produtos já liberados" />
            <div className="mini-stats">
              <MiniStat label="Categorias em estouro crítico" value={totals.criticos} tone={totals.criticos > 0 ? "var(--red)" : "var(--green)"} />
              <MiniStat label="Itens com alerta de escopo/qtd." value={totals.itensAlerta} tone={totals.itensAlerta > 0 ? "var(--amber)" : "var(--green)"} />
              <MiniStat label="Prazo de execução" value={obra.prazo ? `${obra.prazo} dias` : "—"} />
            </div>
          </div>

          <TabBar tab={tab} onChange={handleTabChange} obra={obra} />

          {tab === null && <div className="escolha-aba">Escolha uma etapa acima para começar.</div>}
          {tab === "vendido_contrato" && <VendidoContratoView obra={obra} onImportContrato={importVendidoContrato} onLimpar={() => limparImportacao(["itensContrato"])} podeEditar={edicao.minha} />}
          {tab === "vendido_planilha" && <VendidoPlanilhaView obra={obra} onImportPlanilha={importVendidoPlanilha} onLimpar={() => limparImportacao(["itensPlanilha"])} podeEditar={edicao.minha} />}
          {tab === "vendido_conferencia" && <DeparaContratoPlanilhaView obra={obra} onAprovar={aprovarDepara} onEditarPlanilha={editarItemPlanilha} podeEditar={edicao.minha} />}
          {tab === "executivo" && (obra.deparaAprovado ? <ExecutivoView obra={obra} onImportCaderno={importCaderno} onImportPlanilhaExecutivo={importPlanilhaExecutivo} onEditarItem={editarItemExecutivo} onAdicionarItem={adicionarItemExecutivo} onPuxarDoCriativo={puxarDoCriativo} onIrParaDepara={() => handleTabChange("vendido_conferencia")} onLimparExecutivo={() => limparImportacao(["itensPlanilhaExecutivo", "itens"])} podeEditar={edicao.minha} /> : <FaseBloqueada onIrParaDepara={() => handleTabChange("vendido_conferencia")} />)}
          {tab === "executivo_conferencia" && (obra.deparaAprovado ? <ExecutivoConferenciaView obra={obra} onEditarPlanilhaExecutivo={editarItemPlanilhaExecutivo} podeEditar={edicao.minha} /> : <FaseBloqueada onIrParaDepara={() => handleTabChange("vendido_conferencia")} />)}
          {tab === "comparativo" && (
            <ComparativoView obra={obra} expandedCats={expandedCats} toggleCat={toggleCat} updateItem={updateItem} itemFilter={itemFilter} setItemFilter={setItemFilter} tipoFilter={tipoFilter} setTipoFilter={setTipoFilter} onLiberar={liberarCompras} onReabrir={reabrirCompras} podeEditar={edicao.minha} />
          )}
          {tab === "compras" && <ComprasView obra={obra} onItemChange={updateItem} />}
          {tab === "contratos" && <ContratosView obra={obra} onItemChange={updateItem} onCriarSolicitacao={criarSolicitacaoContrato} />}
          </>
          )}
        </main>
      </div>
    </div>
  );
}
