-- ============================================================================
-- SahiKaarigar - Distance-aware punctuality
-- Migration: 0018_hire_distance.sql
--
-- ADDITIVE ONLY. Old rows and old code keep working. Safe to re-run.
--
-- What this adds:
--   hire_requests.distance_km      - customer -> worker distance (km) saved when
--                                    the booking is created.
--   hire_requests.arrived_on_time  - result of the distance-aware arrival check:
--                                    null = not arrived yet, true = on time,
--                                    false = late.
--
-- Arrival windows:
--   <= 3 km  -> 20 minutes
--   <= 7 km  -> 35 minutes
--   >  7 km  -> 50 minutes
--
-- Run this in the Supabase SQL editor BEFORE deploying the auth-server that
-- writes/reads these columns.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. New hire columns.
-- ---------------------------------------------------------------------------
alter table public.hire_requests
  add column if not exists distance_km numeric(8,2);

alter table public.hire_requests
  add column if not exists arrived_on_time boolean;

comment on column public.hire_requests.distance_km is
  'Customer -> worker distance in kilometres, calculated when the booking is created (GPS first, service-area fallback).';
comment on column public.hire_requests.arrived_on_time is
  'Whether the worker reached within the distance-aware window. NULL until arrival, false means late.';

alter table public.hire_requests
  drop constraint if exists hire_requests_distance_km_check;
alter table public.hire_requests
  add constraint hire_requests_distance_km_check
  check (distance_km is null or distance_km >= 0);

-- Keep the performance-column documentation in sync with the new window.
comment on column public.worker_profiles.on_time_jobs is
  'Jobs where the worker arrived within the distance-aware window: 20 min (<=3 km), 35 min (<=7 km), 50 min (>7 km).';

-- ---------------------------------------------------------------------------
-- 2. Backfill distance for existing bookings where both sides have GPS.
--    The Haversine formula mirrors auth-server/src/geo.js.
-- ---------------------------------------------------------------------------
update public.hire_requests as h
   set distance_km = round(
     (
       2 * 6371 * asin(
         least(
           1::double precision,
           sqrt(
             power(sin(radians(w.lat - u.lat) / 2), 2) +
             cos(radians(u.lat)) * cos(radians(w.lat)) *
             power(sin(radians(w.lng - u.lng) / 2), 2)
           )
         )
       )
     )::numeric,
     2
   )
  from public.users as u, public.worker_profiles as w
 where h.employer_id = u.id
   and h.worker_id = w.id
   and h.distance_km is null
   and u.lat is not null
   and u.lng is not null
   and w.lat is not null
   and w.lng is not null;

-- ---------------------------------------------------------------------------
-- 3. Backfill the late marker for hires that already arrived.
--    Historical worker_profiles.on_time_jobs counters are intentionally left
--    untouched; only the per-hire marker is derived here.
-- ---------------------------------------------------------------------------
update public.hire_requests
   set arrived_on_time =
     coalesce(arrived_time, arrived_at) <=
     coalesce(scheduled_time, scheduled_date, created_at) +
       (
         case
           when distance_km is null then 35
           when distance_km <= 3 then 20
           when distance_km <= 7 then 35
           else 50
         end
       ) * interval '1 minute'
 where coalesce(arrived_time, arrived_at) is not null
   and arrived_on_time is null;
