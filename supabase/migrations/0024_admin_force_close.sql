-- ============================================================================
-- SahiKaarigar - Admin force-close columns for stuck jobs
-- Migration: 0024_admin_force_close.sql
--
-- ADDITIVE ONLY. Adds auditing columns to hire_requests so the admin
-- force-close endpoint (POST /admin/hires/:id/force-close) can record who
-- closed a stuck job, when, why, and with what final status/amount.
--
-- Existing rows stay valid (NULL until force-closed).
-- ============================================================================

alter table public.hire_requests
  add column if not exists force_closed_by text;

alter table public.hire_requests
  add column if not exists force_closed_at timestamptz;

alter table public.hire_requests
  add column if not exists force_closed_reason text;

comment on column public.hire_requests.force_closed_by is
  'Admin email who force-closed this hire (NULL unless force-closed).';
comment on column public.hire_requests.force_closed_at is
  'Timestamp when the admin force-closed this hire.';
comment on column public.hire_requests.force_closed_reason is
  'Reason given by the admin for force-closing.';

-- Keep RLS locked down (service_role bypasses RLS; anon/authenticated get nothing).
alter table public.hire_requests enable row level security;

-- ============================================================================
-- END OF MIGRATION 0024
-- ============================================================================
