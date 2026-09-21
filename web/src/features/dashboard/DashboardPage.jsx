import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent, EmptyState,
  Input, Label, PageShell, Progress, Skeleton, ActiveFilters, FilterChip, KpiHero, KpiMini,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, cn,
} from "@group-ws/ws-ui";
import { BotaoIcone } from "../../lib/ui.jsx";
import { ArrowRight, Building2, CalendarDays, TriangleAlert, CheckCircle2, Circle, ChevronRight, ClipboardList, Search } from "lucide-react";

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const compactMoney = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 2 }).format(value);
const date = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Sem data de entrega";
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const options = (rows, key) => [...new Set(rows.map((row) => row[key]))].sort((a, b) => a.localeCompare(b, "pt-BR"));

function Choice({ label, value, values, onChange, disabled = false, allLabel = "Todas" }) {
  const id = React.useId();
  return <div className="flex w-full min-w-0 flex-col gap-1 sm:w-40">
    <Label htmlFor={id} className="sr-only">{label}</Label>
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

/* Quem responde pela obra: GC, Taylor Made e Executivo. A vaga vazia
   aparece escrita ("a definir") em vez de sumir — ao lado das outras duas, a
   lacuna se le' de relance e no lugar certo. */
function Equipe({ team = [] }) {
  return <div className="flex flex-wrap gap-x-2 text-xs">
    {team.map((p) => <span key={p.chave} className={p.nome ? "text-text" : "italic text-text-mute"} title={p.rotulo}>
      <span className="text-text-mute">{p.rotulo}</span> {p.nome || "a definir"}
    </span>)}
  </div>;
}

/* A regua dos 90 dias: mede quanto a entrega ja' INVADIU a janela de 90
   dias, e nao o que falta. Obra fora da janela nao tem regua. */
function ReguaDos90({ days }) {
  if (days == null || days > 90) return null;
  const dentro = Math.min(90, Math.max(0, 90 - days));
  return <Progress className="mx-auto mt-1 h-1 w-24" value={(dentro / 90) * 100} aria-label={`${Math.round((dentro / 90) * 100)}% da janela de 90 dias`} />;
}

export default function DashboardPage({ title = "Visão geral das obras", rows, loading, error, onRetry, onOpen, extraAlerts = [], memory }) {
  const [filters, setFilters] = useState(() => {
    if (memory?.current.filters) return memory.current.filters;
    const query = new URLSearchParams(window.location.search);
    return { unit: query.get("dash-unit") || "all", squad: query.get("dash-squad") || "all", gc: "all", taylor: "all", search: "", order: query.get("dash-order") || "risk" };
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
    (!filters.taylor || filters.taylor === "all" || row.taylor === filters.taylor) &&
    (!search || normalize(`${row.code} ${row.name}`).includes(normalize(search)))
  ), [rows, filters.unit, filters.squad, filters.gc, filters.taylor, search]);
  const ordered = useMemo(() => [...filtered].sort((a, b) => {
    if (filters.order === "name") return a.name.localeCompare(b.name, "pt-BR");
    if (filters.order === "delivery") return (a.days ?? Infinity) - (b.days ?? Infinity);
    if (filters.order === "purchase") return (b.summary?.mat.falta || 0) - (a.summary?.mat.falta || 0);
    return a.rank - b.rank;
  }), [filtered, filters.order]);
  /* Ordenada pela faixa (`peso`) e pelo desempate (`ordem`) que cada item
     traz — dinheiro vencido primeiro, o que esta' para vencer por ultimo. */
  const alerts = [...filtered.flatMap((row) => row.alerts.map((alert) => ({ ...alert, row }))), ...extraAlerts]
    .sort((a, b) => (a.peso ?? 9) - (b.peso ?? 9) || (a.ordem ?? 0) - (b.ordem ?? 0));
  const visibleAlerts = showAlerts ? alerts : alerts.slice(0, 4);
  const critical = alerts.filter((alert) => alert.critical);
  const deliveries = [...filtered].filter((row) => row.days !== null && row.days <= 90).sort((a, b) => a.days - b.days);
  const material = filtered.reduce((total, row) => total + (row.summary?.mat.total || 0), 0);
  const pending = filtered.reduce((total, row) => total + (row.summary?.mat.falta || 0), 0);
  const tableRows = scope === "purchase" ? ordered.filter((row) => row.summary?.mat.falta > 0) : ordered;
  const active = filters.unit !== "all" || filters.squad !== "all" || filters.gc !== "all" || (filters.taylor && filters.taylor !== "all") || filters.search || scope !== "all";
  const clear = () => { setFilters({ unit: "all", squad: "all", gc: "all", taylor: "all", search: "", order: "risk" }); setSearch(""); setScope("all"); };
  const reveal = (ref) => { ref.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); ref.current?.focus({ preventScroll: true }); };
  const unavailable = loading || !!error;
  /* O COCKPIT do DS (pattern Dashboard): um numero em destaque — o que
     falta comprar, que e' o que segura obra —, tres indicadores medios que
     levam ao bloco certo, e uma faixa curta de contagens de saude. */
  const pctComprado = material > 0 ? Math.round(((material - pending) / material) * 100) : 0;
  const kpis = [
    { label: "Obras ativas", value: String(filtered.length), hint: `${filtered.filter((row) => row.summary).length} com planilha carregada`, icon: Building2, tone: "brand", action: () => { setScope("all"); reveal(projectsRef); } },
    { label: "Entregas em até 90 dias", value: String(deliveries.length), hint: `de ${filtered.length} obras ativas`, icon: CalendarDays, tone: "success", action: () => { setShowDeliveries(true); reveal(deliveriesRef); } },
    { label: "Pendências críticas", value: String(critical.length), hint: "requerem atenção imediata", icon: TriangleAlert, tone: "danger", action: () => { setShowAlerts(true); reveal(alertsRef); } },
  ];
  const saude = [
    { label: "Sem pendência crítica", value: filtered.filter((row) => !row.alerts.some((a) => a.critical)).length, tone: "success" },
    { label: "Com compra atrasada", value: filtered.filter((row) => row.summary?.atrasos?.length).length, tone: "danger" },
    { label: "Sem data de entrega", value: filtered.filter((row) => !row.delivery).length, tone: "warning" },
    { label: "Sem GC", value: filtered.filter((row) => row.gc === "Não atribuído").length, tone: "neutral" },
  ];
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  /* Filtro mora na TOOLBAR do PageShell, abaixo do titulo — o lado direito
     do titulo e' das acoes (App Shell do DS, nivel 6). */
  const controls = <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Filtros do dashboard">
    <div className="flex w-full min-w-0 flex-col gap-1 sm:w-72"><Label htmlFor="dashboard-search" className="sr-only">Buscar obra</Label><Input icon={<Search size={16} aria-hidden="true" />} id="dashboard-search" placeholder="Código ou nome" value={filters.search} onChange={(event) => update("search", event.target.value)} /></div>
    <Choice label="Unidade" disabled={!rows.some((row) => row.unit !== "Não informada")} value={filters.unit} values={options(rows, "unit")} onChange={(value) => update("unit", value)} />
    <Choice label="Squad" value={filters.squad} values={options(rows, "squad")} onChange={(value) => update("squad", value)} />
    <Choice label="GC" allLabel="Todos" value={filters.gc} values={options(rows, "gc")} onChange={(value) => update("gc", value)} />
    <Choice label="Taylor Made" allLabel="Todas" value={filters.taylor || "all"} values={options(rows, "taylor")} onChange={(value) => update("taylor", value)} />
  </div>;
  const filtrosAtivos = active ? <ActiveFilters count={filtered.length} noun="obra" hasFilters onClearAll={clear}>
    {filters.unit !== "all" && <FilterChip label="Unidade" value={filters.unit} onClear={() => update("unit", "all")} />}
    {filters.squad !== "all" && <FilterChip label="Squad" value={filters.squad} onClear={() => update("squad", "all")} />}
    {filters.gc !== "all" && <FilterChip label="GC" value={filters.gc} onClear={() => update("gc", "all")} />}
    {filters.taylor && filters.taylor !== "all" && <FilterChip label="Taylor Made" value={filters.taylor} onClear={() => update("taylor", "all")} />}
    {filters.search && <FilterChip label="Busca" value={filters.search} onClear={() => update("search", "")} />}
    {scope === "purchase" && <FilterChip label="Tabela" value="com compra pendente" onClear={() => setScope("all")} />}
  </ActiveFilters> : null;
  /* Header editorial do DS: crumb -> titulo (o nome do menu) -> o resumo do
     momento em italico -> uma linha de contexto. */
  return <PageShell crumb="Operação" title={title}
    italic={unavailable ? undefined : `${compactMoney(pending)} a comprar · ${filtered.length} ${filtered.length === 1 ? "obra" : "obras"}`}
    description={`Prazos, compras e pontos críticos da operação · ${hoje}`}
    toolbar={controls} toolbarSecondary={filtrosAtivos} contentClassName="flex flex-col gap-4">
    {error && <Card accent="danger"><CardContent className="flex flex-col items-start gap-3"><p role="alert" className="text-sm text-text">Não conseguimos carregar todos os dados das obras. Atualize para consultar os indicadores.</p><Button onClick={onRetry}>Tentar novamente</Button></CardContent></Card>}
    <div className="grid grid-cols-12 gap-4" aria-label="Indicadores das obras" aria-busy={loading}>
      <div className="col-span-12 flex flex-col gap-2 xl:col-span-5">
        {unavailable
          ? <Card className="h-full"><CardContent className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-12 w-56" /><span className="text-xs text-text-mute">{loading ? "Carregando…" : "Dados indisponíveis"}</span></CardContent></Card>
          : <KpiHero className="h-full" label="Valor pendente de compra" value={compactMoney(pending)}
              hint={`de ${money(material)} em material · ${pctComprado}% já comprado`} />}
        <Button variant="outline" size="sm" className="self-start" disabled={unavailable}
          onClick={() => { setScope("purchase"); reveal(projectsRef); }} aria-label="Ver valor pendente de compra">
          Ver obras com compra pendente <ArrowRight size={14} aria-hidden="true" />
        </Button>
      </div>
      <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-3 xl:col-span-7">
        {kpis.map(({ icon: Icon, ...kpi }) => <Card key={kpi.label}>
          <CardContent className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Badge tone={kpi.tone} className="p-2"><Icon size={16} aria-hidden="true" /></Badge>
              <BotaoIcone rotulo={`Ver ${kpi.label.toLowerCase()}`} variant="ghost" disabled={unavailable} onClick={kpi.action}><ChevronRight size={16} aria-hidden="true" /></BotaoIcone>
            </div>
            <div className="label-mono text-text-mute">{kpi.label}</div>
            {unavailable ? <Skeleton className="h-8 w-20" /> : <><div className="text-2xl font-semibold text-text">{kpi.value}</div><div className="text-xs text-text-mute">{kpi.hint}</div></>}
          </CardContent>
        </Card>)}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Saúde das obras">
      {saude.map((k) => unavailable
        ? <Skeleton key={k.label} className="h-20" />
        : <KpiMini key={k.label} label={k.label} value={String(k.value)} hint={`de ${filtered.length} obras`} tone={k.tone} />)}
    </div>
    {loading && <span role="status" className="sr-only">Carregando as obras…</span>}
    <>
      <div className="grid min-w-0 grid-cols-12 gap-4">
        <Card className="col-span-12 min-w-0 xl:col-span-8" ref={alertsRef} tabIndex={-1}>
          <CardHeader><div className="min-w-0"><CardTitle className="flex items-center gap-2"><TriangleAlert size={16} className="shrink-0 text-danger" aria-hidden="true" />Prioridades de hoje <Badge tone="neutral">{visibleAlerts.length}</Badge></CardTitle><CardDescription>Itens que precisam da sua atenção para manter o cronograma.</CardDescription></div><Button variant="ghost" size="sm" className="shrink-0" onClick={() => setShowAlerts(!showAlerts)}>{showAlerts ? "Mostrar menos" : `Ver todos os ${alerts.length} alertas`} <ArrowRight size={14} aria-hidden="true" /></Button></CardHeader>
          <CardContent>
            {unavailable ? <p role="status">{loading ? "Carregando prioridades…" : "Prioridades indisponíveis. Tente carregar novamente."}</p> : !alerts.length ? <p role="status">Nenhuma pendência para as obras selecionadas.</p> : <Table aria-label="Prioridades de hoje">
              <TableHeader className="sr-only"><TableRow>{["Prioridade", "Obra", "Pendência", "Prazo", "Valor", "GC", "Ação"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{visibleAlerts.map((alert, index) => <TableRow key={alert.id || index}>
                <TableCell className="w-24"><Badge tone={alert.critical ? "danger" : alert.upcoming ? "neutral" : "warning"}>{alert.critical ? "Crítica" : alert.upcoming ? "A vencer" : "Atenção"}</Badge></TableCell>
                <TableCell className="text-sm font-semibold text-text">{alert.row ? `#${alert.row.code} ${alert.row.name}` : "Equipe e operação"}</TableCell>
                <TableCell className="text-sm text-text">{alert.text}</TableCell>
                <TableCell className={cn("w-24 whitespace-nowrap text-center text-xs", alert.upcoming ? "text-text-mute" : "text-danger")}>{alert.days != null ? `• ${Math.abs(alert.days)} ${Math.abs(alert.days) === 1 ? "dia" : "dias"}` : "—"}</TableCell>
                <TableCell className="w-32 whitespace-nowrap text-right font-mono text-sm tabular-nums">{alert.amount != null ? money(alert.amount) : "—"}</TableCell>
                <TableCell className="text-xs text-text-mute">{alert.row ? `GC ${alert.row.gc}` : "—"}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={alert.action}>{alert.button || "Abrir"} <ArrowRight size={14} aria-hidden="true" /></Button></TableCell>
              </TableRow>)}</TableBody>
            </Table>}
          </CardContent>
        </Card>
        <Card className="col-span-12 min-w-0 xl:col-span-4" ref={deliveriesRef} tabIndex={-1}>
          <CardHeader><div className="min-w-0"><CardTitle className="flex items-center gap-2"><CalendarDays size={16} className="shrink-0 text-brand" aria-hidden="true" />Próximas entregas <Badge tone="neutral">{deliveries.length}</Badge></CardTitle><CardDescription>Obras com entrega prevista nos próximos 90 dias.</CardDescription></div><Button variant="ghost" size="sm" className="shrink-0" onClick={() => setShowDeliveries(!showDeliveries)}>{showDeliveries ? "Mostrar menos" : "Ver todas"} <ArrowRight size={14} aria-hidden="true" /></Button></CardHeader>
          {/* UMA LISTA, e nao uma grade de caixas: numa coluna estreita a
              caixa cortava o nome da obra. A data vira um bloco curto de dia e
              mes, e o prazo vai num selo que diz o que e' ("em 60 dias", "8
              dias atrasada"), com a cor do estado da obra. */}
          <CardContent>
            {unavailable ? <p role="status">{loading ? "Carregando entregas…" : "Entregas indisponíveis. Tente carregar novamente."}</p>
              : !deliveries.length ? <p role="status" className="text-sm text-text-mute">Nenhuma entrega prevista neste período.</p>
              : <ul className="divide-y divide-line-1">
                {(showDeliveries ? deliveries : deliveries.slice(0, 4)).map((row) => {
                  const d = new Date(`${row.delivery}T12:00:00`);
                  const critica = row.days < 0 || row.alerts.some((a) => a.critical);
                  const atencao = !critica && row.alerts.length > 0;
                  const prazo = row.days < 0 ? `${-row.days} ${-row.days === 1 ? "dia atrasada" : "dias atrasada"}` : row.days === 0 ? "hoje" : `em ${row.days} ${row.days === 1 ? "dia" : "dias"}`;
                  return <li key={row.id}>
                    <Button variant="ghost" className="h-auto w-full justify-start gap-3 whitespace-normal px-4 py-3 text-left font-normal"
                      onClick={() => onOpen(row.id)} aria-label={`Abrir entrega de #${row.code} ${row.name}`}>
                      <span className="flex w-10 shrink-0 flex-col items-center leading-none">
                        <span className="text-lg font-semibold text-text">{String(d.getDate()).padStart(2, "0")}</span>
                        <span className="label-mono mt-1 text-text-mute">{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-text"><span className="font-mono text-xs font-normal text-text-mute">#{row.code}</span> {row.name}</span>
                        <span className="mt-1 block text-xs text-text-mute">{/^squad\b/i.test(row.squad) ? row.squad : `Squad ${row.squad}`}</span>
                      </span>
                      <Badge tone={critica ? "danger" : atencao ? "warning" : "success"} className="w-28 shrink-0 justify-center"
                        title={critica ? "Obra com pendência crítica" : atencao ? "Obra com pendência de atenção" : "Obra no prazo"}>{prazo}</Badge>
                    </Button>
                  </li>;
                })}
              </ul>}
          </CardContent>
        </Card>
      </div>
      <Card className="min-w-0" ref={projectsRef} tabIndex={-1}>
        <CardHeader><div className="min-w-0"><CardTitle className="flex items-center gap-2"><ClipboardList size={16} className="shrink-0 text-brand" aria-hidden="true" />Obras ativas <Badge tone="neutral">{tableRows.length}</Badge></CardTitle><CardDescription>Acompanhe o andamento de todas as obras, ordenadas por maior risco.</CardDescription></div>
          <div className="shrink-0"><Label htmlFor="dashboard-order" className="sr-only">Ordenar por</Label><Select value={filters.order} onValueChange={(value) => update("order", value)}><SelectTrigger id="dashboard-order" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="risk">Maior risco</SelectItem><SelectItem value="delivery">Entrega mais próxima</SelectItem><SelectItem value="name">Nome da obra</SelectItem><SelectItem value="purchase">Maior valor a comprar</SelectItem></SelectContent></Select></div>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32 w-full" /> : !tableRows.length && error ? <p role="status">Não foi possível carregar as obras. Use “Tentar novamente” para atualizar.</p> : !tableRows.length ? <div role="status"><EmptyState title={active ? "Nenhum resultado para os filtros aplicados." : "Nenhuma obra ativa no momento."} action={active ? <Button variant="outline" size="sm" onClick={clear}>Limpar filtros</Button> : undefined} /></div> : <Table aria-label="Obras ativas">
            <TableHeader><TableRow>
              <TableHead>Obra</TableHead>
              <TableHead className="w-24 text-center">Situação</TableHead>
              <TableHead className="w-32 text-center">Cronograma</TableHead>
              <TableHead>Etapa atual</TableHead>
              <TableHead className="w-32">Progresso</TableHead>
              <TableHead className="w-32">Compras</TableHead>
              <TableHead>Próxima pendência</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>{tableRows.map((row) => <TableRow key={row.id}>
              <TableCell className="min-w-52"><Button variant="ghost" size="sm" className="h-auto whitespace-normal p-0 text-left text-sm font-semibold text-text" onClick={() => onOpen(row.id)}><span className="font-mono text-xs font-normal text-text-mute">#{row.code}</span> {row.name}</Button><div className="text-xs text-text-mute">{/^squad\b/i.test(row.squad) ? row.squad : `Squad ${row.squad}`}</div><Equipe team={row.team} /></TableCell>
              <TableCell className="w-24 text-center"><Status critical={row.alerts.some((a) => a.critical)} attention={row.alerts.length > 0} /></TableCell>
              <TableCell className="w-32 text-center"><span className="flex items-center justify-center gap-1 whitespace-nowrap text-xs"><CalendarDays size={12} aria-hidden="true" />{date(row.delivery)}</span>{row.days !== null && <div className={cn("text-xs", row.days < 0 ? "text-danger" : "text-text-mute")}>• {row.days < 0 ? `${-row.days} dias de atraso` : `${row.days} dias`}</div>}<ReguaDos90 days={row.days} /></TableCell>
              <TableCell><div className="flex flex-wrap items-center gap-1"><span className="whitespace-nowrap text-xs text-text-mute">{row.steps.filter((step) => step.feito).length} de {row.steps.length}</span>{row.steps.map((step, index) => <React.Fragment key={step.chave}><Badge className="gap-1" tone={step.feito ? "success" : row.overdueSteps?.includes(step.chave) ? "danger" : step.chave === row.currentStep ? "brand" : "neutral"} title={`${step.rotulo}: ${step.feito ? "concluído" : "pendente"}`}>{step.feito ? <CheckCircle2 size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}{step.chave === "execucao" ? "Execução" : step.curto}</Badge>{index < row.steps.length - 1 && <ArrowRight size={10} className="shrink-0 text-text-mute" aria-hidden="true" />}</React.Fragment>)}</div></TableCell>
              <TableCell><Percentage value={row.steps.length ? row.steps.filter((step) => step.feito).length / row.steps.length * 100 : 0} label="Etapas concluídas da jornada; não representa avanço físico" /></TableCell>
              <TableCell><Percentage value={row.summary?.mat.pct ?? null} label="Percentual do valor de material comprado" /></TableCell>
              <TableCell className="min-w-44"><span className="text-sm text-text">{row.alerts[0]?.title || row.alerts[0]?.text || row.stage}</span><div className="text-xs text-danger">{row.alerts[0]?.days != null ? `• ${Math.abs(row.alerts[0].days)} dias` : row.days != null && row.alerts.length ? `• ${Math.abs(row.days)} dias` : ""}</div>{row.alerts[0]?.amount != null && <div className="text-right font-mono text-sm tabular-nums text-danger">{money(row.alerts[0].amount)}</div>}</TableCell>
              <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => onOpen(row.id)}>Ver detalhes <ArrowRight size={14} aria-hidden="true" /></Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>}
        </CardContent>
      </Card>
    </>
    {rows.length > 0 && rows.every((row) => row.unit === "Não informada") && <p className="text-xs text-text-mute">Unidade: aguardando o vínculo das obras com as filiais.</p>}
  </PageShell>;
}
