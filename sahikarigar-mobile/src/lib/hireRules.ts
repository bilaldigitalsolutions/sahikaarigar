// =============================================================================
// Hire interaction rules — one source of truth for the detail screen.
// =============================================================================
// Business rules:
//   * Calls are allowed only while the worker is on the way / has arrived.
//     Once work starts (in_progress) or the booking is closed, calls stop.
//   * Cancelling is allowed until work starts. Once the OTP has been verified
//     (in_progress) neither side can cancel.
// =============================================================================

import type { HireStatus } from '@/types';

/** Call is ACTIVE only for these statuses. */
export const CALL_ACTIVE_STATUSES: readonly HireStatus[] = ['accepted', 'en_route', 'arrived'];

/** Cancel is ACTIVE only for these statuses. */
export const CANCEL_ACTIVE_STATUSES: readonly HireStatus[] = [
  'pending',
  'accepted',
  'en_route',
  'arrived',
];

/** Once the job starts, communication/cancel actions are locked. */
export const INTERACTION_LOCKED_STATUSES: readonly HireStatus[] = [
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
];

const CALL_ACTIVE = new Set<HireStatus>(CALL_ACTIVE_STATUSES);
const CANCEL_ACTIVE = new Set<HireStatus>(CANCEL_ACTIVE_STATUSES);
const INTERACTION_LOCKED = new Set<HireStatus>(INTERACTION_LOCKED_STATUSES);

export function canCall(status: HireStatus | null | undefined): boolean {
  return status != null && CALL_ACTIVE.has(status);
}

export function canCancel(status: HireStatus | null | undefined): boolean {
  return status != null && CANCEL_ACTIVE.has(status);
}

/** True when the call/cancel controls must be disabled. */
export function areInteractionsLocked(status: HireStatus | null | undefined): boolean {
  return status == null || INTERACTION_LOCKED.has(status);
}
