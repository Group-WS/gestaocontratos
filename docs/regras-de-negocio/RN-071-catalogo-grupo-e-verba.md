# RN-071 · O grupo do catálogo é a verba da EAP

**Status:** proposta
**Contexto:** Catálogo TKWS
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Todo produto do Catálogo TKWS pertence a uma verba da EAP da casa (o "grupo" do catálogo é a verba), e é nessa verba que ele entra quando vai para uma obra.

## Por quê

Os grupos da planilha dela já eram verbas com outro nome (ILUMINAÇÃO = 05, LOUÇAS E METAIS = 27…); amarrar evita um terceiro vocabulário (`supabase/catalogo.sql:29-33`; `web/src/lib/catalogoModelo.js:1-19`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um produto novo sem grupo | a pessoa grava | é recusado: "O grupo é obrigatório". |
| Um spot da verba 05 | é enviado a uma obra | entra na verba 05 do Executivo. |
| Uma planilha com grupo que não casa com verba nenhuma | é importada | os produtos desse grupo não entram e a prévia avisa. |

## Fora do escopo

Subgrupo (é sugestão, não regra).

## Implementação

- Hoje: Banco `verba text not null references eap_grupo(num)` (`supabase/catalogo.sql:33`); API `z.string().min(1)` (`web/api/_lib/rotas/catalogo.js:59`); tela `web/src/lib/catalogo.js:64`, importação `web/src/Catalogo.jsx:974` (linha sem verba não entra).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [catalogo](../funcionalidades/catalogo.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
