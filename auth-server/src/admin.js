// =============================================================================
// SahiKaarigar auth-server — admin operations
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { db, decryptAadhaarNumber } from './users.js';

const ADMIN_SESSION_TTL_SECONDS = 4 * 60 * 60;

/**
 * Name of the HttpOnly cookie that carries the admin session.
 *
 * The token must NOT be readable from JavaScript: an XSS on the admin origin
 * would otherwise hand over a full admin session (localStorage is readable by
 * any script). The cookie is set HttpOnly + Secure + SameSite=Strict by the
 * server and is sent automatically by the browser on every /admin/* fetch
 * (`credentials: 'include'`).
 */
export const ADMIN_SESSION_COOKIE = 'sk_admin_session';
export const ADMIN_SESSION_TTL_MS = ADMIN_SESSION_TTL_SECONDS * 1000;

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function adminSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (Buffer.byteLength(secret) < 32) {
    const error = new Error('ADMIN_SESSION_SECRET must be at least 32 characters');
    error.statusCode = 503;
    throw error;
  }
  return secret;
}

export function verifyAdminCredentials(email, password) {
  const expectedEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const expectedPassword = process.env.ADMIN_PASSWORD || '';
  if (!expectedEmail || !expectedPassword) {
    const error = new Error('Admin login is not configured on the auth server');
    error.statusCode = 503;
    throw error;
  }
  const emailValid = safeEqual(String(email || '').trim().toLowerCase(), expectedEmail);
  const passwordValid = safeEqual(String(password || ''), expectedPassword);
  return emailValid && passwordValid;
}

export function loginAdmin(email, password) {
  if (!verifyAdminCredentials(email, password)) return null;
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    email: String(email).trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  })).toString('base64url');
  const signature = createHmac('sha256', adminSessionSecret()).update(payload).digest('base64url');
  return {
    token: `${payload}.${signature}`,
    admin: { email: String(email).trim().toLowerCase(), role: 'admin' },
    expiresIn: ADMIN_SESSION_TTL_SECONDS,
  };
}

export function getAdminSession(token) {
  if (typeof token !== 'string') return null;
  const raw = token.trim();
  if (!raw) return null;
  const [payload, signature, extra] = raw.split('.');
  if (!payload || !signature || extra) return null;
  let expected;
  try {
    expected = createHmac('sha256', adminSessionSecret()).update(payload).digest('base64url');
  } catch {
    return null;
  }
  if (!safeEqual(signature, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      claims.role !== 'admin' ||
      typeof claims.email !== 'string' ||
      !claims.email ||
      claims.email !== String(process.env.ADMIN_EMAIL || '').trim().toLowerCase() ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { role: 'admin', email: claims.email };
  } catch {
    return null;
  }
}

function mapAdminWorker(row, aadhaarPhotoUrl) {
  return {
    id: row.id,
    userId: row.user_id,
    skills: row.skills ?? [],
    experience: row.experience ?? 0,
    description: row.description ?? null,
    hourlyRate: row.hourly_rate ?? 0,
    availability: row.availability ?? 'available',
    portfolio: row.portfolio ?? [],
    serviceAreas: row.service_areas ?? [],
    ratingAverage: row.rating_average ?? 0,
    ratingCount: row.rating_count ?? 0,
    completedJobs: row.completed_jobs ?? 0,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    isApproved: row.is_approved ?? false,
    verificationStatus: row.verification_status ?? (row.is_approved ? 'approved' : 'pending'),
    adminNotes: row.admin_notes ?? null,
    rejectionReason: row.rejection_reason ?? row.admin_notes ?? null,
    reviewedAt: row.reviewed_at ?? null,
    // Full number is only exposed to authenticated admins, and only after
    // decrypting the at-rest ciphertext.
    aadhaarNumber: decryptAadhaarNumber(row.aadhaar_number),
    aadhaarPhotoUrl,
    // Trust & Penalty — cancel record for the admin panel (record-only).
    cancelCount: row.cancel_count ?? 0,
    isFlagged: row.is_flagged ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          phone: row.user.phone ?? null,
          avatar: row.user.avatar ?? null,
          locationArea: row.user.location_area ?? null,
          locationCity: row.user.location_city ?? null,
          createdAt: row.user.created_at ?? null,
        }
      : null,
  };
}

