/* Gera o SEED da EAP do Sienge a partir do relatório de orçamento em Excel.
 *
 *   node scripts/gerar-seed-eap.mjs "~/Downloads/relatorio (27).xlsx" > ../supabase/sienge_eap_seed.sql
 *
 * Roda na máquina de quem tem a planilha, uma vez — a saída é SQL que
 * entra no repositório. Não faz parte do app nem do build.
 *
 * O parser de verdade (o que a tela usa no upload) é src/lib/eapSienge.js;
 * este script só o chama e imprime INSERTs, pra não existirem duas leituras
 * da mesma planilha divergindo com o tempo.
 *
 * O MAPA verba → folha é escrito à mão aqui embaixo, e de propósito: as
 * duas EAPs têm numeração e nomes diferentes, e chutar por semelhança
 * aproparia produto na conta errada. Verba ambígua fica FORA do seed —
 * a tela mostra ela destacada e alguém decide.
 */
import * as XLSX from "xlsx";
import fs from "node:fs";
import { parseEapSienge } from "../src/lib/eapSienge.js";

/* Verba do GC (EAP_CODIGO, src/App.jsx) → folha da EAP do Sienge.
   Sempre a folha [MAT] quando a família separa material de mão de obra:
   aqui só passa compra de produto. */
const MAPA_INICIAL = {
  "01": "01.001.001.006", // Arquitetura e Engenharia    → Projetos complementares
  "03": "02.001.001.001", // Civil                       → Serviços Civis [MAT/MO]
  "04": "02.002.001.001", // Impermeabilização
  "05": "02.007.001.001", // Elétricas e Iluminação      → elétricas/dados e iluminação [MAT]
  "06": "02.003.001.001", // Hidrosanitárias
  "07": "02.005.001.001", // Preventivo de Incêndio
  "08": "02.007.001.001", // Comunicação e Dados         → mesma folha das elétricas/dados
  "09": "02.006.001.001", // Sistema de Gás
  "10": "03.001.001.001", // Gesso e Drywall
  "11": "03.003.001.001", // Revestimento Cerâmico [MAT]
  "12": "03.004.001.001", // Elementos em Madeira
  "14": "03.006.001.001", // Papel de Parede
  "15": "03.007.001.001", // Rodapés e Boiseries
  "16": "03.008.001.001", // Revestimentos Especiais
  "17": "04.014.001.001", // Parede Verde                → Paisagismo | Parede Verde | Plantas
  "18": "03.002.001.001", // Pintura [MAT]
  "19": "03.010.001.001", // Esquadrias                  → Esquadrias e Divisórias Corporativas
  "20": "04.001.001.001", // Climatização / Exaustão [MAT]
  "21": "04.002.001.001", // Móveis Sob Medida           → Marcenaria [MAT]
  "22": "04.006.001.001", // Serralheria                 → Estruturas Metálicas / ACM
  "23": "04.005.001.001", // Vidros e Espelhos
  "24": "04.003.001.001", // Móveis Soltos               → Mobiliário corporativo e móveis soltos
  "25": "04.004.001.001", // Estofados
  "26": "04.007.001.001", // Pedras                      → Marmoraria
  "27": "04.008.001.001", // Louças, Metais e Equip. [MAT]
  "28": "04.009.001.001", // Eletroeletrônico [MAT]
  "30": "04.012.001.001", // Cortinas e Persianas
  "31": "04.013.001.001", // Itens Decorativos           → Vasos, plantas, quadros e decorativos
  "33": "04.016.001.001", // Equipamentos de Lazer
  "34": "04.003.001.001", // Mobiliário Corporativo      → mesma folha dos móveis soltos
  // FORA de propósito, por ambiguidade real:
  //   02 Serviços Complementares — a família 01 do Sienge tem 7 folhas
  //      (taxas, limpeza, fretes, proteções, caçambas, projetos, administração)
  //   13 Piso Vinílico e Carpete — o Sienge separa em 03.005 e 03.009
  //   29 Adega Climatizada       — cabe em eletroeletrônicos ou climatização
};

const caminho = process.argv[2];
if (!caminho) {
  console.error("uso: node scripts/gerar-seed-eap.mjs <planilha.xlsx>");
  process.exit(1);
}

const wb = XLSX.read(fs.readFileSync(caminho.replace(/^~/, process.env.HOME)));
const ws = wb.Sheets[wb.SheetNames[0]];
const { versao, itens, avisos } = parseEapSienge(
  XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: false }));
if (avisos.length) avisos.forEach((a) => console.error("aviso:", a));
if (!itens.some((i) => i.folha)) {
  console.error("nenhuma folha encontrada — planilha não parece ser o relatório de orçamento");
  process.exit(1);
}

// Aspas simples dobradas, e null quando não há valor: é tudo que o SQL
// gerado aqui precisa (nada vem de entrada de usuário).
const s = (v) => (v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const folhas = new Set(itens.filter((i) => i.folha).map((i) => i.codigo));
Object.entries(MAPA_INICIAL).forEach(([verba, codigo]) => {
  if (!folhas.has(codigo)) {
    console.error(`ERRO: verba ${verba} aponta para ${codigo}, que não é folha desta planilha`);
    process.exit(1);
  }
});

const linhas = [];
linhas.push("-- ============================================================");
linhas.push("-- SEED DA EAP DO SIENGE — gerado por web/scripts/gerar-seed-eap.mjs");
linhas.push(`-- Origem: ${caminho.split("/").pop()} · ${itens.length} itens, ${folhas.size} folhas`);
linhas.push("--");
linhas.push("-- Nao edite a mao: regere o arquivo. Rodar de novo nao duplica");
linhas.push("-- (o insert e' guardado por 'not exists' no nome da versao).");
linhas.push("-- ============================================================");
linhas.push("");
linhas.push("do $$");
linhas.push("declare v_id bigint;");
linhas.push("begin");
linhas.push(`  select id into v_id from sienge_eap_versao where nome = ${s(versao.nome)};`);
linhas.push("  if v_id is not null then return; end if;");
linhas.push("");
linhas.push("  insert into sienge_eap_versao (nome, unidade_id, obra_modelo, versao_orcamento, data_base, padrao, importado_por)");
linhas.push(`  values (${s(versao.nome)}, ${versao.unidadeId}, ${s(versao.obraModelo)}, ${s(versao.versaoOrcamento)}, ${s(versao.dataBase)}, true, 'seed')`);
linhas.push("  returning id into v_id;");
linhas.push("");
linhas.push("  insert into sienge_eap_item (versao_id, codigo, descricao, nivel, unidade, folha) values");
linhas.push(itens.map((i) =>
  `    (v_id, ${s(i.codigo)}, ${s(i.descricao)}, ${i.nivel}, ${s(i.unidade)}, ${i.folha})`).join(",\n") + ";");
linhas.push("");
linhas.push("  insert into sienge_eap_mapa (versao_id, verba_num, codigo, definido_por) values");
linhas.push(Object.entries(MAPA_INICIAL).map(([verba, codigo]) =>
  `    (v_id, ${s(verba)}, ${s(codigo)}, 'seed')`).join(",\n") + ";");
linhas.push("end $$;");

console.log(linhas.join("\n"));
