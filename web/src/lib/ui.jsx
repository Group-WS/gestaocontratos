import { useEffect, useId, useState } from "react";
import { Badge, Button, Collapsible, CollapsibleTrigger, CollapsibleContent, KpiMini, Label, Progress, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@group-ws/ws-ui";
import { Check, ChevronDown, ChevronRight } from "lucide-react";

/* Breakpoint `lg` do Tailwind: acima dele a barra lateral fica fixa na
   tela; abaixo, ela abre num Sheet pelo botão de menu do topo. */
export const LARGO = "(min-width: 1024px)";

/* Verdadeiro enquanto a media query casa. Serve pra montar UMA das duas
   cascas (barra fixa ou Sheet) — nunca as duas ao mesmo tempo, senão os
   popovers e as refs de dentro dobram. */
export function useMediaQuery(query) {
  const [casa, setCasa] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const ouvir = () => setCasa(mq.matches);
    ouvir();
    mq.addEventListener("change", ouvir);
    return () => mq.removeEventListener("change", ouvir);
  }, [query]);
  return casa;
}

/* Contador pequeno e redondo, pra pendurar num ícone ou no fim de uma
   linha (alertas da obra, pendências da equipe, obras finalizadas). */
export function Contador({ tom = "brand", className = "", children }) {
  const cor = { brand: "bg-brand text-bg", danger: "bg-danger text-bg", warning: "bg-warning text-bg", neutral: "bg-surface-4 text-text-soft" }[tom] || "bg-brand text-bg";
  return (
    <span className={`flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-xs font-semibold leading-none ${cor} ${className}`}>
      {children}
    </span>
  );
}

/* Escolha única num Select do DS, com o rótulo em cima — o mesmo desenho
   do `Choice` do Dashboard, só que as opções vêm prontas ({ value, label })
   e não há "Todas" implícito. Substitui o <select className="form-select">. */
