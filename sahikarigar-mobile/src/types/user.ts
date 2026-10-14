// User Types
export type UserRole = 'worker' | 'employer' | 'admin';

export interface User {
  id: string;
  /** Set for legacy Firebase accounts. Exactly one of firebaseUid / authUserId is set. */
  firebaseUid?: string | null;
  /** Set when the account authenticates through the auth-server (SuperTokens). */
  authUserId?: string | null;
  phone: string;
  name: string;
  role: UserRole;
  avatar?: string | null;
  locationArea?: string | null;
  locationCity?: string | null;
  lat?: number | null;
  lng?: number | null;
  isActive: boolean;
  isVerified: boolean;
  address?: string | null;
  trustScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserUpdateInput {
  name?: string;
  avatar?: string;
  locationArea?: string;
  locationCity?: string;
  lat?: number;
  lng?: number;
  address?: string;
}

/**
 * Small projection of a user that is safe to attach to other records.
 * `phone` is only populated on endpoints where the reveal is allowed
 * (e.g. an accepted hire request).
 */
export interface PublicUser {
  id: string;
  name: string;
  avatar?: string | null;
  phone?: string | null;
  locationArea?: string | null;
  locationCity?: string | null;
  isVerified?: boolean;
  trustScore?: number;
}
