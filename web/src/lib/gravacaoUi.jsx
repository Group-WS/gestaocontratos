import React, { useEffect, useState } from "react";
import { Alert, AlertTitle, AlertDescription, Badge, Button } from "@group-ws/ws-ui";
import { RotateCcw, RefreshCw, ArrowRight, Clock, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { resumoDaGravacao, avisoDaGravacao } from "./gravacaoObra";

/* O QUE A TELA DIZ SOBRE A GRAVAÇÃO DA OBRA.
 *
 * Os textos moram em gravacaoObra.js (puros, testados); aqui é só o desenho,
 * com os componentes do design system. Duas peças:
 *   - SituacaoDaGravacao: a palavra curta na barra da obra ("salvando…",
 *     "salvo", "não salvo — nova tentativa em 8 s");
 *   - AvisosDeGravacao: o aviso com explicação e saída, no topo de qualquer
 *     tela, para cada obra que tem trabalho sem gravar.
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

export function SituacaoDaGravacao({ situacao, onTentarAgora }) {
  const agora = useAgora(situacao?.estado === "erro");
  const resumo = resumoDaGravacao(situacao, agora);
  if (!resumo) return null;
  const selo = SELO_DO_ESTADO[situacao?.estado] || { tom: "neutral", Icone: Clock };
  const hora = situacao?.estado === "salvo" ? horaDe(situacao.em) : null;
  const texto = hora ? `Salvo às ${hora}` : primeiraMaiuscula(resumo.texto);
  return (
    <span className="flex items-center gap-2">
      <span role="status" aria-live="polite">
        <Badge tone={selo.tom}>
          <selo.Icone size={12} aria-hidden="true" className={selo.gira ? "animate-spin motion-reduce:animate-none" : undefined} />
          {texto}
        </Badge>
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
 * "Tentar agora"); recusa e conflito sempre aparecem aqui, porque pedem uma
 * decisão e precisam de espaço para dizer qual.
 */
export function AvisosDeGravacao({ gravacoes, nomeDaObra, codigoEmEdicao, codigoAberto, onTentarAgora, onRecarregar, onAbrir }) {
  const temContagem = [...(gravacoes?.values() || [])].some((s) => s?.estado === "erro");
  const agora = useAgora(temContagem);
  const avisos = [...(gravacoes?.entries() || [])]
    .filter(([codigo, s]) => !(s?.estado === "erro" && codigo === codigoEmEdicao))
    .map(([codigo, s]) => ({ codigo, aviso: avisoDaGravacao(s, { obra: nomeDaObra(codigo), agora }) }))
    .filter((x) => x.aviso);
  if (!avisos.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {avisos.map(({ codigo, aviso }) => (
        <Alert key={codigo} tone={aviso.tom}>
          <AlertTitle as="h2">{aviso.titulo}</AlertTitle>
          <AlertDescription>
            <p>{aviso.descricao}</p>
            <span className="mt-2 flex flex-wrap gap-2">
              {aviso.acao === "tentar" && (
                <Button size="sm" variant="outline" onClick={() => onTentarAgora(codigo)}>
                  <RotateCcw size={14} aria-hidden="true" /> Tentar agora
                </Button>
              )}
              {aviso.acao === "recarregar" && (
                <Button size="sm" variant="outline" onClick={() => onRecarregar(codigo)}>
                  <RefreshCw size={14} aria-hidden="true" /> Recarregar a obra
                </Button>
              )}
              {codigo !== codigoAberto && onAbrir && (
                <Button size="sm" variant="ghost" onClick={() => onAbrir(codigo)}>
                  Abrir a obra <ArrowRight size={14} aria-hidden="true" />
                </Button>
              )}
            </span>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
