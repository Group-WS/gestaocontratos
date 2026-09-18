-- ============================================================
-- Tirar o anexo "Apresentação de Especificações" das obras
-- ============================================================
--
-- Pedido da Priscila em 18/09/2026: "retire esse ultimo anexo 'apresentacao
-- de especificacoes': esta duplicado. se tiver alguma informacao em qualquer
-- obra dentro desse item pode retirar tambem. vou manter somente o caderno
-- de especificacao."
--
-- O ESPAÇO DE ANEXO JÁ SAIU DA TELA (Jornada da obra). Ninguém anexa mais
-- nada ali. Este arquivo é a outra metade: apaga o vínculo do que JÁ foi
-- anexado, nas obras que tiverem.
--
-- LEIA ANTES DE RODAR
-- O comando apaga o VÍNCULO, não o arquivo: o PDF continua guardado no
-- balde `obra-arquivos`. Ele deixa de aparecer em Documentos e no botão
-- "PDF anexado" da Apresentação. Para voltar atrás seria preciso anexar de
-- novo, então vale conferir a lista antes.
--
-- COMO RODAR: Supabase → SQL Editor.
-- ============================================================

-- PASSO 1 — VER o que existe hoje. Rode só isto primeiro.
-- Se vier vazio, não há nada a limpar e o passo 2 é desnecessário.
select obra_codigo,
       cadernos -> 'apresentacao' ->> 'nome'       as arquivo,
       cadernos -> 'apresentacao' ->> 'tamanhoKB'  as kb,
       cadernos -> 'apresentacao' ->> 'em'         as anexado_em,
       -- O caderno que fica: se esta coluna vier vazia, a obra perde o
       -- único arquivo de especificação que tinha. Vale olhar antes.
       cadernos -> 'especificacao' ->> 'nome'      as caderno_de_especificacao
  from obra_dados
 where cadernos ? 'apresentacao'
 order by obra_codigo;

-- PASSO 2 — APAGAR o vínculo. Rode depois de olhar a lista acima.
-- Descomente as duas linhas abaixo (tire os dois hífens) e rode.
--
-- update obra_dados set cadernos = cadernos - 'apresentacao'
--  where cadernos ? 'apresentacao';

-- PASSO 3 — CONFERIR: tem que devolver 0.
-- select count(*) from obra_dados where cadernos ? 'apresentacao';
