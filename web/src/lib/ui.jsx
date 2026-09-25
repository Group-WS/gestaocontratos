import React, { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge, Button, Collapsible, CollapsibleTrigger, CollapsibleContent, KpiMini, Label, Progress, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
  DateField, Popover, PopoverTrigger, PopoverContent, Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@group-ws/ws-ui";
import { Building2, Check, ChevronDown, ChevronRight, ChevronsUpDown, Info, Undo2 } from "lucide-react";

/* CAMPO DE DATA DO DS, controlado.

   O `DateField` do design system (calendário em pt-BR, dd/MM/aaaa, botão de
   limpar) só fala com react-hook-form. O app guarda datas em estado comum,
   como string "aaaa-mm-dd" — a mesma que o campo de data nativo devolvia.
   Este wrapper dá ao DateField um formulário de um campo só e devolve a
   string pelo `onChange`, então quem usa troca o input nativo sem mudar a
   lógica: `onChange` recebe "aaaa-mm-dd" ou "" quando a data é limpa.

   Só a mudança feita pela pessoa sobe (type "change"); a vinda de fora
   (`valor` novo) só atualiza o campo, sem disparar `onChange` de volta. */
export function CampoData({ valor, onChange, disabled, placeholder = "dd/mm/aaaa", className = "", minDate, maxDate, clearable = true }) {
  const { control, setValue, watch } = useForm({ defaultValues: { data: valor || null } });
  const aoMudar = useRef(onChange);
  aoMudar.current = onChange;
  useEffect(() => { setValue("data", valor || null); }, [valor, setValue]);
  useEffect(() => {
    const assinatura = watch((v, { name, type }) => {
      if (name === "data" && type === "change") aoMudar.current?.(v.data || "");
    });
    return () => assinatura.unsubscribe();
  }, [watch]);
  return (
    <DateField control={control} name="data" placeholder={placeholder} disabled={disabled}
      className={className} minDate={minDate} maxDate={maxDate} clearable={clearable} />
  );
}

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
   e não há "Todas" implícito. Substitui o seletor nativo com classe form-select. */
/* O seletor de arquivo do sistema, escondido. Quem aparece é o Button do DS:
   ou ele chama `ref.current.click()`, ou envolve isto num <label> via asChild.
   O FileInput do DS é uma dropzone (outro gesto, outra área de tela), então o
   botão "Anexar" do padrão de upload precisa deste input — e ele mora só aqui. */
export function SeletorDeArquivo({ ref, accept, disabled, onChange, multiple }) {
  // gate-allow DS-07: o DS não tem seletor de arquivo em botão; input sr-only é a exceção do padrão de upload
  return <input ref={ref} type="file" accept={accept} disabled={disabled} multiple={multiple} className="sr-only" onChange={onChange} />;
}

/* BOTAO SO' DE ICONE, sempre com nome que se le' (21/09/2026). Um icone
   sozinho nao diz o que faz: o `rotulo` e' obrigatorio, vira o aria-label
   (leitor de tela) e o Tooltip do DS (mouse e teclado). O tamanho do icone
   acompanha o tamanho do botao pelo proprio Button do DS. */
export function BotaoIcone({ rotulo, lado = "top", children, ...props }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" {...props} aria-label={rotulo}>{children}</Button>
        </TooltipTrigger>
        <TooltipContent side={lado}>{rotulo}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* A REGRA NUM ÍCONE, e não num parágrafo (22/09/2026).

   Explicação escrita por extenso ao lado de cada campo deixava o painel
   "poluído com texto" — e quem já sabe a regra tinha de ler em volta dela
   todas as vezes. O ⓘ fica discreto; quem quer saber passa o mouse ou foca
   pelo teclado (é um botão, então o Tab chega nele), e o leitor de tela lê
   o `rotulo`. */
export function DicaInfo({ rotulo = "Saiba mais", lado = "top", children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" type="button" aria-label={rotulo}
          className="h-6 w-6 shrink-0 text-text-mute">
          <Info size={14} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={lado} className="max-w-xs whitespace-normal text-left normal-case tracking-normal">{children}</TooltipContent>
    </Tooltip>
  );
}

/* BOTÃO TRAVADO DIZ POR QUÊ (23/09/2026).

   O motivo de um botão desabilitado morava no `title` — e o navegador não
   mostra `title` de botão desabilitado (ele não recebe o hover). Este botão
   é o Button do DS com uma diferença: desabilitado e com `title`, o texto
   vira um Tooltip do DS preso a um invólucro que recebe hover e foco, com o
   cadeado de "por que não dá". Habilitado, é o Button de sempre. */
export const BotaoComMotivo = React.forwardRef(function BotaoComMotivo({ disabled, title, children, ...props }, ref) {
  if (!disabled || !title) {
    return <Button ref={ref} disabled={disabled} title={title || undefined} {...props}>{children}</Button>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex cursor-help rounded-lg" aria-label={`Indisponível: ${title}`}>
          <Button ref={ref} disabled {...props}>{children}</Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-normal text-left normal-case tracking-normal">
        <span className="flex flex-col gap-1">
          <b>Por que não dá</b>
          <span>{primeiraMaiuscula(title)}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
});
const primeiraMaiuscula = (t) => (typeof t === "string" && t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/* ESCOLHER UMA PESSOA, com busca (padrao Combobox do DS: Popover +
   Command). Com 40 nomes, uma lista sem busca obrigava a rolar ate' achar;
   aqui se digita parte do nome ou do cargo. A lista abre POR CIMA da tela,
   no tamanho dela — nao empurra o card nem cria rolagem lateral.
   `pessoas`: [{ email, nome, cargo, ativo }]. `sugerido(p)`: quem vem no
   grupo de cima (o cargo do papel). `vazio`: o texto da opcao de ninguem. */
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/* `compacto`: o nome e' o proprio gatilho (botao ghost, texto do tamanho do
   valor ao redor, so' o nome) — para trocar a pessoa no meio de uma faixa de
   fatos sem virar um campo de formulario. */
/* `pequeno`: dentro de linha de tabela, o gatilho vai no tamanho sm (h-8). */
export function EscolhaPessoa({ id, valor, pessoas, onChange, sugerido, vazio = "Ninguém", rotulo = "Escolher pessoa", disabled, compacto = false, pequeno = false }) {
  const [aberto, setAberto] = useState(false);
  const atual = pessoas.find((p) => p.email === valor);
  const linha = (p) => (
    <CommandItem key={p.email} value={`${p.nome} ${p.cargo || ""}`} onSelect={() => { onChange(p.email); setAberto(false); }}>
      <Check size={14} className={valor === p.email ? "opacity-100" : "opacity-0"} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{p.nome}</span>
      {p.cargo && <span className="shrink-0 text-xs text-text-mute">{p.cargo}{p.ativo === false ? " · inativo" : ""}</span>}
    </CommandItem>
  );
  const sugeridos = sugerido ? pessoas.filter(sugerido) : [];
  const demais = sugerido ? pessoas.filter((p) => !sugerido(p)) : pessoas;
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button id={id} variant={compacto ? "ghost" : "outline"} role="combobox" aria-expanded={aberto} aria-label={rotulo} disabled={disabled}
          className={compacto
            ? "h-auto w-full min-w-0 justify-start gap-1 px-1 py-0 -ml-1 text-left text-sm font-semibold leading-snug"
            : `w-full min-w-0 justify-between gap-2 font-normal${pequeno ? " h-8" : ""}`}>
          <span className={atual ? "min-w-0 truncate" : `min-w-0 truncate text-text-mute${compacto ? " font-normal italic" : ""}`}>
            {atual ? (compacto ? atual.nome : `${atual.nome}${atual.cargo ? ` · ${atual.cargo}` : ""}`) : vazio}
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-text-mute" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {/* Busca por TRECHO, sem acento: o filtro padrao do Command e'
            aproximado, e "bru" trazia "Gabriel Diniz" (b..r..u espalhados). */}
        <Command filter={(texto, busca) => (semAcento(texto).includes(semAcento(busca)) ? 1 : 0)}>
          <CommandInput placeholder="Buscar pessoa ou cargo…" />
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty>Ninguém com esse nome.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__ninguem__" onSelect={() => { onChange(""); setAberto(false); }}>
                <Check size={14} className={!valor ? "opacity-100" : "opacity-0"} aria-hidden="true" />
                <span className="italic text-text-mute">{vazio}</span>
              </CommandItem>
            </CommandGroup>
            {sugeridos.length > 0 && <CommandGroup heading="Sugeridos">{sugeridos.map(linha)}</CommandGroup>}
            <CommandGroup heading={sugeridos.length ? "Demais pessoas" : "Pessoas"}>{demais.map(linha)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* `rotuloVisivel` falso: dentro de barra de ferramentas o rotulo fica so'
   para leitor de tela, e o campo alinha com a busca e os filtros. */
/* `compacto`: dentro de card ou de linha, o select vai no tamanho sm (h-8),
   o mesmo dos Button size="sm" ao lado. Na barra fica o padrao (h-10). */
export function Choice({ label, value, opcoes, onChange, placeholder, required, disabled, className = "", rotuloVisivel = true, compacto = false }) {
  const id = useId();
  return (
    <div className={`flex min-w-0 flex-col ${rotuloVisivel ? "gap-1" : ""} ${className}`}>
      <Label htmlFor={id} required={required} className={rotuloVisivel ? undefined : "sr-only"}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={label} className={compacto ? "h-8 text-left" : "text-left"}><SelectValue placeholder={placeholder} /></SelectTrigger>
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
      className={`block h-full w-full rounded-lg p-0 text-left font-normal whitespace-normal ${ativo ? "ring-2 ring-brand" : ""} ${className}`}>
      <KpiMini label={label} value={String(value)} hint={hint} tone={tone} className="h-full w-full" />
    </Button>
  );
}

/* Estado de um item (solicitado, comprado) com a acao que o muda logo
   abaixo: o estado e' um Badge, que nunca e' clicavel; a acao e' um Button
   pequeno ("solicitar" quando falta, "desfazer" quando ja' esta' feito).
   Substitui o `.pill-btn`, que era selo e botao ao mesmo tempo. `disabled`
   trava so' a acao (modo leitura, pre-requisito nao cumprido); o selo
   continua contando o estado. */
export function EstadoAcao({ feito, rotuloFeito, rotuloPendente = "pendente", acao, desfazer = "desfazer", disabled, onClick, title, tone = "success", className = "", rotuloItem }) {
  /* O ESTADO VIRA AÇÃO (23/09/2026): antes era um selo "pendente" com a
     ação em texto solto embaixo, que não parecia botão. Agora, pendente,
     é o próprio botão com a ação ("Solicitar"); feito, é o selo verde com
     o ✓ e um desfazer pequeno ao lado. `rotuloPendente` fica para quem
     não pode agir (o selo continua dizendo o estado). */
  const acaoMaiuscula = acao ? acao.charAt(0).toUpperCase() + acao.slice(1) : acao;
  if (feito) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <Badge tone={tone} title={title}><Check size={12} aria-hidden="true" />{rotuloFeito}</Badge>
        {!disabled && (
          <Button variant="ghost" size="icon" type="button" className="h-6 w-6 text-text-mute"
            onClick={onClick} title={title} aria-label={`${desfazer}${rotuloItem ? ` — ${rotuloItem}` : ""}`}>
            <Undo2 size={12} aria-hidden="true" />
          </Button>
        )}
      </span>
    );
  }
  return (
    <span className={`inline-flex ${className}`}>
      <BotaoComMotivo variant="outline" size="sm" type="button" disabled={disabled} onClick={onClick} title={title}
        aria-label={rotuloItem ? `${acaoMaiuscula} — ${rotuloItem}` : undefined}>
        {acaoMaiuscula}
      </BotaoComMotivo>
    </span>
  );
}

/* Rotulo de secao dentro de um dialog ou card: mono, caixa alta, discreto
   (classe `label-mono` do DS). `conta` e' o complemento em texto normal
   ao lado ("12 linhas selecionadas"). Substitui o `.sol-secao-rotulo`. */
export function SecaoRotulo({ conta, dica, rotuloDica, className = "", children }) {
  return (
    /* Com dica, a linha centraliza: o ⓘ é um botão de 24px, sem linha de
       base de texto, e no alinhamento por baseline ele ficava torto em
       relação ao rótulo. Sem dica, segue a baseline de sempre. */
    <h2 className={`flex flex-wrap ${dica ? "items-center" : "items-baseline"} gap-2 ${className}`}>
      <span className="label-mono">{children}</span>
      {dica && <DicaInfo rotulo={rotuloDica || "O que é isto?"}>{dica}</DicaInfo>}
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

/* Estado de um registro (rascunho, aprovado…) num Select cujas opcoes sao
   Badges: o que aparece no gatilho e' o selo do estado atual, com a cor
   semantica, e trocar de estado e' escolher outro selo. Substitui o
   `.ad-tag` (fileira de selos que eram botoes ao mesmo tempo). `opcoes`:
   [{ value, label, tone, title }]. `aviso` e' um segundo Badge, fora do
   controle, que acompanha o estado ("Pipefy pendente"). */
export function EscolhaEstado({ id, valor, opcoes, onChange, disabled, rotulo = "Estado", aviso, className = "" }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Select value={valor} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={rotulo} className="h-8 w-40"><SelectValue placeholder={rotulo} /></SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o.value} value={o.value} title={o.title}>
              <Badge tone={o.tone || "neutral"}>{o.label}</Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {aviso}
    </div>
  );
}

/* Um simbolo por squad, pra barra recolhida.

   Com 62px de largura nao cabe "SQUAD COMET", e sem nada as obras de
   tres squads viram uma coluna unica de predinhos iguais. O simbolo e' a
   unica coisa que separa os grupos ali. */
export function IconeSquad({ nome, size = 13 }) {
  const t = String(nome || "").toLowerCase();
  if (t.includes("moon")) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.5 15.6A8.6 8.6 0 0 1 9 4.1a1 1 0 0 0-1.4-1.2 10.5 10.5 0 1 0 14 14 1 1 0 0 0-1.1-1.3z" />
    </svg>;
  }
  if (t.includes("sun")) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 1.4v3M12 19.6v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1.4 12h3M19.6 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
        stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
    </svg>;
  }
  if (t.includes("comet")) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="16.5" cy="7.5" r="4" />
      <path d="M12.6 10.8 2.9 20.5a1 1 0 0 0 1.1 1.6l7.5-3a1 1 0 0 0 .5-.4l2.2-3.6z" opacity=".75" />
    </svg>;
  }
  return <Building2 size={size} />;
}

/* O squad com o símbolo dele, em todo lugar que o squad aparece (pedido
   dela, 22/09/2026): o mesmo cometa, lua e sol do menu lateral. "Squad X"
   quando o nome vem só "X"; "Sem squad" e "Outras obras" ficam como estão. */
export function rotuloDoSquad(nome) {
  const n = String(nome || "").trim();
  if (!n) return "Sem squad";
  return /^squad\b|^sem squad$|^outras obras$/i.test(n) ? n : `Squad ${n}`;
}
export function SquadComIcone({ nome, size = 12, className = "" }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      <IconeSquad nome={nome} size={size} />
      <span className="min-w-0 truncate">{rotuloDoSquad(nome)}</span>
    </span>
  );
}
