-- ============================================================================
-- SahiKaarigar - Worker -> customer feedback
-- Migration: 0021_worker_feedback.sql
--
-- `reviews` is the CUSTOMER's review of the WORKER (one row per hire request,
-- enforced by its unique hire_request_id). Feedback is now required from BOTH
-- sides after completion, so the worker's review of the customer lives in its
-- own table with the same one-row-per-hire rule.
--
-- ADDITIVE ONLY. The server treats a missing table as "not reviewed yet" (GET)
-- and shows a friendly migration hint on submit, so deploying the app before
-- this SQL runs never breaks the hire detail screen.
-- ============================================================================

create table if not exists public.customer_reviews (
  id              uuid primary key default gen_random_uuid(),
  hire_request_id uuid not null unique references public.hire_requests (id) on delete cascade,
  reviewer_id     uuid not null references public.users (id) on delete cascade,
  customer_id     uuid not null references public.users (id) on delete cascade,
  rating          integer not null,
  comment         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint customer_reviews_rating  check (rating between 1 and 5),
  constraint customer_reviews_comment check (comment is null or char_length(comment) <= 500),
  constraint customer_reviews_not_self check (reviewer_id <> customer_id)
);

create index if not exists customer_reviews_customer_idx
  on public.customer_reviews (customer_id, created_at desc);
create index if not exists customer_reviews_reviewer_idx
  on public.customer_reviews (reviewer_id);

drop trigger if exists customer_reviews_set_updated_at on public.customer_reviews;
create trigger customer_reviews_set_updated_at
  before update on public.customer_reviews
  for each row execute function public.set_updated_at();

-- Same lockdown as the other private tables: only the service-role server key
-- (which bypasses RLS) may read/write feedback.
alter table public.customer_reviews enable row level security;

drop policy if exists customer_reviews_deny_client_access on public.customer_reviews;
create policy customer_reviews_deny_client_access
  on public.customer_reviews as restrictive for all to anon, authenticated
  using (false) with check (false);
