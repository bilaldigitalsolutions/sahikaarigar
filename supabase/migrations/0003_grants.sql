-- ============================================================================
-- SahiKaarigar - PostgREST role grants
-- Migration: 0003_grants.sql
--
-- The project was created with "Automatically expose new tables" UNCHECKED, so
-- the API roles never received table privileges. PostgREST authenticates as
-- `anon` / `authenticated` / `service_role`, and even `service_role` needs
-- table-level GRANTs (it bypasses RLS, but NOT GRANTs).
--
-- Only `service_role` gets table access: all database traffic from the Next.js
-- app is server-side. The client-facing roles get nothing (RLS is a second
-- layer on top of this).
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Server-side access used by the Next.js app (bypasses RLS)
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Keep the same grants for objects created by future migrations
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
