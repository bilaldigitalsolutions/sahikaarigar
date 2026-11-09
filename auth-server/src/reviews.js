// =============================================================================
// SahiKaarigar auth-server — reviews + platform feedback
// =============================================================================
// `reviews`  = the user rates the WORKER (one per completed hire request; the
//              rating_average / rating_count columns are kept in sync by a DB
//              trigger, so we never compute them here).
// `customer_reviews` = the worker rates the CUSTOMER (one per completed hire).
//              users.customer_rating_average / customer_rating_count are kept
//              in sync by the 0022 trigger and refreshed explicitly below.
// `platform_feedback` = the user rates SahiKaarigar ITSELF.
// =============================================================================

import { db } from './users.js';

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar ?? null,
  };
}

export function mapReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    hireRequestId: row.hire_request_id,
    reviewerId: row.reviewer_id,
    workerId: row.worker_id,
    rating: row.rating,
    comment: row.comment ?? null,
    tip: row.tip ?? 0,
    likes: row.likes ?? [],
    createdAt: row.created_at,
    reviewer: mapUser(row.reviewer),
  };
}

/** Worker -> customer feedback row. */
export function mapCustomerReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    hireRequestId: row.hire_request_id,
    reviewerId: row.reviewer_id,
    customerId: row.customer_id,
    rating: row.rating,
    comment: row.comment ?? null,
    createdAt: row.created_at,
    reviewer: mapUser(row.reviewer),
  };
}

function readRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating 1 se 5 ke beech do');
  }
  return rating;
}

/** PostgREST reports missing columns as 42703 or PGRST204, with a message like
 *  "column reviews.tip does not exist". Keep this check in one place so the
 *  optional review extras can never make the whole feedback fail on an older
 *  deployment that has not applied 0012 yet. */
function isMissingReviewExtras(error) {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return /column .*\.(tip|likes).*does not exist/i.test(error.message || '');
}

/** `customer_reviews` table has not been created yet (migration 0021). */
function isMissingCustomerReviews(error) {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /customer_reviews.*does not exist/i.test(error.message || '') ||
    /Could not find the table.*customer_reviews/i.test(error.message || '')
  );
}

/**
 * Recalculate users.customer_rating_average / customer_rating_count from the
 * customer_reviews rows. 0022_customer_rating.sql defines this function and
 * also calls it from a trigger; the explicit call keeps the aggregate fresh
 * even on a deployment where the trigger has not been installed yet.
 *
 * The shared `db` client is created with SUPABASE_SERVICE_ROLE_KEY in
 * users.js, and 0022 grants EXECUTE only to service_role. Never move this call
 * to an anon/authenticated client — it would fail with a permission error.
 */
async function refreshCustomerRating(customerId) {
  const { error } = await db.rpc('refresh_customer_rating', {
    p_customer_id: customerId,
  });
  if (error) throw new Error(error.message);
}

/** The user reviews the worker after the job is completed.
 *  `tip` (rupees, record-only — payment happens offline) and `likes`
 *  (FEEDBACK_LIKES labels) are saved with the review — columns added by
 *  0012_review_feedback_extras.sql. */
