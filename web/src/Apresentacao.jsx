import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Alert, AlertDescription, AlertTitle, Badge, Button, EmptyState, Field, Input, Label, PageShell,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Tabs, TabsList, TabsTrigger, Textarea, Toggle, ToggleGroup, ToggleGroupItem,
} from "@group-ws/ws-ui";
import { BotaoIcone } from "./lib/ui.jsx";
import { confirmar } from "./lib/confirmar.jsx";
import {
  X, Plus, Trash2, Upload, Save, FileDown, Image as ImageIcon,
  AlertTriangle, Search, GripVertical, History, FileCheck,
  Minus, Maximize2, List, Presentation, LayoutTemplate, RotateCcw, RefreshCw,
} from "lucide-react";
import {
  novaApresentacao, novoSlide, acrescentar, dentro, renderDentro,
  conferir, nomeDoArquivo, quantasCabem, alturaDoBloco, proximaRev, duplicarComoRev,
  CAMPOS_CAPA, quebrar, caixaDoCampo, caixaDentro, ANO_NA_ARTE, COR_VALOR, COR_TITULO,
  LARGURA, ALTURA, RODAPE, BLOCO,
  blocosImagem, blocosLista, listaDoSlide, listaDentro, LISTA_ITEM, alternarModoBloco,
  listarApresentacoes, carregarApresentacao, criarApresentacao, salvarApresentacao, marcarGerada,
  subirAmbiente, criarLeitorDeImagens,
} from "./lib/apresentacao";
import { useImagensDaObra } from "./lib/imagensDaObra";
import { criarFilaDeGravacao } from "./lib/filaDeGravacao";
import { SituacaoDaGravacao } from "./lib/gravacaoUi.jsx";
import { avisoDoDocumento, nomeDaApresentacao } from "./lib/documentosDaObra";
import { IDIOMAS, TEXTOS, ambienteEm, textoDoBloco, faltamEmIngles } from "./lib/apresentacaoIdioma";
import { gerarPdf } from "./lib/apresentacaoPdf";
import { gerarPptx } from "./lib/apresentacaoPptx";
import { urlDaImagem as urlProduto, filtrarProdutos } from "./lib/catalogo";
import { subirArquivo } from "./lib/arquivos";
import { alterarObra, garantirObraDados } from "./lib/dadosObra";
/* As três páginas fixas do documento: a abertura da marca, a folha de
   dados do projeto e o fechamento. Vieram do PPTX dela, não de
   reconstituição — reconstituir marca é errar de leve e ninguém saber
   dizer onde. */
import arteAbertura from "./assets/capa-abertura.png";
import arteDados from "./assets/capa-dados.png";
import arteFechamento from "./assets/capa-fechamento.png";
/* Só a ARTE do slide (palco, blocos, caixas da capa) tem CSS próprio: é o
   papel que vai pro cliente, com as cores dele. O entorno é todo DS. */
import "./Apresentacao.css";

/**
 * O EDITOR DA APRESENTAÇÃO.
 *
 * A tela é o slide: o que se arrasta aqui é exatamente o que sai no PDF,
 * na mesma proporção. Prévia separada do editor seria duas verdades sobre
 * a mesma página, e a segunda sempre atrasada.
 *
 * O que o programa faz sozinho: preencher a capa com o que a obra já
 * sabe, distribuir os blocos em vagas livres sem encostar no render, e
 * escrever o PDF. O que ele não faz: decidir a composição. Isso é olho, e
 * por isso tudo se move e se redimensiona.
 */

/* Junta classes sem arrastar utilitário de fora — o único helper local. */
const cls = (...a) => a.filter(Boolean).join(" ");

const fmtData = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null);

