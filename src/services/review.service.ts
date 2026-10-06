import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { mapReview, mapReviewWithDetails } from '@/lib/mappers';
import type { Review, ReviewCreateInput, ReviewWithReviewer } from '@/types';

/**
 * Create a review for a completed hire request.
 *
 * `worker_profiles.rating_average` / `rating_count` are recalculated by the
 * `reviews_refresh_rating` trigger (see supabase/migrations/0001_init_schema.sql).
 */
export async function createReview(
  reviewerId: string,
  reviewData: ReviewCreateInput
): Promise<Review> {
  const supabase = getSupabaseAdmin();

  const { data: hireRequest, error: hireError } = await supabase
    .from('hire_requests')
    .select('id, employer_id, worker_id, status')
    .eq('id', reviewData.hireRequestId)
    .maybeSingle();

  if (hireError) throw new Error(hireError.message);
  if (!hireRequest) throw new Error('Hire request not found');
  if (hireRequest.status !== 'completed') throw new Error('Hire request is not completed');
  if (hireRequest.employer_id !== reviewerId) throw new Error('Unauthorized');

  const { data: existing, error: existingError } = await supabase
    .from('reviews')
    .select('id')
    .eq('hire_request_id', reviewData.hireRequestId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) throw new Error('Review already exists for this hire request');

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      hire_request_id: reviewData.hireRequestId,
      reviewer_id: reviewerId,
      worker_id: hireRequest.worker_id,
      rating: reviewData.rating,
      comment: reviewData.comment ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapReview(data);
}

/**
 * Get reviews for a worker (public)
 */
export async function getReviewsByWorker(workerId: string, page: number = 1, limit: number = 20) {
  const from = (page - 1) * limit;

  const { data, error, count } = await getSupabaseAdmin()
    .from('reviews')
    .select('*, reviewer:users(id, name, avatar)', { count: 'exact' })
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    reviews: (data ?? []).map(mapReviewWithDetails),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/**
 * Get the review attached to a hire request
 */
export async function getReviewByHireRequest(
  hireRequestId: string
): Promise<ReviewWithReviewer | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('reviews')
    .select('*, reviewer:users(id, name, avatar)')
    .eq('hire_request_id', hireRequestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapReviewWithDetails(data) : null;
}

/**
 * Get reviews written by a reviewer
 */
export async function getReviewsByReviewer(
  reviewerId: string,
  page: number = 1,
  limit: number = 20
) {
  const from = (page - 1) * limit;

  const { data, error, count } = await getSupabaseAdmin()
    .from('reviews')
    .select(
      '*, worker:worker_profiles(id, user_id, skills, hourly_rate, rating_average, rating_count, user:users(id, name, avatar))',
      { count: 'exact' }
    )
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    reviews: (data ?? []).map(mapReviewWithDetails),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/**
 * Get the average rating of a worker.
 * Reads the trigger-maintained columns on `worker_profiles` (no aggregation
 * query required).
 */
export async function getWorkerAverageRating(workerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('worker_profiles')
    .select('rating_average, rating_count')
    .eq('id', workerId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    averageRating: data ? Number(data.rating_average) : 0,
    totalReviews: data ? Number(data.rating_count) : 0,
  };
}
