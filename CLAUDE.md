# Kanban Credenciamento

Sistema Kanban simples para gerenciar credenciamento de empresas. 2 usuários, tempo real, drag-and-drop.

## O que é
Board Kanban com 6 colunas onde cards de empresas transitam entre etapas do processo de credenciamento. 2 usuários acessam simultâneamente com atualização em tempo real.

## Colunas
1. **A Analisar** — empresa recém cadastrada, aguardando análise
2. **Infraestrutura** — configurando infraestrutura necessária
3. **Cadastro Inicial** — realizando cadastro nos sistemas
4. **Concluído** — credenciamento finalizado
5. **Descredenciado** — empresa removida/inativa

## Card (Épico)
Cada card representa uma empresa com os campos:
- Razão Social (obrigatório)
- Nome Fantasia
- CNPJ (obrigatório, formato XX.XXX.XXX/XXXX-XX)
- Atividade/CNAE Principal
- Nome Completo (responsável)
- CPF
- Data de Nascimento
- Endereço
- Informações Bancárias
- E-mails
- WhatsApp
- Site

## Funcionalidades
- Drag-and-drop entre colunas
- Criar/editar/excluir cards
- 2 usuários com login (email/senha)
- **Tempo real**: quando um usuário move um card, o outro vê instantaneamente
- Filtro/busca por nome ou CNPJ

## Stack
- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Supabase** (free tier):
  - PostgreSQL (banco)
  - Auth (login de 2 usuários)
  - Realtime (WebSocket — atualização instantânea)
- **@dnd-kit** (drag-and-drop)
- **Deploy**: Vercel (free)

## Custo: R$ 0
- Supabase free: 500MB banco, 50k rows, 2 auth users, realtime incluso
- Vercel free: hosting
- Domínio: subdomínio gratuito da Vercel

## Estrutura
```
kanban-credenciamento/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (dashboard)/page.tsx      — board kanban
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── kanban/
│   │       ├── Board.tsx              — board com 6 colunas
│   │       ├── Column.tsx             — coluna com drag target
│   │       ├── Card.tsx               — card da empresa
│   │       └── CardForm.tsx           — modal criar/editar
│   ├── lib/
│   │   ├── supabase.ts               — client Supabase
│   │   └── database.types.ts         — tipos gerados do Supabase
│   └── types/
│       └── kanban.ts                  — tipos do domínio
├── public/
└── CLAUDE.md
```

## Supabase Schema
```sql
-- Tabela de empresas (cards)
create table empresas (
  id uuid primary key default gen_random_uuid(),
  coluna text not null default 'a_analisar',
  posicao int not null default 0,
  razao_social text not null,
  nome_fantasia text,
  cnpj text not null unique,
  cnae_principal text,
  nome_completo text,
  cpf text,
  data_nascimento date,
  endereco text,
  info_bancarias text,
  emails text,
  whatsapp text,
  site text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Realtime
alter publication supabase_realtime add table empresas;

-- RLS (Row Level Security)
alter table empresas enable row level security;
create policy "Authenticated users can do everything"
  on empresas for all
  using (auth.role() = 'authenticated');
```

## Colunas válidas
```typescript
const COLUNAS = [
  { id: 'a_analisar', nome: 'A Analisar', cor: 'yellow' },
  { id: 'infraestrutura', nome: 'Infraestrutura', cor: 'blue' },
  { id: 'cadastro_inicial', nome: 'Cadastro Inicial', cor: 'purple' },
  { id: 'concluido', nome: 'Concluído', cor: 'green' },
  { id: 'descredenciado', nome: 'Descredenciado', cor: 'red' },
] as const;
```

## Skills deste projeto (`.claude/skills/`)

| Skill | Quando | Obrigatório |
|-------|--------|-------------|
| **ponytail** | Toda tarefa — decisão ladder antes de codar | Sim — SEMPRE |
| **improve** | Antes de entregar — auditar bugs | Sim — antes de deploy |
| **frontend-design** | UI do board — anti-AI-slop | Sim |
| **quality-gate** | Último passo antes de dizer "pronto" | Sim — SEMPRE |

## Portas
- Dev: `http://localhost:3003` (não conflitar com outros projetos)

## Como rodar
```bash
npm install
cp .env.example .env.local  # preencher com keys do Supabase
npm run dev -- -p 3003
```