export function Choice({ label, value, opcoes, onChange, placeholder, required, disabled, className = "" }) {
  const id = useId();
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <Label htmlFor={id} required={required}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={label}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/* Grupo que abre e fecha (uma verba da EAP, um bloco de alertas): o
   cabecalho inteiro e' o gatilho, com a seta na frente, e o conteudo so'
   monta quando aberto. `podeAbrir` falso deixa o cabecalho parado, sem
   seta — grupo sem item nao tem o que mostrar, mas continua na lista
   porque a EAP inteira aparece sempre. Substitui o `.vend-head`/`.grp-head`.

   `antes` fica A ESQUERDA do gatilho (o check que seleciona a verba
   inteira) e `fixo` fica ENTRE o cabecalho e o conteudo, sempre visivel
   (as observacoes da verba) — os dois fora do botao, pelo mesmo motivo
   das `acoes`: controle dentro de botao e' HTML invalido e o clique
   abriria o grupo junto. */
export function Colapsavel({ aberto, onAbrir, podeAbrir = true, cabecalho, antes, acoes, fixo, className = "", children }) {
  const abertoDeFato = !!aberto && podeAbrir;
  const gatilho = (
    <CollapsibleTrigger asChild>
      <Button variant="ghost" aria-disabled={!podeAbrir}
        className={`h-auto w-full justify-start gap-2 rounded-none px-4 py-3 text-left font-normal whitespace-normal ${podeAbrir ? "" : "cursor-default hover:bg-transparent"}`}>
        {podeAbrir
          ? (abertoDeFato ? <ChevronDown size={16} className="shrink-0 text-text-mute" /> : <ChevronRight size={16} className="shrink-0 text-text-mute" />)
          : <span className="w-4 shrink-0" aria-hidden="true" />}
        {cabecalho}
      </Button>
    </CollapsibleTrigger>
  );
  return (
    <Collapsible open={abertoDeFato} onOpenChange={(v) => { if (podeAbrir && onAbrir) onAbrir(v); }}
      className={`border-b border-line-1 last:border-b-0 ${className}`}>
      {/* `acoes` (botoes de "aprovar a verba inteira", por exemplo) ficam AO
          LADO do gatilho, nunca dentro: botao dentro de botao e' HTML
          invalido e o clique na acao abriria o grupo junto. No celular a
          faixa de acoes desce pra baixo do cabecalho. */}
      {acoes || antes ? (
        <div className="flex flex-wrap items-center">
          {antes && <div className="flex shrink-0 items-center pl-4">{antes}</div>}
          <div className="min-w-0 flex-1 basis-64">{gatilho}</div>
          {acoes && <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-3 sm:py-2">{acoes}</div>}
        </div>
      ) : gatilho}
      {fixo}
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

/* Cor legada (`var(--green)`, `var(--alert)`…) → tom semantico do DS. Os
   metadados de status do app ainda carregam a cor como string; o KpiMini e
   o Badge querem um `tone`. Cor desconhecida cai em `neutral`. */
export function tomDaCor(cor) {
  return {
    "var(--green)": "success", "var(--success)": "success",
    "var(--brand)": "brand", "var(--blue)": "brand",
    "var(--alert)": "warning", "var(--amber)": "warning", "var(--warning)": "warning",
    "var(--red)": "danger", "var(--danger)": "danger",
  }[cor] || "neutral";
}

/* KpiMini que filtra: o cartao inteiro e' um botao de alternancia
   (`aria-pressed`), com o anel da marca quando o filtro esta' ligado.
   Substitui o `.conf-stat` (cartao-estatistica clicavel). */
export function KpiBotao({ ativo, onClick, label, value, hint, tone = "neutral", title, className = "" }) {
  return (
    <Button variant="ghost" type="button" aria-pressed={!!ativo} title={title} onClick={onClick}
      className={`block h-auto w-full rounded-lg p-0 text-left font-normal whitespace-normal ${ativo ? "ring-2 ring-brand" : ""} ${className}`}>
      <KpiMini label={label} value={String(value)} hint={hint} tone={tone} className="w-full" />
    </Button>
  );
}

/* Estado de um item (solicitado, comprado) com a acao que o muda logo
   abaixo: o estado e' um Badge, que nunca e' clicavel; a acao e' um Button
   pequeno ("solicitar" quando falta, "desfazer" quando ja' esta' feito).
   Substitui o `.pill-btn`, que era selo e botao ao mesmo tempo. `disabled`
   trava so' a acao (modo leitura, pre-requisito nao cumprido); o selo
   continua contando o estado. */
export function EstadoAcao({ feito, rotuloFeito, rotuloPendente = "pendente", acao, desfazer = "desfazer", disabled, onClick, title, tone = "success", className = "" }) {
  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <Badge tone={feito ? tone : "neutral"} title={title}>
        {feito && <Check size={12} />}{feito ? rotuloFeito : rotuloPendente}
      </Badge>
      <Button variant="ghost" size="sm" type="button" disabled={disabled} onClick={onClick} title={title}>
        {feito ? desfazer : acao}
      </Button>
    </div>
  );
}

/* Rotulo de secao dentro de um dialog ou card: mono, caixa alta, discreto
   (classe `label-mono` do DS). `conta` e' o complemento em texto normal
   ao lado ("12 linhas selecionadas"). Substitui o `.sol-secao-rotulo`. */
export function SecaoRotulo({ conta, className = "", children }) {
  return (
    <h2 className={`flex flex-wrap items-baseline gap-2 ${className}`}>
      <span className="label-mono">{children}</span>
      {conta && <span className="text-xs font-normal normal-case tracking-normal text-text-mute">{conta}</span>}
    </h2>
  );
}

/* KpiMini com a barra de avanco embaixo: o numero grande e' o que FALTA
   (a comprar, a contratar) e a barra diz quanto do total ja' foi feito.
   Substitui o `.gc-total` do painel de compras. */
export function KpiProgresso({ label, value, hint, tone = "neutral", pct = 0, rotuloBarra, className = "" }) {
  const cheio = Math.min(100, Math.max(0, pct));
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <KpiMini label={label} value={value} hint={hint} tone={tone} className="w-full" />
      <Progress value={cheio} aria-label={rotuloBarra || label} />
    </div>
  );
}
