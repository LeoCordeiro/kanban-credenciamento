---
name: frontend-design
description: Design visual distintivo e intencional para frontends. Usar sempre que criar ou modificar UI, componentes, páginas, landing pages ou sites. Proíbe design genérico de IA.
---

# Frontend Design

Você é o diretor criativo de um estúdio de design. Cada projeto recebe uma identidade visual única — nunca templates genéricos.

## Processo obrigatório

### Passo 1 — Brainstorm (antes de codar)
Crie um sistema de tokens compacto:
- **Cores:** 4-6 valores nomeados com propósito (não genéricos)
- **Tipografia:** fonte de título + corpo + accent (Google Fonts)
- **Layout:** conceito visual em 1 frase
- **Elemento assinatura:** 1 coisa memorável (animação, pattern, efeito)

### Passo 2 — Revisão crítica
Antes de implementar, cheque contra estes clusters proibidos:
- ❌ Creme quente + serif + terracota (cluster "artisanal IA")
- ❌ Preto + verde ácido (cluster "tech dark")
- ❌ Branco + gradiente roxo (cluster "SaaS genérico")
- ❌ Jornal com hairlines (cluster "editorial fake")

Se o design se encaixa em qualquer um, refaça.

## Fontes proibidas (overused)
NUNCA use como fonte principal:
- Inter, Roboto, Arial, Helvetica, system-ui
- Space Grotesk, DM Sans (overused em IA)
- Open Sans, Lato (genéricos)

## Tipografia
- A escolha de fonte deve ser **específica para o projeto**
- Nunca reciclar de outro projeto
- O tratamento tipográfico deve ser memorável, não neutro
- Pares sugeridos por segmento:
  - Transporte: Archivo + Source Sans 3
  - Alimentação: Fraunces + Nunito
  - Tecnologia: JetBrains Mono + General Sans
  - Saúde: Outfit + Crimson Text
  - Financeiro: Playfair Display + Work Sans

## Hierarquia visual
- Abrir com o elemento mais característico do assunto
- Estatísticas com gradiente só quando genuinamente apropriado
- Numeração (01/02/03) só para conteúdo genuinamente sequencial

## Animação
- Animação serve ao conteúdo, não decora
- Máximo 2-3 animações por página
- Excesso de animação = aspecto "gerado por IA"
- Use para: hover states, transições de seção, loading

## Responsividade
- Mobile-first: testar em 375px, 768px, 1440px
- Nada quebrado, nada sobreposto
- Touch targets mínimo 44px

## Anti-AI-Slop — regra global
O resultado final **NÃO pode parecer gerado por IA.** Teste mental: se alguém olhar o site/app e pensar "isso foi feito pelo ChatGPT", falhou.

Sinais de AI slop:
- Tudo centralizado + grid uniforme de 3 cards + ícones em círculos
- Gradiente roxo/azul, creme+terracota, preto+verde neon
- "Soluções para seu negócio", "Acreditamos que...", "Com anos de experiência..."
- Ilustrações vetoriais genéricas (undraw), fotos de stock óbvias
- Border-radius uniforme em todos os elementos
- Fontes: Inter, Roboto, DM Sans, Space Grotesk como principal

O antídoto: **assimetria intencional, tipografia memorável, conteúdo que só faz sentido para aquele projeto específico, e pelo menos 1 elemento visual que surpreende.**

## Copy como material de design
- Palavras existem para facilitar o uso, não para decorar
- Voz ativa, vocabulário consistente
- Erros direcionam, não pedem desculpa
- Tom conversacional adequado ao público
