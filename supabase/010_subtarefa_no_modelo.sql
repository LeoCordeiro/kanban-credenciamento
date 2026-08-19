-- ============================================================================
-- Kanban Credenciamento — migração v10
-- O MODELO de tarefas passa a ter hierarquia: tipo de tarefa e tipo de
-- subtarefa. Antes a subtarefa era criada à mão em cada empresa; agora nasce
-- junto, com os mesmos campos (instruções, SLA em horas, prioridade).
--
-- Rodar inteiro no SQL Editor do Supabase. É idempotente: pode rodar de novo.
-- DEPENDE das migrações 007 e 008.
-- ============================================================================

alter table checklist_modelo add column if not exists parent_id uuid references checklist_modelo(id) on delete cascade;
create index if not exists idx_modelo_parent on checklist_modelo(parent_id);

-- O título era unique global; com subtarefas o mesmo nome pode existir sob
-- pais diferentes ("Conferir dados" em duas tarefas distintas).
alter table checklist_modelo drop constraint if exists checklist_modelo_titulo_key;
create unique index if not exists uq_modelo_titulo_por_pai
  on checklist_modelo (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), titulo);


-- ----------------------------------------------------------------------------
-- Semear a árvore numa empresa
--   1. insere todos os tipos do escopo (pais e filhos), sem ligação
--   2. religa os filhos ao pai correspondente DAQUELA empresa
-- Ligar na mesma passada não dá: o id do pai só existe depois do insert.
-- ----------------------------------------------------------------------------

create or replace function semear_tarefas_da_empresa(p_empresa uuid, p_plataforma uuid default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_inseridos int := 0;
begin
  insert into checklist_itens (empresa_id, titulo, ordem, modelo_id, prioridade, sla_horas, prazo)
  select
    p_empresa, m.titulo, m.ordem, m.id, m.prioridade, m.sla_horas,
    case when m.sla_horas is not null then (now() + make_interval(hours => m.sla_horas)) end
  from checklist_modelo m
  where
    -- Escopo de plataforma vale pela raiz: subtarefa acompanha a tarefa dela.
    case
      when p_plataforma is null then
        not exists (select 1 from checklist_modelo_plataforma p where p.modelo_id = coalesce(m.parent_id, m.id))
      else
        exists (select 1 from checklist_modelo_plataforma p
                 where p.modelo_id = coalesce(m.parent_id, m.id) and p.plataforma_id = p_plataforma)
    end
    and not exists (
      select 1 from checklist_itens c
      where c.empresa_id = p_empresa
        and (c.modelo_id = m.id or (c.modelo_id is null and c.parent_id is null and c.titulo = m.titulo))
    );

  get diagnostics v_inseridos = row_count;

  -- Religa filhos ao pai desta empresa (idempotente: só onde ainda está solto).
  update checklist_itens c
  set parent_id = pai.id
  from checklist_modelo m
  join checklist_itens pai on pai.modelo_id = m.parent_id and pai.empresa_id = p_empresa
  where c.empresa_id = p_empresa
    and c.modelo_id = m.id
    and m.parent_id is not null
    and c.parent_id is distinct from pai.id;

  return v_inseridos;
end $$;

grant execute on function semear_tarefas_da_empresa(uuid, uuid) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- Gatilhos passam a usar a função acima
-- ----------------------------------------------------------------------------

create or replace function trg_criar_checklist_padrao()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform semear_tarefas_da_empresa(new.id, null);
  return new;
end $$;

create or replace function trg_tarefas_da_plataforma()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform semear_tarefas_da_empresa(new.empresa_id, new.plataforma_id);
  return new;
end $$;

drop trigger if exists criar_tarefas_da_plataforma on empresa_plataforma;
create trigger criar_tarefas_da_plataforma
  after insert on empresa_plataforma
  for each row execute function trg_tarefas_da_plataforma();


-- ----------------------------------------------------------------------------
-- Aplicar o modelo às empresas existentes, agora com a árvore
-- ----------------------------------------------------------------------------

create or replace function aplicar_checklist_modelo()
returns table (empresas_afetadas int, itens_inseridos int)
language plpgsql security definer set search_path = public
as $$
declare
  v_emp   int := 0;
  v_itens int := 0;
  v_antes int;
  r       record;
  p       record;
begin
  for r in select id from empresas loop
    v_antes := v_itens;
    v_itens := v_itens + semear_tarefas_da_empresa(r.id, null);
    for p in select plataforma_id from empresa_plataforma where empresa_id = r.id loop
      v_itens := v_itens + semear_tarefas_da_empresa(r.id, p.plataforma_id);
    end loop;
    if v_itens > v_antes then v_emp := v_emp + 1; end if;
  end loop;

  -- Ordem e SLA continuam acompanhando o modelo.
  update checklist_itens c
  set ordem = m.ordem
  from checklist_modelo m
  where c.modelo_id = m.id and c.ordem is distinct from m.ordem;

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
-- Conferência
-- ----------------------------------------------------------------------------

select
  (select count(*) from checklist_modelo where parent_id is null)     as tipos_de_tarefa,
  (select count(*) from checklist_modelo where parent_id is not null) as tipos_de_subtarefa,
  (select count(*) from checklist_itens where parent_id is not null)  as subtarefas_nas_empresas;
