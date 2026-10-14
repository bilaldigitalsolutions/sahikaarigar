-- ============================================================================
-- SahiKaarigar - Supabase (PostgreSQL) initial schema
-- Migration: 0001_init_schema.sql
--
-- Run this in the Supabase SQL Editor (or `supabase db push`) BEFORE starting
-- the Next.js app. It replaces the previous MongoDB/Mongoose models.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;  -- provides gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. Shared helper: keep `updated_at` fresh on every UPDATE
--    (replaces Mongoose `{ timestamps: true }`)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. users
--    Firebase Phone Auth is the auth provider, so `firebase_uid` links a row
--    to the Firebase user. `phone` stores the 10-digit Indian mobile number
--    (e.g. "9876543210"), NOT the "+91" prefixed version.
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  firebase_uid  text        not null unique,
  phone         text        not null unique,
  name          text        not null,
  role          text        not null default 'employer',
  avatar        text,
  location_area text,
  location_city text        default 'Hyderabad',
  lat           double precision,
  lng           double precision,
  is_active     boolean     not null default true,
  is_verified   boolean     not null default false,
  address       text,
  trust_score   integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint users_phone_format check (phone ~ '^[6-9][0-9]{9}$'),
  constraint users_name_length  check (char_length(name) between 2 and 50),
  constraint users_role_values  check (role in ('worker', 'employer', 'admin')),
  constraint users_trust_score  check (trust_score between 0 and 100),
  constraint users_lat_range    check (lat is null or lat between -90 and 90),
  constraint users_lng_range    check (lng is null or lng between -180 and 180)
);

create index if not exists users_role_idx       on public.users (role);
create index if not exists users_created_at_idx on public.users (created_at desc);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. worker_profiles  (1:1 with users where role = 'worker')
-- ---------------------------------------------------------------------------
create table if not exists public.worker_profiles (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references public.users (id) on delete cascade,
  skills         text[]       not null default '{}',
  experience     integer      not null default 0,
  description    text,
  hourly_rate    integer      not null,
  availability   text         not null default 'available',
  portfolio      text[]       not null default '{}',
  rating_average numeric(3,2) not null default 0,
  rating_count   integer      not null default 0,
  completed_jobs integer      not null default 0,
  service_areas  text[]       not null default '{}',
  lat            double precision,
  lng            double precision,
  is_approved    boolean      not null default false,
  admin_notes    text,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),
  constraint worker_profiles_experience   check (experience between 0 and 50),
  constraint worker_profiles_rate         check (hourly_rate between 50 and 10000),
  constraint worker_profiles_availability check (availability in ('available', 'busy', 'offline')),
  constraint worker_profiles_rating       check (rating_average between 0 and 5),
  constraint worker_profiles_rating_count check (rating_count >= 0),
  constraint worker_profiles_jobs         check (completed_jobs >= 0),
  constraint worker_profiles_description  check (description is null or char_length(description) <= 500),
  constraint worker_profiles_notes        check (admin_notes is null or char_length(admin_notes) <= 500)
);

create index if not exists worker_profiles_user_id_idx    on public.worker_profiles (user_id);
create index if not exists worker_profiles_search_idx     on public.worker_profiles (is_approved, availability);
create index if not exists worker_profiles_skills_idx     on public.worker_profiles using gin (skills);
create index if not exists worker_profiles_areas_idx      on public.worker_profiles using gin (service_areas);
create index if not exists worker_profiles_rating_idx     on public.worker_profiles (rating_average desc, completed_jobs desc);
create index if not exists worker_profiles_geo_idx        on public.worker_profiles (lat, lng);
create index if not exists worker_profiles_created_at_idx on public.worker_profiles (created_at desc);

drop trigger if exists worker_profiles_set_updated_at on public.worker_profiles;
create trigger worker_profiles_set_updated_at
  before update on public.worker_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. hire_requests
