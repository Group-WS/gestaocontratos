import React, { useEffect, useState } from "react";
import { ConfirmDialog, MessageDialog, Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter, Button, Field, Label, Input, Checkbox,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@group-ws/ws-ui";
import { toast } from "sonner";

/* API compartilhada pelas ações de remoção. O host apresenta uma confirmação
   por vez; fechar ou desmontar cancela a ação pendente. */
let abrir = null;

/* `opcao` (23/09/2026): uma escolha que viaja JUNTO do sim, em vez de virar
   uma segunda pergunta — hoje só a importação usa ("apagar também as verbas
   que não vieram no arquivo"). Com ela, `mensagem`, `confirmar` e `perigo`
   podem ser função de `marcada`, e a promessa resolve com
   `{ ok: true, marcada }`; cancelar segue resolvendo `false`, como sempre. */
export function confirmar(opcoes) {
  const pedido = typeof opcoes === "string" ? { mensagem: opcoes } : (opcoes || {});
  // Sem o host não há confirmação: nunca autorizar a operação por omissão.
  if (!abrir) return Promise.resolve(false);
  return new Promise((resolve) => abrir({ ...pedido, resolve }));
}

const conforme = (valor, marcada) => (typeof valor === "function" ? valor(marcada) : valor);

function ConfirmarComOpcao({ pedido, onResponder }) {
  const [marcada, setMarcada] = useState(Boolean(pedido.opcao.inicial));
  const id = React.useId();
  const perigo = conforme(pedido.perigo, marcada);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) onResponder(false); }}
      title={conforme(pedido.titulo, marcada) || "Confirmar"}
      description={(
        <>
          {conforme(pedido.mensagem, marcada)}
          <span className="mt-4 flex items-start gap-2">
            <Checkbox id={id} checked={marcada} onCheckedChange={(v) => setMarcada(v === true)} />
            <Label htmlFor={id} className="font-normal">{pedido.opcao.rotulo}</Label>
          </span>
        </>
      )}
      confirmLabel={conforme(pedido.confirmar, marcada) || "Confirmar"}
      cancelLabel={pedido.cancelar || "Cancelar"}
      variant={perigo === false ? "default" : "danger"}
      onConfirm={() => onResponder({ ok: true, marcada })}
    />
  );
}

export function ConfirmarHost() {
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    const pendentes = new Set();
    const receber = (pedido) => {
      const resolver = pedido.resolve;
      const item = {
        ...pedido,
        resolve: (resposta) => {
          pendentes.delete(item);
          resolver(resposta);
        },
      };
      pendentes.add(item);
      setPedidos((fila) => [...fila, item]);
    };
    abrir = receber;
    return () => {
      if (abrir === receber) abrir = null;
      for (const pedido of pendentes) pedido.resolve(false);
    };
  }, []);

  const pedido = pedidos[0];
  function responder(resposta) {
    pedido.resolve(resposta);
    setPedidos((fila) => fila.filter((item) => item !== pedido));
  }

  if (!pedido) return null;
  if (pedido.opcao) {
    return <ConfirmarComOpcao key={pedidos.length} pedido={pedido} onResponder={responder} />;
  }
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) responder(false); }}
      title={pedido.titulo || "Confirmar remoção"}
      description={pedido.mensagem}
      confirmLabel={pedido.confirmar || "Remover"}
      cancelLabel={pedido.cancelar || "Cancelar"}
      variant={pedido.perigo === false ? "default" : "danger"}
      onConfirm={() => responder(true)}
    />
  );
}

/* ---------------------------------------------------------------------------
   Aviso modal (substitui window.alert): para o que o usuário precisa LER antes
   de seguir — validação de negócio que bloqueia a ação em curso.
   Retorno de ação concluída ou falha fora de formulário é toast (`avisar`).
   --------------------------------------------------------------------------- */
let abrirMensagem = null;

