# Confere ↔ Monday — Proxy

Servidor pequeno que guarda o token da API do Monday.com em segurança
(variável de ambiente, nunca no código) e expõe rotas simples pro
Confere consumir a listagem de obras em execução e o GC responsável.

## Por que isso é um servidor separado

O Confere hoje é um app que roda inteiro no navegador. Um token de API
colocado no código dele fica visível pra qualquer pessoa que abrir o
"ver código" do artifact. Por isso o token mora aqui, num servidor,
e o Confere fala com este servidor — nunca direto com o Monday.

## Passo 1 — revogar o token antigo

O token que foi colado no chat já deve ser considerado exposto.
No Monday: avatar → **Administração** → **API** → gerar um token novo
e revogar o antigo.

## Passo 2 — rodar local

```bash
cp .env.example .env
# cole o token NOVO em .env
npm install
npm start
```

Servidor sobe em `http://localhost:3001`.

## Passo 3 — descobrir o board e as colunas certas

```bash
# lista os boards da conta, pra achar o ID do board de obras
curl http://localhost:3001/api/monday/boards

# lista as colunas desse board, pra achar o ID da coluna de Status
# e da coluna de GC responsável (People ou texto)
curl "http://localhost:3001/api/monday/columns?boardId=SEU_BOARD_ID"
```

## Passo 4 — testar a listagem de obras (board único com todos os itens)

Sem os IDs de coluna ainda, a rota devolve tudo (modo debug), pra
você visualizar e identificar qual coluna é qual:

```bash
curl "http://localhost:3001/api/monday/obras?boardId=SEU_BOARD_ID"
```

Depois de identificar, feche a consulta:

```bash
curl "http://localhost:3001/api/monday/obras?boardId=SEU_BOARD_ID&statusColumnId=status&gcColumnId=people&statusValue=Em execução"
```

## Passo 4b — sua estrutura real: um workspace, um board por obra

No seu caso (workspace "squad comet", `workspaceId=13339790`), cada
board dentro do workspace é uma obra — ex. board "2281 - TKWS" — e
dentro dele existe um grupo **Planejamento de obra** com a coluna
**GC responsável**. Use esta rota:

```bash
curl "http://localhost:3001/api/monday/obras-execucao?workspaceId=13339790"
```

Resposta (uma entrada por board/obra):
```json
[
  {
    "boardId": "9876543210",
    "obra": "2281 - TKWS",
    "grupoEncontrado": "Planejamento de obra",
    "gcResponsavel": "Rodrigo Wayhs",
    "colunas": { "Status": "Em execução", "GC responsável": "Rodrigo Wayhs", "...": "..." }
  }
]
```

O campo `colunas` traz TODAS as colunas do item encontrado — use-o
pra identificar o nome exato da coluna que indica "obra em execução"
(ainda não confirmado). Depois de identificar, me diga o nome e eu
fixo o filtro de status na rota.


Resposta:
```json
[
  { "id": "123456", "nome": "TKWS Invest", "status": "Em execução", "gc": "Rodrigo Wayhs" }
]
```

## Passo 5 — deploy

Hospede em qualquer serviço Node (Render, Railway, Fly.io, uma VM
própria). Configure `MONDAY_API_TOKEN` nas variáveis de ambiente do
serviço de hospedagem — nunca como arquivo no repositório.

## Passo 6 — conectar no Confere

Assim que este servidor estiver publicado num domínio (ex.
`https://monday-proxy.suaempresa.com.br`), o Confere passa a chamar
`GET /api/monday/obras?...` nesse domínio pra popular a lista de
"Obras Ativas" na barra lateral automaticamente, com um botão
"Sincronizar com Monday".
