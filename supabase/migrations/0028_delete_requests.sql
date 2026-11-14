-- 0028: persisted account-deletion web requests (Play policy).
--
-- The web form (sahikaarigar.vercel.app/delete-account) used to only EMAIL the
-- admin — sendEmail swallows failures and ADMIN_EMAIL can be unset, so a
-- request could vanish while the user is told "7 days". Every request is now
-- persisted FIRST, before the 200 response; the email outcome is recorded on
-- the row afterwards so a failed email is still visible in the admin panel /
-- Supabase and can be re-sent.
--
-- RLS stays enabled with no policies: only the service-role key (the auth
-- server) may read or write this table — never a client's anon key.

create table if not exists public.delete_requests (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  reason text,
  email_sent boolean not null default false,
  email_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists delete_requests_phone_idx on public.delete_requests (phone);
create index if not exists delete_requests_unprocessed_idx
  on public.delete_requests (created_at) where processed_at is null;

alter table public.delete_requests enable row level security;
