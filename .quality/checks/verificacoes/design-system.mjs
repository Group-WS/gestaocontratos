// DS-01 · DS-03 … DS-11 · DS-13

import { EXTENSOES_CODIGO, EXTENSOES_UI, importsDe, posix } from '../lib/arquivos.mjs'
import { varrerLinhas } from '../lib/contexto.mjs'

const DOC = '05-design-system.md'

const CORES_TAILWIND =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const PREFIXOS_DE_COR =
  'bg|text|border|border-[xytrblse]|ring|ring-offset|fill|stroke|from|via|to|divide|outline|shadow|decoration|caret|accent|placeholder'
const RE_PALETA = new RegExp(String.raw`(?:^|[\s"'\`{(:!])(?:${PREFIXOS_DE_COR})-(?:(?:${CORES_TAILWIND})-(?:50|[1-9]00|950)|white|black)(?:\/\d+)?(?![\w-])`)
const RE_HEX_EXATO = /(['"`])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\1/
const RE_HEX_ARBITRARIO = /-\[#[0-9a-fA-F]{3,8}\]/
const RE_HEX_EMBUTIDO = /(?<![\w&/#-])#(?=[0-9a-fA-F]*[a-fA-F])(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/
const RE_FUNCAO_DE_COR = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*(?!var\()/
const RE_CSS_HEX = /:\s*[^;]*#[0-9a-fA-F]{3,8}\b/

const RE_ARBITRARIO = /(?:^|[\s"'`{(])!?(?:[a-z-]+:)*-?[a-z][a-z0-9-]*-\[(?!var\(|--)[^\]\s]+\](?!:)/
const RE_STYLE = /\bstyle=\{|\bstyle="/
const PROPS_DE_ESPACO =
  'p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|start|end|w|h|size|min-w|min-h|max-w|max-h|translate-x|translate-y|scroll-m|scroll-p|basis'
const RE_FRACIONADO = new RegExp(String.raw`(?:^|[\s"'\`{(:!])-?(?:${PROPS_DE_ESPACO})-\d+\.5(?![\w.-])`)
const RE_ELEMENTO_NATIVO = /<(button|input|select|textarea|table|dialog|h1)(?=[\s>/])/
const RE_DARK = /(?:^|[\s"'`{(])dark:[a-z!-]/

const BIBLIOTECAS_PROIBIDAS = [
  '@mui/', '@material-ui/', 'antd', '@ant-design/', '@chakra-ui/', '@mantine/', 'primereact', 'react-bootstrap',
  'bootstrap', '@headlessui/', '@radix-ui/', 'react-icons', '@heroicons/', '@fortawesome/', 'phosphor-react',
  '@phosphor-icons/', '@tabler/icons-react', 'react-feather', 'react-toastify', 'react-hot-toast', 'sweetalert2',
  'sweetalert', 'notistack', '@nextui-org/', '@heroui/', '@ark-ui/', '@base-ui-components/', '@base-ui/',
  'react-aria-components', 'flowbite-react', 'daisyui',
]
const FAMILIAS_GENERICAS = new Set([
  'inherit', 'initial', 'unset', 'revert', 'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong', '-apple-system',
  'blinkmacsystemfont',
])

// Imagens de metadados do Next.js (next/og) só aceitam estilo inline: ficam fora das regras de UI.
const RE_IMAGEM_DE_METADADOS = /(^|\/)(?:opengraph-image|twitter-image|icon|apple-icon)\.[jt]sx?$/
const semImagensDeMetadados = (arquivos) => arquivos.filter((rel) => !RE_IMAGEM_DE_METADADOS.test(rel))
const appUi = (ctx) => semImagensDeMetadados(ctx.codigo({ areas: ['frontend'], extensoes: EXTENSOES_UI }))
const appCodigo = (ctx) => semImagensDeMetadados(ctx.codigo({ areas: ['frontend'] }))
const appCodigoECss = (ctx) =>
  semImagensDeMetadados(ctx.codigo({ areas: ['frontend'], extensoes: new Set([...EXTENSOES_CODIGO, '.css']) }))

export default [
  {
    id: 'DS-01',
    titulo: 'Design system vinculado',
    doc: DOC,
    correcao: 'Vincule o `@group-ws/ws-ui` (pacote ou cópia via create-app) e declare em `designSystem` no manifesto.',
    executar(ctx) {
      const ds = ctx.manifesto.designSystem
      const violacoes = []
      if (ds.vinculo === 'pacote') {
        const pacotes = ctx.todos.filter((rel) => rel === 'package.json' || rel.endsWith('/package.json'))
        const relevantes = pacotes.filter((rel) => {
          const dir = posix.dirname(rel)
          return dir === '.' || ctx.manifesto.caminhos.frontend.some((f) => f === dir || f.startsWith(`${dir}/`))
        })
        const declara = relevantes.some((rel) => {
          try {
            const pkg = JSON.parse(ctx.ler(rel))
            return !!(pkg.dependencies?.[ds.pacote] ?? pkg.devDependencies?.[ds.pacote])
          } catch {
            return false
          }
        })
        if (!declara) {
          violacoes.push({ arquivo: relevantes[0] ?? 'package.json', linha: 1, trecho: `${ds.pacote} não está nas dependências do front` })
        }
      } else {
        for (const pasta of ds.pastasDoDesignSystem) {
          const alvo = pasta.replace(/\/+$/, '')
          if (!ctx.todos.some((rel) => rel === alvo || rel.startsWith(`${alvo}/`))) {
            violacoes.push({ arquivo: pasta, linha: 1, trecho: 'pasta do DS declarada no manifesto não existe ou está vazia' })
          }
        }
      }
      if (ds.adr && !ctx.existe(ds.adr)) {
        violacoes.push({ arquivo: '.quality/manifest.json', linha: 1, trecho: `designSystem.adr aponta para ${ds.adr}, que não existe` })
      }
      return violacoes
    },
  },
  {
    id: 'DS-03',
    titulo: 'Cor só por token',
    doc: DOC,
    correcao: 'Troque por token do DS (`bg-surface-1`, `text-soft`, `var(--brand)`) ou pela variante do componente.',
    executar(ctx) {
      const violacoes = []
      for (const rel of appCodigoECss(ctx)) {
        const ehCss = rel.endsWith('.css')
        ctx.linhas(rel).forEach((linha, i) => {
          const t = linha.trim()
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
          const achou = ehCss
            ? RE_CSS_HEX.test(linha) || RE_FUNCAO_DE_COR.test(linha) || RE_PALETA.test(linha)
            : RE_HEX_EXATO.test(linha) || RE_HEX_ARBITRARIO.test(linha) || RE_HEX_EMBUTIDO.test(linha) ||
              RE_FUNCAO_DE_COR.test(linha) || RE_PALETA.test(linha)
          if (!achou || ctx.escapado(rel, i, 'DS-03')) return
          violacoes.push({ arquivo: rel, linha: i + 1, trecho: t })
        })
      }
      return violacoes
    },
  },
  {
    id: 'DS-04',
    titulo: 'Tipografia do DS',
    doc: DOC,
    correcao: 'Use só as famílias de `designSystem.fontes`; tamanho e peso vêm dos componentes do DS.',
    executar(ctx) {
      const permitidas = new Set(ctx.manifesto.designSystem.fontes.map((f) => f.toLowerCase()))
      const violacoes = []
      const arquivos = [
        ...appCodigoECss(ctx),
        ...ctx.todos.filter((rel) => rel.endsWith('.html') && ctx.dentroDe(rel, ctx.manifesto.caminhos.frontend.map((f) => posix.dirname(f)))),
      ]
      const registrar = (rel, i, familia) => {
        if (ctx.escapado(rel, i, 'DS-04')) return
        violacoes.push({ arquivo: rel, linha: i + 1, trecho: ctx.linhas(rel)[i].trim(), mensagem: `fonte fora do DS: ${familia}` })
      }
      for (const rel of new Set(arquivos)) {
        const conteudo = ctx.ler(rel)
        const linhas = conteudo.split('\n')
        linhas.forEach((linha, i) => {
          let m
          const reCss = /font-family\s*:\s*([^;}{]+)/gi
          while ((m = reCss.exec(linha))) {
            // Só a primeira família decide a fonte renderizada; as demais são fallback.
            const familia = m[1].split(',')[0].trim().replace(/^['"]|['"]$/g, '').replace(/\s*!important$/, '')
            if (familia && !familia.startsWith('var(') && !FAMILIAS_GENERICAS.has(familia.toLowerCase()) && !permitidas.has(familia.toLowerCase())) {
              registrar(rel, i, familia)
            }
          }
          const reGoogle = /fonts\.googleapis\.com\/css2?\?[^"'\s]*/g
          while ((m = reGoogle.exec(linha))) {
            for (const f of m[0].matchAll(/family=([^:&"']+)/g)) {
              const familia = decodeURIComponent(f[1]).replace(/\+/g, ' ')
              if (!permitidas.has(familia.toLowerCase())) registrar(rel, i, familia)
            }
          }
          const reObjeto = /fontFamily\s*:\s*['"`]([^'"`]+)['"`]/g
          while ((m = reObjeto.exec(linha))) {
            const familia = m[1].split(',')[0].trim().replace(/^['"]|['"]$/g, '')
            if (!familia.startsWith('var(') && !FAMILIAS_GENERICAS.has(familia.toLowerCase()) && !permitidas.has(familia.toLowerCase())) {
              registrar(rel, i, familia)
            }
          }
        })
        const nextFont = /import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/g
        let m
        while ((m = nextFont.exec(conteudo))) {
          const linha = conteudo.slice(0, m.index).split('\n').length - 1
          for (const nome of m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
            const familia = nome.replace(/_/g, ' ')
            if (!permitidas.has(familia.toLowerCase())) registrar(rel, linha, familia)
          }
        }
      }
      return violacoes
    },
  },
  {
    id: 'DS-05',
    titulo: 'Sem valor arbitrário e sem style inline',
    doc: DOC,
    correcao: 'Use as medidas dos componentes e utilitários do DS. Medida que o DS não oferece é lacuna (DS-12).',
    executar(ctx) {
      return [
        ...varrerLinhas(ctx, appCodigo(ctx), 'DS-05', RE_ARBITRARIO, {
          mensagem: 'classe com valor arbitrário',
        }),
        ...varrerLinhas(ctx, appUi(ctx), 'DS-05', RE_STYLE, { mensagem: 'atributo style inline' }),
      ]
    },
  },
  {
    id: 'DS-06',
    titulo: 'Régua de espaçamento de 4 px',
    doc: DOC,
    correcao: 'Troque a classe fracionada (`p-1.5`, `gap-2.5`) pelo múltiplo de 4 px mais próximo ou pelo espaçamento do componente.',
    executar: (ctx) => varrerLinhas(ctx, appCodigo(ctx), 'DS-06', RE_FRACIONADO),
  },
  {
    id: 'DS-07',
    titulo: 'Sem elemento nativo quando há componente',
    doc: DOC,
    correcao: 'Use o componente do DS: Button, Input, Select/SelectField, Textarea, EditorialTable/Table, Dialog/Sheet e o título do template.',
    executar: (ctx) =>
      varrerLinhas(ctx, appUi(ctx), 'DS-07', RE_ELEMENTO_NATIVO, {
        filtro: (linha, m) => !(m[1] === 'input' && /type=["']hidden["']/.test(linha)),
        mensagem: (m) => `<${m[1]}> nativo`,
      }),
  },
  {
    id: 'DS-08',
    titulo: 'Sem contêiner montado à mão',
    doc: DOC,
    correcao: 'Use `Card` (CardHeader, CardContent, CardFooter) ou o template da tela.',
    executar(ctx) {
      const violacoes = []
      for (const rel of appUi(ctx)) {
        ctx.linhas(rel).forEach((linha, i) => {
          if (!linha.includes('className') && !/cn\(|clsx\(/.test(linha)) return
          for (const [, texto] of linha.matchAll(/["'`]([^"'`]*)["'`]/g)) {
            const classes = texto.split(/\s+/).map((c) => c.replace(/^(?:[a-z-]+:)+/, '').replace(/^!/, ''))
            const borda = classes.some((c) => c === 'border' || /^border-(?:\d|line|\[)/.test(c))
            const raio = classes.some((c) => /^rounded(?:-|$)/.test(c) && c !== 'rounded-none')
            const respiro = classes.some((c) => /^p[xy]?-(?:\d|\[)/.test(c))
            const fundo = classes.some((c) => /^bg-/.test(c) || /^shadow(?:-|$)/.test(c))
            if (borda && raio && respiro && fundo) {
              if (!ctx.escapado(rel, i, 'DS-08')) violacoes.push({ arquivo: rel, linha: i + 1, trecho: linha.trim() })
              return
            }
          }
        })
      }
      return violacoes
    },
  },
  {
    id: 'DS-09',
    titulo: 'Sem outra biblioteca de UI, ícones ou toast',
    doc: DOC,
    correcao: 'Use os componentes do DS, ícones `lucide-react` e toast `sonner`.',
    executar(ctx) {
      const violacoes = []
      for (const rel of ctx.codigo({ areas: ['frontend'] })) {
        for (const { especificador, linha } of importsDe(ctx.ler(rel))) {
          const proibida = BIBLIOTECAS_PROIBIDAS.find((b) =>
            b.endsWith('/') ? especificador.startsWith(b) : especificador === b || especificador.startsWith(`${b}/`),
          )
          if (!proibida || ctx.escapado(rel, linha - 1, 'DS-09')) continue
          violacoes.push({ arquivo: rel, linha, trecho: ctx.linhas(rel)[linha - 1].trim(), mensagem: `import de ${especificador}` })
        }
      }
      return violacoes
    },
  },
  {
    id: 'DS-10',
    titulo: 'Sem alert, confirm ou prompt nativos',
    doc: DOC,
    correcao: 'Use ConfirmDialog, MessageDialog ou toast.',
    executar(ctx) {
      const violacoes = []
      for (const rel of ctx.codigo({ areas: ['frontend'] })) {
        const conteudo = ctx.ler(rel)
        const definidos = ['alert', 'confirm', 'prompt'].filter((nome) =>
          new RegExp(String.raw`\b(?:const|let|var|function)\s+${nome}\b|[{,]\s*${nome}\s*[,}:]|\b${nome}\s*=`).test(conteudo),
        )
        const nomes = ['alert', 'confirm', 'prompt'].filter((n) => !definidos.includes(n))
        const re = new RegExp(
          String.raw`\bwindow\.(?:alert|confirm|prompt)\s*\(` + (nomes.length ? String.raw`|(?<![\w.$])(?:${nomes.join('|')})\s*\(` : ''),
        )
        violacoes.push(...varrerLinhas(ctx, [rel], 'DS-10', re))
      }
      return violacoes
    },
  },
  {
    id: 'DS-11',
    titulo: 'Tema só por token',
    doc: DOC,
    correcao: 'Remova a variante `dark:`: os tokens do DS já mudam com `data-theme`.',
    executar: (ctx) => varrerLinhas(ctx, appCodigo(ctx), 'DS-11', RE_DARK),
  },
  {
    id: 'DS-13',
    titulo: 'Marca oficial em uso',
    doc: DOC,
    correcao: 'Use o componente da marca no shell (`<GroupWsLogo />`) ou declare `designSystem.exigirLogo: false` com a decisão registrada.',
    executar(ctx) {
      const logo = ctx.manifesto.designSystem.exigirLogo
      if (!logo) return []
      const re = new RegExp(`<${logo}\\b`)
      const usa = ctx.codigo({ areas: ['frontend'], extensoes: EXTENSOES_UI }).some((rel) => re.test(ctx.ler(rel)))
      return usa ? [] : [{ arquivo: '.quality/manifest.json', linha: 1, trecho: `<${logo} /> não é renderizado em nenhum arquivo do app` }]
    },
  },
]
