-- ============================================================================
-- SahiKaarigar - Review fields + hire OTP
-- Migration: 0006_review_and_otp_fields.sql
--
-- ADDITIVE ONLY. Adds columns for the feedback screen (tip, likes) and the
-- "start work" OTP on hire_requests.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. hire_requests.start_otp: 4-digit code the customer shares with the
--    worker to start the job. Generated server-side when the hire is created.
-- ---------------------------------------------------------------------------
alter table public.hire_requests
  add column if not exists start_otp text;

-- ---------------------------------------------------------------------------
-- 2. reviews.tip_amount: optional tip the customer gives the worker (₹).
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists tip_amount integer default 0,
  add column if not exists likes text[] default '{}';

alter table public.reviews drop constraint if exists reviews_tip_amount;
alter table public.reviews add constraint reviews_tip_amount
  check (tip_amount is null or tip_amount >= 0);
