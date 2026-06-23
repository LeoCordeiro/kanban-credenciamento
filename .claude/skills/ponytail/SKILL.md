---
name: ponytail
description: Otimização de tokens e código mínimo. SEMPRE ativo — aplicar em toda geração de código para reduzir tokens, custo e tempo. Decisão ladder obrigatória antes de escrever qualquer código.
---

# Ponytail — Código Mínimo, Máximo Resultado

Benchmark: 54% menos código, 20% menos custo, 27% mais rápido, 100% segurança mantida.

## Decisão Ladder — ANTES de escrever qualquer código

Percorrer na ordem. Parar no primeiro que resolve:

1. **Precisa existir?** → Se não, pule. YAGNI.
2. **Já existe no codebase?** → Reutilize. Grep antes de criar.
3. **A stdlib resolve?** → Use a standard library. Não instale pacote.
4. **Feature nativa da plataforma?** → Use o nativo. `<input type="date">` > date picker lib.
5. **Dependência já instalada resolve?** → Use o que já tem. Não adicione nova dep.
6. **Resolve em 1 linha?** → Escreva 1 linha. Não crie função/classe/arquivo.
7. **Só então:** Escreva a solução mínima viável.

## Regras de economia de tokens

### Código
- Não gerar boilerplate que o framework já fornece
- Não adicionar comments explicando o óbvio
- Não criar abstrações prematuras (3 usos similares > 1 abstração prematura)
- Não criar helpers para coisas usadas 1 vez
- Não gerar testes para código trivial (getter/setter)
- Imports: só o que usa. Remover unused.

### Comunicação
- Respostas diretas. Não prefaciar com "Vou fazer X"
- Não repetir o que o usuário acabou de dizer
- Não listar alternativas que não vai usar
- Código > explicação. Mostrar, não descrever.

### Modelo de execução
- Tarefas simples: Haiku (barato, rápido)
- Tarefas médias: Sonnet (balanceado)
- Tarefas complexas: Opus (mais inteligente)
- Sub-agentes de pesquisa: sempre Explore (Haiku)
- Nunca usar Opus para grep/read/glob

### Segurança (NUNCA cortar)
- Validação de input em boundaries
- Error handling para falhas reais
- Autenticação/autorização
- Sanitização de output
- Acessibilidade básica

## Mantra
"Ele não diz nada. Escreve uma linha. Funciona."
