-- =============================================================================
-- 0006 — push notification tokens
-- =============================================================================
-- The mobile app registers an Expo push token after login and the auth-server
-- stores it here, so hire status changes (accept / en_route / arrived /
-- complete) can ping the other party through the free Expo Push API.
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.users
  add column if not exists push_token text;

comment on column public.users.push_token is
  'Expo push token of the user''s primary device (null when notifications are denied).';
