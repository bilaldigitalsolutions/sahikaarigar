-- Admin review status and private Aadhaar document storage.
alter table public.worker_profiles
  add column if not exists verification_status text not null default 'pending',
  add column if not exists aadhaar_photo_path text,
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid references public.users(id),
  add column if not exists reviewed_at timestamptz;

update public.worker_profiles
   set verification_status = 'approved'
 where is_approved and verification_status = 'pending';

alter table public.worker_profiles
  drop constraint if exists worker_profiles_verification_status;

alter table public.worker_profiles
  add constraint worker_profiles_verification_status
  check (verification_status in ('pending', 'approved', 'rejected'));

create index if not exists worker_profiles_verification_idx
  on public.worker_profiles (verification_status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aadhaar-documents',
  'aadhaar-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
