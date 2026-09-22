#!/usr/bin/env bash
# ============================================================
# Monta o banco do zero e roda os testes de policy.
#
#   supabase/tests/rodar.sh
#
# Precisa de um Postgres com a extensao pgtap, acessivel pelas variaveis
# padrao do psql (PGHOST, PGPORT, PGUSER, PGPASSWORD). O CI usa a imagem
# supabase/postgres, que ja' traz o pgtap. Localmente:
#
#   docker run -d --name confere-teste -e POSTGRES_PASSWORD=teste \
#     -p 55432:5432 supabase/postgres:15.8.1.060
#   PGHOST=localhost PGPORT=55432 PGUSER=postgres PGPASSWORD=teste \
#     supabase/tests/rodar.sh
#
# Cria um banco NOVO (confere_teste) a cada execucao e o apaga no fim:
# teste que depende do que sobrou do teste anterior nao prova nada.
# ============================================================
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
SQL="$(cd "$AQUI/.." && pwd)"
BANCO="confere_teste"

psql_base() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
no_banco()  { psql_base -d "$BANCO" "$@"; }

aplicar() {
  local arquivo="$1"
  if ! saida=$(no_banco -f "$arquivo" 2>&1); then
    echo "✗ falhou ao aplicar $(basename "$arquivo"):"
    echo "$saida" | grep -iE "error|erro" | head -5
    exit 1
  fi
}

psql_base -d postgres -c "drop database if exists $BANCO" -c "create database $BANCO" >/dev/null
trap 'psql_base -d postgres -c "drop database if exists $BANCO" >/dev/null 2>&1 || true' EXIT

aplicar "$AQUI/_ambiente.sql"

# A ORDEM IMPORTA. Esta lista e' a versao executavel da ordem descrita em
# supabase/README.md — se uma mudar, a outra muda junto. Os blocos:
#   1. estrutura   2. acesso (nesta ordem exata)   3. o resto do dominio
ESTRUTURA=(
  schema.sql equipe.sql
  acessos.sql perfis.sql admin-master.sql
  eap.sql etapas.sql prazos.sql escopos.sql
  aditivos.sql aditivo-exclusao.sql aditivo-aguardando.sql alocacao.sql
  apresentacao.sql obra-versao.sql obra-versao-liberado-carimbo.sql obra-comentario.sql
  arquivos.sql arquivos-obra.sql catalogo.sql insumo-sienge.sql
  sienge_obra.sql sienge_eap.sql sienge_solicitacao.sql sienge_obra_status_manual.sql
  compradores.sql mao-de-obra-propria.sql pessoa-canal.sql
  ultimo-acesso.sql foto-perfil.sql equipe-da-obra.sql taylor-made.sql contrato-restrito.sql patch-obra.sql
  preferencia.sql
)
for f in "${ESTRUTURA[@]}"; do aplicar "$SQL/$f"; done

# A equipe cadastrada, com um master — que e' a condicao pra fechar o acesso.
aplicar "$AQUI/00-massa.sql"

# 5. Fechar o acesso, os tres juntos.
for f in pessoa-escrita-restrita.sql rls-perfis.sql rls-perfis-complemento.sql; do
  aplicar "$SQL/$f"
done

# 6. O reforco da varredura de 21/09/2026 — sempre depois do bloco 5 — e a
#    garantia da RN-001 (usa o meu_perfil() do reforco).
aplicar "$SQL/rls-reforco.sql"
aplicar "$SQL/rn-001-liberacao-de-compra.sql"

# Os testes. `finish(true)` faz o pgTAP levantar erro quando algo falha,
# e o ON_ERROR_STOP transforma isso no codigo de saida que o CI enxerga.
falhou=0
for t in "$AQUI"/[0-9][0-9]-*.sql; do
  nome="$(basename "$t")"
  [ "$nome" = "00-massa.sql" ] && continue
  if saida=$(no_banco -t -f "$t" 2>&1); then
    echo "✓ $nome — $(echo "$saida" | grep -c '^ *ok ') ok"
  else
    falhou=1
    echo "✗ $nome"
    echo "$saida" | grep -E "not ok|#|ERROR" | sed 's/^/    /'
  fi
done

exit $falhou
