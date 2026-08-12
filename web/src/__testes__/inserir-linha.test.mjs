// Testa a regra do codigo de linha inserida no meio.
const codigoInserido = (codigoAcima, irmaos) => {
  if (!codigoAcima) return null;
  const usados = new Set((irmaos || []).map((it) => it.codigo).filter(Boolean));
  for (let n = 1; n < 100; n++) { const t = `${codigoAcima}.${n}`; if (!usados.has(t)) return t; }
  return null;
};
const inserir = (lista, depois, novo) => {
  const arr = [...lista];
  if (depois == null || depois < 0 || depois >= arr.length) arr.push(novo); else arr.splice(depois + 1, 0, novo);
  return arr;
};

let f = 0;
const conf = (n, o, e) => { const ok = String(o)===String(e); if(!ok) f++; console.log(`${ok?"ok  ":"FALHOU"} ${n.padEnd(38)} ${String(o).padEnd(16)} ${ok?"":"esperava "+e}`); };

const itens = [{codigo:"3.4"},{codigo:"3.5"},{codigo:"3.6"}];
conf("insere abaixo do 3.5", codigoInserido("3.5", itens), "3.5.1");
conf("segunda insercao no mesmo ponto", codigoInserido("3.5", [...itens,{codigo:"3.5.1"}]), "3.5.2");
conf("terceira", codigoInserido("3.5", [...itens,{codigo:"3.5.1"},{codigo:"3.5.2"}]), "3.5.3");
conf("item sem codigo acima", codigoInserido(null, itens), "null");

console.log("");
const pos = inserir(itens, 1, {codigo:"3.5.1"}).map(x=>x.codigo).join(" ");
conf("ordem apos inserir no indice 1", pos, "3.4 3.5 3.5.1 3.6");
conf("os vizinhos NAO mudam de codigo", inserir(itens,1,{codigo:"3.5.1"})[3].codigo, "3.6");
conf("sem posicao vai pro fim", inserir(itens, null, {codigo:"x"}).map(x=>x.codigo).join(" "), "3.4 3.5 3.6 x");
conf("indice alem do fim vai pro fim", inserir(itens, 99, {codigo:"x"}).map(x=>x.codigo).join(" "), "3.4 3.5 3.6 x");

console.log("");
// Ancora: procura o codigo mais proximo ACIMA, nao so o da linha imediata.
// Inserindo abaixo de uma linha que tambem nasceu aqui (sem codigo), a linha
// imediata nao serve — e o item nascia com traco, fora da numeracao.
const acharAncora = (lista, depois) => {
  for (let k = depois; k >= 0; k--) if (lista[k]?.codigo) return lista[k].codigo;
  return null;
};
const comInserido = [{codigo:"3.14"},{codigo:null},{codigo:"3.20"}];
conf("ancora pula linha sem codigo", acharAncora(comInserido, 1), "3.14");
conf("segunda insercao vira 3.14.2",
     codigoInserido(acharAncora(comInserido,1), [...comInserido,{codigo:"3.14.1"}]), "3.14.2");
conf("sem nenhum codigo acima", acharAncora([{codigo:null}], 0), "null");

console.log(f===0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f?1:0);
