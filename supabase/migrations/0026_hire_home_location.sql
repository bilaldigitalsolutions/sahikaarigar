-- 0026: hire_requests.home_location
--
-- The hires code reads and writes `home_location` (the customer's saved home
-- address kept alongside the per-booking `location`) but no earlier migration
-- created the column — production got it through an undocumented manual
-- change. This migration makes any fresh environment reproducible.
--
-- Apply in Supabase SQL editor once; safe to re-run (IF NOT EXISTS).

alter table hire_requests
  add column if not exists home_location text;
