import React, { useEffect, useState } from "react";
import { Badge, Button } from "@group-ws/ws-ui";
import { RotateCcw, Clock, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { resumoDaGravacao, avisoDaGravacao } from "./gravacaoObra";
import { avisar } from "./confirmar.jsx";

/* O QUE A TELA DIZ SOBRE A GRAVAÇÃO DA OBRA.
 *
 * Os textos moram em gravacaoObra.js (puros, testados); aqui é só o desenho,
 * com os componentes do design system. Duas peças:
 *   - SituacaoDaGravacao: a palavra curta na barra da obra ("salvando…",
 *     "salvo", "não salvo — nova tentativa em 8 s");
 *   - AvisosDeGravacao: o aviso flutuante com explicação e saída, em
 *     qualquer tela, para cada obra que tem trabalho sem gravar.
 */

/* O relógio que anda de segundo em segundo, só enquanto há contagem na tela
   ("nova tentativa em 8 s"). Sem contagem, nenhum intervalo fica rodando. */
function useAgora(ativo) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return undefined;
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ativo]);
  return agora;
}

/* O SELO DA GRAVAÇÃO (23/09/2026): a palavra cinza ("salvo", "salvando…")
   passava despercebida, e quem editava não sabia se o que fez já estava
   guardado. Agora é um Badge do DS com ícone e cor por estado — e o "salvo"
   diz a hora. O texto continua vindo de resumoDaGravacao (testado). */
const SELO_DO_ESTADO = {
  pendente: { tom: "neutral", Icone: Clock },
  salvando: { tom: "brand", Icone: Loader2, gira: true },
  salvo: { tom: "success", Icone: CheckCircle2 },
  erro: { tom: "warning", Icone: AlertTriangle },
  recusado: { tom: "danger", Icone: XCircle },
  conflito: { tom: "danger", Icone: XCircle },
};
const primeiraMaiuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const horaDe = (em) => {
  const d = new Date(em);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
};

/* Na faixa da edição (`discreta`) a gravação é texto com ícone, sem selo:
   ao lado do selo do estado, um segundo selo era "muitos selos juntos". Só
   recusa e conflito continuam selo, porque só elas pedem uma decisão. */
const TOM_DO_TEXTO = {
  pendente: "text-text-mute", salvando: "text-text-soft", salvo: "text-text-soft", erro: "text-warning",
};
const COR_DO_ICONE = {
  pendente: "text-text-mute", salvando: "text-brand", salvo: "text-success", erro: "text-warning",
};

export function SituacaoDaGravacao({ situacao, onTentarAgora, discreta = false }) {
  const agora = useAgora(situacao?.estado === "erro");
  const resumo = resumoDaGravacao(situacao, agora);
  if (!resumo) return null;
  const estado = situacao?.estado;
  const selo = SELO_DO_ESTADO[estado] || { tom: "neutral", Icone: Clock };
  const hora = estado === "salvo" ? horaDe(situacao.em) : null;
  const texto = hora ? `Salvo às ${hora}` : primeiraMaiuscula(resumo.texto);
  const icone = <selo.Icone size={discreta ? 14 : 12} aria-hidden="true"
    className={[selo.gira && "animate-spin motion-reduce:animate-none", discreta && (COR_DO_ICONE[estado] || "text-text-mute")].filter(Boolean).join(" ") || undefined} />;
  const comoTexto = discreta && estado in TOM_DO_TEXTO;
  return (
    <span className="flex items-center gap-2">
      <span role="status" aria-live="polite">
        {comoTexto ? (
          <span className={`flex items-center gap-1 text-sm ${TOM_DO_TEXTO[estado]}`}>{icone}{texto}</span>
        ) : (
          <Badge tone={selo.tom}>{icone}{texto}</Badge>
        )}
      </span>
      {situacao?.estado === "erro" && onTentarAgora && (
        <Button size="sm" variant="ghost" onClick={onTentarAgora}>
          <RotateCcw size={14} aria-hidden="true" /> Tentar agora
        </Button>
      )}
    </span>
  );
}

/**
 * Um aviso por obra com trabalho sem gravar. A falha temporária da obra que
 * está sendo editada na tela fica só na barra dela (lá já tem a contagem e o
 * "Tentar agora"); recusa e conflito sempre avisam, porque pedem uma decisão.
 *
 * O aviso é flutuante (toast), não um bloco no topo: o bloco empurrava a
 * obra para baixo e ficava longe de onde a pessoa estava mexendo (pedido de
 * 25/09/2026). Fica aberto até a gravação se resolver ou a pessoa fechar.
 */
export function AvisosDeGravacao({ gravacoes, nomeDaObra, codigoEmEdicao, codigoAberto, onTentarAgora, onRecarregar, onAbrir }) {
  const temContagem = [...(gravacoes?.values() || [])].some((s) => s?.estado === "erro");
  const agora = useAgora(temContagem);
  const avisos = [...(gravacoes?.entries() || [])]
    .filter(([codigo, s]) => !(s?.estado === "erro" && codigo === codigoEmEdicao))
    .map(([codigo, s]) => ({ codigo, aviso: avisoDaGravacao(s, { obra: nomeDaObra(codigo), agora }) }))
    .filter((x) => x.aviso);
  const chave = avisos.map(({ codigo, aviso }) => `${codigo}\u0000${aviso.titulo}\u0000${aviso.descricao}`).join("\u0001");

  const [abertos, setAbertos] = useState(() => new Set());
  useEffect(() => {
    const agoraAbertos = new Set();
    for (const { codigo, aviso } of avisos) {
      const id = `gravacao-${codigo}`;
      agoraAbertos.add(id);
      const acao = aviso.acao === "tentar"
        ? { rotulo: "Tentar agora", aoClicar: () => onTentarAgora(codigo) }
        : aviso.acao === "recarregar"
          ? { rotulo: "Recarregar a obra", aoClicar: () => onRecarregar(codigo) }
          : null;
      const secundaria = codigo !== codigoAberto && onAbrir
        ? { rotulo: "Abrir a obra", aoClicar: () => onAbrir(codigo) }
        : null;
      const mostrar = aviso.tom === "danger" ? avisar.erro : avisar.alerta;
      mostrar(aviso.titulo, aviso.descricao, { id, duracao: Infinity, acao, secundaria });
    }
    abertos.forEach((id) => { if (!agoraAbertos.has(id)) avisar.fechar(id); });
    setAbertos(agoraAbertos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, codigoAberto]);
  return null;
}
