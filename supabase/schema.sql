-- Schema aplicado ao projeto hksxuvnevztwnyfbuftx.
-- Migração remota: 20261014143908 / ciclo_study_state_private_sync.
-- Referência para um banco novo; não executar novamente em tabela existente.
create table public.ciclo_study_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint ciclo_payload_object check (jsonb_typeof(payload) = 'object')
);
alter table public.ciclo_study_state enable row level security;
revoke all on public.ciclo_study_state from anon, authenticated;
grant select on public.ciclo_study_state to authenticated;
grant insert (user_id,payload) on public.ciclo_study_state to authenticated;
grant update (payload) on public.ciclo_study_state to authenticated;
create policy ciclo_read_own on public.ciclo_study_state for select to authenticated using ((select auth.uid())=user_id);
create policy ciclo_insert_own on public.ciclo_study_state for insert to authenticated with check ((select auth.uid())=user_id);
create policy ciclo_update_own on public.ciclo_study_state for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function public.ciclo_bump_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.version:=old.version+1; new.updated_at:=now(); return new; end; $$;
create trigger ciclo_state_version before update on public.ciclo_study_state for each row execute function public.ciclo_bump_version();
revoke execute on function public.ciclo_bump_version() from public,anon,authenticated;
