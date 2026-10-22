-- ============================================================================
-- SahiKaarigar - reviewed_by stores the admin EMAIL, not a users.id
-- Migration: 0016_fix_reviewed_by.sql
--
-- WHY THIS EXISTS
-- 0015_admin_review_columns.sql declared:
--   reviewed_by uuid references public.users(id)
--
-- But the admin is NOT a row in public.users. There is exactly ONE admin
-- account and it is configured via environment variables
-- (ADMIN_EMAIL / ADMIN_PASSWORD). The session payload returned by
-- getAdminSession() is only { role: 'admin', email } — there is no id.
--
-- Writing a uuid here is therefore impossible: it would either be NULL or
-- crash with "invalid input syntax for type uuid". This migration changes the
-- column to text so it can store the admin's email address, which is always
-- available from the session.
--
-- Safe to re-run: the FK drop uses a guarded DO block and the type change is
-- conditional on the current type.
-- ============================================================================

-- 1. Drop the foreign key to public.users(id) if one exists. Postgres auto-names
--    inline FKs (e.g. worker_profiles_reviewed_by_fkey), so find it by column.
do $$
declare
  fk_name text;
begin
  select con.conname
    into fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any (con.conkey)
   where con.contype = 'f'
     and nsp.nspname = 'public'
     and rel.relname = 'worker_profiles'
     and att.attname = 'reviewed_by';

  if fk_name is not null then
    execute format('alter table public.worker_profiles drop constraint %I', fk_name);
  end if;
end $$;

-- 2. Convert uuid -> text (only if it is still a uuid column).
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'worker_profiles'
       and column_name = 'reviewed_by'
       and data_type = 'uuid'
  ) then
    alter table public.worker_profiles
      alter column reviewed_by type text using reviewed_by::text;
  end if;
end $$;

-- 3. Ensure the column exists as text even on a database where 0015 never ran.
alter table public.worker_profiles
  add column if not exists reviewed_by text;

comment on column public.worker_profiles.reviewed_by is
  'Email of the admin that last approved/rejected this worker (env-configured admin account, not a users row).';
