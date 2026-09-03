import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search, Plus, Image as ImageIcon, Trash2, Pencil, X, Store,
  AlertTriangle, Check, ArrowRight, Upload, Presentation,
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
 * Mora em arquivo próprio, e não dentro do App.jsx, por dois motivos
 * práticos: o App já passa de 14 mil linhas, e o CSS dele é um template
 * literal onde uma crase perdida derruba o build inteiro — coisa que já
 * aconteceu duas vezes. Aqui o estilo é local e o risco fica local.
 */

const fmt = (c) => (c == null ? null
  : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

const hoje = () => new Date().toISOString().slice(0, 10);

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
  const [aviso, setAviso] = useState(null);

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

  async function salvar(p) {
    const salvo = await salvarProduto({ ...p, criadoPor: usuario }, usuario);
    setProdutos((l) => {
      const i = l.findIndex((x) => x.id === salvo.id);
      return i >= 0 ? l.map((x) => (x.id === salvo.id ? salvo : x)) : [...l, salvo];
    });
    setEditando(null);
  }

  async function remover(p) {
    if (!window.confirm(`Tirar "${p.descricao}" do catálogo? Isso não pode ser desfeito.`)) return;
    try {
      await excluirProduto(p.id);
      setProdutos((l) => l.filter((x) => x.id !== p.id));
    } catch (e) { setErro(mensagemDeErro(e)); }
  }

  return (
    <div className="cat">
      <EstiloCatalogo />

      {erro && <div className="cat-erro"><AlertTriangle size={14} /> <span>{erro}</span></div>}
      {aviso && <div className="cat-ok"><Check size={14} /> <span>{aviso}</span></div>}

      <div className="cat-abas">
        <button className={aba === "produtos" ? "on" : ""} onClick={() => setAba("produtos")}>
          Produtos <span className="cat-cont">{produtos.length}</span>
        </button>
        <button className={aba === "fornecedores" ? "on" : ""} onClick={() => setAba("fornecedores")}>
          Fornecedores <span className="cat-cont">{fornecedores.length}</span>
        </button>
        {/* A apresentação vive aqui porque é daqui que ela se alimenta:
            é o catálogo que tem foto e descrição de cada peça. */}
        <button className="cat-apresentar" style={{ marginLeft: "auto" }}
          onClick={() => setApresentando(true)}>
          <Presentation size={13} /> Apresentação de especificações
        </button>

        {podeEditar && aba === "produtos" && (
          <>
            <label className="cat-importar">
              <Upload size={13} /> Importar planilha
              <input type="file" accept=".xlsx,.xlsm,.pptx" style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0]; e.target.value = "";
                  if (f) setImportando(f);
                }} />
            </label>
            <button className="cat-novo" style={{ marginLeft: 0 }}
              onClick={() => setEditando({ verba: verba || "05", unidade: "un" })}>
              <Plus size={13} /> Novo produto
            </button>
          </>
        )}
      </div>

      {aba === "fornecedores" ? (
        <Fornecedores
          lista={fornecedores} setLista={setFornecedores} usuario={usuario}
          podeEditar={podeEditar} onErro={setErro}
          usoDe={(nome) => produtos.filter((p) => p.fornecedor === nome).length} />
      ) : (
        <>
          <div className="cat-filtros">
            {/* Produto e acabamento no MESMO lugar viram palheiro: 216
                amostras de MDF e tecido enterram as 74 pecas. */}
            <div className="cat-tipos">
              {TIPOS.map((t) => (
                <button key={t.id} className={tipoItem === t.id ? "on" : ""}
                  onClick={() => { setTipoItem(t.id); setVerba(""); setSubgrupo(""); }}
                  title={t.sub}>
                  {t.nome} <span>{quantos[t.id]}</span>
                </button>
              ))}
            </div>

            <label className="cat-busca">
              <Search size={14} className="dim" />
              <input value={termo} onChange={(e) => setTermo(e.target.value)}
                placeholder="nome, código, fornecedor…" />
              {termo && <button onClick={() => setTermo("")}><X size={13} /></button>}
            </label>

            <div className="cat-chips">
              <button className={!verba ? "on" : ""}
                onClick={() => { setVerba(""); setSubgrupo(""); }}>Todos</button>
              {verbas.map((v) => (
                <button key={v.num} className={verba === v.num ? "on" : ""}
                  onClick={() => { setVerba(v.num); setSubgrupo(""); }}>{v.nome}</button>
              ))}
            </div>

            {verba && subgruposDaVerba(verba).length > 0 && (
              <div className="cat-chips cat-chips-sub">
                <button className={!subgrupo ? "on" : ""} onClick={() => setSubgrupo("")}>todos</button>
                {subgruposDaVerba(verba).map((s) => (
                  <button key={s} className={subgrupo === s ? "on" : ""}
                    onClick={() => setSubgrupo(s)}>{s}</button>
                ))}
              </div>
            )}

            {fornecedores.length > 0 && (
              <select className="cat-sel" value={forn} onChange={(e) => setForn(e.target.value)}>
                <option value="">todos os fornecedores</option>
                {fornecedores.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
              </select>
            )}
          </div>

          {/* O que falta classificar vira fila de trabalho, e não um
              "Outros" onde some. */}
          {semSubgrupo > 0 && !termo && (
            <div className="cat-pendente">
              {semSubgrupo} {semSubgrupo === 1 ? "produto ainda sem subgrupo" : "produtos ainda sem subgrupo"} —
              eles aparecem no fim de cada grupo.
            </div>
          )}

          {carregando ? <div className="cat-vazio">Carregando o catálogo…</div>
            : achados.length === 0 ? (
              <div className="cat-vazio">
                {produtos.length === 0
                  ? "O catálogo está vazio. Cadastre um produto ou importe a planilha de padronização."
                  : "Nenhum produto com esse filtro."}
              </div>
            ) : prateleiras.map((pr) => (
              <div key={pr.verba} className="cat-verba">
                <div className="cat-verba-nome">{nomeVerba(pr.verba)}</div>
                {pr.subgrupos.map((sg) => (
                  <div key={sg.nome || "_"} className="cat-sub">
                    <div className="cat-sub-nome">
                      {sg.nome || <span className="cat-sem">sem subgrupo</span>}
                      <span className="cat-cont">{sg.itens.length}</span>
                    </div>
                    <div className="cat-grade">
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
              </div>
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

      {escolhidos.size > 0 && aba === "produtos" && (
        <BarraEscolha
          n={escolhidos.size}
          onLimpar={() => setEscolhidos(new Set())}
          onEnviar={() => setEnviando(true)} />
      )}

      {importando && (
        <ImportarPlanilha arquivo={importando} usuario={usuario} nomeVerba={nomeVerba} produtos={produtos}
          onFechar={() => setImportando(null)}
          onPronto={(novos, msg) => {
            setProdutos((l) => [...l, ...novos]);
            setImportando(null);
            setAviso(msg);
          }} />
      )}

      {enviando && (
        <EnviarParaObra
          produtos={produtos.filter((p) => escolhidos.has(p.id))}
          obras={obras} usuario={usuario} nomeVerba={nomeVerba}
          onFechar={() => setEnviando(false)}
          onPronto={(msg) => { setEnviando(false); setEscolhidos(new Set()); setAviso(msg); }} />
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

function Cartao({ p, escolhido, onEscolher, podeEditar, onEditar, onExcluir }) {
  const url = urlDaImagem(p.imagem);
  const velho = precoVelho(p.precoEm);
  return (
    <div className={`cat-card ${escolhido ? "on" : ""}`}>
      <button className="cat-foto" onClick={onEscolher} title="Escolher">
        {url ? <img src={url} alt="" loading="lazy" />
          : <span className="cat-sem-foto"><ImageIcon size={22} /></span>}
        <span className="cat-marca">{escolhido && <Check size={12} />}</span>
      </button>

      <div className="cat-corpo">
        <div className="cat-desc" title={p.descricao}>{p.descricao}</div>
        <div className="cat-linha">
          {p.fornecedor && <span className="cat-forn">{p.fornecedor}</span>}
          {p.codigo && <span className="mono cat-cod">{p.codigo}</span>}
        </div>
        {p.observacoes && <div className="cat-obs">{p.observacoes}</div>}
        <div className="cat-rodape">
          {ehAcabamento(p) ? <span className="cat-acab">acabamento</span>
            : p.precoRef != null
            ? <span className={`cat-preco ${velho ? "velho" : ""}`}>
                {fmt(p.precoRef)}
                {/* Preço a mão envelhece. Dizer de quando ele é custa uma
                    linha e evita orçar com número de dois anos atrás. */}
                {p.precoEm && <em>{velho ? `de ${mesesDesde(p.precoEm)} meses atrás` : "atualizado"}</em>}
              </span>
            : <span className="cat-sem-preco">sem preço</span>}
          {podeEditar && (
            <span className="cat-acoes">
              <button onClick={onEditar} title="Editar"><Pencil size={12} /></button>
              <button onClick={onExcluir} title="Tirar do catálogo"><Trash2 size={12} /></button>
            </span>
          )}
        </div>
      </div>
    </div>
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
    <div className="cat-modal" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="cat-caixa">
        <div className="cat-caixa-topo">
          <b>{p.id ? "Editar produto" : "Novo produto"}</b>
          <button onClick={onFechar}><X size={16} /></button>
        </div>

        <div className="cat-campos">
          {/* Duas descrições porque são dois leitores. A técnica precisa
              bastar pra comprar; a do criativo é o que o cliente lê na
              apresentação, e ali a ficha técnica atrapalha. Só a
              primeira é obrigatória: sem a segunda, a apresentação usa a
              primeira — feia, mas presente. */}
          <label className="cat-largo">Descrição — Executivo
            <textarea rows={2} value={f.descricao || ""}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="SPOT EMBUTIDO POWERUS 3 LEDS BRANCO 6W 3000K" />
            <small>a técnica, que vai pro Executivo da obra e pro Sienge</small>
          </label>

          {duplicatas.length > 0 && (
            <div className="cat-largo cat-duplicata">
              <AlertTriangle size={13} />
              <div>
                <b>Já existe {duplicatas.length === 1 ? "um produto" : `${duplicatas.length} produtos`} com essa descrição:</b>
                <ul>
                  {duplicatas.slice(0, 4).map((d) => (
                    <li key={d.id}>{d.fornecedor ? `${d.fornecedor} · ` : ""}{d.descricao}{d.codigo ? ` (${d.codigo})` : ""}</li>
                  ))}
                </ul>
                Salvar mesmo assim cria um segundo cadastro do mesmo item.
              </div>
            </div>
          )}

          <label className="cat-largo">Descrição — Criativo
            <input value={f.descricaoCriativo || ""}
              onChange={(e) => set("descricaoCriativo", e.target.value)}
              placeholder={f.descricao ? f.descricao.slice(0, 40) : "Spot embutido branco"} />
            <small>
              a curta, que o cliente lê na apresentação.
              {!String(f.descricaoCriativo || "").trim() && " Em branco, sai a de cima."}
            </small>
          </label>

          <label className="cat-largo">Descrição — inglês
            <input value={f.descricaoEn || ""}
              onChange={(e) => set("descricaoEn", e.target.value)}
              placeholder="Recessed white spotlight" />
            <small>só para apresentação emitida em inglês. Em branco, sai em português.</small>
          </label>

          <label>Tipo
            <select value={f.tipoItem || "produto"} onChange={(e) => set("tipoItem", e.target.value)}>
              {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome.replace(/s$/, "")}</option>)}
            </select>
            <small>{f.tipoItem === "acabamento"
              ? "cor e material — não vai pro orçamento da obra"
              : "peça que se compra e vira linha no Executivo"}</small>
          </label>

          <label>Grupo
            <select value={f.verba || ""} onChange={(e) => { set("verba", e.target.value); set("subgrupo", null); }}>
              {verbas.map((v) => <option key={v.num} value={v.num}>{v.nome}</option>)}
            </select>
          </label>

          <label>Subgrupo
            <input value={subEfetivo} list="cat-subs"
              onChange={(e) => set("subgrupo", e.target.value)}
              placeholder={sugerido || "sem subgrupo"} />
            <datalist id="cat-subs">
              {subgruposDaVerba(f.verba).map((s) => <option key={s} value={s} />)}
            </datalist>
            {sugerido && f.subgrupo == null && <small>sugerido pela descrição</small>}
          </label>

          <label>Fornecedor
            <input value={f.fornecedor || ""} list="cat-forns"
              onChange={(e) => set("fornecedor", e.target.value)} />
            <datalist id="cat-forns">
              {fornecedores.map((x) => <option key={x.id} value={x.nome} />)}
            </datalist>
          </label>

          <label>Código
            <input value={f.codigo || ""} onChange={(e) => set("codigo", e.target.value)}
              placeholder="6730" />
          </label>

          <label>Preço de referência
            <input value={f.precoTxt} onChange={(e) => set("precoTxt", e.target.value)}
              placeholder="0,00" inputMode="decimal" />
            {f.precoEm && <small>anotado em {new Date(`${f.precoEm}T12:00:00`).toLocaleDateString("pt-BR")}</small>}
          </label>

          <label>Unidade
            <input value={f.unidade || "un"} onChange={(e) => set("unidade", e.target.value)} />
          </label>

          <label className="cat-largo">Observações
            <input value={f.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)}
              placeholder="SEMPRE USAR ESCOVADO" />
          </label>

          <label className="cat-largo">Foto
            <div className="cat-foto-campo">
              {(arquivo || f.imagem) && (
                <div className="cat-foto-prev">
                  <img alt="" src={arquivo ? URL.createObjectURL(arquivo) : urlDaImagem(f.imagem)} />
                  <button type="button" className="cat-foto-x" title="Remover foto"
                    onClick={() => { setArquivo(null); set("imagem", null); }}>
                    <X size={13} />
                  </button>
                </div>
              )}
              <label className="cat-btn-arq">
                <Upload size={13} /> {f.imagem || arquivo ? "Trocar foto" : "Escolher foto"}
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
              </label>
            </div>
          </label>
        </div>

        <div className="cat-caixa-pe">
          <button className="cat-primario" disabled={salvando || !String(f.descricao || "").trim()}
            onClick={enviar}>{salvando ? "Salvando…" : "Salvar"}</button>
          <button onClick={onFechar}>cancelar</button>
        </div>
      </div>
    </div>
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
    if (!window.confirm(`Excluir ${f.nome}?`)) return;
    try {
      await excluirFornecedor(f.id);
      setLista((l) => l.filter((x) => x.id !== f.id));
    } catch (e) { onErro(mensagemDeErro(e)); }
  }

  return (
    <div className="cat-forns">
      {podeEditar && (
        <button className="cat-novo cat-novo-solto" onClick={() => setNovo({})}>
          <Plus size={13} /> Novo fornecedor
        </button>
      )}
      {lista.length === 0 && <div className="cat-vazio">Nenhum fornecedor cadastrado ainda.</div>}
      {lista.map((f) => (
        <div key={f.id} className="cat-forn-linha">
          <span className="cat-forn-icone"><Store size={14} /></span>
          <div className="cat-forn-id">
            <b>{f.nome}</b>
            <small>
              {[f.contato, f.telefone, f.email].filter(Boolean).join(" · ") || "sem contato cadastrado"}
            </small>
          </div>
          <span className="cat-forn-uso">{usoDe(f.nome)} no catálogo</span>
          {podeEditar && (
            <span className="cat-acoes">
              <button onClick={() => setNovo(f)}><Pencil size={12} /></button>
              <button onClick={() => remover(f)}><Trash2 size={12} /></button>
            </span>
          )}
        </div>
      ))}
      {novo && <FormFornecedor f={novo} onFechar={() => setNovo(null)} onSalvar={salvar} />}
    </div>
  );
}

function FormFornecedor({ f, onFechar, onSalvar }) {
  const [x, setX] = useState(f);
  const set = (k, v) => setX((o) => ({ ...o, [k]: v }));
  return (
    <div className="cat-modal" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="cat-caixa cat-caixa-fina">
        <div className="cat-caixa-topo">
          <b>{f.id ? "Editar fornecedor" : "Novo fornecedor"}</b>
          <button onClick={onFechar}><X size={16} /></button>
        </div>
        <div className="cat-campos">
          <label className="cat-largo">Nome
            <input value={x.nome || ""} onChange={(e) => set("nome", e.target.value)}
              placeholder="Nordecor" autoFocus /></label>
          <label>Contato
            <input value={x.contato || ""} onChange={(e) => set("contato", e.target.value)}
              placeholder="quem atende a gente" /></label>
          <label>Telefone
            <input value={x.telefone || ""} onChange={(e) => set("telefone", e.target.value)} /></label>
          <label>E-mail
            <input value={x.email || ""} onChange={(e) => set("email", e.target.value)} /></label>
          <label>Site
            <input value={x.site || ""} onChange={(e) => set("site", e.target.value)} /></label>
          <label className="cat-largo">Observações
            <input value={x.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)}
              placeholder="prazo de entrega, condição de pagamento…" /></label>
        </div>
        <div className="cat-caixa-pe">
          <button className="cat-primario" disabled={!String(x.nome || "").trim()}
            onClick={() => onSalvar(x)}>Salvar</button>
          <button onClick={onFechar}>cancelar</button>
        </div>
      </div>
    </div>
  );
}

function BarraEscolha({ n, onLimpar, onEnviar }) {
  return (
    <div className="cat-barra">
      <span><b>{n}</b> {n === 1 ? "produto escolhido" : "produtos escolhidos"}</span>
      <button className="cat-limpar" onClick={onLimpar}>limpar</button>
      <button className="cat-primario" onClick={onEnviar}>
        Enviar para uma obra <ArrowRight size={13} />
      </button>
    </div>
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
    <div className="cat-modal" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="cat-caixa">
        <div className="cat-caixa-topo">
          <b>Enviar {produtos.length} {produtos.length === 1 ? "produto" : "produtos"} para a obra</b>
          <button onClick={onFechar}><X size={16} /></button>
        </div>

        {erro && <div className="cat-erro"><AlertTriangle size={14} /> <span>{erro}</span></div>}

        <div className="cat-envio">
          <label className="cat-largo">Obra
            <select value={obra} onChange={(e) => setObra(e.target.value)} autoFocus>
              <option value="">escolha a obra…</option>
              {obras.map((o) => (
                <option key={o.codigo} value={o.codigo}>#{o.codigo} {o.nome}</option>
              ))}
            </select>
          </label>

          <div className="cat-envio-lista">
            {porVerba.map(([verba, ps]) => (
              <div key={verba}>
                <div className="cat-envio-verba">{nomeVerba(verba)}</div>
                {ps.map((p) => (
                  <div key={p.id} className="cat-envio-item">
                    <span className="cat-envio-desc">{p.descricao}</span>
                    <input className="cat-qtd" type="number" min="1" step="1"
                      value={qtds.get(p.id) || 1}
                      onChange={(e) => setQtds((m) => new Map(m).set(p.id, Number(e.target.value) || 1))} />
                    <span className="cat-envio-un">{p.unidade || "un"}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p className="cat-nota">
            As linhas entram no <b>Executivo</b> da obra, cada uma na sua verba. O Vendido
            não é tocado — ele é o que foi vendido ao cliente.
          </p>
        </div>

        <div className="cat-caixa-pe">
          <button className="cat-primario" disabled={!obra || indo} onClick={enviar}>
            {indo ? "Enviando…" : "Enviar para o Executivo"}
          </button>
          <button onClick={onFechar}>cancelar</button>
        </div>
      </div>
    </div>
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

  return (
    <div className="cat-modal">
      <div className="cat-caixa">
        <div className="cat-caixa-topo">
          <b>Importar planilha de padronização</b>
          <button onClick={onFechar}><X size={16} /></button>
        </div>

        {erro && <div className="cat-erro"><AlertTriangle size={14} /> <span>{erro}</span></div>}

        <div className="cat-envio">
          {lendo ? <div className="cat-vazio">Lendo a planilha…</div> : (
            <>
              <div className="cat-imp-placar">
                <div><b>{r.validos}</b><span>itens entram</span></div>
                {dePptx && <div><b>{r.produtos}</b><span>produtos</span></div>}
                {dePptx && <div><b>{r.acabamentos}</b><span>acabamentos</span></div>}
                <div><b>{r.comFoto}</b><span>com foto</span></div>
                <div><b>{r.fornecedores.length}</b><span>fornecedores</span></div>
                {r.semSubgrupo > 0 && <div><b>{r.semSubgrupo}</b><span>sem subgrupo</span></div>}
              </div>

              {/* Amostra costuma vir sem fornecedor: o título do slide nem
                  sempre nomeia a casa. Um campo só evita 100 edições. */}
              {r.semFornecedor > 0 && (
                <label className="cat-imp-forn">
                  {r.semFornecedor} {r.semFornecedor === 1 ? "item veio" : "itens vieram"} sem fornecedor — usar
                  <input value={fornPadrao} onChange={(e) => setFornPadrao(e.target.value)}
                    placeholder="ex: Bess Tecidos" />
                  <small>em branco, entram sem fornecedor e você preenche depois</small>
                </label>
              )}

              {r.gruposSemVerba.length > 0 && (
                <div className="cat-pendente">
                  <b>{r.total - r.validos} produtos ficam de fora.</b> Estes grupos não casaram com
                  nenhuma verba da EAP: {r.gruposSemVerba.join(", ")}. Renomeie o título do grupo na
                  planilha para o nome da verba e importe de novo.
                </div>
              )}

              {/* A regra dela: descrição repetida se avisa, e ela decide.
                  Repetido aqui é ou já estar no catálogo, ou aparecer
                  duas vezes dentro do próprio arquivo. */}
              {repetidos.length > 0 && (
                <div className="cat-duplicata cat-largo">
                  <AlertTriangle size={13} />
                  <div>
                    <b>{repetidos.length} {repetidos.length === 1 ? "já está" : "já estão"} no catálogo (ou repetido no próprio arquivo).</b>
                    <ul>
                      {repetidos.slice(0, 5).map((it, i) => <li key={i}>{it.descricao}</li>)}
                      {repetidos.length > 5 && <li>e mais {repetidos.length - 5}…</li>}
                    </ul>
                    <label className="cat-duplicata-opcao">
                      <input type="checkbox" checked={!pularRepetidos}
                        onChange={(e) => setPularRepetidos(!e.target.checked)} />
                      Importar mesmo assim (cria um segundo cadastro de cada um)
                    </label>
                  </div>
                </div>
              )}

              <div className="cat-envio-lista">
                {r.porGrupo.map(([g, n]) => (
                  <div key={g} className="cat-envio-item">
                    <span className="cat-envio-desc">{g}</span>
                    <span className="cat-envio-un">{n}</span>
                  </div>
                ))}
              </div>

              <p className="cat-nota">
                As fotos vêm de dentro do arquivo — elas não estão em célula nenhuma, estão
                ancoradas às linhas. Nada é sobrescrito: produtos repetidos com o mesmo código e
                fornecedor são recusados pelo banco.
              </p>
            </>
          )}
        </div>

        <div className="cat-caixa-pe">
          <button className="cat-primario"
            disabled={lendo || !(pularRepetidos ? unicos : itens).filter((p) => p.verba).length || !!gravando}
            onClick={gravar}>
            {gravando ? `Gravando ${gravando.feitos} de ${gravando.de}…`
              : `Importar ${(pularRepetidos ? unicos : itens).filter((p) => p.verba).length} produtos`}
          </button>
          <button onClick={onFechar}>cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* Estilo local. Fica junto do componente de propósito: o CSS do App.jsx
   é um template literal de 1.800 linhas onde uma crase perdida derruba o
   build — e derrubou, duas vezes. */
function EstiloCatalogo() {
  return <style>{`
    .cat { --card: #fff; }
    .cat-abas { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; }
    .cat-abas > button { background: none; border: 1px solid transparent; border-radius: 8px; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--ink-3); padding: 6px 12px; cursor: pointer; }
    .cat-abas > button:hover { color: var(--ink); }
    .cat-abas > button.on { background: var(--panel); border-color: var(--border); color: var(--ink); }
    .cat-cont { display: inline-block; margin-left: 6px; background: var(--panel); border-radius: 20px; padding: 1px 7px; font-size: 10.5px; color: var(--ink-3); }
    .cat-abas > button.on .cat-cont { background: #fff; }
    .cat-novo { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; background: var(--ink); color: #fff; border: none; border-radius: 8px; font-family: inherit; font-size: 12px; font-weight: 600; padding: 7px 13px; cursor: pointer; }
    .cat-novo-solto { margin: 0 0 12px; }

    .cat-filtros { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-bottom: 14px; }
    .cat-busca { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--border); border-radius: 9px; background: #fff; padding: 6px 10px; min-width: 260px; }
    .cat-busca input { border: none; outline: none; font-family: inherit; font-size: 12.5px; background: none; flex: 1; color: var(--ink); }
    .cat-busca > button { background: none; border: none; color: var(--ink-3); cursor: pointer; padding: 0; display: flex; }
    .cat-chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .cat-chips button { background: #fff; border: 1px solid var(--border); border-radius: 20px; font-family: inherit; font-size: 11px; font-weight: 500; color: var(--ink-2); padding: 4px 11px; cursor: pointer; }
    .cat-chips button:hover { border-color: var(--blue); }
    .cat-chips button.on { background: var(--ink); border-color: var(--ink); color: #fff; font-weight: 600; }
    .cat-chips-sub button.on { background: var(--blue); border-color: var(--blue); }
    .cat-sel { border: 1px solid var(--border); border-radius: 8px; background: #fff; font-family: inherit; font-size: 12px; color: var(--ink-2); padding: 6px 9px; }

    .cat-pendente { background: #FFFBEB; border: 1px solid #FDE68A; color: #78350F; border-radius: 9px; padding: 9px 13px; font-size: 12px; margin-bottom: 14px; }
    .cat-erro { display: flex; align-items: flex-start; gap: 8px; background: #FEF2F2; border: 1px solid #FECACA; color: #b91c1c; border-radius: 9px; padding: 10px 13px; font-size: 12.5px; margin-bottom: 12px; }
    .cat-ok { display: flex; align-items: center; gap: 8px; background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; border-radius: 9px; padding: 10px 13px; font-size: 12.5px; margin-bottom: 12px; }
    .cat-vazio { color: var(--ink-3); font-size: 12.5px; padding: 30px 0; }

    .cat-verba { margin-bottom: 22px; }
    .cat-verba-nome { font-size: 13px; font-weight: 700; color: var(--ink); padding-bottom: 6px; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
    .cat-sub { margin-bottom: 16px; }
    .cat-sub-nome { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 8px; }
    .cat-sem { font-style: italic; text-transform: none; letter-spacing: 0; }

    .cat-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 12px; }
    .cat-card { border: 1px solid var(--border); border-radius: 11px; background: var(--card); overflow: hidden; display: flex; flex-direction: column; }
    .cat-card.on { border-color: var(--blue); box-shadow: 0 0 0 2px var(--blue-bg); }
    .cat-foto { position: relative; display: block; width: 100%; aspect-ratio: 4 / 3; background: var(--panel); border: none; padding: 0; cursor: pointer; overflow: hidden; }
    .cat-foto img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .cat-sem-foto { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #C9C7C2; }
    .cat-marca { position: absolute; top: 7px; left: 7px; width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid #fff; background: rgba(255,255,255,.75); display: flex; align-items: center; justify-content: center; color: #fff; }
    .cat-card.on .cat-marca { background: var(--blue); border-color: var(--blue); }
    .cat-corpo { padding: 9px 11px 10px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .cat-desc { font-size: 12px; font-weight: 600; color: var(--ink); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .cat-linha { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .cat-forn { background: var(--blue-bg); color: var(--blue); border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 600; }
    .cat-cod { font-size: 10.5px; color: var(--ink-3); }
    .cat-obs { font-size: 10.5px; color: var(--ink-3); line-height: 1.4; }
    .cat-rodape { display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 6px; }
    .cat-preco { font-size: 12.5px; font-weight: 700; color: var(--ink); display: flex; flex-direction: column; line-height: 1.2; }
    .cat-preco em { font-style: normal; font-size: 9.5px; font-weight: 500; color: var(--ink-3); }
    .cat-preco.velho em { color: #B45309; }
    .cat-sem-preco { font-size: 11px; color: var(--ink-3); }
    .cat-acoes { margin-left: auto; display: flex; gap: 2px; }
    .cat-acoes button { background: none; border: none; color: var(--ink-3); cursor: pointer; padding: 3px; display: flex; border-radius: 5px; }
    .cat-acoes button:hover { background: var(--panel); color: var(--ink); }

    .cat-forn-linha { display: flex; align-items: center; gap: 11px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 10px 13px; margin-bottom: 7px; }
    .cat-forn-icone { color: var(--ink-3); display: flex; }
    .cat-forn-id { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .cat-forn-id b { font-size: 12.5px; color: var(--ink); }
    .cat-forn-id small { font-size: 11px; color: var(--ink-3); }
    .cat-forn-uso { font-size: 11px; color: var(--ink-3); }

    .cat-modal { position: fixed; inset: 0; z-index: 200; background: rgba(20,20,20,.35); display: flex; align-items: center; justify-content: center; padding: 24px; }
    .cat-caixa { background: #fff; border-radius: 14px; width: 100%; max-width: 660px; max-height: 88vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,.22); }
    .cat-caixa-fina { max-width: 480px; }
    .cat-caixa-topo { display: flex; align-items: center; justify-content: space-between; padding: 15px 18px; border-bottom: 1px solid var(--border); font-size: 13.5px; color: var(--ink); position: sticky; top: 0; background: #fff; }
    .cat-caixa-topo button { background: none; border: none; color: var(--ink-3); cursor: pointer; display: flex; }
    .cat-campos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px; padding: 16px 18px; }
    .cat-largo { grid-column: 1 / -1; }
    .cat-campos label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 600; color: var(--ink-2); }
    .cat-campos input, .cat-campos select, .cat-campos textarea { border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 12.5px; color: var(--ink); padding: 7px 9px; background: #fff; font-weight: 400; resize: vertical; }
    .cat-campos small { font-size: 10px; font-weight: 400; color: var(--ink-3); }
    .cat-foto-campo { display: flex; align-items: center; gap: 12px; }
    .cat-foto-prev { position: relative; width: 80px; height: 62px; }
    .cat-foto-prev img { width: 80px; height: 62px; object-fit: contain; background: var(--panel); border-radius: 7px; }
    .cat-foto-x { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 50%; background: #B91C1C; color: #fff; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
    .cat-foto-x:hover { background: #991B1B; }
    .cat-btn-arq { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px; font-size: 12px; cursor: pointer; }
    .cat-duplicata { display: flex; gap: 9px; background: #FFFBEB; border: 1px solid #FDE68A; color: #78350F; border-radius: 9px; padding: 10px 12px; font-size: 11.5px; line-height: 1.5; }
    .cat-duplicata svg { flex-shrink: 0; margin-top: 1px; }
    .cat-duplicata b { display: block; font-weight: 700; margin-bottom: 3px; }
    .cat-duplicata ul { margin: 2px 0 4px; padding-left: 16px; }
    .cat-duplicata-opcao { display: flex; align-items: center; gap: 6px; font-weight: 600; cursor: pointer; margin-top: 4px; }
    .cat-caixa-pe { display: flex; align-items: center; gap: 10px; padding: 13px 18px; border-top: 1px solid var(--border); position: sticky; bottom: 0; background: #fff; }
    .cat-caixa-pe button { background: none; border: none; font-family: inherit; font-size: 12px; color: var(--ink-3); cursor: pointer; }
    .cat-primario { background: var(--ink) !important; color: #fff !important; border-radius: 8px !important; font-weight: 600 !important; padding: 8px 15px !important; display: inline-flex; align-items: center; gap: 6px; }
    .cat-primario:disabled { opacity: .45; cursor: default; }

    .cat-barra { position: sticky; bottom: 14px; margin-top: 18px; display: flex; align-items: center; gap: 12px; background: var(--ink); color: #fff; border-radius: 11px; padding: 11px 15px; font-size: 12.5px; box-shadow: 0 10px 28px rgba(0,0,0,.2); }
    .cat-barra .cat-primario { background: #fff !important; color: var(--ink) !important; }
    .cat-limpar { margin-left: auto; background: none; border: none; font-family: inherit; font-size: 11.5px; color: rgba(255,255,255,.7); text-decoration: underline; cursor: pointer; }

    .cat-envio { padding: 16px 18px; }
    .cat-envio label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 600; color: var(--ink-2); margin-bottom: 14px; }
    .cat-envio select { border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 12.5px; padding: 8px 9px; }
    .cat-envio-lista { border: 1px solid var(--border); border-radius: 10px; max-height: 260px; overflow: auto; }
    .cat-envio-verba { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-3); background: var(--panel); padding: 6px 12px; }
    .cat-envio-item { display: flex; align-items: center; gap: 10px; padding: 7px 12px; font-size: 12px; border-top: 1px solid var(--border); }
    .cat-envio-desc { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); }
    .cat-qtd { width: 62px; border: 1px solid var(--border); border-radius: 7px; font-family: inherit; font-size: 12px; padding: 4px 7px; text-align: right; }
    .cat-envio-un { font-size: 11px; color: var(--ink-3); width: 26px; }
    .cat-apresentar { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 8px; background: #fff; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--ink-2); padding: 6px 12px; cursor: pointer; }
    .cat-apresentar:hover { border-color: var(--blue); color: var(--ink); }
    .cat-tipos { display: inline-flex; border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
    .cat-tipos button { background: none; border: none; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--ink-3); padding: 7px 14px; cursor: pointer; }
    .cat-tipos button + button { border-left: 1px solid var(--border); }
    .cat-tipos button:hover { color: var(--ink); background: var(--panel); }
    .cat-tipos button.on { background: var(--ink); color: #fff; }
    .cat-tipos span { opacity: .6; margin-left: 4px; font-weight: 500; }
    .cat-acab { font-size: 10.5px; font-weight: 600; color: var(--ink-2); background: var(--panel); border-radius: 4px; padding: 2px 7px; }
    .cat-importar { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 8px; background: #fff; font-size: 12px; font-weight: 600; color: var(--ink-2); padding: 6px 12px; cursor: pointer; }
    .cat-importar:hover { border-color: var(--blue); color: var(--ink); }
    .cat-imp-placar { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .cat-imp-placar > div { border: 1px solid var(--border); border-radius: 9px; padding: 9px 11px; display: flex; flex-direction: column; }
    .cat-imp-forn { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-2); background: var(--panel); border-radius: 9px; padding: 10px 12px; margin-bottom: 14px; }
    .cat-imp-forn input { border: 1px solid var(--border); border-radius: 7px; font-family: inherit; font-size: 12px; padding: 5px 8px; background: #fff; }
    .cat-imp-forn small { width: 100%; font-size: 10.5px; color: var(--ink-3); }
    .cat-imp-placar b { font-size: 19px; color: var(--ink); line-height: 1.1; }
    .cat-imp-placar span { font-size: 10.5px; color: var(--ink-3); }
    .cat-nota { font-size: 11.5px; color: var(--ink-3); line-height: 1.5; margin: 12px 0 0; }
  `}</style>;
}
