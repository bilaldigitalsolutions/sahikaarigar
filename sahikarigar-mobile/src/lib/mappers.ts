// =============================================================================
// Row mappers — Postgres uses snake_case, the app uses camelCase.
// =============================================================================
// The auth-server already returns camelCase for workers / hires / reviews, but
// `/me`, `/profile` and `/register-worker` return the raw `users` row, so we
// map those here (mirrors sahikarigar-app/src/lib/mappers.ts).
// =============================================================================

import type { User, PublicUser, UserRole } from '@/types';

type Row = Record<string, unknown>;

const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTextOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

/** Raw `users` row -> the app's User domain object. */
export function mapUser(row: Row): User {
  return {
    id: String(row.id),
    firebaseUid: row.firebase_uid ? String(row.firebase_uid) : '',
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    phone: String(row.phone),
    name: String(row.name),
    role: (row.role ?? 'employer') as UserRole,
    avatar: toTextOrNull(row.avatar),
    locationArea: toTextOrNull(row.location_area),
    locationCity: toTextOrNull(row.location_city),
    lat: toNumberOrNull(row.lat),
    lng: toNumberOrNull(row.lng),
    isActive: row.is_active !== false,
    isVerified: row.is_verified === true,
    address: toTextOrNull(row.address),
    trustScore: toNumber(row.trust_score),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Raw embedded user row -> the public projection. */
export function mapPublicUser(row: Row): PublicUser {
  const user: PublicUser = {
    id: String(row.id),
    name: String(row.name ?? ''),
    avatar: toTextOrNull(row.avatar),
    locationArea: toTextOrNull(row.location_area),
    locationCity: toTextOrNull(row.location_city),
  };
  if (row.phone !== undefined && row.phone !== null) {
    user.phone = String(row.phone);
  }
  if (row.is_verified !== undefined) {
    user.isVerified = row.is_verified === true;
  }
  if (row.trust_score !== undefined) {
    user.trustScore = toNumber(row.trust_score);
  }
  return user;
}
