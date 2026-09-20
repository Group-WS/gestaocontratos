// Leitura estrutural das migrations: tabelas, RLS, policies, funções, views, índices e FKs.
// Não é um parser completo de SQL — é o suficiente para as regras SQL-10…SQL-30, com posição
// (linha) de cada achado para o relatório e para os escapes.

const IDENT = String.raw`(?:"([^"]+)"|([A-Za-z_][\w$]*))`
const NOME = String.raw`${IDENT}(?:\s*\.\s*${IDENT})?`

/** Normaliza `schema.nome` a partir dos grupos de captura de NOME (4 grupos). */
function chaveDe(g1, g2, g3, g4) {
  const a = g1 ?? g2
  const b = g3 ?? g4
  return b ? { schema: a.toLowerCase(), nome: b.toLowerCase() } : { schema: 'public', nome: a.toLowerCase() }
}

/**
 * Devolve duas versões do SQL com o MESMO comprimento do original (posições preservadas):
 * - `semComentarios`: comentários viram espaços;
 * - `semCorpos`: além disso, conteúdo de strings e de corpos `$tag$…$tag$` vira espaço.
 */
export function mascarar(sql) {
  const semComentarios = sql.split('')
  const semCorpos = sql.split('')
  const branco = (arr, i) => {
    if (arr[i] !== '\n') arr[i] = ' '
  }
  let i = 0
  while (i < sql.length) {
    const c = sql[i]
    const d = sql[i + 1]
    if (c === '-' && d === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        branco(semComentarios, i)
        branco(semCorpos, i)
        i++
      }
    } else if (c === '/' && d === '*') {
      let profundidade = 0
      do {
        if (sql[i] === '/' && sql[i + 1] === '*') profundidade++
        if (sql[i] === '*' && sql[i + 1] === '/') {
          profundidade--
          branco(semComentarios, i), branco(semCorpos, i)
          i++
        }
        branco(semComentarios, i)
        branco(semCorpos, i)
        i++
      } while (i < sql.length && profundidade > 0)
    } else if (c === "'") {
      i++
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          branco(semCorpos, i), branco(semCorpos, i + 1)
          i += 2
          continue
        }
        if (sql[i] === "'") break
        branco(semCorpos, i)
        i++
      }
      i++
    } else if (c === '$') {
      const m = /^\$([A-Za-z_]\w*)?\$/.exec(sql.slice(i))
      if (!m) {
        i++
        continue
      }
      const tag = m[0]
      const fim = sql.indexOf(tag, i + tag.length)
      const limite = fim === -1 ? sql.length : fim
      for (let j = i + tag.length; j < limite; j++) branco(semCorpos, j)
      i = fim === -1 ? sql.length : fim + tag.length
    } else {
      i++
    }
  }
  return { semComentarios: semComentarios.join(''), semCorpos: semCorpos.join('') }
}

/** Divide por `;` de nível superior (sobre `semCorpos`), devolvendo offsets. */
function declaracoes(semCorpos) {
  const lista = []
  let inicio = 0
  for (let i = 0; i <= semCorpos.length; i++) {
    if (i === semCorpos.length || semCorpos[i] === ';') {
      const trecho = semCorpos.slice(inicio, i)
      if (trecho.trim()) {
        const desloc = trecho.search(/\S/)
        lista.push({ inicio: inicio + desloc, fim: i })
      }
      inicio = i + 1
    }
  }
  return lista
}

function criarLocalizador(texto) {
  const quebras = []
  for (let i = 0; i < texto.length; i++) if (texto[i] === '\n') quebras.push(i)
  return (offset) => {
    let baixo = 0
    let alto = quebras.length
    while (baixo < alto) {
      const meio = (baixo + alto) >> 1
      if (quebras[meio] < offset) baixo = meio + 1
      else alto = meio
    }
    return baixo + 1 // linha 1-based
  }
}

/** Divide o corpo de `create table (…)` em partes de nível superior, com offset relativo. */
function partesDoCorpo(corpo) {
  const partes = []
  let profundidade = 0
  let inicio = 0
  for (let i = 0; i <= corpo.length; i++) {
    const c = corpo[i]
    if (c === '(') profundidade++
    else if (c === ')') profundidade--
    if (i === corpo.length || (c === ',' && profundidade === 0)) {
      const texto = corpo.slice(inicio, i)
      const desloc = texto.search(/\S/)
      if (desloc !== -1) partes.push({ texto: texto.trim(), offset: inicio + desloc })
      inicio = i + 1
    }
  }
  return partes
}

function fechamento(texto, abre) {
  let profundidade = 0
  for (let i = abre; i < texto.length; i++) {
    if (texto[i] === '(') profundidade++
    else if (texto[i] === ')') {
      profundidade--
      if (profundidade === 0) return i
    }
  }
  return texto.length
}

