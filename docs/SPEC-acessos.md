# SPEC — Perfis de acesso e entrada de novos usuários

Gestão de Obras TKWS · 31/08/2026
Estado: **acordado, em implementação**

---

## 1. Por que

Hoje o acesso é configurado permissão por permissão, e quem não está
cadastrado **vê tudo**. Isso foi proposital enquanto só havia gente de
dentro e ninguém podia ficar trancado fora antes de existir um
administrador.

Duas coisas mudam isso:

- o link de login vai ser **enviado para pessoas**, em vez de o acesso
  ser criado por alguém que já está dentro;
- a **Mehoo é fornecedor externo** e vai entrar no mesmo sistema.

Com essas duas, "não cadastrado vê tudo" deixa de ser uma proteção
contra travar alguém e passa a ser um vazamento com hora marcada.

## 2. Os quatro perfis

Cada pessoa tem **um** perfil, e só um. Não há ajuste fino por cima: se
dois "GC" pudessem ver coisas diferentes, ninguém perceberia — e a
tela de acessos deixaria de responder a pergunta que ela existe para
responder, que é *quem vê o quê*.

| Perfil | Módulos | Obras | Edita? |
|---|---|---|---|
| **Administrador** | todos | todas | tudo, inclusive perfis de outras pessoas |
| **Geral** | todos, menos Equipe e acessos | todas | tudo na obra; não mexe em gente |
| **GC** | todos, menos Equipe e acessos | só onde é o responsável | tudo nas obras dele |
| **Mehoo** | só o painel Mehoo | só as que têm item da Mehoo | nada |
| *(sem perfil)* | nenhum | nenhuma | nada — sala de espera |

### Administrador
Único que abre **Equipe e acessos**. É quem define o perfil dos outros,
ativa e desativa pessoas, e é quem recebe o aviso de quem está
esperando.

**Nunca pode haver zero administradores.** O sistema recusa remover o
último — sem admin, ninguém mais entra, e a saída seria mexer no banco
à mão.

### Geral
Faz o trabalho inteiro da obra: sobe documento, confere, libera CMV,
marca compra, cria aditivo, anexa arquivo. A única coisa que não faz é
configurar gente. É o "um nível abaixo de Administrador".

### GC
Mesmos poderes do Geral, **restrito às obras em que é o responsável**.
A lista se atualiza sozinha quando uma obra troca de GC — é por isso
que a regra é "as minhas" e não uma lista marcada à mão.

O vínculo obra↔GC passa a ter **dois caminhos, gravando o mesmo campo**:

- pela obra: Dashboard → *GC responsável* → escolhe da equipe *(existe)*
- pela pessoa: Equipe e acessos → perfil GC → **escolhe as obras dela** *(a fazer)*

**Obra sem GC continua visível para o GC.** Enquanto os vínculos não
estiverem todos feitos, esconder o que não tem dono deixaria obra viva
fora da tela de todo mundo. Some dessa regra quando a obra ganhar um
responsável.

### Mehoo
Vê **só o módulo Mehoo**, e dentro dele só as obras que têm item do
canal Mehoo. Barra lateral sem lista de obras, sem os outros módulos,
sem Início. **Não edita nada** — é painel de consulta.

O painel fica **como está hoje**, com valor de material por item e
total por obra. A Mehoo é **empresa do próprio grupo**, não fornecedor
de terceiro: o custo é informação que ela precisa ter para comprar.

## 3. A entrada de alguém novo

```
  pessoa recebe o link
          ↓
  entra (Microsoft ou senha)
          ↓
  ┌──────────────────────────────────┐
  │  SALA DE ESPERA                  │
  │  "Seu acesso está em análise."   │
  │  Nada da empresa aparece.        │
  └──────────────────────────────────┘
          ↓
  aparece em Equipe e acessos como PENDENTE
  + aviso no Início dos administradores
          ↓
  admin escolhe o perfil
          ↓
  a pessoa recarrega e o sistema abre
```

**A sala de espera não mostra nada** — nem nome de obra, nem contagem,
nem valor. Só o aviso e o botão de sair.

**O aviso ao administrador é dentro do app**, em dois lugares:
- badge com a contagem no módulo Equipe e acessos
- uma linha em *Pedindo atenção*, no Início: "2 pessoas aguardando
  liberação" — clicável, leva à tela

Sem e-mail nesta etapa. E-mail exigiria um serviço de envio e uma chave
nova no proxy; se a espera se mostrar longa na prática, entra depois.

## 4. Dados

Sobre a tabela `pessoa` que já existe:

```sql
alter table pessoa add column if not exists perfil text
  check (perfil in ('admin','geral','gc','mehoo'));   -- NULL = pendente
alter table pessoa add column if not exists entrou_em    timestamptz;
alter table pessoa add column if not exists liberado_em  timestamptz;
alter table pessoa add column if not exists liberado_por text;
```

- `perfil` **nulo é o estado de espera**, e é o padrão de quem entra.
- `admin`, `modulos`, `obras_regra` e `obras` **saem de uso**. Ficam na
  tabela por enquanto para não quebrar o que está no ar; a migração
  converte (`admin = true` → `perfil = 'admin'`) e uma limpeza posterior
  as remove.
- O primeiro administrador é semeado na migração:
  `priscila.wayhs@groupws.com.br`. Sem isso, a sala de espera trancaria
  todo mundo, inclusive quem deveria liberar.

**A linha nasce sozinha no primeiro login.** Quem entra e não existe em
`pessoa` é inserido com `perfil` nulo e `entrou_em` preenchido — é isso
que faz a pessoa aparecer na fila sem ninguém digitar o e-mail dela.

## 5. Onde encosta

| Tela | O que muda |
|---|---|
| Login | nada |
| **Sala de espera** | tela nova, sem barra lateral |
| Barra lateral | módulos e obras filtrados pelo perfil |
| Início | linha "N pessoas aguardando" para admin |
| **Equipe e acessos** | pendentes no topo; escolha do perfil substitui chips de módulo e regra de obras; para GC, seletor de obras |
| Dashboard da obra | campo GC continua igual |
| Painel Mehoo | vira a tela inteira do perfil Mehoo |

## 6. Casos que precisam estar certos

| Situação | Comportamento |
|---|---|
| Zero administradores | proibido — o sistema recusa remover o último |
| Perfil muda com a pessoa logada | vale no próximo carregamento; se o módulo aberto sumiu, cai no primeiro permitido |
| GC sem nenhuma obra | entra e vê a lista vazia, com o motivo escrito |
| Pessoa desativada | volta para a sala de espera, com texto diferente ("acesso suspenso") |
| Mehoo sem item em obra nenhuma | painel vazio explicando por quê |
| Admin remove o próprio perfil | recusado se for o último; permitido se houver outro |

## 7. Fora de escopo

- e-mail de notificação
- perfis além dos quatro
- permissão por ação dentro da obra (quem pode liberar CMV, por exemplo)
- convite por link com prazo
- log de auditoria de mudanças de perfil

## 8. Respondido em 31/08

1. **GC edita** normalmente, restrito às obras dele.
2. **Só o Administrador** abre Equipe e acessos.
3. **Só `@groupws.com.br` entra.** Quem tentar com outro domínio recebe
   a recusa na tela de login, e nenhuma linha é criada em `pessoa` — a
   fila de espera não vira caixa de entrada de desconhecido.

   A Mehoo é empresa do grupo e usa o mesmo domínio. Se algum dia
   alguém precisar entrar com outro, a lista de domínios permitidos é
   uma constante em `lib/pessoas.js`.