-- ---------------------------------------------------------------------------
create table if not exists public.hire_requests (
  id             uuid primary key default gen_random_uuid(),
  employer_id    uuid not null references public.users (id) on delete cascade,
  worker_id      uuid not null references public.worker_profiles (id) on delete cascade,
  description    text not null,
  location       text not null,
  proposed_rate  integer not null,
  status         text not null default 'pending',
  scheduled_date timestamptz,
  completed_at   timestamptz,
  phone_revealed boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint hire_requests_description check (char_length(description) between 10 and 1000),
  constraint hire_requests_location    check (char_length(location) between 3 and 200),
  constraint hire_requests_rate        check (proposed_rate > 0),
  constraint hire_requests_status      check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled'))
);

create index if not exists hire_requests_employer_idx on public.hire_requests (employer_id, status);
create index if not exists hire_requests_worker_idx   on public.hire_requests (worker_id, status);
create index if not exists hire_requests_status_idx   on public.hire_requests (status, created_at desc);
create index if not exists hire_requests_created_idx  on public.hire_requests (created_at desc);

drop trigger if exists hire_requests_set_updated_at on public.hire_requests;
create trigger hire_requests_set_updated_at
  before update on public.hire_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. reviews  (exactly one review per completed hire request)
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  hire_request_id uuid not null unique references public.hire_requests (id) on delete cascade,
  reviewer_id     uuid not null references public.users (id) on delete cascade,
  worker_id       uuid not null references public.worker_profiles (id) on delete cascade,
  rating          integer not null,
  comment         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint reviews_rating  check (rating between 1 and 5),
  constraint reviews_comment check (comment is null or char_length(comment) <= 500)
);

create index if not exists reviews_worker_idx   on public.reviews (worker_id, created_at desc);
create index if not exists reviews_reviewer_idx on public.reviews (reviewer_id);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.users (id) on delete cascade,
  reported_user_id uuid not null references public.users (id) on delete cascade,
  reason           text not null,
  description      text,
  status           text not null default 'pending',
  admin_notes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint reports_reason      check (reason in ('fake_profile', 'bad_behavior', 'spam', 'harassment', 'other')),
  constraint reports_status      check (status in ('pending', 'reviewed', 'resolved')),
  constraint reports_description check (description is null or char_length(description) <= 500),
  constraint reports_notes       check (admin_notes is null or char_length(admin_notes) <= 500)
);

create index if not exists reports_reported_idx on public.reports (reported_user_id, status);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_status_idx   on public.reports (status, created_at desc);

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Keep worker_profiles.rating_average / rating_count in sync with reviews
--    (replaces the old Mongoose `post('save')` rating hook)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_worker_rating(p_worker_id uuid)
returns void
language plpgsql
as $$
begin
  update public.worker_profiles as wp
     set rating_average = coalesce(s.avg_rating, 0),
         rating_count   = coalesce(s.total, 0)
    from (
      select round(avg(rating)::numeric, 2) as avg_rating,
             count(*)::int                  as total
        from public.reviews
       where worker_id = p_worker_id
    ) as s
   where wp.id = p_worker_id;
end;
$$;

