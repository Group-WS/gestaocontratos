/* Testes do alerta de conferência técnica.
 *
 * Roda com: node web/src/__testes__/conferencia-tecnica.test.mjs
 *
 * As descrições aqui saíram da planilha criativo da 2519 — são as reais,
 * não inventadas. Guardam quatro decisões:
 *
 *   1. A medida é lida do texto COM pontuação. Passar pelo normTxt come a
 *      vírgula: "0,42m" vira "0 42m" (42 metros, descartado) e "1,40m"
 *      vira 1 m. O primeiro enche a tela de "sem medida" à toa; o segundo
 *      é o perigoso — a mesa redonda de 1,40 m passava calada, e mesa
 *      redonda não biparte.
 *   2. Sem medida escrita, quem responde é o TIPO. Mesa lateral, de
 *      cabeceira, de canto e de centro são pequenas por definição.
 *   3. Mas o tipo só vale na falta da medida. "Mesa de centro 1,20 x 0,60"
 *      alerta: o nome não encolhe o móvel.
 *   4. "mesa" sozinho é pista fraca — luminária de mesa e cuba com "mesa
 *      para torneira" não são móvel. Já "tampo" e "jantar" valem sozinhos,
 *      senão a bancada de pedra descrita com cuba, que é justamente o que
 *      não passa no elevador, sairia da regra calada.
 */
const src = (await import("fs")).readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const codigo = src.slice(src.indexOf("function semAcentos("), src.indexOf("// Palavras que aparecem em quase toda"));
const { alertaConferenciaTecnica, medidasEmMetros, semAcentos, alertasDeConjunto } =
  eval(`(function(){ ${codigo}; return { alertaConferenciaTecnica, medidasEmMetros, semAcentos, alertasDeConjunto }; })()`);

