-- Aadhaar number collected at worker registration (optional for old rows).
-- Stored as 12 digits; the admin panel masks it by default and only exposes it
-- to authenticated admins.
alter table public.worker_profiles
  add column if not exists aadhaar_number text;

alter table public.worker_profiles
  drop constraint if exists worker_profiles_aadhaar_number_format;

alter table public.worker_profiles
  add constraint worker_profiles_aadhaar_number_format
  check (aadhaar_number is null or aadhaar_number ~ '^[0-9]{12}$');

comment on column public.worker_profiles.aadhaar_number is
  'Optional 12-digit Aadhaar number. Private: never exposed on public worker endpoints.';
