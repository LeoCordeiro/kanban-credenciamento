-- ============================================================================
-- Kanban Credenciamento — migração v7
-- SLA passa de dias para HORAS (tarefa e coluna) e as instruções deixam de ser
-- copiadas para cada empresa: passam a morar no tipo de tarefa, num lugar só.
--
-- Rodar inteiro no SQL Editor do Supabase. É idempotente: pode rodar de novo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SLA EM HORAS
--    Renomeia e converte o que já existia (1 dia = 24 horas). Os blocos são
--    guardados por information_schema para a segunda execução não converter
--    de novo e multiplicar tudo por 24.
-- ----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'checklist_modelo' and column_name = 'sla_dias') then
    alter table checklist_modelo rename column sla_dias to sla_horas;
    update checklist_modelo set sla_horas = sla_horas * 24 where sla_horas is not null;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'checklist_itens' and column_name = 'sla_dias') then
    alter table checklist_itens rename column sla_dias to sla_horas;
    update checklist_itens set sla_horas = sla_horas * 24 where sla_horas is not null;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'sla_colunas' and column_name = 'max_dias') then
    alter table sla_colunas rename column max_dias to max_horas;
    update sla_colunas set max_horas = max_horas * 24;
  end if;
end $$;

-- Constraints seguem a coluna no rename, mas com nome enganoso — refaz.
alter table checklist_modelo drop constraint if exists chk_modelo_sla;
do $$
begin
  alter table checklist_modelo add constraint chk_modelo_sla_horas
    check (sla_horas is null or sla_horas > 0);
exception when duplicate_object then null;
end $$;

alter table sla_colunas drop constraint if exists sla_colunas_max_dias_check;
do $$
begin
  alter table sla_colunas add constraint chk_sla_coluna_horas check (max_horas > 0);
exception when duplicate_object then null;
end $$;


-- ----------------------------------------------------------------------------
-- 2. PRAZO VIRA TIMESTAMP
--    SLA de 4 horas não cabe numa coluna `date`. O que já era data vira o fim
--    daquele dia (23:59) para não vencer antes do que valia até agora.
-- ----------------------------------------------------------------------------

do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'checklist_itens' and column_name = 'prazo') = 'date' then
    alter table checklist_itens
      alter column prazo type timestamptz
      using (prazo::timestamp + interval '23 hours 59 minutes');
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 3. INSTRUÇÕES MORAM NO TIPO DE TAREFA
--    Antes a descrição do modelo era COPIADA para cada empresa: corrigir o
--    texto exigia editar empresa por empresa. Agora o tipo guarda as instruções
--    (uma vez, valem para todas) e `checklist_itens.descricao` fica só para
--    observação específica daquela empresa.
-- ----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'checklist_modelo' and column_name = 'descricao')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'checklist_modelo' and column_name = 'instrucoes') then
    alter table checklist_modelo rename column descricao to instrucoes;
  end if;
end $$;

alter table checklist_modelo add column if not exists instrucoes text;


-- ----------------------------------------------------------------------------
-- 4. TRIGGER DE EMPRESA NOVA
--    Não copia mais texto: instrução é lida do tipo. Prazo agora em horas.
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
  from checklist_modelo m;
  return new;
end $$;


-- ----------------------------------------------------------------------------
-- 5. APLICAR MODELO — mesma regra, agora em horas
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

  update checklist_itens c
  set ordem = m.ordem
  from checklist_modelo m
  where c.modelo_id = m.id
    and c.parent_id is null
    and c.ordem is distinct from m.ordem;

  -- SLA do tipo preenche prazo que ainda está vazio em tarefa pendente.
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
  (select count(*) from checklist_modelo where sla_horas is not null)     as tipos_com_sla,
  (select count(*) from checklist_modelo where instrucoes is not null)    as tipos_com_instrucoes,
  (select count(*) from checklist_itens where prazo is not null)          as tarefas_com_prazo,
  (select data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'checklist_itens' and column_name = 'prazo') as tipo_do_prazo,
  (select count(*) from sla_colunas)                                      as regras_sla_coluna;
