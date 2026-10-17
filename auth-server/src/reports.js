// =============================================================================
// SahiKaarigar auth-server — user reports (Group 3: Help & User Trust)
// =============================================================================
// Lets any logged-in user report another user for policy violations, fraud,
// harassment, etc. Reports are stored in `user_reports` with status 'pending'
// until an admin reviews them.
// =============================================================================

import { db } from './users.js';

const ALLOWED_REASONS = new Set([
  'spam_or_fake_profile',
  'fraud_or_scam',
  'harassment_or_abuse',
  'inappropriate_content',
  'other',
]);

/** Validate + insert a user report. */
export async function createReport({ reporter_id, reported_id, reason, description }) {
  if (reporter_id === reported_id) {
    throw new Error('Apne aap ko report nahi kar sakte');
  }

  const cleanReason = typeof reason === 'string' ? reason.trim() : '';
  if (!ALLOWED_REASONS.has(cleanReason)) {
    throw new Error('Galat report reason');
  }

  const text =
    typeof description === 'string' ? description.trim().slice(0, 2000) : null;

  const { data, error } = await db
    .from('user_reports')
    .insert({
      reporter_id,
      reported_id,
      reason: cleanReason,
      description: text,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}