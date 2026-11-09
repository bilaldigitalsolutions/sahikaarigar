-- =============================================================================
-- SahiKaarigar — Dual Rating SQL Invariant Checks
-- =============================================================================
-- Run each block in Supabase SQL Editor. A block that returns ZERO rows = PASS.
-- A block that returns rows = FAIL (investigate and fix those rows).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Invariant 1: No duplicate customer->worker reviews for the same hire.
--   reviews.hire_request_id is UNIQUE, but double-check in case of drift.
-- -----------------------------------------------------------------------------
SELECT
  'INVARIANT 1 FAIL: duplicate reviews per hire' AS check_name,
  hire_request_id,
  COUNT(*) AS review_count
FROM public.reviews
GROUP BY hire_request_id
HAVING COUNT(*) > 1;

-- -----------------------------------------------------------------------------
-- Invariant 2: No duplicate worker->customer reviews for the same hire.
--   customer_reviews.hire_request_id is UNIQUE, but double-check.
-- -----------------------------------------------------------------------------
SELECT
  'INVARIANT 2 FAIL: duplicate customer_reviews per hire' AS check_name,
  hire_request_id,
  COUNT(*) AS review_count
FROM public.customer_reviews
GROUP BY hire_request_id
HAVING COUNT(*) > 1;

-- -----------------------------------------------------------------------------
-- Invariant 3: worker_profiles.rating_average matches actual AVG from reviews.
-- -----------------------------------------------------------------------------
SELECT
  'INVARIANT 3 FAIL: worker rating_average mismatch' AS check_name,
  wp.id AS worker_profile_id,
  wp.rating_average AS stored_avg,
  COALESCE(round(AVG(r.rating)::numeric, 2), 0) AS actual_avg
FROM public.worker_profiles wp
LEFT JOIN public.reviews r ON r.worker_id = wp.id
GROUP BY wp.id, wp.rating_average
HAVING wp.rating_average IS DISTINCT FROM COALESCE(round(AVG(r.rating)::numeric, 2), 0);

-- -----------------------------------------------------------------------------
-- Invariant 4: worker_profiles.rating_count matches COUNT of reviews.
-- -----------------------------------------------------------------------------
SELECT
  'INVARIANT 4 FAIL: worker rating_count mismatch' AS check_name,
  wp.id AS worker_profile_id,
  wp.rating_count AS stored_count,
  COUNT(r.id) AS actual_count
FROM public.worker_profiles wp
LEFT JOIN public.reviews r ON r.worker_id = wp.id
GROUP BY wp.id, wp.rating_count
HAVING wp.rating_count IS DISTINCT FROM COUNT(r.id);

-- -----------------------------------------------------------------------------
-- Invariant 5: users.customer_rating_average matches actual AVG from customer_reviews.
-- -----------------------------------------------------------------------------
SELECT
  'INVARIANT 5 FAIL: customer rating_average mismatch' AS check_name,
  u.id AS user_id,
  u.customer_rating_average AS stored_avg,
  COALESCE(round(AVG(cr.rating)::numeric, 2), 0) AS actual_avg
FROM public.users u
LEFT JOIN public.customer_reviews cr ON cr.customer_id = u.id
GROUP BY u.id, u.customer_rating_average
HAVING u.customer_rating_average IS DISTINCT FROM COALESCE(round(AVG(cr.rating)::numeric, 2), 0);

-- -----------------------------------------------------------------------------
-- Invariant 6: users.customer_rating_count matches COUNT of customer_reviews.
-- -----------------------------------------------------------------------------
SELECT
  'INVARIANT 6 FAIL: customer rating_count mismatch' AS check_name,
  u.id AS user_id,
  u.customer_rating_count AS stored_count,
  COUNT(cr.id) AS actual_count
FROM public.users u
LEFT JOIN public.customer_reviews cr ON cr.customer_id = u.id
GROUP BY u.id, u.customer_rating_count
HAVING u.customer_rating_count IS DISTINCT FROM COUNT(cr.id);

-- -----------------------------------------------------------------------------
-- Invariant 7: All reviews (customer->worker) are for completed hires only.
-- -----------------------------------------------------------------------------
SELECT
  'INVARIANT 7 FAIL: review for non-completed hire' AS check_name,
  r.id AS review_id,
  r.hire_request_id,
  hr.status AS hire_status
FROM public.reviews r
JOIN public.hire_requests hr ON hr.id = r.hire_request_id
WHERE hr.status <> 'completed';

-- -----------------------------------------------------------------------------
-- Invariant 8: All customer_reviews (worker->customer) are for completed hires only.
-- -----------------------------------------------------------------------------
SELECT
  'INVARIANT 8 FAIL: customer_review for non-completed hire' AS check_name,
  cr.id AS customer_review_id,
  cr.hire_request_id,
  hr.status AS hire_status
FROM public.customer_reviews cr
JOIN public.hire_requests hr ON hr.id = cr.hire_request_id
WHERE hr.status <> 'completed';

-- -----------------------------------------------------------------------------
-- Invariant 9: All rating values are between 1 and 5 (integer).
-- -----------------------------------------------------------------------------
SELECT
  'INVARIANT 9 FAIL: review rating out of range' AS check_name,
  id AS review_id,
  rating
FROM public.reviews
WHERE rating < 1 OR rating > 5 OR rating <> floor(rating)
UNION ALL
SELECT
  'INVARIANT 9 FAIL: customer_review rating out of range' AS check_name,
  id AS customer_review_id,
  rating
FROM public.customer_reviews
WHERE rating < 1 OR rating > 5 OR rating <> floor(rating);

-- -----------------------------------------------------------------------------
-- Invariant 10: Reviewer is one of the two parties to the hire
--   (employer for reviews, worker for customer_reviews).
-- -----------------------------------------------------------------------------
SELECT
  'INVARIANT 10 FAIL: review reviewer not a hire party' AS check_name,
  r.id AS review_id,
  r.reviewer_id,
  hr.employer_id,
  hr.worker_id
FROM public.reviews r
JOIN public.hire_requests hr ON hr.id = r.hire_request_id
WHERE r.reviewer_id NOT IN (hr.employer_id, hr.worker_id)
UNION ALL
SELECT
  'INVARIANT 10 FAIL: customer_review reviewer not a hire party' AS check_name,
  cr.id AS customer_review_id,
  cr.reviewer_id,
  hr.employer_id,
  hr.worker_id
FROM public.customer_reviews cr
JOIN public.hire_requests hr ON hr.id = cr.hire_request_id
WHERE cr.reviewer_id NOT IN (hr.employer_id, hr.worker_id);

-- =============================================================================
-- END OF INVARIANT CHECKS
-- =============================================================================
