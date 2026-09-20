<!-- groupws-dev-quality:inicio · padrão 1.0.0 · gerado por instalar.mjs — não edite entre os marcadores -->
@AGENTS.md

## Gate de qualidade no Claude Code

Os hooks de `.claude/settings.json` aplicam o gate automaticamente:

- **Início da sessão:** o estado do gate e o catálogo de regras de negócio entram no contexto.
- **Antes de editar** arquivo existente da camada de regras de negócio ou uma ficha `RN-NNN`: o
  Claude Code pede a confirmação do dev.
- **Ao encerrar** com mudanças no repositório: o gate roda; se reprovar, a sessão continua para
  corrigir ou reportar.

Os hooks ajudam, mas não substituem o protocolo do `AGENTS.md`: rode o gate na entrada e na saída.
<!-- groupws-dev-quality:fim -->
