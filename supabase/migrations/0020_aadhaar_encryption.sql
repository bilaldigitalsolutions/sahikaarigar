-- ============================================================================
-- SahiKaarigar - Aadhaar at rest is encrypted
-- Migration: 0020_aadhaar_encryption.sql
--
-- The auth-server now encrypts worker Aadhaar numbers with AES-256-GCM before
-- writing them (format: enc:v1:<iv>.<tag>.<ciphertext>). This updates the
-- column comment so future schema readers do not assume plaintext is stored.
-- The application key lives in AADHAAR_ENCRYPTION_KEY, never in the database.
-- ============================================================================

comment on column public.worker_profiles.aadhaar_number is
  'AES-256-GCM ciphertext of the 12-digit Aadhaar (UIDAI Verhoeff-validated). Plaintext must never be stored. Locked once submitted.';
