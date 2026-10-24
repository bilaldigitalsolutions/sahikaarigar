-- ============================================================================
-- SahiKaarigar - Worker performance & punctuality rating
-- Migration: 0017_worker_performance.sql
--
-- ADDITIVE ONLY. Old rows and old code keep working. Safe to re-run.
--
-- What this adds:
--   hire_requests.scheduled_time  - when the job is expected to start
--                                   (falls back to created_at for immediate
--                                   bookings, so every hire has a baseline).
--   hire_requests.arrived_time    - when the worker pressed "Arrived" (kept in
--                                   sync with the existing arrived_at column).
--   worker_profiles.total_jobs_completed - lifetime completed jobs (mirrors
--                                   the existing completed_jobs counter).
--   worker_profiles.on_time_jobs  - jobs where the worker arrived less than
--                                   30 minutes after scheduled_time.
--   worker_profiles.customer_rating_avg - review average (mirrors the existing
--                                   rating_average column).
--   worker_profiles.system_rating_score - on_time_jobs / total_jobs_completed
--                                   as a percentage (0 when there are no jobs).
--
-- Run this in the Supabase SQL editor BEFORE deploying the auth-server that
-- writes these columns.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Hire timeline: the scheduled/expected time and the actual arrival.
-- ---------------------------------------------------------------------------
alter table public.hire_requests
  add column if not exists scheduled_time timestamptz;

alter table public.hire_requests
  add column if not exists arrived_time timestamptz;

comment on column public.hire_requests.scheduled_time is
  'Expected start time for the job. For immediate bookings this is the time the booking was created.';
comment on column public.hire_requests.arrived_time is
  'Timestamp when the worker pressed Arrived. Mirrors arrived_at for compatibility.';

-- Backfill new columns from the values the app already stores.
update public.hire_requests
   set scheduled_time = coalesce(scheduled_time, scheduled_date, created_at)
 where scheduled_time is null;

update public.hire_requests
   set arrived_time = coalesce(arrived_time, arrived_at)
 where arrived_time is null
   and arrived_at is not null;

-- ---------------------------------------------------------------------------
-- 2. Worker performance counters.
-- ---------------------------------------------------------------------------
alter table public.worker_profiles
  add column if not exists total_jobs_completed integer not null default 0;

alter table public.worker_profiles
  add column if not exists on_time_jobs integer not null default 0;

alter table public.worker_profiles
  add column if not exists customer_rating_avg numeric(3,2) not null default 0;

alter table public.worker_profiles
  add column if not exists system_rating_score numeric(5,2) not null default 0;

alter table public.worker_profiles
  drop constraint if exists worker_profiles_total_jobs_completed_check;
alter table public.worker_profiles
  add constraint worker_profiles_total_jobs_completed_check
  check (total_jobs_completed >= 0);

alter table public.worker_profiles
  drop constraint if exists worker_profiles_on_time_jobs_check;
alter table public.worker_profiles
  add constraint worker_profiles_on_time_jobs_check
  check (on_time_jobs >= 0);

alter table public.worker_profiles
  drop constraint if exists worker_profiles_customer_rating_avg_check;
alter table public.worker_profiles
  add constraint worker_profiles_customer_rating_avg_check
  check (customer_rating_avg between 0 and 5);

alter table public.worker_profiles
  drop constraint if exists worker_profiles_system_rating_score_check;
alter table public.worker_profiles
  add constraint worker_profiles_system_rating_score_check
  check (system_rating_score between 0 and 100);

comment on column public.worker_profiles.total_jobs_completed is
  'Lifetime completed jobs. Kept in sync with completed_jobs.';
comment on column public.worker_profiles.on_time_jobs is
  'Completed jobs where the worker arrived less than 30 minutes after scheduled_time.';
comment on column public.worker_profiles.customer_rating_avg is
  'Average customer review rating. Kept in sync with rating_average.';
comment on column public.worker_profiles.system_rating_score is
  'Punctuality percentage: min(100, on_time_jobs / total_jobs_completed * 100).';

