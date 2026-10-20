-- ============================================================================
-- SahiKaarigar - Review extras: tip + likes
-- Migration: 0012_review_feedback_extras.sql
--
-- ADDITIVE ONLY. The feedback screen always collected a tip amount and
-- "What did you like?" ticks, but createReview() silently dropped them —
-- these columns make them real:
--   tip   — rupees the customer tips with the review (0 = no tip).
--           Record-only: payment happens offline (cash / UPI).
--   likes — the FEEDBACK_LIKES labels the customer ticked about the app.
--
-- NOTE: without this migration the server rejects a review submission with a
-- friendly "…0012_review_feedback_extras.sql migration chalao" error.
-- ============================================================================

alter table public.reviews
  add column if not exists tip  integer not null default 0 check (tip >= 0),
  add column if not exists likes text[];

comment on column public.reviews.tip is
  'Tip amount in rupees recorded with the review (record-only; payment happens offline).';
comment on column public.reviews.likes is
  'Labels the customer ticked under "What did you like?" (FEEDBACK_LIKES).';
