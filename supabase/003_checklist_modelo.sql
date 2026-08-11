-- ============================================================================
-- Kanban Credenciamento — migração v3
-- Checklist padrão deixa de ser lista fixa no código e vira tabela editável.
--
-- Rodar inteiro no SQL Editor do Supabase. É idempotente: pode rodar de novo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MODELO
-- ----------------------------------------------------------------------------

create table if not exists checklist_modelo (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null unique,
  ordem      int not null default 0,
  created_at timestamptz not null default now()
);

alter table checklist_modelo enable row level security;

drop policy if exists "modelo acesso total" on checklist_modelo;
create policy "modelo acesso total" on checklist_modelo
  for all using (true) with check (true);

-- Semeia com a lista que estava fixa na trigger da migração 002
insert into checklist_modelo (titulo, ordem)
select t.titulo, (t.ord - 1)::int
from unnest(array[
  'Criar Negócio', 'Criar Logo', 'Criar Domínio', 'Criar E-mail',
  'Criar Instagram', 'Criar Site', 'Criar Reclame Aqui'
]) with ordinality as t(titulo, ord)
on conflict (titulo) do nothing;


-- ----------------------------------------------------------------------------
-- 2. TRIGGER passa a ler do modelo
-- ----------------------------------------------------------------------------

create or replace function trg_criar_checklist_padrao()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into checklist_itens (empresa_id, titulo, ordem)
  select new.id, m.titulo, m.ordem from checklist_modelo m;
  return new;
end $$;

-- (a trigger em si já foi criada na 002 e continua válida)


-- ----------------------------------------------------------------------------
-- 3. APLICAR O MODELO A TODAS AS EMPRESAS
-- Aditivo de propósito: insere o que falta e alinha a ordem, mas NUNCA apaga
-- item existente — apagar destruiria progresso já marcado sem volta. Item que
-- saiu do modelo continua onde está e é removido à mão na ficha da empresa.
-- ----------------------------------------------------------------------------

create or replace function aplicar_checklist_modelo()
returns table (empresas_afetadas int, itens_inseridos int)
language plpgsql security definer set search_path = public
as $$
declare
  v_itens int := 0;
  v_emp   int := 0;
begin
  with inseridos as (
    insert into checklist_itens (empresa_id, titulo, ordem)
    select e.id, m.titulo, m.ordem
    from empresas e
    cross join checklist_modelo m
    where not exists (
      select 1 from checklist_itens c
      where c.empresa_id = e.id and c.titulo = m.titulo
    )
    returning empresa_id
  )
  select count(*)::int, count(distinct empresa_id)::int
  into v_itens, v_emp
  from inseridos;

  -- Reordenar o modelo tem que refletir nas empresas, senão a ordem nova só
  -- valeria para empresa criada depois.
  update checklist_itens c
  set ordem = m.ordem
  from checklist_modelo m
  where c.titulo = m.titulo and c.ordem is distinct from m.ordem;

  return query select v_emp, v_itens;
end $$;

grant execute on function aplicar_checklist_modelo() to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4. Realtime
-- ----------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table checklist_modelo;
exception when duplicate_object then null;
end $$;


-- ----------------------------------------------------------------------------
-- Conferência
-- ----------------------------------------------------------------------------

select
  (select count(*) from checklist_modelo) as itens_no_modelo,
  (select count(*) from checklist_itens)  as itens_nas_empresas,
  (select count(*) from empresas)         as empresas;
