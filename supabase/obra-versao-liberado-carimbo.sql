-- ============================================================
-- CORRECAO URGENTE  ·  obra com item liberado parou de salvar
-- ============================================================
--
-- Rodar UMA vez no SQL Editor do Supabase. Pode rodar de novo: nada
-- quebra e nada se perde. Nao mexe em dado nenhum, so' troca a conta
-- dentro de uma funcao.
--
-- O SINTOMA
--
--   "Nao consegui salvar: invalid input syntax for type boolean:
--    {"em": "2026-09-18T18:48:42.644Z", "por": "lorena.fialho@..."}"
--
-- e a obra inteira para de gravar. Apareceu na 2572 em 20/09/2026.
--
-- O QUE ACONTECEU
--
-- `obra_conta_liberados` conta quantos itens estao liberados pra compra,
-- e e' ela que o gatilho de versao usa pra decidir se a gravacao merece
-- virar historico. A conta lia o campo assim:
--
--     coalesce((it ->> 'liberadoCompra')::boolean, false)
--
-- Isso valia quando `liberadoCompra` era true ou false. So' que o app
-- passou a guardar ali um CARIMBO — quem liberou e quando:
--
--     "liberadoCompra": { "em": "2026-09-18T...", "por": "fulano@..." }
--
-- O `->>` devolve esse objeto como TEXTO, e `::boolean` de um texto que
-- nao e' "true" nem "false" derruba a instrucao inteira. Como a conta
-- roda dentro do gatilho, quem cai e' o UPDATE — ou seja, toda obra que
-- ja' tem pelo menos um item liberado ficou sem conseguir salvar.
--
-- A CORRECAO
--
-- Parar de converter. "Liberado" passa a ser "o campo existe e nao e'
-- nulo nem false", o que vale para as duas formas: o booleano das obras
-- antigas e o carimbo das novas. Sem cast, sem forma esperada, sem como
-- quebrar de novo quando o campo mudar de formato outra vez.
--
-- `excluido` continua booleano no app, mas aqui ele e' comparado como
-- TEXTO pelo mesmo motivo: se um dia virar carimbo tambem, a conta
-- devolve um numero errado em vez de derrubar a gravacao da obra.
-- ============================================================

create or replace function obra_conta_liberados(cats jsonb)
returns integer language sql immutable as $$
  select coalesce((
    select count(*)
      from jsonb_array_elements(cats) as c,
           jsonb_array_elements(case when jsonb_typeof(c -> 'itens') = 'array'
                                     then c -> 'itens' else '[]'::jsonb end) as it
     where jsonb_typeof(cats) = 'array'
       -- liberado = tem carimbo, ou o true antigo. Nunca converte.
       and coalesce(it -> 'liberadoCompra', 'null'::jsonb)
             not in ('null'::jsonb, 'false'::jsonb)
       and coalesce(it ->> 'excluido', 'false') <> 'true'
  ), 0)::integer;
$$;

-- ---------- CONFERIR ----------
-- 1. A conta aceita as duas formas sem derrubar nada:
--      select obra_conta_liberados('[{"itens":[
--        {"liberadoCompra": {"em":"2026-09-18T18:48:42.644Z","por":"x@y.z"}},
--        {"liberadoCompra": true},
--        {"liberadoCompra": true, "excluido": true},
--        {"liberadoCompra": false},
--        {"liberadoCompra": null},
--        {}
--      ]}]'::jsonb);
--    Esperado: 2 (o carimbo e o true; o excluido e os tres ultimos ficam de fora).
--
-- 2. A obra que estava travada volta a salvar:
--      update obra_dados set atualizado_por = atualizado_por
--       where obra_codigo = '2572';
--    Esperado: UPDATE 1, sem erro.
