# Kanban Credenciamento

Sistema de gestão tipo Jira/ClickUp para credenciamento de empresas. Login próprio, tempo real, drag-and-drop, tarefas aninhadas, SLA e seções globais.

## O que é
Board Kanban com 5 colunas onde cards de empresas transitam entre etapas do processo de credenciamento. Vários usuários acessam simultâneamente com atualização em tempo real. Navegação por sidebar rail (`AppNav.tsx`): Board, Atrasos, Documentações, Acessos, Checklist padrão.

## Autenticação
Login próprio (tabela `usuarios`), **não** Supabase Auth — o Auth do projeto está com
confirmação de e-mail ligada, o que impediria criar contas com usuário simples.
A senha é bcrypt via pgcrypto e só é conferida dentro de funções `SECURITY DEFINER`
(`login_usuario`, `criar_usuario`, `alterar_senha`); a tabela fica com RLS sem policy,
então a anon key não lê o hash. Usuários iniciais: leonardo, gabriel, emerson.

Isso protege o acesso à interface. Não é uma barreira de dados: a anon key continua
com acesso direto às demais tabelas, como já era antes do login existir.

## Tarefas (ex-checklist)
Cada empresa nasce com as etapas do `checklist_modelo` (editável em `/checklist`) via trigger
em `empresas`. As tarefas são **da empresa**, não da plataforma. Desde a migração 005 a tabela
`checklist_itens` é uma árvore (`parent_id` auto-referente): empresa → etapa → subtarefa →
sub-subtarefa (máx. 3 níveis, imposto na UI em `TarefaLinha.tsx`). Pai não tem estado próprio:
seu concluído é o E-lógico das folhas e seu status vem delas (`statusEfetivo`); marcar pai
cascateia. Badges e progresso contam **só folhas**. O vínculo item↔modelo é por `modelo_id`
(FK), não mais por título.

Campos da tarefa (migração 006): `descricao`, `prioridade` (baixa/media/alta/urgente),
`status` (a_fazer/fazendo/bloqueado/concluido), `prazo`, `responsavel`, `sla_dias`.
Editados no `TarefaModal.tsx`, aberto ao clicar no título da tarefa.

**`status` e `concluido` são sincronizados por trigger no banco** (`sync_status_concluido`):
`concluido` continua existindo porque board, badges e /atrasos leem dele, e a cascata do pai
faz update em massa só nele. Quem muda status explicitamente vence; senão o checkbox ajusta
o status. Não escrever os dois em desacordo pelo client.

## SLA por tipo de tarefa
No cadastro do modelo (`/checklist`) cada tipo tem `sla_dias`, `prioridade` e `descricao`
padrão. Tarefa nova nasce com `prazo = data de criação + sla_dias` (trigger
`trg_criar_checklist_padrao`). "Aplicar às empresas que já existem" preenche prazo **só onde
está vazio** e ignora tarefa concluída — prazo definido à mão nunca é sobrescrito.

## SLA
- **Prazo por tarefa**: vencida = chip vermelho na ficha, badge vermelho no card, linha em `/atrasos`.
- **Tempo por coluna**: `empresa_plataforma.coluna_desde` (renovado no drag) × `sla_colunas`
  (`plataforma_id` null = regra global; UI do modal Timer no board edita só a global).
  Estourou = borda âmbar + chip `⏱ Nd` no card + linha em `/atrasos`.
- **Minhas tarefas**: chip ao lado da busca filtra cards com pendência do usuário logado.

## Seções globais (da NOSSA empresa, não das credenciadas)
- `/documentacoes` — tabela `documentos` {titulo, categoria, conteudo, url}; upload opcional no bucket `empresas/documentos/`.
- `/acessos` — tabela `acessos` {titulo, categoria, url, usuario, senha, notas}. Senha em texto
  simples por decisão consciente (login protege a interface, não os dados — igual `credenciais`).
- `/atrasos` — visão cross-plataforma de tarefas vencidas + cards estourando SLA.

## Migrações
`supabase/*.sql`, rodados à mão no SQL Editor. São idempotentes. A 005 (tarefas aninhadas,
SLA de coluna, documentos, acessos) e a 006 (campos da tarefa + SLA por tipo no modelo) foram
aplicadas em 18/08/2026 — cada uma rodada 2x para provar idempotência.
Não existe 001 baseline: as tabelas base (empresas, plataformas, empresa_plataforma,
comentarios, anexos, credenciais) foram criadas à mão e não estão versionadas.

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
