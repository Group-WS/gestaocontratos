import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  X, Plus, Trash2, Upload, Save, FileDown, Image as ImageIcon,
  AlertTriangle, Check, Search, GripVertical, History, FileCheck,
  Minus, Maximize2,
} from "lucide-react";
import {
  novaApresentacao, novoSlide, acrescentar, dentro, renderDentro,
  conferir, nomeDoArquivo, quantasCabem, alturaDoBloco, proximaRev, duplicarComoRev,
  CAMPOS_CAPA, quebrar, caixaDoCampo, caixaDentro, ANO_NA_ARTE, COR_VALOR, COR_TITULO,
  LARGURA, ALTURA, RODAPE, BLOCO,
  listarApresentacoes, salvarApresentacao, marcarGerada,
  subirAmbiente, urlDaImagem, bytesDaImagem,
} from "./lib/apresentacao";
import { IDIOMAS, TEXTOS, ambienteEm, textoDoBloco, faltamEmIngles } from "./lib/apresentacaoIdioma";
import { gerarPdf } from "./lib/apresentacaoPdf";
import { urlDaImagem as urlProduto, filtrarProdutos } from "./lib/catalogo";
import { subirArquivo } from "./lib/arquivos";
import { carregarDadosObra, salvarDadosObra } from "./lib/dadosObra";
/* As três páginas fixas do documento: a abertura da marca, a folha de
   dados do projeto e o fechamento. Vieram do PPTX dela, não de
   reconstituição — reconstituir marca é errar de leve e ninguém saber
   dizer onde. */
import arteAbertura from "./assets/capa-abertura.png";
import arteDados from "./assets/capa-dados.png";
import arteFechamento from "./assets/capa-fechamento.png";

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

const fmtData = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null);

