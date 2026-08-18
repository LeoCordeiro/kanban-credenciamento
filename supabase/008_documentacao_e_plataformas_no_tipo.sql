-- ============================================================================
-- Kanban Credenciamento — migração v8
-- Tipo de tarefa ganha duas ligações:
--   1. documentações (o material de consulta aparece dentro da tarefa)
--   2. plataformas   (a tarefa só nasce para empresa nos quadros escolhidos)
--
-- Rodar inteiro no SQL Editor do Supabase. É idempotente: pode rodar de novo.
-- DEPENDE da migração 007.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DOCUMENTAÇÃO VINCULADA AO TIPO (N:N)
--    Uma tarefa pode apontar para várias documentações e a mesma documentação
--    serve várias tarefas — por isso tabela de ligação, não coluna.
-- ----------------------------------------------------------------------------

create table if not exists checklist_modelo_documento (
  modelo_id    uuid not null references checklist_modelo(id) on delete cascade,
  documento_id uuid not null references documentos(id)       on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (modelo_id, documento_id)
);

create index if not exists idx_cmd_documento on checklist_modelo_documento(documento_id);

alter table checklist_modelo_documento enable row level security;
drop policy if exists "cmd acesso total" on checklist_modelo_documento;
create policy "cmd acesso total" on checklist_modelo_documento
  for all using (true) with check (true);


-- ----------------------------------------------------------------------------
-- 2. RESTRIÇÃO POR PLATAFORMA (N:N)
--    Ausência de linha = tarefa vale para toda empresa, como sempre foi.
--    Com linha(s) = só nasce para empresa vinculada àquela(s) plataforma(s).
-- ----------------------------------------------------------------------------

create table if not exists checklist_modelo_plataforma (
  modelo_id     uuid not null references checklist_modelo(id) on delete cascade,
  plataforma_id uuid not null references plataformas(id)      on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (modelo_id, plataforma_id)
);

create index if not exists idx_cmp_plataforma on checklist_modelo_plataforma(plataforma_id);

alter table checklist_modelo_plataforma enable row level security;
drop policy if exists "cmp acesso total" on checklist_modelo_plataforma;
create policy "cmp acesso total" on checklist_modelo_plataforma
  for all using (true) with check (true);


-- ----------------------------------------------------------------------------
-- 3. EMPRESA NOVA: só as tarefas sem restrição
--    Tarefa restrita depende de saber em qual plataforma a empresa entrou, e
--    isso só existe quando o vínculo empresa↔plataforma é criado (passo 4).
-- ----------------------------------------------------------------------------

create or replace function trg_criar_checklist_padrao()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into checklist_itens (empresa_id, titulo, ordem, modelo_id, prioridade, sla_horas, prazo)
  select
    new.id, m.titulo, m.ordem, m.id, m.prioridade, m.sla_horas,
    case when m.sla_horas is not null then (now() + make_interval(hours => m.sla_horas)) end
  from checklist_modelo m
  where not exists (select 1 from checklist_modelo_plataforma p where p.modelo_id = m.id);
  return new;
end $$;


-- ----------------------------------------------------------------------------
-- 4. EMPRESA ENTROU NUMA PLATAFORMA: cria as tarefas daquele quadro
--    O prazo conta a partir da entrada na plataforma, que é quando o trabalho
--    daquele quadro realmente começa.
-- ----------------------------------------------------------------------------

create or replace function trg_tarefas_da_plataforma()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into checklist_itens (empresa_id, titulo, ordem, modelo_id, prioridade, sla_horas, prazo)
  select
    new.empresa_id, m.titulo, m.ordem, m.id, m.prioridade, m.sla_horas,
    case when m.sla_horas is not null then (now() + make_interval(hours => m.sla_horas)) end
  from checklist_modelo m
  join checklist_modelo_plataforma p on p.modelo_id = m.id
  where p.plataforma_id = new.plataforma_id
    and not exists (
      select 1 from checklist_itens c
      where c.empresa_id = new.empresa_id and c.modelo_id = m.id
    );
  return new;
end $$;

drop trigger if exists criar_tarefas_da_plataforma on empresa_plataforma;
create trigger criar_tarefas_da_plataforma
  after insert on empresa_plataforma
  for each row execute function trg_tarefas_da_plataforma();

-- Sair da plataforma NÃO apaga tarefa: o trabalho já feito (e o histórico de
-- quem fez) vale mais que a limpeza. Remoção continua sendo manual na ficha.


-- ----------------------------------------------------------------------------
-- 5. APLICAR MODELO respeitando a restrição
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
    insert into checklist_itens (empresa_id, titulo, ordem, modelo_id, prioridade, sla_horas, prazo)
    select
      e.id, m.titulo, m.ordem, m.id, m.prioridade, m.sla_horas,
      case when m.sla_horas is not null then (now() + make_interval(hours => m.sla_horas)) end
    from empresas e
    cross join checklist_modelo m
    where
      -- sem restrição: vale para todas; com restrição: só onde a empresa está
      (
        not exists (select 1 from checklist_modelo_plataforma p where p.modelo_id = m.id)
        or exists (
          select 1
          from checklist_modelo_plataforma p
          join empresa_plataforma ep
            on ep.plataforma_id = p.plataforma_id and ep.empresa_id = e.id
          where p.modelo_id = m.id
        )
      )
      and not exists (
        select 1 from checklist_itens c
        where c.empresa_id = e.id
          and (c.modelo_id = m.id or (c.modelo_id is null and c.titulo = m.titulo))
      )
    returning empresa_id
  )
  select count(*)::int, count(distinct empresa_id)::int
  into v_itens, v_emp
  from inseridos;

  update checklist_itens c
  set ordem = m.ordem
  from checklist_modelo m
  where c.modelo_id = m.id
    and c.parent_id is null
    and c.ordem is distinct from m.ordem;

  update checklist_itens c
  set sla_horas = m.sla_horas,
      prazo     = coalesce(c.prazo, now() + make_interval(hours => m.sla_horas))
  from checklist_modelo m
  where c.modelo_id = m.id
    and not c.concluido
    and m.sla_horas is not null
    and (c.prazo is null or c.sla_horas is distinct from m.sla_horas);

  return query select v_emp, v_itens;
end $$;

grant execute on function aplicar_checklist_modelo() to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 6. Realtime
-- ----------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table checklist_modelo_documento;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table checklist_modelo_plataforma;
exception when duplicate_object then null;
end $$;


-- ----------------------------------------------------------------------------
-- Conferência
-- ----------------------------------------------------------------------------

select
  (select count(*) from checklist_modelo)                                          as tipos,
  (select count(distinct modelo_id) from checklist_modelo_plataforma)              as tipos_restritos,
  (select count(distinct modelo_id) from checklist_modelo_documento)               as tipos_com_documentacao,
  (select count(*) from documentos)                                                as documentos,
  (select count(*) from checklist_itens)                                           as tarefas;
