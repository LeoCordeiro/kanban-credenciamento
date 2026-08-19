# Kanban Credenciamento

Sistema de gestão tipo Jira/ClickUp para credenciamento de empresas. Login próprio, tempo real, drag-and-drop, tarefas aninhadas, SLA e seções globais.

## O que é
Board Kanban com 5 colunas onde cards de empresas transitam entre etapas do processo de credenciamento. Vários usuários acessam simultâneamente com atualização em tempo real. Navegação por sidebar rail (`AppNav.tsx`): Board, Atrasos, Documentações, Acessos, Tarefas.

## Autenticação
Login próprio (tabela `usuarios`), **não** Supabase Auth — o Auth do projeto está com
confirmação de e-mail ligada, o que impediria criar contas com usuário simples.
A senha é bcrypt via pgcrypto e só é conferida dentro de funções `SECURITY DEFINER`
(`login_usuario`, `criar_usuario`, `alterar_senha`); a tabela fica com RLS sem policy,
então a anon key não lê o hash. Usuários iniciais: leonardo, gabriel, emerson.

Isso protege o acesso à interface. Não é uma barreira de dados: a anon key continua
com acesso direto às demais tabelas, como já era antes do login existir.

## Tarefas (ex-checklist)
Cada empresa nasce com as etapas do `checklist_modelo` (editável em `/tarefas`) via trigger
em `empresas`. As tarefas são **da empresa**, não da plataforma. Desde a migração 005 a tabela
`checklist_itens` é uma árvore (`parent_id` auto-referente): empresa → etapa → subtarefa →
sub-subtarefa (máx. 3 níveis, imposto na UI em `TarefaLinha.tsx`). Pai não tem estado próprio:
seu concluído é o E-lógico das folhas e seu status vem delas (`statusEfetivo`); marcar pai
cascateia. Badges e progresso contam **só folhas**. O vínculo item↔modelo é por `modelo_id`
(FK), não mais por título.

Campos da tarefa: `descricao` (observação DESTA empresa), `prioridade`
(baixa/media/alta/urgente), `status` (a_fazer/fazendo/bloqueado/concluido), `prazo`
(timestamptz), `responsavel`, `sla_horas`. Editados no `TarefaModal.tsx`, aberto ao clicar
no título da tarefa.

**Instruções são do TIPO, não da instância** (migração 007): ficam em
`checklist_modelo.instrucoes` e chegam na ficha por join (`modelo:checklist_modelo(instrucoes)`),
nunca copiadas. Escrever uma vez em `/tarefas` vale para todas as empresas, inclusive as que já
existem — copiar o texto para cada empresa era o que obrigava a editar empresa por empresa.
`Checklist.tsx` tem fallback sem join para o código novo não zerar a lista quando o banco ainda
não recebeu a migração (aqui migração é manual, então essa janela sempre existe).

**`status` e `concluido` são sincronizados por trigger no banco** (`sync_status_concluido`):
`concluido` continua existindo porque board, badges e /atrasos leem dele, e a cascata do pai
faz update em massa só nele. Quem muda status explicitamente vence; senão o checkbox ajusta
o status. Não escrever os dois em desacordo pelo client.

## SLA por tipo de tarefa — em HORAS
A tela `/tarefas` (era `/checklist`; a rota antiga redireciona) é o cadastro dos tipos: nome,
**instruções**, `sla_horas` e `prioridade` padrão. Desde a migração 010 o modelo também é
árvore (`checklist_modelo.parent_id`): tarefa e **subtarefa**, com os mesmos campos e SLA
próprio. `semear_tarefas_da_empresa()` insere a árvore e depois religa os filhos ao pai daquela
empresa — o id do pai só existe depois do insert, então não dá numa passada só. Escopo de
plataforma vale pela raiz: subtarefa acompanha a tarefa dela, senão existiria subtarefa órfã em
quadro onde a mãe nem aparece. O título é único **por pai**, não global. Tarefa nova nasce com
`prazo = now() + sla_horas` (trigger `trg_criar_checklist_padrao`). "Aplicar às empresas que
já existem" preenche prazo **só onde está vazio** e ignora tarefa concluída — prazo definido
à mão nunca é sobrescrito; instruções não dependem disso (são lidas do tipo).

SLA é em horas em todo o sistema, inclusive `sla_colunas.max_horas`. `formatHoras()` em
`src/lib/tarefas.ts` mostra horas até 48h e dias acima disso.

## Documentação e escopo por plataforma (migração 008)
- `checklist_modelo_documento` (N:N com `documentos`): a documentação de consulta é vinculada
  ao TIPO e aparece dentro da tarefa na ficha da empresa, em acordeão. Assim ninguém precisa
  sair da tarefa para achar como se faz.
- `checklist_modelo_plataforma` (N:N com `plataformas`): **sem linha = tarefa vale para toda
  empresa** (comportamento de sempre); com linha(s), a tarefa só existe para empresa vinculada
  àqueles quadros. Por isso a criação virou dois gatilhos: `trg_criar_checklist_padrao`
  (`after insert on empresas`) cria só as tarefas sem restrição, e `trg_tarefas_da_plataforma`
  (`after insert on empresa_plataforma`) cria as restritas quando a empresa entra no quadro —
  é também quando o SLA daquela tarefa começa a contar.
