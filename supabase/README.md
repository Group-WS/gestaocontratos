# Os arquivos SQL do Confere

Não são migrations: são scripts avulsos, aplicados à mão no SQL Editor do
Supabase. Quase todos são reaplicáveis (`if not exists`, `drop policy if
exists`), mas **a ordem entre eles não é livre** — e não estava escrita em
lugar nenhum até agora.

Esta página existe porque montar o banco do zero num Postgres limpo falhou
três vezes seguidas por ordem errada. Os erros eram claros
(`column "perfil" does not exist`), mas só aparecem quem tenta.

## Ordem de aplicação, num banco novo

Dentro de cada bloco a ordem não importa. Entre blocos, importa.

**1. Estrutura**
`schema.sql` · `equipe.sql`

**2. Acesso — nesta ordem exata**
`acessos.sql` → `perfis.sql` → `admin-master.sql`

> `perfis.sql` lê a coluna `admin`, criada em `acessos.sql`.
> `admin-master.sql` lê a coluna `perfil`, criada em `perfis.sql`.
> Trocar dois deles de lugar derruba o script com erro de coluna.

**3. O resto do domínio**
`eap.sql` · `etapas.sql` · `prazos.sql` · `escopos.sql` · `aditivos.sql` ·
`aditivo-exclusao.sql` · `aditivo-aguardando.sql` · `alocacao.sql` ·
`apresentacao.sql` · `obra-versao.sql` · `obra-versao-liberado-carimbo.sql` ·
`obra-comentario.sql` · `arquivos.sql` · `arquivos-obra.sql` · `catalogo.sql` ·
`insumo-sienge.sql` · `sienge_obra.sql` · `sienge_eap.sql` ·
`sienge_solicitacao.sql` · `sienge_obra_status_manual.sql` · `compradores.sql` ·
`mao-de-obra-propria.sql` · `pessoa-canal.sql` · `ultimo-acesso.sql` ·
`foto-perfil.sql` · `equipe-da-obra.sql` · `taylor-made.sql` ·
`contrato-restrito.sql` · `patch-obra.sql` · `preferencia.sql`

> `aditivo-exclusao.sql` e `obra-comentario.sql` chamam `admin_do_time()`,
> que vem do bloco 2. Por isso o bloco 2 vem antes deste.
>
> `taylor-made.sql` vem depois de `equipe-da-obra.sql` (usa as colunas
> `tailor_made` e `responsavel_executivo`). A parte 2 dele só age depois do
> bloco 5 — e o bloco 6 (`rls-reforco.sql`) já traz a mesma `minhas_obras()`
> com os três papéis.

**4. Cadastrar a equipe e dar perfil a cada um, pelo app.**
Alguém precisa ficar com **Admin master** — sem isso, o passo 5 se recusa
a rodar, de propósito.

**5. Fechar o acesso — nesta ordem**
`pessoa-escrita-restrita.sql` → `rls-perfis.sql` → `rls-perfis-complemento.sql`

> Os três juntos, na mesma sessão. Rodar só o primeiro deixa o resto do
> banco aberto; rodar só os dois primeiros deixa o histórico da obra, o
> caderno e as solicitações abertos.

**6. O reforço da varredura de segurança (21/09/2026)**
`rls-reforco.sql` → `rn-001-liberacao-de-compra.sql` — logo depois do
bloco 5, e de novo **sempre** que o bloco 5 rodar.

> Fecha o que o bloco 5 ainda deixava: apagar obra (as policies eram
> `for all`), reescrever o histórico, aditivo em obra alheia e autoria
> vinda do navegador, os arquivos de todas as obras abertos a qualquer
> logado, o bucket `catalogo` listável por anônimo, a sala de espera lendo
> recados e compradores, e as funções `security definer` sem `search_path`
> vazio. Se o bloco 5 não tiver rodado, ele se recusa, de propósito. O
> teste é o `tests/09-reforco.sql`.
>
> O `rn-001-liberacao-de-compra.sql` é a garantia no banco da regra RN-001
> (só o administrador libera a compra — ficha em
> `docs/regras-de-negocio/`). Teste: `tests/10-rn-001-liberacao.sql`.
>
> **Reaplicar um script dos blocos 3 a 5 desfaz parte do reforço** (eles
> recriam funções e policies com a versão antiga). Rodou algum deles de
> novo? Rode o bloco 5 inteiro e depois este.

**Antes do bloco 6, confira se o bloco 5 rodou em produção.** Os
comentários do `taylor-made.sql` indicam que o `rls-perfis.sql` pode nunca
ter sido aplicado lá. Esta consulta mostra o que vale hoje:

```sql
select tablename, policyname, roles, cmd
  from pg_policies
 where schemaname in ('public', 'storage')
 order by 1, 2;
```

## Scripts que NÃO são de estrutura

Estes são operações pontuais, de uma vez só, e não entram na montagem de um
banco novo: `trocar-email-luana.sql`, `limpar-obras-teste.sql`,
`limpar-apresentacao-caderno.sql`, `remove-verba-32.sql`,
`catalogo-duplicidades.sql`, `renumera-execucao-mao-de-obra.sql`,
`sienge_eap_seed.sql`.

Vale separá-los numa pasta própria quando houver oportunidade — hoje eles
estão misturados com o que define o banco, e não há como olhar a pasta e
saber o que é o quê.

## Sobre políticas que "somam"

O erro mais caro desta pasta não dá erro: várias políticas na mesma tabela
se **somam** (é OR, não AND). Uma política esquecida dizendo `using (true)`
anula todo o recorte por perfil, em silêncio.

Foi exatamente o que aconteceu com `obra_versao` (tinha uma política
`leitura do time (autenticados)` vinda de outro arquivo) e com
`alocacao_padrao` (tinha três). Por isso `rls-perfis.sql` e
`rls-perfis-complemento.sql` apagam as políticas **por enumeração**, e não
por nome.

Depois de rodar, esta consulta deve devolver só as três leituras de time
que são intencionais (`comprador_grupo`, `obra_comentario`,
`prestador_interno`):

```sql
select c.relname as tabela, p.polname as politica
  from pg_policy p join pg_class c on c.oid = p.polrelid
 where c.relnamespace = 'public'::regnamespace
   and pg_get_expr(p.polqual, p.polrelid) = 'true'
 order by 1, 2;
```

## Testes

Ver [tests/README.md](tests/README.md).