const ADMIN_WORKER_SELECT =
  '*, user:users!user_id(id, name, phone, avatar, location_area, location_city, created_at)';

/** 5-minute signed URL for the private Aadhaar document. */
async function signedAadhaarUrl(path) {
  if (!path) return null;
  const { data, error } = await db.storage
    .from('aadhaar-documents')
    .createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data?.signedUrl ?? null;
}

/** Workers by review state (newest first), with a short-lived Aadhaar URL. */
export async function listAdminWorkers(status = 'pending', page = 1, limit = 50) {
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    throw new Error('Invalid verification status');
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const from = (safePage - 1) * safeLimit;

  const { data, error, count } = await db
    .from('worker_profiles')
    .select(ADMIN_WORKER_SELECT, { count: 'exact' })
    .eq('verification_status', status)
    .order('created_at', { ascending: false })
    .range(from, from + safeLimit - 1);

  if (error) throw new Error(error.message);
  const workers = await Promise.all(
    (data ?? []).map(async (row) =>
      mapAdminWorker(row, await signedAadhaarUrl(row.aadhaar_photo_path)),
    ),
  );

  return {
    workers,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / safeLimit),
    },
  };
}

/** Single worker with every detail needed for manual verification. */
export async function getAdminWorker(workerId) {
  const { data, error } = await db
    .from('worker_profiles')
    .select(ADMIN_WORKER_SELECT)
    .eq('id', workerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapAdminWorker(data, await signedAadhaarUrl(data.aadhaar_photo_path));
}

/**
 * Approve or reject a worker profile.
 *
 * `reviewedBy` is the email of the admin performing the action (taken from the
 * session payload returned by requireAdmin). The admin is a single
 * env-configured account (ADMIN_EMAIL), NOT a row in `public.users`, so we
 * record the email — `worker_profiles.reviewed_by` is a text column
 * (see 0016_fix_reviewed_by.sql).
 */
export async function setWorkerApproval(workerId, approved, adminNotes, reviewedBy) {
  const reason = typeof adminNotes === 'string' ? adminNotes.trim() : '';
  if (!approved && reason.length < 3) throw new Error('Reject karne ka reason likho');
  if (reason.length > 500) throw new Error('Reason 500 characters se chhota hona chahiye');
  const reviewer =
    typeof reviewedBy === 'string' && reviewedBy.trim() ? reviewedBy.trim().toLowerCase() : null;
  const { data, error } = await db
    .from('worker_profiles')
    .update({
      is_approved: Boolean(approved),
      verification_status: approved ? 'approved' : 'rejected',
      admin_notes: approved ? null : reason,
      rejection_reason: approved ? null : reason,
      reviewed_by: reviewer,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', workerId)
    .select(
      'id, is_approved, verification_status, admin_notes, rejection_reason, reviewed_by, reviewed_at',
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Worker profile nahi mila');
  return {
    id: data.id,
    isApproved: data.is_approved,
    verificationStatus: data.verification_status,
    adminNotes: data.admin_notes ?? null,
    rejectionReason: data.rejection_reason ?? data.admin_notes ?? null,
    reviewedBy: data.reviewed_by ?? null,
    reviewedAt: data.reviewed_at ?? null,
  };
}

export async function getAdminStats() {
  const [users, hires, pending, active] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('hire_requests').select('id', { count: 'exact', head: true }),
    // "Pending verification" = NOT approved and NOT rejected, keyed off
    // `is_approved` so it stays correct even for rows created before
    // `verification_status` existed. Rejected profiles must NOT be counted —
    // they are not awaiting anything.
    db
      .from('worker_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_approved', false)
      .or('verification_status.eq.pending,verification_status.is.null'),
    db.from('worker_profiles').select('id', { count: 'exact', head: true })
      .eq('is_approved', true),
  ]);
  for (const result of [users, hires, pending, active]) {
    if (result.error) throw new Error(result.error.message);
  }
  return {
    totalUsers: users.count ?? 0,
    totalHires: hires.count ?? 0,
    pendingVerifications: pending.count ?? 0,
    activeWorkers: active.count ?? 0,
  };
}

export async function listAdminUsers(role, search = '', page = 1, limit = 50) {
  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
  const filterByRole = ['employer', 'worker'].includes(normalizedRole);
  if (normalizedRole && normalizedRole !== 'all' && !filterByRole) {
    throw new Error('Invalid user role');
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  let query = db.from('users')
    .select('id, name, phone, role, avatar, is_active, is_flagged, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((safePage - 1) * safeLimit, safePage * safeLimit - 1);
  if (filterByRole) query = query.eq('role', normalizedRole);
  const term = String(search).trim().slice(0, 100).replace(/[%_,()."\\]/g, '');
  if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data, error, count } = await query;
  if (error) {
    // A missing trust column is a migration problem, not a user-facing one —
    // say exactly which migration to run instead of leaking the raw PostgREST
    // "column ... does not exist" text to the admin panel.
    if (/is_flagged/i.test(error.message)) {
      throw new Error('Flag column abhi database me nahi hai — 0011_trust_penalty.sql migration chalao');
    }
    throw new Error(error.message);
  }
  return {
    users: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      role: row.role,
      avatar: row.avatar,
      isActive: row.is_active,
      // Red "Flagged" badge input for the admin panel (record-only).
      isFlagged: row.is_flagged ?? false,
      createdAt: row.created_at,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / safeLimit),
    },
  };
}

export async function setUserActive(userId, isActive) {
  const { data, error } = await db.from('users')
    .update({ is_active: Boolean(isActive) })
    .eq('id', userId)
    .in('role', ['employer', 'worker'])
    .select('id, is_active')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('User nahi mila');
  return { id: data.id, isActive: data.is_active };
}

/** Trust & Penalty — admin manually flags / unflags a user. Record-only: the
 *  automated cancel tracking may SET the flag, only a human clears it. */
export async function setUserFlagged(userId, isFlagged) {
  const { data, error } = await db.from('users')
    .update({ is_flagged: Boolean(isFlagged) })
    .eq('id', userId)
    .in('role', ['employer', 'worker'])
    .select('id, is_flagged')
    .maybeSingle();
  if (error) {
    if (/is_flagged/i.test(error.message)) {
      throw new Error('Flag column abhi database me nahi hai — 0011_trust_penalty.sql migration chalao');
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error('User nahi mila');
  return { id: data.id, isFlagged: data.is_flagged };
}

/** Trust & Penalty — admin manually flags / unflags a kaarigar profile. */
export async function setWorkerFlagged(workerId, isFlagged) {
  const { data, error } = await db.from('worker_profiles')
    .update({ is_flagged: Boolean(isFlagged) })
    .eq('id', workerId)
    .select(ADMIN_WORKER_SELECT)
    .maybeSingle();
  if (error) {
    if (/is_flagged/i.test(error.message)) {
      throw new Error('Flag column abhi database me nahi hai — 0011_trust_penalty.sql migration chalao');
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error('Worker profile nahi mila');
  return mapAdminWorker(data, await signedAadhaarUrl(data.aadhaar_photo_path));
}

// -----------------------------------------------------------------------------
// User reports (POST /reports se aane wale) — admin ki review queue.
// -----------------------------------------------------------------------------
const REPORT_SELECT =
  'id, reporter_id, reported_id, reason, description, status, created_at, ' +
  'reporter:users!reporter_id(id, name, phone), reported:users!reported_id(id, name, phone)';

const REPORT_STATUSES = ['pending', 'reviewed', 'resolved', 'dismissed'];

function mapReport(row) {
  return {
    id: row.id,
    reason: row.reason,
    description: row.description ?? null,
    status: row.status ?? 'pending',
    createdAt: row.created_at,
    reporter: row.reporter
      ? { id: row.reporter.id, name: row.reporter.name, phone: row.reporter.phone ?? null }
      : null,
    reported: row.reported
      ? { id: row.reported.id, name: row.reported.name, phone: row.reported.phone ?? null }
      : null,
  };
}

/** Reports list for the admin panel, newest first, optional status filter. */
export async function listAdminReports(status = 'all', page = 1, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const from = (safePage - 1) * safeLimit;
  let query = db.from('user_reports')
    .select(REPORT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + safeLimit - 1);
  if (status && status !== 'all') {
    if (!REPORT_STATUSES.includes(status)) throw new Error('Invalid report status');
    query = query.eq('status', status);
  }
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    reports: (data ?? []).map(mapReport),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / safeLimit),
    },
  };
}

/** Admin verdict on a report — marks it reviewed / resolved / dismissed. */
export async function setReportStatus(reportId, status) {
  if (!REPORT_STATUSES.includes(status) || status === 'pending') {
    throw new Error('Invalid report status');
  }
  const { data, error } = await db.from('user_reports')
    .update({ status })
    .eq('id', reportId)
    .select('id, status')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Report nahi mila');
  return { id: data.id, status: data.status };
}

const ADMIN_HIRE_SELECT =
  'id, employer_id, worker_id, description, location, proposed_rate, status, scheduled_date, ' +
  'completed_at, created_at, updated_at, employer:users(id, name, phone), ' +
  'worker:worker_profiles(id, user:users!user_id(id, name, phone))';
const HIRE_STATUSES = ['pending', 'accepted', 'rejected', 'completed', 'cancelled', 'en_route', 'arrived', 'in_progress'];

function emptyPerformance() {
  return { accepted: 0, rejected: 0, completed: 0, cancelled: 0, pending: 0, total: 0 };
}

/**
 * Aggregate each worker's LIFETIME hire history for the admin monitoring view.
 *
 * IMPORTANT: these numbers span every hire request the worker has ever had and
 * are therefore NOT the status of any single row in the hires table. They are
 * attached as `worker.lifetimeStats` and the UI labels them "Worker lifetime
 * stats" so an admin can never confuse them with the row's own `status`.
 *
 * "Accepted" includes jobs that are currently en_route/arrived/in_progress, so
 * it reflects every request the worker said yes to.
 */
async function workerLifetimeStatsMap(workerIds) {
  const unique = [...new Set((workerIds ?? []).filter(Boolean))];
  const performance = new Map();
  for (const id of unique) performance.set(id, emptyPerformance());
  if (unique.length === 0) return performance;

  const { data, error } = await db
    .from('hire_requests')
    .select('worker_id, status')
    .in('worker_id', unique);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const stats = performance.get(row.worker_id);
    if (!stats) continue;
    stats.total += 1;
    if (['accepted', 'en_route', 'arrived', 'in_progress'].includes(row.status)) {
      stats.accepted += 1;
    } else if (row.status === 'rejected') {
      stats.rejected += 1;
    } else if (row.status === 'completed') {
      stats.completed += 1;
    } else if (row.status === 'cancelled') {
      stats.cancelled += 1;
    } else if (row.status === 'pending') {
      stats.pending += 1;
    }
  }
  return performance;
}

export async function listAdminHires(status, page = 1, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  let query = db.from('hire_requests')
    .select(ADMIN_HIRE_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((safePage - 1) * safeLimit, safePage * safeLimit - 1);
  if (status && status !== 'all') {
    if (!HIRE_STATUSES.includes(status)) throw new Error('Invalid hire status');
    query = query.eq('status', status);
  }
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const lifetimeStats = await workerLifetimeStatsMap(rows.map((row) => row.worker_id));

  return {
    hires: rows.map((row) => {
      const stats = lifetimeStats.get(row.worker_id) ?? emptyPerformance();
      const worker = row.worker?.user
        ? { ...row.worker.user, lifetimeStats: stats }
        : null;
      return {
        id: row.id,
        employerId: row.employer_id,
        workerId: row.worker_id,
        description: row.description,
        location: row.location,
        proposedRate: row.proposed_rate,
        status: row.status,
        scheduledDate: row.scheduled_date,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        employer: row.employer,
        worker,
        // Lifetime aggregate for the worker (spans all of their hire requests),
        // NOT the status of this row — see workerLifetimeStatsMap().
        workerLifetimeStats: stats,
      };
    }),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / safeLimit),
    },
  };
}