export default function Apresentacao({ usuario, obras, produtos, onFechar }) {
  const [doc, setDoc] = useState(null);
  const [obraCod, setObraCod] = useState("");
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
    if (!obraCod) { setDoc(null); return; }
    let vivo = true;
    listarApresentacoes(obraCod)
      .then((l) => {
        if (!vivo) return;
        setRevisoes(l);
        setDoc(l.length ? { ...l[0] } : { ...novaApresentacao(obra), slides: [novoSlide("")] });
        setPagina("dados");
      })
      .catch((e) => vivo && setErro(mensagem(e)));
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

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const salvo = await salvarApresentacao({ ...doc, obraCodigo: obraCod, idioma }, usuario);
      setDoc((d) => ({ ...d, id: salvo.id, atualizadoEm: salvo.atualizadoEm }));
      setRevisoes(await listarApresentacoes(obraCod));
      setAviso("Salvo.");
      setTimeout(() => setAviso(null), 2500);
    } catch (e) { setErro(mensagem(e)); }
    finally { setSalvando(false); }
  }

  async function gerar() {
    setGerando("Montando o PDF…"); setErro(null);
    try {
      /* Salva ANTES de gerar: se a geração falhar no meio, o trabalho
         continua no banco. */
      const salvo = await salvarApresentacao({ ...doc, obraCodigo: obraCod, idioma }, usuario);
      setDoc((d) => ({ ...d, id: salvo.id }));

      const baixar = async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer());
      const artes = {
        abertura: await baixar(arteAbertura),
        dados: await baixar(arteDados),
        fechamento: await baixar(arteFechamento),
      };
      const bytes = await gerarPdf(doc, artes, bytesDaImagem, idioma);

      setGerando("Guardando em Arquivos da obra…");
      const nome = nomeDoArquivo({ ...doc, obraCodigo: obraCod }, idioma);
      const file = new File([bytes], nome, { type: "application/pdf" });
      const info = await subirArquivo({
        obraCodigo: obraCod, chave: "apresentacao", file, por: usuario,
      });

      /* Subir pro depósito NÃO é o mesmo que aparecer em Arquivos da
         obra: a tela lê a lista guardada na obra, e um arquivo que só
         existe no depósito é um arquivo que ninguém acha. */
      const dados = await carregarDadosObra(obraCod);
      if (!dados) throw new Error("O PDF foi gerado, mas esta obra ainda não tem dados salvos — ele não pôde ser guardado em Arquivos da obra.");
      const outro = dados.editandoPor && dados.editandoPor !== usuario;
      if (outro) throw new Error(`O PDF foi gerado e baixado, mas ${dados.editandoPor} está editando esta obra agora — não guardei em Arquivos da obra pra não gravar por cima. Tente de novo depois.`);

      const avulsos = Array.isArray(dados.arquivos) ? dados.arquivos : [];
      await salvarDadosObra(obraCod, {
        ...dados,
        arquivos: [...avulsos, {
          ...info,
          id: `arq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          titulo: nome,
          fase: "cliente",
        }],
      }, usuario);
      await marcarGerada(salvo.id, info.caminho);

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

  /* A REVISÃO NOVA NASCE COMO CÓPIA e não apaga a anterior: a 00 já foi
     ao cliente, e alguém vai querer conferir o que mudou. */
  async function novaRevisao() {
    const rev = proximaRev(revisoes.map((r) => r.rev));
    if (!window.confirm(`Criar a revisão ${rev} como cópia da ${doc.capa?.rev || "atual"}? A anterior continua guardada.`)) return;
    setSalvando(true); setErro(null);
    try {
      await salvarApresentacao({ ...doc, obraCodigo: obraCod, idioma }, usuario);   // fecha a atual
      const nova = await salvarApresentacao(duplicarComoRev({ ...doc, obraCodigo: obraCod }, rev), usuario);
      setRevisoes(await listarApresentacoes(obraCod));
      setDoc(nova); setPagina("dados");
      setAviso(`Revisão ${rev} criada. A ${doc.capa?.rev} continua guardada.`);
    } catch (e) { setErro(mensagem(e)); }
    finally { setSalvando(false); }
  }

  return (
    <div className="ap-tela">
      <EstiloApresentacao />

      <div className="ap-topo">
        <button className="ap-voltar" onClick={onFechar}><X size={15} /></button>
        <b>Apresentação de especificações</b>

        <select className="ap-sel" value={obraCod} onChange={(e) => setObraCod(e.target.value)}>
          <option value="">escolha a obra…</option>
          {obras.map((o) => <option key={o.codigo} value={o.codigo}>#{o.codigo} {o.nome}</option>)}
        </select>

        {/* A equipe escreve em português; a bandeira decide como SAI. */}
        <div className="ap-idioma">
          {IDIOMAS.map((i) => (
            <button key={i.id} className={idioma === i.id ? "on" : ""}
              onClick={() => setIdioma(i.id)} title={`Ver e emitir em ${i.nome}`}>
              <span>{i.bandeira}</span> {i.id.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="ap-acoes">
          {doc?.atualizadoEm && <span className="ap-quando">salvo {fmtData(doc.atualizadoEm)}</span>}
          <button className="ap-btn" disabled={!doc || salvando} onClick={salvar}>
            <Save size={13} /> {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button className="ap-btn ap-primario" disabled={!conf.pronto || !!gerando} onClick={gerar}
            title={conf.pronto ? "" : "Todo ambiente precisa de nome e de imagem"}>
            <FileDown size={13} /> {gerando || "Gerar PDF"}
          </button>
        </div>
      </div>

      {erro && <div className="ap-erro"><AlertTriangle size={14} /> <span>{erro}</span></div>}
      {aviso && <div className="ap-ok"><Check size={14} /> <span>{aviso}</span></div>}

      {!doc ? (
        <div className="ap-vazio">Escolha a obra para começar.</div>
      ) : (
        <div className="ap-corpo">
          <ListaDeSlides doc={doc} pagina={pagina} idioma={idioma}
            onIr={setPagina}
            onNovo={() => { setDoc((d) => ({ ...d, slides: [...d.slides, novoSlide("")] })); setPagina(doc.slides.length); }}
            onExcluir={(i) => {
              if (!window.confirm("Excluir este ambiente da apresentação?")) return;
              setDoc((d) => ({ ...d, slides: d.slides.filter((_, k) => k !== i) }));
              setPagina("dados");
            }} />

          <div className="ap-meio">
            {!ehSlide ? (
              <PaginaFixa qual={pagina} doc={doc} idioma={idioma}
                zoom={zoom} onZoom={setZoom}
                onMudarCapa={(capa) => setDoc((d) => ({ ...d, capa }))} />
            ) : slide ? (
              <>
                <div className="ap-cab-slide">
                  <input className="ap-amb" value={slide.ambiente}
                    onChange={(e) => mudarSlide((s) => ({ ...s, ambiente: e.target.value }))}
                    placeholder="nome do ambiente — ex: Living" />
                  {idioma === "en" && slide.ambiente && (
                    <span className="ap-traduz">sai como <b>{ambienteEm(slide.ambiente, "en")}</b></span>
                  )}
                  <label className="ap-btn">
                    <Upload size={13} /> {slide.render?.imagem ? "Trocar imagem" : "Imagem do ambiente"}
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0]; e.target.value = "";
                        if (!f) return;
                        try {
                          const c = await subirAmbiente(f, obraCod);
                          mudarSlide((s) => ({ ...s, render: { ...s.render, imagem: c } }));
                        } catch (err) { setErro(mensagem(err)); }
                      }} />
                  </label>
                </div>

                <Palco slide={slide} idioma={idioma} zoom={zoom} onZoom={setZoom} onMudar={mudarSlide} />

                <div className="ap-dica">
                  Arraste a imagem e os produtos. O canto de baixo à direita de cada um redimensiona.
                  Cabem <b>{quantasCabem(slide.render)}</b> produtos sem amontoar neste arranjo.
                </div>
              </>
            ) : <div className="ap-vazio">Crie um ambiente ao lado.</div>}
          </div>

          <div className="ap-lado">
            <div className="ap-abas">
              <button className={abaLateral === "produtos" ? "on" : ""}
                onClick={() => setAbaLateral("produtos")}>Produtos</button>
              <button className={abaLateral === "capa" ? "on" : ""}
                onClick={() => setAbaLateral("capa")}>Capa</button>
              <button className={abaLateral === "revisoes" ? "on" : ""}
                onClick={() => setAbaLateral("revisoes")}>Rev {doc.capa?.rev || "00"}</button>
            </div>

            {abaLateral === "revisoes" ? (
              <Revisoes lista={revisoes} atualId={doc.id} rev={doc.capa?.rev}
                onAbrir={(r) => { setDoc({ ...r }); setPagina("dados"); setIdioma(r.idioma || "pt"); }}
                onNova={novaRevisao} ocupado={salvando} />
            ) : abaLateral === "capa" ? (
              <Capa doc={doc} onMudar={(capa) => setDoc((d) => ({ ...d, capa }))} idioma={idioma} />
            ) : slide ? (
              <Produtos produtos={produtos} slide={slide} idioma={idioma}
                onAdicionar={(ps) => mudarSlide((s) => acrescentar(s, ps))}
                onMudarBloco={(id, f) => mudarSlide((s) => ({
                  ...s, blocos: s.blocos.map((b) => (b.id === id ? f(b) : b)) }))}
                onRemover={(id) => mudarSlide((s) => ({
                  ...s, blocos: s.blocos.filter((b) => b.id !== id) }))} />
            ) : null}
          </div>
        </div>
      )}

      {doc && (
        <div className="ap-rodape">
          <span>{conf.slides} {conf.slides === 1 ? "ambiente" : "ambientes"} · {conf.blocos} produtos</span>
          {conf.semImagem.length > 0 && (
            <span className="ap-falta">
              <AlertTriangle size={12} /> sem imagem: {conf.semImagem.join(", ")}
            </span>
          )}
          {idioma === "en" && semIngles > 0 && (
            <span className="ap-falta">
              {semIngles} {semIngles === 1 ? "produto sai" : "produtos saem"} em português — falta a descrição em inglês no catálogo
            </span>
          )}
        </div>
      )}
    </div>
  );
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
function Palco({ slide, idioma, zoom, onZoom, onMudar }) {
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
      orig: alvo === "render"
        ? { ...slide.render }
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
    <div className="ap-medida" ref={caixa}>
    <div className="ap-rolagem">
    <div className="ap-palco" style={{ width: LARGURA * escala, height: ALTURA * escala }}
      onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>

      {slide.render?.imagem ? (
        <div className={`ap-render ${pegando?.alvo === "render" ? "ativo" : ""}`}
          style={{ left: pt(slide.render.x), top: pt(slide.render.y),
            width: pt(slide.render.w), height: pt(slide.render.h) }}
          onPointerDown={(e) => iniciar(e, "render", "mover")}>
          <img src={urlDaImagem(slide.render.imagem)} alt="" draggable={false} />
          <span className="ap-puxador" onPointerDown={(e) => iniciar(e, "render", "tamanho")} />
        </div>
      ) : (
        <div className="ap-render vazio"
          style={{ left: pt(slide.render.x), top: pt(slide.render.y),
            width: pt(slide.render.w), height: pt(slide.render.h) }}>
          <ImageIcon size={26} /> <span>imagem do ambiente</span>
        </div>
      )}

      {(slide.blocos || []).map((b) => (
        <div key={b.id} className={`ap-bloco ${pegando?.alvo === b.id ? "ativo" : ""}`}
          style={{ left: pt(b.x), top: pt(b.y), width: pt(b.w),
            height: pt(alturaDoBloco(b)) }}
          onPointerDown={(e) => iniciar(e, b.id, "mover")}>
          <div className="ap-bloco-foto" style={{ height: pt(b.w) }}>
            {b.imagem ? <img src={urlProduto(b.imagem)} alt="" draggable={false} />
              : <ImageIcon size={16} />}
          </div>
          <div className="ap-bloco-txt" style={{ fontSize: Math.max(5, BLOCO.legenda * escala) }}>
            {textoDoBloco(b, idioma)}
          </div>
          <span className="ap-puxador" onPointerDown={(e) => iniciar(e, b.id, "tamanho")} />
        </div>
      ))}

      {/* A tarja do rodapé é desenhada aqui só pra lembrar que ela existe
          e que nada deve encostar nela. */}
      <div className="ap-tarja" style={{ height: pt(RODAPE) }}>
        <span style={{ fontSize: Math.max(6, 12 * escala) }}>
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
    <div className="ap-zoom">
      <button onClick={() => vizinho(-1)} title="Diminuir"><Minus size={12} /></button>
      <span className="ap-zoom-n">{Math.round(atual * 100)}%</span>
      <button onClick={() => vizinho(1)} title="Aumentar"><Plus size={12} /></button>
      <button className={zoom === null ? "on" : ""} onClick={() => onMudar(null)}
        title="Ajustar à largura"><Maximize2 size={12} /></button>
    </div>
  );
}

/* A lista é o documento inteiro, na ordem em que ele sai — as três
   páginas fixas da casa incluídas. Mostrar só os ambientes escondia
   metade do que vai pro cliente, e editava-se a capa às cegas. */
function ListaDeSlides({ doc, pagina, idioma, onIr, onNovo, onExcluir }) {
  const n = doc.slides.length;
  return (
    <div className="ap-slides">
      <div className="ap-slides-rot">Páginas</div>

      <div className={`ap-slide-item ${pagina === "abertura" ? "on" : ""}`} onClick={() => onIr("abertura")}>
        <span className="ap-slide-n ap-fixa">1</span>
        <span className="ap-slide-nome">Abertura<small>TKWS · arte fixa</small></span>
      </div>

      <div className={`ap-slide-item ${pagina === "dados" ? "on" : ""}`} onClick={() => onIr("dados")}>
        <span className="ap-slide-n ap-fixa">2</span>
        <span className="ap-slide-nome">Dados do projeto<small>cliente, nº, data, local</small></span>
      </div>

      <div className="ap-slides-rot">Ambientes</div>
      {doc.slides.map((s, i) => (
        <div key={s.id} className={`ap-slide-item ${pagina === i ? "on" : ""}`} onClick={() => onIr(i)}>
          <span className="ap-slide-n">{i + 3}</span>
          <span className="ap-slide-nome">
            {s.ambiente ? ambienteEm(s.ambiente, idioma) : <em>sem nome</em>}
            <small>{(s.blocos || []).length} produtos{s.render?.imagem ? "" : " · sem imagem"}</small>
          </span>
          <button onClick={(e) => { e.stopPropagation(); onExcluir(i); }}><Trash2 size={12} /></button>
        </div>
      ))}
      <button className="ap-novo" onClick={onNovo}><Plus size={13} /> Novo ambiente</button>

      <div className="ap-slides-rot">Fechamento</div>
      <div className={`ap-slide-item ${pagina === "fechamento" ? "on" : ""}`} onClick={() => onIr("fechamento")}>
        <span className="ap-slide-n ap-fixa">{n + 3}</span>
        <span className="ap-slide-nome">Contracapa<small>símbolo WS · arte fixa</small></span>
      </div>
    </div>
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
      <div className="ap-cab-slide">
        <b className="ap-fixa-nome">
          {qual === "abertura" ? "Abertura" : qual === "dados" ? "Dados do projeto" : "Contracapa"}
        </b>
        <span className="ap-traduz">
          {qual === "dados"
            ? "clique no texto pra escrever · arraste pela alça pra mover"
            : "arte fixa da casa — nada a preencher"}
        </span>
      </div>

      <div className="ap-medida" ref={caixa}>
      <div className="ap-rolagem">
      <div className="ap-palco" style={{ width: LARGURA * escala, height: ALTURA * escala }}
        onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        <img className="ap-arte" src={arte} alt="" draggable={false} />

        {/* O ano é parte do PNG. Aqui, como no PDF, ele é COBERTO e
            reescrito — senão a prévia mostra dois anos, que foi
            exatamente o que ela viu: o impresso e o desenhado ao lado. */}
        {qual === "abertura" && (
          <span className="ap-ano" style={{
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
              className={`ap-caixa ${pegando?.id === c.id ? "ativo" : ""} ${editar ? "editando" : ""}`}
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
                <textarea autoFocus value={doc.capa?.[c.id] || ""}
                  onChange={(e) => onMudarCapa({ ...doc.capa, [c.id]: e.target.value })}
                  onBlur={() => setEditando(null)}
                  onKeyDown={(e) => { if (e.key === "Escape") setEditando(null); }}
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

      <div className="ap-dica">
        {qual === "dados"
          ? "Os valores são alinhados à direita, terminando junto com a linha da arte — é como o modelo da casa faz. Arraste a alça para reposicionar."
          : "Esta página sai sempre assim — é a marca da casa."}
      </div>
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
    <div className="ap-capa">
      <p className="ap-nota">
        A arte da capa é fixa. Estes campos entram nas linhas dela — já vêm
        preenchidos com o que a obra sabe.
      </p>
      {campos.map(([k, rot]) => (
        <label key={k}>{rot}
          <input value={doc.capa?.[k] || ""} onChange={(e) => set(k, e.target.value)} />
        </label>
      ))}
      <label>Título
        <input value={doc.capa?.titulo || ""} onChange={(e) => set("titulo", e.target.value)} />
      </label>
      <p className="ap-nota">
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
    <div className="ap-revs">
      <p className="ap-nota">
        Cada revisão é o documento inteiro, guardado. A que foi ao cliente
        continua como foi — nada é reescrito por cima.
      </p>

      {lista.length === 0 && <div className="ap-vazio-min">Nada salvo ainda. Salve para criar a Rev 00.</div>}

      {lista.map((r) => (
        <button key={r.id} className={`ap-rev ${r.id === atualId ? "on" : ""}`}
          onClick={() => (r.id === atualId ? null : onAbrir(r))}>
          <span className="ap-rev-n">{r.rev}</span>
          <span className="ap-rev-id">
            <b>Revisão {r.rev}{r.id === atualId ? " — aberta" : ""}</b>
            <small>
              {(r.slides || []).length} ambientes · salvo {fmtData(r.atualizadoEm)}
            </small>
          </span>
          {/* PDF gerado é o marco: dali em diante, mexer significa nova
              revisão, porque essa versão saiu da casa. */}
          {r.geradoEm && <span className="ap-rev-pdf" title={`PDF gerado em ${fmtData(r.geradoEm)}`}>
            <FileCheck size={13} />
          </span>}
        </button>
      ))}

      <button className="ap-novo" disabled={ocupado || !atualId} onClick={onNova}>
        <History size={13} /> Nova revisão (cópia da {rev})
      </button>
      {!atualId && <p className="ap-nota">Salve esta antes de criar uma revisão nova.</p>}
    </div>
  );
}

function Produtos({ produtos, slide, idioma, onAdicionar, onMudarBloco, onRemover }) {
  const [termo, setTermo] = useState("");
  const [marcados, setMarcados] = useState(() => new Set());

  const achados = useMemo(
    () => filtrarProdutos(produtos, { termo }).slice(0, 60), [produtos, termo]);

  const alternar = (id) => setMarcados((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  return (
    <div className="ap-prod">
      <label className="ap-busca">
        <Search size={13} />
        <input value={termo} onChange={(e) => setTermo(e.target.value)}
          placeholder="produto do catálogo…" />
      </label>

      <div className="ap-lista">
        {achados.length === 0 && <div className="ap-vazio-min">Nada com esse nome.</div>}
        {achados.map((p) => (
          <button key={p.id} className={`ap-prod-item ${marcados.has(p.id) ? "on" : ""}`}
            onClick={() => alternar(p.id)}>
            <span className="ap-prod-foto">
              {p.imagem ? <img src={urlProduto(p.imagem)} alt="" /> : <ImageIcon size={13} />}
            </span>
            <span className="ap-prod-nome">{p.descricaoCriativo || p.descricao}</span>
          </button>
        ))}
      </div>

      <button className="ap-add" disabled={!marcados.size}
        onClick={() => {
          onAdicionar(produtos.filter((p) => marcados.has(p.id)));
          setMarcados(new Set());
        }}>
        <Plus size={13} /> Pôr {marcados.size || ""} no slide
      </button>

      {(slide.blocos || []).length > 0 && (
        <>
          <div className="ap-slides-rot">Neste ambiente</div>
          {slide.blocos.map((b) => (
            <div key={b.id} className="ap-bloco-linha">
              <GripVertical size={12} className="dim" />
              <input value={textoDoBloco(b, idioma)}
                onChange={(e) => onMudarBloco(b.id,
                  (x) => (idioma === "en" ? { ...x, textoEn: e.target.value } : { ...x, texto: e.target.value }))} />
              <button onClick={() => onRemover(b.id)}><Trash2 size={12} /></button>
            </div>
          ))}
          {idioma === "en" && (
            <p className="ap-nota">Editando aqui você escreve o texto <b>em inglês</b> deste slide. O português não é tocado.</p>
          )}
        </>
      )}
    </div>
  );
}

function EstiloApresentacao() {
  return <style>{`
    .ap-tela { position: fixed; inset: 0; z-index: 300; background: var(--page); display: flex; flex-direction: column; font-size: 12.5px; }
    .ap-topo { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: #fff; }
    .ap-topo > b { font-size: 13.5px; color: var(--ink); }
    .ap-voltar { background: none; border: none; color: var(--ink-3); cursor: pointer; display: flex; padding: 4px; }
    .ap-voltar:hover { color: var(--ink); }
    .ap-sel { border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 12px; padding: 6px 9px; background: #fff; color: var(--ink); }
    .ap-idioma { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .ap-idioma button { background: none; border: none; font-family: inherit; font-size: 11px; font-weight: 600; color: var(--ink-3); padding: 6px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
    .ap-idioma button + button { border-left: 1px solid var(--border); }
    .ap-idioma button.on { background: var(--ink); color: #fff; }
    .ap-idioma span { font-size: 13px; }
    .ap-acoes { margin-left: auto; display: flex; align-items: center; gap: 8px; }
    .ap-quando { font-size: 10.5px; color: var(--ink-3); }
    .ap-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 8px; background: #fff; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--ink-2); padding: 6px 12px; cursor: pointer; }
    .ap-btn:hover:not(:disabled) { border-color: var(--blue); color: var(--ink); }
    .ap-btn:disabled { opacity: .45; cursor: default; }
    .ap-primario { background: var(--ink); border-color: var(--ink); color: #fff; }
    .ap-primario:hover:not(:disabled) { color: #fff; }

    .ap-erro, .ap-ok { display: flex; align-items: center; gap: 8px; padding: 9px 16px; font-size: 12.5px; }
    .ap-erro { background: #FEF2F2; color: #b91c1c; border-bottom: 1px solid #FECACA; }
    .ap-ok { background: #F0FDF4; color: #166534; border-bottom: 1px solid #BBF7D0; }

    .ap-corpo { flex: 1; display: grid; grid-template-columns: 210px 1fr 300px; min-height: 0; }
    .ap-vazio { padding: 50px; color: var(--ink-3); }
    .ap-vazio-min { padding: 14px 4px; color: var(--ink-3); font-size: 11.5px; }

    .ap-slides { border-right: 1px solid var(--border); overflow: auto; padding: 12px 10px; background: #fff; }
    .ap-slides-rot { font-size: 9.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); margin: 10px 4px 7px; }
    .ap-slide-item { display: flex; align-items: center; gap: 8px; border-radius: 8px; padding: 7px 8px; cursor: pointer; }
    .ap-slide-item:hover { background: var(--panel); }
    .ap-slide-item.on { background: var(--blue-bg); }
    .ap-slide-n { width: 18px; height: 18px; border-radius: 5px; background: var(--panel); color: var(--ink-3); font-size: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ap-slide-item.on .ap-slide-n { background: var(--blue); color: #fff; }
    .ap-slide-nome { flex: 1; min-width: 0; display: flex; flex-direction: column; color: var(--ink); overflow: hidden; }
    .ap-slide-nome small { font-size: 10px; color: var(--ink-3); }
    .ap-slide-item button { background: none; border: none; color: var(--ink-3); cursor: pointer; opacity: 0; display: flex; }
    .ap-slide-item:hover button { opacity: 1; }
    .ap-novo { width: 100%; margin-top: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px dashed var(--border); border-radius: 8px; background: none; font-family: inherit; font-size: 12px; color: var(--ink-2); padding: 8px; cursor: pointer; }
    .ap-novo:hover { border-color: var(--blue); color: var(--ink); }

    .ap-meio { padding: 14px 18px; overflow: auto; min-width: 0; }
    .ap-cab-slide { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .ap-amb { flex: 1; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--ink); padding: 7px 10px; }
    .ap-traduz { font-size: 11px; color: var(--ink-3); }
    .ap-dica { font-size: 11px; color: var(--ink-3); margin-top: 10px; }

    .ap-medida { width: 100%; }
    .ap-rolagem { overflow: auto; max-width: 100%; }
    .ap-zoom { display: inline-flex; align-items: center; gap: 2px; border: 1px solid var(--border); border-radius: 8px; background: #fff; padding: 2px; margin-top: 10px; }
    .ap-zoom button { background: none; border: none; color: var(--ink-3); cursor: pointer; display: flex; padding: 5px 7px; border-radius: 6px; }
    .ap-zoom button:hover { background: var(--panel); color: var(--ink); }
    .ap-zoom button.on { background: var(--ink); color: #fff; }
    .ap-zoom-n { font-size: 11px; font-weight: 600; color: var(--ink-2); min-width: 38px; text-align: center; font-variant-numeric: tabular-nums; }
    .ap-palco { position: relative; background: #fff; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; touch-action: none; user-select: none; }
    .ap-render { position: absolute; cursor: grab; overflow: hidden; }
    .ap-render img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ap-render.ativo, .ap-bloco.ativo { outline: 2px solid var(--blue); }
    .ap-render.vazio { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: var(--panel); color: #B9B7B2; font-size: 11px; cursor: default; }
    .ap-bloco { position: absolute; cursor: grab; background: rgba(255,255,255,.86); }
    .ap-bloco-foto { display: flex; align-items: center; justify-content: center; overflow: hidden; color: #C9C7C2; }
    .ap-bloco-foto img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .ap-bloco-txt { color: #6B6E70; line-height: 1.2; padding-top: 2px; overflow: hidden; }
    .ap-puxador { position: absolute; right: -3px; bottom: -3px; width: 11px; height: 11px; border-radius: 3px; background: var(--blue); border: 1.5px solid #fff; cursor: nwse-resize; }
    .ap-tarja { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; padding-left: 20px; color: var(--ink); background: rgba(255,255,255,.5); border-top: 1px dashed var(--border); font-weight: 700; letter-spacing: .04em; }

    .ap-lado { border-left: 1px solid var(--border); background: #fff; overflow: auto; padding: 12px; }
    .ap-abas { display: flex; gap: 4px; margin-bottom: 10px; }
    .ap-abas button { flex: 1; background: none; border: 1px solid transparent; border-radius: 7px; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--ink-3); padding: 6px; cursor: pointer; }
    .ap-abas button.on { background: var(--panel); border-color: var(--border); color: var(--ink); }

    .ap-busca { display: flex; align-items: center; gap: 7px; border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; color: var(--ink-3); }
    .ap-busca input { border: none; outline: none; font-family: inherit; font-size: 12px; flex: 1; background: none; color: var(--ink); }
    .ap-lista { max-height: 240px; overflow: auto; margin: 8px 0; }
    .ap-prod-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; background: none; border: 1px solid transparent; border-radius: 7px; padding: 5px 6px; font-family: inherit; font-size: 11.5px; color: var(--ink); cursor: pointer; }
    .ap-prod-item:hover { background: var(--panel); }
    .ap-prod-item.on { background: var(--blue-bg); border-color: var(--blue); }
    .ap-prod-foto { width: 26px; height: 26px; border-radius: 5px; background: var(--panel); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; color: #C9C7C2; }
    .ap-prod-foto img { width: 100%; height: 100%; object-fit: contain; }
    .ap-prod-nome { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ap-add { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: var(--ink); color: #fff; border: none; border-radius: 8px; font-family: inherit; font-size: 12px; font-weight: 600; padding: 8px; cursor: pointer; }
    .ap-add:disabled { opacity: .4; cursor: default; }
    .ap-bloco-linha { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
    .ap-bloco-linha input { flex: 1; min-width: 0; border: 1px solid var(--border); border-radius: 7px; font-family: inherit; font-size: 11.5px; padding: 5px 7px; }
    .ap-bloco-linha button { background: none; border: none; color: var(--ink-3); cursor: pointer; display: flex; }

    .ap-capa label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 600; color: var(--ink-2); margin-bottom: 9px; }
    .ap-capa input { border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 12.5px; font-weight: 400; color: var(--ink); padding: 7px 9px; }
    .ap-nota { font-size: 11px; color: var(--ink-3); line-height: 1.5; margin: 0 0 12px; }

    .ap-arte { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; }
    .ap-fixa { background: var(--ink-2) !important; color: #fff !important; }
    .ap-fixa-nome { flex: 1; font-size: 13px; color: var(--ink); }
    .ap-ano { position: absolute; background: #092737; color: #8C9296; writing-mode: vertical-rl; letter-spacing: .04em; display: flex; align-items: center; justify-content: center; }
    .ap-caixa { position: absolute; white-space: pre-wrap; }
    .ap-caixa:hover { outline: 1px dashed var(--blue); }
    .ap-caixa.ativo { outline: 1px solid var(--blue); }
    .ap-caixa.editando { outline: 1px solid var(--blue); background: rgba(255,255,255,.92); }
    .ap-caixa-txt { display: block; cursor: text; min-height: 1em; }
    .ap-caixa-vazia { color: #C4C4C4; font-style: italic; }
    .ap-caixa textarea { width: 100%; border: none; outline: none; background: none; resize: none; font: inherit; color: inherit; padding: 0; overflow: hidden; min-height: 2em; }
    .ap-alca { position: absolute; left: -9px; top: 0; width: 7px; height: 100%; min-height: 12px; border-radius: 3px; background: var(--blue); opacity: 0; cursor: grab; }
    .ap-caixa:hover .ap-alca { opacity: .85; }
    .ap-rev { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; background: none; border: 1px solid var(--border); border-radius: 9px; padding: 8px 10px; margin-bottom: 6px; font-family: inherit; cursor: pointer; }
    .ap-rev:hover { border-color: var(--blue); }
    .ap-rev.on { background: var(--blue-bg); border-color: var(--blue); cursor: default; }
    .ap-rev-n { width: 26px; height: 26px; border-radius: 7px; background: var(--panel); color: var(--ink-2); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ap-rev.on .ap-rev-n { background: var(--blue); color: #fff; }
    .ap-rev-id { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .ap-rev-id b { font-size: 12px; color: var(--ink); font-weight: 600; }
    .ap-rev-id small { font-size: 10.5px; color: var(--ink-3); }
    .ap-rev-pdf { color: var(--green); display: flex; }
    .ap-rodape { display: flex; align-items: center; gap: 16px; padding: 8px 16px; border-top: 1px solid var(--border); background: #fff; font-size: 11.5px; color: var(--ink-3); }
    .ap-falta { display: inline-flex; align-items: center; gap: 5px; color: #B45309; }
  `}</style>;
}
