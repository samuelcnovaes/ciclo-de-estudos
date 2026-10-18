begin;
create table public.platform_access(user_id uuid primary key references auth.users(id) on delete cascade,role text not null default 'member' check(role in('admin','member')),active boolean not null default true,updated_at timestamptz not null default now());
alter table public.platform_access enable row level security;
revoke all on public.platform_access from public,anon,authenticated;
grant select on public.platform_access to authenticated;
create policy platform_own_access on public.platform_access for select to authenticated using(user_id=(select auth.uid()));
insert into public.platform_access(user_id,role,active) select u.id,case when exists(select 1 from public.performance_access a where a.user_id=u.id and a.active and a.role='admin') then 'admin' else 'member' end,true from auth.users u;
do $$begin if not exists(select 1 from public.platform_access where role='admin' and active) then raise exception 'An administrator must exist before activating access control';end if;end$$;
create table public.platform_access_audit(id bigint generated always as identity primary key,actor uuid references auth.users(id),target uuid references auth.users(id),application text not null,action text not null,created_at timestamptz not null default now());
alter table public.platform_access_audit enable row level security;
revoke all on public.platform_access_audit from public,anon,authenticated;
create function performance_private.on_platform_signup() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.platform_access(user_id) values(new.id) on conflict do nothing;return new;end$$;
revoke all on function performance_private.on_platform_signup() from public,anon,authenticated;
create trigger platform_new_account after insert on auth.users for each row execute function performance_private.on_platform_signup();
create function performance_private.platform_manage_access(request_action text,target_email text default null,target_app text default 'cycle') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();target_id uuid;old_role text;old_active boolean;result jsonb;
begin
 if request_action is null or request_action not in('list','grant','revoke','promote','demote','created') or target_app is null or target_app not in('cycle','performance') then raise exception 'Ação inválida';end if;
 if request_action<>'list' then lock table public.platform_access in share row exclusive mode;lock table public.performance_access in share row exclusive mode;end if;
 if actor_id is null or not exists(select 1 from public.platform_access where user_id=actor_id and role='admin' and active) then raise exception 'Apenas administradores podem gerenciar usuários' using errcode='42501';end if;
 if request_action<>'list' then
 select id into target_id from auth.users where lower(email)=lower(btrim(target_email));
 if target_id is null then raise exception 'Conta não encontrada. Cadastre a conta primeiro.';end if;
 if target_app='cycle' then
 select role,active into old_role,old_active from public.platform_access where user_id=target_id;
 if old_role='admin' and old_active and request_action in('revoke','demote') and (select count(*) from public.platform_access where role='admin' and active)<=1 then raise exception 'Não é possível remover o último administrador ativo.';end if;
 if request_action in('grant','promote') then insert into public.platform_access(user_id,role,active) values(target_id,case when request_action='promote' then 'admin' else coalesce(old_role,'member') end,true) on conflict(user_id) do update set role=excluded.role,active=true,updated_at=now();
 elsif request_action in('revoke','demote') then update public.platform_access set active=case when request_action='revoke' then false else active end,role=case when request_action='demote' then 'member' else role end,updated_at=now() where user_id=target_id;end if;
 else
 select role,active into old_role,old_active from public.performance_access where user_id=target_id;
 if old_role='admin' and old_active and request_action in('revoke','demote') and (select count(*) from public.performance_access where role='admin' and active)<=1 then raise exception 'Não é possível remover o último administrador do Desempenho.';end if;
 if request_action in('grant','promote') then insert into public.performance_access(user_id,role,active) values(target_id,case when request_action='promote' then 'admin' else coalesce(old_role,'member') end,true) on conflict(user_id) do update set role=excluded.role,active=true,updated_at=now();
 elsif request_action in('revoke','demote') then update public.performance_access set active=case when request_action='revoke' then false else active end,role=case when request_action='demote' then 'member' else role end,updated_at=now() where user_id=target_id;end if;
 end if;
 insert into public.platform_access_audit(actor,target,application,action) values(actor_id,target_id,target_app,request_action);
 end if;
 select jsonb_build_object('accounts',coalesce((select jsonb_agg(jsonb_build_object('user_id',u.id,'email',u.email,'name',left(coalesce(u.raw_user_meta_data->>'first_name',''),80),'cycle',coalesce(p.active,false),'role',coalesce(p.role,'member'),'performance',coalesce(f.active,false),'performance_role',coalesce(f.role,'member')) order by u.created_at desc) from auth.users u left join public.platform_access p on p.user_id=u.id left join public.performance_access f on f.user_id=u.id),'[]'::jsonb),'audit',coalesce((select jsonb_agg(x) from(select a.action,a.application,a.created_at,t.email as target_email,b.email as actor_email from public.platform_access_audit a left join auth.users t on t.id=a.target left join auth.users b on b.id=a.actor order by a.id desc limit 50)x),'[]'::jsonb)) into result;return result;
end$$;
revoke all on function performance_private.platform_manage_access(text,text,text) from public,anon;
grant execute on function performance_private.platform_manage_access(text,text,text) to authenticated;
create function public.platform_manage_access(request_action text,target_email text default null,target_app text default 'cycle') returns jsonb language sql security invoker set search_path='' as $$select performance_private.platform_manage_access(request_action,target_email,target_app)$$;
revoke all on function public.platform_manage_access(text,text,text) from public,anon;
grant execute on function public.platform_manage_access(text,text,text) to authenticated;
-- Existing owners retain access; all future signups receive ordinary cycle access only.
do $$declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='ciclo_study_state' loop execute format('drop policy %I on public.ciclo_study_state',p.policyname);end loop;end$$;
create policy ciclo_own_select on public.ciclo_study_state for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.platform_access p where p.user_id=(select auth.uid()) and p.active));
create policy ciclo_own_insert on public.ciclo_study_state for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.platform_access p where p.user_id=(select auth.uid()) and p.active));
create policy ciclo_own_update on public.ciclo_study_state for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.platform_access p where p.user_id=(select auth.uid()) and p.active)) with check(user_id=(select auth.uid()) and exists(select 1 from public.platform_access p where p.user_id=(select auth.uid()) and p.active));
commit;
