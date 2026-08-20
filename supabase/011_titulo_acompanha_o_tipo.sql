-- ============================================================================
-- Kanban Credenciamento — migração v11
--
-- Dois defeitos achados depois de "Aplicar a todas as empresas" (18/08/2026):
--
-- 1. RENOMEAR O TIPO NÃO CHEGAVA NAS EMPRESAS. `aplicar_checklist_modelo`
--    sincronizava ordem e SLA, mas não o título. Renomear "Criar Instagram"
--    para "Cadastro Inicicial Pagarme" deixou 27 empresas exibindo um nome sem
--    relação com o que a tarefa virou. 189 itens (7 tipos × 27) com nome
--    congelado.
--
-- 2. ITEM LEGADO BLOQUEAVA A SUBTAREFA CERTA. O `semear` tratava item sem
--    modelo_id e de mesmo título como "já existe" e pulava a inserção — mas não
--    o adotava: seguia sem modelo_id e na raiz. Resultado: "Criar Logo", que no
--    modelo é subtarefa de "Criação do Negócio", não existia em NENHUMA das 27
--    empresas, enquanto o "Criar Logo" antigo continuava solto.
--
-- Decisão do Leonardo: o título é do TIPO. Renomear em /tarefas renomeia em
-- todas as empresas.
--
-- Rodar inteiro no SQL Editor. É idempotente.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. SEMEAR — adota o legado em vez de só se calar
-- ----------------------------------------------------------------------------

create or replace function semear_tarefas_da_empresa(p_empresa uuid, p_plataforma uuid default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_inseridos int := 0;
begin
  -- Item legado (nasceu antes de existir modelo_id) que tem o nome de um tipo
  -- passa a pertencer a esse tipo. Antes ele só bloqueava a inserção do item
  -- correto e ficava órfão para sempre — sem ordem, sem hierarquia, sem nome
  -- sincronizado. Adotar preserva o que já estava marcado como feito.
  update checklist_itens c
  set modelo_id = m.id
  from checklist_modelo m
  where c.empresa_id = p_empresa
    and c.modelo_id is null
    and lower(btrim(c.titulo)) = lower(btrim(m.titulo))
    -- Só quando o nome identifica UM tipo: desde que subtarefa existe, o título
    -- é único por pai e não mais global. Adotar por nome ambíguo ligaria a
    -- tarefa ao tipo errado, que é pior do que deixá-la órfã.
    and (select count(*) from checklist_modelo m2
          where lower(btrim(m2.titulo)) = lower(btrim(m.titulo))) = 1
    -- E só se a empresa ainda não tiver o item legítimo desse tipo, senão a
    -- adoção deixaria dois itens apontando para o mesmo modelo.
    and not exists (
      select 1 from checklist_itens x
      where x.empresa_id = c.empresa_id and x.modelo_id = m.id
    );

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
    -- Agora só por modelo_id: quem tinha o mesmo título já foi adotado acima.
    and not exists (
      select 1 from checklist_itens c
      where c.empresa_id = p_empresa and c.modelo_id = m.id
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

  -- Tipo que voltou a ser raiz no modelo solta o filho na empresa também.
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


-- ----------------------------------------------------------------------------
-- 2. APLICAR — título passa a acompanhar o tipo
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

  -- O nome da tarefa é do processo, não da empresa: renomear o tipo renomeia em
  -- todas. (Decisão de 18/08 — editar o título na ficha da empresa vale até o
  -- próximo "Aplicar".)
  update checklist_itens c
  set titulo = m.titulo
  from checklist_modelo m
  where c.modelo_id = m.id and c.titulo is distinct from m.titulo;

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
-- 3. CORRIGIR O QUE JÁ ESTÁ NO BANCO
-- ----------------------------------------------------------------------------

-- 3a. "Criar Reclame Aqui": o tipo saiu do modelo e o Leonardo pediu para
--     removê-lo das empresas (18/08). Leva junto 3 marcações de concluído;
--     nenhum deles tem observação escrita nem prazo. Só apaga item órfão, sem
--     filhos e com esse título exato.
delete from checklist_itens c
where c.modelo_id is null
  and btrim(c.titulo) = 'Criar Reclame Aqui'
  and not exists (select 1 from checklist_itens f where f.parent_id = c.id);

-- 3b. Adota legados, insere o que falta, religa a hierarquia e sincroniza
--     título/ordem/SLA em todas as empresas de uma vez.
select * from aplicar_checklist_modelo();


-- ----------------------------------------------------------------------------
-- Conferência — esperado depois de rodar:
--   orfaos = 0 · titulos_divergentes = 0 · empresas_sem_criar_logo = 0
-- ----------------------------------------------------------------------------

select
  (select count(*) from checklist_itens where modelo_id is null) as orfaos,
  (select count(*) from checklist_itens c
     join checklist_modelo m on m.id = c.modelo_id
    where c.titulo is distinct from m.titulo)                    as titulos_divergentes,
  (select count(*) from empresas e where not exists (
      select 1 from checklist_itens c
        join checklist_modelo m on m.id = c.modelo_id
       where c.empresa_id = e.id
         and m.parent_id is not null
         and m.titulo = 'Criar Logo'))                           as empresas_sem_criar_logo,
  (select count(*) from checklist_itens)                         as total_itens;
