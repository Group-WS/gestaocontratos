# RN-014 · O contrato da obra é só do administrador

**Status:** proposta
**Contexto:** Acessos · Arquivos da obra
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O contrato assinado da obra só é visto, anexado, trocado ou removido pelo Administrador ou pelo Admin master — inclusive o registro de quem mexeu nele.

## Por quê

`supabase/contrato-restrito.sql` e `supabase/admin-master.sql:20-22` ("o admin master continua abrindo o contrato da obra ... como o Administrador").

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um GC na obra dele | abre Arquivos da obra | o contrato não aparece na lista. |
| Um GC | pede o link do arquivo `2450/contrato/...` à API | o Storage recusa. |
| Um Administrador | anexa o contrato | consegue, e o evento "anexou contrato" fica registrado e só administradores o leem. |

## Fora do escopo

Os demais cadernos da obra (seguem [RN-010](RN-010-quem-ve-qual-obra.md) e [RN-011](RN-011-quem-edita-e-cria-obra.md)).

## Implementação

- Hoje: Tela `web/src/App.jsx:19611-19619` (`arquivosDaObra`, `souAdmin`); banco `supabase/rls-reforco.sql:238-282` (Storage, pasta `contrato`) e `supabase/obra-arquivo-evento.sql` (policies de ler e registrar). O servidor não confere: as rotas de arquivo repassam ao Storage com o login da pessoa.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [dashboard](../funcionalidades/dashboard.md), [login-e-acessos](../funcionalidades/login-e-acessos.md), [obra-documentos](../funcionalidades/obra-documentos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
