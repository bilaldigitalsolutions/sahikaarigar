// =============================================================================
// SahiKaarigar auth-server — admin operations
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from './users.js';

const ADMIN_SESSION_TTL_SECONDS = 4 * 60 * 60;

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
  const [payload, signature, extra] = token.split('.');
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
    serviceAreas: row.service_areas ?? [],
    isApproved: row.is_approved ?? false,
    verificationStatus: row.verification_status ?? (row.is_approved ? 'approved' : 'pending'),
    adminNotes: row.admin_notes ?? null,
    aadhaarPhotoUrl,
    createdAt: row.created_at,
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          phone: row.user.phone ?? null,
          avatar: row.user.avatar ?? null,
          locationArea: row.user.location_area ?? null,
          locationCity: row.user.location_city ?? null,
        }
      : null,
  };
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
    .select('*, user:users!user_id(id, name, phone, avatar, location_area, location_city)', { count: 'exact' })
    .eq('verification_status', status)
    .order('created_at', { ascending: false })
    .range(from, from + safeLimit - 1);

  if (error) throw new Error(error.message);
  const workers = await Promise.all((data ?? []).map(async (row) => {
    let aadhaarPhotoUrl = null;
    if (row.aadhaar_photo_path) {
      const { data: signed, error: signedError } = await db.storage
        .from('aadhaar-documents')
        .createSignedUrl(row.aadhaar_photo_path, 300);
      if (signedError) throw new Error(signedError.message);
      aadhaarPhotoUrl = signed.signedUrl;
    }
    return mapAdminWorker(row, aadhaarPhotoUrl);
  }));

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

/** Approve or reject a worker profile. */
export async function setWorkerApproval(workerId, approved, adminNotes) {
  const reason = typeof adminNotes === 'string' ? adminNotes.trim() : '';
  if (!approved && reason.length < 3) throw new Error('Reject karne ka reason likho');
  if (reason.length > 500) throw new Error('Reason 500 characters se chhota hona chahiye');
  const { data, error } = await db
    .from('worker_profiles')
    .update({
      is_approved: Boolean(approved),
      verification_status: approved ? 'approved' : 'rejected',
      admin_notes: approved ? null : reason,
    })
    .eq('id', workerId)
    .select('id, is_approved, verification_status, admin_notes')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Worker profile nahi mila');
  return {
    id: data.id,
    isApproved: data.is_approved,
    verificationStatus: data.verification_status,
    adminNotes: data.admin_notes ?? null,
  };
}

export async function getAdminStats() {
  const [users, hires, pending] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('hire_requests').select('id', { count: 'exact', head: true }),
    db.from('worker_profiles').select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending'),
  ]);
  for (const result of [users, hires, pending]) {
    if (result.error) throw new Error(result.error.message);
  }
  return {
    totalUsers: users.count ?? 0,
    totalHires: hires.count ?? 0,
    pendingVerifications: pending.count ?? 0,
  };
}

export async function listAdminUsers(role, search = '', page = 1, limit = 50) {
  if (!['employer', 'worker'].includes(role)) throw new Error('Invalid user role');
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  let query = db.from('users')
    .select('id, name, phone, role, avatar, is_active, created_at', { count: 'exact' })
    .eq('role', role)
    .order('created_at', { ascending: false })
    .range((safePage - 1) * safeLimit, safePage * safeLimit - 1);
  const term = String(search).trim().slice(0, 100).replace(/[%_,()."\\]/g, '');
  if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    users: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      role: row.role,
      avatar: row.avatar,
      isActive: row.is_active,
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

const ADMIN_HIRE_SELECT =
  'id, employer_id, worker_id, description, location, proposed_rate, status, scheduled_date, ' +
  'completed_at, created_at, updated_at, employer:users(id, name, phone), ' +
  'worker:worker_profiles(id, user:users!user_id(id, name, phone))';
const HIRE_STATUSES = ['pending', 'accepted', 'rejected', 'completed', 'cancelled', 'en_route', 'arrived'];

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
  return {
    hires: (data ?? []).map((row) => ({
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
      worker: row.worker?.user ?? null,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / safeLimit),
    },
  };
}

export async function setAdminHireStatus(hireId, status) {
  if (!HIRE_STATUSES.includes(status)) throw new Error('Invalid hire status');
  const { data, error } = await db.from('hire_requests')
    .update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', hireId)
    .select('id, status, updated_at')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Hire request nahi mili');
  return { id: data.id, status: data.status, updatedAt: data.updated_at };
}
