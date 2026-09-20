# 08 · Performance

> Performance é requisito, não otimização posterior. As metas abaixo são medidas com dados reais
> de uso; o banco tem as regras próprias em [07-supabase-e-sql](07-supabase-e-sql.md#performance-de-sql).

## Metas

| Métrica | Meta (p75 de usuários reais, salvo indicação) |
|---|---|
| LCP (maior conteúdo visível) | ≤ 2,5 s |
| INP (resposta à interação) | ≤ 200 ms |
| CLS (estabilidade do layout) | ≤ 0,1 |
| Resposta de API para montar uma tela | p95 ≤ 300 ms |
| Consulta de listagem ou detalhe no banco | p95 ≤ 100 ms |
| Relatório | p95 ≤ 500 ms no banco; acima de 2 s vira processamento em segundo plano |

### PERF-01 · Medir antes de dar como pronto `[REVISÃO]`

Telas principais monitoradas com Vercel Speed Insights (dados de campo). Piora de mais de 20% numa
métrica em relação à semana anterior é tratada como bug.

## Rede e dados

### PERF-02 · Sem cascata de requisições `[REVISÃO]`

- Requisições independentes em paralelo (`Promise.all` no servidor; queries paralelas no front).
- Tela que precisa de vários recursos pede ao servidor **uma** resposta agregada (endpoint ou
  consulta da tela), em vez de o front orquestrar N chamadas.

### PERF-03 · Cache de dados em memória, com política `[REVISÃO]`

- No front, cache de dados do servidor é só em memória (TanStack Query) —
  [NAV-01](04-dados-no-navegador.md).
- `staleTime` definido por tipo de dado: cadastros de apoio (minutos), listagens operacionais
  (segundos), dados que mudam a todo momento (0).
- Mutação invalida exatamente as chaves afetadas.

### PERF-04 · Busca e digitação econômicas `[REVISÃO]`

Debounce de 300 ms em busca, requisição anterior cancelada quando chega uma nova e mínimo de
2 caracteres ([TELA-11](06-padroes-de-tela.md)).

### PERF-05 · Listas grandes `[REVISÃO]`

Paginação no servidor ([TELA-13](06-padroes-de-tela.md)). Se a tela precisa renderizar mais de
200 linhas ao mesmo tempo, virtualização (`@tanstack/react-virtual`).

### PERF-06 · Trabalho pesado fora da requisição `[REVISÃO]`

Exportação grande, importação de planilha, geração de PDF, envio em massa e integração lenta rodam
em segundo plano (fila, job, `after()` no Next.js), com progresso e aviso de conclusão pelo
`NotificationBell`.

## Front

### PERF-07 · Código sob demanda `[REVISÃO]`

Rotas carregadas sob demanda. Componentes pesados — gráficos, editores ricos, calendário, mapa,
visualizador de PDF — importados dinamicamente só na tela que os usa.

### PERF-08 · Layout estável `[REVISÃO]`

Skeleton com as dimensões do conteúdo final ([TELA-61](06-padroes-de-tela.md)); imagens com
largura e altura declaradas; fontes carregadas com `display=swap` (ou `next/font`).

### PERF-09 · Função perto do banco `[REVISÃO]`

As funções da Vercel rodam na **mesma região** do projeto Supabase. Para Supabase em `sa-east-1`,
funções em `gru1` (São Paulo). A região padrão da Vercel é `iad1` (EUA): esquecer isso soma cerca de
120 ms de ida e volta a **cada** consulta.

### PERF-10 · Peso consciente `[REVISÃO]`

- Dependência de front nova passa pela análise de [ARQ-07](01-arquitetura.md), incluindo o peso.
- Import pontual (`import { format } from 'date-fns'`), nunca o pacote inteiro.
- Análise de bundle nas telas principais a cada release relevante (`vite-bundle-visualizer` no
  perfil Vite; `next experimental-analyze` no perfil Next.js).

### PERF-11 · Imagens e arquivos `[REVISÃO]`

Imagens em formato moderno e no tamanho de exibição (`next/image` no Next.js; transformação do
Supabase Storage ou tamanho gerado no upload no perfil Vite). Arquivo grande servido por URL
assinada direto do Storage, nunca trafegando pela função.
