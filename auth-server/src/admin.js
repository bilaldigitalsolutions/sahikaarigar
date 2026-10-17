// =============================================================================
// SahiKaarigar auth-server — admin (worker approval)
// =============================================================================
// A worker profile is created with `is_approved = false`, and public search only
// returns approved + available workers. So without this, a newly registered
// kaarigar would never show up. Approval is therefore part of going live.
//
// Who counts as an admin?
//   1. a user whose `role` is 'admin', OR
//   2. a phone number listed in the ADMIN_PHONES env var (comma separated).
// =============================================================================

import jwt from 'jsonwebtoken';

import { db } from './users.js';

const ADMIN_PHONES = (process.env.ADMIN_PHONES || '')
  .split(',')
  .map((value) => value.replace(/\D/g, ''))
  .filter(Boolean);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'change-me-in-production';

export function isAdmin(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return ADMIN_PHONES.includes(String(user.phone || '').replace(/\D/g, ''));
}

function mapPendingWorker(row) {
  if (!row) return null;
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
    adminNotes: row.admin_notes ?? null,
    createdAt: row.created_at,
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          phone: row.user.phone ?? null,
          locationArea: row.user.location_area ?? null,
          locationCity: row.user.location_city ?? null,
        }
      : null,
  };
}

/** Workers waiting for approval (newest first). */
export async function listPendingWorkers(page = 1, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const from = (safePage - 1) * safeLimit;

  const { data, error, count } = await db
    .from('worker_profiles')
    .select('*, user:users(id, name, phone, location_area, location_city)', { count: 'exact' })
    .eq('is_approved', false)
    .order('created_at', { ascending: false })
    .range(from, from + safeLimit - 1);

  if (error) throw new Error(error.message);

  return {
    workers: (data ?? []).map(mapPendingWorker),
    pagination: { page: safePage, limit: safeLimit, total: count ?? 0 },
  };
}

/** Approve (or un-approve) a worker profile. */
export async function setWorkerApproval(workerId, approved, adminNotes) {
  const patch = { is_approved: Boolean(approved) };
  if (typeof adminNotes === 'string') patch.admin_notes = adminNotes.trim() || null;

  const { data, error } = await db
    .from('worker_profiles')
    .update(patch)
    .eq('id', workerId)
    .select('id, is_approved, admin_notes')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Worker profile nahi mila');

  return { id: data.id, isApproved: data.is_approved, adminNotes: data.admin_notes ?? null };
}

/** Admin login: verify email+password against env vars, return a JWT token. */
export async function loginAdmin({ email, password }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD not configured on server');
  }

  if (email !== adminEmail || password !== adminPassword) {
    return { status: "WRONG_CREDENTIALS_ERROR" };
  }

  const token = jwt.sign({ role: 'admin', email }, ADMIN_SESSION_SECRET, {
    expiresIn: '4h',
  });

  return { status: "OK", token };
}

/** Validate an existing JWT Bearer token and confirm the user is an admin. */
export async function getAdminSession(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ADMIN_SESSION_SECRET);
    return { status: "OK", user: decoded };
  } catch (e) {
    throw new Error('Unauthorized');
  }
}
