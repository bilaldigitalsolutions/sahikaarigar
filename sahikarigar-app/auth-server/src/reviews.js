// =============================================================================
// SahiKaarigar auth-server — reviews + platform feedback
// =============================================================================
// `reviews`  = the user rates the WORKER (one per completed hire request; the
//              rating_average / rating_count columns are kept in sync by a DB
//              trigger, so we never compute them here).
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

function readRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating 1 se 5 ke beech do');
  }
  return rating;
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

  const { data, error } = await db
    .from('reviews')
    .insert({
      hire_request_id: hireRequestId,
      reviewer_id: reviewerId,
      worker_id: hire.worker_id,
      rating: value,
      comment: text || null,
      tip: tipAmount,
      likes: likeList.length ? likeList : null,
    })
    .select('*, reviewer:users(id, name, avatar)')
    .single();

  if (error) {
    // The tip/likes columns are new — 0012_review_feedback_extras.sql not applied yet.
    if (error.code === 'PGRST204' || /'(tip|likes)' column/i.test(error.message)) {
      throw new Error(
        'Tip/likes save nahi ho paaye — Supabase me 0012_review_feedback_extras.sql migration chalao',
      );
    }
    throw new Error(error.message);
  }
  return mapReview(data);
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
