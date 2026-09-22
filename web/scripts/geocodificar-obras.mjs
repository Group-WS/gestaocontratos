#!/usr/bin/env node
/* Geocodifica as obras do Sienge para o mapa do Início (ObrasMap).
 *
 * Roda com (na raiz do repositório):
 *   GOOGLE_MAPS_GEOCODING_KEY=... node web/scripts/geocodificar-obras.mjs
 *
 * O QUE FAZ
 *   1. Lê as obras de supabase/sienge_obra.sql (código, cidade, UF e o
 *      endereço completo do Sienge) — não precisa de acesso ao banco.
 *   2. Pergunta ao Google Geocoding o ENDEREÇO de cada uma. Se ele não
 *      achar, ou achar fora da UF da obra, pergunta pela CIDADE (o pino
 *      fica no centro dela e a linha sai marcada como 'cidade').
 *   3. Escreve supabase/sienge-obra-coordenadas-dados.sql com um UPDATE por
 *      obra. Nada é gravado no banco por aqui: você revisa o arquivo e roda
 *      no SQL Editor, depois de supabase/sienge-obra-coordenadas.sql.
 *
 * A CHAVE
 *   Não é a VITE_GOOGLE_MAPS_API_KEY do app: aquela é restrita por domínio
 *   (HTTP referrer) e o Google recusa a chamada que vem daqui. Use uma chave
 *   só com a Geocoding API, restrita ao seu IP, e apague depois. Ela não é
 *   gravada em arquivo nenhum.
 *
 * RETOMAR
 *   As respostas ficam em web/scripts/.geocodificacao-cache.json (fora do
 *   git): rodar de novo não repete consulta já feita. Apague o arquivo para
 *   consultar tudo de novo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..", "..");
const ORIGEM = path.join(raiz, "supabase", "sienge_obra.sql");
const DESTINO = path.join(raiz, "supabase", "sienge-obra-coordenadas-dados.sql");
const CACHE = path.join(aqui, ".geocodificacao-cache.json");

const chave = process.env.GOOGLE_MAPS_GEOCODING_KEY;
if (!chave) {
  console.error("Falta GOOGLE_MAPS_GEOCODING_KEY (uma chave com a Geocoding API). Veja o comentário no topo do script.");
  process.exit(1);
}

/* ---------- 1. As obras, lidas do INSERT do sienge_obra.sql ---------- */
// Cada linha do VALUES: ('codigo', 'nome', 'cidade', 'UF', 'endereço' | null),
// Aspas simples dentro do texto vêm dobradas (''), como no SQL.
const TEXTO = "'((?:[^']|'')*)'";
const LINHA = new RegExp(`^\\s*\\(${TEXTO},\\s*${TEXTO},\\s*${TEXTO},\\s*${TEXTO},\\s*(?:${TEXTO}|null)\\)`, "i");
const tirarAspas = (s) => (s == null ? null : s.replace(/''/g, "'"));

const obras = fs.readFileSync(ORIGEM, "utf8").split("\n")
  .map((l) => l.match(LINHA))
  .filter(Boolean)
  .map((m) => ({ codigo: tirarAspas(m[1]), cidade: tirarAspas(m[3]), uf: tirarAspas(m[4]).toUpperCase(), endereco: tirarAspas(m[5]) }));

if (!obras.length) {
  console.error(`Nenhuma obra encontrada em ${ORIGEM}.`);
  process.exit(1);
}

/* ---------- 2. O Google, com cache e conferência ---------- */
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
const guardar = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function perguntar(consulta, uf) {
  const chaveCache = `${uf}|${consulta}`;
  if (chaveCache in cache) return cache[chaveCache];
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", consulta);
  url.searchParams.set("components", `country:BR|administrative_area:${uf}`);
  url.searchParams.set("region", "br");
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("key", chave);
  const resposta = await fetch(url);
  const corpo = await resposta.json();
  if (corpo.status === "REQUEST_DENIED" || corpo.status === "OVER_QUERY_LIMIT") {
    // Erro da chave ou da cota: parar, sem gravar no cache (dá para retomar).
    throw new Error(`Google respondeu ${corpo.status}: ${corpo.error_message || "sem detalhe"}`);
  }
  const r = corpo.results?.[0];
  const achado = r ? {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    tipo: r.geometry.location_type,
    uf: r.address_components.find((c) => c.types.includes("administrative_area_level_1"))?.short_name || null,
    parcial: !!r.partial_match,
  } : null;
  cache[chaveCache] = achado;
  guardar();
  await esperar(60); // ~15 consultas por segundo, bem abaixo do limite
  return achado;
}

// Só vale resultado no Brasil, na UF da obra e fora do (0, 0).
const valido = (a, uf) => a && a.uf === uf && !(a.lat === 0 && a.lng === 0)
  && a.lat >= -34 && a.lat <= 6 && a.lng >= -74 && a.lng <= -28;

// O endereço do Sienge às vezes é só "Cidade - UF": aí não há o que buscar
// além da cidade.
const soCidade = (o) => !o.endereco || o.endereco.replace(/\s+/g, " ").trim().toLowerCase()
  === `${o.cidade} - ${o.uf}`.toLowerCase();

const linhas = [];
const contagem = { endereco: 0, cidade: 0, sem: 0 };
for (const [i, o] of obras.entries()) {
  let achado = null;
  let precisao = null;
  if (!soCidade(o)) {
    const a = await perguntar(o.endereco, o.uf);
    // ROOFTOP / RANGE_INTERPOLATED = o número da rua; GEOMETRIC_CENTER da
    // rua também serve. APPROXIMATE é "a cidade", e vira 'cidade'.
    if (valido(a, o.uf) && a.tipo !== "APPROXIMATE") { achado = a; precisao = "endereco"; }
  }
  if (!achado) {
    const c = await perguntar(`${o.cidade}, ${o.uf}, Brasil`, o.uf);
    if (valido(c, o.uf)) { achado = c; precisao = "cidade"; }
  }
  if (achado) {
    contagem[precisao] += 1;
    const lat = achado.lat.toFixed(6);
    const lng = achado.lng.toFixed(6);
    linhas.push(`update public.sienge_obra set lat = ${lat}, lng = ${lng}, geo_precisao = '${precisao}' where codigo = '${o.codigo.replace(/'/g, "''")}';`);
  } else {
    contagem.sem += 1;
    linhas.push(`-- ${o.codigo}: sem coordenada (endereço e cidade não encontrados em ${o.uf})`);
  }
  if ((i + 1) % 50 === 0) console.log(`${i + 1}/${obras.length}…`);
}

/* ---------- 3. O arquivo para o SQL Editor ---------- */
const cabecalho = `-- ============================================================
-- SIENGE_OBRA · COORDENADAS (dados) — gerado por web/scripts/geocodificar-obras.mjs
-- Rode DEPOIS de supabase/sienge-obra-coordenadas.sql. Reaplicável.
-- ${obras.length} obras: ${contagem.endereco} pelo endereço, ${contagem.cidade} pela cidade, ${contagem.sem} sem coordenada.
-- Revise antes de rodar: é dado de terceiro (Google), não do Sienge.
-- ============================================================
begin;
`;
fs.writeFileSync(DESTINO, `${cabecalho}${linhas.join("\n")}\ncommit;\n`);
console.log(`\n${obras.length} obras · ${contagem.endereco} pelo endereço · ${contagem.cidade} pela cidade · ${contagem.sem} sem coordenada`);
console.log(`Arquivo: ${path.relative(raiz, DESTINO)}`);
