# Regras de negócio

Catálogo das regras de negócio deste projeto — o que o negócio **permite, calcula ou exige**,
independentemente de tela ou tecnologia. Cada regra tem uma ficha `RN-NNN-titulo-curto.md`, e o
código da regra (na camada de regras) cita o ID.

**Regras são protegidas.** Agentes de IA não as alteram sem pedido explícito do dev; mudar uma
regra exige atualizar a ficha no mesmo commit, com uma linha nova em Histórico.
Padrão completo: `.quality/regras/02-regras-de-negocio.md`.

## Como criar uma regra

1. Confira o último número abaixo.
2. Copie `_template.md` para `RN-NNN-titulo-curto.md` e preencha. Regra nova nasce `proposta`.
3. Implemente a função pura e o teste com os exemplos da ficha.
4. Adicione a linha no índice. A ficha passa a `vigente` quando o dev confirmar o enunciado.

## Índice

| ID | Regra | Status | Contexto |
|---|---|---|---|
