begin;
create table performance_private.platform_settings(id boolean primary key default true check(id),automatic_performance_access boolean not null default false,updated_at timestamptz not null default now(),updated_by uuid references auth.users(id));
alter table performance_private.platform_settings enable row level security;
revoke all on performance_private.platform_settings from public,anon,authenticated;
insert into performance_private.platform_settings(id) values(true);
create function performance_private.platform_performance_policy(requested_enabled boolean default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();enabled_now boolean;affected integer:=0;
begin
 if actor_id is null or not exists(select 1 from public.platform_access where user_id=actor_id and active and role='admin') then raise exception 'Apenas administradores da plataforma podem alterar a liberação automática.' using errcode='42501';end if;
 select automatic_performance_access into enabled_now from performance_private.platform_settings where id=true for update;
 if requested_enabled is not null then
  update performance_private.platform_settings set automatic_performance_access=requested_enabled,updated_at=now(),updated_by=actor_id where id=true;
  enabled_now=requested_enabled;
  if enabled_now then
   insert into public.performance_access(user_id,role,active) select id,'member',true from auth.users on conflict(user_id) do update set active=true,updated_at=now() where not performance_access.active;
   get diagnostics affected=row_count;
  end if;
  insert into public.platform_access_audit(actor,application,action) values(actor_id,'performance',case when enabled_now then 'enable_auto_performance' else 'disable_auto_performance' end);
 end if;
 return jsonb_build_object('enabled',enabled_now,'granted_count',affected);
end$$;
revoke all on function performance_private.platform_performance_policy(boolean) from public,anon;
grant execute on function performance_private.platform_performance_policy(boolean) to authenticated;
create function public.platform_performance_policy(enabled boolean default null) returns jsonb language sql security invoker set search_path='' as $$select performance_private.platform_performance_policy(enabled)$$;
revoke all on function public.platform_performance_policy(boolean) from public,anon;
grant execute on function public.platform_performance_policy(boolean) to authenticated;
create or replace function performance_private.on_platform_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare auto_access boolean;
begin
 select automatic_performance_access into auto_access from performance_private.platform_settings where id=true for share;
 insert into public.platform_access(user_id) values(new.id) on conflict do nothing;
 if auto_access then insert into public.performance_access(user_id,role,active) values(new.id,'member',true) on conflict(user_id) do update set active=true,updated_at=now();end if;
 return new;
end$$;
revoke all on function performance_private.on_platform_signup() from public,anon,authenticated;
create table public.platform_usage_events(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,application text not null check(application in('cycle','performance')),event text not null check(event in('open','login','logout','denied')),session_id uuid,created_at timestamptz not null default clock_timestamp());
alter table public.platform_usage_events enable row level security;
revoke all on public.platform_usage_events from public,anon,authenticated;
grant select on public.platform_usage_events to authenticated;
create index platform_usage_user_date on public.platform_usage_events(user_id,created_at desc);
create index platform_usage_app_id on public.platform_usage_events(application,id desc);
create policy platform_usage_admin_read on public.platform_usage_events for select to authenticated using(exists(select 1 from public.platform_access p where p.user_id=(select auth.uid()) and p.active and p.role='admin') or application='performance' and exists(select 1 from public.performance_access a where a.user_id=(select auth.uid()) and a.active and a.role='admin'));
create function performance_private.platform_record_access(app_name text,event_name text default 'open') returns boolean language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();session_uuid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
 if actor_id is null then raise exception 'Sessão inválida.' using errcode='42501';end if;
 if app_name is null or app_name not in('cycle','performance') or event_name is null or event_name not in('open','login','logout','denied') then raise exception 'Evento inválido.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('study-access:'||actor_id::text||coalesce(session_uuid::text,'')||app_name||event_name,0));
 if not exists(select 1 from public.platform_usage_events e where e.user_id=actor_id and e.application=app_name and e.event=event_name and e.session_id is not distinct from session_uuid and e.created_at>clock_timestamp()-interval '1 minute') then
  insert into public.platform_usage_events(user_id,application,event,session_id) values(actor_id,app_name,event_name,session_uuid);
 end if;
 return true;
end$$;
revoke all on function performance_private.platform_record_access(text,text) from public,anon;
grant execute on function performance_private.platform_record_access(text,text) to authenticated;
create function public.platform_record_access(app_name text,event_name text default 'open') returns boolean language sql security invoker set search_path='' as $$select performance_private.platform_record_access(app_name,event_name)$$;
revoke all on function public.platform_record_access(text,text) from public,anon;
grant execute on function public.platform_record_access(text,text) to authenticated;
create function performance_private.platform_access_history(target_app text default 'all',target_email text default null,before_id bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();is_platform_admin boolean;is_performance_admin boolean;result jsonb;
begin
 select exists(select 1 from public.platform_access where user_id=actor_id and active and role='admin') into is_platform_admin;
 select exists(select 1 from public.performance_access where user_id=actor_id and active and role='admin') into is_performance_admin;
 if actor_id is null or not(is_platform_admin or is_performance_admin and target_app='performance') then raise exception 'Apenas administradores podem consultar os acessos.' using errcode='42501';end if;
 if target_app is null or target_app not in('all','cycle','performance') then raise exception 'Aplicativo inválido.';end if;
 select jsonb_build_object('events',coalesce((select jsonb_agg(x order by x.id desc) from(select e.id,u.email,e.application,e.event,e.created_at from public.platform_usage_events e join auth.users u on u.id=e.user_id where (target_app='all' or e.application=target_app) and (target_email is null or lower(u.email)=lower(btrim(target_email))) and (before_id is null or e.id<before_id) order by e.id desc limit 50)x),'[]'::jsonb),'last_logins',coalesce((select jsonb_agg(x order by x.last_sign_in_at desc nulls last) from(select u.email,u.last_sign_in_at from auth.users u where (target_email is null or lower(u.email)=lower(btrim(target_email))) and (is_platform_admin or exists(select 1 from public.performance_access a where a.user_id=u.id) or exists(select 1 from public.platform_usage_events e where e.user_id=u.id and e.application='performance')) order by u.last_sign_in_at desc nulls last limit 100)x),'[]'::jsonb)) into result;
 return result;
end$$;
revoke all on function performance_private.platform_access_history(text,text,bigint) from public,anon;
grant execute on function performance_private.platform_access_history(text,text,bigint) to authenticated;
create function public.platform_access_history(target_app text default 'all',target_email text default null,before_id bigint default null) returns jsonb language sql security invoker set search_path='' as $$select performance_private.platform_access_history(target_app,target_email,before_id)$$;
revoke all on function public.platform_access_history(text,text,bigint) from public,anon;
grant execute on function public.platform_access_history(text,text,bigint) to authenticated;
create policy platform_settings_no_direct_access on performance_private.platform_settings for all to anon,authenticated using(false) with check(false);
commit;