create or replace function public.on_review_change()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.refresh_worker_rating(old.worker_id);
  else
    perform public.refresh_worker_rating(new.worker_id);
    if (tg_op = 'UPDATE' and old.worker_id <> new.worker_id) then
      perform public.refresh_worker_rating(old.worker_id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.on_review_change();

-- ---------------------------------------------------------------------------
-- 8. RPC: increment_worker_completed_jobs
--    Atomic "+1 completed job + mark available" (used when a hire completes).
-- ---------------------------------------------------------------------------
create or replace function public.increment_worker_completed_jobs(p_worker_id uuid)
returns void
language sql
as $$
  update public.worker_profiles
     set completed_jobs = completed_jobs + 1,
         availability   = 'available',
         updated_at     = now()
   where id = p_worker_id;
$$;

-- ---------------------------------------------------------------------------
-- 9. RPC: search_workers
--    Replaces the old Mongoose `searchWorkers()` (including the 2dsphere geo
--    query) with a single haversine-based SQL query. No PostGIS required.
-- ---------------------------------------------------------------------------
create or replace function public.search_workers(
  p_skills       text[]  default null,
  p_area         text    default null,
  p_min_rating   numeric default null,
  p_max_rate     integer default null,
  p_lat          double precision default null,
  p_lng          double precision default null,
  p_max_distance double precision default null,  -- kilometres
  p_limit        integer default 20,
  p_offset       integer default 0
)
returns table (
  id             uuid,
  user_id        uuid,
  skills         text[],
  experience     integer,
  description    text,
  hourly_rate    integer,
  availability   text,
  portfolio      text[],
  rating_average numeric,
  rating_count   integer,
  completed_jobs integer,
  service_areas  text[],
  lat            double precision,
  lng            double precision,
  is_approved    boolean,
  admin_notes    text,
  created_at     timestamptz,
  updated_at     timestamptz,
  user_name      text,
  user_avatar    text,
  user_area      text,
  user_city      text,
  distance_km    double precision,
  total_count    bigint
)
language sql
stable
as $$
  with base as (
    select
      wp.*,
      u.name          as user_name,
      u.avatar        as user_avatar,
      u.location_area as user_area,
      u.location_city as user_city,
      case
        when p_lat is not null and p_lng is not null
         and wp.lat is not null and wp.lng is not null then
          6371 * 2 * asin(least(1, sqrt(
            power(sin(radians(wp.lat - p_lat) / 2), 2) +
            cos(radians(p_lat)) * cos(radians(wp.lat)) *
            power(sin(radians(wp.lng - p_lng) / 2), 2)
          )))
        else null
      end as distance_km
    from public.worker_profiles wp
    join public.users u on u.id = wp.user_id
    where wp.is_approved = true
      and wp.availability = 'available'
      and u.is_active = true
      and (p_skills     is null or wp.skills && p_skills)
      and (p_area       is null or wp.service_areas @> array[p_area])
      and (p_min_rating is null or wp.rating_average >= p_min_rating)
      and (p_max_rate   is null or wp.hourly_rate <= p_max_rate)
  ),
  filtered as (
    select *
      from base
     where p_max_distance is null
        or (distance_km is not null and distance_km <= p_max_distance)
  )
  select
    f.id, f.user_id, f.skills, f.experience, f.description, f.hourly_rate,
    f.availability, f.portfolio, f.rating_average, f.rating_count,
    f.completed_jobs, f.service_areas, f.lat, f.lng, f.is_approved,
    f.admin_notes, f.created_at, f.updated_at,
    f.user_name, f.user_avatar, f.user_area, f.user_city,
    f.distance_km,
    count(*) over () as total_count
  from filtered f
  order by
    case when p_max_distance is not null then f.distance_km end asc nulls last,
    f.rating_average desc,
    f.completed_jobs desc,
    f.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- 10. RPC: get_area_stats
--     Aggregate stats for the /area/[slug] SEO pages (avg rating / rate).
-- ---------------------------------------------------------------------------
create or replace function public.get_area_stats(p_area text)
returns table (total_workers bigint, avg_rating numeric, avg_rate numeric)
language sql
stable
as $$
  select
    count(*)::bigint                           as total_workers,
    round(coalesce(avg(rating_average), 0), 1) as avg_rating,
    round(coalesce(avg(hourly_rate), 0))       as avg_rate
  from public.worker_profiles
  where is_approved = true
    and service_areas @> array[p_area];
$$;

-- ---------------------------------------------------------------------------
-- 11. Row Level Security
--     Auth is handled by Firebase (NOT Supabase Auth) and every DB call from
--     Next.js goes through the `service_role` key, which bypasses RLS.
--     We still lock the tables down so the public `anon` key cannot read or
--     write anything (worker phone numbers must stay private).
-- ---------------------------------------------------------------------------
alter table public.users           enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.hire_requests   enable row level security;
alter table public.reviews         enable row level security;
alter table public.reports         enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['users', 'worker_profiles', 'hire_requests', 'reviews', 'reports']
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_deny_client_access', tbl);
    execute format(
      'create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      tbl || '_deny_client_access', tbl
    );
  end loop;
end;
$$;
