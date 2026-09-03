-- ============================================================
-- DESCRIÇÃO REPETIDA NO CATÁLOGO — limpeza do que já existe
-- Supabase -> SQL Editor -> rode em duas etapas, uma de cada vez.
-- ============================================================

-- "unaccent" é extensão padrão do Postgres/Supabase — deixa a
-- comparação igual à que a tela já faz: ignora acento, caixa e espaço
-- sobrando. "MDF Freijó" e "mdf   freijó." contam como o MESMO produto.
create extension if not exists unaccent;

-- ------------------------------------------------------------
-- ETAPA 1 — SÓ MOSTRA. Rode isto primeiro e veja o tamanho do problema
-- antes de desativar qualquer coisa.
-- ------------------------------------------------------------
select
  regexp_replace(
    regexp_replace(lower(unaccent(trim(descricao))), '[.,;:!?]+$', ''),
    '\s+', ' ', 'g'
  ) as descricao_normalizada,
  count(*) as quantas,
  array_agg(id order by criado_em)                          as ids,
  array_agg(coalesce(fornecedor, '—') order by criado_em)    as fornecedores
from catalogo_produto
where ativo is distinct from false
group by 1
having count(*) > 1
order by quantas desc;

-- ------------------------------------------------------------
-- ETAPA 2 — A LIMPEZA. Pra cada grupo de descrição repetida, mantém UM
-- ativo e desativa o resto. A escolha de qual manter, nesta ordem:
--   1) o que tem foto
--   2) entre os que sobraram, o que tem preço de referência
--   3) entre os que sobraram, o mais antigo (o primeiro cadastrado)
--
-- NÃO APAGA NADA. Desativa (ativo = false) — o mesmo campo que a tela já
-- usa pra esconder produto do catálogo. É reversível: pra trazer um de
-- volta, "update catalogo_produto set ativo = true where id = '...';"
-- ------------------------------------------------------------
with grupos as (
  select
    id,
    row_number() over (
      partition by regexp_replace(
        regexp_replace(lower(unaccent(trim(descricao))), '[.,;:!?]+$', ''),
        '\s+', ' ', 'g'
      )
      order by (imagem is not null) desc, (preco_ref is not null) desc, criado_em asc
    ) as ordem
  from catalogo_produto
  where ativo is distinct from false
)
update catalogo_produto p
set ativo = false
from grupos g
where p.id = g.id and g.ordem > 1;

-- Confere o resultado:
--   select count(*) as desativados_agora from catalogo_produto where ativo = false;
