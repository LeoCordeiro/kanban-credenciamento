-- ============================================================================
-- Kanban Credenciamento — migração v9
-- Concluir todas as subtarefas conclui a tarefa-mãe NO BANCO, não só na tela.
--
-- Até aqui o estado da mãe era derivado no client (estadoEfetivo): a tela
-- mostrava certo, mas quem lesse a tabela direto — /atrasos, relatório, futura
-- automação — via a mãe pendente com todas as filhas prontas.
--
-- Rodar inteiro no SQL Editor do Supabase. É idempotente: pode rodar de novo.
-- ============================================================================

create or replace function trg_concluir_tarefa_mae()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_pai        uuid;
  v_todas_ok   boolean;
  v_pai_agora  boolean;
begin
  -- Vale tanto para quem mudou de estado quanto para subtarefa criada/removida:
  -- filha nova pendente reabre a mãe.
  v_pai := coalesce(new.parent_id, old.parent_id);
  if v_pai is null then
    return coalesce(new, old);
  end if;

  select bool_and(concluido) into v_todas_ok
  from checklist_itens where parent_id = v_pai;

  -- Sem filhas restantes o bool_and devolve null; aí a mãe volta a ser folha
  -- e o estado dela é problema de quem marcar o checkbox.
  if v_todas_ok is null then
    return coalesce(new, old);
  end if;

  select concluido into v_pai_agora from checklist_itens where id = v_pai;

  if v_pai_agora is distinct from v_todas_ok then
    update checklist_itens
    set concluido     = v_todas_ok,
        concluido_em  = case when v_todas_ok then now() else null end,
        concluido_por = case when v_todas_ok then coalesce(new.concluido_por, 'sistema') else null end
    where id = v_pai;
    -- O update acima dispara esta mesma trigger para a mãe, subindo a árvore
    -- até a raiz. Termina porque só escreve quando o valor muda de fato.
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists concluir_tarefa_mae on checklist_itens;
create trigger concluir_tarefa_mae
  after insert or update of concluido or delete on checklist_itens
  for each row execute function trg_concluir_tarefa_mae();


-- Alinha o que já existe: mãe com todas as filhas prontas passa a constar
-- concluída; mãe com alguma filha pendente volta a constar pendente.
with folhas as (
  select parent_id, bool_and(concluido) as todas_ok
  from checklist_itens
  where parent_id is not null
  group by parent_id
)
update checklist_itens c
set concluido     = f.todas_ok,
    concluido_em  = case when f.todas_ok then coalesce(c.concluido_em, now()) else null end,
    concluido_por = case when f.todas_ok then coalesce(c.concluido_por, 'sistema') else null end
from folhas f
where c.id = f.parent_id
  and c.concluido is distinct from f.todas_ok;


-- ----------------------------------------------------------------------------
-- Conferência: quantas mães estão fora de sincronia com as filhas (deve dar 0)
-- ----------------------------------------------------------------------------

select
  (select count(*) from checklist_itens where parent_id is not null)                 as subtarefas,
  (select count(*)
     from checklist_itens c
     join (select parent_id, bool_and(concluido) as ok
             from checklist_itens where parent_id is not null group by parent_id) f
       on f.parent_id = c.id
    where c.concluido is distinct from f.ok)                                         as maes_fora_de_sincronia;
