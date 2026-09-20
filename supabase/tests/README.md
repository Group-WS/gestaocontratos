# Testes de policy

Provam que o RLS nega o que tem que negar. São `pgTAP`, o padrão do
Supabase — cada arquivo abre uma transação, troca de identidade várias
vezes e dá `rollback` no fim, então rodar não suja o banco.

O que eles cobrem hoje:

| Arquivo | Pergunta que responde |
|---|---|
| `00-massa.sql` | (não é teste) cria as pessoas e obras que os outros usam |
| `01-pessoa.sql` | ninguém se promove a master |
| `02-obra.sql` | o GC vê as obras dele e as sem dono — e o histórico acompanha |
| `03-referencia.sql` | quem está na fila, sem perfil, ainda não lê nada |

## Como rodar

Com o Supabase CLI e Docker:

```bash
supabase start
supabase db reset          # aplica os scripts da pasta acima, na ordem do README
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -f supabase/tests/00-massa.sql
supabase test db
```

Sem o CLI, contra um Postgres qualquer com a extensão `pgtap`: aplique os
scripts na ordem do [README da pasta acima](../README.md), depois
`00-massa.sql`, e rode cada arquivo de teste com `psql -f`.

## O que ainda falta

Sete tabelas expostas ainda não têm teste próprio (`catalogo_*`,
`sienge_eap_*`, `apresentacao`, `sienge_solicitacao`, `comprador_grupo`,
`prestador_interno`, `obra_comentario`). O gate de qualidade cobra uma
asserção de acesso negado por tabela (TST-03) — estes quatro arquivos são o
começo, não o fim.
