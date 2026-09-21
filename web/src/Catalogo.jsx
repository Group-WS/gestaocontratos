import React, { useEffect, useMemo, useState, useCallback, useId } from "react";
import { confirmar, avisar } from "./lib/confirmar.jsx";
import { SeletorDeArquivo } from "./lib/ui.jsx";
import {
  Alert, AlertTitle, AlertDescription, Badge, BulkActionBar, Button,
  Card, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogBody, DialogFooter, EmptyState, Field, FieldHint, Input, Label, KpiMini,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Tabs, TabsList, TabsTrigger, Textarea, ToggleGroup, ToggleGroupItem,
} from "@group-ws/ws-ui";
import {
  Search, Plus, Image as ImageIcon, Trash2, Pencil, X, Store,
  Check, ArrowRight, Upload, Presentation, PackageOpen,
} from "lucide-react";
import {
  listarProdutos, salvarProduto, excluirProduto,
  listarFornecedores, salvarFornecedor, excluirFornecedor,
  subirImagem, urlDaImagem,
  subgrupoDe, subgruposDaVerba, SUBGRUPOS, TIPOS, ehAcabamento, podeIrParaObra, duplicatasDe, normalizarDescricao,
  filtrarProdutos, porPrateleira,
  centavos, reais, precoVelho, mesesDesde, produtoParaItem,
} from "./lib/catalogo";
import { eapAtual } from "./lib/eap";
import { lerProdutos, ancorasDeImagem, juntar, resumoDaImportacao } from "./lib/catalogoImport";
import { lerPptx, resumoPptx } from "./lib/catalogoPptx";
import Apresentacao from "./Apresentacao";
import { carregarDadosObra, salvarDadosObra } from "./lib/dadosObra";

/**
 * CATÁLOGO TKWS — o que a casa especifica.
 *
 * Mora em arquivo próprio, e não dentro do App.jsx, porque o App já passa
 * de 14 mil linhas. Toda a aparência vem do design system (@group-ws/ws-ui)
 * e de classes de token do Tailwind: não há CSS local neste arquivo.
 */

