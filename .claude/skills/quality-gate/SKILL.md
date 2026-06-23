---
name: quality-gate
description: Gate de qualidade obrigatório antes de entregar qualquer feature. Usar SEMPRE como último passo antes de reportar ao Leonardo que algo está pronto.
---

# Quality Gate — Validação de Entrega

## Regra absoluta
NUNCA dizer "está pronto" sem ter passado por TODOS os checks abaixo.

## Gate 1 — Compilação
```bash
# Frontend TypeScript
npx tsc --noEmit

# Backend Python
python -c "import app.main"

# Se falhar: corrigir ANTES de prosseguir
```

## Gate 2 — Rotas e navegação
- Abrir o projeto no navegador
- Clicar em CADA link do menu/nav
- Cada link deve levar a uma página que existe e carrega
- Se algum link dá 404 ou erro: a página não foi criada — criar ANTES de entregar

## Gate 3 — Formulários
- Preencher cada formulário com dados válidos → deve funcionar
- Preencher com dados inválidos → deve mostrar erro amigável
- Submeter vazio → deve validar campos obrigatórios

## Gate 4 — Design visual
- Layout sem elementos quebrados ou sobrepostos
- Textos legíveis (contraste adequado)
- Responsivo: não quebra em tela pequena
- Estados vazios tratados (não mostrar tela em branco)
- Loading states para chamadas de API

## Gate 5 — Portas e conflitos
- Verificar que a porta não está em uso por outro projeto
- Projetos do Leonardo:
  - Sacolão backend: 8000
  - Sacolão frontend: 5173
  - Empresa Pronta backend: 8001
  - Empresa Pronta frontend: 3002
  - Mission Control: 3001

## Gate 6 — Console limpo
- Abrir DevTools (F12) no navegador
- Tab Console: não deve ter erros vermelhos
- Warnings são aceitáveis, erros não

## Se qualquer gate falhar
CORRIGIR antes de dizer que está pronto. Não entregar com "depois a gente corrige".

## Histórico de falhas (para não repetir)
- 22/06/2026: Mission Control entregue com links que não funcionavam (rotas inexistentes)
- 22/06/2026: Empresa Pronta rodando na porta errada
- 22/06/2026: PDV com 3 bugs de conflito de teclado
