-- ============================================================================
-- Kanban Credenciamento — migração v5
-- Tarefas aninhadas (parent_id), prazo/responsável, SLA por coluna,
-- Documentações e Acessos globais.
--
-- Rodar inteiro no SQL Editor do Supabase. É idempotente: pode rodar de novo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TAREFAS ANINHADAS — checklist_itens vira árvore
--    Itens existentes viram etapas raiz (parent_id null), nada se perde.
-- ----------------------------------------------------------------------------

alter table checklist_itens add column if not exists parent_id   uuid references checklist_itens(id) on delete cascade;
alter table checklist_itens add column if not exists prazo       date;
alter table checklist_itens add column if not exists responsavel text;
alter table checklist_itens add column if not exists modelo_id   uuid references checklist_modelo(id) on delete set null;

create index if not exists idx_checklist_parent on checklist_itens(parent_id);
create index if not exists idx_checklist_prazo  on checklist_itens(prazo) where prazo is not null;

-- Vínculo item↔modelo deixa de ser por título (frágil a rename) e vira FK.
-- Backfill uma vez; o "where modelo_id is null" garante idempotência.
update checklist_itens c
set modelo_id = m.id
from checklist_modelo m
where c.modelo_id is null and c.parent_id is null and c.titulo = m.titulo;


-- ----------------------------------------------------------------------------
-- 2. TRIGGER e APLICAR MODELO passam a usar modelo_id
-- ----------------------------------------------------------------------------

create or replace function trg_criar_checklist_padrao()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into checklist_itens (empresa_id, titulo, ordem, modelo_id)
  select new.id, m.titulo, m.ordem, m.id from checklist_modelo m;
  return new;
end $$;

create or replace function aplicar_checklist_modelo()
returns table (empresas_afetadas int, itens_inseridos int)
language plpgsql security definer set search_path = public
as $$
declare
  v_itens int := 0;
  v_emp   int := 0;
begin
  with inseridos as (
    insert into checklist_itens (empresa_id, titulo, ordem, modelo_id)
    select e.id, m.titulo, m.ordem, m.id
    from empresas e
    cross join checklist_modelo m
    where not exists (
      select 1 from checklist_itens c
      where c.empresa_id = e.id
        and (c.modelo_id = m.id or (c.modelo_id is null and c.titulo = m.titulo))
    )
    returning empresa_id
  )
  select count(*)::int, count(distinct empresa_id)::int
  into v_itens, v_emp
  from inseridos;

  -- Reordenar o modelo reflete nas empresas (só etapas raiz).
  update checklist_itens c
  set ordem = m.ordem
  from checklist_modelo m
  where c.modelo_id = m.id
    and c.parent_id is null
    and c.ordem is distinct from m.ordem;

  return query select v_emp, v_itens;
end $$;

grant execute on function aplicar_checklist_modelo() to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. SLA DE COLUNA — quando o card entrou na coluna atual
-- ----------------------------------------------------------------------------

alter table empresa_plataforma add column if not exists coluna_desde timestamptz;
update empresa_plataforma set coluna_desde = created_at where coluna_desde is null;
alter table empresa_plataforma alter column coluna_desde set default now();
alter table empresa_plataforma alter column coluna_desde set not null;

-- Config: dias máximos por coluna. plataforma_id null = regra global.
create table if not exists sla_colunas (
  id            uuid primary key default gen_random_uuid(),
  plataforma_id uuid references plataformas(id) on delete cascade,
  coluna        text not null,
  max_dias      int not null check (max_dias > 0),
  created_at    timestamptz not null default now()
);

-- unique(plataforma_id, coluna) não deduplica NULLs; o coalesce resolve.
create unique index if not exists uq_sla_plat_coluna
  on sla_colunas (coalesce(plataforma_id, '00000000-0000-0000-0000-000000000000'::uuid), coluna);

alter table sla_colunas enable row level security;
drop policy if exists "sla acesso total" on sla_colunas;
create policy "sla acesso total" on sla_colunas
  for all using (true) with check (true);


-- ----------------------------------------------------------------------------
-- 4. DOCUMENTAÇÕES — globais (da nossa empresa, não das credenciadas)
-- ----------------------------------------------------------------------------

create table if not exists documentos (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  categoria  text,
  conteudo   text,
  url        text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table documentos enable row level security;
drop policy if exists "documentos acesso total" on documentos;
create policy "documentos acesso total" on documentos
  for all using (true) with check (true);


-- ----------------------------------------------------------------------------
-- 5. ACESSOS — credenciais globais da nossa empresa (Google Cloud etc.)
--    Texto simples por decisão: o login protege a interface, não os dados,
--    mesmo padrão da tabela credenciais.
-- ----------------------------------------------------------------------------

create table if not exists acessos (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  categoria  text,
  url        text,
  usuario    text,
  senha      text,
  notas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table acessos enable row level security;
drop policy if exists "acessos acesso total" on acessos;
create policy "acessos acesso total" on acessos
  for all using (true) with check (true);


-- ----------------------------------------------------------------------------
-- 6. Realtime
-- ----------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table sla_colunas;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table documentos;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table acessos;
exception when duplicate_object then null;
end $$;


-- ----------------------------------------------------------------------------
-- Conferência
-- ----------------------------------------------------------------------------

select
  (select count(*) from checklist_itens)                                              as tarefas,
  (select count(*) from checklist_itens where parent_id is not null)                  as subtarefas,
  (select count(*) from checklist_itens where modelo_id is null and parent_id is null) as raizes_manuais,
  (select count(*) from empresa_plataforma where coluna_desde is null)                as ep_sem_coluna_desde,
  (select count(*) from sla_colunas)                                                  as regras_sla,
  (select count(*) from documentos)                                                   as documentos,
  (select count(*) from acessos)                                                      as acessos;