const fmt = (c) => (c == null ? null
  : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

const hoje = () => new Date().toISOString().slice(0, 10);

/* Valor que representa "sem filtro" nos grupos de chips e selects do DS:
   o Radix não aceita item com valor vazio, então "" vira este marcador só
   na borda com o componente — o estado continua guardando "". */
const TODOS = "__todos__";

/* As verbas que o catálogo usa: as que têm subgrupo desenhado, mais
   qualquer outra em que já exista produto. Mostrar as 32 verbas da EAP
   numa barra de filtro seria uma parede onde 28 estão sempre vazias. */
function verbasDoCatalogo(produtos, eap) {
  const nomes = new Map((eap || []).map((g) => [g.num, g.nome]));
  const usadas = new Set([...Object.keys(SUBGRUPOS), ...(produtos || []).map((p) => p.verba)]);
  return [...usadas].sort().map((num) => ({ num, nome: nomes.get(num) || num }));
}

export default function Catalogo({ usuario, obras, podeEditar }) {
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [termo, setTermo] = useState("");
  const [verba, setVerba] = useState("");
  const [subgrupo, setSubgrupo] = useState("");
  const [forn, setForn] = useState("");
  const [tipoItem, setTipoItem] = useState("produto");

  const [escolhidos, setEscolhidos] = useState(() => new Set());
  const [editando, setEditando] = useState(null);      // produto em edição, ou {} pra novo
  const [aba, setAba] = useState("produtos");          // produtos | fornecedores
  const [enviando, setEnviando] = useState(false);
  const [importando, setImportando] = useState(null);
  const [apresentando, setApresentando] = useState(false);

  const eap = eapAtual()?.grupos || [];
  const nomeVerba = useCallback(
    (num) => (eap.find((g) => g.num === num) || {}).nome || num, [eap]);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarProdutos(), listarFornecedores()])
      .then(([p, f]) => { if (vivo) { setProdutos(p); setFornecedores(f); } })
      .catch((e) => { if (vivo) setErro(mensagemDeErro(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  const achados = useMemo(
    () => filtrarProdutos(produtos, { termo, verba, subgrupo, fornecedor: forn, tipoItem }),
    [produtos, termo, verba, subgrupo, forn, tipoItem]);
  const quantos = useMemo(() => {
    const c = { produto: 0, acabamento: 0 };
    produtos.forEach((p) => { if (p.ativo !== false) c[p.tipoItem === "acabamento" ? "acabamento" : "produto"] += 1; });
    return c;
  }, [produtos]);

  const prateleiras = useMemo(() => porPrateleira(achados), [achados]);
  const verbas = useMemo(() => verbasDoCatalogo(achados, eap), [achados, eap]);
  const semSubgrupo = useMemo(() => produtos.filter((p) => !p.subgrupo).length, [produtos]);

  const alternar = (id) => setEscolhidos((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const limparFiltros = () => { setTermo(""); setVerba(""); setSubgrupo(""); setForn(""); };
  const temFiltro = Boolean(termo || verba || subgrupo || forn);

  async function salvar(p) {
    const salvo = await salvarProduto({ ...p, criadoPor: usuario }, usuario);
    setProdutos((l) => {
      const i = l.findIndex((x) => x.id === salvo.id);
      return i >= 0 ? l.map((x) => (x.id === salvo.id ? salvo : x)) : [...l, salvo];
    });
    setEditando(null);

    /* O campo fornecedor do produto é texto livre — digitar um nome novo
       aqui não pode deixá-lo só dentro do produto, sem cadastro próprio
       (é lá que fica o contato de quem vende). Só cria se o nome ainda
       não existir: repetir o já cadastrado apagaria contato/telefone que
       alguém já preencheu. */
    const nome = String(salvo.fornecedor || "").trim();
    const jaExiste = nome && fornecedores.some((f) => f.nome.trim().toLowerCase() === nome.toLowerCase());
    if (nome && !jaExiste) {
      try {
        const novo = await salvarFornecedor({ nome }, usuario);
        setFornecedores((l) => [...l, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch { /* corrida com outra aba cadastrando o mesmo nome — ignora */ }
    }
  }

  async function remover(p) {
    if (!(await confirmar({ mensagem: `Tirar "${p.descricao}" do catálogo? Isso não pode ser desfeito.`, confirmar: "Tirar do catálogo" }))) return;
    try {
      await excluirProduto(p.id);
      setProdutos((l) => l.filter((x) => x.id !== p.id));
    } catch (e) { setErro(mensagemDeErro(e)); }
  }

  const subgrupos = verba ? subgruposDaVerba(verba) : [];

  return (
    <div className="space-y-6">
      {erro && (
        <Alert tone="danger">
          <AlertTitle>Não foi possível concluir a ação</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
          <Button variant="ghost" size="icon" aria-label="Fechar aviso" onClick={() => setErro(null)}><X size={16} /></Button>
        </Alert>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList variant="underline" aria-label="Seções do catálogo">
            <TabsTrigger underline value="produtos">
              Produtos <Badge tone="neutral">{produtos.length}</Badge>
            </TabsTrigger>
            <TabsTrigger underline value="fornecedores">
              Fornecedores <Badge tone="neutral">{fornecedores.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          {/* A apresentação vive aqui porque é daqui que ela se alimenta:
              é o catálogo que tem foto e descrição de cada peça. */}
          <Button variant="outline" onClick={() => setApresentando(true)}>
            <Presentation size={16} /> Apresentação de especificações
          </Button>

          {podeEditar && aba === "produtos" && (
            <>
              <Button asChild variant="outline">
                <label>
                  <Upload size={16} /> Importar planilha
                  <SeletorDeArquivo accept=".xlsx,.xlsm,.pptx"
                    onChange={(e) => {
                      const f = e.target.files?.[0]; e.target.value = "";
                      if (f) setImportando(f);
                    }} />
                </label>
              </Button>
              <Button onClick={() => setEditando({ verba: verba || "05", unidade: "un" })}>
                <Plus size={16} /> Novo produto
              </Button>
            </>
          )}
        </div>
      </div>

      {aba === "fornecedores" ? (
        <Fornecedores
          lista={fornecedores} setLista={setFornecedores} usuario={usuario}
          podeEditar={podeEditar} onErro={setErro}
          usoDe={(nome) => produtos.filter((p) => p.fornecedor === nome).length} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {/* Produto e acabamento no MESMO lugar viram palheiro: 216
                amostras de MDF e tecido enterram as 74 pecas. */}
            <ToggleGroup type="single" value={tipoItem} aria-label="Tipo de item"
              onValueChange={(v) => { if (v) { setTipoItem(v); setVerba(""); setSubgrupo(""); } }}>
              {TIPOS.map((t) => (
                <ToggleGroupItem key={t.id} value={t.id} size="sm" title={t.sub}>
                  {t.nome} <span className="text-xs opacity-70">{quantos[t.id]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-64">
              <Input icon={<Search size={16} />} value={termo} onChange={(e) => setTermo(e.target.value)}
                placeholder="nome, código, fornecedor…" aria-label="Buscar no catálogo" />
              {termo && (
                <Button variant="ghost" size="icon" aria-label="Limpar busca" onClick={() => setTermo("")}>
                  <X size={16} />
                </Button>
              )}
            </div>

            {fornecedores.length > 0 && (
              <Select value={forn || TODOS} onValueChange={(v) => setForn(v === TODOS ? "" : v)}>
                <SelectTrigger className="w-full sm:w-56" aria-label="Fornecedor"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>todos os fornecedores</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <ToggleGroup type="single" value={verba || TODOS} aria-label="Grupo" className="flex flex-wrap"
            onValueChange={(v) => { if (v) { setVerba(v === TODOS ? "" : v); setSubgrupo(""); } }}>
            <ToggleGroupItem value={TODOS} size="sm">Todos</ToggleGroupItem>
            {verbas.map((v) => <ToggleGroupItem key={v.num} value={v.num} size="sm">{v.nome}</ToggleGroupItem>)}
          </ToggleGroup>

          {subgrupos.length > 0 && (
            <ToggleGroup type="single" value={subgrupo || TODOS} aria-label="Subgrupo" className="flex flex-wrap"
              onValueChange={(v) => { if (v) setSubgrupo(v === TODOS ? "" : v); }}>
              <ToggleGroupItem value={TODOS} size="sm">todos</ToggleGroupItem>
              {subgrupos.map((s) => <ToggleGroupItem key={s} value={s} size="sm">{s}</ToggleGroupItem>)}
            </ToggleGroup>
          )}

          {/* O que falta classificar vira fila de trabalho, e não um
              "Outros" onde some. */}
          {semSubgrupo > 0 && !termo && (
            <Alert tone="warning">
              <AlertDescription>
                {semSubgrupo} {semSubgrupo === 1 ? "produto ainda sem subgrupo" : "produtos ainda sem subgrupo"} —
                eles aparecem no fim de cada grupo.
              </AlertDescription>
            </Alert>
          )}

          {carregando ? <GradeSkeleton />
            : achados.length === 0 ? (
              produtos.length === 0 ? (
                <EmptyState icon={<PackageOpen size={24} />} title="Nenhum produto cadastrado ainda"
                  description="O catálogo está vazio. Cadastre um produto ou importe a planilha de padronização."
                  action={podeEditar && (
                    <Button onClick={() => setEditando({ verba: verba || "05", unidade: "un" })}>
                      <Plus size={16} /> Novo produto
                    </Button>
                  )} />
              ) : (
                <EmptyState icon={<Search size={24} />} title="Nenhum resultado para os filtros aplicados"
                  description="Nenhum produto com esse filtro."
                  action={temFiltro && <Button variant="outline" onClick={limparFiltros}>Limpar filtros</Button>} />
              )
            ) : prateleiras.map((pr) => (
              <section key={pr.verba} className="space-y-4">
                <h2 className="border-b border-line-2 pb-2 text-base font-semibold">{nomeVerba(pr.verba)}</h2>
                {pr.subgrupos.map((sg) => (
                  <div key={sg.nome || "_"} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-mute">
                      {sg.nome || <span className="normal-case italic tracking-normal">sem subgrupo</span>}
                      <Badge tone="neutral">{sg.itens.length}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {sg.itens.map((p) => (
                        <Cartao key={p.id} p={p}
                          escolhido={escolhidos.has(p.id)}
                          onEscolher={() => alternar(p.id)}
                          podeEditar={podeEditar}
                          onEditar={() => setEditando(p)}
                          onExcluir={() => remover(p)} />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}
        </>
      )}

      {editando && (
        <FormProduto p={editando} produtos={produtos} fornecedores={fornecedores} verbas={verbas}
          onFechar={() => setEditando(null)} onSalvar={salvar} onErro={setErro} />
      )}

      {apresentando && (
        <Apresentacao usuario={usuario} obras={obras} produtos={produtos}
          onFechar={() => setApresentando(false)} />
      )}

      {aba === "produtos" && (
        <BulkActionBar count={escolhidos.size} onClear={() => setEscolhidos(new Set())}>
          <Button size="sm" onClick={() => setEnviando(true)}>
            Enviar para uma obra <ArrowRight size={14} />
          </Button>
        </BulkActionBar>
      )}

      {importando && (
        <ImportarPlanilha arquivo={importando} usuario={usuario} nomeVerba={nomeVerba} produtos={produtos}
          onFechar={() => setImportando(null)}
          onPronto={(novos, msg) => {
            setProdutos((l) => [...l, ...novos]);
            setImportando(null);
            avisar.ok(msg);
          }} />
      )}

      {enviando && (
        <EnviarParaObra
          produtos={produtos.filter((p) => escolhidos.has(p.id))}
          obras={obras} usuario={usuario} nomeVerba={nomeVerba}
          onFechar={() => setEnviando(false)}
          onPronto={(msg) => { setEnviando(false); setEscolhidos(new Set()); avisar.ok(msg); }} />
      )}
    </div>
  );
}

/* Erro de banco na cara de quem só queria cadastrar um spot não ajuda.
   Os dois que de fato acontecem viram frase. */
function mensagemDeErro(e) {
  const m = String(e?.message || e || "");
  if (/relation .*catalogo.* does not exist|Could not find the table/i.test(m)) {
    return "As tabelas do catálogo ainda não existem no banco. Falta rodar supabase/catalogo.sql no Supabase.";
  }
  if (/duplicate key|unique constraint/i.test(m)) {
    return "Já existe um produto com esse código para esse fornecedor.";
  }
  return m;
}

/* Carregando com a forma da grade final: o layout não pula quando os
   produtos chegam. */
function GradeSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando o catálogo">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Cartao({ p, escolhido, onEscolher, podeEditar, onEditar, onExcluir }) {
  const url = urlDaImagem(p.imagem);
  const velho = precoVelho(p.precoEm);
  return (
    <Card variant={escolhido ? "selected" : "default"} className="flex flex-col overflow-hidden p-0">
      <Button variant="ghost" onClick={onEscolher} title="Escolher" aria-pressed={escolhido}
        className="relative block aspect-square h-auto w-full rounded-none bg-surface-2 p-0">
        {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-contain" />
          : <span className="flex h-full w-full items-center justify-center text-line-3"><ImageIcon size={22} /></span>}
        {escolhido && (
          <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md bg-brand text-bg">
            <Check size={12} />
          </span>
        )}
      </Button>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="line-clamp-3 text-sm font-semibold leading-snug" title={p.descricao}>{p.descricao}</div>
        <div className="flex flex-wrap items-center gap-2">
          {p.fornecedor && <Badge tone="brand">{p.fornecedor}</Badge>}
          {p.codigo && <span className="mono text-xs text-text-mute">{p.codigo}</span>}
        </div>
        {p.observacoes && <div className="text-xs leading-relaxed text-text-mute">{p.observacoes}</div>}
        <div className="mt-auto flex items-center gap-2 pt-2">
          {ehAcabamento(p) ? <Badge tone="neutral">acabamento</Badge>
            : p.precoRef != null
            ? <span className="flex flex-col text-sm font-semibold tabular-nums leading-tight">
                {fmt(p.precoRef)}
                {/* Preço a mão envelhece. Dizer de quando ele é custa uma
                    linha e evita orçar com número de dois anos atrás. */}
                {p.precoEm && (
                  <span className={`text-xs font-medium ${velho ? "text-alert" : "text-text-mute"}`}>
                    {velho ? `de ${mesesDesde(p.precoEm)} meses atrás` : "atualizado"}
                  </span>
                )}
              </span>
            : <span className="text-xs text-text-mute">sem preço</span>}
          {podeEditar && (
            <span className="ml-auto flex">
              <Button variant="ghost" size="icon" onClick={onEditar} aria-label="Editar" title="Editar"><Pencil size={14} /></Button>
              <Button variant="ghost" size="icon" onClick={onExcluir} aria-label="Tirar do catálogo" title="Tirar do catálogo" className="text-danger"><Trash2 size={14} /></Button>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function FormProduto({ p, produtos, fornecedores, verbas, onFechar, onSalvar, onErro }) {
  const [f, setF] = useState(() => ({
    ...p,
    precoTxt: p.precoRef != null ? String(p.precoRef / 100).replace(".", ",") : "",
  }));
  const [salvando, setSalvando] = useState(false);
  const [arquivo, setArquivo] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const id = useId();

  /* O subgrupo se sugere sozinho a partir da descrição, e continua
     editável: "SPOT SNELLO" vira Spots sem ninguém escolher, e quem
     discordar troca. */
  const sugerido = useMemo(() => subgrupoDe(f.descricao, f.verba), [f.descricao, f.verba]);
  const subEfetivo = f.subgrupo ?? sugerido ?? "";

  /* A descrição repetida se avisa AO DIGITAR, não só depois de salvar —
     é o pedido dela. Não bloqueia: o produto às vezes é mesmo o mesmo em
     dois fornecedores, e quem decide se cria mesmo assim é ela. */
  const duplicatas = useMemo(
    () => duplicatasDe(produtos, f.descricao, { excetoId: p.id }), [produtos, f.descricao, p.id]);

  async function enviar() {
    setSalvando(true);
    try {
      let imagem = f.imagem;
      if (arquivo) imagem = await subirImagem(arquivo, f.id);
      const preco = f.precoTxt.trim()
        ? centavos(Number(f.precoTxt.replace(/\./g, "").replace(",", ".")))
        : null;
      await onSalvar({
        ...f, imagem, subgrupo: subEfetivo || null, precoRef: preco,
        /* A data do preço acompanha o preço: mexeu no valor, a data é
           hoje. Sem isso o "de 8 meses atrás" mentiria pra sempre. */
        precoEm: preco != null && preco !== p.precoRef ? hoje() : (f.precoEm || null),
      });
    } catch (e) { onErro(mensagemDeErro(e)); }
    finally { setSalvando(false); }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{p.id ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>

        <DialogBody className="grid gap-4 md:grid-cols-2">
          {/* Duas descrições porque são dois leitores. A técnica precisa
              bastar pra comprar; a do criativo é o que o cliente lê na
              apresentação, e ali a ficha técnica atrapalha. Só a
              primeira é obrigatória: sem a segunda, a apresentação usa a
              primeira — feia, mas presente. */}
          <Field className="md:col-span-2">
            <Label htmlFor={`${id}-desc`} required>Descrição — Executivo</Label>
            <Textarea id={`${id}-desc`} rows={2} value={f.descricao || ""}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="SPOT EMBUTIDO POWERUS 3 LEDS BRANCO 6W 3000K" />
            <FieldHint>a técnica, que vai pro Executivo da obra e pro Sienge</FieldHint>
          </Field>

          {duplicatas.length > 0 && (
            <Alert tone="warning" className="md:col-span-2">
              <AlertTitle>Já existe {duplicatas.length === 1 ? "um produto" : `${duplicatas.length} produtos`} com essa descrição:</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {duplicatas.slice(0, 4).map((d) => (
                    <li key={d.id}>{d.fornecedor ? `${d.fornecedor} · ` : ""}{d.descricao}{d.codigo ? ` (${d.codigo})` : ""}</li>
                  ))}
                </ul>
                Salvar mesmo assim cria um segundo cadastro do mesmo item.
              </AlertDescription>
            </Alert>
          )}

          <Field className="md:col-span-2">
            <Label htmlFor={`${id}-cri`}>Descrição — Criativo</Label>
            <Input id={`${id}-cri`} value={f.descricaoCriativo || ""}
              onChange={(e) => set("descricaoCriativo", e.target.value)}
              placeholder={f.descricao ? f.descricao.slice(0, 40) : "Spot embutido branco"} />
            <FieldHint>
              a curta, que o cliente lê na apresentação.
              {!String(f.descricaoCriativo || "").trim() && " Em branco, sai a de cima."}
            </FieldHint>
          </Field>

          <Field className="md:col-span-2">
            <Label htmlFor={`${id}-en`}>Descrição — inglês</Label>
            <Input id={`${id}-en`} value={f.descricaoEn || ""}
              onChange={(e) => set("descricaoEn", e.target.value)}
              placeholder="Recessed white spotlight" />
            <FieldHint>só para apresentação emitida em inglês. Em branco, sai em português.</FieldHint>
          </Field>

          <Field>
            <Label htmlFor={`${id}-tipo`}>Tipo</Label>
            <Select value={f.tipoItem || "produto"} onValueChange={(v) => set("tipoItem", v)}>
              <SelectTrigger id={`${id}-tipo`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome.replace(/s$/, "")}</SelectItem>)}
              </SelectContent>
            </Select>
            <FieldHint>{f.tipoItem === "acabamento"
              ? "cor e material — não vai pro orçamento da obra"
              : "peça que se compra e vira linha no Executivo"}</FieldHint>
          </Field>

          <Field>
            <Label htmlFor={`${id}-verba`}>Grupo</Label>
            <Select value={f.verba || ""} onValueChange={(v) => { set("verba", v); set("subgrupo", null); }}>
              <SelectTrigger id={`${id}-verba`}><SelectValue placeholder="escolha o grupo…" /></SelectTrigger>
              <SelectContent>
                {verbas.map((v) => <SelectItem key={v.num} value={v.num}>{v.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <Label htmlFor={`${id}-sub`}>Subgrupo</Label>
            <Input id={`${id}-sub`} value={subEfetivo} list={`${id}-subs`}
              onChange={(e) => set("subgrupo", e.target.value)}
              placeholder={sugerido || "sem subgrupo"} />
            <datalist id={`${id}-subs`}>
              {subgruposDaVerba(f.verba).map((s) => <option key={s} value={s} />)}
            </datalist>
            {sugerido && f.subgrupo == null && <FieldHint>sugerido pela descrição</FieldHint>}
          </Field>

          <Field>
            <Label htmlFor={`${id}-forn`}>Fornecedor</Label>
            <Input id={`${id}-forn`} value={f.fornecedor || ""} list={`${id}-forns`}
              onChange={(e) => set("fornecedor", e.target.value)} />
            <datalist id={`${id}-forns`}>
              {fornecedores.map((x) => <option key={x.id} value={x.nome} />)}
            </datalist>
          </Field>

          <Field>
            <Label htmlFor={`${id}-cod`}>Código</Label>
            <Input id={`${id}-cod`} value={f.codigo || ""} onChange={(e) => set("codigo", e.target.value)}
              placeholder="6730" />
          </Field>

          <Field>
            <Label htmlFor={`${id}-preco`}>Preço de referência</Label>
            <Input id={`${id}-preco`} value={f.precoTxt} onChange={(e) => set("precoTxt", e.target.value)}
              placeholder="0,00" inputMode="decimal" />
            {f.precoEm && <FieldHint>anotado em {new Date(`${f.precoEm}T12:00:00`).toLocaleDateString("pt-BR")}</FieldHint>}
          </Field>

          <Field>
            <Label htmlFor={`${id}-un`}>Unidade</Label>
            <Input id={`${id}-un`} value={f.unidade || "un"} onChange={(e) => set("unidade", e.target.value)} />
          </Field>

          <Field className="md:col-span-2">
            <Label htmlFor={`${id}-obs`}>Observações</Label>
            <Input id={`${id}-obs`} value={f.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)}
              placeholder="SEMPRE USAR ESCOVADO" />
          </Field>

          <Field className="md:col-span-2">
            <Label>Foto</Label>
            <div className="flex flex-wrap items-center gap-3">
              {(arquivo || f.imagem) && (
                <div className="relative">
                  <img alt="" src={arquivo ? URL.createObjectURL(arquivo) : urlDaImagem(f.imagem)}
                    className="h-16 w-20 rounded-lg bg-surface-2 object-contain" />
                  <Button type="button" variant="danger" size="icon" aria-label="Remover foto" title="Remover foto"
                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
                    onClick={async () => { if (await confirmar("Remover a foto deste produto?")) { setArquivo(null); set("imagem", null); } }}>
                    <X size={12} />
                  </Button>
                </div>
              )}
              <Button asChild variant="outline" size="sm">
                <label>
                  <Upload size={14} /> {f.imagem || arquivo ? "Trocar foto" : "Escolher foto"}
                  <SeletorDeArquivo accept="image/*"
                    onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
                </label>
              </Button>
            </div>
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button disabled={salvando || !String(f.descricao || "").trim()} onClick={enviar}>
            {salvando ? "Salvando…" : "Salvar produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fornecedores({ lista, setLista, usuario, podeEditar, onErro, usoDe }) {
  const [novo, setNovo] = useState(null);

  async function salvar(f) {
    try {
      const salvo = await salvarFornecedor(f, usuario);
      setLista((l) => {
        const i = l.findIndex((x) => x.id === salvo.id);
        return (i >= 0 ? l.map((x) => (x.id === salvo.id ? salvo : x)) : [...l, salvo])
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      });
      setNovo(null);
    } catch (e) { onErro(mensagemDeErro(e)); }
  }

  async function remover(f) {
    const n = usoDe(f.nome);
    if (n > 0) {
      onErro(`${f.nome} está em ${n} ${n === 1 ? "produto" : "produtos"} do catálogo. Troque o fornecedor deles primeiro.`);
      return;
    }
    if (!(await confirmar({ mensagem: `Excluir o fornecedor ${f.nome}?`, confirmar: "Excluir" }))) return;
    try {
      await excluirFornecedor(f.id);
      setLista((l) => l.filter((x) => x.id !== f.id));
    } catch (e) { onErro(mensagemDeErro(e)); }
  }

  const botaoNovo = podeEditar && (
    <Button onClick={() => setNovo({})}><Plus size={16} /> Novo fornecedor</Button>
  );

  return (
    <div className="space-y-4">
      {lista.length > 0 && podeEditar && <div className="flex justify-end">{botaoNovo}</div>}
      {lista.length === 0 ? (
        <EmptyState icon={<Store size={24} />} title="Nenhum fornecedor cadastrado ainda" action={botaoNovo} />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell">No catálogo</TableHead>
                  {podeEditar && <TableHead className="w-24 text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex text-text-mute"><Store size={16} /></span>
                        <div className="flex min-w-0 flex-col">
                          <span className="text-sm font-semibold">{f.nome}</span>
                          <span className="text-xs text-text-mute">
                            {[f.contato, f.telefone, f.email].filter(Boolean).join(" · ") || "sem contato cadastrado"}
                          </span>
                          <span className="text-xs text-text-mute md:hidden">{usoDe(f.nome)} no catálogo</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-text-soft md:table-cell">{usoDe(f.nome)} no catálogo</TableCell>
                    {podeEditar && (
                      <TableCell className="text-right">
                        <span className="inline-flex">
                          <Button variant="ghost" size="icon" aria-label={`Editar ${f.nome}`} onClick={() => setNovo(f)}><Pencil size={14} /></Button>
                          <Button variant="ghost" size="icon" aria-label={`Excluir ${f.nome}`} className="text-danger" onClick={() => remover(f)}><Trash2 size={14} /></Button>
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
      {novo && <FormFornecedor f={novo} onFechar={() => setNovo(null)} onSalvar={salvar} />}
    </div>
  );
}

function FormFornecedor({ f, onFechar, onSalvar }) {
  const [x, setX] = useState(f);
  const set = (k, v) => setX((o) => ({ ...o, [k]: v }));
  const id = useId();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{f.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4 md:grid-cols-2">
          <Field className="md:col-span-2">
            <Label htmlFor={`${id}-nome`} required>Nome</Label>
            <Input id={`${id}-nome`} value={x.nome || ""} onChange={(e) => set("nome", e.target.value)}
              placeholder="Nordecor" autoFocus />
          </Field>
          <Field>
            <Label htmlFor={`${id}-contato`}>Contato</Label>
            <Input id={`${id}-contato`} value={x.contato || ""} onChange={(e) => set("contato", e.target.value)}
              placeholder="quem atende a gente" />
          </Field>
          <Field>
            <Label htmlFor={`${id}-tel`}>Telefone</Label>
            <Input id={`${id}-tel`} value={x.telefone || ""} onChange={(e) => set("telefone", e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor={`${id}-email`}>E-mail</Label>
            <Input id={`${id}-email`} value={x.email || ""} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor={`${id}-site`}>Site</Label>
            <Input id={`${id}-site`} value={x.site || ""} onChange={(e) => set("site", e.target.value)} />
          </Field>
          <Field className="md:col-span-2">
            <Label htmlFor={`${id}-obs`}>Observações</Label>
            <Input id={`${id}-obs`} value={x.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)}
              placeholder="prazo de entrega, condição de pagamento…" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!String(x.nome || "").trim()} onClick={() => onSalvar(x)}>Salvar fornecedor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* O ponto do módulo: o produto escolhido vira linha na planilha da obra,
   já na verba certa — porque o grupo do catálogo É a verba.
 *
 * Escreve no Executivo, e não no Vendido: o vendido é o que foi vendido
 * ao cliente e não se reescreve depois; o executivo é onde a equipe
 * especifica. */
function EnviarParaObra({ produtos, obras, usuario, nomeVerba, onFechar, onPronto }) {
  const [obra, setObra] = useState("");
  const [qtds, setQtds] = useState(() => new Map(produtos.map((p) => [p.id, 1])));
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState(null);
  const id = useId();

  const porVerba = useMemo(() => {
    const m = new Map();
    produtos.forEach((p) => m.set(p.verba, [...(m.get(p.verba) || []), p]));
    return [...m.entries()];
  }, [produtos]);

  async function enviar() {
    setIndo(true); setErro(null);
    try {
      const dados = await carregarDadosObra(obra);
      if (!dados) throw new Error("Esta obra ainda não tem planilha carregada. Suba o Executivo dela primeiro.");
      /* A trava de edição existe pra impedir dois navegadores gravando
         em cima um do outro. Ela vale aqui também: escrever no orçamento
         de uma obra que outra pessoa está editando apagaria o trabalho
         dela sem aviso. */
      const outro = dados.editandoPor && dados.editandoPor !== usuario;
      if (outro) throw new Error(`${dados.editandoPor} está editando esta obra agora. Espere ela sair pra não gravar por cima.`);

      const categorias = (dados.categorias || []).map((c) => ({ ...c }));
      let novos = 0;
      porVerba.forEach(([verba, ps]) => {
        const cat = categorias.find((c) => c.num === verba);
        if (!cat) return;
        const itens = [...(cat.itensPlanilhaExecutivo || [])];
        ps.forEach((p) => { itens.push(produtoParaItem(p, qtds.get(p.id) || 1)); novos++; });
        cat.itensPlanilhaExecutivo = itens;
      });
      if (!novos) throw new Error("Nenhuma verba correspondente foi encontrada na planilha desta obra.");

      await salvarDadosObra(obra, { ...dados, categorias }, usuario);
      const o = obras.find((x) => String(x.codigo) === String(obra));
      onPronto(`${novos} ${novos === 1 ? "produto foi" : "produtos foram"} para o Executivo de ${o?.nome || obra}.`);
    } catch (e) { setErro(mensagemDeErro(e)); }
    finally { setIndo(false); }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Enviar {produtos.length} {produtos.length === 1 ? "produto" : "produtos"} para a obra</DialogTitle>
          <DialogDescription>
            As linhas entram no <b>Executivo</b> da obra, cada uma na sua verba. O Vendido
            não é tocado — ele é o que foi vendido ao cliente.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {erro && (
            <Alert tone="danger">
              <AlertTitle>Não foi possível enviar para a obra</AlertTitle>
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          <Field>
            <Label htmlFor={`${id}-obra`} required>Obra</Label>
            <Select value={obra} onValueChange={setObra}>
              <SelectTrigger id={`${id}-obra`} autoFocus><SelectValue placeholder="escolha a obra…" /></SelectTrigger>
              <SelectContent>
                {obras.map((o) => (
                  <SelectItem key={o.codigo} value={String(o.codigo)}>#{o.codigo} {o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="max-h-64 overflow-auto rounded-lg border border-line-2">
            {porVerba.map(([verba, ps]) => (
              <div key={verba}>
                <div className="bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-mute">{nomeVerba(verba)}</div>
                {ps.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 border-t border-line-1 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{p.descricao}</span>
                    <Input type="number" min="1" step="1" className="w-20 text-right" aria-label={`Quantidade de ${p.descricao}`}
                      value={qtds.get(p.id) || 1}
                      onChange={(e) => setQtds((m) => new Map(m).set(p.id, Number(e.target.value) || 1))} />
                    <span className="w-8 text-xs text-text-mute">{p.unidade || "un"}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!obra || indo} onClick={enviar}>
            {indo ? "Enviando…" : "Enviar para o Executivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Importar a planilha de padronização.
 *
 * Lê tudo no navegador — inclusive as 36 fotos, que não estão em célula
 * nenhuma e sim ancoradas às linhas dentro do .xlsx. Com o login de quem
 * importa: não existe script com chave de banco em lugar nenhum.
 *
 * Mostra o que vai entrar ANTES de gravar. Importação é gravação em
 * massa, e desfazer 56 linhas uma a uma é o tipo de trabalho que ninguém
 * faz — então a hora de descobrir um grupo órfão é agora.
 */
function ImportarPlanilha({ arquivo, usuario, nomeVerba, produtos, onFechar, onPronto }) {
  const [lendo, setLendo] = useState(true);
  const [itens, setItens] = useState([]);
  const [midia, setMidia] = useState({});
  const [erro, setErro] = useState(null);
  const [gravando, setGravando] = useState(null);   // {feitos, de}
  const [dePptx, setDePptx] = useState(false);
  const id = useId();
  /* Muita amostra vem sem fornecedor no arquivo (o título do slide nem
     sempre nomeia a casa). Um campo só, aplicado a todas, poupa 123
     edições à mão. */
  const [fornPadrao, setFornPadrao] = useState("");
  /* A regra: por padrão, o que já está cadastrado NÃO entra de novo.
     Ela decide se quer o contrário — importar mesmo repetido, pra casos
     em que a descrição é igual por coincidência mas o item não é. */
  const [pularRepetidos, setPularRepetidos] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const ehPptx = /\.pptx$/i.test(arquivo.name);
        const buf = await arquivo.arrayBuffer();
        const lidos = ehPptx ? await doPptx(buf) : await doXlsx(buf);
        if (!vivo) return;
        setItens(lidos.itens);
        setMidia(lidos.midia);
        setDePptx(ehPptx);
      } catch (e) {
        if (vivo) setErro(`Não consegui ler o arquivo: ${e.message || e}`);
      } finally { if (vivo) setLendo(false); }
    })();
    return () => { vivo = false; };
  }, [arquivo]);

  /* A planilha de padronização: uma linha por produto, e as fotos
     ancoradas às linhas dentro do próprio .xlsx. */
  async function doXlsx(buf) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array", bookFiles: true });
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],
      { header: 1, raw: false, defval: "" });
    const txt = (k) => {
      const f = wb.files?.[k];
      if (!f) return null;
      const c = f.content ?? f._data;
      if (typeof c === "string") return c;
      return new TextDecoder().decode(c instanceof Uint8Array ? c : new Uint8Array(c));
    };
    const anc = ancorasDeImagem(txt("xl/drawings/drawing1.xml"),
      txt("xl/drawings/_rels/drawing1.xml.rels"));
    const apelidos = eapAtual()?.apelidos || {};
    return { itens: juntar(lerProdutos(linhas, apelidos), anc), midia: wb.files || {} };
  }

  /* A biblioteca de materiais em .pptx: nela a informação está na
     GEOMETRIA — foto em cima, legenda logo abaixo — e o nome da família
     está no rodapé do slide. */
  async function doPptx(buf) {
    const { unzipSync } = await import("fflate");
    const zip = unzipSync(new Uint8Array(buf));
    const dec = new TextDecoder();
    const nomes = Object.keys(zip)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    const slides = nomes.map((n) => ({
      xml: dec.decode(zip[n]),
      rels: zip[`ppt/slides/_rels/${n.split("/").pop()}.rels`]
        ? dec.decode(zip[`ppt/slides/_rels/${n.split("/").pop()}.rels`]) : "",
    }));
    /* O mesmo formato de `midia` do xlsx, pra gravação não precisar saber
       de onde o arquivo veio. */
    const midia = {};
    Object.keys(zip).forEach((n) => { if (n.startsWith("ppt/media/")) midia[n] = { content: zip[n] }; });
    return { itens: lerPptx(slides), midia };
  }

  const r = useMemo(() => (dePptx ? resumoPptx(itens) : resumoDaImportacao(itens)), [itens, dePptx]);

  /* Quem, do que está sendo importado, já existe no catálogo — ou se
     repete DENTRO do próprio arquivo (a mesma planilha às vezes traz o
     mesmo item duas vezes). Uma passagem só, contra o catálogo de
     verdade e contra o que já foi visto neste lote. */
  const { unicos, repetidos } = useMemo(() => {
    const vistos = new Set();
    const unicos = [], repetidos = [];
    itens.forEach((it) => {
      const chave = normalizarDescricao(it.descricao);
      const jaNoCatalogo = duplicatasDe(produtos, it.descricao).length > 0;
      const jaNesteLote = chave && vistos.has(chave);
      (jaNoCatalogo || jaNesteLote ? repetidos : unicos).push(it);
      if (chave) vistos.add(chave);
    });
    return { unicos, repetidos };
  }, [itens, produtos]);

  async function gravar() {
    const fonte = pularRepetidos ? unicos : itens;
    const bons = fonte.filter((p) => p.verba);
    setGravando({ feitos: 0, de: bons.length });
    const salvos = [];
    const falhas = [];
    for (const p of bons) {
      try {
        let imagem = null;
        if (p.arquivoImagem && midia[p.arquivoImagem]) {
          const c = midia[p.arquivoImagem].content ?? midia[p.arquivoImagem]._data;
          const bytes = typeof c === "string"
            ? Uint8Array.from(c, (ch) => ch.charCodeAt(0) & 0xff)
            : (c instanceof Uint8Array ? c : new Uint8Array(c));
          const ext = p.arquivoImagem.split(".").pop();
          const file = new File([bytes], `foto.${ext}`, { type: `image/${ext === "jpg" ? "jpeg" : ext}` });
          /* Foto que não sobe não derruba o produto: o produto sem foto
             ainda serve, e a foto pode ser posta depois. */
          try { imagem = await subirImagem(file, "import"); } catch { imagem = null; }
        }
        const salvo = await salvarProduto({
          verba: p.verba, subgrupo: p.subgrupo, descricao: p.descricao,
          descricaoCriativo: p.descricaoCriativo || null,
          tipoItem: p.tipoItem || "produto",
          codigo: p.codigo, observacoes: p.observacoes,
          fornecedor: p.fornecedor || fornPadrao.trim() || null,
          precoRef: p.precoRef ?? null, precoEm: p.precoRef != null ? hoje() : null,
          imagem, unidade: "un",
        }, usuario);
        salvos.push(salvo);
      } catch (e) {
        /* Um item com problema (ex.: código repetido pra esse fornecedor)
           não pode travar o lote inteiro — ela vê o que ficou de fora no
           final e decide o que fazer, o resto entra normalmente. */
        falhas.push({ descricao: p.descricao, codigo: p.codigo, erro: mensagemDeErro(e) });
      }
      setGravando({ feitos: salvos.length + falhas.length, de: bons.length });
    }

    /* Os fornecedores da planilha entram no cadastro junto: sem isso o
       nome existiria dentro do produto e não haveria onde guardar o
       contato de quem vende. */
    for (const nome of r.fornecedores) {
      try { await salvarFornecedor({ nome }, usuario); } catch { /* já existe */ }
    }

    let msg = `${salvos.length} produtos entraram no catálogo.`;
    if (falhas.length) {
      const rotulo = (f) => f.codigo || f.descricao;
      const lista = falhas.slice(0, 8).map(rotulo).join(", ");
      const resto = falhas.length > 8 ? ` e mais ${falhas.length - 8}` : "";
      msg += ` ${falhas.length} ${falhas.length === 1 ? "ficou de fora" : "ficaram de fora"} (${falhas[0].erro}): ${lista}${resto}.`;
    }
    onPronto(salvos, msg);
  }

  const quantosEntram = (pularRepetidos ? unicos : itens).filter((p) => p.verba).length;

  return (
    /* O modal legado não fechava por clique fora — e durante a gravação
       em massa fechar no meio deixaria metade do lote sem aviso. */
    <Dialog open onOpenChange={(open) => { if (!open && !gravando) onFechar(); }}>
      <DialogContent size="lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Importar planilha de padronização</DialogTitle>
          <DialogDescription>
            As fotos vêm de dentro do arquivo — elas não estão em célula nenhuma, estão
            ancoradas às linhas. Nada é sobrescrito: produtos repetidos com o mesmo código e
            fornecedor são recusados pelo banco.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {erro && (
            <Alert tone="danger">
              <AlertTitle>Não foi possível ler a planilha</AlertTitle>
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {lendo ? (
            <div className="space-y-4" aria-busy="true" aria-label="Lendo a planilha">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiMini label="itens entram" value={String(r.validos)} />
                {dePptx && <KpiMini label="produtos" value={String(r.produtos)} />}
                {dePptx && <KpiMini label="acabamentos" value={String(r.acabamentos)} />}
                <KpiMini label="com foto" value={String(r.comFoto)} />
                {!dePptx && <KpiMini label="com preço" value={String(r.comPreco)} />}
                <KpiMini label="fornecedores" value={String(r.fornecedores.length)} />
                {r.semSubgrupo > 0 && <KpiMini label="sem subgrupo" value={String(r.semSubgrupo)} tone="warning" />}
              </div>

              {/* Amostra costuma vir sem fornecedor: o título do slide nem
                  sempre nomeia a casa. Um campo só evita 100 edições. */}
              {r.semFornecedor > 0 && (
                <Field>
                  <Label htmlFor={`${id}-forn`}>
                    {r.semFornecedor} {r.semFornecedor === 1 ? "item veio" : "itens vieram"} sem fornecedor — usar
                  </Label>
                  <Input id={`${id}-forn`} value={fornPadrao} onChange={(e) => setFornPadrao(e.target.value)}
                    placeholder="ex: Bess Tecidos" />
                  <FieldHint>em branco, entram sem fornecedor e você preenche depois</FieldHint>
                </Field>
              )}

              {r.gruposSemVerba.length > 0 && (
                <Alert tone="warning">
                  <AlertTitle>{r.total - r.validos} produtos ficam de fora.</AlertTitle>
                  <AlertDescription>
                    Estes grupos não casaram com nenhuma verba da EAP: {r.gruposSemVerba.join(", ")}. Renomeie
                    o título do grupo na planilha para o nome da verba e importe de novo.
                  </AlertDescription>
                </Alert>
              )}

              {/* A regra dela: descrição repetida se avisa, e ela decide.
                  Repetido aqui é ou já estar no catálogo, ou aparecer
                  duas vezes dentro do próprio arquivo. */}
              {repetidos.length > 0 && (
                <Alert tone="warning">
                  <AlertTitle>{repetidos.length} {repetidos.length === 1 ? "já está" : "já estão"} no catálogo (ou repetido no próprio arquivo).</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {repetidos.slice(0, 5).map((it, i) => <li key={i}>{it.descricao}</li>)}
                      {repetidos.length > 5 && <li>e mais {repetidos.length - 5}…</li>}
                    </ul>
                    <div className="mt-2 flex items-center gap-2">
                      <Checkbox id={`${id}-rep`} checked={!pularRepetidos}
                        onCheckedChange={(v) => setPularRepetidos(!(v === true))} />
                      <Label htmlFor={`${id}-rep`}>Importar mesmo assim (cria um segundo cadastro de cada um)</Label>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-64 overflow-auto rounded-lg border border-line-2">
                {r.porGrupo.map(([g, n], i) => (
                  <div key={g} className={`flex items-center gap-3 px-3 py-2 text-sm ${i > 0 ? "border-t border-line-1" : ""}`}>
                    <span className="min-w-0 flex-1 truncate">{g}</span>
                    <span className="text-xs text-text-mute">{n}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={!!gravando}>Cancelar</Button>
          <Button disabled={lendo || !quantosEntram || !!gravando} onClick={gravar}>
            {gravando ? `Gravando ${gravando.feitos} de ${gravando.de}…` : `Importar ${quantosEntram} produtos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
