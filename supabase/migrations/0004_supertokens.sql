-- ============================================================================
-- SahiKaarigar - SuperTokens support
-- Migration: 0004_supertokens.sql
--
-- Adds the SuperTokens user id to `users` so the app can run on EITHER auth
-- provider while migrating:
--
--   firebase_uid  -> Firebase Phone Auth   (supabase/functions/auth)
--   auth_user_id  -> SuperTokens           (auth-server/)
--
-- Exactly one of them is set per row.
-- ============================================================================

-- 1. The SuperTokens user id for this account.
alter table public.users add column if not exists auth_user_id text;

-- 2. `firebase_uid` was NOT NULL; a SuperTokens sign-in has no Firebase UID.
alter table public.users alter column firebase_uid drop not null;

-- 3. Unique only when present, so the many NULLs stay allowed.
create unique index if not exists users_auth_user_id_key
  on public.users (auth_user_id)
  where auth_user_id is not null;

create index if not exists users_auth_user_id_lookup_idx
  on public.users (auth_user_id);

-- 4. The Core may store its own tables in this database (only when you point
--    SuperTokens Core at Supabase Postgres). Those tables are owned by the Core
--    and are deliberately NOT granted to `anon` / `authenticated`.
--    Nothing to do here — 0003_grants.sql already grants `service_role` access
--    and sets default privileges for future objects.
