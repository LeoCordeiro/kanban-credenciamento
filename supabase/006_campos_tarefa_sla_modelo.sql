-- ============================================================================
-- Kanban Credenciamento — migração v6
-- Campos próprios da tarefa (descrição, prioridade, status) e SLA por tipo de
-- tarefa definido no cadastro do modelo — prazo passa a nascer calculado.
--
-- Rodar inteiro no SQL Editor do Supabase. É idempotente: pode rodar de novo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CAMPOS DA TAREFA
--    status é o estado detalhado; `concluido` continua existindo porque board,
--    badges e /atrasos leem dele — os dois ficam sincronizados por trigger.
-- ----------------------------------------------------------------------------

alter table checklist_itens add column if not exists descricao  text;
alter table checklist_itens add column if not exists prioridade text not null default 'media';
alter table checklist_itens add column if not exists status     text not null default 'a_fazer';
alter table checklist_itens add column if not exists sla_dias   int;

do $$
begin
  alter table checklist_itens add constraint chk_prioridade
    check (prioridade in ('baixa', 'media', 'alta', 'urgente'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table checklist_itens add constraint chk_status
    check (status in ('a_fazer', 'fazendo', 'bloqueado', 'concluido'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_checklist_status on checklist_itens(status);

-- Backfill: quem já estava feito nasce como 'concluido'.
update checklist_itens set status = 'concluido' where concluido and status <> 'concluido';
update checklist_itens set status = 'a_fazer'   where not concluido and status = 'concluido';


-- ----------------------------------------------------------------------------
-- 2. SINCRONIA status <-> concluido
--    Sem isso, marcar o checkbox (que escreve `concluido`) e mudar o status
--    pelo modal levariam a estados contraditórios. A regra fica no banco para
--    valer também na cascata do pai, que faz um update em massa.
-- ----------------------------------------------------------------------------

create or replace function trg_sync_status_concluido()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if new.concluido and new.status <> 'concluido' then
      new.status := 'concluido';
    elsif new.status = 'concluido' then
      new.concluido := true;
    end if;
    return new;
  end if;

  -- Quem mudou manda: status explícito vence; senão o checkbox ajusta o status.
  if new.status is distinct from old.status then
    new.concluido := (new.status = 'concluido');
  elsif new.concluido is distinct from old.concluido then
    new.status := case
      when new.concluido then 'concluido'
      when old.status = 'concluido' then 'a_fazer'
      else old.status
    end;
  end if;
  return new;
end $$;

drop trigger if exists sync_status_concluido on checklist_itens;
create trigger sync_status_concluido
  before insert or update on checklist_itens
  for each row execute function trg_sync_status_concluido();


-- ----------------------------------------------------------------------------
-- 3. SLA POR TIPO DE TAREFA — no cadastro do modelo
--    sla_dias no modelo vira prazo real (data de criação + N dias) em toda
--    tarefa nova. Descrição e prioridade padrão vêm junto.
-- ----------------------------------------------------------------------------

alter table checklist_modelo add column if not exists sla_dias   int;
alter table checklist_modelo add column if not exists descricao  text;
alter table checklist_modelo add column if not exists prioridade text not null default 'media';

do $$
begin
  alter table checklist_modelo add constraint chk_modelo_sla
    check (sla_dias is null or sla_dias > 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table checklist_modelo add constraint chk_modelo_prioridade
    check (prioridade in ('baixa', 'media', 'alta', 'urgente'));
exception when duplicate_object then null;
end $$;


-- ----------------------------------------------------------------------------
-- 4. TRIGGER DE EMPRESA NOVA passa a semear prazo, prioridade e descrição
-- ----------------------------------------------------------------------------

create or replace function trg_criar_checklist_padrao()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into checklist_itens (empresa_id, titulo, ordem, modelo_id, descricao, prioridade, sla_dias, prazo)
  select
    new.id, m.titulo, m.ordem, m.id, m.descricao, m.prioridade, m.sla_dias,
    case when m.sla_dias is not null then (current_date + m.sla_dias) end
  from checklist_modelo m;
  return new;
end $$;


-- ----------------------------------------------------------------------------
-- 5. APLICAR MODELO: insere o que falta e completa o que está vazio
--    Aditivo como sempre — nunca sobrescreve prazo/prioridade já preenchidos à
--    mão, nem mexe em tarefa concluída.
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
    insert into checklist_itens (empresa_id, titulo, ordem, modelo_id, descricao, prioridade, sla_dias, prazo)
    select
      e.id, m.titulo, m.ordem, m.id, m.descricao, m.prioridade, m.sla_dias,
      case when m.sla_dias is not null then (current_date + m.sla_dias) end
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

  -- SLA do modelo preenche prazo que ainda está vazio em tarefa pendente.
  update checklist_itens c
  set sla_dias = m.sla_dias,
      prazo    = coalesce(c.prazo, current_date + m.sla_dias)
  from checklist_modelo m
  where c.modelo_id = m.id
    and not c.concluido
    and m.sla_dias is not null
    and (c.prazo is null or c.sla_dias is distinct from m.sla_dias);

  return query select v_emp, v_itens;
end $$;

grant execute on function aplicar_checklist_modelo() to anon, authenticated;


-- ----------------------------------------------------------------------------
-- Conferência
-- ----------------------------------------------------------------------------

select
  (select count(*) from checklist_itens)                                   as tarefas,
  (select count(*) from checklist_itens where status = 'concluido')        as concluidas,
  (select count(*) from checklist_itens where concluido <> (status = 'concluido')) as fora_de_sincronia,
  (select count(*) from checklist_itens where prazo is not null)           as com_prazo,
  (select count(*) from checklist_modelo where sla_dias is not null)       as tipos_com_sla;