export function mensagem(opcoes) {
  const pedido = typeof opcoes === "string" ? { mensagem: opcoes } : (opcoes || {});
  if (!abrirMensagem) return Promise.resolve();
  return new Promise((resolve) => abrirMensagem({ ...pedido, resolve }));
}

export function MensagemHost() {
  const [pedidos, setPedidos] = useState([]);
  useEffect(() => {
    const receber = (pedido) => setPedidos((fila) => [...fila, pedido]);
    abrirMensagem = receber;
    return () => { if (abrirMensagem === receber) abrirMensagem = null; };
  }, []);
  const pedido = pedidos[0];
  if (!pedido) return null;
  return (
    <MessageDialog
      open
      onOpenChange={(open) => {
        if (open) return;
        pedido.resolve();
        setPedidos((fila) => fila.filter((item) => item !== pedido));
      }}
      title={pedido.titulo || "Atenção"}
      message={pedido.mensagem}
      description={pedido.detalhe}
      tone={pedido.tom || "warning"}
      dismissLabel={pedido.fechar || "Entendi"}
    />
  );
}

/* ---------------------------------------------------------------------------
   Pergunta com resposta em texto (substitui window.prompt). Resolve com a
   string digitada ou null quando a pessoa cancela ou fecha o diálogo.
   --------------------------------------------------------------------------- */
let abrirPergunta = null;

export function perguntar(opcoes) {
  const pedido = typeof opcoes === "string" ? { mensagem: opcoes } : (opcoes || {});
  if (!abrirPergunta) return Promise.resolve(null);
  return new Promise((resolve) => abrirPergunta({ ...pedido, resolve }));
}

