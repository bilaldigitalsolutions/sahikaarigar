-- ============================================================================
-- SahiKaarigar - Admin review columns (schema drift fix)
-- Migration: 0015_admin_review_columns.sql
--
-- WHY THIS EXISTS
-- The server already WRITES these columns (setWorkerApproval in admin.js), but
-- the ROOT migration set (supabase/migrations, the one run by
-- scripts/run-migrations.mjs) never captured them. They only existed in
-- sahikarigar-app/supabase/migrations/0007_admin_review.sql, which the root
-- runner does not read.
--
-- Result: approving/rejecting a worker failed with
--   column worker_profiles.rejection_reason does not exist
-- exactly like the users.is_flagged error did.
--
-- ADDITIVE ONLY and idempotent: safe to re-run on any database.
-- ============================================================================

-- 1. Columns written by setWorkerApproval().
alter table public.worker_profiles
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid references public.users(id),
  add column if not exists reviewed_at timestamptz;

-- 2. Backfill the verification status for rows approved before the column was
--    introduced (same logic as 0007_admin_review.sql).
update public.worker_profiles
   set verification_status = 'approved'
 where is_approved and verification_status = 'pending';

-- 3. Enforce the allowed verification states.
alter table public.worker_profiles
  drop constraint if exists worker_profiles_verification_status;

alter table public.worker_profiles
  add constraint worker_profiles_verification_status
  check (verification_status in ('pending', 'approved', 'rejected'));

-- 4. Index for the admin "pending verification" queue.
create index if not exists worker_profiles_verification_idx
  on public.worker_profiles (verification_status, created_at desc);

-- 5. Private storage bucket for Aadhaar documents (idempotent).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aadhaar-documents',
  'aadhaar-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

comment on column public.worker_profiles.rejection_reason is
  'Reason shown to the worker when an admin rejects verification.';
comment on column public.worker_profiles.reviewed_at is
  'When an admin last approved/rejected this worker.';
comment on column public.worker_profiles.reviewed_by is
  'Admin user id that last reviewed this worker profile.';
