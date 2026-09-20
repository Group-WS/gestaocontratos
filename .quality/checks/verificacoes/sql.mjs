// SQL-02 · SQL-10 · SQL-11 · SQL-12 · SQL-13 · SQL-14 · SQL-15 · SQL-21 · SQL-30 · SQL-32

import { migracoesDo as migrations } from '../lib/sql.mjs'
import { varrerLinhas } from '../lib/contexto.mjs'
import { refDeComparacao } from '../lib/comparacao.mjs'

const DOC = '07-supabase-e-sql.md'

const exposta = (ctx, schema) => ctx.manifesto.supabase.schemasExpostos.includes(schema)
const primeiraLinha = (ctx, arquivo, linha) => (ctx.linhas(arquivo)[linha - 1] ?? '').trim()

export default [
  {
    id: 'SQL-02',
    titulo: 'Migration aplicada não se edita',
    doc: DOC,
    correcao: 'Desfaça a alteração na migration antiga e escreva uma migration nova com a correção.',
    executar(ctx) {
      const comparacao = refDeComparacao(ctx, { paraRegrasDeNegocio: false })
      if (!comparacao) {
        ctx.avisos.push('SQL-02 não verificada: sem branch base no git para comparar.')
        return []
      }
      const alterados = ctx.git.alterados({ ...comparacao, caminhos: [ctx.manifesto.caminhos.migrations] }) ?? []
      return alterados
        .filter((a) => ['M', 'D', 'R'].includes(a.status) && a.caminhoAntigo.endsWith('.sql'))
        .filter((a) => ctx.git.existeNoRef(comparacao.ref, a.caminhoAntigo))
        .filter((a) => !ctx.escapado(a.caminho, 0, 'SQL-02'))
        .map((a) => ({
          arquivo: a.caminhoAntigo,
          linha: 1,
          trecho: { M: 'migration existente alterada', D: 'migration existente removida', R: `migration renomeada para ${a.caminho}` }[a.status],
        }))
    },
  },
  {
    id: 'SQL-10',
    titulo: 'RLS em toda tabela exposta',
    doc: DOC,
    correcao: 'Adicione `alter table <tabela> enable row level security;` numa migration nova, com as policies do caso de uso.',
    executar(ctx) {
      const violacoes = []
      for (const t of migrations(ctx).tabelas.values()) {
        if (!t.arquivo || t.removida || t.rls || !exposta(ctx, t.schema)) continue
        if (ctx.escapado(t.arquivo, t.linha - 1, 'SQL-10')) continue
        violacoes.push({ arquivo: t.arquivo, linha: t.linha, trecho: primeiraLinha(ctx, t.arquivo, t.linha), mensagem: `${t.chave} sem RLS` })
      }
      return violacoes
    },
  },
  {
    id: 'SQL-11',
    titulo: 'Policy com papel explícito',
    doc: DOC,
    correcao: 'Declare o papel (`to authenticated`, `to anon`…) e uma policy por operação.',
    executar(ctx) {
      return migrations(ctx)
        .policies.filter((p) => !/\bto\s+[\w"]/i.test(p.clausulas))
        .filter((p) => !ctx.escapado(p.arquivo, p.linha - 1, 'SQL-11'))
        .map((p) => ({ arquivo: p.arquivo, linha: p.linha, trecho: primeiraLinha(ctx, p.arquivo, p.linha), mensagem: `policy em ${p.tabela} sem papel (to …)` }))
    },
  },
  {
    id: 'SQL-12',
    titulo: 'Função em policy dentro de select',
    doc: DOC,
    correcao: 'Troque `auth.uid()` por `(select auth.uid())` (idem `auth.jwt()`): avaliação uma vez por consulta, não por linha.',
    executar(ctx) {
      const violacoes = []
      for (const p of migrations(ctx).policies) {
        const achou = [...p.texto.matchAll(/\bauth\s*\.\s*(uid|jwt)\s*\(\s*\)/gi)].some((m) => {
          const antes = p.texto.slice(0, m.index).replace(/\(\s*$/, '')
          return !/\bselect\s*$/i.test(antes)
        })
        if (!achou || ctx.escapado(p.arquivo, p.linha - 1, 'SQL-12')) continue
        violacoes.push({ arquivo: p.arquivo, linha: p.linha, trecho: primeiraLinha(ctx, p.arquivo, p.linha), mensagem: `policy em ${p.tabela}` })
      }
      return violacoes
    },
  },
  {
    id: 'SQL-13',
    titulo: 'Metadado do usuário não decide acesso',
    doc: DOC,
    correcao: 'Leia papel e organização de tabelas próprias (com RLS) ou de `app_metadata`, nunca de `user_metadata`.',
    executar(ctx) {
      const { policies, funcoes } = migrations(ctx)
      return [...policies, ...funcoes]
        .filter((d) => /\b(raw_user_meta_data|user_metadata)\b/i.test(d.texto))
        .filter((d) => !ctx.escapado(d.arquivo, d.linha - 1, 'SQL-13'))
        .map((d) => ({ arquivo: d.arquivo, linha: d.linha, trecho: primeiraLinha(ctx, d.arquivo, d.linha) }))
    },
  },
  {
    id: 'SQL-14',
    titulo: 'Função security definer blindada',
    doc: DOC,
    correcao: "Adicione `set search_path = ''` e qualifique os nomes (`public.tabela`, `auth.uid()`).",
    executar(ctx) {
      return migrations(ctx)
        .funcoes.filter((f) => /\bsecurity\s+definer\b/i.test(f.cabecalho) && !/\bset\s+search_path\b/i.test(f.cabecalho))
        .filter((f) => !ctx.escapado(f.arquivo, f.linha - 1, 'SQL-14'))
        .map((f) => ({ arquivo: f.arquivo, linha: f.linha, trecho: primeiraLinha(ctx, f.arquivo, f.linha), mensagem: `${f.nome} sem search_path` }))
    },
  },
  {
    id: 'SQL-15',
    titulo: 'View respeita RLS',
    doc: DOC,
    correcao: 'Crie a view `with (security_invoker = true)`; materialized view vai para schema não exposto e é servida por função com checagem de acesso.',
    executar(ctx) {
      return migrations(ctx)
        .views.filter((v) => exposta(ctx, v.schema) && (v.materializada || !v.invoker))
        .filter((v) => !ctx.escapado(v.arquivo, v.linha - 1, 'SQL-15'))
        .map((v) => ({
          arquivo: v.arquivo,
          linha: v.linha,
          trecho: primeiraLinha(ctx, v.arquivo, v.linha),
          mensagem: v.materializada ? `materialized view ${v.chave} em schema exposto` : `${v.chave} sem security_invoker`,
        }))
    },
  },
  {
    id: 'SQL-21',
    titulo: 'Tipos certos',
    doc: DOC,
    correcao: 'Use `timestamptz` para data e hora e `numeric(p, s)` para dinheiro e valores exatos.',
    executar(ctx) {
      return migrations(ctx)
        .tiposProibidos.filter((t) => !ctx.escapado(t.arquivo, t.linha - 1, 'SQL-21'))
        .map((t) => ({ arquivo: t.arquivo, linha: t.linha, trecho: primeiraLinha(ctx, t.arquivo, t.linha), mensagem: `${t.tabela}.${t.coluna}: ${t.tipo}` }))
    },
  },
  {
    id: 'SQL-30',
    titulo: 'Índice em toda chave estrangeira',
    doc: DOC,
    correcao: 'Crie um índice que comece pela coluna da FK (ou coloque-a primeiro num índice composto já existente).',
    executar(ctx) {
      const { fks, indexadas, tabelas } = migrations(ctx)
      const vistas = new Set()
      const violacoes = []
      for (const fk of fks) {
        const chave = `${fk.chave}.${fk.coluna}`
        if (vistas.has(chave) || tabelas.get(fk.chave)?.removida) continue
        vistas.add(chave)
        if (indexadas.get(fk.chave)?.has(fk.coluna)) continue
        if (ctx.escapado(fk.arquivo, fk.linha - 1, 'SQL-30')) continue
        violacoes.push({ arquivo: fk.arquivo, linha: fk.linha, trecho: primeiraLinha(ctx, fk.arquivo, fk.linha), mensagem: `${fk.chave}.${fk.coluna} sem índice` })
      }
      return violacoes
    },
  },
  {
    id: 'SQL-32',
    titulo: 'Só as colunas usadas',
    doc: DOC,
    correcao: "Liste as colunas: `.select('id, name, status')`.",
    executar: (ctx) =>
      varrerLinhas(
        ctx,
        [...new Set(ctx.codigo({ areas: ['frontend', 'api', 'regras'] }))],
        'SQL-32',
        /\.select\(\s*(['"`])\s*\*\s*(?:\1|,)/,
      ),
  },
]
