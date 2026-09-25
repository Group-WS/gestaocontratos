# Testes de policy

Provam que o RLS nega o que tem que negar — e que o uso normal continua
passando. São `pgTAP`, o padrão do Supabase: cada arquivo abre uma
transação, troca de identidade várias vezes e dá `rollback` no fim, então
rodar não suja o banco.

O que eles cobrem hoje:

| Arquivo | Pergunta que responde |
|---|---|
| `00-massa.sql` | (não é teste) cria as pessoas e obras que os outros usam |
| `01-pessoa.sql` | ninguém se promove a master |
| `02-obra.sql` | o GC vê as obras dele e as sem dono — e o histórico acompanha |
| `03-referencia.sql` | quem está na fila, sem perfil, ainda não lê nada |
| `04-aditivo.sql` | quem vê o aditivo é quem vê a obra; apagar, só o criador ou o admin |
| `05-comentario.sql` | o recado é assinado: ninguém escreve em nome de outra pessoa |
| `06-referencia-completa.sql` | as tabelas de referência: anônimo e fila não leem; a Mehoo não apaga |
| `07-por-obra.sql` | o caderno e as solicitações seguem a obra |
| `08-so-admin-escreve.sql` | compradores e prestadores: o time lê, só o admin escreve |
| `09-reforco.sql` | o reforço de 21/09/2026 (`rls-reforco.sql`): ninguém apaga obra nem reescreve o histórico, aditivo só na própria obra e com autoria do login, arquivos por obra, catálogo sem listagem anônima, a fila fora do que é do time, `sienge_obra` só no status, funções fechadas para anônimo |
| `10-rn-001-liberacao.sql` | RN-001: só o administrador libera a compra, em nome próprio; via alocação por quem edita; restaurar versão devolve a liberação, copiar para mais itens não |
| `11-preferencia.sql` | a preferência é de cada um: lê e grava as suas, não as dos outros; anônimo nem lê |
| `12-salvar-obra.sql` | a gravação protegida da obra (`salvar-obra.sql`): gravar sem a trava é recusado, versão desatualizada é recusada, obra vazia não grava por cima de obra cheia, a RN-001 continua valendo pela gravação, ninguém grava direto por cima da trava viva de outra pessoa, cada gravação inteira vira versão e a poda segura o histórico |
| `13-aditivo-apresentacao.sql` | a gravação protegida do aditivo e da apresentação (`salvar-aditivo-apresentacao.sql`): versão desatualizada é recusada nos dois, o número do aditivo sai do banco, autoria pelo login, quem não enxerga a obra não grava nem lê o histórico, cada gravação inteira vira cópia, o apagamento fica guardado e a poda segura o histórico |
| `17-insumo-cadastro.sql` | o Cadastro de Insumos (`insumo-cadastro.sql`): o time lê, só o administrador cria, edita, apaga e importa (RN-086); insumo pedido ao Sienge não se apaga, nem pela importação (RN-087); autor pelo login, histórico por gatilho, a tela não troca a origem, e o balde dos relatórios é do administrador |

## Como rodar

O jeito que o CI usa — monta um banco novo com os scripts na ordem do
[README da pasta acima](../README.md), roda tudo e apaga o banco no fim:

```bash
docker run -d --name confere-teste -e POSTGRES_PASSWORD=teste -p 55432:5432 supabase/postgres:15.8.1.060
PGHOST=localhost PGPORT=55432 PGUSER=postgres PGPASSWORD=teste supabase/tests/rodar.sh
```

Sem `psql` na máquina, o mesmo roda dentro do contêiner, com a pasta
`supabase/` montada em `/sql`:

```bash
docker run -d --name confere-teste -e POSTGRES_PASSWORD=teste -v "$PWD/supabase:/sql:ro" supabase/postgres:15.8.1.060
docker exec -e PGHOST=localhost -e PGUSER=postgres -e PGPASSWORD=teste confere-teste bash /sql/tests/rodar.sh
```

## Script novo, teste novo

O `rodar.sh` tem a lista executável da ordem de aplicação. Script de
estrutura novo entra nela, no bloco certo — e, se mexe em acesso, com um
arquivo de teste que prove o "não" **e** o "sim".
