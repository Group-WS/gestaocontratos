import React, { useEffect, useId, useState } from "react";
import {
  Alert, AlertDescription, AlertTitle, Button, Checkbox, Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, FileInput, KpiMini, Label, Progress, RadioCard, RadioGroup, RadioGroupItem,
  Separator, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@group-ws/ws-ui";
import { Colapsavel, SecaoRotulo } from "../../lib/ui.jsx";
import { avisar } from "../../lib/confirmar.jsx";
import { quandoFoi } from "../../lib/pessoas.js";
import { enviarRelatorio, aplicarImportacao } from "../../lib/insumoCadastro.js";

/* ============================================================
   IMPORTAR O RELATÓRIO "INSUMOS" DO SIENGE (ADR-008, itens 1 a 7)

   Três passos, num diálogo só:
     1. o admin escolhe o xlsx; ele sobe para o balde e a API monta a prévia;
     2. a PRÉVIA mostra os números, as listas e pede as decisões: o caminho
        (apagar o que não veio, ou manter e só incluir os novos — nenhum vem
        marcado), cada conflito entre a edição da tela e o relatório, e a
        confirmação quando só o nome da tabela mudou (RN-088);
     3. a gravação, com progresso. Se parar no meio, o que entrou fica e a
        aba mostra o aviso com "Continuar importação".
   ============================================================ */

const numero = (n) => (Number.isFinite(n) ? n.toLocaleString("pt-BR") : "—");
/** "1 registro" · "3 registros": o número e a palavra certa para ele. */
const plural = (n, um, varios) => `${numero(n)} ${n === 1 ? um : varios}`;
const XLSX = { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] };

