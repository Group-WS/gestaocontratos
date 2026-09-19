-- ============================================================
-- HISTORICO DE VERSOES DA OBRA  ·  19/09/2026
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
--
-- E' REAPLICAVEL: rodar de novo nao duplica nada e nao apaga nada.
-- Nenhum comando aqui altera dado existente. So' cria tabela, funcoes
-- e o gatilho.
-- ============================================================
--
-- POR QUE ISTO EXISTE
-- Em 18/09/2026, entre 16:30 e 16:32, tres obras foram esvaziadas em
-- sequencia (2204, 2450, 2195): as 33 verbas da EAP e zero itens. O app
-- gravou o esqueleto por cima da obra inteira, e o banco guardava UM
-- estado so' — o ultimo. O anterior deixou de existir no mesmo instante.
-- O backup diario do dia seguinte ja' vinha com o estrago.
--
-- A partir daqui o banco guarda a versao ANTERIOR a cada gravacao. Voltar
-- atras deixa de depender de backup.
--
-- QUEM GRAVA E' O BANCO, NAO O APP. E' de proposito: um gatilho pega
-- TODA gravacao, inclusive UPDATE rodado a mao aqui no SQL Editor — que
-- e' justamente o que nenhuma protecao dentro do app alcanca.
--
-- QUANTO ISSO OCUPA
-- Uma versao por hora de trabalho em cada obra, MAIS uma sempre que o
-- numero de itens cair. Sem essa regra, o salvamento automatico (que
-- grava 1,2s depois de cada tecla) encheria o banco de copias.
-- Ficam as 24 mais novas de cada obra, e as "quedas" ficam 30 dias.
-- Uma obra esvaziada para de ser editada, entao a versao boa nao e'
-- empurrada para fora pelas seguintes.
-- ============================================================

-- ---------- 1. A tabela ----------
create table if not exists obra_versao (
  id             bigint generated always as identity primary key,
  obra_codigo    text not null,
  -- A LINHA INTEIRA, como estava antes da gravacao. Guardar a linha e nao
  -- coluna por coluna e' o que faz isto sobreviver a colunas novas: quando
  -- o app ganha um campo, o historico ja' o guarda sem ninguem mexer aqui.
  conteudo       jsonb not null,
  -- Contagem materializada: da' pra listar as versoes sem abrir o JSONB,
  -- que e' gordo. E' ela que responde "qual versao tinha os 269 itens".
  n_itens        integer not null default 0,
  -- Esta versao foi guardada porque o numero de itens CAIU nesta gravacao.
  queda          boolean not null default false,
  atualizado_por text,
  criado_em      timestamptz not null default now()
);

-- A leitura e' sempre "as versoes desta obra, da mais nova pra mais velha".
create index if not exists obra_versao_obra_idx
  on obra_versao (obra_codigo, criado_em desc);

-- ---------- 2. Contar itens dentro do JSONB ----------
-- Lista que nao e' lista vale zero em vez de derrubar a gravacao: obra
-- antiga pode ter chave faltando ou com formato velho, e um erro aqui
-- travaria o salvamento da obra inteira.
create or replace function obra_len_lista(v jsonb)
returns integer language sql immutable as $$
  select case when jsonb_typeof(v) = 'array' then jsonb_array_length(v) else 0 end;
$$;

-- As QUATRO fontes somadas: Vendido Contrato, Vendido Planilha, Executivo
-- e a planilha do Executivo. Uma obra que so' tem contrato importado e'
-- tao cheia quanto uma que ja' foi as compras.
create or replace function obra_conta_itens(cats jsonb)
returns integer language sql immutable as $$
  select coalesce((
    select sum(obra_len_lista(c -> 'itens')
             + obra_len_lista(c -> 'itensContrato')
             + obra_len_lista(c -> 'itensPlanilha')
             + obra_len_lista(c -> 'itensPlanilhaExecutivo'))
      from jsonb_array_elements(cats) as c
     where jsonb_typeof(cats) = 'array'
  ), 0)::integer;
