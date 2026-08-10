-- ============================================================================
-- Kanban Credenciamento — migração v2
--   1. Ordenação manual das plataformas (abas arrastáveis)
--   2. Usuários + login (leonardo, gabriel, emerson)
--   3. Checklist de tarefas por empresa
--
-- Rodar inteiro no SQL Editor do Supabase. É idempotente: pode rodar de novo.
--
-- Nota: crypt()/gen_salt() vivem no schema `extensions` no Supabase. Em vez de
-- confiar no search_path da sessão, este script só chama essas funções de
-- dentro de funções que declaram `set search_path = public, extensions`.
-- ============================================================================

create extension if not exists pgcrypto;


-- ============================================================================
-- 1. ORDEM DAS PLATAFORMAS
-- ============================================================================

alter table plataformas add column if not exists ordem int;

-- Semeia a ordem atual a partir da data de criação (mantém a ordem de hoje)
with numeradas as (
  select id, (row_number() over (order by created_at)) - 1 as n
  from plataformas
)
update plataformas p
set ordem = numeradas.n
from numeradas
where p.id = numeradas.id and p.ordem is null;

alter table plataformas alter column ordem set default 0;
update plataformas set ordem = 0 where ordem is null;
alter table plataformas alter column ordem set not null;


-- ============================================================================
-- 2. USUÁRIOS
-- A senha nunca é gravada em texto plano: bcrypt via pgcrypto.
-- A tabela fica sem policy de RLS de propósito — a anon key não lê o hash.
-- Todo acesso passa pelas funções SECURITY DEFINER abaixo.
-- ============================================================================

create table if not exists usuarios (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  senha_hash text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table usuarios enable row level security;

-- Valida nome + senha. Retorna nenhuma linha se não bater.
create or replace function login_usuario(p_nome text, p_senha text)
returns table (id uuid, nome text)
language sql security definer set search_path = public, extensions
as $$
  select u.id, u.nome
  from usuarios u
  where lower(u.nome) = lower(trim(p_nome))
    and u.ativo
    and u.senha_hash = crypt(p_senha, u.senha_hash);
$$;

create or replace function listar_usuarios()
returns table (id uuid, nome text, ativo boolean, created_at timestamptz)
language sql security definer set search_path = public, extensions
as $$
  select u.id, u.nome, u.ativo, u.created_at from usuarios u order by u.nome;
$$;

create or replace function criar_usuario(p_nome text, p_senha text)
returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare v_id uuid;
begin
  if length(coalesce(trim(p_nome), '')) = 0 then
    raise exception 'Nome do usuário é obrigatório';
  end if;
  if length(coalesce(p_senha, '')) < 6 then
    raise exception 'A senha precisa ter ao menos 6 caracteres';
  end if;
  insert into usuarios (nome, senha_hash)
  values (lower(trim(p_nome)), crypt(p_senha, gen_salt('bf')))
  returning id into v_id;
  return v_id;
end $$;

create or replace function alterar_senha(p_id uuid, p_senha text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if length(coalesce(p_senha, '')) < 6 then
    raise exception 'A senha precisa ter ao menos 6 caracteres';
  end if;
  update usuarios set senha_hash = crypt(p_senha, gen_salt('bf')) where id = p_id;
end $$;

create or replace function definir_usuario_ativo(p_id uuid, p_ativo boolean)
returns void
language sql security definer set search_path = public, extensions
as $$
  update usuarios set ativo = p_ativo where id = p_id;
$$;

grant execute on function login_usuario(text, text)            to anon, authenticated;
grant execute on function listar_usuarios()                    to anon, authenticated;
grant execute on function criar_usuario(text, text)            to anon, authenticated;
grant execute on function alterar_senha(uuid, text)            to anon, authenticated;
grant execute on function definir_usuario_ativo(uuid, boolean) to anon, authenticated;

-- Os 3 usuários iniciais, senha padrão 40028922.
-- Via criar_usuario() para herdar o search_path correto do pgcrypto.
do $$
declare n text;
begin
  foreach n in array array['leonardo', 'gabriel', 'emerson'] loop
    if not exists (select 1 from usuarios where nome = n) then
      perform criar_usuario(n, '40028922');
    end if;
  end loop;
end $$;


-- ============================================================================
-- 3. CHECKLIST POR EMPRESA
-- O checklist é da empresa (logo, domínio, site... são únicos por empresa),
-- não da plataforma. Ao vincular a empresa a uma nova plataforma, os itens
-- pendentes que aparecem são os mesmos da empresa.
-- ============================================================================

create table if not exists checklist_itens (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  titulo        text not null,
  concluido     boolean not null default false,
  ordem         int not null default 0,
  concluido_em  timestamptz,
  concluido_por text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_checklist_empresa on checklist_itens(empresa_id);

alter table checklist_itens enable row level security;

drop policy if exists "checklist acesso total" on checklist_itens;
create policy "checklist acesso total" on checklist_itens
  for all using (true) with check (true);

-- Toda empresa nova nasce com o checklist pendente
create or replace function trg_criar_checklist_padrao()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into checklist_itens (empresa_id, titulo, ordem)
  select new.id, t.titulo, (t.ord - 1)::int
  from unnest(array[
    'Criar Negócio', 'Criar Logo', 'Criar Domínio', 'Criar E-mail',
    'Criar Instagram', 'Criar Site', 'Criar Reclame Aqui'
  ]) with ordinality as t(titulo, ord);
  return new;
end $$;

drop trigger if exists criar_checklist_padrao on empresas;
create trigger criar_checklist_padrao
  after insert on empresas
  for each row execute function trg_criar_checklist_padrao();

-- Backfill: empresas que já existiam ganham o checklist (sem duplicar)
insert into checklist_itens (empresa_id, titulo, ordem)
select e.id, t.titulo, (t.ord - 1)::int
from empresas e
cross join unnest(array[
  'Criar Negócio', 'Criar Logo', 'Criar Domínio', 'Criar E-mail',
  'Criar Instagram', 'Criar Site', 'Criar Reclame Aqui'
]) with ordinality as t(titulo, ord)
where not exists (
  select 1 from checklist_itens c
  where c.empresa_id = e.id and c.titulo = t.titulo
);


-- ============================================================================
-- Realtime
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table checklist_itens;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table plataformas;
exception when duplicate_object then null;
end $$;


-- ============================================================================
-- Conferência
-- ============================================================================

select
  (select count(*) from usuarios)                       as usuarios,
  (select count(*) from checklist_itens)                as itens_checklist,
  (select count(*) from plataformas where ordem is null) as plataformas_sem_ordem;
