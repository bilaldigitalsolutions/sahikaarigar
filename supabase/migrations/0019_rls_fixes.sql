-- ============================================================================
-- SahiKaarigar - RLS fixes for server-only tables
-- Migration: 0019_rls_fixes.sql
--
-- `user_reports` (0008) and `rate_limits` (0013) were created after the
-- original RLS/grants migration. All access to them goes through the
-- auth-server/Next.js service_role client, so the public anon/authenticated
-- roles must get nothing.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.user_reports enable row level security;
alter table public.rate_limits  enable row level security;

drop policy if exists user_reports_deny_client_access on public.user_reports;
create policy user_reports_deny_client_access
  on public.user_reports as restrictive for all to anon, authenticated
  using (false) with check (false);

drop policy if exists rate_limits_deny_client_access on public.rate_limits;
create policy rate_limits_deny_client_access
  on public.rate_limits as restrictive for all to anon, authenticated
  using (false) with check (false);

-- service_role bypasses RLS, but it still needs table-level grants.
grant all privileges on table public.user_reports to service_role;
grant all privileges on table public.rate_limits  to service_role;

-- Keep the client-facing roles locked out even if a dashboard setting or a
-- future migration accidentally grants them table access.
revoke all privileges on table public.user_reports from anon, authenticated;
revoke all privileges on table public.rate_limits  from anon, authenticated;
