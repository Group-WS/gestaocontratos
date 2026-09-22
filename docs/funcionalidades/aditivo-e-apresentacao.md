# Gravação do aditivo e da apresentação

**Módulos:** Aditivos e Apresentação de especificações · **Arquétipos de tela:** listagem, detalhe (editor)

## Objetivo

O que a pessoa monta num aditivo ou numa apresentação chega ao banco — ou a tela diz que não
chegou e o que fazer. Duas pessoas no mesmo documento não se apagam em silêncio.

É a mesma garantia da [gravação da obra](gravacao-da-obra.md), com uma diferença: aqui **não há
trava**. Os dois editores gravam sozinhos, e a versão faz o conflito aparecer em segundos — na
primeira gravação de quem chegou depois, e não no fim do trabalho.

## Quem usa

Quem edita a obra (master, admin, geral e GC, cada um nas obras que enxerga). Quem só consulta
(Mehoo) vê os documentos e não grava nenhum.

## Fluxo

1. A lista traz os aditivos (ou as revisões da apresentação) com a `versao` de cada um.
2. **Abrir carrega o documento do banco, por id.** A lista pode estar aberta há meia hora; o que
   se edita é o que está lá agora.
3. Cada alteração entra na **fila de gravação** do documento: sai 1,2 s depois da última
   alteração, uma por vez, sempre com o estado mais recente da tela.
4. O banco (`salvar_aditivo`, `salvar_apresentacao`) só grava se a versão for a que a tela leu.
   Gravou: a versão sobe e a barra mostra "salvo". Não bateu: recusa dizendo quem alterou e
   quando, e **nada** é escrito.
5. **Sair do editor** (voltar para a lista, fechar a apresentação) grava o que falta antes. Se a
   gravação não passar, a tela pergunta antes de descartar.
6. Fechar ou recarregar a aba com trabalho por gravar: o navegador pergunta.
7. Gerar o PDF ou o .pptx grava tudo antes — o documento que sai é o que está no banco.

## O que o banco decide

| Decisão | Onde |
|---|---|
| Só grava com a versão que a tela leu | `salvar_aditivo`, `salvar_apresentacao` |
| O número do aditivo ("2405/3") | `criar_aditivo`, com trava por obra — duas pessoas criando ao mesmo tempo não pedem o mesmo número |
| Revisão repetida da apresentação | `criar_apresentacao` recusa com motivo |
| Quem criou e quem alterou | gatilhos de autoria: sai do login, nunca do corpo do pedido |
| Quem enxerga e quem escreve | RLS por obra e perfil (`rls-reforco.sql`) |
| O histórico do aditivo | `aditivo_versao`: uma cópia a cada gravação inteira e sempre no apagamento, com poda de 24 |

## Estados e mensagens

Os mesmos da obra (`filaDeGravacao.js`), com os textos de `documentosDaObra.js`:

| Estado | O que a tela diz | Saída |
|---|---|---|
| pendente / salvando / salvo | "alterações por gravar…", "salvando…", "salvo" | — |
| erro (rede, servidor) | "não salvo — nova tentativa em N s" | tenta sozinha (2 s, 5 s… até 1 min) e **Tentar agora** |
| recusado | a mensagem do servidor | desfazer a alteração, ou **Tentar agora** |
| conflito (outra pessoa gravou) | quem alterou e quando, e que nada foi gravado por cima | **Recarregar o aditivo / a apresentação**, sempre perguntando antes |

Nenhuma mensagem manda dar F5 antes de o dado estar gravado.

## As imagens dos ambientes

Ficam no balde da **obra** (`obra-arquivos/<codigo>/ambientes/`), privado, com as mesmas
permissões dos outros arquivos dela — antes ficavam no balde do catálogo, que é público. O
navegador reduz a foto (lado maior de 2000 px, JPEG) antes de mandar, e o endereço para ver cada
uma é assinado pela API e vale uma hora. As imagens antigas continuam abrindo de onde estão.

## Onde está no código

- Banco: `supabase/salvar-aditivo-apresentacao.sql` (versão, funções de gravação, autoria da
  apresentação, `aditivo_versao`).
- API: `web/api/_lib/rotas/documentosDaObra.js` (listar, abrir, criar, gravar, apagar, imagens).
- Tela: `web/src/lib/aditivos.js`, `web/src/lib/apresentacao.js`, `web/src/lib/documentosDaObra.js`
  (textos e resumo), `web/src/lib/imagem.js` (reduzir), `web/src/lib/imagensDaObra.js`
  (endereços), `web/src/lib/filaDeGravacao.js` (a fila, a mesma da obra),
  `web/src/App.jsx` (Aditivos), `web/src/Apresentacao.jsx`.
- Testes: `supabase/tests/13-aditivo-apresentacao.sql`,
  `web/api/_lib/__testes__/documentos-da-obra.test.cjs`,
  `web/src/__testes__/documentos-protegidos.test.mjs` e, no navegador com duas
  sessões de verdade, `e2e/duas-sessoes-aditivo.spec.mjs`.

## Fora do escopo

- Trava de edição nestes dois documentos: a versão basta, porque a gravação é automática.
- Histórico da apresentação: as revisões (00, 01…) já fazem esse papel.
- Migrar as imagens antigas do balde do catálogo para o da obra: elas continuam abrindo de lá.