let falhas = 0;
// "passa" = não alerta. "medida" = alerta de peça grande. "sem medida" =
// alerta pedindo a dimensão.
const cai = (d) => {
  const r = alertaConferenciaTecnica(d);
  if (!r) return "passa";
  if (r.escopo === "grupo") return "grupo";
  return r.texto.startsWith("sem medida") ? "sem medida" : "medida";
};
const conf = (descricao, esperado) => {
  const obtido = cai(descricao);
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${descricao.slice(0, 46).padEnd(48)} ${obtido.padEnd(11)} ${ok ? "" : "esperava " + esperado}`);
};

console.log("=== A VÍRGULA DA MEDIDA (descrições reais da 2519) ===");
conf("Mesa Lateral Moana Baixa - Ø 0,42m x 0,46m", "passa");
conf("Mesa De Jantar Redonda Brasília 1,40M", "medida");
conf("Mesa De Jantar Selma Tamanho 2,20X1,10M", "medida");
// o limite é aberto: 1,00 m cabe, 1,01 m não
conf("Mesa de jantar 1,00 x 0,90 m", "passa");
conf("Mesa de jantar 1,01 x 0,90 m", "medida");
// formatos que a planilha também usa
conf("Mesa de jantar 300x120", "medida");
conf("Mesa lateral 45cm", "passa");
conf("Mesa de jantar 2,40m", "medida");

console.log("\n=== SEM MEDIDA: QUEM RESPONDE É O TIPO ===");
conf("Mesa Lateral Moana", "passa");
conf("Mesa Lateral Rhodes", "passa");
conf("Mesa De Cabeceira Bella P", "passa");
conf("Mesa De Centro Arona Baixa Tampo Mármore", "passa");
conf("Mesa de canto Ravena", "passa");
conf("Mesa de apoio Lisboa", "passa");
// Sem tipo, sobra o qualificador de altura: no catálogo, "Class
// Alta/Média/Baixa" é o trio de mesas de apoio.
conf("Mesa Class Alta", "passa");
conf("Mesa Class Média", "passa");
conf("Mesa Starck Baixa", "passa");
// Mas mesa alta COM pista de bar volta a alertar: essa é grande.
conf("Mesa alta para bar Class", "sem medida");
conf("Mesa bistro alta", "sem medida");
// Sem medida, sem tipo e sem qualificador: continua indo pra conferência.
conf("Mesa de jantar Ravena", "sem medida");
conf("Mesa Ravena", "sem medida");

console.log("\n=== O TIPO NÃO ENCOLHE O MÓVEL ===");
// medida escrita manda, mesmo em tipo "pequeno"
conf("Mesa de centro 1,20 x 0,60 m", "medida");
conf("Mesa lateral 1,10m", "medida");

console.log("\n=== 'MESA' QUE NÃO É MÓVEL ===");
conf("Luminaria de mesa 51x29,5cm polietileno branco", "passa");
conf("Cuba Esculpida Estilo Bandeja Em Granito Com Mesa Para Torneira", "passa");
conf("Espelho de mesa com aumento", "passa");
// mas tampo e jantar valem sozinhos: pedra grande com cuba continua caindo
conf("Bancada em granito com cuba esculpida, tampo 2,60 x 0,80 m", "medida");
conf("Ilha Em Granito Siena Escovado, Tampo Descidas E Fundo Vista 2Cm + Rodapé 10Cm", "passa");

console.log("\n=== ESTOFADO: SOFA NAO BIPARTE ===");
// os reais da 2519 — todos pequenos por tipo, nenhum vira conferencia
conf("Cadeira Ravena", "passa");
conf("Poltrona Brava", "passa");
conf("Puff Mumbai", "passa");
conf("Cadeira Aurora Damasco", "passa");
// sofa sem medida: cai, porque nao ha o que bipartir
conf("Sofa Living 3 lugares", "sem medida");
conf("Chaise Roma", "sem medida");
// com medida, o corte de 1,00 m manda
conf("Sofa Living 2,40 x 0,90 m", "medida");
conf("Poltrona Brava 0,80 x 0,75 m", "passa");
// banqueta continua na regra dela, nao na de estofado
conf("Banqueta Fit", "medida");
// pista curta casa por palavra inteira: SOFANI e fornecedor, nao sofa
conf("SOFANI", "passa");
conf("Life Estofados", "sem medida"); // "estofados" no plural ainda casa

console.log("\n=== PEDRA COM RECORTE PRA CUBA ===");
// a marcenaria da planilha e valor fechado ("Marcenaria [MAT]") e nao tem
// o que medir; a bancada de pedra vem descrita, e furo errado em granito
// nao tem conserto
conf("Bancada Com Recorte Para Cuba E Rebaixo Italiano, Em Siena Escovado", "medida");
conf("Marcenaria [MAT]", "passa");
conf("Pecas Especiais Marcenaria [MAT / MO]", "passa");
// cuba sem recorte nao e o caso: nao ha pedra pra furar
conf("Cuba De Embutir Tramontina Lavinia 56 Bl Em Aco Inox 56X34 Cm", "passa");

console.log("\n=== AQUECEDOR A GÁS: GN OU GLP ===");
// O aquecedor sai de fábrica para um gás só, e o de um não serve no
// outro. As descrições marcadas "real" saíram das planilhas das obras do
// app (set/2026): nenhuma diz o tipo — justamente o caso de conferir.
const gas = (descricao, esperado, vendido) => {
  const r = alertaConferenciaTecnica(descricao, { vendido });
  const obtido = !r ? "passa"
    : r.escopo !== "item" ? "grupo"
    : /Atenção: o vendido é/.test(r.texto) ? "trocado"
    : (r.texto.match(/Item informado: (GN|GLP)\./) || [])[1]
      || (r.texto.startsWith("⚠️ CONFERÊNCIA OBRIGATÓRIA — GÁS:") ? "sem tipo" : "outro");
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${descricao.slice(0, 46).padEnd(48)} ${obtido.padEnd(11)} ${ok ? "" : "esperava " + esperado}`);
};
gas("Aquecedor a Gás KO 45DI Prime", "sem tipo", "Aquecedor a gás 45L Komeco Komeco Sacada"); // real
gas("Aquecedor a gás 38DI", "sem tipo"); // real
// com o tipo escrito continua alertando: a descrição diz o que foi
// pedido, não qual é o gás do prédio
gas("Aquecedor de passagem a gás 21L GN", "GN");
gas("Aquecedor digital 15L GLP", "GLP");
gas("Aquecedor a gás natural 20L", "GN");
gas("Aquecedor G.L.P. 15 litros", "GLP");
// o tipo grudado no código do modelo
gas("Aquecedor REU15GN", "GN");
// citar os dois é o mesmo que não definir
gas("Aquecedor 15L GN/GLP", "sem tipo");
// sem falar em gás: na dúvida, alerta — em apartamento quase todo
// aquecedor de água é a gás
gas("Aquecedor de passagem 21 litros", "sem tipo");
// o "elétrica" da ignição não tira o aparelho do gás
gas("Aquecedor a gás com ignição elétrica 15L GLP", "GLP");
// vem antes da base do monocomando: aquecedor fala em chuveiro
gas("Aquecedor a gás 21L - atende 2 chuveiros, com base de fixação", "sem tipo");
// vendido × executivo: GN de um lado e GLP do outro é o erro que a
// regra existe pra pegar
gas("Aquecedor a gás 21L GLP", "trocado", "Aquecedor a gás 21L GN");
// o executivo perdeu o tipo: vale o do vendido
gas("Aquecedor a gás 21L", "GN", "Aquecedor a gás 21L GN");
gas("Aquecedor a gás 21L GN", "GN", "Aquecedor a gás 21L GN");
// não é aquecedor a gás
gas("Aquecedor elétrico de passagem 5500W", "passa");
gas("Aquecedor solar 200L", "passa");
gas("Aquecedor de toalhas cromado", "passa");
gas("Aquecedor de ambiente a óleo", "passa");
gas("Piso aquecido banheiro", "passa");
gas("Torneira aquecedora elétrica", "passa");
// o aquecedor como complemento: a pergunta do gás fica no aparelho
gas("Instalação e configuração de aquecedor a gás0,000", "passa"); // real
gas("Ducha Deca para aquecedor a gás", "passa");
gas("Chaminé do aquecedor", "passa");
// cooktop a gás não é aquecedor (real, da mesma obra do aquecedor)
gas("Cooktop 5 Bocas a Gás Electrolux Inox Experience Multi Chama e Grade Ferro Fundido (KE5XC) - Bivolt", "passa");

