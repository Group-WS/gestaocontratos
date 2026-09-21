import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent,
  Input, Label, KpiMini, PageShell, Progress, Skeleton,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@group-ws/ws-ui";
import { ArrowRight, Building2, CalendarDays, CircleDollarSign, TriangleAlert, CheckCircle2, Circle, Search } from "lucide-react";

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const date = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Sem data de entrega";
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const options = (rows, key) => [...new Set(rows.map((row) => row[key]))].sort((a, b) => a.localeCompare(b, "pt-BR"));

function Choice({ label, value, values, onChange }) {
  const id = React.useId();
  return <div className="flex flex-col gap-1 min-w-0">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">Todas</SelectItem>
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
  return <div className="flex flex-col gap-2 min-w-20" title={label}>
    <span className="text-sm font-semibold">{percent}%</span>
    <Progress value={percent} aria-label={label} />
  </div>;
}

export default function DashboardPage({ title = "Visão geral das obras", rows, loading, error, onRetry, onOpen, extraAlerts = [] }) {
  const [filters, setFilters] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    return { unit: query.get("dash-unit") || "all", squad: query.get("dash-squad") || "all", gc: "all", search: "", order: query.get("dash-order") || "risk" };
  });
  const [search, setSearch] = useState("");
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
  const alerts = [...ordered.flatMap((row) => row.alerts.map((alert) => ({ ...alert, row }))), ...extraAlerts];
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
    { label: "Entregas em até 90 dias", value: String(deliveries.length), hint: `de ${filtered.length} obras ativas · inclui vencidas`, icon: CalendarDays, tone: "success", action: () => { setShowDeliveries(true); reveal(deliveriesRef); } },
    { label: "Valor pendente de compra", value: money(pending), hint: `de ${money(material)} em material`, icon: CircleDollarSign, tone: "brand", action: () => { setScope("purchase"); reveal(projectsRef); } },
    { label: "Pendências críticas", value: String(critical.length), hint: "requerem atenção imediata", icon: TriangleAlert, tone: "danger", action: () => { setShowAlerts(true); reveal(alertsRef); } },
  ];
  return <PageShell title={title} description="Acompanhe prazos, compras e pontos críticos da operação." contentClassName="flex flex-col gap-6">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4" aria-label="Filtros do dashboard">
      <Choice label="Unidade" value={filters.unit} values={options(rows, "unit")} onChange={(value) => update("unit", value)} />
      <Choice label="Squad" value={filters.squad} values={options(rows, "squad")} onChange={(value) => update("squad", value)} />
      <Choice label="GC" value={filters.gc} values={options(rows, "gc")} onChange={(value) => update("gc", value)} />
      <div className="flex flex-col gap-1"><Label htmlFor="dashboard-search">Buscar obra</Label><Input id="dashboard-search" placeholder="Código ou nome da obra…" value={filters.search} onChange={(event) => update("search", event.target.value)} /></div>
    </div>
    {active && <div className="flex items-center gap-4"><span role="status">{filtered.length} obras encontradas{scope === "purchase" ? " · com compra pendente na tabela" : ""}</span><Button variant="ghost" size="sm" onClick={clear}>Limpar filtros</Button></div>}
    {error && <Card accent="danger"><CardContent><p role="alert">Não conseguimos carregar todos os dados das obras. Atualize para consultar os indicadores.</p><Button onClick={onRetry}>Tentar novamente</Button></CardContent></Card>}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores das obras" aria-busy={loading}>
      {kpis.map(({ icon: Icon, ...kpi }) => <div key={kpi.label}>
        {unavailable ? <Card><CardContent><p>{kpi.label}</p><Skeleton className="h-8 w-full" /><span>{loading ? "Carregando…" : "Dados indisponíveis"}</span></CardContent></Card> : <>
          <KpiMini label={kpi.label} value={kpi.value} hint={kpi.hint} tone={kpi.tone} />
          <Button variant="ghost" size="sm" onClick={kpi.action} aria-label={`Ver ${kpi.label.toLowerCase()}`}><Icon size={16} aria-hidden="true" /> Consultar <ArrowRight size={14} aria-hidden="true" /></Button>
        </>}
      </div>)}
    </div>
    {loading ? <div role="status" className="flex flex-col gap-4"><span>Carregando as obras…</span><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div> : !error && <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card ref={alertsRef} tabIndex={-1}>
          <CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>Prioridades de hoje <Badge tone="neutral">{alerts.length}</Badge></CardTitle><Button variant="ghost" size="sm" onClick={() => setShowAlerts(!showAlerts)}>{showAlerts ? "Mostrar menos" : `Ver todos os ${alerts.length} alertas`} <ArrowRight size={14} /></Button></div><CardDescription>Itens que precisam da sua atenção para manter o cronograma.</CardDescription></CardHeader>
          <CardContent><div className="flex flex-col gap-4">
            {!alerts.length && <p role="status">Nenhuma pendência para as obras selecionadas.</p>}
            {(showAlerts ? alerts : alerts.slice(0, 4)).map((alert, index) => <div key={alert.id || index} className="flex flex-wrap items-center gap-4 border-b border-line-1 pb-4">
              <Badge tone={alert.critical ? "danger" : "warning"}>{alert.critical ? "Crítica" : "Atenção"}</Badge>
              <div className="flex-1 min-w-0"><div className="font-semibold text-sm">{alert.row ? `#${alert.row.code} ${alert.row.name}` : "Equipe e operação"}</div><div className="text-sm text-text-soft">{alert.text}</div>{alert.amount != null && <div className="text-sm text-danger">{money(alert.amount)}</div>}{alert.row && <div className="text-xs text-text-mute">GC {alert.row.gc}</div>}</div>
              <Button size="sm" variant="secondary" onClick={alert.action}>Resolver <ArrowRight size={14} /></Button>
            </div>)}
          </div></CardContent>
        </Card>
        <Card ref={deliveriesRef} tabIndex={-1}>
          <CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>Próximas entregas <Badge tone="neutral">{deliveries.length}</Badge></CardTitle><Button variant="ghost" size="sm" onClick={() => setShowDeliveries(!showDeliveries)}>{showDeliveries ? "Mostrar menos" : "Ver todas as entregas"} <ArrowRight size={14} /></Button></div><CardDescription>Previsões nos próximos 90 dias e entregas vencidas.</CardDescription></CardHeader>
          <CardContent><div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {!deliveries.length && <p role="status">Nenhuma entrega prevista neste período.</p>}
            {(showDeliveries ? deliveries : deliveries.slice(0, 4)).map((row) => <div key={row.id} className="flex flex-col gap-2 border-b border-line-1 pb-4">
              <div className="flex items-center gap-2"><span className="text-2xl font-semibold">{row.days < 0 ? `${-row.days}d atrás` : row.days === 0 ? "Hoje" : `${row.days}d`}</span><Status critical={row.days < 0} attention={row.alerts.length > 0} /></div>
              <Button variant="ghost" size="sm" className="justify-start whitespace-normal" onClick={() => onOpen(row.id)}>#{row.code} {row.name}</Button>
              <span className="flex items-center gap-2 text-sm text-text-soft"><CalendarDays size={14} />{date(row.delivery)}</span>
            </div>)}
          </div></CardContent>
        </Card>
      </div>
      <Card ref={projectsRef} tabIndex={-1}>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-4"><div><CardTitle>Obras ativas <Badge tone="neutral">{tableRows.length}</Badge></CardTitle><CardDescription>Acompanhe as etapas, os prazos e as compras de cada obra.</CardDescription></div>
          <div><Label htmlFor="dashboard-order">Ordenar por</Label><Select value={filters.order} onValueChange={(value) => update("order", value)}><SelectTrigger id="dashboard-order"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="risk">Maior risco</SelectItem><SelectItem value="delivery">Entrega mais próxima</SelectItem><SelectItem value="name">Nome da obra</SelectItem><SelectItem value="purchase">Maior valor a comprar</SelectItem></SelectContent></Select></div>
        </div></CardHeader>
        <CardContent>
          {!tableRows.length ? <div role="status"><p>{active ? "Nenhum resultado para os filtros aplicados." : "Nenhuma obra ativa no momento."}</p>{active && <Button variant="outline" onClick={clear}>Limpar filtros</Button>}</div> : <Table>
            <TableHeader><TableRow>{["Obra", "Cronograma", "Etapa atual", "Progresso das etapas", "Compras", "Próxima pendência", "Ações"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{tableRows.map((row) => <TableRow key={row.id}>
              <TableCell><Button variant="ghost" size="sm" className="whitespace-normal text-left" onClick={() => onOpen(row.id)}>#{row.code} {row.name}</Button><div className="text-xs text-text-soft">{row.squad} · GC {row.gc}</div><Status critical={row.alerts.some((a) => a.critical)} attention={row.alerts.length > 0} /></TableCell>
              <TableCell><span className="text-sm">{date(row.delivery)}</span>{row.days !== null && <div className="text-sm font-semibold">{row.days < 0 ? `${-row.days} dias de atraso` : `${row.days} dias`}</div>}</TableCell>
              <TableCell><div className="flex items-center gap-1">{row.steps.map((step) => <Badge key={step.chave} tone={step.feito ? "success" : step.chave === row.currentStep ? "brand" : "neutral"} title={`${step.rotulo}: ${step.feito ? "concluído" : "pendente"}`}>{step.feito ? <CheckCircle2 size={12} /> : <Circle size={12} />}{step.curto}</Badge>)}</div></TableCell>
              <TableCell><Percentage value={row.steps.length ? row.steps.filter((step) => step.feito).length / row.steps.length * 100 : 0} label="Etapas concluídas da jornada; não representa avanço físico" /></TableCell>
              <TableCell><Percentage value={row.summary?.mat.pct ?? null} label="Percentual do valor de material comprado" /></TableCell>
              <TableCell><span className="text-sm">{row.alerts[0]?.text || row.stage}</span>{row.alerts[0]?.amount != null && <div className="text-sm text-danger">{money(row.alerts[0].amount)}</div>}</TableCell>
              <TableCell><Button variant="secondary" size="sm" onClick={() => onOpen(row.id)}>Ver detalhes <ArrowRight size={14} /></Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>}
        </CardContent>
      </Card>
    </>}
  </PageShell>;
}