function PerguntaDialog({ pedido, onResponder }) {
  const [valor, setValor] = useState(pedido.inicial || "");
  const id = React.useId();
  const enviar = (e) => { e.preventDefault(); onResponder(valor); };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onResponder(null); }}>
      <DialogContent size="sm">
        <form onSubmit={enviar}>
          <DialogHeader>
            <DialogTitle>{pedido.titulo || "Informe um valor"}</DialogTitle>
            {pedido.mensagem && <DialogDescription>{pedido.mensagem}</DialogDescription>}
          </DialogHeader>
          <DialogBody>
            <Field>
              <Label htmlFor={id}>{pedido.rotulo || "Valor"}</Label>
              <Input id={id} autoFocus value={valor} inputMode={pedido.inputMode}
                placeholder={pedido.placeholder} onChange={(e) => setValor(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onResponder(null)}>{pedido.cancelar || "Cancelar"}</Button>
            <Button type="submit">{pedido.confirmar || "Confirmar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PerguntarHost() {
  const [pedidos, setPedidos] = useState([]);
  useEffect(() => {
    const receber = (pedido) => setPedidos((fila) => [...fila, pedido]);
    abrirPergunta = receber;
    return () => { if (abrirPergunta === receber) abrirPergunta = null; };
  }, []);
  const pedido = pedidos[0];
  if (!pedido) return null;
  return (
    <PerguntaDialog key={pedidos.length} pedido={pedido} onResponder={(resposta) => {
      pedido.resolve(resposta);
      setPedidos((fila) => fila.filter((item) => item !== pedido));
    }} />
  );
}

/* ---------------------------------------------------------------------------
   Escolher a verba de cada grupo que a EAP não reconheceu (RN-030,
   23/09/2026). Resolve com Map(nome do grupo -> num da verba | null) — null
   é "manter fora do padrão" — ou null quando a pessoa cancela a importação.
   Toda linha precisa de uma escolha: o grupo não passa calado.
   --------------------------------------------------------------------------- */
const MANTER_FORA = "fora";
let abrirEscolha = null;

export function escolherVerbas(opcoes) {
  if (!abrirEscolha) return Promise.resolve(null);
  return new Promise((resolve) => abrirEscolha({ ...opcoes, resolve }));
}

function EscolherVerbasDialog({ pedido, onResponder }) {
  const [escolhas, setEscolhas] = useState({});
  const idBase = React.useId();
  const completo = pedido.grupos.every((g) => escolhas[g.nome]);
  const enviar = (e) => {
    e.preventDefault();
    if (!completo) return;
    onResponder(new Map(pedido.grupos.map((g) => [g.nome, escolhas[g.nome] === MANTER_FORA ? null : escolhas[g.nome]])));
  };
  const plural = pedido.grupos.length > 1;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onResponder(null); }}>
      <DialogContent size="md">
        <form onSubmit={enviar}>
          <DialogHeader>
            <DialogTitle>{plural ? "Grupos fora da EAP" : "Grupo fora da EAP"}</DialogTitle>
            <DialogDescription>
              {plural ? "Estes grupos do arquivo não casam" : "Este grupo do arquivo não casa"} com nenhuma verba da EAP.
              Escolha a verba de cada um. A escolha fica gravada na EAP, e o próximo arquivo com o mesmo nome já entra
              na verba certa. Se o grupo não pertence a nenhuma, mantenha fora do padrão: ele vai para o fim da lista e
              conta no CMV.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {pedido.grupos.map((g, i) => (
              <Field key={g.nome}>
                <Label htmlFor={`${idBase}-${i}`} required>
                  {g.nome} · {g.itens} {g.itens === 1 ? "item" : "itens"}
                </Label>
                <Select value={escolhas[g.nome] || ""} onValueChange={(v) => setEscolhas((a) => ({ ...a, [g.nome]: v }))}>
                  <SelectTrigger id={`${idBase}-${i}`} className="w-full">
                    <SelectValue placeholder="Escolha a verba" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MANTER_FORA}>Manter fora do padrão</SelectItem>
                    {pedido.verbas.map((v) => (
                      <SelectItem key={v.num} value={v.num}>{v.num} · {v.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ))}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onResponder(null)}>Cancelar importação</Button>
            <Button type="submit" disabled={!completo}>Continuar importação</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EscolherVerbasHost() {
  const [pedidos, setPedidos] = useState([]);
  useEffect(() => {
    const receber = (pedido) => setPedidos((fila) => [...fila, pedido]);
    abrirEscolha = receber;
    return () => { if (abrirEscolha === receber) abrirEscolha = null; };
  }, []);
  const pedido = pedidos[0];
  if (!pedido) return null;
  return (
    <EscolherVerbasDialog key={pedidos.length} pedido={pedido} onResponder={(resposta) => {
      pedido.resolve(resposta);
      setPedidos((fila) => fila.filter((item) => item !== pedido));
    }} />
  );
}

/* Toast padronizado (TELA-50/51): sucesso "<Entidade> <particípio>.",
   erro "Não foi possível <verbo>…". */
/* `opcoes.duracao` (ms): para o aviso que precisa ser LIDO, como os alertas
   da leitura de um arquivo — o tempo padrão do toast some antes.
   `opcoes.acao` ({ rotulo, aoClicar }): um botão no próprio aviso, como o
   "Desfazer" depois de escolher o insumo do Sienge (25/09/2026). */
const opcoesDoToast = (descricao, opcoes = {}) => {
  const o = {};
  if (descricao) o.description = descricao;
  if (opcoes.duracao) o.duration = opcoes.duracao;
  if (opcoes.acao) o.action = { label: opcoes.acao.rotulo, onClick: opcoes.acao.aoClicar };
  return Object.keys(o).length ? o : undefined;
};
export const avisar = {
  ok: (texto, descricao, opcoes) => toast.success(texto, opcoesDoToast(descricao, opcoes)),
  erro: (texto, descricao, opcoes) => toast.error(texto, opcoesDoToast(descricao, opcoes)),
  info: (texto, descricao, opcoes) => toast(texto, opcoesDoToast(descricao, opcoes)),
};