/** Uma lista da prévia, fechada por padrão, com o total e o corte. */
function ListaDaPrevia({ titulo, lista, colunas, vazio = null }) {
  const [aberto, setAberto] = useState(false);
  const total = lista?.total || 0;
  if (!total) return vazio;
  const itens = lista.itens || [];
  return (
    <Colapsavel aberto={aberto} onAbrir={setAberto}
      cabecalho={<span className="text-sm font-semibold">{titulo} <span className="font-normal text-text-mute">({numero(total)})</span></span>}>
      <div className="overflow-x-auto border-t border-line-1">
        <Table>
          <TableHeader>
            <TableRow>{colunas.map((c) => <TableHead key={c.titulo} className={c.classe}>{c.titulo}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((l, k) => (
              <TableRow key={k}>{colunas.map((c) => <TableCell key={c.titulo} className={`text-sm ${c.classe || ""}`}>{c.valor(l)}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
        {itens.length < total && <p className="px-4 py-2 text-xs text-text-mute">Mostrando {numero(itens.length)} de {numero(total)}.</p>}
      </div>
    </Colapsavel>
  );
}

const onde = (usos) => (usos || []).map((u) => `obra ${u.obraCodigo}${u.solicitacaoId ? ` · sol. ${u.solicitacaoId}` : ""}`).join("; ");

export function ImportarRelatorio({ aberto, onFechar, onConcluido }) {
  const id = useId();
  const [etapa, setEtapa] = useState("escolher");   // escolher · lendo · recusado · previa · gravando
  const [recusa, setRecusa] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [caminho, setCaminho] = useState(null);
  const [conflitos, setConflitos] = useState({});
  const [confirmouNome, setConfirmouNome] = useState(false);
  const [progresso, setProgresso] = useState({ total: 0, restantes: null });

  useEffect(() => {
    if (!aberto) return;
    setEtapa("escolher"); setRecusa(null); setPrevia(null); setCaminho(null);
    setConflitos({}); setConfirmouNome(false); setProgresso({ total: 0, restantes: null });
  }, [aberto]);

  async function escolher(arquivos) {
    const arquivo = arquivos?.[0];
    if (!arquivo) return;
    if (!/\.xlsx$/i.test(arquivo.name)) {
      setRecusa({ mensagem: "Envie o relatório em Excel (.xlsx), do jeito que o Sienge gera.", erros: [] });
      setEtapa("recusado");
      return;
    }
    setEtapa("lendo");
    try {
      const r = await enviarRelatorio(arquivo);
      setPrevia(r);
      setEtapa("previa");
    } catch (e) {
      setRecusa({ mensagem: e.message, erros: Array.isArray(e.erros) ? e.erros : [] });
      setEtapa("recusado");
    }
  }

  const r = previa?.resumo;
  const listaDeConflitos = previa?.listas?.conflitos?.itens || [];
  const nomeMudou = r?.tabelaConfere === "so_o_nome_mudou";
  const faltaDecidir = listaDeConflitos.filter((c) => !conflitos[c.id]).length;
  const podeGravar = etapa === "previa" && !!caminho && faltaDecidir === 0 && (!nomeMudou || confirmouNome);
  const motivo = !caminho ? "Escolha o que fazer com o que não veio no relatório."
    : faltaDecidir ? `Decida ${faltaDecidir === 1 ? "o conflito" : `os ${faltaDecidir} conflitos`} abaixo.`
      : nomeMudou && !confirmouNome ? "Confirme que o relatório é da tabela ativa." : null;
  const saidaGrande = r && r.sairiam > 0 && r.cadastroHoje > 0 && r.sairiam / r.cadastroHoje >= 0.1;

  const decidirTodos = (escolha) => setConflitos(Object.fromEntries(listaDeConflitos.map((c) => [
    c.id, escolha === "relatorio" && !c.podeUsarRelatorio ? "edicao" : escolha])));

  async function gravar() {
    if (!podeGravar) return;
    setEtapa("gravando");
    const total = (r.inserir || 0) + (r.atualizar || 0) + (caminho === "apagar" ? r.sairiam || 0 : 0);
    setProgresso({ total, restantes: total });
    try {
      const fim = await aplicarImportacao(previa.id, { caminho, conflitos, confirmouNome },
        (restantes) => setProgresso({ total, restantes: restantes ?? total }));
      const res = fim?.resumo?.resultado || {};
      avisar.ok("Cadastro de insumos atualizado.",
        `${numero(res.gravadas)} gravados${caminho === "apagar" ? ` · ${numero(res.apagados)} saíram` : ""}${res.ficaramEmUso ? ` · ${numero(res.ficaramEmUso)} ficaram por estar em uso` : ""}.`);
    } catch (e) {
      avisar.erro("Não foi possível terminar a importação.", e.message, { duracao: 10000 });
    } finally {
      onConcluido();
      onFechar();
    }
  }

  const gravando = etapa === "gravando";
  const pct = progresso.total ? Math.round(((progresso.total - (progresso.restantes ?? progresso.total)) / progresso.total) * 100) : 0;

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v && !gravando) onFechar(); }}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Importar relatório de Insumos do Sienge</DialogTitle>
          <DialogDescription>
            O relatório "Insumos" em Excel, gerado pelo Sienge com a tabela ativa. Nada é gravado antes de você conferir a prévia.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-6">
          {etapa === "escolher" && (
            <FileInput accept={XLSX} maxFiles={1} multiple={false} onDrop={escolher}
              label="Arraste o relatório (.xlsx) ou clique para escolher"
              hint="O arquivo fica guardado junto do registro da importação." />
          )}

          {etapa === "lendo" && (
            <div className="flex items-center gap-2 text-sm text-text-mute"><Spinner size="sm" /> Lendo o relatório e montando a prévia…</div>
          )}

          {etapa === "recusado" && recusa && (
            <Alert tone="danger">
              <AlertTitle>Este arquivo não foi aceito</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>{recusa.mensagem}</span>
                {recusa.erros.map((e) => <span key={e}>· {e}</span>)}
              </AlertDescription>
            </Alert>
          )}

          {(etapa === "previa" || gravando) && r && (
            <>
              <p className="text-sm text-text-mute">
                Tabela <b className="text-text">{r.tabela?.codigo} - {r.tabela?.nome}</b>
                {r.geradoEm ? <> · relatório gerado {quandoFoi(r.geradoEm)}</> : null}
                {" "}· hoje o cadastro tem {plural(r.cadastroHoje, "registro", "registros")}.
              </p>

              {nomeMudou && (
                <Alert tone="warning">
                  <AlertTitle>O nome da tabela mudou</AlertTitle>
                  <AlertDescription className="flex flex-col gap-2">
                    <span>O relatório diz "{r.tabela?.codigo} - {r.tabela?.nome}", e a tabela ativa é "{r.tabelaAtiva?.codigo} - {r.tabelaAtiva?.nome}". O código é o mesmo.</span>
                    <span className="flex items-center gap-2">
                      <Checkbox id={`${id}-nome`} checked={confirmouNome} disabled={gravando} onCheckedChange={(v) => setConfirmouNome(v === true)} />
                      <Label htmlFor={`${id}-nome`} className="font-normal">Confirmo que o relatório é da tabela ativa</Label>
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiMini label="linhas no arquivo" value={numero(r.linhas)} />
                <KpiMini label="entram novos" value={numero(r.inserir)} tone={r.inserir ? "brand" : "neutral"} />
                <KpiMini label="atualizados" value={numero(r.atualizar)} hint={r.reativados ? `${numero(r.reativados)} voltam a ativo` : undefined} />
                <KpiMini label="ficam de fora" value={numero((r.vb || 0) + (r.fora || 0))} hint={`${numero(r.vb)} em vb · ${numero(r.fora)} incompletas`} />
              </div>

              <div className="flex flex-col gap-2">
                <SecaoRotulo>O que não veio no relatório</SecaoRotulo>
                {saidaGrande && caminho !== "manter" && (
                  <Alert tone="warning">
                    <AlertDescription>
                      <b>{numero(r.sairiam)} de {numero(r.cadastroHoje)}</b> registros sairiam no caminho "apagar". Confira se o relatório está completo antes de gravar.
                    </AlertDescription>
                  </Alert>
                )}
                <RadioGroup value={caminho ?? ""} onValueChange={setCaminho} disabled={gravando} aria-label="O que fazer com o que não veio" className="grid gap-2 sm:grid-cols-2">
                  <RadioCard value="apagar" title="Apagar o que não veio"
                    description={`${plural(r.sairiam, "sai", "saem")} do cadastro.${r.ficamEmUso ? ` ${plural(r.ficamEmUso, "fica por já ter sido pedido", "ficam por já terem sido pedidos")} ao Sienge.` : ""} O que foi criado na tela não sai.`} />
                  <RadioCard value="manter" title="Manter e só incluir os novos"
                    description={`Nada sai: ${r.naoVieram === 1 ? "1 registro que não veio continua como está" : `${numero(r.naoVieram)} registros que não vieram continuam como estão`}.`} />
                </RadioGroup>
              </div>

              {listaDeConflitos.length > 0 && (
                <div className="flex flex-col gap-2">
                  <SecaoRotulo conta={faltaDecidir ? `${faltaDecidir} sem decisão` : "todos decididos"}>
                    Editados na tela que o relatório traz diferente ({numero(listaDeConflitos.length)})
                  </SecaoRotulo>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={gravando} onClick={() => decidirTodos("edicao")}>Manter todas as edições</Button>
                    <Button variant="outline" size="sm" disabled={gravando} onClick={() => decidirTodos("relatorio")}>Usar o relatório em todos</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Código</TableHead>
                          <TableHead>Na tela</TableHead>
                          <TableHead>No relatório</TableHead>
                          <TableHead className="w-64">Fica</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listaDeConflitos.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-sm tabular-nums">{c.atual.codigo}</TableCell>
                            <TableCell className="text-sm">{c.atual.descricao} <span className="text-text-mute">· {c.atual.unidade}</span></TableCell>
                            <TableCell className="text-sm">{c.relatorio.descricao} <span className="text-text-mute">· {c.relatorio.unidade}</span></TableCell>
                            <TableCell>
                              <RadioGroup value={conflitos[c.id] ?? ""} disabled={gravando}
                                onValueChange={(v) => setConflitos((x) => ({ ...x, [c.id]: v }))}
                                aria-label={`O que fica no insumo ${c.atual.codigo}`} className="flex flex-col gap-1">
                                <span className="flex items-center gap-2">
                                  <RadioGroupItem id={`${id}-${c.id}-e`} value="edicao" />
                                  <Label htmlFor={`${id}-${c.id}-e`} className="font-normal">A edição da tela</Label>
                                </span>
                                <span className="flex items-center gap-2" title={c.podeUsarRelatorio ? undefined : "Outro registro já usa este código e esta descrição"}>
                                  <RadioGroupItem id={`${id}-${c.id}-r`} value="relatorio" disabled={!c.podeUsarRelatorio} />
                                  <Label htmlFor={`${id}-${c.id}-r`} className="font-normal">O texto do relatório</Label>
                                </span>
                              </RadioGroup>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <Separator />
              <div className="flex flex-col">
                <ListaDaPrevia titulo="Vão sair, no caminho apagar" lista={previa.listas.sairiam}
                  colunas={[{ titulo: "Código", classe: "w-20", valor: (l) => l.codigo }, { titulo: "Descrição", valor: (l) => l.descricao }, { titulo: "Unidade", classe: "w-20", valor: (l) => l.unidade }]} />
                <ListaDaPrevia titulo="Ficam por já terem sido pedidos ao Sienge" lista={previa.listas.ficamEmUso}
                  colunas={[{ titulo: "Código", classe: "w-20", valor: (l) => l.codigo }, { titulo: "Descrição", valor: (l) => l.descricao }, { titulo: "Onde", valor: (l) => onde(l.usos) }]} />
                <ListaDaPrevia titulo="Linhas deixadas de fora" lista={previa.listas.fora}
                  colunas={[{ titulo: "Linha", classe: "w-20", valor: (l) => l.linhaExcel }, { titulo: "Motivo", valor: (l) => l.motivo }, { titulo: "Código", classe: "w-20", valor: (l) => l.codigo || "—" }, { titulo: "Descrição", valor: (l) => l.descricao || "—" }]} />
                <ListaDaPrevia titulo="Repetidas, juntadas numa só" lista={previa.listas.repetidas}
                  colunas={[{ titulo: "Linha", classe: "w-20", valor: (l) => l.linhaExcel }, { titulo: "Igual à linha", classe: "w-28", valor: (l) => l.igualALinha }, { titulo: "Código", classe: "w-20", valor: (l) => l.codigo }, { titulo: "Descrição", valor: (l) => l.descricao }]} />
                <ListaDaPrevia titulo="Parecidas: só um espaço diferente (entram as duas)" lista={previa.listas.pares}
                  colunas={[{ titulo: "Código", classe: "w-20", valor: (l) => l.codigo }, { titulo: "Linhas do Excel", valor: (l) => l.linhas.map((x) => x.linhaExcel).join(", ") }, { titulo: "Descrição", valor: (l) => l.linhas[0]?.descricao }]} />
                <ListaDaPrevia titulo="Já existem, criadas na tela (ficam como estão)" lista={previa.listas.jaExistem}
                  colunas={[{ titulo: "Código", classe: "w-20", valor: (l) => l.codigo }, { titulo: "Descrição", valor: (l) => l.descricao }]} />
              </div>

              {gravando && (
                <div className="flex flex-col gap-2">
                  <Progress value={pct} aria-label="Progresso da gravação" />
                  <span className="text-sm text-text-mute">Gravando… {progresso.restantes ? `faltam ${numero(progresso.restantes)}` : ""}</span>
                </div>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {motivo && etapa === "previa" && <span className="mr-auto text-xs text-text-mute">{motivo}</span>}
          <Button variant="outline" onClick={onFechar} disabled={gravando}>{etapa === "recusado" ? "Fechar" : "Cancelar"}</Button>
          {etapa === "recusado" && <Button onClick={() => { setRecusa(null); setEtapa("escolher"); }}>Escolher outro arquivo</Button>}
          {(etapa === "previa" || gravando) && (
            <Button onClick={gravar} disabled={!podeGravar}>
              {gravando ? <><Spinner size="sm" /> Gravando…</> : "Gravar no cadastro"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
