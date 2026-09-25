# ADR-009 — Configurações vira um hub de atalhos

Gestão de Obras TKWS · 25/09/2026 · **Decidido pelo dev, item a item · revisado e implementado na branch `feat/hub-de-configuracoes`**

---

## O pedido

> "Precisamos ter uma tela de configurações, que tem as opções de configurações na tela, ou seja,
> atalhos como hoje é feito no tkws-os (…). Aí Insumos deve ser uma outra tela."

## Como é hoje

- O módulo **Configurações** (ADR-008) é uma página com abas. Tem uma aba só, o Cadastro de
  Insumos, e só o administrador vê o módulo (RN-086).
- **Equipe e acessos** (`equipe`), **Banco de Preços** (`precos`) e **EAP Sienge** (`eap`) são
  módulos soltos no menu lateral. Cada um tem sua regra de quem vê: Equipe segue
  `podeGerenciarPessoas`, e os outros seguem os módulos liberados pelo perfil.
- No tkws-os (ADR-182 de lá), a página `/settings` mostra um cartão por área, com os links das
  telas e uma busca por cima. Dentro de cada tela de configuração aparece um índice fixo com todas
  as áreas.

## Decisões

1. **Com o que o DS já tem.** O `@group-ws/ws-ui` 1.3.0 não tem os componentes `SettingsHub` e
   `SettingsIndex` do tkws-os. O hub e o índice são montados com peças do DS (PageShell, Card,
   links, campo de busca), sem cor nem componente fora dele. **Lacuna do DS registrada:** levar o
   `settings-nav` do tkws-os para o `ws-ui`. Quando ele entrar, a tela troca de peças.
2. **O hub tem três partes:** os cartões com os atalhos, a busca por nome e sinônimos, e o índice
   lateral dentro de cada tela de configuração. **Fica de fora** o painel aberto pelo atalho ⌘,.
3. **Duas áreas:**
   - **Acesso** — Equipe e acessos.
   - **Sienge** — Banco de Preços, EAP Sienge e Cadastro de Insumos.
4. **Equipe, Banco de Preços e EAP Sienge saem do menu lateral.** Eles passam a ser abertos só pelo
   hub. No menu fica apenas "Configurações". Os atalhos que já abrem esses módulos, como o alerta
   "Liberar acesso" do Início, continuam indo direto para a tela.
5. **Cada pessoa vê o que pode.** O hub aparece para quem tem acesso a pelo menos um dos atalhos e
   mostra só esses. A regra de cada tela continua a mesma de hoje: `podeVerModulo` e
   `podeGerenciarPessoas` no menu, e a API e o RLS de verdade. Nenhuma regra de negócio muda:
   RN-086 continua valendo para Insumos.
6. **Insumos ganha tela própria em `/configuracoes/insumos`.** A tela deixa de ser uma aba e o
   botão voltar do navegador leva de volta ao hub. As outras telas também ganham endereço abaixo do
   hub: `/configuracoes/equipe`, `/configuracoes/precos` e `/configuracoes/eap`. Os endereços
   antigos continuam funcionando e redirecionam.

## Consequências

- A E2E `e2e/configuracoes.spec.mjs` passa a entrar pelo hub. Os testes que abrem Equipe, Banco de
  Preços ou EAP pelo menu lateral mudam para entrar pelo hub.
- Não muda banco nem API.

## Como ficou (25/09/2026)

- Catálogo único em `web/src/features/configuracoes/atalhos.js`, lido pelo hub
  (`ConfiguracoesPage.jsx`) e pelo índice (`IndiceDeConfiguracoes.jsx`). Insumos em
  `CadastroDeInsumosPage.jsx`, módulo `insumos`.
- `podeVerModulo("configuracoes")` passou a ser "vê pelo menos um dos quatro"; o Cadastro de
  Insumos segue RN-086 (`podeVerModulo("insumos")`). Nenhuma regra de negócio mudou.
- O contador de acessos a liberar, que ficava na Equipe do menu, passou para "Configurações".
- O botão do aviso no Banco de Preços abre direto o Cadastro de Insumos.
- **Segunda lacuna do DS:** o `ListGroupItem` do 1.3.0 abre no clique, mas não recebe foco nem se
  anuncia como botão. Os atalhos completam com `role`, `tabIndex` e Enter/Espaço (`comoBotao`),
  até o DS corrigir.
- Testes: `web/src/__testes__/hub-de-configuracoes.test.mjs` e `e2e/configuracoes.spec.mjs`
  (hub, índice, endereço antigo e acesso negado).