- Sair da plataforma **não apaga** tarefa: progresso e autoria valem mais que limpeza.

## Progresso da empresa
Percentual e "tarefa da vez" saem do mesmo lugar: `fetchChecklists` no `Board.tsx` percorre a
árvore em **profundidade** (tarefa → suas subtarefas → próxima tarefa). Essa ordem é o que faz
`pendentes[0]` ser a tarefa que está na mão — ordenar plano por `ordem` misturaria subtarefa de
uma etapa com a etapa seguinte. `pct` conta **só folhas**: tarefa com subtarefa vale pelo que as
filhas somam, e fecha sozinha quando todas terminam.

No card: barra + `%` + linha "Agora: Tarefa › Subtarefa +N" (vira "Atrasada:" em vermelho quando
a tarefa da vez está vencida, e "Todas as tarefas concluídas" no fim). A ficha mostra o mesmo `%`.

A migração **009** faz a conclusão subir para a tarefa-mãe **no banco** (antes era só derivado no
client): quem lê a tabela direto — `/atrasos`, relatório, automação futura — passa a ver a mãe
concluída quando as filhas estão. `/atrasos` também não lista tarefa-mãe: quem atrasa é a folha.

**Prazo aceita os dois formatos** (`fimDoPrazo` em `src/lib/tarefas.ts`): data pura vale até
23:59 daquele dia, timestamp vale na hora. Sem isso, enquanto a 007 não roda, toda tarefa com
prazo de hoje aparecia como atrasada.

## SLA
- **Prazo por tarefa**: vale em qualquer nível, inclusive subtarefa. Vencida = chip vermelho na ficha, badge vermelho no card, linha em `/atrasos`.
- **Tempo por coluna**: `empresa_plataforma.coluna_desde` (renovado no drag) × `sla_colunas`
  (`plataforma_id` null = regra global; UI do modal Timer no board edita só a global).
  Estourou = borda âmbar + chip `⏱ Nd` no card + linha em `/atrasos`.
- **Minhas tarefas**: chip ao lado da busca filtra cards com pendência do usuário logado.

## Seções globais (da NOSSA empresa, não das credenciadas)
- `/documentacoes` — tabela `documentos` {titulo, categoria, conteudo, url}; upload opcional no bucket `empresas/documentos/`.
- `/acessos` — tabela `acessos` {titulo, categoria, url, usuario, senha, notas}. Senha em texto
  simples por decisão consciente (login protege a interface, não os dados — igual `credenciais`).
- `/atrasos` — visão cross-plataforma de tarefas vencidas + cards estourando SLA.

## Erros já cometidos aqui — não repetir
Registro completo no cofre: `Instruções/Erros do Claude - registro e prevenção.md`.
O hook `licoes-de-erro.js` injeta a lição do contexto a cada prompt; esta seção é a
versão para quem lê o repositório.

1. **Clique por coordenada apagou dado real.** Lista com lixeira no hover: o layout
   deslocou e sumiu um tipo de tarefa do modelo, sem confirmação nem erro. Clicar por
   texto/atributo via JS e conferir a contagem de registros antes e depois.
2. **Navegar com edição pendente trava o Supabase inteiro.** O diálogo nativo "Sair do
   site?" congela todas as abas do domínio e nenhuma ferramenta o dispensa.
3. **O Run do SQL Editor executa o estado interno, não o texto injetado.** Fazer
   `setValue` → **F5** → Run, e provar pelo banco — o painel de Results repete o
   resultado da migração anterior, que parece sucesso.
4. **Prazo em data pura vence às 23:59, não à meia-noite.** Comparar com o instante
   atual marcava como atrasada toda tarefa que vence hoje (`fimDoPrazo` resolve).
5. **Grep no HTML não prova deploy.** Esta é uma SPA: o texto vive no chunk `.js` e o
   CDN serve a casca. Conferir o chunk referenciado, o DOM montado, ou rota nova em 200.
6. **`form_input` não sincroniza input controlado do React.** O valor aparece na tela, o
   estado não muda, e a digitação seguinte vai para o campo errado — já gravou descrição
   dentro do título. Usar digitação real ou native setter + `dispatchEvent('input')`.

O fio comum: **a tela não é prova.** Confirmar na fonte (banco, artefato, DOM). E o mesmo
gesto repetido com o mesmo resultado significa hipótese errada, não execução errada.

## Migrações
`supabase/*.sql`, rodados à mão no SQL Editor. São idempotentes. A 005 (tarefas aninhadas,
SLA de coluna, documentos, acessos) e a 006 (campos da tarefa + SLA por tipo no modelo) foram
aplicadas em 18/08/2026 — cada uma rodada 2x para provar idempotência.
A **007** (SLA em horas + instruções no tipo), a **008** (documentação vinculada + escopo por
plataforma), a **009** (conclusão sobe para a tarefa-mãe) e a **010** (subtarefa no modelo)
foram aplicadas em 19/08/2026.

**Como rodar migração pelo SQL Editor:** injetar com `monaco...setValue(sql)`, dar **F5** e só
então clicar Run. Sem o F5 o botão executa o SQL do estado interno do React, não o texto
injetado — e devolve o resultado da migração anterior, que parece sucesso
([[feedback_supabase-sql-editor-run-executa-estado-do-react]]). Conferir sempre pelo banco.
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
