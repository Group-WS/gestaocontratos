# ADR-001 — Perfis fechados, sala de espera e trava no banco

Gestão de Obras TKWS · 31/08/2026 · **Aceito**

---

## Contexto

O controle de acesso foi construído como permissões soltas: por pessoa,
marcam-se os módulos e escolhe-se uma regra de obras. Quem não está
cadastrado vê tudo — proposital, para que ninguém ficasse trancado fora
antes de existir um administrador.

Duas mudanças quebram essa premissa:

1. O link de login passa a ser **enviado** para as pessoas. Elas entram
   antes de existir qualquer configuração para elas.
2. A **Mehoo é fornecedor externo** e entra no mesmo sistema.

Com fornecedor de fora, "não cadastrado vê tudo" deixa de ser uma
proteção contra travar alguém e vira um vazamento com hora marcada.

## Decisões

### 1. Quatro perfis fechados, sem ajuste fino

Administrador, Geral, GC e Mehoo. Uma pessoa tem um perfil e só um.

**Por quê.** A tela de acessos existe para responder *quem vê o quê*.
Com ajuste por cima do perfil, duas pessoas marcadas "GC" podem ver
coisas diferentes e ninguém percebe — a resposta que a tela dá passa a
ser aproximada, que é o mesmo que não ter resposta.

**Custo aceito.** Um caso fora dos quatro exige criar um perfil no
código, não configurar na tela. Aceito enquanto os quatro cobrirem a
empresa; se aparecer um quinto caso legítimo, ele vira perfil.

**Descartado:** perfil como ponto de partida ajustável (flexível, mas
reintroduz o desvio silencioso) e perfil com exceções marcadas (honesto,
mas mantém a complexidade que motivou a mudança).

### 2. Sala de espera: sem perfil, sem nada

Quem entra e ainda não tem perfil vê uma tela dizendo que o acesso está
em análise. Nenhum dado da empresa — nem contagem, nem nome de obra.

**Por quê.** É o único estado inicial defensável com gente de fora
entrando. Qualquer default que mostre algo é uma decisão sobre o que um
desconhecido pode ver, tomada por antecipação e para todos os casos
futuros de uma vez.

**Custo aceito.** Alguém pode ficar parado esperando. Mitigado pelo
aviso ao administrador e pela regra de nunca haver zero administradores.

**Descartado:** manter "vê tudo" (o problema que motivou o ADR) e
"perfil Geral por padrão" (continua errado justamente para a Mehoo, que
é o caso que forçou a mudança).

### 3. O aviso é dentro do app, não por e-mail

Badge no módulo Equipe e acessos e uma linha em *Pedindo atenção* no
Início.

**Por quê.** Funciona hoje, sem serviço externo, sem chave nova no
proxy, sem mais um lugar que pode cair. O Início já é a tela que a
pessoa abre, e já é onde as pendências moram.

**Custo aceito.** Não chega com o app fechado. Se a espera se mostrar
longa na prática, e-mail entra depois — a decisão de agora não impede.

### 4. Geral edita a obra, não mexe em gente

**Por quê.** É o que "um nível abaixo de Administrador" significa na
prática: faz o trabalho, não distribui acesso. Separar por ato — quem
pode liberar CMV, quem pode concluir obra — seria um segundo sistema de
permissões dentro do primeiro, e não foi pedido.

### 5. O painel da Mehoo continua mostrando valores

Valor de material por item e total por obra, como está hoje.

**Por quê.** É o que permite ao fornecedor conferir o pedido contra o
que foi mandado. O recorte já é por canal: ela vê apenas os itens
marcados como Mehoo, nas obras que os têm.

**Risco assumido, e é o ponto mais delicado deste documento.** Preço de
compra da empresa fica visível para um terceiro. A decisão foi tomada
com isso dito. Se mudar de ideia, o ajuste é pequeno — esconder as
colunas de valor no perfil Mehoo — e não muda mais nada.

### 6. RLS escrito agora, ligado depois

As políticas de Row Level Security são escritas junto com esta entrega e
ficam prontas, **desligadas**. São ligadas quando os perfis estiverem
atribuídos e conferidos, com acompanhamento.

**Por quê.** Sem RLS, o filtro é só de tela: quem souber usar a API vê
tudo. Com fornecedor externo, isso precisa acabar. Mas ligar antes de
os cadastros existirem tranca todo mundo ao mesmo tempo, inclusive quem
resolveria.

**Custo aceito.** Existe uma janela em que o acesso é aparência, não
trava. A janela é conhecida, tem fim definido — perfis atribuídos — e
está escrita aqui para não ser esquecida.

**Descartado:** ligar junto com a entrega (trava todo mundo se algum
perfil estiver errado) e deixar para quando a Mehoo entrar (vira algo a
lembrar depois, e é fácil esquecer).

## Consequências

**Ganha-se**
- uma resposta exata para "quem vê o quê", legível numa lista
- um estado inicial seguro por padrão, em vez de aberto por padrão
- caminho pronto para a trava real no banco
- a Mehoo pode entrar sem que isso signifique abrir a empresa

**Perde-se**
- flexibilidade: caso fora dos quatro exige código
- imediatismo: ninguém trabalha antes de um admin liberar
- as colunas `admin`, `modulos`, `obras_regra` e `obras` viram legado a
  remover depois da migração

**Fica pendente**
- ligar o RLS (item 6) — o único ponto que ainda deixa o acesso sendo
  aparência
- decidir se bloqueia domínio de e-mail na entrada
- confirmar as três perguntas em aberto na SPEC, seção 8

## Referências

- `docs/SPEC-acessos.md` — o comportamento em detalhe
- `supabase/equipe.sql`, `supabase/acessos.sql` — o que já está no banco
- `web/src/lib/pessoas.js` — `podeVerModulo` e `obrasPermitidas`, as
  duas funções que hoje decidem o que aparece
