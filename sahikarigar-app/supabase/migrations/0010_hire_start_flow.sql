-- ============================================================================
-- SahiKaarigar - Start-work OTP + "work in progress" hire status
-- Migration: 0010_hire_start_flow.sql
--
-- ADDITIVE ONLY. Widens the hire_requests status CHECK and adds the columns
-- the mobile "Start Work" OTP flow needs. Old rows and old code keep working.
--
-- Flow after this migration:
--   pending -> accepted -> en_route -> arrived --(OTP verify)--> in_progress
--   -> completed   (cancelled / rejected can happen before completion)
--
-- NOTE: run this in the Supabase SQL editor BEFORE testing the Start Work
-- OTP flow — without it the server rejects `in_progress` with a CHECK
-- constraint error.
-- ============================================================================

-- 1. hire_requests.status: add "in_progress" (work started after OTP check).
alter table public.hire_requests drop constraint if exists hire_requests_status;
alter table public.hire_requests add constraint hire_requests_status
  check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled',
                    'en_route', 'arrived', 'in_progress'));

-- 2. start_otp: 4-digit code the customer shares with the worker to start the
--    job. Already added by 0006_review_and_otp_fields.sql in some databases —
--    `if not exists` makes this a no-op there.
--    Code paths that never wrote one are covered by the server's derived
--    (HMAC-based) OTP, so both old and new rows work.
alter table public.hire_requests
  add column if not exists start_otp text;

-- 3. started_at: when the worker verified the OTP and began the job.
alter table public.hire_requests
  add column if not exists started_at timestamptz;
