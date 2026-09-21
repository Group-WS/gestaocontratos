# Adequação ao padrão Group WS 1.0.0

## Situação em 20/09/2026

O gate de entrada encontrou 1.148 violações: 1.061 na lista existente e 87 novas.
Após as correções abaixo, o gate está **EM ADEQUAÇÃO**, com 1.050 itens e nenhuma
violação nova. Isso ainda não autoriza implementar a nova versão do dashboard.

## Correções realizadas

- Removidas as definições locais que duplicavam os tokens do pacote
  `@group-ws/ws-ui`; observações internas usam o token de organização nos dois temas.
- Confirmações de remoção usam `ConfirmDialog` do pacote, com fila e cancelamento
  das solicitações pendentes ao desmontar. Sem host, a operação não é confirmada.
- Respostas de erro das rotas Monday e de extração de PDF não expõem exceções.
  Mantido o contrato `error: string`, com `correlationId` adicional e log estruturado
  sem mensagem bruta de terceiros. A extração de texto mantém `podeBase64`.
- Testes visuais de observações verificam os tokens; teste de regressão da API
  exercita falhas nos handlers com dados sintéticos e sem acessar serviços externos.
- Lista de adequação reduzida pelo comando oficial `--atualizar-adequacao`.

## Bloqueio no verificador de migrations

`SQL-11` aponta a policy `catalogo le`, em `supabase/catalogo.sql:105`, sem papel
explícito. O arquivo já existe na branch principal e `SQL-02` proíbe editá-lo.

A correção de schema deve entrar em migration nova. Porém, o parser em
`.quality/checks/lib/sql.mjs` acumula toda ocorrência de `create policy` e não
processa `drop policy` nem `alter policy`. Assim, uma migration corretiva não
retira a violação histórica do relatório. Editar o arquivo antigo introduziria
uma violação de `SQL-02`.

A solução precisa ser definida no repositório **Group-WS/groupws-dev-quality**,
com teste de regressão para policy substituída por migration posterior e
sincronização oficial do padrão. Não houve alteração local no verificador,
regras, hooks ou manifesto, nem adição de escape.

Há também quatro migrations que já diferiam da branch principal antes desta
adequação: `aditivo-exclusao.sql`, `equipe.sql`, `obra-comentario.sql` e
`rls-perfis.sql`. A regularização deve preservar as correções existentes em
migrations novas; simplesmente descartar as diferenças reintroduziria problemas
de autorização.

## Trabalho restante

| Categoria | Itens |
|---|---:|
| Tokens de cor | 101 |
| Tipografia | 4 |
| Estilos inline e valores arbitrários | 214 |
| Elementos nativos no lugar dos componentes do DS | 563 |
| Diálogos nativos | 19 |
| Armazenamento no navegador | 14 |
| Migrations históricas alteradas | 4 |
| Papel explícito em policy | 1 |
| Consultas sem seleção explícita de colunas | 9 |
| Testes pgTAP de acesso negado | 15 |
| E2E de login | 1 |
| Acesso aos dados do Supabase no frontend | 101 |
| Validação de escrita por schema | 4 |

O catálogo não contém fichas RN vigentes. Regras implícitas de autorização,
prazos, valores e classificação de risco devem ser identificadas e propostas
para aprovação antes de alterar o comportamento de negócio.

## Validação

- `npm --prefix web test`: 84/84 arquivos de teste passaram.
- `npm --prefix web run build`: aprovado; avisos de bundle grande e imports mistos.
- Gate: aprovado somente no modo de adequação, sem violações novas.
- Testes de banco, E2E e validação visual em navegador não executados nesta etapa.
- Nenhuma migration aplicada e nenhum deploy realizado.
