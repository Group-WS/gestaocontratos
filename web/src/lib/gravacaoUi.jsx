import React, { useEffect, useState } from "react";
import { Alert, AlertTitle, AlertDescription, Button, cn } from "@group-ws/ws-ui";
import { RotateCcw, RefreshCw, ArrowRight } from "lucide-react";
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

const TOM_DO_TEXTO = { mute: "text-text-mute", warning: "text-warning", danger: "text-danger" };

export function SituacaoDaGravacao({ situacao, onTentarAgora }) {
  const agora = useAgora(situacao?.estado === "erro");
  const resumo = resumoDaGravacao(situacao, agora);
  if (!resumo) return null;
  return (
    <span className="flex items-center gap-2">
      <span className={cn("text-xs", TOM_DO_TEXTO[resumo.tom])} role="status">{resumo.texto}</span>
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
