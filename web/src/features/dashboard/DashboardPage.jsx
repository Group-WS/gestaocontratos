import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent,
  Input, Label, PageShell, Progress, Skeleton,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@group-ws/ws-ui";
import { ArrowRight, Building2, CalendarDays, CircleDollarSign, TriangleAlert, CheckCircle2, Circle, ChevronRight, ClipboardList, Search } from "lucide-react";

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const compactMoney = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 2 }).format(value);
const date = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Sem data de entrega";
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const options = (rows, key) => [...new Set(rows.map((row) => row[key]))].sort((a, b) => a.localeCompare(b, "pt-BR"));

function Choice({ label, value, values, onChange, disabled = false, allLabel = "Todas" }) {
  const id = React.useId();
  return <div className="flex w-32 flex-col gap-1 min-w-0">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">{allLabel}</SelectItem>
        {values.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}

function Status({ critical, attention }) {
  return <Badge tone={critical ? "danger" : attention ? "warning" : "success"}>
    {critical ? "Crítica" : attention ? "Atenção" : "No prazo"}
  </Badge>;
}

function Percentage({ value, label }) {
  if (value == null) return <span className="text-text-mute">Sem planilha</span>;
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return <div className="flex flex-col gap-2 min-w-16" title={label}>
    <span className="text-sm font-semibold">{percent}%</span>
    <Progress value={percent} aria-label={label} />
  </div>;
}

export default function DashboardPage({ title = "Visão geral das obras", rows, loading, error, onRetry, onOpen, extraAlerts = [], memory }) {
  const [filters, setFilters] = useState(() => {
    if (memory?.current.filters) return memory.current.filters;
    const query = new URLSearchParams(window.location.search);
    return { unit: query.get("dash-unit") || "all", squad: query.get("dash-squad") || "all", gc: "all", search: "", order: query.get("dash-order") || "risk" };
  });
  const [search, setSearch] = useState(filters.search);
  useEffect(() => { if (memory) memory.current.filters = filters; }, [filters, memory]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [scope, setScope] = useState("all");
  const projectsRef = useRef(null);
  const alertsRef = useRef(null);
  const deliveriesRef = useRef(null);
  const update = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setScope("all"); };
  useEffect(() => { const timeout = setTimeout(() => setSearch(filters.search), 300); return () => clearTimeout(timeout); }, [filters.search]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    for (const key of ["unit", "squad", "order"]) {
      const value = filters[key];
      if (value === "all" || (key === "order" && value === "risk")) query.delete(`dash-${key}`);
      else query.set(`dash-${key}`, value);
    }
    // Busca livre e GC não vão para a URL: podem conter dados pessoais.
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query.size ? `?${query}` : ""}${window.location.hash}`);
  }, [filters.unit, filters.squad, filters.order]);
  const filtered = useMemo(() => rows.filter((row) =>
    (filters.unit === "all" || row.unit === filters.unit) &&
    (filters.squad === "all" || row.squad === filters.squad) &&
    (filters.gc === "all" || row.gc === filters.gc) &&
    (!search || normalize(`${row.code} ${row.name}`).includes(normalize(search)))
  ), [rows, filters.unit, filters.squad, filters.gc, search]);
  const ordered = useMemo(() => [...filtered].sort((a, b) => {
    if (filters.order === "name") return a.name.localeCompare(b.name, "pt-BR");
    if (filters.order === "delivery") return (a.days ?? Infinity) - (b.days ?? Infinity);
    if (filters.order === "purchase") return (b.summary?.mat.falta || 0) - (a.summary?.mat.falta || 0);
    return a.rank - b.rank;
  }), [filtered, filters.order]);
  const alerts = [...filtered.slice().sort((a, b) => a.rank - b.rank).flatMap((row) => row.alerts.map((alert) => ({ ...alert, row }))), ...extraAlerts];
  const visibleAlerts = showAlerts ? alerts : alerts.slice(0, 4);
  const critical = alerts.filter((alert) => alert.critical);
  const deliveries = [...filtered].filter((row) => row.days !== null && row.days <= 90).sort((a, b) => a.days - b.days);
  const material = filtered.reduce((total, row) => total + (row.summary?.mat.total || 0), 0);
  const pending = filtered.reduce((total, row) => total + (row.summary?.mat.falta || 0), 0);
  const tableRows = scope === "purchase" ? ordered.filter((row) => row.summary?.mat.falta > 0) : ordered;
  const active = filters.unit !== "all" || filters.squad !== "all" || filters.gc !== "all" || filters.search || scope !== "all";
  const clear = () => { setFilters({ unit: "all", squad: "all", gc: "all", search: "", order: "risk" }); setSearch(""); setScope("all"); };
  const reveal = (ref) => { ref.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); ref.current?.focus({ preventScroll: true }); };
  const unavailable = loading || !!error;
  const kpis = [
    { label: "Obras ativas", value: String(filtered.length), hint: `${filtered.filter((row) => row.summary).length} com planilha carregada`, icon: Building2, tone: "brand", action: () => { setScope("all"); reveal(projectsRef); } },
    { label: "Entregas em até 90 dias", value: String(deliveries.length), hint: `de ${filtered.length} obras ativas`, icon: CalendarDays, tone: "success", action: () => { setShowDeliveries(true); reveal(deliveriesRef); } },
    { label: "Valor pendente de compra", value: compactMoney(pending), hint: `de ${money(material)} em material`, icon: CircleDollarSign, tone: "brand", action: () => { setScope("purchase"); reveal(projectsRef); } },
    { label: "Pendências críticas", value: String(critical.length), hint: "requerem atenção imediata", icon: TriangleAlert, tone: "danger", action: () => { setShowAlerts(true); reveal(alertsRef); } },
  ];
  const controls = <div className="flex w-72 flex-wrap items-end gap-3 md:w-auto" aria-label="Filtros do dashboard">
    <Choice label="Unidade" disabled={!rows.some((row) => row.unit !== "Não informada")} value={filters.unit} values={options(rows, "unit")} onChange={(value) => update("unit", value)} />
    <Choice label="Squad" value={filters.squad} values={options(rows, "squad")} onChange={(value) => update("squad", value)} />
    <Choice label="GC" allLabel="Todos" value={filters.gc} values={options(rows, "gc")} onChange={(value) => update("gc", value)} />
    <div className="flex w-60 flex-col gap-1"><Label htmlFor="dashboard-search" className="sr-only">Buscar obra</Label><div className="relative"><Search className="absolute left-3 top-3 text-text-mute" size={16} aria-hidden="true" /><Input className="pl-9" id="dashboard-search" placeholder="Buscar obra…" value={filters.search} onChange={(event) => update("search", event.target.value)} /></div></div>
  </div>;
  return <PageShell title={title} description="Acompanhe prazos, compras e pontos críticos da operação." actions={controls} contentClassName="flex flex-col gap-4">
    {active && <div className="flex items-center gap-4"><span role="status">{filtered.length} obras encontradas{scope === "purchase" ? " · com compra pendente na tabela" : ""}</span><Button variant="ghost" size="sm" onClick={clear}>Limpar filtros</Button></div>}
    {error && <Card accent="danger"><CardContent><p role="alert">Não conseguimos carregar todos os dados das obras. Atualize para consultar os indicadores.</p><Button onClick={onRetry}>Tentar novamente</Button></CardContent></Card>}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores das obras" aria-busy={loading}>
      {kpis.map(({ icon: Icon, ...kpi }) => <Card key={kpi.label}>
        <CardContent><div className="flex items-center gap-4">
          <Badge tone={kpi.tone} className="p-4"><Icon size={32} aria-hidden="true" /></Badge>
          <div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-wider text-text-mute">{kpi.label}</div>
            {unavailable ? <><Skeleton className="h-8 w-full" /><span>{loading ? "Carregando…" : "Dados indisponíveis"}</span></> : <><div className="text-3xl font-bold text-text-strong" title={kpi.label === "Valor pendente de compra" ? money(pending) : undefined}>{kpi.value}</div><div className="text-xs text-text-mute">{kpi.hint}</div></>}
          </div>
          <Button variant="ghost" size="icon" disabled={unavailable} onClick={kpi.action} aria-label={`Ver ${kpi.label.toLowerCase()}`}><ChevronRight size={16} aria-hidden="true" /></Button>
        </div></CardContent>
      </Card>)}
    </div>
    {loading && <span role="status">Carregando as obras…</span>}
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5 min-w-0">
        <Card className="min-w-0 xl:col-span-3" ref={alertsRef} tabIndex={-1}>
          <CardHeader className="flex-col"><div className="flex w-full flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2"><TriangleAlert size={18} className="text-danger" />Prioridades de hoje <Badge tone="neutral">{visibleAlerts.length}</Badge></CardTitle><Button variant="ghost" size="sm" className="text-brand" onClick={() => setShowAlerts(!showAlerts)}>{showAlerts ? "Mostrar menos" : `Ver todos os ${alerts.length} alertas`} <ArrowRight size={14} /></Button></div><CardDescription>Itens que precisam da sua atenção para manter o cronograma.</CardDescription></CardHeader>
          <CardContent>
            {unavailable ? <p role="status">{loading ? "Carregando prioridades…" : "Prioridades indisponíveis. Tente carregar novamente."}</p> : !alerts.length ? <p role="status">Nenhuma pendência para as obras selecionadas.</p> : <Table aria-label="Prioridades de hoje">
              <TableHeader className="sr-only"><TableRow>{["Prioridade", "Obra", "Pendência", "Prazo e valor", "GC", "Ação"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{visibleAlerts.map((alert, index) => <TableRow key={alert.id || index}>
                <TableCell><Badge tone={alert.critical ? "danger" : "warning"}>{alert.critical ? "Crítica" : "Atenção"}</Badge></TableCell>
                <TableCell className="text-xs font-semibold text-text-strong">{alert.row ? `#${alert.row.code} ${alert.row.name}` : "Equipe e operação"}</TableCell>
                <TableCell className="text-xs">{alert.text}</TableCell>
                <TableCell className="whitespace-nowrap text-xs"><div className="font-semibold text-danger">{alert.days != null ? `• ${Math.abs(alert.days)} ${Math.abs(alert.days) === 1 ? "dia" : "dias"}` : "—"}</div>{alert.amount != null && <div className="text-text-mute">{money(alert.amount)}</div>}</TableCell>
                <TableCell className="text-xs text-text-mute">{alert.row ? `GC ${alert.row.gc}` : "—"}</TableCell>
                <TableCell><Button size="sm" variant="secondary" onClick={alert.action}>Resolver <ArrowRight size={14} /></Button></TableCell>
              </TableRow>)}</TableBody>
            </Table>}
          </CardContent>
        </Card>
        <Card className="min-w-0 xl:col-span-2" ref={deliveriesRef} tabIndex={-1}>
          <CardHeader className="flex-col"><div className="flex w-full flex-wrap items-center justify-between gap-4"><CardTitle className="flex items-center gap-2"><ClipboardList size={18} className="text-brand" />Próximas entregas <Badge tone="neutral">{deliveries.length}</Badge></CardTitle><Button variant="ghost" size="sm" onClick={() => setShowDeliveries(!showDeliveries)}>{showDeliveries ? "Mostrar menos" : "Ver todas as entregas"} <ArrowRight size={14} /></Button></div><CardDescription>Obras com entrega prevista nos próximos 90 dias.</CardDescription></CardHeader>
          <CardContent><div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {unavailable ? <p role="status">{loading ? "Carregando entregas…" : "Entregas indisponíveis. Tente carregar novamente."}</p> : !deliveries.length && <p role="status">Nenhuma entrega prevista neste período.</p>}
            {(unavailable ? [] : showDeliveries ? deliveries : deliveries.slice(0, 4)).map((row) => <Button key={row.id} variant="outline" className="h-auto w-full flex-col items-start gap-2 text-left" onClick={() => onOpen(row.id)} aria-label={`Abrir entrega de #${row.code} ${row.name}`}>
              <span className="flex items-center gap-2"><span className="text-3xl font-bold">{row.days < 0 ? `${-row.days}d atrás` : row.days === 0 ? "Hoje" : `${row.days}d`}</span><Status critical={row.days < 0} attention={row.alerts.length > 0} /></span>
              <span className="block w-full truncate text-sm" title={`#${row.code} ${row.name}`}><span className="font-normal text-text-mute">#{row.code}</span> {row.name}</span>
              <span className="flex items-center gap-2 text-xs font-normal text-text-soft"><CalendarDays size={14} />{date(row.delivery)}</span>
            </Button>)}
          </div></CardContent>
        </Card>
      </div>
      <Card className="min-w-0" ref={projectsRef} tabIndex={-1}>
        <CardHeader className="flex-col"><div className="flex w-full flex-wrap items-center justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><ClipboardList size={18} className="text-brand" />Obras ativas <Badge tone="neutral">{tableRows.length}</Badge></CardTitle><CardDescription>Acompanhe o andamento de todas as obras, ordenadas por maior risco.</CardDescription></div>
          <div><Label htmlFor="dashboard-order">Ordenar por</Label><Select value={filters.order} onValueChange={(value) => update("order", value)}><SelectTrigger id="dashboard-order"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="risk">Maior risco</SelectItem><SelectItem value="delivery">Entrega mais próxima</SelectItem><SelectItem value="name">Nome da obra</SelectItem><SelectItem value="purchase">Maior valor a comprar</SelectItem></SelectContent></Select></div>
        </div></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32 w-full" /> : !tableRows.length && error ? <p role="status">Não foi possível carregar as obras. Use “Tentar novamente” para atualizar.</p> : !tableRows.length ? <div role="status"><p>{active ? "Nenhum resultado para os filtros aplicados." : "Nenhuma obra ativa no momento."}</p>{active && <Button variant="outline" onClick={clear}>Limpar filtros</Button>}</div> : <Table aria-label="Obras ativas">
            <TableHeader><TableRow>{["Obra", "Cronograma", "Etapa atual", "Progresso", "Compras", "Próxima pendência", "Ações"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{tableRows.map((row) => <TableRow key={row.id}>
              <TableCell className="min-w-52"><div className="flex flex-wrap items-center gap-1"><Button variant="ghost" size="sm" className="h-auto whitespace-normal p-0 text-left text-xs" onClick={() => onOpen(row.id)}>#{row.code} {row.name}</Button><Status critical={row.alerts.some((a) => a.critical)} attention={row.alerts.length > 0} /></div><div className="text-xs text-text-soft">{/^squad\b/i.test(row.squad) ? row.squad : `Squad ${row.squad}`} · GC {row.gc}</div></TableCell>
              <TableCell><span className="flex items-center gap-1 whitespace-nowrap text-xs"><CalendarDays size={12} />{date(row.delivery)}</span>{row.days !== null && <div className="text-xs font-semibold text-danger">• {row.days < 0 ? `${-row.days} dias de atraso` : `${row.days} dias`}</div>}</TableCell>
              <TableCell><div className="flex items-center gap-0">{row.steps.map((step, index) => <React.Fragment key={step.chave}><Badge className="gap-1 px-1 py-1 font-sans text-xs normal-case tracking-normal" tone={step.feito ? "success" : row.overdueSteps?.includes(step.chave) && step.chave === "projeto" ? "danger" : step.chave === row.currentStep ? "brand" : "neutral"} title={`${step.rotulo}: ${step.feito ? "concluído" : "pendente"}`}>{step.feito ? <CheckCircle2 size={12} /> : <Circle size={12} />}{step.chave === "execucao" ? "Execução" : step.curto}</Badge>{index < row.steps.length - 1 && <ArrowRight size={10} className="shrink-0 text-text-mute" aria-hidden="true" />}</React.Fragment>)}</div></TableCell>
              <TableCell><Percentage value={row.steps.length ? row.steps.filter((step) => step.feito).length / row.steps.length * 100 : 0} label="Etapas concluídas da jornada; não representa avanço físico" /></TableCell>
              <TableCell><Percentage value={row.summary?.mat.pct ?? null} label="Percentual do valor de material comprado" /></TableCell>
              <TableCell className="min-w-44"><span className="text-xs">{row.alerts[0]?.title || row.alerts[0]?.text || row.stage}</span><div className="text-xs font-semibold text-danger">{row.alerts[0]?.days != null ? `• ${Math.abs(row.alerts[0].days)} dias` : row.days != null && row.alerts.length ? `• ${Math.abs(row.days)} dias` : ""}</div>{row.alerts[0]?.amount != null && <div className="text-sm text-danger">{money(row.alerts[0].amount)}</div>}</TableCell>
              <TableCell><Button variant="secondary" size="sm" onClick={() => onOpen(row.id)}>Ver detalhes <ArrowRight size={14} /></Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>}
        </CardContent>
      </Card>
    </>
    {rows.length > 0 && rows.every((row) => row.unit === "Não informada") && <p className="text-xs text-text-mute">Unidade: aguardando o vínculo das obras com as filiais.</p>}
  </PageShell>;
}
