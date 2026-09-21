import { useEffect, useId, useState } from "react";
import { Button, Collapsible, CollapsibleTrigger, CollapsibleContent, KpiMini, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@group-ws/ws-ui";
import { ChevronDown, ChevronRight } from "lucide-react";

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
   porque a EAP inteira aparece sempre. Substitui o `.vend-head`/`.grp-head`. */
export function Colapsavel({ aberto, onAbrir, podeAbrir = true, cabecalho, acoes, className = "", children }) {
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
      {acoes ? (
        <div className="flex flex-wrap items-center">
          <div className="min-w-0 flex-1 basis-64">{gatilho}</div>
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-3 sm:py-2">{acoes}</div>
        </div>
      ) : gatilho}
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
