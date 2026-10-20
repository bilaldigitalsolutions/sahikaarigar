-- ============================================================================
-- SahiKaarigar - Rate limiting for OTP endpoints
-- Migration: 0013_rate_limits.sql
--
-- Persistent rate limiting for start-OTP attempts so that the limit survives
-- Render redeploys (unlike an in-memory Map). Mirrored in both migration dirs.
-- ============================================================================

create table if not exists public.rate_limits (
  id         uuid primary key default gen_random_uuid(),
  key        text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limits_key_idx   on public.rate_limits (key);
create index if not exists rate_limits_created_at_idx on public.rate_limits (created_at);

comment on table public.rate_limits is
  'Tracks rate-limited attempts for OTP endpoints (start-work OTP, login OTP).';
comment on column public.rate_limits.key is
  'Composite key like "start_otp:<hireId>:<userId>" or "login_otp:<ip>:<phone>".';
comment on column public.rate_limits.created_at is
  'When the attempt was made.';