export async function createReview({ reviewerId, hireRequestId, rating, comment, tip, likes }) {
  const value = readRating(rating);
  const text = typeof comment === 'string' ? comment.trim().slice(0, 500) : '';
  const tipAmount = Math.max(0, Math.round(Number.isFinite(Number(tip)) ? Number(tip) : 0));
  const likeList = (Array.isArray(likes) ? likes : [])
    .filter((label) => typeof label === 'string' && label.trim().length > 0)
    .map((label) => label.trim().slice(0, 120))
    .slice(0, 12);

  const { data: hire, error: hireError } = await db
    .from('hire_requests')
    .select('id, employer_id, worker_id, status, workerProfile:worker_profiles(user_id)')
    .eq('id', hireRequestId)
    .maybeSingle();

  if (hireError) throw new Error(hireError.message);
  if (!hire) throw new Error('Hire request nahi mila');
  if (hire.status !== 'completed') throw new Error('Pehle kaam complete hona chahiye');
  if (hire.employer_id !== reviewerId) throw new Error('Sirf user hi review de sakta hai');

  // Self-review guard: the hire's employer account and the kaarigar's account
  // must never be the SAME person — e.g. someone booked their own worker
  // profile to farm 5-star ratings for themselves.
  const workerUserId = hire.workerProfile?.user_id ?? null;
  if (workerUserId && workerUserId === hire.employer_id) {
    throw new Error('You cannot review yourself.');
  }

  const { data: existing, error: existingError } = await db
    .from('reviews')
    .select('id')
    .eq('hire_request_id', hireRequestId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) throw new Error('Is kaam ka review pehle hi de diya hai');

  const reviewRow = {
    hire_request_id: hireRequestId,
    reviewer_id: reviewerId,
    worker_id: hire.worker_id,
    rating: value,
    comment: text || null,
  };

  const insertReview = (withExtras) =>
    db
      .from('reviews')
      .insert(
        withExtras
          ? { ...reviewRow, tip: tipAmount, likes: likeList.length ? likeList : null }
          : reviewRow,
      )
      .select('*, reviewer:users(id, name, avatar)')
      .single();

  let { data, error } = await insertReview(true);

  // Feedback must still save when an older deployment has not applied 0012.
  // Log loudly, retry without the two optional columns, and keep the review.
  if (error && isMissingReviewExtras(error)) {
    console.warn(
      '[reviews] tip/likes columns missing; retrying without extras (run 0012_review_feedback_extras.sql): %s',
      error.message,
    );
    ({ data, error } = await insertReview(false));
  }

  if (error) {
    console.error(
      '[reviews] insert failed for hire %s: code=%s message=%s details=%s hint=%s',
      hireRequestId,
      error.code,
      error.message,
      error.details,
      error.hint,
    );
    if (error.code === '23505') {
      throw new Error('Is kaam ka review pehle hi de diya hai');
    }
    if (isMissingReviewExtras(error)) {
      throw new Error(
        'Tip/likes save nahi ho paaye — Supabase me 0012_review_feedback_extras.sql migration chalao',
      );
    }
    throw new Error(error.message);
  }

  if (!data) throw new Error('Review save nahi hua');
  console.log('[reviews] created review %s for hire %s', data.id, hireRequestId);

  // Mark hire as fully rated if both sides have now submitted.
  await markFeedbackComplete(hireRequestId);

  return mapReview(data);
}

/**
 * After either side submits a review, check whether BOTH reviews now exist
 * (customer->worker in `reviews`, worker->customer in `customer_reviews`).
 * If so, set feedback_complete = true on the hire row so the admin panel can
 * see which completed hires still have pending feedback.
 */
async function markFeedbackComplete(hireRequestId) {
  try {
    const [reviewRes, customerReviewRes] = await Promise.all([
      db.from('reviews').select('id').eq('hire_request_id', hireRequestId).maybeSingle(),
      db.from('customer_reviews').select('id').eq('hire_request_id', hireRequestId).maybeSingle(),
    ]);

    const bothExist = Boolean(reviewRes.data && customerReviewRes.data);
    if (!bothExist) return;

    const { error } = await db
      .from('hire_requests')
      .update({ feedback_complete: true })
      .eq('id', hireRequestId);
    if (error) {
      console.warn(
        `[reviews] could not set feedback_complete for hire ${hireRequestId}: ${error.message}`,
      );
    }
  } catch (error) {
    // Never let feedback-complete tracking break a successful review submission.
    console.warn(
      `[reviews] feedback-complete check failed for hire ${hireRequestId}: ${error.message}`,
    );
  }
}

/**
 * The worker rates the CUSTOMER after the job is completed. One review per
 * hire request; stored in `customer_reviews` (0021_worker_feedback.sql) so the
 * customer -> worker `reviews` table keeps its existing one-row-per-hire
 * constraint.
 */
