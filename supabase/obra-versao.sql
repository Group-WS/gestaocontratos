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
-- E PEGA O APAGAMENTO TAMBEM (2a versao, 19/09/2026). Sao dois gatilhos:
-- um no UPDATE (sobrescrita) e outro no DELETE (a linha inteira indo
-- embora). Sem o segundo, `delete from obra_dados` levaria a obra sem
-- deixar copia — foi assim que o limpar-obras-teste.sql apagou 12 obras
-- em 16/09. E' isto que faz o historico valer mais do que soft-delete:
-- soft-delete guarda o FATO de que apagaram; aqui fica o CONTEUDO.
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

-- Quantos itens ja' estao APROVADOS PRA COMPRA.
--
-- Existe por causa da substituicao da Planilha Executivo (19/09/2026): ela
-- TROCA a lista de itens pela do arquivo novo, e o numero de itens fica
-- parecido — some o ESTADO deles, nao a quantidade. Contando so' itens, uma
-- troca dessas passaria pelo filtro de uma hora sem deixar versao nenhuma,
-- e seria exatamente a gravacao que mais precisa de volta.
create or replace function obra_conta_liberados(cats jsonb)
returns integer language sql immutable as $$
  select coalesce((
    select count(*)
      from jsonb_array_elements(cats) as c,
           jsonb_array_elements(case when jsonb_typeof(c -> 'itens') = 'array'
                                     then c -> 'itens' else '[]'::jsonb end) as it
     where jsonb_typeof(cats) = 'array'
       -- NAO CONVERTER. `liberadoCompra` guarda um CARIMBO desde 19/09
       -- ({em, por}: quem liberou e quando), e nao mais true/false. O
       -- `->>` devolvia o objeto como texto, `::boolean` derrubava a
       -- instrucao, e como esta conta roda dentro do gatilho quem caia
       -- era o UPDATE: em 20/09 toda obra com item liberado parou de
       -- salvar. Comparar sem converter vale para as duas formas — e nao
       -- quebra de novo quando o campo mudar de formato outra vez.
       and coalesce(it -> 'liberadoCompra', 'null'::jsonb)
             not in ('null'::jsonb, 'false'::jsonb)
       and coalesce(it ->> 'excluido', 'false') <> 'true'
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
  apagando boolean := TG_OP = 'DELETE';
begin
  -- APAGAR A LINHA E' O CASO MAIS GRAVE, e por isso e' o unico que nao
  -- passa por filtro nenhum: sempre vira versao, sem esperar o relogio.
  --
  -- Isto e' o que faz o historico valer mais que soft-delete. Marcar a
  -- linha como apagada guardaria o FATO; aqui fica o CONTEUDO, e da' pra
  -- devolver a obra inteira. E pega tambem o `delete` rodado a mao no SQL
  -- Editor — foi assim que o limpar-obras-teste.sql apagou 12 obras.
  if not apagando then
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
  end if;

  antes    := obra_conta_itens(OLD.categorias);
  -- Apagar leva tudo: depois da linha sumir sobra zero item.
  depois   := case when apagando then 0 else obra_conta_itens(NEW.categorias) end;

  -- QUEDA E' PERDER ITEM **OU** PERDER APROVACAO.
  -- Substituir a Planilha Executivo troca a lista inteira: a contagem de
  -- itens quase nao muda, mas as aprovacoes, o canal e a ligacao com o
  -- Sienge vao a zero. Olhar so' para a quantidade deixaria passar
  -- justamente a gravacao que mais precisa de volta.
  eh_queda := depois < antes
           or (case when apagando then 0 else obra_conta_liberados(NEW.categorias) end)
              < obra_conta_liberados(OLD.categorias);

  select max(criado_em) into ultima
    from obra_versao where obra_codigo = OLD.obra_codigo;

  -- UMA POR HORA, mais uma SEMPRE que o numero de itens cair, mais
  -- SEMPRE que a linha for apagada.
  -- A queda nao respeita o relogio de proposito: e' o unico evento que
  -- some com trabalho, e e' o que a gente vai querer desfazer.
  if apagando or eh_queda or ultima is null or ultima < now() - interval '1 hour' then

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

  -- Num gatilho BEFORE, devolver NULL CANCELA a operacao. No DELETE quem
  -- deixa o apagamento seguir e' o OLD.
  return case when apagando then OLD else NEW end;
end $$;

-- O nome vem depois de `trg_obra_dados_atualizado` no alfabeto, e gatilho
-- roda em ordem alfabetica. Tanto faz aqui (este le' OLD, o outro escreve
-- NEW), mas fica registrado pra quando alguem mexer.
drop trigger if exists trg_obra_dados_versao on obra_dados;
create trigger trg_obra_dados_versao
  before update on obra_dados
  for each row execute function obra_dados_guarda_versao();

-- O MESMO GATILHO NO APAGAMENTO.
-- Sem este, `delete from obra_dados where obra_codigo = '2450'` levaria a
-- obra sem deixar copia — o historico so' cobriria sobrescrita. Dois
-- gatilhos e nao um "before update or delete" porque cada um fica legivel
-- na listagem do banco, e porque desligar um sem o outro passa a ser
-- possivel.
drop trigger if exists trg_obra_dados_versao_del on obra_dados;
create trigger trg_obra_dados_versao_del
  before delete on obra_dados
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