-- ---------------------------------------------------------------------------
-- 3. Score calculation + trigger.
--    A single source of truth for the percentage, so the number is correct no
--    matter whether a job completes through the RPC or a future admin action.
-- ---------------------------------------------------------------------------
create or replace function public.calculate_worker_system_rating_score(
  p_on_time_jobs integer,
  p_total_jobs_completed integer
)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_total_jobs_completed, 0) <= 0 then 0::numeric
    else round(
      least(
        100::numeric,
        greatest(0::numeric, coalesce(p_on_time_jobs, 0)::numeric) * 100
          / p_total_jobs_completed
      ),
      2
    )
  end;
$$;

create or replace function public.set_worker_performance_score()
returns trigger
language plpgsql
as $$
begin
  new.system_rating_score := public.calculate_worker_system_rating_score(
    new.on_time_jobs,
    new.total_jobs_completed
  );
  return new;
end;
$$;

drop trigger if exists worker_profiles_set_performance_score on public.worker_profiles;
create trigger worker_profiles_set_performance_score
  before insert or update of on_time_jobs, total_jobs_completed
  on public.worker_profiles
  for each row execute function public.set_worker_performance_score();

-- ---------------------------------------------------------------------------
-- 4. Keep the new counters in sync with the existing ones.
-- ---------------------------------------------------------------------------
create or replace function public.increment_worker_completed_jobs(p_worker_id uuid)
returns void
language sql
as $$
  update public.worker_profiles
     set completed_jobs        = completed_jobs + 1,
         total_jobs_completed   = total_jobs_completed + 1,
         availability           = 'available',
         updated_at             = now()
   where id = p_worker_id;
$$;

create or replace function public.increment_worker_on_time_jobs(p_worker_id uuid)
returns void
language sql
as $$
  update public.worker_profiles
     set on_time_jobs = on_time_jobs + 1,
         updated_at   = now()
   where id = p_worker_id;
$$;

-- Reviews already update rating_average / rating_count. Mirror the average
-- into the new customer_rating_avg column at the same time.
create or replace function public.refresh_worker_rating(p_worker_id uuid)
returns void
language plpgsql
as $$
begin
  update public.worker_profiles as wp
     set rating_average      = coalesce(s.avg_rating, 0),
         rating_count        = coalesce(s.total, 0),
         customer_rating_avg = coalesce(s.avg_rating, 0)
    from (
      select round(avg(rating)::numeric, 2) as avg_rating,
             count(*)::int                  as total
        from public.reviews
       where worker_id = p_worker_id
    ) as s
   where wp.id = p_worker_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Backfill from the existing counters and completed hires.
--    Only default/empty values are filled in, so re-running this migration
--    never overwrites live counters. The score trigger runs for every row
--    updated here.
-- ---------------------------------------------------------------------------
update public.worker_profiles as w
   set total_jobs_completed = coalesce(w.completed_jobs, 0),
       on_time_jobs = case
         when w.on_time_jobs = 0 then least(
           coalesce(w.completed_jobs, 0),
           coalesce(
             (
               select count(*)::int
                 from public.hire_requests as h
                where h.worker_id = w.id
                  and h.status = 'completed'
                  and coalesce(h.arrived_time, h.arrived_at) is not null
                  and coalesce(h.arrived_time, h.arrived_at)
                      < coalesce(h.scheduled_time, h.scheduled_date, h.created_at)
                        + interval '30 minutes'
             ),
             0
           )
         )
         else w.on_time_jobs
       end,
       customer_rating_avg = case
         when w.customer_rating_avg = 0 then coalesce(w.rating_average, 0)
         else w.customer_rating_avg
       end
 where w.total_jobs_completed = 0
    or w.on_time_jobs = 0
    or w.customer_rating_avg = 0;

-- ---------------------------------------------------------------------------
-- 6. Lock the new functions down like the rest of the schema. The auth-server
--    uses service_role (which bypasses these grants); anon/authenticated get
--    nothing.
-- ---------------------------------------------------------------------------
revoke all on function public.calculate_worker_system_rating_score(integer, integer) from public;
revoke all on function public.set_worker_performance_score() from public;
revoke all on function public.increment_worker_completed_jobs(uuid) from public;
revoke all on function public.increment_worker_on_time_jobs(uuid) from public;

grant execute on function public.calculate_worker_system_rating_score(integer, integer) to service_role;
grant execute on function public.set_worker_performance_score() to service_role;
grant execute on function public.increment_worker_completed_jobs(uuid) to service_role;
grant execute on function public.increment_worker_on_time_jobs(uuid) to service_role;