export async function createCustomerReview({ reviewerId, hireRequestId, rating, comment }) {
  const value = readRating(rating);
  const text = typeof comment === 'string' ? comment.trim().slice(0, 500) : '';

  const { data: hire, error: hireError } = await db
    .from('hire_requests')
    .select('id, employer_id, worker_id, status, workerProfile:worker_profiles(user_id)')
    .eq('id', hireRequestId)
    .maybeSingle();

  if (hireError) throw new Error(hireError.message);
  if (!hire) throw new Error('Hire request nahi mila');
  if (hire.status !== 'completed') throw new Error('Pehle kaam complete hona chahiye');

  const workerUserId = hire.workerProfile?.user_id ?? null;
  if (!workerUserId || workerUserId !== reviewerId) {
    throw new Error('Sirf kaarigar hi customer ko feedback de sakta hai');
  }
  if (workerUserId === hire.employer_id) {
    throw new Error('You cannot review yourself.');
  }

  const { data: existing, error: existingError } = await db
    .from('customer_reviews')
    .select('id')
    .eq('hire_request_id', hireRequestId)
    .maybeSingle();

  if (existingError) {
    if (isMissingCustomerReviews(existingError)) {
      throw new Error(
        'Customer feedback abhi database me support nahi hai — Supabase me 0021_worker_feedback.sql migration chalao',
      );
    }
    throw new Error(existingError.message);
  }
  if (existing) throw new Error('Is kaam ka customer feedback pehle hi de diya hai');

  const { data, error } = await db
    .from('customer_reviews')
    .insert({
      hire_request_id: hireRequestId,
      reviewer_id: reviewerId,
      customer_id: hire.employer_id,
      rating: value,
      comment: text || null,
    })
    // Two FKs point at users (reviewer_id + customer_id); pin the reviewer one
    // so PostgREST's embedded-resource lookup is unambiguous.
    .select('*, reviewer:users!reviewer_id(id, name, avatar)')
    .single();

  if (error) {
    console.error(
      '[reviews] customer review insert failed for hire %s: code=%s message=%s',
      hireRequestId,
      error.code,
      error.message,
    );
    if (error.code === '23505') {
      throw new Error('Is kaam ka customer feedback pehle hi de diya hai');
    }
    if (isMissingCustomerReviews(error)) {
      throw new Error(
        'Customer feedback abhi database me support nahi hai — Supabase me 0021_worker_feedback.sql migration chalao',
      );
    }
    throw new Error(error.message);
  }

  if (!data) throw new Error('Customer feedback save nahi hua');

  // The review is already saved. A missing 0022 migration or a transient
  // aggregate failure must not tell the worker the feedback failed — the next
  // review / migration backfill will repair the denormalised value.
  try {
    await refreshCustomerRating(hire.employer_id);
  } catch (ratingError) {
    console.warn(
      '[reviews] customer review %s saved but rating refresh failed ' +
        '(run 0022_customer_rating.sql if the columns/function are missing): %s',
      data.id,
      ratingError.message,
    );
  }

  console.log('[reviews] created customer review %s for hire %s', data.id, hireRequestId);

  // Mark hire as fully rated if both sides have now submitted.
  await markFeedbackComplete(hireRequestId);

  return mapCustomerReview(data);
}

/** The worker's feedback on the customer for a hire (null when not submitted). */
export async function getCustomerReviewByHireRequest(hireRequestId) {
  const { data, error } = await db
    .from('customer_reviews')
    .select('*, reviewer:users!reviewer_id(id, name, avatar)')
    .eq('hire_request_id', hireRequestId)
    .maybeSingle();

  if (error) {
    // The app must keep working while the 0021 migration is rolling out.
    if (isMissingCustomerReviews(error)) {
      console.warn(
        '[reviews] customer_reviews table missing; run 0021_worker_feedback.sql: %s',
        error.message,
      );
      return null;
    }
    throw new Error(error.message);
  }
  return mapCustomerReview(data);
}

/** The user rates the platform itself (independent of the worker review). */
export async function createPlatformFeedback({ userId, hireRequestId, rating, comment }) {
  const value = readRating(rating);
  const text = typeof comment === 'string' ? comment.trim().slice(0, 1000) : '';

  const { data, error } = await db
    .from('platform_feedback')
    .insert({
      user_id: userId,
      hire_request_id: hireRequestId || null,
      rating: value,
      comment: text || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return {
    id: data.id,
    rating: data.rating,
    comment: data.comment ?? null,
    createdAt: data.created_at,
  };
}

/** Public list of a worker's reviews. */
export async function listReviewsByWorker(workerId, page = 1, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const from = (safePage - 1) * safeLimit;

  const { data, error, count } = await db
    .from('reviews')
    .select('*, reviewer:users(id, name, avatar)', { count: 'exact' })
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })
    .range(from, from + safeLimit - 1);

  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    reviews: (data ?? []).map(mapReview),
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
}

/** The review attached to a hire request (null when not reviewed yet). */
export async function getReviewByHireRequest(hireRequestId) {
  const { data, error } = await db
    .from('reviews')
    .select('*, reviewer:users(id, name, avatar)')
    .eq('hire_request_id', hireRequestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapReview(data);
}
