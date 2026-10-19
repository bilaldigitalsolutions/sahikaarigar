-- ============================================================================
-- SahiKaarigar - Trust & Penalty system (record-only, NO auto-blocking)
-- Migration: 0011_trust_penalty.sql
--
-- ADDITIVE ONLY. Old rows and old code keep working. Safe to re-run.
--
-- What this adds:
--   hire_requests.cancelled_by  — 'worker' or 'employer': who cancelled
--   hire_requests.cancelled_at  — when it was cancelled
--   worker_profiles.cancel_count — times a kaarigar cancelled AFTER accepting
--   worker_profiles.is_flagged   — red flag for admin review (>= 3 cancels)
--   users.is_flagged             — red flag (e.g. employer cancelled while the
--                                  kaarigar was already on the way)
--
-- NOTE: nothing here auto-blocks anyone. Flags are only visible in the Admin
-- Panel so a human decides block / unblock.
--
-- Run this in the Supabase SQL editor BEFORE deploying the auth-server that
-- writes these columns, otherwise the cancel action errors with
-- "column cancelled_by does not exist".
-- ============================================================================

-- 1. Who cancelled the hire and when (worker / employer booking lifecycle).
alter table public.hire_requests
  add column if not exists cancelled_by varchar(10)
    check (cancelled_by in ('worker', 'employer'));
alter table public.hire_requests
  add column if not exists cancelled_at timestamptz;

-- 2. Kaarigar cancellation tracking (trust score input for the admin).
alter table public.worker_profiles
  add column if not exists cancel_count integer not null default 0;
alter table public.worker_profiles
  add column if not exists is_flagged boolean not null default false;

-- 3. Employer no-show tracking (cancelled AFTER the kaarigar started travelling).
alter table public.users
  add column if not exists is_flagged boolean not null default false;

create index if not exists worker_profiles_flagged_idx
  on public.worker_profiles(is_flagged) where is_flagged;
create index if not exists users_flagged_idx
  on public.users(is_flagged) where is_flagged;
