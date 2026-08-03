# Confere

Plataforma interna pra comparar o que foi **vendido** em contrato com o
que o time de **executivo** especificou pra compra, sinalizando
divergência de escopo, quantidade e orçamento por verba — com
integração de leitura ao Monday.com (listagem de obras por squad) e
preparado pra futura integração com o Sienge (insumos e contratos).

## Estrutura do projeto

```
confere-project/
├── web/              → frontend (React + Vite) — o que hoje é o artifact "Confere"
│   └── src/App.jsx   → todo o app: EAP, comparativo, filtros, abas Vendido/Executivo
├── monday-proxy/      → backend (Node + Express) — guarda o token do Monday em segurança
│   ├── server.js
│   └── README.md      → como configurar e rodar o proxy
└── README.md          → este arquivo
```

## Por que dois projetos separados

O `web` roda no navegador — nada sensível pode morar nele. O
`monday-proxy` roda num servidor e é o único lugar que conhece o
token da API do Monday. O `web` fala só com o `monday-proxy`, nunca
direto com `api.monday.com`.

## Como abrir isso no Claude Code

1. Baixe e descompacte este projeto numa pasta local.
2. Abra um terminal nessa pasta e rode `claude` (ou abra a pasta pelo
   Claude Code no app Desktop).
3. Primeiros pedidos que fazem sentido pro Claude Code continuar daqui:
   - "Rode `npm install` no `web` e no `monday-proxy`, e sobe os dois em dev"
   - "Configura o `.env` do `monday-proxy` a partir do `.env.example`"
   - "Troca os dados fictícios do `web/src/App.jsx` por uma chamada real pro `monday-proxy`"
   - "Adiciona um banco (Postgres/SQLite) pra persistir as edições de item (hoje é só estado em memória)"
   - "Configura autenticação de usuário (hoje não tem login)"
   - "Prepara o deploy do `web` (Vercel/Netlify) e do `monday-proxy` (Render/Railway)"

## Rodando localmente (sem Claude Code)

**Backend (proxy do Monday):**
```bash
cd monday-proxy
cp .env.example .env   # cole o token do Monday aqui, nunca no código
npm install
npm start                # sobe em http://localhost:3001
```

**Frontend:**
```bash
cd web
npm install
npm run dev               # sobe em http://localhost:5173
```

Chamadas do frontend para `/api/...` são redirecionadas automaticamente
pro proxy (configurado em `web/vite.config.js`).

## O que já existe

- EAP fixa (17 verbas padrão), sempre mostradas mesmo zeradas
- Comparativo Vendido × Executivo por verba, com alertas de estouro,
  item fora de escopo e quantidade excedida
- Fluxo de aprovação de item fora de escopo
- Separação produto (→ Compras) vs. serviço (→ Contratos, Sienge)
- Sugestão de insumo Sienge por correspondência de descrição (dados
  estáticos por enquanto — ver "Próximos passos")
- Filtros (liberado, aguardando, com alerta, comprado, falta comprar)
- Abas Vendido / Executivo / Comparativo, com exportação em .csv
- Sidebar com busca, filtro por squad (Sun/Moon/Comet) e alerta
- Dados reais da obra 2519 (TKWS Invest); demais obras são fictícias
  para demonstração

## Próximos passos (o que falta pra virar produto real)

1. **Persistência** — hoje tudo é `useState` em memória; recarregar a
   página apaga as edições. Precisa de um banco de dados.
2. **Upload de planilha** — hoje os dados do Vendido/Executivo estão
   fixos no código; falta o fluxo de upload real (PDF/CSV/XLSX).
3. **Autenticação e permissões** — hoje qualquer um que abra o app
   edita tudo; falta login e perfis (Comercial / Executivo / Compras).
4. **Integração Monday real** — o proxy já existe; falta plugar de
   verdade (ver `monday-proxy/README.md`).
5. **Integração Sienge** — hoje a correspondência de insumo e o status
   de contrato são estáticos; a integração real ainda não existe.