$$;

-- ---------- 3. O gatilho ----------
-- SECURITY DEFINER porque a tabela tem RLS: o gatilho precisa gravar o
-- historico de qualquer pessoa, inclusive de quem nao teria permissao de
-- inserir ali na mao. `search_path` fixo e' o cuidado que acompanha isso.
create or replace function obra_dados_guarda_versao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  antes    integer;
  depois   integer;
  ultima   timestamptz;
  eh_queda boolean;
begin
  -- Gravacao que nao mexeu no conteudo nao vira versao. Pegar e soltar a
  -- trava de edicao sao UPDATEs que so' tocam `editando_por` — sem isto,
  -- cada abrir-e-fechar de obra deixaria uma copia de centenas de KB.
  if OLD.categorias  is not distinct from NEW.categorias
 and OLD.cadernos    is not distinct from NEW.cadernos
 and OLD.arquivos    is not distinct from NEW.arquivos
 and OLD.aprovacoes  is not distinct from NEW.aprovacoes
 and OLD.escopos     is not distinct from NEW.escopos then
    return NEW;
  end if;

  antes    := obra_conta_itens(OLD.categorias);
  depois   := obra_conta_itens(NEW.categorias);
  eh_queda := depois < antes;

  select max(criado_em) into ultima
    from obra_versao where obra_codigo = OLD.obra_codigo;

  -- UMA POR HORA, mais uma SEMPRE que o numero de itens cair.
  -- A queda nao respeita o relogio de proposito: e' o unico evento que
  -- some com trabalho, e e' o que a gente vai querer desfazer.
  if eh_queda or ultima is null or ultima < now() - interval '1 hour' then

    insert into obra_versao (obra_codigo, conteudo, n_itens, queda, atualizado_por)
    values (OLD.obra_codigo, to_jsonb(OLD), antes, eh_queda, OLD.atualizado_por);

    -- PODA. Ficam: as 24 mais novas desta obra + toda queda dos ultimos
    -- 30 dias. A segunda metade importa mais que a primeira — e' ela que
    -- garante que a versao de antes do estrago sobreviva a uma sequencia
    -- de gravacoes depois dele.
    delete from obra_versao v
     where v.obra_codigo = OLD.obra_codigo
       and not (v.queda and v.criado_em > now() - interval '30 days')
       and v.id not in (
             select id from obra_versao
              where obra_codigo = OLD.obra_codigo
              order by criado_em desc
              limit 24);
  end if;

  return NEW;
end $$;

-- O nome vem depois de `trg_obra_dados_atualizado` no alfabeto, e gatilho
-- roda em ordem alfabetica. Tanto faz aqui (este le' OLD, o outro escreve
-- NEW), mas fica registrado pra quando alguem mexer.
drop trigger if exists trg_obra_dados_versao on obra_dados;
create trigger trg_obra_dados_versao
  before update on obra_dados
  for each row execute function obra_dados_guarda_versao();

-- ---------- 4. Quem enxerga ----------
-- Ler: o time inteiro, como em obra_dados. Ver o que aconteceu com a obra
-- nao e' privilegio de ninguem.
-- Escrever na mao: ninguem. Quem escreve e' o gatilho, e ele passa por
-- cima da RLS por ser SECURITY DEFINER. Historico que pode ser editado
-- nao e' historico.
alter table obra_versao enable row level security;

drop policy if exists "leitura do time (autenticados)" on obra_versao;
create policy "leitura do time (autenticados)" on obra_versao
  for select
  to authenticated
  using (true);

-- ---------- 5. CONFERIR ----------
-- Depois de rodar, isto tem que devolver a tabela vazia (0 linhas) — o
-- historico comeca agora, ele nao inventa o passado.
--   select count(*) as versoes from obra_versao;
--
-- A primeira versao aparece na primeira vez que alguem editar uma obra.
-- Pra ver o que existe, por obra:
--   select obra_codigo, n_itens, queda, atualizado_por, criado_em
--     from obra_versao order by criado_em desc;
