-- ============================================================================
-- SahiKaarigar - Actual work-duration billing
-- Migration: 0023_hire_total_amount.sql
--
-- ADDITIVE ONLY. `started_at` already exists from 0010_hire_start_flow.sql and
-- `completed_at` exists from the initial schema. This adds the final amount
-- calculated by the auth-server when the customer marks the job completed:
--
--   duration_minutes = (completed_at - started_at) / 60000
--   total_amount     = (duration_minutes / 60) * worker hourly rate
--
-- Existing rows stay valid (NULL until their next completion).
-- ============================================================================

alter table public.hire_requests
  add column if not exists total_amount numeric(10, 2);

comment on column public.hire_requests.total_amount is
  'Final bill calculated from started_at -> completed_at and the worker hourly rate.';
