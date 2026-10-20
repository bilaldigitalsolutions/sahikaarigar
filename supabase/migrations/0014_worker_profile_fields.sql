-- ============================================================================
-- SahiKaarigar - Worker profile fields used by the app
-- Migration: 0014_worker_profile_fields.sql
--
-- The server already WRITES these columns (upsertWorkerProfile), but they were
-- never captured in a migration file — new databases would break on the
-- register-worker flow. This migration is idempotent: on a database where the
-- columns already exist it is a no-op.
-- ============================================================================

alter table public.worker_profiles
  add column if not exists aadhaar_number text,
  add column if not exists verification_status text default 'pending',
  add column if not exists aadhaar_photo_path text;

comment on column public.worker_profiles.aadhaar_number is
  '12-digit Aadhaar (UIDAI Verhoeff-validated). Locked once submitted.';
comment on column public.worker_profiles.verification_status is
  'Admin review state: pending | approved | rejected.';
comment on column public.worker_profiles.aadhaar_photo_path is
  'Storage path of the Aadhaar document in the private aadhaar-documents bucket.';
