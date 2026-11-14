-- 0027: race-safe hire state machine.
--
-- Turns two check-then-act races into hard database rules:
--
--   1) A worker can hold at most ONE active job (accepted / en_route /
--      arrived / in_progress). Previously two concurrent "accept" taps on
--      different devices could land two active jobs (the app-level check
--      reads a stale row). The server now also maps the resulting 23505 to a
--      friendly "complete your current job first" error.
--
--   2) One employer-worker pair can have at most ONE live request (pending /
--      accepted / en_route / arrived). Previously two simultaneous "Hire"
--      taps could create duplicate pending requests. The server maps the
--      resulting 23505 to the same "request already running" message the
--      pre-check used to produce.
--
-- Applied with IF NOT EXISTS, but if production rows ALREADY violate a rule
-- the CREATE will fail. Check first:
--
--   select worker_id, count(*) from hire_requests
--     where status in ('accepted','en_route','arrived','in_progress')
--     group by worker_id having count(*) > 1;
--   select employer_id, worker_id, count(*) from hire_requests
--     where status in ('pending','accepted','en_route','arrived')
--     group by employer_id, worker_id having count(*) > 1;
--
-- (Close the extras by force-cancelling them in the admin panel before
-- creating the indexes.)

create unique index if not exists hire_requests_one_active_per_worker
  on public.hire_requests (worker_id)
  where status in ('accepted', 'en_route', 'arrived', 'in_progress');

create unique index if not exists hire_requests_one_live_per_pair
  on public.hire_requests (employer_id, worker_id)
  where status in ('pending', 'accepted', 'en_route', 'arrived');