const RE_TIPO_SEM_FUSO = /\btimestamp\b(?:\s*\(\s*\d+\s*\))?(?!\s+with\s+time\s+zone)/i
const RE_TIPO_FLUTUANTE = /\b(float4|float8|float|real|double\s+precision|money)\b/i

export function analisarMigrations(ctx) {
  const pasta = ctx.manifesto.caminhos.migrations
  const arquivos = ctx.todos.filter((rel) => ctx.dentroDe(rel, [pasta]) && rel.endsWith('.sql')).sort()

  const tabelas = new Map()
  const policies = []
  const funcoes = []
  const views = []
  const tiposProibidos = []
  const indexadas = new Map() // chave → Set(primeira coluna)
  const fks = [] // { chave, coluna, arquivo, linha }
  const invokerTardio = new Set()

  const tabela = (chave) => {
    const k = `${chave.schema}.${chave.nome}`
    if (!tabelas.has(k)) tabelas.set(k, { ...chave, chave: k, arquivo: null, linha: null, rls: false, removida: false })
    return tabelas.get(k)
  }
  const indexar = (k, coluna) => {
    if (!indexadas.has(k)) indexadas.set(k, new Set())
    indexadas.get(k).add(coluna.toLowerCase().replace(/"/g, ''))
  }

  for (const arquivo of arquivos) {
    const sql = ctx.ler(arquivo)
    const { semComentarios, semCorpos } = mascarar(sql)
    const linhaDe = criarLocalizador(sql)

    for (const { inicio, fim } of declaracoes(semCorpos)) {
      const s = semCorpos.slice(inicio, fim)
      const sc = semComentarios.slice(inicio, fim)
      const linha = linhaDe(inicio)
      let m

      if ((m = new RegExp(String.raw`^create\s+(?:(?:global|local)\s+)?(temp(?:orary)?\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?${NOME}\s*\(`, 'i').exec(s))) {
        if (m[1] && /temp/i.test(m[1])) continue
        const chave = chaveDe(m[2], m[3], m[4], m[5])
        const t = tabela(chave)
        Object.assign(t, { arquivo, linha, removida: false })
        const abre = m[0].length - 1
        const corpo = s.slice(abre + 1, fechamento(s, abre))
        for (const parte of partesDoCorpo(corpo)) {
          const offsetAbs = inicio + abre + 1 + parte.offset
          const linhaParte = linhaDe(offsetAbs)
          const texto = parte.texto.replace(/^constraint\s+\S+\s+/i, '')
          let p
          if ((p = /^primary\s+key\s*\(\s*"?(\w+)"?/i.exec(texto))) indexar(t.chave, p[1])
          else if ((p = /^unique\s*(?:nulls\s+(?:not\s+)?distinct\s*)?\(\s*"?(\w+)"?/i.exec(texto))) indexar(t.chave, p[1])
          else if ((p = /^foreign\s+key\s*\(\s*"?(\w+)"?/i.exec(texto))) fks.push({ chave: t.chave, coluna: p[1].toLowerCase(), arquivo, linha: linhaParte })
          else if (/^(check|exclude|like)\b/i.test(texto)) continue
          else if ((p = /^"?(\w+)"?\s+([\s\S]*)$/.exec(texto))) {
            const [, coluna, definicao] = p
            if (/\breferences\b/i.test(definicao)) fks.push({ chave: t.chave, coluna: coluna.toLowerCase(), arquivo, linha: linhaParte })
            if (/\bprimary\s+key\b|\bunique\b/i.test(definicao)) indexar(t.chave, coluna)
            const tipo = definicao.split(/\b(?:not\s+null|null|default|references|check|primary|unique|generated|constraint|collate)\b/i)[0]
            if (RE_TIPO_SEM_FUSO.test(tipo) || RE_TIPO_FLUTUANTE.test(tipo)) {
              tiposProibidos.push({ arquivo, linha: linhaParte, coluna, tipo: tipo.trim(), tabela: t.chave })
            }
          }
        }
        continue
      }

      if ((m = new RegExp(String.raw`^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${NOME}\s+([\s\S]*)$`, 'i').exec(s))) {
        const chave = chaveDe(m[1], m[2], m[3], m[4])
        const k = `${chave.schema}.${chave.nome}`
        const resto = m[5]
        const offsetResto = inicio + m[0].length - resto.length
        if (/\benable\s+row\s+level\s+security\b/i.test(resto)) tabela(chave).rls = true
        if (/\bdisable\s+row\s+level\s+security\b/i.test(resto)) tabela(chave).rls = false
        const renomeia = new RegExp(String.raw`^rename\s+to\s+${IDENT}`, 'i').exec(resto)
        if (renomeia && tabelas.has(k)) {
          const novo = { schema: chave.schema, nome: (renomeia[1] ?? renomeia[2]).toLowerCase() }
          const antigo = tabelas.get(k)
          tabelas.delete(k)
          tabelas.set(`${novo.schema}.${novo.nome}`, { ...antigo, ...novo, chave: `${novo.schema}.${novo.nome}` })
        }
        let p
        const reFk = /foreign\s+key\s*\(\s*"?(\w+)"?/gi
        while ((p = reFk.exec(resto))) fks.push({ chave: k, coluna: p[1].toLowerCase(), arquivo, linha: linhaDe(offsetResto + p.index) })
        const reIdx = /(?:primary\s+key|unique)\s*(?:nulls\s+(?:not\s+)?distinct\s*)?\(\s*"?(\w+)"?/gi
        while ((p = reIdx.exec(resto))) indexar(k, p[1])
        const reColuna = /add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?\s+([^,]*)/gi
        while ((p = reColuna.exec(resto))) {
          const linhaColuna = linhaDe(offsetResto + p.index)
          if (/\breferences\b/i.test(p[2])) fks.push({ chave: k, coluna: p[1].toLowerCase(), arquivo, linha: linhaColuna })
          if (/\bprimary\s+key\b|\bunique\b/i.test(p[2])) indexar(k, p[1])
          const tipo = p[2].split(/\b(?:not\s+null|null|default|references|check|primary|unique|generated|constraint|collate)\b/i)[0]
          if (RE_TIPO_SEM_FUSO.test(tipo) || RE_TIPO_FLUTUANTE.test(tipo)) {
            tiposProibidos.push({ arquivo, linha: linhaColuna, coluna: p[1], tipo: tipo.trim(), tabela: k })
          }
        }
        continue
      }

      if ((m = /^drop\s+table\s+(?:if\s+exists\s+)?([\s\S]*)$/i.exec(s))) {
        for (const alvo of m[1].replace(/\b(cascade|restrict)\b/gi, '').split(',')) {
          const n = new RegExp(String.raw`^\s*${NOME}\s*$`).exec(alvo)
          if (n) tabela(chaveDe(n[1], n[2], n[3], n[4])).removida = true
        }
        continue
      }

      if ((m = new RegExp(String.raw`^create\s+policy\s+(?:"[^"]+"|\w+)\s+on\s+${NOME}([\s\S]*)$`, 'i').exec(s))) {
        const chave = chaveDe(m[1], m[2], m[3], m[4])
        policies.push({ tabela: `${chave.schema}.${chave.nome}`, arquivo, linha, clausulas: m[5], texto: sc, inicio, fonte: sql })
        continue
      }

      if ((m = new RegExp(String.raw`^create\s+(?:or\s+replace\s+)?function\s+${NOME}\s*\(`, 'i').exec(s))) {
        const chave = chaveDe(m[1], m[2], m[3], m[4])
        funcoes.push({ nome: `${chave.schema}.${chave.nome}`, arquivo, linha, cabecalho: s, texto: sc })
        continue
      }

      if ((m = new RegExp(String.raw`^create\s+(?:or\s+replace\s+)?(?:(?:temp|temporary)\s+)?(materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?${NOME}([\s\S]*)$`, 'i').exec(s))) {
        const chave = chaveDe(m[2], m[3], m[4], m[5])
        const antesDoAs = m[6].split(/\bas\b/i)[0]
        views.push({
          chave: `${chave.schema}.${chave.nome}`,
          schema: chave.schema,
          materializada: !!m[1],
          invoker: /security_invoker\s*(?:=\s*(?:true|on|1|yes)\s*)?[,)]/i.test(antesDoAs),
          arquivo,
          linha,
        })
        continue
      }

      if ((m = new RegExp(String.raw`^alter\s+view\s+(?:if\s+exists\s+)?${NOME}\s+set\s*\(([^)]*)\)`, 'i').exec(s))) {
        if (/security_invoker\s*(?:=\s*(?:true|on|1|yes))?\s*$/i.test(m[5].trim()) || /security_invoker\s*=\s*(true|on)/i.test(m[5])) {
          const chave = chaveDe(m[1], m[2], m[3], m[4])
          invokerTardio.add(`${chave.schema}.${chave.nome}`)
        }
        continue
      }

      if ((m = new RegExp(String.raw`^create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(?:(?:"[^"]+"|\w+)\s+)?on\s+(?:only\s+)?${NOME}\s*(?:using\s+\w+\s*)?\(\s*"?(\w+)"?`, 'i').exec(s))) {
        const chave = chaveDe(m[1], m[2], m[3], m[4])
        indexar(`${chave.schema}.${chave.nome}`, m[5])
      }
    }
  }

  for (const v of views) if (invokerTardio.has(v.chave)) v.invoker = true

  return { arquivos, tabelas, policies, funcoes, views, fks, indexadas, tiposProibidos }
}

/** Análise memoizada por execução do gate (várias regras leem as mesmas migrations). */
export const migracoesDo = (ctx) => (ctx.cacheMigrations ??= analisarMigrations(ctx))
