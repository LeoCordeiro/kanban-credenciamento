-- ============================================================================
-- Kanban Credenciamento — migração v4
-- Instagram e Reclame Aqui na ficha de contato da empresa.
-- Fecham o par com os itens "Criar Instagram" e "Criar Reclame Aqui" do
-- checklist: o item diz que foi feito, o campo guarda onde ficou.
--
-- Rodar no SQL Editor do Supabase. É idempotente.
-- ============================================================================

alter table empresas add column if not exists instagram    text;
alter table empresas add column if not exists reclame_aqui text;


-- Conferência
select
  count(*) filter (where instagram is not null)    as com_instagram,
  count(*) filter (where reclame_aqui is not null) as com_reclame_aqui,
  count(*)                                         as total_empresas
from empresas;
