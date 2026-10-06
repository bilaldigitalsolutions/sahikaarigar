-- ============================================================================
-- SahiKaarigar - Hire flow: live status, location reach, platform feedback
-- Migration: 0005_hire_flow.sql
--
-- ADDITIVE ONLY. Nothing here changes how the existing tables behave; it only
-- widens what they allow, so old rows and old code keep working.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. hire_requests.status: add "on the way" and "reached".
--    Full flow: pending -> accepted -> en_route -> arrived -> completed
--               (cancelled / rejected can happen before completion)
-- ---------------------------------------------------------------------------
alter table public.hire_requests drop constraint if exists hire_requests_status;
alter table public.hire_requests add constraint hire_requests_status
  check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled', 'en_route', 'arrived'));

-- ---------------------------------------------------------------------------
-- 2. Tracking: when the worker set off / reached, and the location they shared.
-- ---------------------------------------------------------------------------
alter table public.hire_requests
  add column if not exists en_route_at timestamptz,
  add column if not exists arrived_at  timestamptz,
  add column if not exists worker_lat  double precision,
  add column if not exists worker_lng  double precision;

create index if not exists hire_requests_tracking_idx
  on public.hire_requests (status, updated_at desc);

-- ---------------------------------------------------------------------------
-- 3. platform_feedback: the user's opinion of SahiKaarigar ITSELF.
--    (Separate from `reviews`, which rate the WORKER.)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  hire_request_id uuid references public.hire_requests (id) on delete set null,
  rating          integer not null,
  comment         text,
  created_at      timestamptz not null default now(),
  constraint platform_feedback_rating  check (rating between 1 and 5),
  constraint platform_feedback_comment check (comment is null or char_length(comment) <= 1000)
);

create index if not exists platform_feedback_user_idx
  on public.platform_feedback (user_id, created_at desc);
create index if not exists platform_feedback_created_idx
  on public.platform_feedback (created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Lock it down exactly like the other tables (service_role bypasses RLS;
--    the public anon key gets nothing).
-- ---------------------------------------------------------------------------
alter table public.platform_feedback enable row level security;

drop policy if exists platform_feedback_deny_client_access on public.platform_feedback;
create policy platform_feedback_deny_client_access
  on public.platform_feedback as restrictive for all to anon, authenticated
  using (false) with check (false);
