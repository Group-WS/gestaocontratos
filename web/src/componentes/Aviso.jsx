import { useSyncExternalStore, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/* O recado curto depois de uma acao — o que o app nunca teve.
 *
 * Ate' aqui so' existia banner inline: um bloco que nasce DENTRO da tela,
 * empurra o resto pra baixo, e fica ate' alguem fechar. Serve pra estado
 * ("faltou rodar o SQL"), e nao pra acontecimento ("salvei").
 *
 * O buraco aparecia no que fecha sozinho. Liberar o acesso de alguem
 * grava e fecha o painel: a pessoa muda uma permissao — coisa seria — e
 * fica sem saber se pegou. Cadastrar alguem limpa o formulario, que tanto
 * pode querer dizer "salvei" quanto "perdi o que voce digitou".
 *
 * NAO e' um lugar pra erro que precisa de decisao. Erro que exige escolha
 * fica onde a pessoa esta' trabalhando, e nao some sozinho em cinco
 * segundos — os banners inline continuam fazendo isso. Aqui vai o que se
 * le' de passagem e nao se responde.
 *
 * O aviso se anuncia por aria-live="polite": o leitor de tela termina o
 * que estava falando e entao le'. "assertive" interromperia a pessoa no
 * meio de outra frase pra dizer "salvo", que e' pior que nao dizer. */

const ouvintes = new Set();
let avisos = [];
let proximoId = 1;

const emitir = () => { ouvintes.forEach((f) => f()); };

/* Chamavel de qualquer lugar, sem provider e sem context: o app e' um
   arquivo so' e nao usa context em lugar nenhum — um store de modulo
   entrega o mesmo sem uma camada nova em volta da arvore. */
export function avisar(texto, { tom = "ok", segundos = 5 } = {}) {
  const id = proximoId++;
  avisos = [...avisos, { id, texto, tom, segundos }];
  emitir();
  return id;
}

export function fecharAviso(id) {
  avisos = avisos.filter((a) => a.id !== id);
  emitir();
}

const inscrever = (f) => { ouvintes.add(f); return () => ouvintes.delete(f); };
const ler = () => avisos;

function Um({ aviso }) {
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => fecharAviso(aviso.id), aviso.segundos * 1000);
    return () => clearTimeout(t);
  }, [aviso.id, aviso.segundos]);
  return (
    <div ref={ref} className={`aviso aviso-${aviso.tom}`}>
      <span className="aviso-txt">{aviso.texto}</span>
      <button type="button" className="aviso-fechar" aria-label="Fechar aviso"
        onClick={() => fecharAviso(aviso.id)}>×</button>
    </div>
  );
}

/* Uma so' no app inteiro, perto da raiz. */
export default function Avisos() {
  const lista = useSyncExternalStore(inscrever, ler, ler);
  if (lista.length === 0) return null;
  return createPortal(
    <div className="avisos" role="status" aria-live="polite">
      {lista.map((a) => <Um key={a.id} aviso={a} />)}
    </div>,
    document.body,
  );
}
