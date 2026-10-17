create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete cascade,
  reported_id uuid references public.users(id) on delete cascade,
  reason text not null,
  description text,
  status text default 'pending' check (status in ('pending','reviewed','resolved','dismissed')),
  created_at timestamptz default now()
);

create index if not exists user_reports_status_idx on public.user_reports(status, created_at desc);