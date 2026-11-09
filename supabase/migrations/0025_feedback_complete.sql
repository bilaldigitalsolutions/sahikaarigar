-- ============================================================================
-- SahiKaarigar - Feedback completion flag on hire_requests
-- Migration: 0025_feedback_complete.sql
--
-- ADDITIVE ONLY. Adds a `feedback_complete` boolean to hire_requests so the
-- admin panel can see which completed hires still have pending feedback from
-- one side (customer->worker or worker->customer).
--
-- A hire is considered "fully rated" only when BOTH:
--   1. `reviews` row exists (customer -> worker)
--   2. `customer_reviews` row exists (worker -> customer)
--
-- Existing rows stay valid (default false).
-- ============================================================================

alter table public.hire_requests
  add column if not exists feedback_complete boolean not null default false;

comment on column public.hire_requests.feedback_complete is
  'True when both customer->worker review and worker->customer review exist for this hire.';

-- Keep RLS locked down (service_role bypasses RLS; anon/authenticated get nothing).
alter table public.hire_requests enable row level security;

-- ============================================================================
-- END OF MIGRATION 0025
-- ============================================================================
