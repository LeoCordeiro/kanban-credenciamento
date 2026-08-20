-- ============================================================================
-- Kanban Credenciamento — migração v12
--
-- 1. RESPONSÁVEL NO TIPO. Hoje só dava para escolher responsável tarefa a
--    tarefa, dentro de cada empresa. Definindo no tipo, toda empresa nova já
--    nasce com a tarefa no nome de quem faz.
--
-- 2. CREDENCIAL VINCULADA À TAREFA. A credencial é da empresa (o painel da
--    Hospedaqui daquela empresa, não um acesso global), então o vínculo é
--    tarefa-da-empresa ↔ credencial-da-empresa. Quem abre "Criar E-mail" vê
--    ali qual login usar, sem procurar na seção Credenciais.
--
-- Rodar inteiro no SQL Editor. É idempotente.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. RESPONSÁVEL NO TIPO
-- ----------------------------------------------------------------------------

alter table checklist_modelo add column if not exists responsavel text;

-- Semear passa a copiar o responsável do tipo. Mantém tudo que a 011 corrigiu:
-- adota legado de verdade em vez de só bloquear a inserção.
create or replace function semear_tarefas_da_empresa(p_empresa uuid, p_plataforma uuid default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_inseridos int := 0;
begin
  -- Item legado (nasceu antes de existir modelo_id) que tem o nome de um tipo
  -- passa a pertencer a esse tipo, preservando o que já estava marcado.
  update checklist_itens c
  set modelo_id = m.id
  from checklist_modelo m
  where c.empresa_id = p_empresa
    and c.modelo_id is null
    and lower(btrim(c.titulo)) = lower(btrim(m.titulo))
    and (select count(*) from checklist_modelo m2
          where lower(btrim(m2.titulo)) = lower(btrim(m.titulo))) = 1
    and not exists (
      select 1 from checklist_itens x
      where x.empresa_id = c.empresa_id and x.modelo_id = m.id
    );

  insert into checklist_itens (empresa_id, titulo, ordem, modelo_id, prioridade, sla_horas, prazo, responsavel)
  select
    p_empresa, m.titulo, m.ordem, m.id, m.prioridade, m.sla_horas,
    case when m.sla_horas is not null then (now() + make_interval(hours => m.sla_horas)) end,
    m.responsavel
  from checklist_modelo m
  where
    case
      when p_plataforma is null then
        not exists (select 1 from checklist_modelo_plataforma p where p.modelo_id = coalesce(m.parent_id, m.id))
      else
        exists (select 1 from checklist_modelo_plataforma p
                 where p.modelo_id = coalesce(m.parent_id, m.id) and p.plataforma_id = p_plataforma)
    end
    and not exists (
      select 1 from checklist_itens c
      where c.empresa_id = p_empresa and c.modelo_id = m.id
    );

  get diagnostics v_inseridos = row_count;

  update checklist_itens c
  set parent_id = pai.id
  from checklist_modelo m
  join checklist_itens pai on pai.modelo_id = m.parent_id and pai.empresa_id = p_empresa
  where c.empresa_id = p_empresa
    and c.modelo_id = m.id
    and m.parent_id is not null
    and c.parent_id is distinct from pai.id;

  update checklist_itens c
  set parent_id = null
  from checklist_modelo m
  where c.empresa_id = p_empresa
    and c.modelo_id = m.id
    and m.parent_id is null
    and c.parent_id is not null;

  return v_inseridos;
end $$;

grant execute on function semear_tarefas_da_empresa(uuid, uuid) to anon, authenticated;

-- Aplicar passa a preencher o responsável de quem ainda não tem. Só preenche
-- vazio: quem já foi atribuído a alguém na empresa continua com essa pessoa —
-- trocar o dono do tipo não deve reatribuir tarefa que já está em curso.
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

  update checklist_itens c
  set titulo = m.titulo
  from checklist_modelo m
  where c.modelo_id = m.id and c.titulo is distinct from m.titulo;

  update checklist_itens c
  set responsavel = m.responsavel
  from checklist_modelo m
  where c.modelo_id = m.id
    and c.responsavel is null
    and m.responsavel is not null;

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
-- 2. CREDENCIAL VINCULADA À TAREFA
-- Vínculo entre duas coisas da MESMA empresa. O `on delete cascade` dos dois
-- lados evita vínculo apontando para credencial ou tarefa que já morreu.
-- ----------------------------------------------------------------------------

create table if not exists checklist_item_credencial (
  item_id       uuid not null references checklist_itens(id) on delete cascade,
  credencial_id uuid not null references credenciais(id)     on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (item_id, credencial_id)
);

create index if not exists idx_item_credencial_item on checklist_item_credencial(item_id);

alter table checklist_item_credencial enable row level security;

drop policy if exists "item credencial acesso total" on checklist_item_credencial;
create policy "item credencial acesso total" on checklist_item_credencial
  for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table checklist_item_credencial;
exception when duplicate_object then null;
end $$;


-- ----------------------------------------------------------------------------
-- Conferência
-- ----------------------------------------------------------------------------

select
  (select count(*) from checklist_modelo where responsavel is not null) as tipos_com_responsavel,
  (select count(*) from checklist_itens where responsavel is not null)  as tarefas_com_responsavel,
  (select count(*) from checklist_item_credencial)                      as vinculos_credencial;
