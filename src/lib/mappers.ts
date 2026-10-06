import type {
  User,
  PublicUser,
  WorkerProfile,
  WorkerWithUser,
  HireRequest,
  HireRequestWithDetails,
  Review,
  ReviewWithReviewer,
  Skill,
  Availability,
  UserUpdateInput,
  WorkerProfileUpdateInput,
} from '@/types';

/**
 * Postgres stores snake_case columns while the app uses camelCase.
 * These mappers convert a raw Supabase row into an app domain object.
 * They are defensive because `numeric`/`bigint` columns can be returned as
 * strings depending on the driver/serializer.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

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

const toTextArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)) : [];

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export function mapUser(row: Row): User {
  return {
    id: String(row.id),
    // `firebase_uid` is nullable since the SuperTokens migration (0004).
    firebaseUid: row.firebase_uid ? String(row.firebase_uid) : '',
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    phone: String(row.phone),
    name: String(row.name),
    role: row.role,
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

export function mapPublicUser(row: Row): PublicUser {
  const user: PublicUser = {
    id: String(row.id),
    name: String(row.name ?? ''),
    avatar: toTextOrNull(row.avatar),
    locationArea: toTextOrNull(row.location_area),
    locationCity: toTextOrNull(row.location_city),
  };

  // `phone` is only present when the caller explicitly selected it.
  if (row.phone !== undefined && row.phone !== null) {
    user.phone = String(row.phone);
  }

  return user;
}

// ---------------------------------------------------------------------------
// worker_profiles
// ---------------------------------------------------------------------------

export function mapWorkerProfile(row: Row): WorkerProfile {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    skills: toTextArray(row.skills) as Skill[],
    experience: toNumber(row.experience),
    description: toTextOrNull(row.description),
    hourlyRate: toNumber(row.hourly_rate),
    availability: row.availability as Availability,
    portfolio: toTextArray(row.portfolio),
    ratingAverage: toNumber(row.rating_average),
    ratingCount: toNumber(row.rating_count),
    completedJobs: toNumber(row.completed_jobs),
    serviceAreas: toTextArray(row.service_areas),
    lat: toNumberOrNull(row.lat),
    lng: toNumberOrNull(row.lng),
    isApproved: row.is_approved === true,
    adminNotes: toTextOrNull(row.admin_notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Worker profile with an embedded (nested join) user object. */
export function mapWorkerWithUser(row: Row): WorkerWithUser {
  return {
    ...mapWorkerProfile(row),
    distanceKm: toNumberOrNull(row.distance_km),
    user: row.user ? mapPublicUser(row.user) : { id: String(row.user_id), name: '' },
  };
}

/** Row shape returned by the `search_workers` RPC (flattened user columns). */
export function mapWorkerSearchRow(row: Row): WorkerWithUser {
  return {
    ...mapWorkerProfile(row),
    distanceKm: toNumberOrNull(row.distance_km),
    user: {
      id: String(row.user_id),
      name: String(row.user_name ?? ''),
      avatar: toTextOrNull(row.user_avatar),
      locationArea: toTextOrNull(row.user_area),
      locationCity: toTextOrNull(row.user_city),
    },
  };
}

// ---------------------------------------------------------------------------
// hire_requests
// ---------------------------------------------------------------------------

export function mapHireRequest(row: Row): HireRequest {
  return {
    id: String(row.id),
    employerId: String(row.employer_id),
    workerId: String(row.worker_id),
    description: String(row.description),
    location: String(row.location),
    proposedRate: toNumber(row.proposed_rate),
    status: row.status,
    scheduledDate: toTextOrNull(row.scheduled_date),
    completedAt: toTextOrNull(row.completed_at),
    phoneRevealed: row.phone_revealed === true,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapHireRequestWithDetails(row: Row): HireRequestWithDetails {
  const details: HireRequestWithDetails = mapHireRequest(row);

  if (row.employer) details.employer = mapPublicUser(row.employer);
  if (row.worker) {
    details.worker = {
      ...mapWorkerProfile(row.worker),
      ...(row.worker.user ? { user: mapPublicUser(row.worker.user) } : {}),
    };
  }

  return details;
}

// ---------------------------------------------------------------------------
// reviews
// ---------------------------------------------------------------------------

export function mapReview(row: Row): Review {
  return {
    id: String(row.id),
    hireRequestId: String(row.hire_request_id),
    reviewerId: String(row.reviewer_id),
    workerId: String(row.worker_id),
    rating: toNumber(row.rating),
    comment: toTextOrNull(row.comment),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapReviewWithDetails(row: Row): ReviewWithReviewer {
  const details: ReviewWithReviewer = mapReview(row);

  if (row.reviewer) details.reviewer = mapPublicUser(row.reviewer);
  if (row.worker) {
    details.worker = {
      ...mapWorkerProfile(row.worker),
      ...(row.worker.user ? { user: mapPublicUser(row.worker.user) } : {}),
    };
  }

  return details;
}

// ---------------------------------------------------------------------------
// camelCase input -> snake_case row payloads (for UPDATE statements)
// ---------------------------------------------------------------------------

export function userUpdateToRow(input: Partial<UserUpdateInput>): Row {
  const row: Row = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.avatar !== undefined) row.avatar = input.avatar;
  if (input.address !== undefined) row.address = input.address;
  if (input.locationArea !== undefined) row.location_area = input.locationArea;
  if (input.locationCity !== undefined) row.location_city = input.locationCity;
  if (input.lat !== undefined) row.lat = input.lat;
  if (input.lng !== undefined) row.lng = input.lng;
  return row;
}

export function workerUpdateToRow(input: Partial<WorkerProfileUpdateInput>): Row {
  const row: Row = {};
  if (input.skills !== undefined) row.skills = input.skills;
  if (input.experience !== undefined) row.experience = input.experience;
  if (input.description !== undefined) row.description = input.description;
  if (input.hourlyRate !== undefined) row.hourly_rate = input.hourlyRate;
  if (input.availability !== undefined) row.availability = input.availability;
  if (input.portfolio !== undefined) row.portfolio = input.portfolio;
  if (input.serviceAreas !== undefined) row.service_areas = input.serviceAreas;
  if (input.lat !== undefined) row.lat = input.lat;
  if (input.lng !== undefined) row.lng = input.lng;
  return row;
}