console.log("\n=== AS OUTRAS REGRAS SEGUEM DE PÉ ===");
conf("Banqueta alta Bella", "medida"); // ALERTA_BANQUETA cai no ramo "item"
conf("Base Deca Monocomando Chuveiro", "medida"); // a base segue depois do aquecedor
conf("Ar Condicionado Cassete 4 vias LG Inverter 18.000 BTU/h", "grupo");

console.log("\n=== LEITURA DE MEDIDA, ISOLADA ===");
const leu = (d, esperado) => {
  const obtido = JSON.stringify(medidasEmMetros(semAcentos(d)));
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${d.padEnd(48)} ${obtido.padEnd(18)} ${ok ? "" : "esperava " + esperado}`);
};
leu("0,42m x 0,46m", "[0.42,0.46]");
leu("2,20X1,10M", "[2.2,1.1]");
leu("300x120", "[3,1.2]");
leu("45cm", "[0.45]");
// número grande demais pra ser móvel não é medida: BTU, ano, código
leu("18.000 BTU/h 220V", "[]");
// contagem nao e medida: "3 lugares" virava 3 metros e disparava o alerta
// de peca grande pelo motivo errado
leu("Sofa Living 3 lugares", "[]");
leu("Cooktop 5 bocas", "[]");
leu("Sofa 3 lugares 2,40m", "[2.4]");

/* ============================================================
   ALERTAS DE CONJUNTO — o que so existe olhando a verba junta
   ============================================================ */
const conj = (nome, itens, esperado) => {
  const out = alertasDeConjunto(itens);
  const bate = esperado === null ? out.length === 0 : out.some((t) => t.includes(esperado));
  if (!bate) falhas++;
  console.log(`${bate ? "ok  " : "FALHOU"} ${nome.padEnd(48)} ${bate ? "" : JSON.stringify(out)}`);
};
const d = (desc, ambiente) => ({ desc, ambiente });

console.log("\n=== TEMPERATURA DE COR MISTURADA ===");
// as fontes entram no fixture de proposito: sem elas a OUTRA regra
// dispararia e o teste passaria a medir a coisa errada
conj("tudo 4000K nao fala (o caso da 2519)", [
  d("Fita Led All Light 12V 15W 4000K Perfil - Cortineiro"),
  d("Fita Led All Light 12V 15W 4000K Perfil - Cabeceira"),
  d("Fonte Evo 12V - Cortineiro"), d("Fonte Evo 12V - Cabeceira"),
], null);
conj("3000K com 4000K fala", [
  d("Spot embutido 3000K"),
  d("Fita Led 4000K"),
], "temperaturas de cor diferentes");
// codigo e potencia de 4 digitos nao sao temperatura
conj("fora da faixa 2000-7000 nao conta", [
  d("Luminaria ref 1200K serie antiga"),
  d("Spot 3000K"),
], null);

console.log("\n=== FITA DE LED SEM FONTE ===");
conj("4 fitas e 3 fontes fala (o caso da 2519)", [
  d("Fita Led 12V - Cortineiro"), d("Fita Led 12V - Sanca"),
  d("Fita Led 12V - Cabeceira"), d("Fita Led 12V - Perfil"),
  d("100W | Fonte Evo 12V - Cortineiro"), d("100W | Fonte Evo 12V - Sanca"),
  d("100W | Fonte Evo 12V - Cabeceira"),
], "conferir se cada trecho tem a sua");
conj("uma fonte pra cada fita nao fala", [
  d("Fita Led 12V - Sanca"), d("Fonte Evo 12V - Sanca"),
], null);
conj("verba sem fita nenhuma nao fala", [d("Spot Snello"), d("Pendente Posh")], null);

console.log("\n=== ACABAMENTO NO MESMO AMBIENTE ===");
conj("grafite com cromado no mesmo banheiro fala", [
  d("Monocomando Doc Grafite", "Banho Suite"),
  d("Torneira Loggica Cromado", "Banho Suite"),
], "mesmo ambiente");
conj("ambientes diferentes nao falam", [
  d("Monocomando Doc Grafite", "Lavabo"),
  d("Torneira Loggica Cromado", "Cozinha"),
], null);
// pedra tambem e "escovado": comparar granito com torneira acusaria o que
// nao existe
conj("acabamento de pedra fica fora da conta", [
  d("Bancada Em Siena Escovado", "Cozinha"),
  d("Monocomando Doc Grafite", "Cozinha"),
], null);
conj("sem a coluna ambiente a regra fica calada", [
  d("Monocomando Doc Grafite", ""),
  d("Torneira Loggica Cromado", ""),
], null);

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
