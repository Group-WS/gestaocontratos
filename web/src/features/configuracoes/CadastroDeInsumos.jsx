import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  ActiveFilters, FilterChip, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EditorialTable,
  Field, FieldHint, Input, Label, PaginationFooter, SavedViewChips, Sheet, SheetContent, SheetDescription, SheetHeader,
  SheetTitle, Skeleton, Spinner, Subheader, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea,
} from "@group-ws/ws-ui";
import { ChevronDown, History, Pencil, Plus, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { BotaoIcone, Choice, DicaInfo } from "../../lib/ui.jsx";
import { confirmar, mensagem, avisar } from "../../lib/confirmar.jsx";
import { quandoFoi } from "../../lib/pessoas.js";
import {
  listarInsumos, listarUnidades, lerTabelaAtiva, salvarTabelaAtiva, criarInsumo, editarInsumo,
  usosDoInsumo, historicoDoInsumo, apagarInsumo, listarImportacoes, aplicarImportacao,
} from "../../lib/insumoCadastro.js";
import { ImportarRelatorio } from "./ImportarRelatorio.jsx";

/* ============================================================
   CADASTRO DE INSUMOS (ADR-008, 23/09/2026)

   Listagem (CRUD) com o upload do relatório "Insumos" do Sienge. As regras
   de negócio (RN-086 a RN-089) moram em web/src/regras/cadastroDeInsumos.js
   e são aplicadas pela API e pelo banco; a tela só conduz.
   ============================================================ */

const PASSOS = [20, 50, 100];
const PARAMETROS = ["busca", "ativo", "unidade", "de", "passo"];
const TODAS = "__todas";
const VISOES = [
  { id: "todos", label: "Todos" },
  { id: "sim", label: "Ativos" },
  { id: "nao", label: "Inativos" },
];

/* O estado da lista mora no endereço (TELA-15): recarregar ou compartilhar o
   link mostra a mesma lista. Ao sair da tela, os parâmetros saem junto. */
function estadoDaUrl() {
  const q = new URLSearchParams(window.location.search);
  const passo = Number(q.get("passo"));
  return {
    busca: q.get("busca") || "",
    ativo: ["sim", "nao"].includes(q.get("ativo")) ? q.get("ativo") : "todos",
    unidade: q.get("unidade") || "",
    de: Math.max(0, Math.floor(Number(q.get("de")) || 0)),
    passo: PASSOS.includes(passo) ? passo : 50,
  };
}

function escreverNaUrl(estado) {
  const q = new URLSearchParams(window.location.search);
  PARAMETROS.forEach((k) => q.delete(k));
  if (estado) {
    if (estado.busca) q.set("busca", estado.busca);
    if (estado.ativo !== "todos") q.set("ativo", estado.ativo);
    if (estado.unidade) q.set("unidade", estado.unidade);
    if (estado.de) q.set("de", String(estado.de));
    if (estado.passo !== 50) q.set("passo", String(estado.passo));
  }
  const s = q.toString();
  window.history.replaceState(window.history.state, "", window.location.pathname + (s ? `?${s}` : ""));
}

const ROTULO_DA_ACAO = {
  criou: "Criado na tela",
  editou: "Editado na tela",
  ativou: "Ativado",
  desativou: "Desativado",
  apagou: "Apagado na tela",
  importou: "Entrou pela importação",
  atualizou_na_importacao: "Atualizado pela importação",
  apagou_na_importacao: "Saiu pela importação",
};

const SITUACAO_DA_IMPORTACAO = {
  enviado: { rotulo: "Enviado", tom: "neutral" },
  recusado: { rotulo: "Recusado", tom: "danger" },
  previa: { rotulo: "Prévia", tom: "neutral" },
  gravando: { rotulo: "Gravando", tom: "warning" },
  incompleta: { rotulo: "Incompleta", tom: "warning" },
  concluida: { rotulo: "Concluída", tom: "success" },
};

const numero = (n) => (Number.isFinite(n) ? n.toLocaleString("pt-BR") : "—");

/* ---------- a tabela de preços ativa (RN-088) ---------- */

function TabelaAtiva() {
  const id = useId();
  const [estado, setEstado] = useState({ carregando: true, erro: null, tabela: null, aviso: null });
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  /* RECOLHIDA NUMA LINHA (25/09/2026): é configuração que quase nunca muda, e
     o cartão aberto empurrava a lista para o meio da tela. O formulário abre
     no "Alterar". */
  const [alterando, setAlterando] = useState(false);

  const carregar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    try {
      const r = await lerTabelaAtiva();
      setEstado({ carregando: false, erro: null, tabela: r.tabela, aviso: r.aviso || null });
      setCodigo(r.tabela?.codigo || "");
      setNome(r.tabela?.nome || "");
    } catch (e) {
      setEstado({ carregando: false, erro: e.message, tabela: null, aviso: null });
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const codigoValido = /^\d{1,10}$/.test(codigo.trim());
  const mudou = !!estado.tabela && (codigo.trim() !== estado.tabela.codigo || nome.trim() !== estado.tabela.nome);

  async function salvar() {
    if (!codigoValido || !nome.trim()) return;
    const ok = await confirmar({
      titulo: "Trocar a tabela ativa?",
      mensagem: `A partir de agora, a importação só aceita o relatório da tabela "${codigo.trim()} - ${nome.trim()}".`,
      confirmar: "Trocar tabela ativa",
      perigo: false,
    });
    if (!ok) return;
    setSalvando(true);
    try {
      const r = await salvarTabelaAtiva({ codigo: codigo.trim(), nome: nome.trim() });
      setEstado((e) => ({ ...e, tabela: r.tabela }));
      setAlterando(false);
      avisar.ok("Tabela ativa salva.");
    } catch (e) {
      avisar.erro("Não foi possível salvar a tabela ativa.", e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (!alterando && !estado.carregando && !estado.erro && !estado.aviso && estado.tabela) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-text-soft">
        <span className="label-mono">Tabela de preços ativa</span>
        <span className="text-text">{estado.tabela.codigo} · {estado.tabela.nome}</span>
        <DicaInfo rotulo="O que é a tabela ativa">
          A importação só aceita o relatório do Sienge gerado com esta tabela: o código e o nome precisam bater.
          {estado.tabela.atualizado_por && <><br /><br />Trocada por {estado.tabela.atualizado_por} {quandoFoi(estado.tabela.atualizado_em)}.</>}
        </DicaInfo>
        <Button variant="ghost" size="sm" onClick={() => setAlterando(true)}><Pencil size={14} aria-hidden="true" /> Alterar</Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tabela de preços ativa</CardTitle>
        <CardDescription>A importação só aceita o relatório do Sienge gerado com esta tabela: o código e o nome precisam bater.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {estado.carregando ? <Skeleton className="h-10 w-full" /> : estado.erro ? (
          <Alert tone="danger">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              Não conseguimos carregar a tabela ativa.
              <Button variant="outline" size="sm" onClick={carregar}><RefreshCw size={14} aria-hidden="true" /> Tentar novamente</Button>
            </AlertDescription>
          </Alert>
        ) : estado.aviso ? (
          <Alert tone="warning"><AlertDescription>{estado.aviso}</AlertDescription></Alert>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Field className="sm:w-32">
              <Label htmlFor={`${id}-codigo`} required>Código</Label>
              <Input id={`${id}-codigo`} inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </Field>
            <Field className="min-w-0 flex-1">
              <Label htmlFor={`${id}-nome`} required>Nome da tabela</Label>
              <Input id={`${id}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} />
            </Field>
            {estado.tabela && (
              <Button variant="outline" onClick={() => { setAlterando(false); setCodigo(estado.tabela.codigo); setNome(estado.tabela.nome); }}>Cancelar</Button>
            )}
            <Button onClick={salvar} disabled={!mudou || !codigoValido || !nome.trim() || salvando}>
              {salvando ? <Spinner size="sm" /> : null} Salvar tabela ativa
            </Button>
          </div>
        )}
        {estado.tabela?.atualizado_por && (
          <FieldHint>Trocada por {estado.tabela.atualizado_por} {quandoFoi(estado.tabela.atualizado_em)}.</FieldHint>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- o formulário do insumo (FormDialog: criar e editar) ---------- */

function FormularioDoInsumo({ insumo, aberto, onFechar, onSalvo }) {
  const id = useId();
  const novo = !insumo;
  const inicial = useMemo(() => ({
    codigo: insumo?.codigo || "", descricao: insumo?.descricao || "", unidade: insumo?.unidade || "", ativo: insumo?.ativo ?? true,
  }), [insumo]);
  const [valores, setValores] = useState(inicial);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (aberto) { setValores(inicial); setErros({}); setErroGeral(null); } }, [aberto, inicial]);

  const mudou = JSON.stringify(valores) !== JSON.stringify(inicial);
  const campo = (k) => (e) => setValores((v) => ({ ...v, [k]: e.target.value }));
  const validar = (v) => ({
    codigo: !/^\d{1,10}$/.test(v.codigo.trim()) ? "Informe o código do Sienge, só com números." : null,
    descricao: !v.descricao.trim() ? "Informe a descrição do insumo." : null,
    unidade: !v.unidade.trim() ? "Informe a unidade (un, m2, kg…)." : null,
  });

  async function fechar() {
    if (mudou && !salvando) {
      const descartar = await confirmar({ titulo: "Descartar alterações?", mensagem: "O que foi digitado neste insumo será perdido.", confirmar: "Descartar", cancelar: "Continuar editando" });
      if (!descartar) return;
    }
    onFechar();
  }

  async function salvar() {
    const e = validar(valores);
    setErros(e);
    if (Object.values(e).some(Boolean)) {
      document.getElementById(`${id}-${Object.keys(e).find((k) => e[k])}`)?.focus();
      return;
    }
    setSalvando(true);
    setErroGeral(null);
    try {
      let salvo;
      if (novo) {
        salvo = await criarInsumo({ codigo: valores.codigo.trim(), descricao: valores.descricao, unidade: valores.unidade.trim() });
      } else {
        const mudancas = {};
        if (valores.codigo.trim() !== insumo.codigo) mudancas.codigo = valores.codigo.trim();
        if (valores.descricao !== insumo.descricao) mudancas.descricao = valores.descricao;
        if (valores.unidade.trim() !== insumo.unidade) mudancas.unidade = valores.unidade.trim();
        if (valores.ativo !== insumo.ativo) mudancas.ativo = valores.ativo;
        salvo = Object.keys(mudancas).length ? await editarInsumo(insumo.id, mudancas) : insumo;
      }
      avisar.ok(novo ? "Insumo criado." : "Insumo salvo.");
      onSalvo(salvo);
    } catch (err) {
      // O servidor recusou código + descrição repetidos: o erro vai no campo.
      if (err.status === 409 || err.code === "23505") setErros((x) => ({ ...x, descricao: err.message }));
      else setErroGeral(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{novo ? "Novo insumo" : `Editar · ${insumo.codigo}`}</DialogTitle>
          <DialogDescription>
            {novo
              ? "Um insumo criado aqui é do time: a importação do relatório do Sienge não encosta nele."
              : insumo.origem === "sienge"
                ? "Veio do relatório do Sienge. Se mudar código, descrição ou unidade, a próxima importação pergunta qual valor fica."
                : "Criado na tela: a importação do relatório do Sienge não encosta nele."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {erroGeral && <Alert tone="danger"><AlertDescription>{erroGeral}</AlertDescription></Alert>}
          <Field>
            <Label htmlFor={`${id}-codigo`} required>Código</Label>
            <Input id={`${id}-codigo`} inputMode="numeric" value={valores.codigo} onChange={campo("codigo")}
              onBlur={() => setErros((x) => ({ ...x, codigo: validar(valores).codigo }))} aria-invalid={!!erros.codigo} />
            {erros.codigo ? <FieldHint state="error">{erros.codigo}</FieldHint> : <FieldHint>O código do insumo no Sienge.</FieldHint>}
          </Field>
          <Field>
            <Label htmlFor={`${id}-descricao`} required>Descrição</Label>
            <Textarea id={`${id}-descricao`} rows={3} value={valores.descricao} onChange={campo("descricao")}
              onBlur={() => setErros((x) => ({ ...x, descricao: validar(valores).descricao }))} aria-invalid={!!erros.descricao} />
            {erros.descricao && <FieldHint state="error">{erros.descricao}</FieldHint>}
          </Field>
          <Field className="sm:w-40">
            <Label htmlFor={`${id}-unidade`} required>Unidade</Label>
            <Input id={`${id}-unidade`} value={valores.unidade} onChange={campo("unidade")}
              onBlur={() => setErros((x) => ({ ...x, unidade: validar(valores).unidade }))} aria-invalid={!!erros.unidade} />
            {erros.unidade && <FieldHint state="error">{erros.unidade}</FieldHint>}
          </Field>
          {!novo && (
            <div className="flex items-center gap-4">
              <Switch id={`${id}-ativo`} checked={valores.ativo} onCheckedChange={(v) => setValores((x) => ({ ...x, ativo: v === true }))} />
              <Label htmlFor={`${id}-ativo`}>{valores.ativo ? "Ativo" : "Inativo"}</Label>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Spinner size="sm" /> : null} {novo ? "Criar insumo" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- o histórico de um insumo ---------- */

function HistoricoDoInsumo({ insumo, onFechar }) {
  const [estado, setEstado] = useState({ carregando: true, erro: null, linhas: [] });
  const carregar = useCallback(async () => {
    if (!insumo) return;
    setEstado({ carregando: true, erro: null, linhas: [] });
    try {
      setEstado({ carregando: false, erro: null, linhas: await historicoDoInsumo(insumo.id) });
    } catch (e) {
      setEstado({ carregando: false, erro: e.message, linhas: [] });
    }
  }, [insumo]);
  useEffect(() => { carregar(); }, [carregar]);

  const diferencas = (l) => ["codigo", "descricao", "unidade", "ativo"]
    .filter((k) => l.antes && l.depois && l.antes[k] !== l.depois[k])
    .map((k) => `${k === "ativo" ? "situação" : k}: ${String(l.antes[k])} → ${String(l.depois[k])}`);

  return (
    <Sheet open={!!insumo} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Histórico do insumo</SheetTitle>
          <SheetDescription>{insumo ? `${insumo.codigo} · ${insumo.descricao}` : ""}</SheetDescription>
        </SheetHeader>
        {estado.carregando ? <Skeleton className="h-24 w-full" /> : estado.erro ? (
          <Alert tone="danger">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              Não conseguimos carregar o histórico.
              <Button variant="outline" size="sm" onClick={carregar}><RefreshCw size={14} aria-hidden="true" /> Tentar novamente</Button>
            </AlertDescription>
          </Alert>
        ) : !estado.linhas.length ? (
          <p className="text-sm text-text-mute">Nenhuma mudança registrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Quando</TableHead><TableHead>O que</TableHead><TableHead>Quem</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {estado.linhas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-sm">{quandoFoi(l.criado_em)}</TableCell>
                  <TableCell className="text-sm">
                    <div>{ROTULO_DA_ACAO[l.acao] || l.acao}</div>
                    {diferencas(l).map((d) => <div key={d} className="text-xs text-text-mute">{d}</div>)}
                  </TableCell>
                  <TableCell className="text-sm text-text-mute">{l.autor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ---------- as importações feitas ---------- */

function ImportacoesFeitas({ lista, carregando, erro, onRecarregar }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Importações</CardTitle>
        <CardDescription>Quem subiu cada relatório, quando, de qual tabela e o que mudou. Os arquivos das 12 últimas ficam guardados.</CardDescription>
      </CardHeader>
      <CardContent>
        {carregando ? <Skeleton className="h-24 w-full" /> : erro ? (
          <Alert tone="danger">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              Não conseguimos carregar as importações.
              <Button variant="outline" size="sm" onClick={onRecarregar}><RefreshCw size={14} aria-hidden="true" /> Tentar novamente</Button>
            </AlertDescription>
          </Alert>
        ) : !lista.length ? (
          <p className="text-sm text-text-mute">Nenhum relatório importado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Relatório de</TableHead>
                  <TableHead>Caminho</TableHead>
                  <TableHead className="text-right">Entraram</TableHead>
                  <TableHead className="text-right">Saíram</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((i) => {
                  const s = SITUACAO_DA_IMPORTACAO[i.status] || SITUACAO_DA_IMPORTACAO.enviado;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="whitespace-nowrap text-sm">{quandoFoi(i.criado_em)}</TableCell>
                      <TableCell className="text-sm text-text-mute">{i.por}</TableCell>
                      <TableCell className="text-sm">{i.tabela_codigo ? `${i.tabela_codigo} - ${i.tabela_nome}` : "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{i.relatorio_gerado_em ? quandoFoi(i.relatorio_gerado_em) : "—"}</TableCell>
                      <TableCell className="text-sm">{i.caminho === "apagar" ? "Apagar o que não veio" : i.caminho === "manter" ? "Manter e incluir os novos" : "—"}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{numero(i.gravadas)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{numero(i.apagados)}</TableCell>
                      <TableCell><Badge tone={s.tom}>{s.rotulo}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- a aba ---------- */

export function CadastroDeInsumos() {
  const idBusca = useId();
  const [filtros, setFiltros] = useState(estadoDaUrl);
  const [digitado, setDigitado] = useState(filtros.busca);
  const [pagina, setPagina] = useState({ carregando: true, erro: null, itens: [], total: 0, aviso: null });
  const [unidades, setUnidades] = useState([]);
  const [importacoes, setImportacoes] = useState({ carregando: true, erro: null, lista: [] });
  const [editando, setEditando] = useState(null);      // null fechado · {} novo · insumo
  const [historico, setHistorico] = useState(null);
  const [importando, setImportando] = useState(false);
  const [continuando, setContinuando] = useState(null); // quanto falta, enquanto continua
  const pedido = useRef(0);

  useEffect(() => { escreverNaUrl(filtros); }, [filtros]);
  useEffect(() => () => escreverNaUrl(null), []);

  // Busca com espera de 300 ms e mínimo de 2 letras (TELA-11).
  useEffect(() => {
    const t = setTimeout(() => {
      const busca = digitado.trim().length >= 2 ? digitado.trim() : "";
      setFiltros((f) => (f.busca === busca ? f : { ...f, busca, de: 0 }));
    }, 300);
    return () => clearTimeout(t);
  }, [digitado]);

  const carregar = useCallback(async () => {
    const meu = ++pedido.current;
    setPagina((p) => ({ ...p, carregando: true, erro: null }));
    try {
      const r = await listarInsumos(filtros);
      if (meu !== pedido.current) return;
      setPagina({ carregando: false, erro: null, itens: r.itens || [], total: r.total || 0, aviso: r.aviso || null });
    } catch (e) {
      if (meu !== pedido.current) return;
      setPagina({ carregando: false, erro: e.message, itens: [], total: 0, aviso: null });
    }
  }, [filtros]);
  useEffect(() => { carregar(); }, [carregar]);

  const carregarUnidades = useCallback(() => {
    listarUnidades().then((u) => setUnidades(Array.isArray(u) ? u : [])).catch(() => setUnidades([]));
  }, []);
  useEffect(() => { carregarUnidades(); }, [carregarUnidades]);

  const carregarImportacoes = useCallback(async () => {
    setImportacoes((i) => ({ ...i, carregando: true, erro: null }));
    try {
      const r = await listarImportacoes();
      setImportacoes({ carregando: false, erro: null, lista: r.lista || [] });
    } catch (e) {
      setImportacoes({ carregando: false, erro: e.message, lista: [] });
    }
  }, []);
  useEffect(() => { carregarImportacoes(); }, [carregarImportacoes]);

  const recarregarTudo = () => { carregar(); carregarUnidades(); carregarImportacoes(); };

  const temFiltro = !!filtros.busca || filtros.ativo !== "todos" || !!filtros.unidade;
  const limparFiltros = () => { setDigitado(""); setFiltros((f) => ({ ...f, busca: "", ativo: "todos", unidade: "", de: 0 })); };

  // A última importação que parou no meio (e não é esta tela que está gravando).
  const incompleta = importacoes.lista.find((i) => i.status === "incompleta" || i.status === "gravando") || null;

  async function continuar() {
    if (!incompleta) return;
    setContinuando(0);
    try {
      await aplicarImportacao(incompleta.id, {
        caminho: incompleta.caminho, conflitos: incompleta.conflitos || {}, confirmouNome: !!incompleta.confirmou_nome,
      }, (restantes) => setContinuando(restantes ?? 0));
      avisar.ok("Importação concluída.");
    } catch (e) {
      avisar.erro("Não foi possível terminar a importação.", e.message);
    } finally {
      setContinuando(null);
      recarregarTudo();
    }
  }

  async function apagar(insumo) {
    // RN-087 — pedido ao Sienge não se apaga: a tela mostra onde, antes de perguntar.
    let usos = [];
    try {
      ({ usos } = await usosDoInsumo(insumo.id));
    } catch (e) {
      avisar.erro("Não foi possível conferir se o insumo está em uso.", e.message);
      return;
    }
    if (usos.length) {
      await mensagem({
        titulo: "Este insumo não pode ser apagado",
        mensagem: (
          <>
            Ele foi pedido ao Sienge {usos.length === 1 ? "nesta solicitação" : `nestas ${usos.length} solicitações`}:
            <span className="mt-2 flex flex-col gap-1">
              {usos.map((u, k) => (
                <span key={k}>Obra {u.obraCodigo}{u.solicitacaoId ? ` · solicitação ${u.solicitacaoId}` : ""}{u.enviadoEm ? ` · ${quandoFoi(u.enviadoEm)}` : ""}</span>
              ))}
            </span>
            <span className="mt-2 block">Para tirá-lo de circulação, desative-o.</span>
          </>
        ),
      });
      return;
    }
    const ok = await confirmar({
      titulo: "Excluir insumo?",
      mensagem: `${insumo.codigo} · ${insumo.descricao} será excluído permanentemente. Essa ação não pode ser desfeita.`,
      confirmar: "Excluir insumo",
    });
    if (!ok) return;
    try {
      await apagarInsumo(insumo.id);
      avisar.ok("Insumo excluído.");
      carregar();
      carregarUnidades();
    } catch (e) {
      avisar.erro("Não foi possível excluir o insumo.", e.message);
    }
  }

  const colunas = [
    /* A DESCRIÇÃO EM ATÉ DUAS LINHAS (25/09/2026). O EditorialNameCell do DS
       só trunca, e na tabela do DS (largura pelo conteúdo) a descrição mais
       longa esticava a coluna para 905px e empurrava as outras para fora da
       tela. O `w-0 min-w-full` faz o texto ocupar só o que sobra; a célula
       repete o desenho do EditorialNameCell (código mono em cima, nome
       serif) — lacuna do DS: variante que quebra em 2 linhas. */
    {
      key: "insumo", header: "Insumo", cell: (r) => (
        <div className="w-0 min-w-full">
          <div className="mono text-xs text-text-mute">{r.codigo}</div>
          <div className="serif line-clamp-2 leading-tight text-text" title={r.descricao}>{r.descricao}</div>
        </div>
      ),
    },
    {
      key: "detalhes", header: "Detalhes", width: "w-20", align: "right", cell: (r) => (
        <span className={`mono tabular-nums ${r.detalhes ? "text-text" : "text-text-mute"}`}
          title="Detalhes (variantes) deste insumo na base de preços">{r.detalhes ?? "—"}</span>
      ),
    },
    { key: "unidade", header: "Unidade", width: "w-20", cell: (r) => <span className="text-sm">{r.unidade}</span> },
    {
      key: "origem", header: "Origem", width: "w-28", cell: (r) => (
        <span className="flex flex-wrap gap-1">
          <Badge tone="neutral">{r.origem === "sienge" ? "Sienge" : "Tela"}</Badge>
          {r.editado && <Badge tone="warning" title="Editado na tela depois de vir do Sienge">editado</Badge>}
        </span>
      ),
    },
    { key: "situacao", header: "Situação", width: "w-24", cell: (r) => <Badge tone={r.ativo ? "success" : "neutral"}>{r.ativo ? "Ativo" : "Inativo"}</Badge> },
  ];

  return (
    <>
      {incompleta && (
        <Alert tone="warning">
          <AlertTitle>A última importação não terminou</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1">
              {incompleta.arquivo_nome} · {quandoFoi(incompleta.criado_em)}. O que entrou fica; continuar grava o resto, com as mesmas escolhas.
            </span>
            <Button size="sm" onClick={continuar} disabled={continuando !== null}>
              {continuando !== null ? <><Spinner size="sm" /> {continuando ? `Faltam ${numero(continuando)}` : "Continuando…"}</> : "Continuar importação"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <TabelaAtiva />

      <section className="flex flex-col gap-4" aria-label="Insumos">
        <Subheader label={pagina.total ? `Insumos · ${numero(pagina.total)}` : "Insumos"} actions={(
          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Mais ações <ChevronDown size={14} aria-hidden="true" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setImportando(true)} disabled={!!incompleta}>
                  <Upload size={14} aria-hidden="true" /> Importar relatório do Sienge
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setEditando({})}><Plus size={16} aria-hidden="true" /> Novo insumo</Button>
          </div>
        )} />

        {pagina.aviso && <Alert tone="warning"><AlertDescription>{pagina.aviso}</AlertDescription></Alert>}

        <div className="flex items-end gap-4 overflow-x-auto pb-1">
          <div className="flex min-w-64 flex-1 flex-col gap-1">
            <Label htmlFor={idBusca} className="sr-only">Buscar insumo</Label>
            <Input id={idBusca} icon={<Search size={16} aria-hidden="true" />} value={digitado}
              onChange={(e) => setDigitado(e.target.value)} placeholder="Buscar por código ou descrição…" />
          </div>
          <SavedViewChips views={VISOES} activeId={filtros.ativo} label="Situação"
            onSelect={(ativo) => setFiltros((f) => ({ ...f, ativo, de: 0 }))} />
          <Choice label="Unidade" rotuloVisivel={false} className="w-44 shrink-0"
            value={filtros.unidade || TODAS}
            opcoes={[{ value: TODAS, label: "Todas as unidades" }, ...unidades.map((u) => ({ value: u, label: u }))]}
            onChange={(v) => setFiltros((f) => ({ ...f, unidade: v === TODAS ? "" : v, de: 0 }))} />
        </div>

        {temFiltro && (
          <ActiveFilters count={pagina.total} loading={pagina.carregando} hasFilters={temFiltro} onClearAll={limparFiltros} noun="insumo">
            {filtros.busca && <FilterChip label="Busca" value={filtros.busca} onClear={() => { setDigitado(""); setFiltros((f) => ({ ...f, busca: "", de: 0 })); }} />}
            {filtros.ativo !== "todos" && <FilterChip label="Situação" value={filtros.ativo === "sim" ? "Ativos" : "Inativos"} onClear={() => setFiltros((f) => ({ ...f, ativo: "todos", de: 0 }))} />}
            {filtros.unidade && <FilterChip label="Unidade" value={filtros.unidade} onClear={() => setFiltros((f) => ({ ...f, unidade: "", de: 0 }))} />}
          </ActiveFilters>
        )}

        {pagina.erro ? (
          <Alert tone="danger">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              Não conseguimos carregar os insumos.
              <Button variant="outline" size="sm" onClick={carregar}><RefreshCw size={14} aria-hidden="true" /> Tentar novamente</Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <EditorialTable
              data={pagina.itens}
              columns={colunas}
              getRowKey={(r) => String(r.id)}
              isLoading={pagina.carregando && !pagina.itens.length}
              busy={pagina.carregando && pagina.itens.length > 0}
              onRowClick={(r) => setEditando(r)}
              rowActions={(r) => (
                <>
                  <BotaoIcone rotulo="Editar insumo" variant="ghost" onClick={() => setEditando(r)}><Pencil size={16} /></BotaoIcone>
                  <BotaoIcone rotulo="Histórico do insumo" variant="ghost" onClick={() => setHistorico(r)}><History size={16} /></BotaoIcone>
                  <BotaoIcone rotulo="Excluir insumo" variant="ghost" onClick={() => apagar(r)}><Trash2 size={16} /></BotaoIcone>
                </>
              )}
              emptyTitle={temFiltro ? "Nenhum resultado para os filtros aplicados" : "Nenhum insumo cadastrado ainda"}
              emptyDescription={temFiltro ? undefined : "Importe o relatório de Insumos do Sienge ou crie um insumo."}
              emptyAction={temFiltro
                ? <Button variant="outline" onClick={limparFiltros}>Limpar filtros</Button>
                : <Button onClick={() => setImportando(true)}><Upload size={16} aria-hidden="true" /> Importar relatório do Sienge</Button>}
            />
            {pagina.total > 0 && (
              <PaginationFooter offset={filtros.de} pageSize={filtros.passo} count={pagina.itens.length} total={pagina.total}
                hasNext={filtros.de + filtros.passo < pagina.total} busy={pagina.carregando} pageSizes={PASSOS}
                onPageSize={(passo) => setFiltros((f) => ({ ...f, passo, de: 0 }))}
                onPrev={() => setFiltros((f) => ({ ...f, de: Math.max(0, f.de - f.passo) }))}
                onNext={() => setFiltros((f) => ({ ...f, de: f.de + f.passo }))} />
            )}
          </>
        )}
      </section>

      <ImportacoesFeitas lista={importacoes.lista} carregando={importacoes.carregando} erro={importacoes.erro} onRecarregar={carregarImportacoes} />

      <FormularioDoInsumo
        aberto={editando !== null}
        insumo={editando && editando.id ? editando : null}
        onFechar={() => setEditando(null)}
        onSalvo={() => { setEditando(null); carregar(); carregarUnidades(); }} />
      <HistoricoDoInsumo insumo={historico} onFechar={() => setHistorico(null)} />
      <ImportarRelatorio aberto={importando} onFechar={() => setImportando(false)} onConcluido={recarregarTudo} />
    </>
  );
}