export default function Apresentacao({ usuario, obras, produtos, onFechar, obraInicial = "" }) {
  const [doc, setDoc] = useState(null);
  // aberta de dentro de uma obra, já chega com ela escolhida
  const [obraCod, setObraCod] = useState(String(obraInicial || ""));
  const [idioma, setIdioma] = useState("pt");
  /* A página aberta. As três fixas da casa (abertura, dados, fechamento)
     entram na navegação junto com os ambientes: elas fazem parte do
     documento, e não vê-las no editor foi exatamente o que ela apontou —
     editava-se a capa às cegas. */
  const [pagina, setPagina] = useState("dados");   // "abertura" | "dados" | nº | "fechamento"
  const atual = typeof pagina === "number" ? pagina : 0;
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(null);
  const [gerandoPptx, setGerandoPptx] = useState(null);
  const [abaLateral, setAbaLateral] = useState("produtos");   // produtos | capa | revisoes
  const [revisoes, setRevisoes] = useState([]);
  /* `null` = ajustar à largura. Qualquer número é o zoom escolhido à mão,
     como no PowerPoint: a tela inteira nem sempre é o que se quer ver, e
     num monitor grande o slide fica maior que o olho alcança. */
  const [zoom, setZoom] = useState(null);

  const obra = useMemo(
    () => obras.find((o) => String(o.codigo) === String(obraCod)) || null, [obras, obraCod]);

  /* Escolher a obra CARREGA o que já existe dela. Começar do zero por
     cima de um trabalho da semana passada seria o pior desfecho possível
     — e silencioso. */
  useEffect(() => {
    if (!obraCod) { setDoc(null); return undefined; }
    primeiraCargaRef.current = true;
    let vivo = true;
    (async () => {
      try {
        const l = await listarApresentacoes(obraCod);
        if (!vivo) return;
        setRevisoes(l);
        /* A lista não traz capa e slides: o documento vem por id, agora, do
           banco. É o que garante que se começa a editar a partir do que
           existe — e não de uma cópia que a lista trouxe. */
        const carregado = l.length
          ? await carregarApresentacao(obraCod, l[0].id)
          : { ...novaApresentacao(obra), slides: [novoSlide("")] };
        if (!vivo) return;
        versaoRef.current = carregado.versao ?? null;
        setDoc(carregado);
        setPagina("dados");

        /* Vincular a obra aqui, e não só na hora de gerar o PDF: uma obra
           cadastrada na mão nunca passou pelo upload que cria essa linha,
           e descobrir isso no meio da geração é tarde demais. */
        await garantirObraDados(obraCod);
      } catch (e) { if (vivo) setErro(mensagem(e)); }
    })();
    return () => { vivo = false; };
  }, [obraCod]);   // `obra` sai de `obraCod`; incluí-la relançaria à toa

  const ehSlide = typeof pagina === "number";
  const slide = ehSlide ? (doc?.slides?.[pagina] || null) : null;
  const conf = useMemo(() => conferir(doc), [doc]);
  const semIngles = useMemo(() => faltamEmIngles(doc), [doc]);

  const mudarSlide = useCallback((f) => {
    setDoc((d) => {
      const s = [...d.slides];
      s[atual] = f(s[atual]);
      return { ...d, slides: s };
    });
  }, [atual]);

  /* A GRAVAÇÃO
   *
   * Uma por vez, sempre com o estado mais recente da tela e com a VERSÃO
   * que ela leu — é o banco que confere (supabase/salvar-aditivo-apresentacao.sql).
   * Antes, a edição feita durante uma gravação em andamento era descartada
   * por uma trava de "gravação em cima de gravação", sem reagendar nada: a
   * tela dizia "Salvo." e aquele ajuste não estava no banco. A fila é a
   * mesma da obra — ela guarda a alteração e grava logo depois, tenta de
   * novo sozinha quando falha, e para quando o banco recusa.
   */
  const primeiraCargaRef = useRef(true);
  const [gravacao, setGravacao] = useState({ estado: "salvo", em: null });
  const docRef = useRef(null);
  const idiomaRef = useRef(idioma);
  const versaoRef = useRef(null);
  useLayoutEffect(() => { docRef.current = doc; idiomaRef.current = idioma; });

  const fila = useMemo(() => criarFilaDeGravacao({
    gravar: async () => {
      const atual = docRef.current;
      if (!atual || !obraCod) return;
      const comIdioma = { ...atual, idioma: idiomaRef.current };
      /* Ainda não existe no banco (obra que nunca teve apresentação): a
         primeira gravação é que a cria, e o id volta para as próximas. */
      if (!atual.id) {
        const nova = await criarApresentacao(obraCod, atual.capa?.rev || atual.rev || "00", comIdioma);
        versaoRef.current = nova.versao;
        setDoc((d) => (d ? { ...d, id: nova.id, rev: nova.rev } : d));
      } else {
        const r = await salvarApresentacao(obraCod, atual.id, versaoRef.current, comIdioma);
        versaoRef.current = r.versao;
      }
      listarApresentacoes(obraCod).then(setRevisoes).catch(() => { /* a lista lateral não é o trabalho */ });
    },
    aoMudar: setGravacao,
  }), [obraCod]);

  // A versão é a do documento que acabou de ser carregado, e o que a tela
  // já tinha na fila deixa de valer: é outro documento.
  const usarDocumento = useCallback((novo) => {
    fila.descartar();
    primeiraCargaRef.current = true;
    versaoRef.current = novo?.versao ?? null;
    docRef.current = novo;
    setDoc(novo);
  }, [fila]);

  /* O gatilho é o CONTEÚDO (capa, slides e idioma), não o objeto `doc`
     inteiro — gravar atualiza `doc.id` no próprio `doc`, e se o efeito
     olhasse pra `doc` de novo isso religaria a fila sozinho, para sempre,
     mesmo sem mais nenhuma edição real. */
  const assinaturaConteudo = doc ? JSON.stringify({ capa: doc.capa, slides: doc.slides, idioma }) : null;
  useEffect(() => {
    if (!doc || !obraCod) return;
    if (primeiraCargaRef.current) { primeiraCargaRef.current = false; return; }
    fila.alterou();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinaturaConteudo]);

  /* Fechar a aba com trabalho por gravar pergunta antes; esconder a aba
     (trocar de janela, bloquear a tela) manda gravar já. */
  useEffect(() => {
    const aoSair = (e) => {
      if (!fila.temPendencia()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const aoEsconder = () => { if (document.visibilityState === "hidden") fila.gravarAgora(); };
    window.addEventListener("beforeunload", aoSair);
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      window.removeEventListener("beforeunload", aoSair);
      document.removeEventListener("visibilitychange", aoEsconder);
    };
  }, [fila]);

  /* As imagens dos ambientes moram no balde privado da obra: cada endereço
     é assinado pela API e vale uma hora. O gancho pede os da tela de uma vez
     e renova antes de vencer; o leitor é o que o gerador do PDF e do PPTX
     usa para buscar os bytes. */
  const caminhosDasImagens = useMemo(
    () => (doc?.slides || []).flatMap((sl) => (sl?.render?.imagem ? [sl.render.imagem] : [])),
    [doc]);
  const imagens = useImagensDaObra(obraCod, caminhosDasImagens);
  const leitorDeImagens = useMemo(() => criarLeitorDeImagens(obraCod), [obraCod]);

  /** Grava o que falta e devolve o documento gravado (para gerar o PDF). */
  async function garantirGravado() {
    await fila.descarregar();
    const atual = docRef.current;
    if (!atual?.id) throw new Error("A apresentação ainda não foi gravada. Tente de novo em instantes.");
    return atual;
  }

  async function salvar() {
    setErro(null);
    try {
      await fila.gravarAgora();
      setAviso("Salvo."); setTimeout(() => setAviso(null), 2500);
    } catch (e) { setErro(mensagem(e)); }
  }

  /* Trazer do banco o que está lá, descartando o que esta tela tem por
     gravar. Só com confirmação: o que se perde aqui não volta. */
  async function recarregar() {
    const atual = docRef.current;
    if (!atual?.id) return;
    const ok = await confirmar({
      titulo: "Recarregar a apresentação?",
      mensagem: "O que você alterou desde a última gravação será descartado, e a tela passa a mostrar o que está no banco.",
      confirmar: "Recarregar e descartar",
      cancelar: "Continuar vendo",
      perigo: true,
    });
    if (!ok) return;
    try {
      usarDocumento(await carregarApresentacao(obraCod, atual.id));
      setRevisoes(await listarApresentacoes(obraCod));
      setErro(null);
    } catch (e) { setErro(mensagem(e)); }
  }

  async function fechar() {
    if (fila.temPendencia()) {
      try {
        await fila.descarregar();
      } catch {
        const ok = await confirmar({
          titulo: "Sair sem gravar?",
          mensagem: "As últimas alterações desta apresentação não foram gravadas. Saindo agora, elas se perdem.",
          confirmar: "Sair mesmo assim",
          cancelar: "Continuar aqui",
          perigo: true,
        });
        if (!ok) return;
      }
    }
    onFechar();
  }

  async function gerar() {
    setGerando("Montando o PDF…"); setErro(null);
    try {
      /* Grava ANTES de gerar: se a geração falhar no meio, o trabalho
         continua no banco. E se a gravação não passar — outra pessoa alterou
         a revisão —, nem começa: o PDF sairia de uma versão que o banco
         recusou. */
      const salvo = await garantirGravado();

      const baixar = async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer());
      const artes = {
        abertura: await baixar(arteAbertura),
        dados: await baixar(arteDados),
        fechamento: await baixar(arteFechamento),
      };
      const bytes = await gerarPdf(doc, artes, leitorDeImagens, idioma);

      setGerando("Guardando em Arquivos da obra…");
      const nome = nomeDoArquivo({ ...doc, obraCodigo: obraCod }, idioma);
      const file = new File([bytes], nome, { type: "application/pdf" });
      const info = await subirArquivo({
        obraCodigo: obraCod, chave: "apresentacao", file, por: usuario,
      });

      /* Subir pro depósito NÃO é o mesmo que aparecer em Arquivos da
         obra: a tela lê a lista guardada na obra, e um arquivo que só
         existe no depósito é um arquivo que ninguém acha. */
      const r = await guardarEmArquivosDaObra(obraCod, usuario, {
        ...info,
        id: `arq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        titulo: nome,
        fase: "cliente",
      }, "O PDF foi gerado e baixado");
      if (!r) throw new Error("O PDF foi gerado, mas esta obra ainda não tem dados salvos — ele não pôde ser guardado em Arquivos da obra.");
      versaoRef.current = (await marcarGerada(obraCod, salvo.id, versaoRef.current, info.caminho)).versao;

      /* Baixa também: quem acabou de montar quer ver agora, não ir
         procurar em outra tela. */
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = nome; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      setAviso(`${nome} gerado e guardado em Arquivos da obra.`);
    } catch (e) { setErro(mensagem(e)); }
    finally { setGerando(null); }
  }

  /* O .pptx EDITÁVEL. Ela pediu especificamente pra poder abrir no
     PowerPoint e mexer depois — texto e imagem soltos, arrastáveis, não
     o PDF fechado. Ele TAMBÉM vai pra Arquivos da obra, mas como
     "outros": não é o documento que saiu pro cliente, é uma cópia de
     trabalho, e por isso não marca a apresentação como "já gerada" —
     mexer nela depois de baixar o pptx continua sendo a MESMA revisão. */
  async function gerarPowerPoint() {
    setGerandoPptx("Montando o PowerPoint…"); setErro(null);
    try {
      await garantirGravado();

      const baixar = async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer());
      const artes = {
        abertura: await baixar(arteAbertura),
        dados: await baixar(arteDados),
        fechamento: await baixar(arteFechamento),
      };
      const bytes = await gerarPptx(doc, artes, leitorDeImagens, idioma);

      setGerandoPptx("Guardando em Arquivos da obra…");
      const nome = nomeDoArquivo({ ...doc, obraCodigo: obraCod }, idioma, "pptx");
      const file = new File([bytes], nome, {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const info = await subirArquivo({ obraCodigo: obraCod, chave: "apresentacao", file, por: usuario });

      const dados = await guardarEmArquivosDaObra(obraCod, usuario, {
        ...info,
        id: `arq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        titulo: nome,
        /* "outros", não "cliente": esta cópia não saiu pra aprovação
           de ninguém, é material de edição. */
        fase: "outros",
      }, "O PowerPoint foi gerado e baixado");

      const url = URL.createObjectURL(new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }));
      const a = document.createElement("a");
      a.href = url; a.download = nome; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      setAviso(dados
        ? `${nome} gerado e guardado em Arquivos da obra.`
        : `${nome} gerado e baixado. Esta obra ainda não tem dados salvos, então não deu pra guardar em Arquivos da obra.`);
    } catch (e) { setErro(mensagem(e)); }
    finally { setGerandoPptx(null); }
  }

  /* A REVISÃO NOVA NASCE COMO CÓPIA e não apaga a anterior: a 00 já foi
     ao cliente, e alguém vai querer conferir o que mudou. */
  async function novaRevisao() {
    const rev = proximaRev(revisoes.map((r) => r.rev));
    const ok = await confirmar({
      titulo: `Criar a revisão ${rev}?`,
      mensagem: `Ela nasce como cópia da ${doc.capa?.rev || "atual"}. A anterior continua guardada.`,
      confirmar: "Criar revisão",
      perigo: false,
    });
    if (!ok) return;
    setSalvando(true); setErro(null);
    try {
      const anterior = doc.capa?.rev;
      await garantirGravado();   // fecha a atual antes de copiá-la
      const criada = await criarApresentacao(obraCod, rev, duplicarComoRev({ ...doc, obraCodigo: obraCod }, rev));
      usarDocumento(await carregarApresentacao(obraCod, criada.id));
      setRevisoes(await listarApresentacoes(obraCod));
      setPagina("dados");
      setAviso(`Revisão ${rev} criada. A ${anterior} continua guardada.`);
    } catch (e) { setErro(mensagem(e)); }
    finally { setSalvando(false); }
  }

  const avisoDaFila = avisoDoDocumento(gravacao, { documento: nomeDaApresentacao(doc) });

  const acoes = (
    <div className="flex flex-wrap items-center gap-2">
      <SituacaoDaGravacao situacao={gravacao} onTentarAgora={() => fila.tentarAgora()} />
      <Button variant="outline" size="sm" disabled={!doc || salvando} onClick={salvar}>
        <Save size={16} /> Salvar agora
      </Button>
      <Button variant="outline" size="sm" disabled={!conf.pronto || !!gerandoPptx} onClick={gerarPowerPoint}
        title={conf.pronto ? "Baixa um .pptx editável — texto e imagem soltos, pra mexer no PowerPoint"
          : "Todo ambiente precisa de nome e de imagem"}>
        <FileDown size={16} /> {gerandoPptx || "Baixar .pptx"}
      </Button>
      <Button size="sm" disabled={!conf.pronto || !!gerando} onClick={gerar}
        title={conf.pronto ? "" : "Todo ambiente precisa de nome e de imagem"}>
        <FileDown size={16} /> {gerando || "Gerar PDF"}
      </Button>
      <BotaoIcone rotulo="Fechar apresentação" variant="ghost" onClick={fechar}>
        <X size={16} />
      </BotaoIcone>
    </div>
  );

  const barra = (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Label htmlFor="ap-obra">Obra</Label>
        <Select value={obraCod} onValueChange={setObraCod}>
          <SelectTrigger id="ap-obra" className="w-full sm:w-80"><SelectValue placeholder="Escolha a obra…" /></SelectTrigger>
          <SelectContent>
            {obras.map((o) => <SelectItem key={o.codigo} value={String(o.codigo)}>#{o.codigo} {o.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* A equipe escreve em português; a bandeira decide como SAI. */}
      <ToggleGroup type="single" value={idioma} onValueChange={(v) => { if (v) setIdioma(v); }}
        aria-label="Idioma em que a apresentação sai">
        {IDIOMAS.map((i) => (
          <ToggleGroupItem key={i.id} value={i.id} size="sm" title={`Ver e emitir em ${i.nome}`}>
            <span aria-hidden="true">{i.bandeira}</span> {i.id.toUpperCase()}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );

  /* O editor cobre a tela inteira, por cima da obra que o abriu. O padding
     do invólucro é o que o PageShell cancela com as margens negativas
     dele — sem esse par, a barra ficaria fora da janela. */
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg px-4 py-6 md:px-8 md:py-8">
      <PageShell title="Apresentação de especificações"
        description="A tela é o slide: o que se arruma aqui é o que sai no PDF."
        actions={acoes} toolbar={barra} contentPadding={false}
        contentClassName="flex min-h-0 flex-1 flex-col overflow-auto lg:overflow-hidden">

        {(erro || aviso || avisoDaFila) && (
          <div className="flex flex-col gap-2 px-4 pt-4 md:px-6">
            {erro && <Alert tone="danger" role="alert"><AlertDescription>{erro}</AlertDescription></Alert>}
            {avisoDaFila && (
              <Alert tone={avisoDaFila.tom} role="alert">
                <AlertTitle as="h2">{avisoDaFila.titulo}</AlertTitle>
                <AlertDescription>
                  <p>{avisoDaFila.descricao}</p>
                  <span className="mt-2 flex flex-wrap gap-2">
                    {avisoDaFila.acao === "tentar" && (
                      <Button size="sm" variant="outline" onClick={() => fila.tentarAgora()}>
                        <RotateCcw size={14} aria-hidden="true" /> Tentar agora
                      </Button>
                    )}
                    {avisoDaFila.acao === "recarregar" && (
                      <Button size="sm" variant="outline" onClick={recarregar}>
                        <RefreshCw size={14} aria-hidden="true" /> Recarregar a apresentação
                      </Button>
                    )}
                  </span>
                </AlertDescription>
              </Alert>
            )}
            {aviso && <Alert tone="success" role="status"><AlertDescription>{aviso}</AlertDescription></Alert>}
          </div>
        )}

        {!doc ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState icon={<Presentation size={24} />} title="Escolha a obra para começar"
              description="A apresentação carrega o que a obra escolhida já tem salvo." />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <ListaDeSlides doc={doc} pagina={pagina} idioma={idioma}
              onIr={setPagina}
              onNovo={() => { setDoc((d) => ({ ...d, slides: [...d.slides, novoSlide("")] })); setPagina(doc.slides.length); }}
              onInserirApos={(i) => {
                setDoc((d) => {
                  const s = [...d.slides];
                  s.splice(i + 1, 0, novoSlide(""));
                  return { ...d, slides: s };
                });
                setPagina(i + 1);
              }}
              onExcluir={async (i) => {
                if (!(await confirmar({ titulo: "Excluir ambiente?", mensagem: "Excluir este ambiente da apresentação?", confirmar: "Excluir ambiente" }))) return;
                setDoc((d) => ({ ...d, slides: d.slides.filter((_, k) => k !== i) }));
                setPagina("dados");
              }}
              onReordenar={(de, para) => {
                if (de === para) return;
                setDoc((d) => {
                  const s = [...d.slides];
                  const [movido] = s.splice(de, 1);
                  s.splice(para, 0, movido);
                  return { ...d, slides: s };
                });
                setPagina((p) => {
                  if (typeof p !== "number") return p;
                  if (p === de) return para;
                  if (de < p && para >= p) return p - 1;
                  if (de > p && para <= p) return p + 1;
                  return p;
                });
              }} />

            <div className="min-w-0 flex-1 p-4 lg:overflow-auto">
              {!ehSlide ? (
                <PaginaFixa qual={pagina} doc={doc} idioma={idioma}
                  zoom={zoom} onZoom={setZoom}
                  onMudarCapa={(capa) => setDoc((d) => ({ ...d, capa }))} />
              ) : slide ? (
                <>
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Field className="min-w-0 flex-1">
                      <Label htmlFor="ap-ambiente">Ambiente</Label>
                      <Input id="ap-ambiente" value={slide.ambiente}
                        onChange={(e) => mudarSlide((s) => ({ ...s, ambiente: e.target.value }))}
                        placeholder="nome do ambiente — ex: Living" />
                    </Field>
                    {idioma === "en" && slide.ambiente && (
                      <span className="text-xs text-text-mute sm:pb-3">sai como <b>{ambienteEm(slide.ambiente, "en")}</b></span>
                    )}
                    <Button asChild variant="outline" size="sm" className="cursor-pointer">
                      <label>
                        <Upload size={16} /> {slide.render?.imagem ? "Trocar imagem" : "Imagem do ambiente"}
                        {/* gate-allow DS-07: input de arquivo sr-only dentro do label do Button, a exceção do padrão de upload */}
                        <input type="file" accept="image/*" className="sr-only"
                          onChange={async (e) => {
                            const f = e.target.files?.[0]; e.target.value = "";
                            if (!f) return;
                            try {
                              const c = await subirAmbiente(f, obraCod);
                              mudarSlide((s) => ({ ...s, render: { ...s.render, imagem: c } }));
                            } catch (err) { setErro(mensagem(err)); }
                          }} />
                      </label>
                    </Button>
                  </div>

                  <Palco slide={slide} idioma={idioma} zoom={zoom} onZoom={setZoom} onMudar={mudarSlide}
                    urlDoAmbiente={imagens.url} />

                  <p className="mt-2 text-xs text-text-mute">
                    Arraste a imagem e os produtos. O canto de baixo à direita de cada um redimensiona.
                    Cabem <b>{quantasCabem(slide.render)}</b> produtos sem amontoar neste arranjo.
                  </p>
                </>
              ) : (
                <EmptyState icon={<LayoutTemplate size={24} />} title="Crie um ambiente ao lado"
                  description="Cada ambiente vira um slide com a imagem e os produtos dele." />
              )}
            </div>

            <aside className="shrink-0 border-t border-line-1 bg-surface-1 p-3 lg:w-80 lg:overflow-auto lg:border-t-0 lg:border-l"
              aria-label="Painel lateral da apresentação">
              <Tabs value={abaLateral} onValueChange={setAbaLateral}>
                <TabsList variant="pill" className="mb-3 grid w-full grid-cols-3">
                  <TabsTrigger value="produtos">Produtos</TabsTrigger>
                  <TabsTrigger value="capa">Capa</TabsTrigger>
                  <TabsTrigger value="revisoes">Rev {doc.capa?.rev || "00"}</TabsTrigger>
                </TabsList>
              </Tabs>

              {abaLateral === "revisoes" ? (
                <Revisoes lista={revisoes} atualId={doc.id} rev={doc.capa?.rev}
                  onAbrir={async (r) => {
                    try {
                      await garantirGravado();
                      usarDocumento(await carregarApresentacao(obraCod, r.id));
                      setPagina("dados"); setIdioma(r.idioma || "pt");
                    } catch (e) { setErro(mensagem(e)); }
                  }}
                  onNova={novaRevisao} ocupado={salvando} />
              ) : abaLateral === "capa" ? (
                <Capa doc={doc} onMudar={(capa) => setDoc((d) => ({ ...d, capa }))} idioma={idioma} />
              ) : slide ? (
                <Produtos produtos={produtos} slide={slide} idioma={idioma}
                  onAdicionar={(ps) => mudarSlide((s) => acrescentar(s, ps))}
                  onMudarBloco={(id, f) => mudarSlide((s) => ({
                    ...s, blocos: s.blocos.map((b) => (b.id === id ? f(b) : b)) }))}
                  onAlternarModo={(id) => mudarSlide((s) => alternarModoBloco(s, id))}
                  onRemover={async (id) => {
                    if (!(await confirmar({ titulo: "Remover produto?", mensagem: "Remover este produto do ambiente?", confirmar: "Remover produto" }))) return;
                    mudarSlide((s) => ({ ...s, blocos: s.blocos.filter((b) => b.id !== id) }));
                  }} />
              ) : null}
            </aside>
          </div>
        )}

        {doc && (
          <div className="flex flex-wrap items-center gap-4 border-t border-line-1 bg-surface-1 px-4 py-2 text-xs text-text-mute">
            <span>{conf.slides} {conf.slides === 1 ? "ambiente" : "ambientes"} · {conf.blocos} produtos</span>
            {conf.semImagem.length > 0 && (
              <span className="inline-flex items-center gap-1 text-alert">
                <AlertTriangle size={12} /> sem imagem: {conf.semImagem.join(", ")}
              </span>
            )}
            {idioma === "en" && semIngles > 0 && (
              <span className="inline-flex items-center gap-1 text-alert">
                {semIngles} {semIngles === 1 ? "produto sai" : "produtos saem"} em português — falta a descrição em inglês no catálogo
              </span>
            )}
          </div>
        )}
      </PageShell>
    </div>
  );
}

/* O arquivo gerado entra em Arquivos da obra.
 *
 * Era "ler a obra, acrescentar o arquivo, gravar a linha inteira": se alguém
 * gravasse no meio, a lista voltava sem o trabalho dessa pessoa — e, com a
 * obra aberta para edição nesta mesma aba, a gravação automática da tela
 * apagava o arquivo recém-guardado. `alterarObra` resolve os dois: pela tela
 * quando a obra está em edição aqui, pela trava e pela versão quando não.
 *
 * Devolve null quando a obra ainda não tem linha no banco. */
async function guardarEmArquivosDaObra(obraCod, usuario, arquivo, oQueAconteceu) {
  try {
    return await alterarObra(obraCod, usuario, (obra) => ({
      ...obra,
      arquivos: [...(Array.isArray(obra.arquivos) ? obra.arquivos : []), arquivo],
    }));
  } catch (e) {
    if (e?.detalhe?.motivo === "trava") {
      throw new Error(`${oQueAconteceu}, mas ${e.detalhe.por || "outra pessoa"} está editando esta obra agora — não guardei em Arquivos da obra pra não gravar por cima. Tente de novo depois.`);
    }
    throw e;
  }
}

function mensagem(e) {
  const m = String(e?.message || e || "");
  if (/relation .*apresentacao.* does not exist|Could not find the table/i.test(m)) {
    return "A tabela da apresentação ainda não existe no banco. Falta rodar supabase/apresentacao.sql no Supabase.";
  }
  if (/duplicate key/i.test(m)) return "Já existe uma apresentação desta obra com esta revisão. Mude o número da Rev na aba Capa.";
  return m;
}

/* ---------------- O PALCO ----------------
 *
 * O slide em tamanho reduzido, mas na proporção exata do PDF: o que se vê
 * aqui é o que sai. A escala é a única conta — tudo o mais é guardado em
 * pontos, iguais aos do documento.
 */
function Palco({ slide, idioma, zoom, onZoom, onMudar, urlDoAmbiente }) {
  const caixa = useRef(null);
  const [cabe, setCabe] = useState(0.6);
  const [pegando, setPegando] = useState(null);
  const escala = zoom ?? cabe;

  useEffect(() => {
    const medir = () => {
      if (caixa.current) setCabe(caixa.current.clientWidth / LARGURA);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  /* Arrastar e redimensionar com ponteiro: o mesmo código serve pro mouse
     e pro toque, e `setPointerCapture` faz o movimento continuar mesmo
     quando o cursor sai de cima do elemento — sem isso o bloco "cai" no
     meio do arrasto. */
  const iniciar = (e, alvo, modo) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPegando({
      alvo, modo, pointerId: e.pointerId,
      x0: e.clientX, y0: e.clientY,
      orig: alvo === "render" ? { ...slide.render }
        : alvo === "lista" ? listaDoSlide(slide)
        : { ...slide.blocos.find((b) => b.id === alvo) },
    });
  };

  const mover = (e) => {
    if (!pegando) return;
    const dx = (e.clientX - pegando.x0) / escala;
    const dy = (e.clientY - pegando.y0) / escala;
    const o = pegando.orig;

    if (pegando.alvo === "render") {
      const r = pegando.modo === "mover"
        ? { ...o, x: o.x + dx, y: o.y + dy }
        : { ...o, w: o.w + dx, h: o.h + dy };
      onMudar((s) => ({ ...s, render: renderDentro(r) }));
    } else if (pegando.alvo === "lista") {
      const l = pegando.modo === "mover"
        ? { ...o, x: o.x + dx, y: o.y + dy }
        : { ...o, w: o.w + dx };                    // só a largura — a altura vem da quantidade de itens
      onMudar((s) => ({ ...s, lista: listaDentro(l, blocosLista(s).length) }));
    } else {
      const b = pegando.modo === "mover"
        ? { ...o, x: o.x + dx, y: o.y + dy }
        /* O bloco é quadrado na foto: a largura manda, e a altura vem
           dela. Redimensionar em dois eixos deformaria a foto. */
        : { ...o, w: Math.max(50, Math.min(300, o.w + dx)) };
      onMudar((s) => ({ ...s, blocos: s.blocos.map((x) => (x.id === b.id ? dentro(b) : x)) }));
    }
  };

  const soltar = () => setPegando(null);
  const pt = (v) => `${v * escala}px`;

  return (
    <>
    {/* A caixa que mede fica por fora e ocupa a largura toda; o palco
        dentro dela tem o tamanho do zoom. Sem separar as duas, medir a
        largura devolveria o tamanho já ampliado e o zoom se
        realimentaria. */}
    <div className="w-full" ref={caixa}>
    <div className="max-w-full overflow-auto">
    {/* Daqui até o fim do palco, `style` é a GEOMETRIA DO SLIDE: posição e
        tamanho em pontos do PDF, vindos do arrasto, vezes a escala do zoom.
        Não há classe pra isso — é a arte, não o app. */}
    <div className="ap-palco"
      // gate-allow DS-05: tamanho do palco é a página do PDF vezes o zoom (arte do slide)
      style={{ width: LARGURA * escala, height: ALTURA * escala }}
      onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>

      {slide.render?.imagem ? (
        <div className={cls("ap-render", pegando?.alvo === "render" && "ativo")}
          // gate-allow DS-05: posição e tamanho do render vêm do arrasto, em pontos do PDF
          style={{ left: pt(slide.render.x), top: pt(slide.render.y),
            width: pt(slide.render.w), height: pt(slide.render.h) }}
          onPointerDown={(e) => iniciar(e, "render", "mover")}>
          <img src={urlDoAmbiente(slide.render.imagem) || undefined} alt="" draggable={false} />
          <span className="ap-puxador" onPointerDown={(e) => iniciar(e, "render", "tamanho")} />
        </div>
      ) : (
        <div className="ap-render vazio"
          // gate-allow DS-05: a vaga do render fica onde a imagem vai cair, em pontos do PDF
          style={{ left: pt(slide.render.x), top: pt(slide.render.y),
            width: pt(slide.render.w), height: pt(slide.render.h) }}>
          <ImageIcon size={26} /> <span>imagem do ambiente</span>
        </div>
      )}

      {blocosImagem(slide).map((b) => (
        <div key={b.id} className={cls("ap-bloco", pegando?.alvo === b.id && "ativo")}
          // gate-allow DS-05: posição e largura do bloco vêm do arrasto, em pontos do PDF
          style={{ left: pt(b.x), top: pt(b.y), width: pt(b.w),
            height: pt(alturaDoBloco(b)) }}
          onPointerDown={(e) => iniciar(e, b.id, "mover")}>
          <div className="ap-bloco-foto"
            // gate-allow DS-05: a foto é quadrada — altura igual à largura do bloco, escalada
            style={{ height: pt(b.w) }}>
            {b.imagem ? <img src={urlProduto(b.imagem)} alt="" draggable={false} />
              : <ImageIcon size={16} />}
          </div>
          <div className="ap-bloco-txt"
            // gate-allow DS-05: corpo da legenda é o do PDF vezes o zoom (arte do slide)
            style={{ fontSize: Math.max(5, BLOCO.legenda * escala) }}>
            {textoDoBloco(b, idioma)}
          </div>
          <span className="ap-puxador" onPointerDown={(e) => iniciar(e, b.id, "tamanho")} />
        </div>
      ))}

      {/* A LISTAGEM: uma caixinha só por slide, uma linha por item, sem
          foto — pra quem não precisa de imagem, só do nome. */}
      {blocosLista(slide).length > 0 && (() => {
        const itens = blocosLista(slide);
        const lb = listaDentro(listaDoSlide(slide), itens.length);
        return (
          <div className={cls("ap-listagem", pegando?.alvo === "lista" && "ativo")}
            // gate-allow DS-05: posição e largura da listagem vêm do arrasto, em pontos do PDF
            style={{ left: pt(lb.x), top: pt(lb.y), width: pt(lb.w) }}
            onPointerDown={(e) => iniciar(e, "lista", "mover")}>
            {itens.map((b) => (
              <div key={b.id} className="ap-listagem-item"
                // gate-allow DS-05: corpo e entrelinha da listagem são os do PDF vezes o zoom
                style={{ fontSize: Math.max(5, LISTA_ITEM.tamanho * escala),
                  lineHeight: `${LISTA_ITEM.entrelinha * escala}px` }}>
                <span className="ap-listagem-marca">–</span>{textoDoBloco(b, idioma)}
              </div>
            ))}
            <span className="ap-puxador" onPointerDown={(e) => iniciar(e, "lista", "tamanho")} />
          </div>
        );
      })()}

      {/* A tarja do rodapé é desenhada aqui só pra lembrar que ela existe
          e que nada deve encostar nela. */}
      <div className="ap-tarja"
        // gate-allow DS-05: altura da tarja é a do rodapé do PDF vezes o zoom (arte do slide)
        style={{ height: pt(RODAPE) }}>
        <span
          // gate-allow DS-05: corpo do texto da tarja acompanha o zoom do slide (arte)
          style={{ fontSize: Math.max(6, 12 * escala) }}>
          TKWS &nbsp;|&nbsp; {ambienteEm(slide.ambiente, idioma).toUpperCase() || "AMBIENTE"}
        </span>
      </div>
    </div>
    </div>
    </div>
    <Zoom zoom={zoom} escala={cabe} onMudar={onZoom} />
    </>
  );
}

/* O controle de zoom, igual ao canto do PowerPoint: menos, mais, e um
   botão que volta pra "cabe na largura". */
const PASSOS = [0.25, 0.35, 0.5, 0.65, 0.8, 1, 1.25, 1.5, 2];

function Zoom({ zoom, escala, onMudar }) {
  const atual = zoom ?? escala;
  const vizinho = (dir) => {
    const i = PASSOS.findIndex((p) => p > atual + 0.001);
    const acima = i === -1 ? PASSOS.length - 1 : i;
    const abaixo = acima - 1 >= 0 ? (PASSOS[acima - 1] < atual - 0.001 ? acima - 1 : Math.max(0, acima - 2)) : 0;
    onMudar(PASSOS[Math.max(0, Math.min(PASSOS.length - 1, dir > 0 ? acima : abaixo))]);
  };
  return (
    <div className="mt-2 inline-flex items-center gap-1" role="group" aria-label="Zoom do slide">
      <BotaoIcone rotulo="Diminuir" variant="ghost" className="h-8 w-8"
 onClick={() => vizinho(-1)}><Minus size={14} /></BotaoIcone>
      <span className="mono num-tabular min-w-12 text-center text-xs font-semibold text-text-soft" aria-live="polite">
        {Math.round(atual * 100)}%
      </span>
      <BotaoIcone rotulo="Aumentar" variant="ghost" className="h-8 w-8"
 onClick={() => vizinho(1)}><Plus size={14} /></BotaoIcone>
      <Toggle size="sm" pressed={zoom === null} onPressedChange={(p) => { if (p) onMudar(null); }}
        aria-label="Ajustar à largura" title="Ajustar à largura"><Maximize2 size={14} /></Toggle>
    </div>
  );
}

/* A lista é o documento inteiro, na ordem em que ele sai — as três
   páginas fixas da casa incluídas. Mostrar só os ambientes escondia
   metade do que vai pro cliente, e editava-se a capa às cegas. */
function ListaDeSlides({ doc, pagina, idioma, onIr, onNovo, onInserirApos, onExcluir, onReordenar }) {
  const n = doc.slides.length;
  /* Arrastar reordena SÓ dentro de Ambientes — Abertura, Dados e
     Fechamento são fixos e nem entram na lista arrastável. `sobre` é só
     pra desenhar a linha de onde o item vai cair; a troca de verdade
     acontece no onDrop, uma vez. */
  const [arrastando, setArrastando] = useState(null);
  const [sobre, setSobre] = useState(null);

  const itemCls = (on) => cls(
    "group flex cursor-pointer items-center gap-2 rounded-lg border-t-2 border-transparent px-2 py-2 hover:bg-surface-2",
    on && "bg-brand-soft",
  );
  const teclado = (f) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } };

  return (
    <nav className="shrink-0 border-b border-line-1 bg-surface-1 p-3 lg:w-56 lg:overflow-auto lg:border-b-0 lg:border-r"
      aria-label="Páginas da apresentação">
      <div className="label-mono mb-2 px-1">Páginas</div>

      <div role="button" tabIndex={0} aria-current={pagina === "abertura" ? "page" : undefined}
        className={itemCls(pagina === "abertura")} onClick={() => onIr("abertura")} onKeyDown={teclado(() => onIr("abertura"))}>
        <Badge tone={pagina === "abertura" ? "brand" : "outline"}>1</Badge>
        <span className="flex min-w-0 flex-1 flex-col text-sm"><span className="truncate">Abertura</span><span className="text-xs text-text-mute">TKWS · arte fixa</span></span>
      </div>

      <div role="button" tabIndex={0} aria-current={pagina === "dados" ? "page" : undefined}
        className={itemCls(pagina === "dados")} onClick={() => onIr("dados")} onKeyDown={teclado(() => onIr("dados"))}>
        <Badge tone={pagina === "dados" ? "brand" : "outline"}>2</Badge>
        <span className="flex min-w-0 flex-1 flex-col text-sm"><span className="truncate">Dados do projeto</span><span className="text-xs text-text-mute">cliente, nº, data, local</span></span>
      </div>

      <div className="label-mono mb-2 mt-4 px-1">Ambientes</div>
      {doc.slides.map((s, i) => (
        <div key={s.id}
          role="button" tabIndex={0} aria-current={pagina === i ? "page" : undefined}
          className={cls(itemCls(pagina === i),
            arrastando === i && "opacity-40",
            sobre === i && arrastando !== null && arrastando !== i && "border-brand")}
          draggable
          onClick={() => onIr(i)} onKeyDown={teclado(() => onIr(i))}
          onDragStart={(e) => { setArrastando(i); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); if (sobre !== i) setSobre(i); }}
          onDragLeave={() => setSobre((v) => (v === i ? null : v))}
          onDrop={(e) => {
            e.preventDefault();
            if (arrastando !== null && arrastando !== i) onReordenar(arrastando, i);
            setArrastando(null); setSobre(null);
          }}
          onDragEnd={() => { setArrastando(null); setSobre(null); }}>
          <span className="flex shrink-0 cursor-grab text-text-mute opacity-0 group-hover:opacity-100"
            title="Segure e arraste para reordenar"><GripVertical size={14} /></span>
          <Badge tone={pagina === i ? "brand" : "neutral"}>{i + 3}</Badge>
          <span className="flex min-w-0 flex-1 flex-col text-sm">
            <span className="truncate">{s.ambiente ? ambienteEm(s.ambiente, idioma) : <em>sem nome</em>}</span>
            <span className="text-xs text-text-mute">{(s.blocos || []).length} produtos{s.render?.imagem ? "" : " · sem imagem"}</span>
          </span>
          <BotaoIcone rotulo="Novo ambiente logo abaixo deste" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
 
 onClick={(e) => { e.stopPropagation(); onInserirApos(i); }}><Plus size={12} /></BotaoIcone>
          <BotaoIcone rotulo="Excluir ambiente" variant="ghost" className="h-6 w-6 text-danger opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
 
 onClick={(e) => { e.stopPropagation(); onExcluir(i); }}><Trash2 size={12} /></BotaoIcone>
        </div>
      ))}
      <Button variant="outline" size="sm" className="mt-2 w-full border-dashed" onClick={onNovo}>
        <Plus size={16} /> Novo ambiente
      </Button>

      <div className="label-mono mb-2 mt-4 px-1">Fechamento</div>
      <div role="button" tabIndex={0} aria-current={pagina === "fechamento" ? "page" : undefined}
        className={itemCls(pagina === "fechamento")} onClick={() => onIr("fechamento")} onKeyDown={teclado(() => onIr("fechamento"))}>
        <Badge tone={pagina === "fechamento" ? "brand" : "outline"}>{n + 3}</Badge>
        <span className="flex min-w-0 flex-1 flex-col text-sm"><span className="truncate">Contracapa</span><span className="text-xs text-text-mute">símbolo WS · arte fixa</span></span>
      </div>
    </nav>
  );
}

/* As páginas que não se montam: a arte é fixa e o que muda é só o que a
   casa preenche. Elas aparecem no palco em tamanho real, na mesma
   proporção do PDF, porque ver é o ponto — quem edita a capa precisa ver
   a capa. */
function PaginaFixa({ qual, doc, idioma, zoom, onZoom, onMudarCapa }) {
  const caixa = useRef(null);
  const [cabe, setCabe] = useState(0.6);
  const [pegando, setPegando] = useState(null);
  const [editando, setEditando] = useState(null);
  const escala = zoom ?? cabe;

  useEffect(() => {
    const medir = () => caixa.current && setCabe(caixa.current.clientWidth / LARGURA);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const T = TEXTOS[idioma] || TEXTOS.pt;
  const pt = (v) => `${v * escala}px`;
  const arte = qual === "abertura" ? arteAbertura : qual === "dados" ? arteDados : arteFechamento;

  /* Arrastar a caixa; o texto continua clicável pra editar. Quem move
     pega a alça, quem escreve clica no texto — um gesto só pras duas
     coisas obrigaria a escolher entre mover e digitar. */
  const iniciar = (e, id, modo) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const campo = CAMPOS_CAPA.find((c) => c.id === id);
    setPegando({ id, modo, x0: e.clientX, y0: e.clientY, orig: caixaDoCampo(doc, campo) });
  };
  const mover = (e) => {
    if (!pegando) return;
    const dx = (e.clientX - pegando.x0) / escala;
    const dy = (e.clientY - pegando.y0) / escala;
    const o = pegando.orig;
    const nova = pegando.modo === "mover"
      ? { ...o, x: o.x + dx, y: o.y + dy }
      : { ...o, w: o.w + dx };
    onMudarCapa({ ...doc.capa, caixas: { ...(doc.capa?.caixas || {}), [pegando.id]: caixaDentro(nova) } });
  };
  const soltar = () => setPegando(null);

  const valorDe = (c) => {
    const v = (doc.capa?.[c.id] || "").trim();
    if (c.id === "titulo" && (!v || v === TEXTOS.pt.titulo)) return T.titulo;
    return v;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">
          {qual === "abertura" ? "Abertura" : qual === "dados" ? "Dados do projeto" : "Contracapa"}
        </h2>
        <span className="text-xs text-text-mute">
          {qual === "dados"
            ? "clique no texto pra escrever · arraste pela alça pra mover"
            : "arte fixa da casa — nada a preencher"}
        </span>
      </div>

      <div className="w-full" ref={caixa}>
      <div className="max-w-full overflow-auto">
      {/* Como no Palco: `style` daqui pra baixo é a geometria do slide em
          pontos do PDF vezes o zoom — arte, não app. */}
      <div className="ap-palco"
        // gate-allow DS-05: tamanho do palco é a página do PDF vezes o zoom (arte do slide)
        style={{ width: LARGURA * escala, height: ALTURA * escala }}
        onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        <img className="ap-arte" src={arte} alt="" draggable={false} />

        {/* O ano é parte do PNG. Aqui, como no PDF, ele é COBERTO e
            reescrito — senão a prévia mostra dois anos, que foi
            exatamente o que ela viu: o impresso e o desenhado ao lado. */}
        {qual === "abertura" && (
          <span className="ap-ano"
            // gate-allow DS-05: a tarja do ano cobre a posição exata do PNG da arte, escalada
            style={{
              left: pt(ANO_NA_ARTE.x), top: pt(ANO_NA_ARTE.y),
              width: pt(ANO_NA_ARTE.w), height: pt(ANO_NA_ARTE.h),
              fontSize: Math.max(4, ANO_NA_ARTE.tamanho * escala),
            }}>{new Date().getFullYear()}</span>
        )}

        {qual === "dados" && CAMPOS_CAPA.map((c) => {
          const cx = caixaDoCampo(doc, c);
          const v = valorDe(c);
          const editar = editando === c.id;
          return (
            <div key={c.id}
              className={cls("ap-caixa", pegando?.id === c.id && "ativo", editar && "editando")}
              // gate-allow DS-05: caixa da capa — posição, largura, corpo e cor são os do PDF (arte)
              style={{
                left: pt(cx.x), top: pt(cx.y), width: pt(cx.w),
                fontSize: Math.max(5, c.tamanho * escala),
                lineHeight: `${14 * escala}px`,
                textAlign: c.esquerda ? "left" : "right",
                color: c.id === "titulo" ? COR_TITULO : COR_VALOR,
                fontWeight: c.forte ? 700 : 400,
              }}>
              <span className="ap-alca" onPointerDown={(e) => iniciar(e, c.id, "mover")}
                title="Arraste para mover" />
              {editar ? (
                <Textarea autoFocus className="ap-caixa-editor" aria-label={T[c.id] || c.id}
                  value={doc.capa?.[c.id] || ""}
                  onChange={(e) => onMudarCapa({ ...doc.capa, [c.id]: e.target.value })}
                  onBlur={() => setEditando(null)}
                  onKeyDown={(e) => { if (e.key === "Escape") setEditando(null); }}
                  // gate-allow DS-05: o texto digitado alinha como sai no PDF (direita ou esquerda)
                  style={{ textAlign: c.esquerda ? "left" : "right" }} />
              ) : (
                <span className="ap-caixa-txt" onClick={() => setEditando(c.id)}>
                  {v || <em className="ap-caixa-vazia">{T[c.id] || c.id}</em>}
                </span>
              )}
              <span className="ap-puxador" onPointerDown={(e) => iniciar(e, c.id, "largura")} />
            </div>
          );
        })}
      </div>
      </div>
      </div>
      <Zoom zoom={zoom} escala={cabe} onMudar={onZoom} />

      <p className="mt-2 text-xs text-text-mute">
        {qual === "dados"
          ? "Os valores são alinhados à direita, terminando junto com a linha da arte — é como o modelo da casa faz. Arraste a alça para reposicionar."
          : "Esta página sai sempre assim — é a marca da casa."}
      </p>
    </>
  );
}


function Capa({ doc, onMudar, idioma }) {
  const set = (k, v) => onMudar({ ...doc.capa, [k]: v });
  const campos = [
    ["squad", idioma === "en" ? "Squad" : "Squad"],
    ["cliente", idioma === "en" ? "Client" : "Cliente"],
    ["projeto", idioma === "en" ? "Project no." : "Nº do projeto"],
    ["data", idioma === "en" ? "Date" : "Data"],
    ["rev", "Rev"],
    ["local", idioma === "en" ? "Location" : "Localização"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-text-mute">
        A arte da capa é fixa. Estes campos entram nas linhas dela — já vêm
        preenchidos com o que a obra sabe.
      </p>
      {campos.map(([k, rot]) => (
        <Field key={k}>
          <Label htmlFor={`ap-capa-${k}`}>{rot}</Label>
          <Input id={`ap-capa-${k}`} value={doc.capa?.[k] || ""} onChange={(e) => set(k, e.target.value)} />
        </Field>
      ))}
      <Field>
        <Label htmlFor="ap-capa-titulo">Título</Label>
        <Input id="ap-capa-titulo" value={doc.capa?.titulo || ""} onChange={(e) => set("titulo", e.target.value)} />
      </Field>
      <p className="text-xs leading-relaxed text-text-mute">
        A <b>Rev</b> separa uma versão da outra: mudar o número aqui cria uma
        apresentação nova sem apagar a que já foi ao cliente.
      </p>
    </div>
  );
}

/* O histórico de revisões.
 *
 * Cada uma é um documento inteiro guardado, não um "desfazer": a REV 00
 * é o que o cliente viu, e ela precisa continuar existindo do jeito que
 * foi apresentada mesmo depois da 01 mudar tudo. */
function Revisoes({ lista, atualId, rev, onAbrir, onNova, ocupado }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="mb-2 text-xs leading-relaxed text-text-mute">
        Cada revisão é o documento inteiro, guardado. A que foi ao cliente
        continua como foi — nada é reescrito por cima.
      </p>

      {lista.length === 0 && (
        <EmptyState as="h3" icon={<History size={20} />} title="Nada salvo ainda"
          description="Salve para criar a Rev 00." />
      )}

      {lista.map((r) => {
        const aberta = r.id === atualId;
        return (
          <Button key={r.id} variant={aberta ? "secondary" : "outline"}
            className="h-auto w-full justify-start gap-2 whitespace-normal py-2 text-left"
            aria-current={aberta ? "true" : undefined}
            onClick={() => (aberta ? null : onAbrir(r))}>
            <Badge tone={aberta ? "brand" : "neutral"}>{r.rev}</Badge>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">Revisão {r.rev}{aberta ? " — aberta" : ""}</span>
              <span className="text-xs font-normal text-text-mute">
                {(r.slides || []).length} ambientes · salvo {fmtData(r.atualizadoEm)}
              </span>
            </span>
            {/* PDF gerado é o marco: dali em diante, mexer significa nova
                revisão, porque essa versão saiu da casa. */}
            {r.geradoEm && <span className="flex text-success" title={`PDF gerado em ${fmtData(r.geradoEm)}`}>
              <FileCheck size={14} />
            </span>}
          </Button>
        );
      })}

      <Button variant="outline" size="sm" className="mt-2 w-full border-dashed" disabled={ocupado || !atualId} onClick={onNova}>
        <History size={16} /> Nova revisão (cópia da {rev})
      </Button>
      {!atualId && <p className="text-xs leading-relaxed text-text-mute">Salve esta antes de criar uma revisão nova.</p>}
    </div>
  );
}

function Produtos({ produtos, slide, idioma, onAdicionar, onMudarBloco, onAlternarModo, onRemover }) {
  const [termo, setTermo] = useState("");
  const [marcados, setMarcados] = useState(() => new Set());

  const achados = useMemo(
    () => filtrarProdutos(produtos, { termo }).slice(0, 60), [produtos, termo]);

  const alternar = (id) => setMarcados((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  return (
    <div className="flex flex-col gap-2">
      <Input icon={<Search size={16} />} value={termo} onChange={(e) => setTermo(e.target.value)}
        placeholder="produto do catálogo…" aria-label="Buscar produto do catálogo" />

      <div className="flex max-h-60 flex-col gap-1 overflow-auto" role="listbox" aria-multiselectable="true"
        aria-label="Produtos do catálogo">
        {achados.length === 0 && (
          <EmptyState as="h3" icon={<Search size={20} />} title="Nada com esse nome"
            description="Tente outra palavra do nome do produto." />
        )}
        {achados.map((p) => {
          const on = marcados.has(p.id);
          return (
            <Button key={p.id} variant={on ? "secondary" : "ghost"} size="sm" role="option" aria-selected={on}
              className="h-auto w-full justify-start gap-2 whitespace-normal py-1 text-left"
              onClick={() => alternar(p.id)}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2 text-text-mute">
                {p.imagem ? <img className="h-full w-full object-contain" src={urlProduto(p.imagem)} alt="" /> : <ImageIcon size={14} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs">{p.descricaoCriativo || p.descricao}</span>
            </Button>
          );
        })}
      </div>

      <Button className="w-full" disabled={!marcados.size}
        onClick={() => {
          onAdicionar(produtos.filter((p) => marcados.has(p.id)));
          setMarcados(new Set());
        }}>
        <Plus size={16} /> Pôr {marcados.size || ""} no slide
      </Button>

      {(slide.blocos || []).length > 0 && (
        <>
          <div className="label-mono mt-4 px-1">Neste ambiente</div>
          <p className="text-xs leading-relaxed text-text-mute">
            <ImageIcon size={12} className="inline align-text-bottom" /> mostra a foto no slide ·{" "}
            <List size={12} className="inline align-text-bottom" /> só o nome, na listagem do canto
          </p>
          {slide.blocos.map((b) => (
            <div key={b.id} className="flex items-center gap-1">
              <GripVertical size={12} className="shrink-0 text-text-mute" />
              {/* O botão simples: um clique alterna entre foto no slide e
                  nome na listagem. Ela pediu que não ficasse difícil. */}
              <Toggle size="sm" pressed={b.modo === "lista"} onPressedChange={() => onAlternarModo(b.id)}
                aria-label={b.modo === "lista" ? "Na listagem — mostrar como imagem" : "Com imagem — pôr na listagem"}
                title={b.modo === "lista"
                  ? "Está na listagem — clique para mostrar como imagem"
                  : "Está com imagem — clique para pôr na listagem"}>
                {b.modo === "lista" ? <List size={12} /> : <ImageIcon size={12} />}
              </Toggle>
              <Input className="min-w-0 flex-1" aria-label="Texto do produto no slide"
                value={textoDoBloco(b, idioma)}
                onChange={(e) => onMudarBloco(b.id,
                  (x) => (idioma === "en" ? { ...x, textoEn: e.target.value } : { ...x, texto: e.target.value }))} />
              <BotaoIcone rotulo="Remover produto do ambiente" variant="ghost" className="h-8 w-8 shrink-0 text-danger"
 onClick={() => onRemover(b.id)}><Trash2 size={14} /></BotaoIcone>
            </div>
          ))}
          {idioma === "en" && (
            <p className="text-xs leading-relaxed text-text-mute">Editando aqui você escreve o texto <b>em inglês</b> deste slide. O português não é tocado.</p>
          )}
        </>
      )}
    </div>
  );
}
