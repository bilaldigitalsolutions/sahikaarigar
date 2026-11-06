-- ============================================================================
-- SahiKaarigar - Customer ratings (worker -> customer feedback)
-- Migration: 0022_customer_rating.sql
--
-- `customer_reviews` (0021_worker_feedback.sql) already stores the worker's
-- rating of the customer. This migration adds the denormalised aggregate to
-- `users` so every hire/detail response can show the customer's trust score
-- without a second query:
--
--   users.customer_rating_average numeric(3,2) 0..5
--   users.customer_rating_count   integer      >= 0
--
-- A trigger keeps the aggregate in sync for inserts, edits and deletes. The
-- auth-server also calls refresh_customer_rating() after a review is submitted
-- so the new value is visible immediately.
--
-- ADDITIVE ONLY. Safe to re-run. Run 0021_worker_feedback.sql first.
-- ============================================================================

alter table public.users
  add column if not exists customer_rating_average numeric(3, 2) not null default 0;

alter table public.users
  add column if not exists customer_rating_count integer not null default 0;

alter table public.users
  drop constraint if exists users_customer_rating_average_check;
alter table public.users
  add constraint users_customer_rating_average_check
  check (customer_rating_average between 0 and 5);

alter table public.users
  drop constraint if exists users_customer_rating_count_check;
alter table public.users
  add constraint users_customer_rating_count_check
  check (customer_rating_count >= 0);

comment on column public.users.customer_rating_average is
  'Average rating workers gave this user as a customer (0 when there are no reviews).';
comment on column public.users.customer_rating_count is
  'Number of customer_reviews rows for this user.';

-- ---------------------------------------------------------------------------
-- Keep users.customer_rating_average / customer_rating_count in sync with
-- customer_reviews. Mirrors the worker rating trigger from 0001.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_customer_rating(p_customer_id uuid)
returns void
language plpgsql
as $$
begin
  update public.users as u
     set customer_rating_average = coalesce(s.avg_rating, 0),
         customer_rating_count   = coalesce(s.total, 0)
    from (
      select round(avg(rating)::numeric, 2) as avg_rating,
             count(*)::int                  as total
        from public.customer_reviews
       where customer_id = p_customer_id
    ) as s
   where u.id = p_customer_id;
end;
$$;

create or replace function public.on_customer_review_change()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.refresh_customer_rating(old.customer_id);
  else
    perform public.refresh_customer_rating(new.customer_id);
    if (tg_op = 'UPDATE' and old.customer_id <> new.customer_id) then
      perform public.refresh_customer_rating(old.customer_id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists customer_reviews_refresh_rating on public.customer_reviews;
create trigger customer_reviews_refresh_rating
  after insert or update or delete on public.customer_reviews
  for each row execute function public.on_customer_review_change();

-- ---------------------------------------------------------------------------
-- Backfill from reviews that were submitted before this migration. Only rows
-- whose derived value differs are touched, so re-running is safe.
-- ---------------------------------------------------------------------------
with aggregated as (
  select customer_id,
         round(avg(rating)::numeric, 2) as avg_rating,
         count(*)::int                  as total
    from public.customer_reviews
   group by customer_id
),
expected as (
  select u.id,
         coalesce(a.avg_rating, 0) as avg_rating,
         coalesce(a.total, 0)      as total
    from public.users as u
    left join aggregated as a on a.customer_id = u.id
)
update public.users as u
   set customer_rating_average = e.avg_rating,
       customer_rating_count   = e.total
  from expected as e
 where u.id = e.id
   and (
     u.customer_rating_average is distinct from e.avg_rating
     or u.customer_rating_count is distinct from e.total
   );

-- ---------------------------------------------------------------------------
-- Lock the new functions down like the rest of the schema. The auth-server
-- uses service_role; anon/authenticated get nothing.
-- ---------------------------------------------------------------------------
revoke all on function public.refresh_customer_rating(uuid) from public;
revoke all on function public.on_customer_review_change() from public;

grant execute on function public.refresh_customer_rating(uuid) to service_role;
grant execute on function public.on_customer_review_change() to service_role;
